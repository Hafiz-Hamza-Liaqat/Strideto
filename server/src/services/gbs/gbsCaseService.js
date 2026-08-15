/**
 * GBS Case workspace and pre-submission tracking (Phase 17D-8A).
 *
 * Origin: accepted GbsQuote only. Stop line: ready_for_submission.
 * No government filing, payment, documents, or messaging.
 */
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsQuote } from '../../models/gbs/GbsQuote.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../../models/gbs/ProviderDomainEnrollment.js';
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { User } from '../../models/User.js';
import {
  GBS_COMMAND_IDS,
  PROVIDER_SUBJECT_TYPES,
} from '../../../../shared/gbs/constants.js';
import { getBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';
import { evaluateReadyForQuoteAuthority } from '../../../../shared/gbs/serviceRequestProgression.js';
import { QUOTE_STATUSES } from '../../../../shared/gbs/quoteContract.js';
import {
  CASE_MILESTONES,
  CASE_STATUSES,
  CASE_TASK_KEYS,
  CASE_TASK_STATUSES,
  CASE_TIMELINE_ACTORS,
  CASE_TIMELINE_EVENT_TYPES,
  CASE_WORKFLOW_TEMPLATES,
  GBS_CASE_BOUNDS,
  isCaseTerminal,
  isCustomerCancellableStatus,
  isOpaqueCaseRef,
  isOpaqueTaskRef,
  taskAllowedForTemplate,
  taskCatalogEntry,
  templateAllowsInternalCompletion,
  workflowTemplateForCapability,
} from '../../../../shared/gbs/caseContract.js';
import {
  allowlistedActionInput,
  allowlistedCancelInput,
  allowlistedCompleteTaskInput,
  allowlistedEnsureInput,
  allowlistedRequestTaskInput,
  allowlistedUnableInput,
  customerCaseListItem,
  customerCaseProjection,
  parseCaseListQuery,
  parseExpectedVersion,
  providerCaseListItem,
  providerCaseProjection,
} from '../../../../shared/gbs/case.js';
import { PROVIDER_DOMAIN_IDS } from '../../../../shared/provider/providerDomains.js';
import {
  membershipSatisfiesDomainPermission,
  PROVIDER_DOMAIN_PERMISSIONS,
} from '../../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsCaseRecord } from '../platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';
import { createUserNotificationOnce } from '../notificationService.js';
import { enqueueJob } from '../jobQueueService.js';
import { generatePublicCaseRef, generatePublicTaskRef } from '../../utils/gbsCaseRef.js';
import { getUserCapabilityService } from '../capability/userCapabilityRuntime.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';

const Q = QUOTE_STATUSES;
const C = CASE_STATUSES;

function deny(code, status = 400, errors) {
  const err = Object.assign(new Error(code), { status, code });
  if (errors) err.errors = errors;
  return err;
}

function notFound() {
  return deny('not_found', 404);
}

function isMongoDuplicateKey(err) {
  return Number(err?.code) === 11000 || err?.codeName === 'DuplicateKey';
}

function duplicateKeyFields(err) {
  if (err?.keyPattern && typeof err.keyPattern === 'object') {
    return Object.keys(err.keyPattern);
  }
  return [];
}

function subjectFilter(subject) {
  return {
    providerSubjectType: subject.subjectType,
    providerSubjectId: String(subject.subjectId),
  };
}

function commandKey(body, headerCommandId, fallback) {
  const raw = body?.commandId || body?.creationCommandId || headerCommandId || fallback;
  return String(raw || fallback).trim().slice(0, GBS_CASE_BOUNDS.COMMAND_ID_MAX);
}

async function requireActiveBusinessClient(userId) {
  const service = getUserCapabilityService();
  const grants = await service.listEffective?.(userId).catch(() => null);
  if (Array.isArray(grants)) {
    const hit = grants.find((row) => row.capability === USER_CAPABILITY_IDS.BUSINESS_CLIENT);
    if (hit && (hit.status === GRANT_STATUSES.ACTIVE || hit.effective === true)) return;
  }
  const { UserCapabilityGrant } = await import('../../models/capability/UserCapabilityGrant.js');
  const grant = await UserCapabilityGrant.findOne({
    userId,
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    status: GRANT_STATUSES.ACTIVE,
  }).lean();
  if (!grant) throw deny('business_client_required', 403);
}

async function safeCustomerName(userId) {
  const user = await User.findById(userId).select('name').lean();
  const name = typeof user?.name === 'string' ? user.name.trim() : '';
  return name || 'Customer';
}

async function notifyOnce(payload) {
  try {
    return await createUserNotificationOnce(payload);
  } catch {
    return { created: false, notification: null };
  }
}

async function queueEmail({ to, subject, text, dedupKey }) {
  if (!to) return;
  try {
    await enqueueJob({
      type: 'email',
      dedupKey,
      payload: { to, subject, text },
    });
  } catch {
    /* queue failure must not roll back the case */
  }
}

async function notifyCustomer(record, { type, title, body }) {
  const user = await User.findById(record.requesterUserId).select('email').lean();
  const dedupeKey = `gbs:case:customer:${record._id}:${type}:${record.status}:${record.recordVersion}`;
  await notifyOnce({
    recipientType: 'user',
    userId: record.requesterUserId,
    category: 'marketplace',
    type,
    title,
    body,
    link: `/business/cases/${record.publicCaseRef}`,
    dedupeKey,
  });
  await queueEmail({
    to: user?.email,
    subject: title,
    text: body,
    dedupKey: `email:${dedupeKey}`,
  });
}

async function notifyProviders(record, { type, title, body }) {
  const dedupeBase = `gbs:case:provider:${record._id}:${type}:${record.status}:${record.recordVersion}`;
  if (record.providerSubjectType === PROVIDER_SUBJECT_TYPES.AGENT) {
    await notifyOnce({
      recipientType: 'agent',
      agentAccountId: record.providerSubjectId,
      category: 'marketplace',
      type,
      title,
      body,
      link: `/agent/business-services/cases/${record.publicCaseRef}`,
      dedupeKey: `${dedupeBase}:${record.providerSubjectId}`,
    });
    const account = await AgentAccount.findById(record.providerSubjectId).select('email').lean();
    await queueEmail({
      to: account?.email,
      subject: title,
      text: body,
      dedupKey: `email:${dedupeBase}:${record.providerSubjectId}`,
    });
    return;
  }

  const members = await AgentMembership.find({
    organizationId: record.providerSubjectId,
    active: true,
  }).lean();
  for (const membership of members) {
    if (
      !membershipSatisfiesDomainPermission(
        membership,
        PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
        PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW
      )
    ) {
      continue;
    }
    await notifyOnce({
      recipientType: 'agent',
      agentAccountId: membership.agentAccountId,
      category: 'marketplace',
      type,
      title,
      body,
      link: `/agent/business-services/cases/${record.publicCaseRef}`,
      dedupeKey: `${dedupeBase}:${membership.agentAccountId}`,
    });
  }
}

function caseAuditMeta(record, extra = {}) {
  return redactAuditMetadata({
    publicCaseRef: record.publicCaseRef,
    publicQuoteRef: record.publicQuoteRefSnapshot,
    requestPublicRef: record.requestPublicRefSnapshot,
    providerSubjectType: record.providerSubjectType,
    providerSubjectId: record.providerSubjectId,
    capabilityId: record.capabilityId,
    workflowTemplateKey: record.workflowTemplateKey,
    status: record.status,
    currentMilestoneKey: record.currentMilestoneKey,
    ...extra,
  });
}

function timelineEvent({ eventType, actorType, now, taskKey, fromStatus, toStatus, milestoneKey }) {
  return {
    eventType,
    actorType,
    at: now,
    taskKey: taskKey || null,
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    milestoneKey: milestoneKey || null,
  };
}

export async function evaluateCaseProfessionalAuthority({ listing, storedRequest, env, now = new Date() } = {}) {
  if (!listing) return { allowed: false, reason: 'listing_not_found' };
  const [capability, domain] = await Promise.all([
    ProviderCapability.findOne({
      subjectType: listing.subjectType,
      subjectId: String(listing.subjectId),
      capabilityId: listing.capabilityId,
    }).lean(),
    ProviderDomainEnrollment.findOne({
      subjectType: listing.subjectType,
      subjectId: String(listing.subjectId),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    }).lean(),
  ]);
  return evaluateReadyForQuoteAuthority({
    env,
    listing,
    capability,
    domainEnrollment: domain,
    storedRequest,
    now,
  });
}

async function assertProfessionalAuthority(record, env, now) {
  const listing = await GbsServiceListing.findById(record.listingId).lean();
  const request = await GbsServiceRequest.findById(record.serviceRequestId).lean();
  const gate = await evaluateCaseProfessionalAuthority({
    listing,
    storedRequest: request || {
      providerSubjectType: record.providerSubjectType,
      providerSubjectId: record.providerSubjectId,
      capabilityId: record.capabilityId,
    },
    env,
    now,
  });
  if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);
}

function requiredTasksComplete(record) {
  return (record.customerTasks || [])
    .filter((task) => task.type === 'customer_action' && task.required)
    .every((task) => task.status === CASE_TASK_STATUSES.COMPLETED);
}

async function loadOwnedCustomerCase(userId, caseRef) {
  if (!isOpaqueCaseRef(caseRef)) throw notFound();
  const record = await GbsCase.findOne({
    publicCaseRef: caseRef,
    requesterUserId: userId,
  });
  if (!record) throw notFound();
  return record;
}

async function loadExactProviderCase(subject, caseRef) {
  if (!isOpaqueCaseRef(caseRef)) throw notFound();
  const record = await GbsCase.findOne({
    publicCaseRef: caseRef,
    ...subjectFilter(subject),
  });
  if (!record) throw notFound();
  return record;
}

async function recoverDuplicateCase(err, { quoteId, commandId, requesterUserId, providerSubjectId }) {
  const fields = duplicateKeyFields(err);
  if (fields.includes('publicCaseRef') && !fields.includes('creationCommandId') && !fields.includes('quoteId')) {
    throw err;
  }
  const existing = fields.includes('quoteId')
    ? await GbsCase.findOne({ quoteId })
    : await GbsCase.findOne({ creationCommandId: commandId });
  if (!existing) throw err;
  if (String(existing.quoteId) !== String(quoteId)) throw deny('idempotency_conflict', 409);
  if (String(existing.requesterUserId) !== String(requesterUserId)) throw deny('idempotency_conflict', 409);
  if (String(existing.providerSubjectId) !== String(providerSubjectId)) throw deny('idempotency_conflict', 409);
  return existing;
}

/**
 * Distinct idempotent command: one GbsCase per accepted Quote.
 */
export async function ensureGbsCaseForAcceptedQuote({
  quote,
  actor = {},
  env = process.env,
  now = new Date(),
  headerCommandId,
  body = {},
} = {}) {
  if (!quote || quote.status !== Q.ACCEPTED) {
    throw deny('quote_not_accepted', 409);
  }
  const existing = await GbsCase.findOne({ quoteId: quote._id });
  if (existing) return existing;

  const request = await GbsServiceRequest.findById(quote.serviceRequestId);
  if (!request) throw deny('request_not_found', 409);
  if (String(request.requesterUserId) !== String(quote.requesterUserId)) {
    throw deny('quote_request_mismatch', 409);
  }
  if (
    request.providerSubjectType !== quote.providerSubjectType
    || String(request.providerSubjectId) !== String(quote.providerSubjectId)
  ) {
    throw deny('quote_request_mismatch', 409);
  }
  if (String(request.listingId) !== String(quote.listingId)) {
    throw deny('quote_request_mismatch', 409);
  }
  if (String(request.capabilityId) !== String(quote.capabilityId)) {
    throw deny('quote_request_mismatch', 409);
  }

  const listing = await GbsServiceListing.findById(quote.listingId).lean();
  const gate = await evaluateCaseProfessionalAuthority({
    listing,
    storedRequest: request,
    env,
    now,
  });
  if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);

  const parsed = allowlistedEnsureInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const commandId = commandKey(
    body,
    headerCommandId,
    `gbs.case.initialize:${String(quote._id)}`
  );
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.CASE_INITIALIZE,
    quoteId: String(quote._id),
    requesterUserId: String(quote.requesterUserId),
    providerSubjectType: quote.providerSubjectType,
    providerSubjectId: String(quote.providerSubjectId),
  });
  const store = getMongoIdempotencyStore();
  const capDef = getBusinessServicesCapability(quote.capabilityId);
  const templateKey = workflowTemplateForCapability(quote.capabilityId);
  let performed = false;

  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(quote.requesterUserId),
      tenantId: `user:${quote.requesterUserId}`,
      commandType: GBS_COMMAND_IDS.CASE_INITIALIZE,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        const again = await GbsCase.findOne({ quoteId: quote._id }).select('_id publicCaseRef').lean();
        if (again) return { caseId: String(again._id), publicCaseRef: again.publicCaseRef };
        let publicCaseRef = generatePublicCaseRef();
        for (let i = 0; i < 5; i += 1) {
          const clash = await GbsCase.findOne({ publicCaseRef }).select('_id').lean();
          if (!clash) break;
          publicCaseRef = generatePublicCaseRef();
        }
        try {
          const doc = await GbsCase.create({
            publicCaseRef,
            creationCommandId: commandId,
            quoteId: quote._id,
            serviceRequestId: quote.serviceRequestId,
            publicQuoteRefSnapshot: quote.publicQuoteRef,
            requestPublicRefSnapshot: quote.requestPublicRefSnapshot || request.publicRequestRef,
            requesterUserId: quote.requesterUserId,
            providerSubjectType: quote.providerSubjectType,
            providerSubjectId: String(quote.providerSubjectId),
            listingId: quote.listingId,
            capabilityId: quote.capabilityId,
            jurisdictionId: quote.jurisdictionId,
            countryCode: quote.countryCode,
            entityTypeId: quote.entityTypeId || null,
            workflowTemplateKey: templateKey,
            status: C.OPEN,
            currentMilestoneKey: CASE_MILESTONES.CASE_OPENED,
            titleSnapshot: quote.titleSnapshot || request.titleSnapshot || '',
            capabilityPublicNameSnapshot: capDef?.publicName || quote.capabilityPublicNameSnapshot || '',
            jurisdictionNameSnapshot: quote.jurisdictionNameSnapshot || request.jurisdictionNameSnapshot || '',
            providerDisplayNameSnapshot: quote.providerDisplayNameSnapshot || request.providerDisplayNameSnapshot || '',
            providerKindSnapshot: quote.providerKindSnapshot || request.providerKindSnapshot || 'independent',
            actingForSnapshot: quote.actingForSnapshot || request.actingFor || null,
            existingBusinessNameSnapshot: quote.existingBusinessNameSnapshot || request.existingBusinessName || null,
            preferredLanguageSnapshot: quote.preferredLanguageSnapshot || request.preferredLanguage || null,
            customerSummarySnapshot: quote.customerSummarySnapshot || request.customerSummary || '',
            customerTasks: [],
            timelineEvents: [
              timelineEvent({
                eventType: CASE_TIMELINE_EVENT_TYPES.CASE_OPENED,
                actorType: CASE_TIMELINE_ACTORS.SYSTEM,
                now,
                toStatus: C.OPEN,
                milestoneKey: CASE_MILESTONES.CASE_OPENED,
              }),
            ],
            recordVersion: 0,
            openedAt: now,
          });
          performed = true;
          return { caseId: String(doc._id), publicCaseRef: doc.publicCaseRef };
        } catch (err) {
          if (!isMongoDuplicateKey(err)) throw err;
          const recovered = await recoverDuplicateCase(err, {
            quoteId: quote._id,
            commandId,
            requesterUserId: quote.requesterUserId,
            providerSubjectId: quote.providerSubjectId,
          });
          return { caseId: String(recovered._id), publicCaseRef: recovered.publicCaseRef };
        }
      },
    });
    const created = await GbsCase.findById(result.result?.caseId);
    if (!created) {
      const fallback = await GbsCase.findOne({ quoteId: quote._id });
      if (!fallback) throw deny('case_initialize_failed', 500);
      return fallback;
    }
    if (performed && !result.replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_CASE_CREATED,
        targetType: 'GbsCase',
        targetId: String(created._id),
        metadata: caseAuditMeta(created),
      });
      await notifyCustomer(created, {
        type: 'gbs_case_opened',
        title: 'Your service Case is ready',
        body: 'A STRIDETO service Case was opened for operational tracking. No payment was taken and nothing was submitted to a government authority.',
      });
      await notifyProviders(created, {
        type: 'gbs_case_opened',
        title: 'A service Case was opened',
        body: 'A customer accepted a quote and a STRIDETO service Case is ready for pre-submission tracking.',
      });
    }
    return created;
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    if (isMongoDuplicateKey(err)) {
      return recoverDuplicateCase(err, {
        quoteId: quote._id,
        commandId,
        requesterUserId: quote.requesterUserId,
        providerSubjectId: quote.providerSubjectId,
      });
    }
    throw err;
  }
}

export async function ensureCustomerCaseForQuote({
  userId,
  quoteRef,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  await requireActiveBusinessClient(userId);
  const quote = await GbsQuote.findOne({ publicQuoteRef: quoteRef, requesterUserId: userId });
  if (!quote) throw notFound();
  const record = await ensureGbsCaseForAcceptedQuote({
    quote,
    actor,
    env,
    now,
    headerCommandId,
    body,
  });
  return customerCaseProjection(record);
}

export async function ensureProviderCaseForQuote({
  subject,
  quoteRef,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const quote = await GbsQuote.findOne({
    publicQuoteRef: quoteRef,
    ...subjectFilter(subject),
  });
  if (!quote) throw notFound();
  const record = await ensureGbsCaseForAcceptedQuote({
    quote,
    actor,
    env,
    now,
    headerCommandId,
    body,
  });
  const displayName = await safeCustomerName(record.requesterUserId);
  return providerCaseProjection(record, { displayName });
}

export async function listCustomerCases({ userId, query = {} } = {}) {
  const parsed = parseCaseListQuery(query);
  const filter = { requesterUserId: userId };
  if (parsed.status) filter.status = parsed.status;
  if (parsed.capabilityId) filter.capabilityId = parsed.capabilityId;
  if (parsed.jurisdictionId) filter.jurisdictionId = parsed.jurisdictionId;
  if (parsed.workflowTemplateKey) filter.workflowTemplateKey = parsed.workflowTemplateKey;
  const sort = parsed.sort === 'newest' ? { createdAt: -1 } : { updatedAt: -1, createdAt: -1 };
  const [total, rows] = await Promise.all([
    GbsCase.countDocuments(filter),
    GbsCase.find(filter).sort(sort).skip((parsed.page - 1) * parsed.limit).limit(parsed.limit).lean(),
  ]);
  return {
    items: rows.map((row) => customerCaseListItem(row)),
    page: parsed.page,
    limit: parsed.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / parsed.limit)),
  };
}

export async function getCustomerCase({ userId, caseRef } = {}) {
  const record = await loadOwnedCustomerCase(userId, caseRef);
  return customerCaseProjection(record);
}

export async function listProviderCases({ subject, query = {} } = {}) {
  const parsed = parseCaseListQuery(query);
  const filter = { ...subjectFilter(subject) };
  if (parsed.status) filter.status = parsed.status;
  if (parsed.capabilityId) filter.capabilityId = parsed.capabilityId;
  if (parsed.jurisdictionId) filter.jurisdictionId = parsed.jurisdictionId;
  if (parsed.workflowTemplateKey) filter.workflowTemplateKey = parsed.workflowTemplateKey;
  const sort = parsed.sort === 'newest' ? { createdAt: -1 } : { updatedAt: -1, createdAt: -1 };
  const [total, rows] = await Promise.all([
    GbsCase.countDocuments(filter),
    GbsCase.find(filter).sort(sort).skip((parsed.page - 1) * parsed.limit).limit(parsed.limit).lean(),
  ]);
  const items = [];
  for (const row of rows) {
    const displayName = await safeCustomerName(row.requesterUserId);
    items.push(providerCaseListItem(row, { displayName }));
  }
  return {
    items,
    page: parsed.page,
    limit: parsed.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / parsed.limit)),
  };
}

export async function getProviderCase({ subject, caseRef } = {}) {
  const record = await loadExactProviderCase(subject, caseRef);
  const displayName = await safeCustomerName(record.requesterUserId);
  return providerCaseProjection(record, { displayName });
}

async function runProviderMutation({
  subject,
  caseRef,
  expectedVersion,
  body,
  headerCommandId,
  actor,
  env,
  now,
  commandType,
  fingerprintExtra,
  extraFilter,
  apply,
  auditAction,
  notify,
}) {
  const parsed = commandType === GBS_COMMAND_IDS.CASE_REQUEST_CUSTOMER_ACTION
    ? allowlistedRequestTaskInput(body)
    : commandType === GBS_COMMAND_IDS.CASE_UNABLE_TO_PROCEED
      ? allowlistedUnableInput(body)
      : allowlistedActionInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const record = await loadExactProviderCase(subject, caseRef);
  if (isCaseTerminal(record.status) && commandType !== GBS_COMMAND_IDS.CASE_UNABLE_TO_PROCEED) {
    throw deny('invalid_status_transition', 409);
  }
  await assertProfessionalAuthority(record, env, now);
  const commandId = commandKey(body, headerCommandId, `${caseRef}:${commandType}:${expected}`);
  const store = getMongoIdempotencyStore();
  let performed = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest({
        command: commandType,
        caseRef,
        expectedVersion: expected,
        ...fingerprintExtra(parsed.value),
      }),
      perform: async () => {
        const patch = apply(record, parsed.value, now);
        const updatedRow = await mutateGbsCaseRecord({
          id: record._id,
          expectedVersion: expected,
          ownershipFilter: subjectFilter(subject),
          extraFilter: extraFilter(record),
          set: patch.set,
          push: patch.push,
          actor,
        });
        performed = true;
        return { caseId: String(updatedRow._id) };
      },
    });
    const updated = await GbsCase.findById(result.result?.caseId || record._id);
    if (performed && !result.replay) {
      await logAudit({
        actor,
        action: auditAction,
        targetType: 'GbsCase',
        targetId: String(updated._id),
        metadata: caseAuditMeta(updated, fingerprintExtra(parsed.value)),
      });
      if (notify) await notify(updated, parsed.value);
    }
    const displayName = await safeCustomerName(updated.requesterUserId);
    return providerCaseProjection(updated, { displayName });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export async function startPreparation({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  return runProviderMutation({
    subject,
    caseRef,
    expectedVersion,
    body,
    headerCommandId,
    actor,
    env,
    now,
    commandType: GBS_COMMAND_IDS.CASE_START_PREPARATION,
    fingerprintExtra: () => ({}),
    extraFilter: () => ({ status: C.OPEN }),
    apply: (record) => ({
      set: {
        status: C.IN_PROGRESS,
        currentMilestoneKey: CASE_MILESTONES.PREPARATION,
        preparationStartedAt: record.preparationStartedAt || now,
      },
      push: {
        timelineEvents: timelineEvent({
          eventType: CASE_TIMELINE_EVENT_TYPES.PREPARATION_STARTED,
          actorType: CASE_TIMELINE_ACTORS.PROVIDER,
          now,
          fromStatus: C.OPEN,
          toStatus: C.IN_PROGRESS,
          milestoneKey: CASE_MILESTONES.PREPARATION,
        }),
      },
    }),
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_STAGE_CHANGED,
    notify: async (updated) => {
      await notifyCustomer(updated, {
        type: 'gbs_case_preparation_started',
        title: 'Your provider is preparing your Case',
        body: 'The provider started preparing your STRIDETO service Case. This is not government processing.',
      });
    },
  });
}

export async function requestCustomerAction({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  return runProviderMutation({
    subject,
    caseRef,
    expectedVersion,
    body,
    headerCommandId,
    actor,
    env,
    now,
    commandType: GBS_COMMAND_IDS.CASE_REQUEST_CUSTOMER_ACTION,
    fingerprintExtra: (value) => ({ taskKey: value.taskKey }),
    extraFilter: () => ({
      status: { $in: [C.IN_PROGRESS, C.AWAITING_CLIENT] },
    }),
    apply: (record, value) => {
      if (!taskAllowedForTemplate(value.taskKey, record.workflowTemplateKey)) {
        throw deny('task_not_allowed_for_template', 400);
      }
      if ((record.customerTasks || []).length >= GBS_CASE_BOUNDS.TASKS_MAX) {
        throw deny('too_many_tasks', 400);
      }
      const openSame = (record.customerTasks || []).some(
        (task) => task.taskKey === value.taskKey && task.status === CASE_TASK_STATUSES.OPEN
      );
      if (openSame) throw deny('task_already_open', 409);
      const catalog = taskCatalogEntry(value.taskKey);
      const title = value.note
        ? catalog.title
        : catalog.title;
      const description = value.note
        ? `${catalog.description} ${value.note}`.trim().slice(0, GBS_CASE_BOUNDS.DESCRIPTION_MAX)
        : catalog.description;
      const task = {
        publicTaskRef: generatePublicTaskRef(),
        taskKey: catalog.taskKey,
        type: catalog.type,
        title,
        description,
        status: CASE_TASK_STATUSES.OPEN,
        required: catalog.required === true,
        customerInputType: catalog.customerInputType,
        choices: catalog.choices ? [...catalog.choices] : undefined,
        customerValue: '',
        createdByActorType: CASE_TIMELINE_ACTORS.PROVIDER,
        completedByActorType: null,
        createdAt: now,
        completedAt: null,
      };
      return {
        set: {
          status: C.AWAITING_CLIENT,
          currentMilestoneKey: CASE_MILESTONES.AWAITING_CUSTOMER_ACTION,
        },
        push: {
          customerTasks: task,
          timelineEvents: timelineEvent({
            eventType: CASE_TIMELINE_EVENT_TYPES.CUSTOMER_ACTION_REQUESTED,
            actorType: CASE_TIMELINE_ACTORS.PROVIDER,
            now,
            taskKey: catalog.taskKey,
            fromStatus: record.status,
            toStatus: C.AWAITING_CLIENT,
            milestoneKey: CASE_MILESTONES.AWAITING_CUSTOMER_ACTION,
          }),
        },
      };
    },
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_CUSTOMER_ACTION_REQUESTED,
    notify: async (updated) => {
      await notifyCustomer(updated, {
        type: 'gbs_case_action_required',
        title: 'Your provider requested an action in your Case',
        body: 'Open your STRIDETO service Case to complete a requested action. No documents or payment are involved.',
      });
    },
  });
}

export async function markReadyForSubmission({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  return runProviderMutation({
    subject,
    caseRef,
    expectedVersion,
    body,
    headerCommandId,
    actor,
    env,
    now,
    commandType: GBS_COMMAND_IDS.CASE_READY_FOR_SUBMISSION,
    fingerprintExtra: () => ({}),
    extraFilter: () => ({ status: { $in: [C.IN_PROGRESS, C.AWAITING_CLIENT] } }),
    apply: (record) => {
      if (!requiredTasksComplete(record)) throw deny('required_tasks_incomplete', 409);
      if (record.status === C.OPEN) throw deny('invalid_status_transition', 409);
      return {
        set: {
          status: C.READY_FOR_SUBMISSION,
          currentMilestoneKey: CASE_MILESTONES.READY_FOR_SUBMISSION,
          readyForSubmissionAt: now,
        },
        push: {
          timelineEvents: timelineEvent({
            eventType: CASE_TIMELINE_EVENT_TYPES.READY_FOR_SUBMISSION,
            actorType: CASE_TIMELINE_ACTORS.PROVIDER,
            now,
            fromStatus: record.status,
            toStatus: C.READY_FOR_SUBMISSION,
            milestoneKey: CASE_MILESTONES.READY_FOR_SUBMISSION,
          }),
        },
      };
    },
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_READY_FOR_SUBMISSION,
    notify: async (updated) => {
      await notifyCustomer(updated, {
        type: 'gbs_case_ready_for_submission',
        title: 'Your Case is ready for the next submission step',
        body: 'The provider marked your Case ready for the next filing or submission step. Strideto has not submitted anything to a government authority.',
      });
    },
  });
}

export async function markUnableToProceed({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  return runProviderMutation({
    subject,
    caseRef,
    expectedVersion,
    body,
    headerCommandId,
    actor,
    env,
    now,
    commandType: GBS_COMMAND_IDS.CASE_UNABLE_TO_PROCEED,
    fingerprintExtra: (value) => ({ reasonCode: value.reasonCode }),
    extraFilter: () => ({
      status: { $in: [C.OPEN, C.IN_PROGRESS, C.AWAITING_CLIENT, C.READY_FOR_SUBMISSION] },
    }),
    apply: (record, value) => ({
      set: {
        status: C.UNABLE_TO_PROCEED,
        currentMilestoneKey: CASE_MILESTONES.UNABLE_TO_PROCEED,
        unableToProceedAt: now,
        unableReasonCode: value.reasonCode,
      },
      push: {
        timelineEvents: timelineEvent({
          eventType: CASE_TIMELINE_EVENT_TYPES.CASE_UNABLE_TO_PROCEED,
          actorType: CASE_TIMELINE_ACTORS.PROVIDER,
          now,
          fromStatus: record.status,
          toStatus: C.UNABLE_TO_PROCEED,
          milestoneKey: CASE_MILESTONES.UNABLE_TO_PROCEED,
        }),
      },
    }),
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_UNABLE_TO_PROCEED,
    notify: async (updated) => {
      await notifyCustomer(updated, {
        type: 'gbs_case_unable_to_proceed',
        title: 'Your provider closed this Case',
        body: 'The provider marked this STRIDETO service Case as unable to proceed. No government decision was recorded.',
      });
    },
  });
}

export async function completeGenericService({
  subject,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  return runProviderMutation({
    subject,
    caseRef,
    expectedVersion,
    body,
    headerCommandId,
    actor,
    env,
    now,
    commandType: GBS_COMMAND_IDS.CASE_COMPLETE_GENERIC_SERVICE,
    fingerprintExtra: () => ({}),
    extraFilter: () => ({
      status: { $in: [C.IN_PROGRESS, C.AWAITING_CLIENT, C.READY_FOR_SUBMISSION] },
      workflowTemplateKey: CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE,
    }),
    apply: (record) => {
      if (!templateAllowsInternalCompletion(record.workflowTemplateKey)) {
        throw deny('completion_not_allowed', 409);
      }
      if (!requiredTasksComplete(record)) throw deny('required_tasks_incomplete', 409);
      return {
        set: {
          status: C.COMPLETED,
          currentMilestoneKey: CASE_MILESTONES.SERVICE_COMPLETED,
          completedAt: now,
        },
        push: {
          timelineEvents: timelineEvent({
            eventType: CASE_TIMELINE_EVENT_TYPES.GENERIC_SERVICE_COMPLETED,
            actorType: CASE_TIMELINE_ACTORS.PROVIDER,
            now,
            fromStatus: record.status,
            toStatus: C.COMPLETED,
            milestoneKey: CASE_MILESTONES.SERVICE_COMPLETED,
          }),
        },
      };
    },
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_GENERIC_SERVICE_COMPLETED,
    notify: async (updated) => {
      await notifyCustomer(updated, {
        type: 'gbs_case_service_completed',
        title: 'Your provider completed this Case',
        body: 'The provider marked this professional service Case complete. This is not a government registration or approval.',
      });
    },
  });
}

export async function completeCustomerTask({
  userId,
  caseRef,
  taskRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  now = new Date(),
} = {}) {
  await requireActiveBusinessClient(userId);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  if (!isOpaqueTaskRef(taskRef)) throw notFound();
  const record = await loadOwnedCustomerCase(userId, caseRef);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  const task = (record.customerTasks || []).find((row) => row.publicTaskRef === taskRef);
  if (!task) throw notFound();
  if (task.type !== 'customer_action') throw deny('task_not_customer_action', 409);
  if (task.status === CASE_TASK_STATUSES.COMPLETED) {
    return customerCaseProjection(record);
  }
  const parsed = allowlistedCompleteTaskInput(body, task);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const commandId = commandKey(body, headerCommandId, `${caseRef}:${taskRef}:complete:${expected}`);
  const store = getMongoIdempotencyStore();
  let performed = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(userId),
      tenantId: `user:${userId}`,
      commandType: GBS_COMMAND_IDS.CASE_COMPLETE_CUSTOMER_ACTION,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest({
        command: GBS_COMMAND_IDS.CASE_COMPLETE_CUSTOMER_ACTION,
        caseRef,
        taskRef,
        expectedVersion: expected,
      }),
      perform: async () => {
        const nextTasks = (record.customerTasks || []).map((row) => {
          if (row.publicTaskRef !== taskRef) return row.toObject ? row.toObject() : row;
          return {
            ...(row.toObject ? row.toObject() : row),
            status: CASE_TASK_STATUSES.COMPLETED,
            customerValue: parsed.value.customerValue,
            completedByActorType: CASE_TIMELINE_ACTORS.CUSTOMER,
            completedAt: now,
          };
        });
        const nextRecord = { ...record.toObject(), customerTasks: nextTasks };
        const allRequiredDone = requiredTasksComplete(nextRecord);
        const set = { customerTasks: nextTasks };
        if (task.taskKey === CASE_TASK_KEYS.PROPOSED_BUSINESS_NAME) {
          set.proposedBusinessName = parsed.value.customerValue;
        }
        let pushEvent = timelineEvent({
          eventType: CASE_TIMELINE_EVENT_TYPES.CUSTOMER_ACTION_COMPLETED,
          actorType: CASE_TIMELINE_ACTORS.CUSTOMER,
          now,
          taskKey: task.taskKey,
          fromStatus: record.status,
          toStatus: record.status,
        });
        if (allRequiredDone && record.status === C.AWAITING_CLIENT) {
          set.status = C.IN_PROGRESS;
          set.currentMilestoneKey = CASE_MILESTONES.PREPARATION;
          pushEvent = [
            pushEvent,
            timelineEvent({
              eventType: CASE_TIMELINE_EVENT_TYPES.PREPARATION_RESUMED,
              actorType: CASE_TIMELINE_ACTORS.SYSTEM,
              now,
              fromStatus: C.AWAITING_CLIENT,
              toStatus: C.IN_PROGRESS,
              milestoneKey: CASE_MILESTONES.PREPARATION,
            }),
          ];
        }
        const updatedRow = await mutateGbsCaseRecord({
          id: record._id,
          expectedVersion: expected,
          ownershipFilter: { requesterUserId: userId },
          extraFilter: { status: { $nin: [C.CANCELLED, C.UNABLE_TO_PROCEED, C.COMPLETED] } },
          set,
          push: { timelineEvents: { $each: Array.isArray(pushEvent) ? pushEvent : [pushEvent] } },
          actor,
        });
        performed = true;
        return { caseId: String(updatedRow._id) };
      },
    });
    const updated = await GbsCase.findById(result.result?.caseId || record._id);
    if (performed && !result.replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_CASE_CUSTOMER_ACTION_COMPLETED,
        targetType: 'GbsCase',
        targetId: String(updated._id),
        metadata: caseAuditMeta(updated, { taskKey: task.taskKey }),
      });
      await notifyProviders(updated, {
        type: 'gbs_case_action_completed',
        title: 'A customer completed a Case action',
        body: 'A Business Services customer completed a requested Case action.',
      });
    }
    return customerCaseProjection(updated);
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export async function cancelCustomerCase({
  userId,
  caseRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  now = new Date(),
} = {}) {
  await requireActiveBusinessClient(userId);
  const parsed = allowlistedCancelInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  const record = await loadOwnedCustomerCase(userId, caseRef);
  if (!isCustomerCancellableStatus(record.status)) throw deny('invalid_status_transition', 409);
  const commandId = commandKey(body, headerCommandId, `${caseRef}:cancel:${expected}`);
  const store = getMongoIdempotencyStore();
  let performed = false;
  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(userId),
      tenantId: `user:${userId}`,
      commandType: GBS_COMMAND_IDS.CASE_CANCEL,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest({
        command: GBS_COMMAND_IDS.CASE_CANCEL,
        caseRef,
        expectedVersion: expected,
        reasonCode: parsed.value.reasonCode,
      }),
      perform: async () => {
        const updatedRow = await mutateGbsCaseRecord({
          id: record._id,
          expectedVersion: expected,
          ownershipFilter: { requesterUserId: userId },
          extraFilter: {
            status: { $in: [C.OPEN, C.IN_PROGRESS, C.AWAITING_CLIENT, C.READY_FOR_SUBMISSION] },
          },
          set: {
            status: C.CANCELLED,
            currentMilestoneKey: CASE_MILESTONES.CANCELLED,
            cancelledAt: now,
            cancelReasonCode: parsed.value.reasonCode,
          },
          push: {
            timelineEvents: timelineEvent({
              eventType: CASE_TIMELINE_EVENT_TYPES.CASE_CANCELLED,
              actorType: CASE_TIMELINE_ACTORS.CUSTOMER,
              now,
              fromStatus: record.status,
              toStatus: C.CANCELLED,
              milestoneKey: CASE_MILESTONES.CANCELLED,
            }),
          },
          actor,
        });
        performed = true;
        return { caseId: String(updatedRow._id) };
      },
    });
    const updated = await GbsCase.findById(result.result?.caseId || record._id);
    if (performed && !result.replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_CASE_CANCELLED,
        targetType: 'GbsCase',
        targetId: String(updated._id),
        metadata: caseAuditMeta(updated, { reasonCode: parsed.value.reasonCode }),
      });
      await notifyProviders(updated, {
        type: 'gbs_case_cancelled',
        title: 'A customer cancelled a Case',
        body: 'A Business Services customer cancelled a STRIDETO service Case. The accepted quote remains a historical record. No refund was processed because payment is not configured.',
      });
    }
    return customerCaseProjection(updated);
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
}

export async function countCustomerCases({ userId } = {}) {
  const rows = await GbsCase.find({ requesterUserId: userId }).select('status').lean();
  const counts = {
    open: 0,
    in_progress: 0,
    awaiting_client: 0,
    ready_for_submission: 0,
    cancelled: 0,
    unable_to_proceed: 0,
    completed: 0,
    active: 0,
  };
  for (const row of rows) {
    if (counts[row.status] != null) counts[row.status] += 1;
    if (!isCaseTerminal(row.status) && row.status !== C.READY_FOR_SUBMISSION) counts.active += 1;
    if (row.status === C.READY_FOR_SUBMISSION) counts.active += 1;
  }
  return counts;
}
