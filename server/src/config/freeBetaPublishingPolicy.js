/**
 * Canonical server-side contract for the first six months of Free Beta.
 *
 * Runtime publication flows are intentionally not wired in H2A. Future
 * controllers/services must import these values instead of copying limits.
 */

/**
 * @typedef {'employer'|'organization'} PublishingQuotaOwnerType
 * @typedef {'draft'|'pending_review'|'active'|'rejected'|'closed'|'expired'} JobPublicationState
 * @typedef {'initial'|'correction'|'major_edit'|'renewal'|'repost'} PublicationSubmissionKind
 * @typedef {'pending_review'|'approved'|'rejected'|'withdrawn'|'expired'|'superseded'} PublicationSubmissionState
 * @typedef {'reviewer_requested_correction'|'legacy_migration_non_chargeable'} QuotaExemptionReason
 * @typedef {{ownerType: PublishingQuotaOwnerType, ownerId: import('mongoose').Types.ObjectId, guardId: string}} PublishingQuotaOwner
 */

export const PUBLISHING_POLICY_CODES = Object.freeze({
  FREE_BETA: 'free_beta',
});

export const FREE_BETA_POLICY_VERSION = 'free-beta-2026-01';

export const QUOTA_OWNER_TYPES = Object.freeze(['employer', 'organization']);
export const BETA_QUOTA_OWNER_TYPE = 'employer';

export const JOB_PUBLICATION_STATE = Object.freeze({
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  CLOSED: 'closed',
  EXPIRED: 'expired',
});

export const JOB_PUBLICATION_STATES = Object.freeze(
  Object.values(JOB_PUBLICATION_STATE)
);

export const PUBLICATION_SUBMISSION_KINDS = Object.freeze([
  'initial',
  'correction',
  'major_edit',
  'renewal',
  'repost',
]);

export const PUBLICATION_SUBMISSION_STATES = Object.freeze([
  'pending_review',
  'approved',
  'rejected',
  'withdrawn',
  'expired',
  'superseded',
]);

export const QUOTA_EXEMPTION_REASONS = Object.freeze([
  'reviewer_requested_correction',
  'legacy_migration_non_chargeable',
]);

export const PUBLISHING_QUOTA_RESULT_CODES = Object.freeze({
  ROLLING_24H_LIMIT: 'ROLLING_24H_LIMIT',
  ROLLING_30D_LIMIT: 'ROLLING_30D_LIMIT',
  ACTIVE_LIMIT_REACHED_AT_APPROVAL: 'ACTIVE_LIMIT_REACHED_AT_APPROVAL',
});

export const FREE_BETA_ACTIVE_SLOT_TRANSITIONS = Object.freeze({
  initial_submission: Object.freeze({
    slotsReleased: 0,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  reviewer_correction: Object.freeze({
    slotsReleased: 0,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  charged_correction: Object.freeze({
    slotsReleased: 0,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  renewal: Object.freeze({
    slotsReleased: 0,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  repost: Object.freeze({
    slotsReleased: 0,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  active_major_edit_submission: Object.freeze({
    slotsReleased: 1,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  approval: Object.freeze({
    slotsReleased: 0,
    slotsAcquired: 1,
    enforceCapacity: true,
  }),
  close_active: Object.freeze({
    slotsReleased: 1,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
  expire_active: Object.freeze({
    slotsReleased: 1,
    slotsAcquired: 0,
    enforceCapacity: false,
  }),
});

export const FREE_BETA_PUBLISHING_POLICY = Object.freeze({
  code: PUBLISHING_POLICY_CODES.FREE_BETA,
  version: FREE_BETA_POLICY_VERSION,
  quotaOwnerType: BETA_QUOTA_OWNER_TYPE,
  drafts: Object.freeze({
    private: true,
    unlimited: true,
    consumesQuota: false,
    requiresPayment: false,
  }),
  chargedSubmissions: Object.freeze({
    rolling24Hours: Object.freeze({
      limit: 1,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    rolling30Days: Object.freeze({
      limit: 10,
      windowMs: 30 * 24 * 60 * 60 * 1000,
    }),
  }),
  maximumActiveFreeJobs: 5,
  activeFreeJobCapacity: Object.freeze({
    enforcedAt: 'approval',
    pendingReviewReservesSlot: false,
  }),
  listing: Object.freeze({
    visibilityDays: 30,
    visibilityMs: 30 * 24 * 60 * 60 * 1000,
  }),
  paidPublishingEnabled: false,
  paidJobsConsumeFreeActiveCapacity: false,
  employerVerificationRequired: true,
  moderationRequired: true,
});

function domainTypeError(code, message) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

/**
 * Build a namespace-safe serialization key.
 *
 * @param {string} ownerType
 * @param {string|{toString(): string}} ownerId
 * @returns {string}
 */
export function buildPublishingQuotaGuardId(ownerType, ownerId) {
  if (!QUOTA_OWNER_TYPES.includes(ownerType)) {
    throw domainTypeError(
      'INVALID_QUOTA_OWNER_TYPE',
      'Unsupported publishing quota owner type'
    );
  }

  const canonicalOwnerId = String(ownerId || '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(canonicalOwnerId)) {
    throw domainTypeError(
      'INVALID_QUOTA_OWNER_ID',
      'Publishing quota owner ID must be a valid ObjectId'
    );
  }

  return `${ownerType}:${canonicalOwnerId}`;
}
