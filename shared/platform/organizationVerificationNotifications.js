/**
 * Organization verification notification event contract (Phase 1).
 *
 * Typed events for Employer, Agent, and Institution verification workflows.
 * Recipient derivation is server-authoritative; internal reviewer reasons
 * must never appear in notification body/metadata exposed to organizations.
 */
import { VERIFICATION_STATUSES } from '../international/verification.js';

export const ORG_VERIFICATION_NOTIFICATION_TYPES = Object.freeze({
  SUBMITTED: 'org_verification.submitted',
  NEEDS_INFORMATION: 'org_verification.needs_information',
  RESUBMITTED: 'org_verification.resubmitted',
  APPROVED: 'org_verification.approved',
  REJECTED: 'org_verification.rejected',
  SUSPENDED: 'org_verification.suspended',
  REVOKED: 'org_verification.revoked',
  EXPIRED_REVIEW_DUE: 'org_verification.expired_review_due',
});

export const CANONICAL_CLAIM_NOTIFICATION_TYPES = Object.freeze({
  SUBMITTED: 'canonical_claim.submitted',
  NEEDS_INFORMATION: 'canonical_claim.needs_information',
  APPROVED: 'canonical_claim.approved',
  REJECTED: 'canonical_claim.rejected',
  CONFLICT: 'canonical_claim.conflict',
});

const FORBIDDEN_NOTIFICATION_METADATA_KEYS = Object.freeze([
  'internalReason',
  'reviewerNotes',
  'moderatorReason',
  'privateNotes',
  'caseNotes',
]);

/** Map verification status transition to notification type (organization-facing). */
export function orgVerificationNotificationTypeForTransition(toStatus) {
  switch (toStatus) {
    case VERIFICATION_STATUSES.VERIFICATION_PENDING:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.SUBMITTED;
    case VERIFICATION_STATUSES.NEEDS_INFORMATION:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.NEEDS_INFORMATION;
    case VERIFICATION_STATUSES.UNDER_REVIEW:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.RESUBMITTED;
    case VERIFICATION_STATUSES.APPROVED:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.APPROVED;
    case VERIFICATION_STATUSES.REJECTED:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.REJECTED;
    case VERIFICATION_STATUSES.SUSPENDED:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.SUSPENDED;
    case VERIFICATION_STATUSES.REVOKED:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.REVOKED;
    case VERIFICATION_STATUSES.EXPIRED:
      return ORG_VERIFICATION_NOTIFICATION_TYPES.EXPIRED_REVIEW_DUE;
    default:
      return null;
  }
}

/** Strip internal reviewer fields from notification metadata. */
export function sanitizeOrgVerificationNotificationMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {};
  const out = { ...metadata };
  for (const key of FORBIDDEN_NOTIFICATION_METADATA_KEYS) {
    delete out[key];
  }
  return out;
}

/**
 * Build a dedupe key for organization verification notifications.
 * Immutable per authoritative state transition identity.
 */
export function orgVerificationDedupeKey({ organizationId, notificationType, transitionId }) {
  return `org-verification:${organizationId}:${notificationType}:${transitionId}`;
}
