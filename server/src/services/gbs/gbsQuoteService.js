/**
 * GBS Quote lifecycle (Phase 17D-7).
 *
 * Quotes originate only from ready_for_quote Service Requests.
 * No payment, government filing, messaging, or documents.
 * Accepting a quote ensures a GbsCase for pre-submission tracking.
 */
import { GbsQuote } from '../../models/gbs/GbsQuote.js';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../../models/gbs/ProviderDomainEnrollment.js';
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { User } from '../../models/User.js';
import {
  GBS_COMMAND_IDS,
  GBS_SERVICE_REQUEST_STATUSES,
  PROVIDER_SUBJECT_TYPES,
} from '../../../../shared/gbs/constants.js';
import { getBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';
import { projectProviderCatalog } from '../../../../shared/gbs/providerCatalogProjection.js';
import { evaluateReadyForQuoteAuthority } from '../../../../shared/gbs/serviceRequestProgression.js';
import { professionalFeeSummary } from '../../../../shared/gbs/marketplaceProjection.js';
import { verificationBadge } from '../../../../shared/gbs/marketplaceProjection.js';
import {
  GBS_QUOTE_BOUNDS,
  GBS_QUOTE_SCHEMA_VERSION,
  QUOTE_STATUSES,
  assertListingPriceHonesty,
  computeExpiresAt,
  computeQuoteTotals,
  normalizeValidForDays,
  quoteIsEffectivelyExpired,
  snapshotOfficialFee,
} from '../../../../shared/gbs/quoteContract.js';
import {
  allowlistedActionInput,
  allowlistedCreateInput,
  allowlistedDeclineInput,
  allowlistedDraftUpdate,
  allowlistedSendInput,
  customerQuoteListItem,
  customerQuoteProjection,
  parseExpectedVersion,
  parseQuoteListQuery,
  providerQuoteListItem,
  providerQuoteProjection,
} from '../../../../shared/gbs/quote.js';
import { PROVIDER_DOMAIN_IDS } from '../../../../shared/provider/providerDomains.js';
import {
  membershipSatisfiesDomainPermission,
  PROVIDER_DOMAIN_PERMISSIONS,
} from '../../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsQuoteRecord } from '../platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';
import { createUserNotificationOnce } from '../notificationService.js';
import { enqueueJob } from '../jobQueueService.js';
import { generatePublicQuoteRef, isOpaqueQuoteRef } from '../../utils/gbsQuoteRef.js';
import { getUserCapabilityService } from '../capability/userCapabilityRuntime.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';

const S = GBS_SERVICE_REQUEST_STATUSES;
const Q = QUOTE_STATUSES;

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

export async function evaluateQuoteProfessionalAuthority({ listing, storedRequest, env, now = new Date() } = {}) {
  if (!listing) return { allowed: false, reason: 'listing_not_found' };
  const { capability, domain } = await loadCreateEligibility(listing);
  return evaluateReadyForQuoteAuthority({
    env,
    listing,
    capability,
    domainEnrollment: domain,
    storedRequest,
    now,
  });
}

function catalogFeesForListing(listing, now = new Date()) {
  const catalog = projectProviderCatalog({ now });
  const entitySet = new Set(listing.entityTypeIds || []);
  return catalog.fees.filter((fee) => {
    if (listing.capabilityId === 'ein_assistance' && fee.feeId === 'fee:US-IRS-EIN') {
      return fee.eligibleCurrent === true;
    }
    if (fee.jurisdictionId !== listing.jurisdictionId) return false;
    if (fee.entityTypeId && entitySet.size && !entitySet.has(fee.entityTypeId)) return false;
    return fee.eligibleCurrent === true;
  });
}

function snapshotOfficialFeeIds(listing, feeIds, now = new Date()) {
  const available = catalogFeesForListing(listing, now);
  const byId = new Map(available.map((fee) => [fee.feeId, fee]));
  const snapshots = [];
  for (const feeId of feeIds || []) {
    const fee = byId.get(feeId);
    if (!fee) {
      throw deny('official_fee_not_catalogued', 400);
    }
    const snap = snapshotOfficialFee(fee);
    if (!snap) throw deny('official_fee_snapshot_failed', 400);
    snapshots.push(snap);
  }
  return snapshots;
}

function applyTotals(docLike) {
  const totals = computeQuoteTotals({
    currency: docLike.currency,
    professionalFeeLines: docLike.professionalFeeLines || [],
    officialFeeLines: docLike.officialFeeLines || [],
  });
  return {
    ...totals,
    thirdPartyFeeLines: [],
  };
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
    /* queue failure must not roll back the quote */
  }
}

async function notifyCustomer(record, { type, title, body, status }) {
  const user = await User.findById(record.requesterUserId).select('email').lean();
  const dedupeKey = `gbs:quote:customer:${record._id}:${type}:${status}:${record.recordVersion}`;
  await notifyOnce({
    recipientType: 'user',
    userId: record.requesterUserId,
    category: 'marketplace',
    type,
    title,
    body,
    link: `/business/quotes/${record.publicQuoteRef}`,
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
  const dedupeBase = `gbs:quote:provider:${record._id}:${type}:${record.status}:${record.recordVersion}`;
  if (record.providerSubjectType === PROVIDER_SUBJECT_TYPES.AGENT) {
    await notifyOnce({
      recipientType: 'agent',
      agentAccountId: record.providerSubjectId,
      category: 'marketplace',
      type,
      title,
      body,
      link: `/agent/business-services/quotes/${record.publicQuoteRef}`,
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
      link: `/agent/business-services/quotes/${record.publicQuoteRef}`,
      dedupeKey: `${dedupeBase}:${membership.agentAccountId}`,
    });
  }
}

function quoteAuditMeta(record, extra = {}) {
  return redactAuditMetadata({
    publicQuoteRef: record.publicQuoteRef,
    requestPublicRef: record.requestPublicRefSnapshot,
    providerSubjectType: record.providerSubjectType,
    providerSubjectId: record.providerSubjectId,
    capabilityId: record.capabilityId,
    status: record.status,
    currency: record.currency,
    subtotalProfessionalMinor: record.subtotalProfessionalMinor,
    officialCurrencies: (record.officialFeeGroups || []).map((g) => g.currency),
    quoteRevision: record.quoteRevision,
    ...extra,
  });
}

export async function normalizeExpiredQuoteForMutation(quote, actor = {}, now = new Date()) {
  if (!quote) return quote;
  const current = quote.toObject ? quote.toObject() : quote;
  if (current.status === Q.EXPIRED) return quote;
  if (current.status !== Q.SENT) return quote;
  if (!quoteIsEffectivelyExpired(current, now)) return quote;

  const updated = await GbsQuote.findOneAndUpdate(
    {
      _id: current._id,
      status: Q.SENT,
      expiresAt: { $lte: now },
    },
    {
      $set: { status: Q.EXPIRED, expiredAt: now },
      $inc: { recordVersion: 1 },
    },
    { new: true }
  );
  if (!updated) {
    return GbsQuote.findById(current._id);
  }
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_QUOTE_EXPIRED,
    targetType: 'GbsQuote',
    targetId: String(updated._id),
    metadata: quoteAuditMeta(updated, { fromStatus: Q.SENT, toStatus: Q.EXPIRED }),
  });
  return updated;
}

async function loadExactProviderQuote(subject, quoteRef) {
  if (!isOpaqueQuoteRef(quoteRef)) throw notFound();
  const record = await GbsQuote.findOne({
    publicQuoteRef: quoteRef,
    ...subjectFilter(subject),
  });
  if (!record) throw notFound();
  return record;
}

async function loadOwnedCustomerQuote(userId, quoteRef) {
  if (!isOpaqueQuoteRef(quoteRef)) throw notFound();
  const record = await GbsQuote.findOne({
    publicQuoteRef: quoteRef,
    requesterUserId: userId,
  });
  if (!record) throw notFound();
  return record;
}

async function loadExactProviderRequest(subject, requestRef) {
  const record = await GbsServiceRequest.findOne({
    publicRequestRef: requestRef,
    ...subjectFilter(subject),
  });
  if (!record) throw notFound();
  return record;
}

async function assertNoAcceptedQuote(serviceRequestId) {
  const accepted = await GbsQuote.findOne({
    serviceRequestId,
    status: Q.ACCEPTED,
  }).select('_id').lean();
  if (accepted) throw deny('quote_already_accepted', 409);
}

async function nextRevisionForRequest(serviceRequestId) {
  const latest = await GbsQuote.findOne({ serviceRequestId }).sort({ quoteRevision: -1 }).select('quoteRevision').lean();
  return latest?.quoteRevision ? latest.quoteRevision + 1 : 1;
}

function listingFeeSnapshot(listing) {
  return professionalFeeSummary(listing);
}

export async function createProviderQuote({
  subject,
  requestRef,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
} = {}) {
  const parsed = allowlistedCreateInput({
    ...body,
    creationCommandId: body.creationCommandId || body.commandId || headerCommandId,
  });
  if (!parsed.ok) throw deny(parsed.error, 400);
  const request = await loadExactProviderRequest(subject, requestRef);
  if (request.status !== S.READY_FOR_QUOTE) throw deny('invalid_status_transition', 409);

  const listing = await GbsServiceListing.findById(request.listingId);
  if (!listing) throw notFound();
  const gate = await evaluateQuoteProfessionalAuthority({
    listing: listing.toObject ? listing.toObject() : listing,
    storedRequest: request,
    env,
  });
  if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);

  await assertNoAcceptedQuote(request._id);
  await normalizeExpiredQuoteForMutation(
    await GbsQuote.findOne({ serviceRequestId: request._id, status: Q.SENT }),
    actor
  );

  const commandId = parsed.value.creationCommandId;
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.QUOTE_CREATE,
    serviceRequestId: String(request._id),
    providerSubjectType: request.providerSubjectType,
    providerSubjectId: String(request.providerSubjectId),
    commandId,
  });
  const store = getMongoIdempotencyStore();
  const capDef = getBusinessServicesCapability(request.capabilityId);
  let recoveredDuplicate = false;

  async function recoverDuplicate(err) {
    const fields = duplicateKeyFields(err);
    if (fields.includes('publicQuoteRef') && !fields.includes('creationCommandId')) throw err;
    const existing = await GbsQuote.findOne({ creationCommandId: commandId });
    if (!existing) throw err;
    if (String(existing.serviceRequestId) !== String(request._id)) {
      throw deny('idempotency_conflict', 409);
    }
    if (String(existing.providerSubjectId) !== String(subject.subjectId)) {
      throw deny('idempotency_conflict', 409);
    }
    return existing;
  }

  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType: GBS_COMMAND_IDS.QUOTE_CREATE,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        let publicQuoteRef = generatePublicQuoteRef();
        for (let i = 0; i < 5; i += 1) {
          const clash = await GbsQuote.findOne({ publicQuoteRef }).select('_id').lean();
          if (!clash) break;
          publicQuoteRef = generatePublicQuoteRef();
        }
        const quoteRevision = await nextRevisionForRequest(request._id);
        try {
          const doc = await GbsQuote.create({
            publicQuoteRef,
            creationCommandId: commandId,
            serviceRequestId: request._id,
            requestPublicRefSnapshot: request.publicRequestRef,
            requesterUserId: request.requesterUserId,
            providerSubjectType: request.providerSubjectType,
            providerSubjectId: String(request.providerSubjectId),
            listingId: request.listingId,
            capabilityId: request.capabilityId,
            jurisdictionId: request.jurisdictionId,
            countryCode: request.countryCode,
            entityTypeId: request.entityTypeId || null,
            quoteRevision,
            status: Q.DRAFT,
            currency: listing.providerFeeLines?.[0]?.currency || null,
            professionalFeeLines: [],
            officialFeeLines: [],
            thirdPartyFeeLines: [],
            includedItemsSnapshot: listing.includedItems || [],
            excludedItemsSnapshot: listing.excludedItems || [],
            listingPricingModeSnapshot: listing.pricingMode,
            listingProfessionalFeeSnapshot: listingFeeSnapshot(listing),
            titleSnapshot: request.titleSnapshot,
            capabilityPublicNameSnapshot: capDef?.publicName || request.capabilityPublicNameSnapshot,
            jurisdictionNameSnapshot: request.jurisdictionNameSnapshot,
            providerDisplayNameSnapshot: request.providerDisplayNameSnapshot,
            providerKindSnapshot: request.providerKindSnapshot,
            actingForSnapshot: request.actingFor,
            existingBusinessNameSnapshot: request.existingBusinessName,
            preferredLanguageSnapshot: request.preferredLanguage,
            customerSummarySnapshot: request.customerSummary,
            providerTurnaroundEstimateSnapshot: listing.providerTurnaroundEstimate,
            turnaroundIsProviderEstimate: true,
            recurringServiceSnapshot: listing.recurringService === true,
            validForDays: GBS_QUOTE_BOUNDS.VALID_FOR_DAYS_DEFAULT,
            recordVersion: 0,
            schemaVersion: GBS_QUOTE_SCHEMA_VERSION,
          });
          return { quoteId: String(doc._id), publicQuoteRef: doc.publicQuoteRef };
        } catch (err) {
          if (!isMongoDuplicateKey(err)) throw err;
          const existing = await recoverDuplicate(err);
          recoveredDuplicate = true;
          return { quoteId: String(existing._id), publicQuoteRef: existing.publicQuoteRef };
        }
      },
    });

    if (result.replay || recoveredDuplicate) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.IDEMPOTENCY_REPLAY,
        metadata: redactAuditMetadata({ commandId }),
      });
    }

    const quote = result.result?.quoteId
      ? await GbsQuote.findById(result.result.quoteId)
      : await GbsQuote.findOne({ creationCommandId: commandId });
    if (!quote) throw deny('quote_create_failed', 500);

    if (!result.replay && !recoveredDuplicate) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_QUOTE_CREATED,
        targetType: 'GbsQuote',
        targetId: String(quote._id),
        metadata: quoteAuditMeta(quote),
      });
    }

    const displayName = await safeCustomerName(quote.requesterUserId);
    return providerQuoteProjection(quote, { displayName });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT || err.code === 'idempotency_conflict') {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.IDEMPOTENCY_CONFLICT,
        status: 'failure',
        metadata: redactAuditMetadata({ commandId }),
      });
      throw deny('idempotency_conflict', 409);
    }
    if (isMongoDuplicateKey(err) && /serviceRequestId/.test(err.message || '')) {
      throw deny('active_quote_exists', 409);
    }
    throw err;
  }
}

export async function updateProviderQuoteDraft({
  subject,
  quoteRef,
  body = {},
  expectedVersion,
  actor = {},
} = {}) {
  const parsed = allowlistedDraftUpdate(body);
  if (!parsed.ok) throw deny(parsed.error, 400, parsed.errors);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  let quote = await loadExactProviderQuote(subject, quoteRef);
  quote = await normalizeExpiredQuoteForMutation(quote, actor);
  if (quote.status !== Q.DRAFT) throw deny('quote_revision_immutable', 409);

  const listing = await GbsServiceListing.findById(quote.listingId).lean();
  const next = { ...quote.toObject() };
  if (parsed.value.professionalFeeLines) {
    next.professionalFeeLines = parsed.value.professionalFeeLines;
    next.currency = parsed.value.currency;
  }
  if (parsed.value.officialFeeIds) {
    next.officialFeeLines = snapshotOfficialFeeIds(listing || {}, parsed.value.officialFeeIds);
  }
  if (parsed.value.providerTerms !== undefined) next.providerTerms = parsed.value.providerTerms;
  if (parsed.value.validForDays !== undefined) next.validForDays = parsed.value.validForDays;
  if (parsed.value.includedItems) next.includedItemsSnapshot = parsed.value.includedItems;
  if (parsed.value.excludedItems) next.excludedItemsSnapshot = parsed.value.excludedItems;
  if (parsed.value.providerTurnaroundEstimate !== undefined) {
    if (
      parsed.value.providerTurnaroundEstimate != null
      && (!Number.isInteger(parsed.value.providerTurnaroundEstimate) || parsed.value.providerTurnaroundEstimate < 0)
    ) {
      throw deny('invalid_turnaround', 400);
    }
    next.providerTurnaroundEstimateSnapshot = parsed.value.providerTurnaroundEstimate;
  }
  const totals = applyTotals(next);

  const updated = await mutateGbsQuoteRecord({
    id: quote._id,
    expectedVersion: expected,
    ownershipFilter: subjectFilter(subject),
    extraFilter: { status: Q.DRAFT },
    set: {
      professionalFeeLines: next.professionalFeeLines,
      officialFeeLines: next.officialFeeLines,
      thirdPartyFeeLines: [],
      currency: next.currency,
      providerTerms: next.providerTerms,
      validForDays: next.validForDays,
      includedItemsSnapshot: next.includedItemsSnapshot,
      excludedItemsSnapshot: next.excludedItemsSnapshot,
      providerTurnaroundEstimateSnapshot: next.providerTurnaroundEstimateSnapshot,
      ...totals,
    },
    actor,
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_QUOTE_UPDATED,
    targetType: 'GbsQuote',
    targetId: String(updated._id),
    metadata: quoteAuditMeta(updated),
  });
  const displayName = await safeCustomerName(updated.requesterUserId);
  return providerQuoteProjection(updated, { displayName });
}

function commandKey(body, header, fallback) {
  return body?.commandId || body?.creationCommandId || header || fallback;
}

export async function sendProviderQuote({
  subject,
  quoteRef,
  body = {},
  headerCommandId,
  expectedVersion,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const parsed = allowlistedSendInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  let quote = await loadExactProviderQuote(subject, quoteRef);
  quote = await normalizeExpiredQuoteForMutation(quote, actor, now);
  if (quote.status === Q.SENT && quote.recordVersion === expected) {
    const displayName = await safeCustomerName(quote.requesterUserId);
    return providerQuoteProjection(quote, { displayName });
  }
  if (quote.status !== Q.DRAFT) throw deny('invalid_status_transition', 409);

  const request = await GbsServiceRequest.findById(quote.serviceRequestId);
  if (!request || request.status !== S.READY_FOR_QUOTE) throw deny('invalid_status_transition', 409);
  const listing = await GbsServiceListing.findById(quote.listingId);
  if (!listing) throw notFound();
  const gate = await evaluateQuoteProfessionalAuthority({
    listing: listing.toObject ? listing.toObject() : listing,
    storedRequest: request,
    env,
    now,
  });
  if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);

  const validForDays = parsed.value.validForDays ?? quote.validForDays ?? GBS_QUOTE_BOUNDS.VALID_FOR_DAYS_DEFAULT;
  const days = normalizeValidForDays(validForDays);
  if (days == null) throw deny('invalid_valid_for_days', 400);
  const officialFeeLines = snapshotOfficialFeeIds(
    listing.toObject ? listing.toObject() : listing,
    (quote.officialFeeLines || []).map((l) => l.feeId),
    now
  );
  const professionalFeeLines = quote.professionalFeeLines || [];
  if (!professionalFeeLines.length) throw deny('professional_fees_required', 400);
  const totals = applyTotals({
    currency: quote.currency,
    professionalFeeLines,
    officialFeeLines,
  });
  const honesty = assertListingPriceHonesty(
    listing.toObject ? listing.toObject() : listing,
    totals.subtotalProfessionalMinor,
    quote.currency
  );
  if (!honesty.ok) throw deny(honesty.error, 400);
  if (Array.isArray(quote.thirdPartyFeeLines) && quote.thirdPartyFeeLines.length) {
    throw deny('third_party_fees_not_allowed', 400);
  }

  const sentAt = now;
  const expiresAt = computeExpiresAt(sentAt, days);
  const commandId = commandKey(body, headerCommandId, `${quote.publicQuoteRef}:send:${expected}`);
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.QUOTE_SEND,
    publicQuoteRef: quote.publicQuoteRef,
    expectedVersion: expected,
    validForDays: days,
    subtotalProfessionalMinor: totals.subtotalProfessionalMinor,
  });
  const store = getMongoIdempotencyStore();
  let performed = false;
  let result;
  try {
    result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType: GBS_COMMAND_IDS.QUOTE_SEND,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        const freshRequest = await GbsServiceRequest.findById(quote.serviceRequestId).select('status').lean();
        if (!freshRequest || freshRequest.status !== S.READY_FOR_QUOTE) {
          throw deny('invalid_status_transition', 409);
        }
        const updatedRow = await mutateGbsQuoteRecord({
          id: quote._id,
          expectedVersion: expected,
          ownershipFilter: subjectFilter(subject),
          extraFilter: { status: Q.DRAFT },
          set: {
            status: Q.SENT,
            sentAt,
            expiresAt,
            validForDays: days,
            officialFeeLines,
            thirdPartyFeeLines: [],
            ...totals,
          },
          actor,
        });
        const after = await GbsServiceRequest.findById(quote.serviceRequestId).select('status').lean();
        if (!after || after.status !== S.READY_FOR_QUOTE) {
          await GbsQuote.findOneAndUpdate(
            { _id: updatedRow._id, status: Q.SENT },
            { $set: { status: Q.WITHDRAWN, withdrawnAt: new Date() }, $inc: { recordVersion: 1 } }
          );
          throw deny('invalid_status_transition', 409);
        }
        performed = true;
        return { quoteId: String(updatedRow._id), recordVersion: updatedRow.recordVersion };
      },
    });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
  const updated = await GbsQuote.findById(result.result?.quoteId || quote._id);
  if (performed && !result.replay) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_QUOTE_SENT,
      targetType: 'GbsQuote',
      targetId: String(updated._id),
      metadata: quoteAuditMeta(updated, { fromStatus: Q.DRAFT, toStatus: Q.SENT }),
    });
    await notifyCustomer(updated, {
      type: 'gbs_quote_sent',
      title: 'You received a new service quote',
      body: 'A Business Services provider sent you a quote. Sign in to review the terms. No payment is taken yet.',
      status: updated.status,
    });
  }
  const displayName = await safeCustomerName(updated.requesterUserId);
  return providerQuoteProjection(updated, { displayName });
}

export async function withdrawProviderQuote({
  subject,
  quoteRef,
  body = {},
  headerCommandId,
  expectedVersion,
  actor = {},
  now = new Date(),
} = {}) {
  const parsed = allowlistedActionInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  let quote = await loadExactProviderQuote(subject, quoteRef);
  quote = await normalizeExpiredQuoteForMutation(quote, actor, now);
  if (quote.status === Q.WITHDRAWN && quote.recordVersion === expected) {
    const displayName = await safeCustomerName(quote.requesterUserId);
    return providerQuoteProjection(quote, { displayName });
  }
  if (quote.status !== Q.DRAFT && quote.status !== Q.SENT) throw deny('invalid_status_transition', 409);
  if (quote.status === Q.SENT && quoteIsEffectivelyExpired(quote, now)) throw deny('quote_expired', 409);

  const extraFilter = quote.status === Q.SENT
    ? { status: Q.SENT, expiresAt: { $gt: now } }
    : { status: Q.DRAFT };
  const wasSent = quote.status === Q.SENT;
  const commandId = commandKey(body, headerCommandId, `${quote.publicQuoteRef}:withdraw:${expected}`);
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.QUOTE_WITHDRAW,
    publicQuoteRef: quote.publicQuoteRef,
    expectedVersion: expected,
  });
  const store = getMongoIdempotencyStore();
  let performed = false;
  let result;
  try {
    result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor.agentAccountId || subject.subjectId),
      tenantId: `${subject.subjectType}:${subject.subjectId}`,
      commandType: GBS_COMMAND_IDS.QUOTE_WITHDRAW,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        const updatedRow = await mutateGbsQuoteRecord({
          id: quote._id,
          expectedVersion: expected,
          ownershipFilter: subjectFilter(subject),
          extraFilter,
          set: { status: Q.WITHDRAWN, withdrawnAt: now },
          actor,
        });
        performed = true;
        return { quoteId: String(updatedRow._id) };
      },
    });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
  const updated = await GbsQuote.findById(result.result?.quoteId || quote._id);
  if (performed && !result.replay) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_QUOTE_WITHDRAWN,
      targetType: 'GbsQuote',
      targetId: String(updated._id),
      metadata: quoteAuditMeta(updated, { fromStatus: wasSent ? Q.SENT : Q.DRAFT, toStatus: Q.WITHDRAWN }),
    });
    if (wasSent) {
      await notifyCustomer(updated, {
        type: 'gbs_quote_withdrawn',
        title: 'A service quote was withdrawn',
        body: 'The provider withdrew a Business Services quote. Sign in to view the status.',
        status: updated.status,
      });
    }
  }
  const displayName = await safeCustomerName(updated.requesterUserId);
  return providerQuoteProjection(updated, { displayName });
}

async function customerDecision({
  userId,
  quoteRef,
  expectedVersion,
  actor,
  commandType,
  commandId,
  fingerprintParts,
  nextStatus,
  extraSet,
  auditAction,
  notify,
  env,
  now,
  requireAuthority,
}) {
  await requireActiveBusinessClient(userId);
  const expected = parseExpectedVersion(expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  let quote = await loadOwnedCustomerQuote(userId, quoteRef);
  quote = await normalizeExpiredQuoteForMutation(quote, actor, now);
  if (quote.status === nextStatus && quote.recordVersion === expected) {
    return customerQuoteProjection(quote, await customerExtras(quote));
  }
  if (quote.status !== Q.SENT) throw deny('invalid_status_transition', 409);
  if (quoteIsEffectivelyExpired(quote, now) || (quote.expiresAt && quote.expiresAt.getTime() <= now.getTime())) {
    throw deny('quote_expired', 409);
  }

  const request = await GbsServiceRequest.findById(quote.serviceRequestId);
  if (!request || request.status === S.CANCELLED || request.status === S.DECLINED) {
    throw deny('invalid_status_transition', 409);
  }
  if (request.status !== S.READY_FOR_QUOTE) throw deny('invalid_status_transition', 409);
  if (requireAuthority) {
    const listing = await GbsServiceListing.findById(quote.listingId).lean();
    const gate = await evaluateQuoteProfessionalAuthority({
      listing,
      storedRequest: request,
      env,
      now,
    });
    if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);
  }

  const store = getMongoIdempotencyStore();
  let performed = false;
  let result;
  try {
    result = await executeHighValueIdempotentCommand(store, {
      principalId: String(userId),
      tenantId: `user:${userId}`,
      commandType,
      idempotencyKey: commandId,
      fingerprint: fingerprintRequest(fingerprintParts),
      perform: async () => {
        const freshRequest = await GbsServiceRequest.findById(quote.serviceRequestId).select('status').lean();
        if (!freshRequest || freshRequest.status !== S.READY_FOR_QUOTE) {
          throw deny('invalid_status_transition', 409);
        }
        const updatedRow = await mutateGbsQuoteRecord({
          id: quote._id,
          expectedVersion: expected,
          ownershipFilter: { requesterUserId: userId },
          extraFilter: { status: Q.SENT, expiresAt: { $gt: now } },
          set: { status: nextStatus, ...extraSet },
          actor,
        });
        performed = true;
        return { quoteId: String(updatedRow._id) };
      },
    });
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) throw deny('idempotency_conflict', 409);
    throw err;
  }
  const updated = await GbsQuote.findById(result.result?.quoteId || quote._id);
  if (performed && !result.replay) {
    await logAudit({
      actor,
      action: auditAction,
      targetType: 'GbsQuote',
      targetId: String(updated._id),
      metadata: quoteAuditMeta(updated, {
        fromStatus: Q.SENT,
        toStatus: nextStatus,
        reasonCode: extraSet.declineReasonCode,
      }),
    });
    if (notify) await notify(updated);
  }
  return customerQuoteProjection(updated, await customerExtras(updated), now);
}

async function publicCaseRefForQuote(quoteId) {
  if (!quoteId) return undefined;
  const gbsCase = await GbsCase.findOne({ quoteId }).select('publicCaseRef').lean();
  return gbsCase?.publicCaseRef;
}

async function customerExtras(record) {
  const capDef = getBusinessServicesCapability(record.capabilityId);
  return {
    providerDisplayName: record.providerDisplayNameSnapshot,
    providerKind: record.providerKindSnapshot,
    verificationBadge: verificationBadge(
      { capabilityId: record.capabilityId },
      capDef,
      record.jurisdictionNameSnapshot
    ),
    publicCaseRef: record.status === Q.ACCEPTED ? await publicCaseRefForQuote(record._id) : undefined,
  };
}

export async function acceptCustomerQuote({
  userId,
  quoteRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const parsed = allowlistedActionInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const expected = expectedVersion ?? body.expectedVersion;
  const commandId = commandKey(body, headerCommandId, `${quoteRef}:accept:${parseExpectedVersion(expected)}`);
  const item = await customerDecision({
    userId,
    quoteRef,
    expectedVersion: expected,
    actor,
    commandType: GBS_COMMAND_IDS.QUOTE_ACCEPT,
    commandId,
    fingerprintParts: { command: GBS_COMMAND_IDS.QUOTE_ACCEPT, quoteRef, expectedVersion: parseExpectedVersion(expected) },
    nextStatus: Q.ACCEPTED,
    extraSet: { acceptedAt: now },
    auditAction: GBS_AUDIT_EVENTS.GBS_QUOTE_ACCEPTED,
    requireAuthority: true,
    env,
    now,
    notify: async (updated) => {
      await notifyProviders(updated, {
        type: 'gbs_quote_accepted',
        title: 'A customer accepted a quote',
        body: 'A Business Services customer accepted a quote. No payment was taken.',
      });
    },
  });
  const accepted = await GbsQuote.findOne({ publicQuoteRef: quoteRef, requesterUserId: userId });
  if (accepted?.status === Q.ACCEPTED) {
    const { ensureGbsCaseForAcceptedQuote } = await import('./gbsCaseService.js');
    const gbsCase = await ensureGbsCaseForAcceptedQuote({
      quote: accepted,
      actor,
      env,
      now,
    });
    return { ...item, publicCaseRef: gbsCase.publicCaseRef };
  }
  return item;
}

export async function declineCustomerQuote({
  userId,
  quoteRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  now = new Date(),
} = {}) {
  const parsed = allowlistedDeclineInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const expected = expectedVersion ?? body.expectedVersion;
  const commandId = commandKey(body, headerCommandId, `${quoteRef}:decline:${parseExpectedVersion(expected)}`);
  return customerDecision({
    userId,
    quoteRef,
    expectedVersion: expected,
    actor,
    commandType: GBS_COMMAND_IDS.QUOTE_DECLINE,
    commandId,
    fingerprintParts: {
      command: GBS_COMMAND_IDS.QUOTE_DECLINE,
      quoteRef,
      expectedVersion: parseExpectedVersion(expected),
      declineReasonCode: parsed.value.declineReasonCode,
    },
    nextStatus: Q.DECLINED,
    extraSet: {
      declinedAt: now,
      declineReasonCode: parsed.value.declineReasonCode,
      declineNote: parsed.value.declineNote || null,
    },
    auditAction: GBS_AUDIT_EVENTS.GBS_QUOTE_DECLINED,
    requireAuthority: false,
    now,
    notify: async (updated) => {
      await notifyProviders(updated, {
        type: 'gbs_quote_declined',
        title: 'A customer declined a quote',
        body: 'A Business Services customer declined a quote.',
      });
    },
  });
}

export async function listCustomerQuotes({ userId, query } = {}) {
  const { page, limit, status, capabilityId, currency } = parseQuoteListQuery(query);
  const filter = { requesterUserId: userId };
  if (status) filter.status = status;
  if (capabilityId) filter.capabilityId = capabilityId;
  if (currency) filter.currency = currency;
  const [total, items] = await Promise.all([
    GbsQuote.countDocuments(filter),
    GbsQuote.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return {
    items: items.map((row) => customerQuoteListItem(row, {
      providerDisplayName: row.providerDisplayNameSnapshot,
      providerKind: row.providerKindSnapshot,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getCustomerQuote({ userId, quoteRef, now = new Date() } = {}) {
  const record = await loadOwnedCustomerQuote(userId, quoteRef);
  return customerQuoteProjection(record, await customerExtras(record), now);
}

export async function listProviderQuotes({ subject, query } = {}) {
  const { page, limit, status, capabilityId, currency } = parseQuoteListQuery(query);
  const filter = subjectFilter(subject);
  if (status) filter.status = status;
  if (capabilityId) filter.capabilityId = capabilityId;
  if (currency) filter.currency = currency;
  const [total, items] = await Promise.all([
    GbsQuote.countDocuments(filter),
    GbsQuote.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  const names = new Map();
  for (const row of items) {
    if (!names.has(String(row.requesterUserId))) {
      names.set(String(row.requesterUserId), await safeCustomerName(row.requesterUserId));
    }
  }
  return {
    items: items.map((row) => providerQuoteListItem(row, { displayName: names.get(String(row.requesterUserId)) })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProviderQuote({ subject, quoteRef, now = new Date() } = {}) {
  const record = await loadExactProviderQuote(subject, quoteRef);
  const displayName = await safeCustomerName(record.requesterUserId);
  const listing = await GbsServiceListing.findById(record.listingId).lean();
  return {
    ...providerQuoteProjection(record, {
      displayName,
      publicCaseRef: record.status === Q.ACCEPTED ? await publicCaseRefForQuote(record._id) : undefined,
    }, now),
    availableOfficialFees: listing ? catalogOfficialFeesForListing(listing, now) : [],
  };
}

export async function quotesBlockingRequestCancel(serviceRequestId) {
  await normalizeExpiredQuoteForMutation(
    await GbsQuote.findOne({ serviceRequestId, status: Q.SENT }),
    {}
  );
  const accepted = await GbsQuote.findOne({ serviceRequestId, status: Q.ACCEPTED }).select('_id').lean();
  if (accepted) return { blocked: true, code: 'quote_already_accepted' };
  const sent = await GbsQuote.findOne({ serviceRequestId, status: Q.SENT }).select('_id').lean();
  if (sent) return { blocked: true, code: 'quote_decision_required' };
  return { blocked: false };
}

export async function closeDraftsForCancelledRequest(serviceRequestId, actor = {}, now = new Date()) {
  const drafts = await GbsQuote.find({ serviceRequestId, status: Q.DRAFT });
  for (const draft of drafts) {
    await GbsQuote.findOneAndUpdate(
      { _id: draft._id, status: Q.DRAFT },
      { $set: { status: Q.WITHDRAWN, withdrawnAt: now }, $inc: { recordVersion: 1 } }
    );
  }
  const straySent = await GbsQuote.find({ serviceRequestId, status: Q.SENT });
  for (const sent of straySent) {
    await GbsQuote.findOneAndUpdate(
      { _id: sent._id, status: Q.SENT },
      { $set: { status: Q.WITHDRAWN, withdrawnAt: now }, $inc: { recordVersion: 1 } }
    );
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_QUOTE_WITHDRAWN,
      targetType: 'GbsQuote',
      targetId: String(sent._id),
      metadata: quoteAuditMeta(sent, { fromStatus: Q.SENT, toStatus: Q.WITHDRAWN, reasonCode: 'request_cancelled' }),
    });
  }
}

export function catalogOfficialFeesForListing(listing, now = new Date()) {
  return catalogFeesForListing(listing, now).map((fee) => ({
    feeId: fee.feeId,
    label: fee.label,
    currency: fee.currency,
    amount: fee.amount,
    amountModel: fee.amountModel,
    eligibleCurrent: fee.eligibleCurrent,
  }));
}
