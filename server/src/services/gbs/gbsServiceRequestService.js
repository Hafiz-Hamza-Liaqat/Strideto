/**
 * GBS Service Request lifecycle (Phase 17D-6).
 *
 * Marketplace-origin create requires live public eligibility.
 * Ready-for-quote re-checks listing moderation/capability/domain, not the
 * public marketplace flag. No Quote, Case, payment, or messaging rows.
 */
import mongoose from 'mongoose';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../../models/gbs/ProviderDomainEnrollment.js';
import { AgentProfile } from '../../models/agent/AgentProfile.js';
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { Organization } from '../../models/Organization.js';
import { User } from '../../models/User.js';
import {
  GBS_COMMAND_IDS,
  GBS_SERVICE_REQUEST_BOUNDS,
  GBS_SERVICE_REQUEST_SCHEMA_VERSION,
  GBS_SERVICE_REQUEST_STATUSES,
  PROVIDER_SUBJECT_TYPES,
  isValidServiceRequestStatus,
} from '../../../../shared/gbs/constants.js';
import { getBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';
import { projectProviderCatalog } from '../../../../shared/gbs/providerCatalogProjection.js';
import { evaluatePublicMarketplaceEligibility } from '../../../../shared/gbs/marketplaceEligibility.js';
import { evaluateReadyForQuoteAuthority } from '../../../../shared/gbs/serviceRequestProgression.js';
import {
  customerCanCancel,
  customerRequestProjection,
  normalizeCreateIntake,
  normalizeDeclineInput,
  normalizeTransitionNote,
  parseExpectedVersion,
  parseServiceRequestLimit,
  parseServiceRequestPage,
  providerCanDecline,
  providerCanReadyForQuote,
  providerCanReview,
  providerRequestProjection,
} from '../../../../shared/gbs/serviceRequest.js';
import { PROVIDER_DOMAIN_IDS } from '../../../../shared/provider/providerDomains.js';
import {
  membershipSatisfiesDomainPermission,
  PROVIDER_DOMAIN_PERMISSIONS,
} from '../../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsServiceRequestRecord } from '../platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';
import { createUserNotificationOnce } from '../notificationService.js';
import { enqueueJob } from '../jobQueueService.js';
import { generatePublicRequestRef, isOpaqueRequestRef } from '../../utils/gbsRequestRef.js';
import { getUserCapabilityService } from '../capability/userCapabilityRuntime.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';

const S = GBS_SERVICE_REQUEST_STATUSES;

function deny(code, status = 400) {
  return Object.assign(new Error(code), { status, code });
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

export function serviceRequestCreateFingerprint({ userId, listingId, intake }) {
  return fingerprintRequest({
    command: GBS_COMMAND_IDS.SERVICE_REQUEST_CREATE,
    requesterUserId: String(userId),
    listingId: String(listingId),
    actingFor: intake.actingFor,
    entityTypeId: intake.entityTypeId || '',
    customerSummary: intake.customerSummary,
    existingBusinessName: intake.existingBusinessName || '',
    preferredLanguage: intake.preferredLanguage || '',
    commandId: intake.creationCommandId,
  });
}

function storedCreateFingerprint(record) {
  return fingerprintRequest({
    command: GBS_COMMAND_IDS.SERVICE_REQUEST_CREATE,
    requesterUserId: String(record.requesterUserId),
    listingId: String(record.listingId),
    actingFor: record.actingFor,
    entityTypeId: record.entityTypeId || '',
    customerSummary: record.customerSummary,
    existingBusinessName: record.existingBusinessName || '',
    preferredLanguage: record.preferredLanguage || '',
    commandId: record.creationCommandId,
  });
}

async function recoverDuplicateCreate({ err, userId, intake, listing, fingerprint }) {
  const fields = duplicateKeyFields(err);
  if (fields.includes('publicRequestRef') && !fields.includes('creationCommandId')) {
    throw err;
  }
  const existing = await GbsServiceRequest.findOne({
    creationCommandId: intake.creationCommandId,
  });
  if (!existing) throw err;
  if (String(existing.requesterUserId) !== String(userId)) {
    throw Object.assign(new Error('idempotency_conflict'), {
      status: 409,
      code: 'duplicate_command_conflict',
    });
  }
  if (storedCreateFingerprint(existing) !== fingerprint) {
    throw Object.assign(new Error('idempotency_conflict'), {
      status: 409,
      code: 'duplicate_command_conflict',
    });
  }
  if (String(existing.listingId) !== String(listing._id)) {
    throw Object.assign(new Error('idempotency_conflict'), {
      status: 409,
      code: 'duplicate_command_conflict',
    });
  }
  return existing;
}

function notFound() {
  return deny('not_found', 404);
}

function versionConflict(currentVersion, expectedVersion) {
  return Object.assign(new Error('Conflict'), {
    status: 409,
    code: 'optimistic_concurrency_conflict',
    currentVersion,
    expectedVersion,
  });
}

function assertExpected(record, expected) {
  if (record.recordVersion !== expected) {
    throw versionConflict(record.recordVersion, expected);
  }
}

function subjectFilter(subject) {
  return {
    providerSubjectType: subject.subjectType,
    providerSubjectId: String(subject.subjectId),
  };
}

async function resolveListingForCreate(intake) {
  let listing = null;
  if (intake.listingSlug) {
    listing = await GbsServiceListing.findOne({ publicSlug: intake.listingSlug }).lean();
  } else if (intake.listingId && mongoose.isValidObjectId(intake.listingId)) {
    listing = await GbsServiceListing.findById(intake.listingId).lean();
  }
  if (!listing) throw notFound();
  if (intake.listingSlug && intake.listingId) {
    if (String(listing._id) !== String(intake.listingId) && listing.publicSlug !== intake.listingSlug) {
      throw notFound();
    }
  }
  return listing;
}

async function loadCreateEligibility(listing) {
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
  return { capability, domain };
}

async function resolveIdentity(listing) {
  if (listing.subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findById(listing.subjectId).select('displayName').lean();
    return {
      providerKind: 'agency',
      displayName: org?.displayName || 'Agency',
    };
  }
  const profile = await AgentProfile.findOne({ agentAccountId: listing.subjectId })
    .select('professionalName')
    .lean();
  return {
    providerKind: 'independent',
    displayName: profile?.professionalName || 'Independent provider',
  };
}

function jurisdictionName(listing) {
  const catalog = projectProviderCatalog({ now: new Date() });
  const jur = catalog.jurisdictions.find((row) => row.id === listing.jurisdictionId);
  return jur?.name || listing.jurisdictionId;
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
    /* queue failure must not roll back the request */
  }
}

async function notifyCustomer(record, { type, title, body, status }) {
  const user = await User.findById(record.requesterUserId).select('email').lean();
  const dedupeKey = `gbs:sr:customer:${record._id}:${type}:${status}:${record.recordVersion}`;
  await notifyOnce({
    recipientType: 'user',
    userId: record.requesterUserId,
    category: 'marketplace',
    type,
    title,
    body,
    link: `/business/requests/${record.publicRequestRef}`,
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
  const dedupeBase = `gbs:sr:provider:${record._id}:${type}:${record.status}:${record.recordVersion}`;
  if (record.providerSubjectType === PROVIDER_SUBJECT_TYPES.AGENT) {
    await notifyOnce({
      recipientType: 'agent',
      agentAccountId: record.providerSubjectId,
      category: 'marketplace',
      type,
      title,
      body,
      link: `/agent/business-services/requests/${record.publicRequestRef}`,
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
      link: `/agent/business-services/requests/${record.publicRequestRef}`,
      dedupeKey: `${dedupeBase}:${membership.agentAccountId}`,
    });
    const account = await AgentAccount.findById(membership.agentAccountId).select('email').lean();
    await queueEmail({
      to: account?.email,
      subject: title,
      text: body,
      dedupKey: `email:${dedupeBase}:${membership.agentAccountId}`,
    });
  }
}

function parseListQuery(query = {}) {
  const page = parseServiceRequestPage(query.page);
  const limit = parseServiceRequestLimit(query.limit);
  const status = query.status ? String(query.status).trim() : '';
  if (status && !isValidServiceRequestStatus(status)) {
    throw deny('invalid_status', 400);
  }
  const capabilityId = query.capabilityId ? String(query.capabilityId).trim().slice(0, 80) : '';
  const sort = query.sort && query.sort !== 'newest' ? null : 'newest';
  if (query.sort && query.sort !== 'newest') throw deny('invalid_sort', 400);
  return { page, limit, status, capabilityId, sort };
}

export async function createCustomerServiceRequest({ userId, body, headerCommandId, actor = {}, env = process.env } = {}) {
  const service = getUserCapabilityService();
  const grants = await service.listGrants(userId);
  const activeBuyer = (grants || []).some(
    (row) => row.capability === USER_CAPABILITY_IDS.BUSINESS_CLIENT && row.status === GRANT_STATUSES.ACTIVE
  );
  if (!activeBuyer) throw deny('capability_denied', 403);

  const commandId = String(body?.creationCommandId || headerCommandId || '').trim().slice(0, GBS_SERVICE_REQUEST_BOUNDS.COMMAND_ID_MAX);
  const parsed = normalizeCreateIntake({ ...body, creationCommandId: commandId || body?.creationCommandId });
  if (!parsed.ok) throw deny(parsed.error, 400);
  const intake = parsed.value;

  const listing = await resolveListingForCreate(intake);
  const { capability, domain } = await loadCreateEligibility(listing);
  const eligibility = evaluatePublicMarketplaceEligibility({
    env,
    listing,
    capability: capability || null,
    domainEnrollment: domain || null,
    protectedTitleEvidence: capability?.evidenceRefs || null,
  });
  if (!eligibility.allowed) throw notFound();

  if (intake.entityTypeId) {
    const allowed = Array.isArray(listing.entityTypeIds) ? listing.entityTypeIds : [];
    if (!allowed.includes(intake.entityTypeId)) throw deny('invalid_entity_type', 400);
  }

  const identity = await resolveIdentity(listing);
  const capDef = getBusinessServicesCapability(listing.capabilityId);
  const store = getMongoIdempotencyStore();
  const fingerprint = serviceRequestCreateFingerprint({
    userId,
    listingId: listing._id,
    intake,
  });
  let recoveredDuplicate = false;

  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(userId),
      tenantId: `user:${userId}`,
      commandType: GBS_COMMAND_IDS.SERVICE_REQUEST_CREATE,
      idempotencyKey: intake.creationCommandId,
      fingerprint,
      perform: async () => {
        let publicRequestRef = generatePublicRequestRef();
        for (let i = 0; i < 5; i += 1) {
          const clash = await GbsServiceRequest.findOne({ publicRequestRef }).select('_id').lean();
          if (!clash) break;
          publicRequestRef = generatePublicRequestRef();
        }
        try {
          const doc = await GbsServiceRequest.create({
            publicRequestRef,
            creationCommandId: intake.creationCommandId,
            requesterUserId: userId,
            listingId: listing._id,
            listingSlugSnapshot: listing.publicSlug,
            providerSubjectType: listing.subjectType,
            providerSubjectId: String(listing.subjectId),
            capabilityId: listing.capabilityId,
            countryCode: listing.countryCode,
            jurisdictionId: listing.jurisdictionId,
            entityTypeId: intake.entityTypeId || null,
            titleSnapshot: listing.title,
            capabilityPublicNameSnapshot: capDef?.publicName || listing.capabilityId,
            jurisdictionNameSnapshot: jurisdictionName(listing),
            providerDisplayNameSnapshot: identity.displayName,
            providerKindSnapshot: identity.providerKind,
            actingFor: intake.actingFor,
            existingBusinessName: intake.existingBusinessName || null,
            customerSummary: intake.customerSummary,
            preferredLanguage: intake.preferredLanguage || null,
            status: S.SUBMITTED,
            recordVersion: 0,
            schemaVersion: GBS_SERVICE_REQUEST_SCHEMA_VERSION,
          });
          return { requestId: String(doc._id), publicRequestRef: doc.publicRequestRef };
        } catch (err) {
          if (!isMongoDuplicateKey(err)) throw err;
          const existing = await recoverDuplicateCreate({
            err,
            userId,
            intake,
            listing,
            fingerprint,
          });
          recoveredDuplicate = true;
          return {
            requestId: String(existing._id),
            publicRequestRef: existing.publicRequestRef,
          };
        }
      },
    });

    if (result.replay || recoveredDuplicate) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.IDEMPOTENCY_REPLAY,
        metadata: redactAuditMetadata({ commandId: intake.creationCommandId }),
      });
    }

    const requestId = result.result?.requestId;
    const record = requestId
      ? await GbsServiceRequest.findById(requestId)
      : await GbsServiceRequest.findOne({ creationCommandId: intake.creationCommandId });
    if (!record) throw deny('request_create_failed', 500);
    if (String(record.requesterUserId) !== String(userId)) {
      throw deny('idempotency_conflict', 409);
    }

    if (!result.replay && !recoveredDuplicate) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_CREATED,
        targetType: 'GbsServiceRequest',
        targetId: String(record._id),
        metadata: redactAuditMetadata({
          publicRequestRef: record.publicRequestRef,
          listingId: String(record.listingId),
          providerSubjectType: record.providerSubjectType,
          capabilityId: record.capabilityId,
          status: record.status,
        }),
      });
      await notifyCustomer(record, {
        type: 'gbs_service_request_submitted',
        title: 'Service request submitted',
        body: 'Your Business Services request was submitted.',
        status: record.status,
      });
      await notifyProviders(record, {
        type: 'gbs_service_request_received',
        title: 'New service request',
        body: 'A customer submitted a Business Services request.',
      });
    }

    return customerRequestProjection(record);
  } catch (err) {
    if (
      err.code === IDEMPOTENCY_CODES.CONFLICT
      || err.code === 'idempotency_conflict'
      || err.code === 'duplicate_command_conflict'
    ) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.IDEMPOTENCY_CONFLICT,
        status: 'failure',
        metadata: redactAuditMetadata({ commandId: intake.creationCommandId }),
      });
      throw deny('idempotency_conflict', 409);
    }
    if (isMongoDuplicateKey(err)) {
      const existing = await recoverDuplicateCreate({
        err,
        userId,
        intake,
        listing,
        fingerprint,
      });
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.IDEMPOTENCY_REPLAY,
        metadata: redactAuditMetadata({ commandId: intake.creationCommandId }),
      });
      return customerRequestProjection(existing);
    }
    throw err;
  }
}

export async function listCustomerServiceRequests({ userId, query } = {}) {
  const { page, limit, status, capabilityId } = parseListQuery(query);
  const filter = { requesterUserId: userId };
  if (status) filter.status = status;
  if (capabilityId) filter.capabilityId = capabilityId;
  const [total, items] = await Promise.all([
    GbsServiceRequest.countDocuments(filter),
    GbsServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return {
    items: items.map(customerRequestProjection),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getCustomerServiceRequest({ userId, requestRef } = {}) {
  if (!isOpaqueRequestRef(requestRef)) throw notFound();
  const record = await GbsServiceRequest.findOne({
    publicRequestRef: requestRef,
    requesterUserId: userId,
  }).lean();
  if (!record) throw notFound();
  return customerRequestProjection(record);
}

export async function getCustomerOverview({ userId } = {}) {
  const recent = await GbsServiceRequest.find({ requesterUserId: userId })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();
  const all = await GbsServiceRequest.find({ requesterUserId: userId }).select('status').lean();
  const counts = {
    submitted: 0,
    provider_reviewing: 0,
    ready_for_quote: 0,
    declined: 0,
    cancelled: 0,
    active: 0,
  };
  for (const row of all) {
    if (counts[row.status] != null) counts[row.status] += 1;
    if (row.status === S.SUBMITTED || row.status === S.PROVIDER_REVIEWING || row.status === S.READY_FOR_QUOTE) {
      counts.active += 1;
    }
  }
  return {
    counts,
    recent: recent.map(customerRequestProjection),
  };
}

async function loadOwnedCustomer(userId, requestRef) {
  if (!isOpaqueRequestRef(requestRef)) throw notFound();
  const record = await GbsServiceRequest.findOne({
    publicRequestRef: requestRef,
    requesterUserId: userId,
  });
  if (!record) throw notFound();
  return record;
}

async function loadExactProviderRequest(subject, requestRef) {
  if (!isOpaqueRequestRef(requestRef)) throw notFound();
  const record = await GbsServiceRequest.findOne({
    publicRequestRef: requestRef,
    ...subjectFilter(subject),
  });
  if (!record) throw notFound();
  return record;
}

export async function cancelCustomerServiceRequest({ userId, requestRef, expectedVersion, actor = {} } = {}) {
  const current = await loadOwnedCustomer(userId, requestRef);
  const expected = parseExpectedVersion(expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  if (current.status === S.CANCELLED && current.recordVersion === expected) {
    return customerRequestProjection(current);
  }
  assertExpected(current, expected);
  if (!customerCanCancel(current.status)) throw deny('invalid_status_transition', 409);

  const updated = await mutateGbsServiceRequestRecord({
    id: current._id,
    expectedVersion: expected,
    ownershipFilter: { requesterUserId: userId },
    set: {
      status: S.CANCELLED,
      requesterCancelledAt: new Date(),
    },
    actor,
  });

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_CANCELLED,
    targetType: 'GbsServiceRequest',
    targetId: String(updated._id),
    metadata: redactAuditMetadata({
      publicRequestRef: updated.publicRequestRef,
      oldStatus: current.status,
      newStatus: updated.status,
    }),
  });
  await notifyCustomer(updated, {
    type: 'gbs_service_request_cancelled',
    title: 'Service request cancelled',
    body: 'Your Business Services request was cancelled.',
    status: updated.status,
  });
  await notifyProviders(updated, {
    type: 'gbs_service_request_cancelled',
    title: 'Service request cancelled',
    body: 'The customer cancelled this Business Services request.',
  });
  return customerRequestProjection(updated);
}

export async function listProviderServiceRequests({ subject, query } = {}) {
  const { page, limit, status, capabilityId } = parseListQuery(query);
  const filter = subjectFilter(subject);
  if (status) filter.status = status;
  if (capabilityId) filter.capabilityId = capabilityId;
  const [total, items] = await Promise.all([
    GbsServiceRequest.countDocuments(filter),
    GbsServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  const names = new Map();
  for (const row of items) {
    if (!names.has(String(row.requesterUserId))) {
      names.set(String(row.requesterUserId), await safeCustomerName(row.requesterUserId));
    }
  }
  return {
    items: items.map((row) =>
      providerRequestProjection(row, { displayName: names.get(String(row.requesterUserId)) })
    ),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProviderServiceRequest({ subject, requestRef } = {}) {
  const record = await loadExactProviderRequest(subject, requestRef);
  const displayName = await safeCustomerName(record.requesterUserId);
  return providerRequestProjection(record.toObject ? record.toObject() : record, { displayName });
}

async function applyProviderTransition({
  subject,
  requestRef,
  expectedVersion,
  actor,
  allowed,
  nextStatus,
  extraSet = {},
  auditAction,
  customerNotify,
  skipIfAlready,
}) {
  const current = await loadExactProviderRequest(subject, requestRef);
  const expected = parseExpectedVersion(expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);

  if (skipIfAlready(current) && current.recordVersion === expected) {
    const displayName = await safeCustomerName(current.requesterUserId);
    return providerRequestProjection(current.toObject ? current.toObject() : current, { displayName });
  }
  assertExpected(current, expected);
  if (!allowed(current.status)) throw deny('invalid_status_transition', 409);

  const updated = await mutateGbsServiceRequestRecord({
    id: current._id,
    expectedVersion: expected,
    ownershipFilter: subjectFilter(subject),
    set: {
      status: nextStatus,
      ...extraSet,
    },
    actor,
  });

  await logAudit({
    actor,
    action: auditAction,
    targetType: 'GbsServiceRequest',
    targetId: String(updated._id),
    metadata: redactAuditMetadata({
      publicRequestRef: updated.publicRequestRef,
      listingId: String(updated.listingId),
      providerSubjectType: updated.providerSubjectType,
      capabilityId: updated.capabilityId,
      oldStatus: current.status,
      newStatus: updated.status,
      reasonCode: extraSet.declineReasonCode || undefined,
    }),
  });

  if (customerNotify) {
    await notifyCustomer(updated, customerNotify);
  }

  const displayName = await safeCustomerName(updated.requesterUserId);
  return providerRequestProjection(updated.toObject ? updated.toObject() : updated, { displayName });
}

export async function reviewProviderServiceRequest({ subject, requestRef, expectedVersion, actor = {}, body } = {}) {
  const parsed = normalizeTransitionNote(body || {});
  if (!parsed.ok) throw deny(parsed.error, 400);
  return applyProviderTransition({
    subject,
    requestRef,
    expectedVersion,
    actor,
    allowed: providerCanReview,
    nextStatus: S.PROVIDER_REVIEWING,
    extraSet: {
      providerReviewingAt: new Date(),
      providerTransitionNote: parsed.value.providerTransitionNote || undefined,
    },
    auditAction: GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_STATUS_UPDATED,
    customerNotify: {
      type: 'gbs_service_request_status_updated',
      title: 'Provider is reviewing your request',
      body: 'The provider marked your Business Services request as reviewing.',
      status: S.PROVIDER_REVIEWING,
    },
    skipIfAlready: (row) => row.status === S.PROVIDER_REVIEWING,
  });
}

export async function declineProviderServiceRequest({ subject, requestRef, expectedVersion, actor = {}, body } = {}) {
  const parsed = normalizeDeclineInput(body || {});
  if (!parsed.ok) throw deny(parsed.error, 400);
  return applyProviderTransition({
    subject,
    requestRef,
    expectedVersion,
    actor,
    allowed: providerCanDecline,
    nextStatus: S.DECLINED,
    extraSet: {
      providerDecisionAt: new Date(),
      declineReasonCode: parsed.value.declineReasonCode,
      declineNote: parsed.value.declineNote || null,
      providerTransitionNote: parsed.value.declineNote || undefined,
    },
    auditAction: GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_DECLINED,
    customerNotify: {
      type: 'gbs_service_request_declined',
      title: 'Service request declined',
      body: 'The provider declined this Business Services request.',
      status: S.DECLINED,
    },
    skipIfAlready: (row) =>
      row.status === S.DECLINED && row.declineReasonCode === parsed.value.declineReasonCode,
  });
}

export async function readyForQuoteProviderServiceRequest({
  subject,
  requestRef,
  expectedVersion,
  actor = {},
  body,
  env = process.env,
} = {}) {
  const parsed = normalizeTransitionNote(body || {});
  if (!parsed.ok) throw deny(parsed.error, 400);
  const current = await loadExactProviderRequest(subject, requestRef);
  const expected = parseExpectedVersion(expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);

  if (current.status === S.READY_FOR_QUOTE && current.recordVersion === expected) {
    const displayName = await safeCustomerName(current.requesterUserId);
    return providerRequestProjection(current.toObject ? current.toObject() : current, { displayName });
  }
  assertExpected(current, expected);
  if (!providerCanReadyForQuote(current.status)) throw deny('invalid_status_transition', 409);

  const listing = await GbsServiceListing.findById(current.listingId).lean();
  const { capability, domain } = listing
    ? await loadCreateEligibility(listing)
    : { capability: null, domain: null };
  const gate = evaluateReadyForQuoteAuthority({
    env,
    listing,
    capability,
    domainEnrollment: domain,
    storedRequest: current,
  });
  if (!gate.allowed) {
    throw deny(gate.reason || 'listing_authority_invalid', 403);
  }

  const updated = await mutateGbsServiceRequestRecord({
    id: current._id,
    expectedVersion: expected,
    ownershipFilter: subjectFilter(subject),
    set: {
      status: S.READY_FOR_QUOTE,
      providerDecisionAt: new Date(),
      providerTransitionNote: parsed.value.providerTransitionNote || undefined,
    },
    actor,
  });

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_READY_FOR_QUOTE,
    targetType: 'GbsServiceRequest',
    targetId: String(updated._id),
    metadata: redactAuditMetadata({
      publicRequestRef: updated.publicRequestRef,
      listingId: String(updated.listingId),
      providerSubjectType: updated.providerSubjectType,
      capabilityId: updated.capabilityId,
      oldStatus: current.status,
      newStatus: updated.status,
    }),
  });
  await notifyCustomer(updated, {
    type: 'gbs_service_request_ready_for_quote',
    title: 'Ready for quote',
    body: 'The provider marked your request ready for quote. No quote has been created yet.',
    status: updated.status,
  });

  const displayName = await safeCustomerName(updated.requesterUserId);
  return providerRequestProjection(updated.toObject ? updated.toObject() : updated, { displayName });
}
