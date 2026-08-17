/**
 * Private GBS Service Listing service (Phase 17D-3).
 * Create/update/submit require explicit VERIFIED capability (17D-B §5.9).
 * Approved ≠ public. Public publication remains OFF.
 */
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import {
  GBS_COMMAND_IDS,
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PROVIDER_BOUNDS,
} from '../../../../shared/gbs/constants.js';
import { authorizeGbsProviderAction, GBS_AUTHORITY_DENY_REASONS } from '../../../../shared/gbs/gbsProviderAuthority.js';
import {
  isMaterialListingChange,
  validateServiceListingRecord,
} from '../../../../shared/gbs/serviceListing.js';
import { classifyGbsListingRisk } from '../../../../shared/gbs/claimRiskClassifier.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsServiceListingRecord } from '../platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { IDEMPOTENCY_CODES } from '../../../../shared/platform/idempotency.js';
import { AGENT_SERVICE_CATEGORIES } from '../../../../shared/agent/constants.js';

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

function listingToRequested(value) {
  return {
    subjectType: value.subjectType,
    subjectId: value.subjectId,
    capabilityId: value.capabilityId,
    scope: value.scope,
  };
}

async function loadVerifiedCapability({ subjectType, subjectId, capabilityId }) {
  if (!capabilityId) throw deny('gbs_capability_id_missing', 400);
  if (Object.values(AGENT_SERVICE_CATEGORIES).includes(capabilityId)) {
    throw deny('gbs_listing_rejects_education_category', 400);
  }
  return ProviderCapability.findOne({
    subjectType,
    subjectId: String(subjectId),
    capabilityId,
  }).lean();
}

async function assertListingAuthority(value, actor) {
  const capability = await loadVerifiedCapability(value);
  const decision = authorizeGbsProviderAction({
    requested: listingToRequested(value),
    capability,
  });
  if (!decision.allowed) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_LISTING_SCOPE_DENIED,
      status: 'failure',
      metadata: redactAuditMetadata({
        reason: decision.reason,
        subjectType: value.subjectType,
        capabilityId: value.capabilityId,
      }),
    });
    throw deny(decision.reason || GBS_AUTHORITY_DENY_REASONS.SCOPE_NOT_SUBSET, 403);
  }
  return capability;
}

export function publicListingProjection(record) {
  if (!record) return null;
  return {
    id: String(record._id || record.id),
    publicSlug: record.publicSlug || '',
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    capabilityId: record.capabilityId,
    countryCode: record.countryCode,
    jurisdictionId: record.jurisdictionId,
    entityTypeIds: record.entityTypeIds,
    title: record.title,
    shortDescription: record.shortDescription,
    description: record.description,
    includedItems: record.includedItems,
    excludedItems: record.excludedItems,
    deliveryMode: record.deliveryMode,
    languages: record.languages,
    pricingMode: record.pricingMode,
    providerFeeLines: record.providerFeeLines,
    providerTurnaroundEstimate: record.providerTurnaroundEstimate,
    turnaroundUnit: record.turnaroundUnit,
    turnaroundIsProviderEstimate: true,
    consultationAvailable: record.consultationAvailable,
    recurringService: record.recurringService,
    moderationStatus: record.moderationStatus,
    publicationStatus: record.publicationStatus,
    adminReviewStatus: record.adminReviewStatus || GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
    riskFlags: record.riskFlags || [],
    contentRevision: record.contentRevision,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function createServiceListingDraft({ input, actor, commandId } = {}) {
  const parsed = validateServiceListingRecord({
    ...input,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.DRAFT,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
    creationCommandId: commandId,
    reviewedBy: undefined,
    reviewedAt: undefined,
    reviewReason: undefined,
    trustStatus: undefined,
  });
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.errors[0] || 'invalid_listing'), {
      status: 400,
      code: 'invalid_listing',
      errors: parsed.errors,
    });
  }
  await assertListingAuthority(parsed.value, actor);
  const risk = classifyGbsListingRisk(parsed.value);

  const store = getMongoIdempotencyStore();
  const fingerprint = fingerprintRequest({
    command: GBS_COMMAND_IDS.LISTING_CREATE,
    subjectType: parsed.value.subjectType,
    subjectId: parsed.value.subjectId,
    capabilityId: parsed.value.capabilityId,
    jurisdictionId: parsed.value.jurisdictionId,
    title: parsed.value.title,
    commandId,
  });

  try {
    const result = await executeHighValueIdempotentCommand(store, {
      principalId: String(actor?.agentAccountId || actor?.id || ''),
      tenantId: `${parsed.value.subjectType}:${parsed.value.subjectId}`,
      commandType: GBS_COMMAND_IDS.LISTING_CREATE,
      idempotencyKey: commandId,
      fingerprint,
      perform: async () => {
        const doc = await GbsServiceListing.create({
          ...parsed.value,
          riskFlags: risk.codes,
          creationCommandId: commandId,
          publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
          adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
          reviewedBy: null,
          reviewedAt: null,
          reviewReason: '',
        });
        return { listingId: String(doc._id) };
      },
    });

    if (result.replay) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_LISTING_IDEMPOTENCY_REPLAY,
        metadata: redactAuditMetadata({ commandId }),
      });
    }

    const listingId = result.result?.listingId || result.result?.value?.listingId;
    let listing = listingId ? await GbsServiceListing.findById(listingId) : null;
    if (!listing) {
      listing = await GbsServiceListing.findOne({ creationCommandId: commandId });
    }
    if (!listing) throw deny('listing_create_failed', 500);
    if (risk.flagged) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_LISTING_RISK_FLAGGED,
        targetId: String(listing._id),
        metadata: redactAuditMetadata({ codes: risk.codes }),
      });
    }
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_LISTING_DRAFT_CREATED,
      targetType: 'GbsServiceListing',
      targetId: String(listing._id),
      metadata: redactAuditMetadata({
        subjectType: listing.subjectType,
        capabilityId: listing.capabilityId,
      }),
    });
    return { listing, replay: Boolean(result.replay), risk };
  } catch (err) {
    if (err.code === IDEMPOTENCY_CODES.CONFLICT) {
      await logAudit({
        actor,
        action: GBS_AUDIT_EVENTS.GBS_LISTING_IDEMPOTENCY_CONFLICT,
        status: 'failure',
        metadata: redactAuditMetadata({ commandId }),
      });
      throw Object.assign(new Error('idempotency_conflict'), {
        status: 409,
        code: 'idempotency_conflict',
      });
    }
    if (err?.code === 11000) {
      const existing = await GbsServiceListing.findOne({ creationCommandId: commandId });
      if (existing) {
        await logAudit({
          actor,
          action: GBS_AUDIT_EVENTS.GBS_LISTING_IDEMPOTENCY_REPLAY,
          metadata: redactAuditMetadata({ commandId, domainUnique: true }),
        });
        return { listing: existing, replay: true, risk };
      }
    }
    throw err;
  }
}

export async function updateServiceListing({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  input,
  actor,
} = {}) {
  const current = await GbsServiceListing.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  }).lean();
  if (!current) throw deny('listing_not_found', 404);
  if (current.moderationStatus === GBS_LISTING_MODERATION_STATUSES.ARCHIVED) {
    throw deny('listing_archived', 403);
  }

  const parsed = validateServiceListingRecord({
    ...current,
    ...input,
    subjectType,
    subjectId,
    moderationStatus: current.moderationStatus,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    creationCommandId: current.creationCommandId,
  });
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.errors[0] || 'invalid_listing'), {
      status: 400,
      code: 'invalid_listing',
      errors: parsed.errors,
    });
  }
  await assertListingAuthority(parsed.value, actor);
  const risk = classifyGbsListingRisk(parsed.value);
  const material = isMaterialListingChange(current, parsed.value);
  const wasApproved = current.moderationStatus === GBS_LISTING_MODERATION_STATUSES.APPROVED;
  const nextModeration =
    wasApproved && material
      ? GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW
      : current.moderationStatus === GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW && material
        ? GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW
        : current.moderationStatus;
  const resetAdminReview = Boolean(wasApproved && material);

  const updated = await mutateGbsServiceListingRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    actor,
    set: {
      ...parsed.value,
      moderationStatus: nextModeration,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
      riskFlags: risk.codes,
      contentRevision: material ? (current.contentRevision || 1) + 1 : current.contentRevision,
      ...(resetAdminReview
        ? {
            adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
            reviewedBy: null,
            reviewedAt: null,
            reviewReason: '',
          }
        : {}),
    },
  });

  await logAudit({
    actor,
    action: material ? GBS_AUDIT_EVENTS.GBS_LISTING_MATERIAL_CHANGE : GBS_AUDIT_EVENTS.GBS_LISTING_UPDATED,
    targetType: 'GbsServiceListing',
    targetId: String(id),
    metadata: redactAuditMetadata({
      material,
      reReview: wasApproved && material,
      capabilityId: parsed.value.capabilityId,
    }),
  });
  if (risk.flagged) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_LISTING_RISK_FLAGGED,
      targetId: String(id),
      metadata: redactAuditMetadata({ codes: risk.codes }),
    });
  }
  return updated;
}

export async function submitServiceListingForReview({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  actor,
} = {}) {
  const current = await GbsServiceListing.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  }).lean();
  if (!current) throw deny('listing_not_found', 404);
  const parsed = validateServiceListingRecord(current);
  if (!parsed.ok) {
    throw Object.assign(new Error('listing_incomplete'), {
      status: 400,
      code: 'listing_needs_information',
      errors: parsed.errors,
    });
  }
  await assertListingAuthority(parsed.value, actor);
  const risk = classifyGbsListingRisk(parsed.value);
  const nextStatus = GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW;
  const updated = await mutateGbsServiceListingRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    actor,
    set: {
      moderationStatus: nextStatus,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
      adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: '',
      riskFlags: risk.codes,
    },
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_LISTING_SUBMITTED_REVIEW,
    targetType: 'GbsServiceListing',
    targetId: String(id),
    metadata: redactAuditMetadata({
      capabilityId: current.capabilityId,
      riskFlagged: risk.flagged,
    }),
  });
  return updated;
}

export async function archiveServiceListing({ id, subjectType, subjectId, expectedVersion, actor } = {}) {
  const current = await GbsServiceListing.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  }).lean();
  if (!current) throw deny('listing_not_found', 404);
  const archivable = new Set([
    GBS_LISTING_MODERATION_STATUSES.DRAFT,
    GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
    GBS_LISTING_MODERATION_STATUSES.REJECTED,
  ]);
  if (!archivable.has(current.moderationStatus)) {
    throw deny('listing_archive_not_allowed', 403);
  }
  const updated = await mutateGbsServiceListingRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    actor,
    set: {
      moderationStatus: GBS_LISTING_MODERATION_STATUSES.ARCHIVED,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    },
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_LISTING_ARCHIVED,
    targetType: 'GbsServiceListing',
    targetId: String(id),
  });
  return updated;
}

export async function getSubjectListing({ id, subjectType, subjectId } = {}) {
  const record = await GbsServiceListing.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  }).lean();
  if (!record) throw deny('listing_not_found', 404);
  return record;
}

export async function listSubjectListings({
  subjectType,
  subjectId,
  page = 1,
  limit = 20,
  moderationStatus,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), GBS_PROVIDER_BOUNDS.LIST_PAGE_MAX);
  const safePage = Math.max(Number(page) || 1, 1);
  const filter = { subjectType, subjectId: String(subjectId) };
  if (moderationStatus) {
    if (!Object.values(GBS_LISTING_MODERATION_STATUSES).includes(moderationStatus)) {
      throw deny('invalid_filter', 400);
    }
    filter.moderationStatus = moderationStatus;
  }
  const [items, total] = await Promise.all([
    GbsServiceListing.find(filter)
      .sort({ updatedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    GbsServiceListing.countDocuments(filter),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
}
