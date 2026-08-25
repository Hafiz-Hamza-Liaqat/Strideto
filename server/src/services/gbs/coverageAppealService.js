/**
 * Coverage appeal workflow (Phase 6).
 * Provider appeals a rejected coverage listing. Appeal is NOT self-approving.
 * Admin approve → listing returns to under_review for fresh review.
 * Admin reject → listing stays rejected, appeal closed.
 * Only one active appeal per listing at a time.
 * Active appeal and normal resubmit are mutually exclusive paths.
 */
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_PROVIDER_BOUNDS,
} from '../../../../shared/gbs/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsServiceListingRecord } from '../platform/optimisticConcurrency.js';
import { notifyAdminStaff } from '../notificationService.js';

export const APPEAL_STATUSES = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

export function isActiveAppeal(appeal) {
  if (!appeal) return false;
  return appeal.status === APPEAL_STATUSES.SUBMITTED || appeal.status === APPEAL_STATUSES.UNDER_REVIEW;
}

export function assertAppealEligibility(listing) {
  if (listing.moderationStatus !== GBS_LISTING_MODERATION_STATUSES.REJECTED) {
    throw deny('appeal_listing_not_rejected', 409);
  }
  if (isActiveAppeal(listing.appeal)) {
    throw deny('appeal_already_active', 409);
  }
}

/**
 * Appeal decisions may only mutate a listing that still has an active appeal
 * and remains in the appeal-eligible rejected coverage state.
 * Stale/decided appeals must not rewrite a newer listing state.
 */
export function assertAppealDecisionEligibility(listing) {
  if (!isActiveAppeal(listing?.appeal)) {
    throw deny('no_active_appeal', 409);
  }
  if (listing.moderationStatus !== GBS_LISTING_MODERATION_STATUSES.REJECTED) {
    throw deny('appeal_listing_state_mismatch', 409);
  }
}

/** Safe canonical coverage-tuple metadata for appeal audits/notifications. */
export function appealCoverageMetadata(listing, extra = {}) {
  return redactAuditMetadata({
    listingId: String(listing._id || listing.id || ''),
    subjectType: listing.subjectType,
    subjectId: String(listing.subjectId),
    capabilityId: listing.capabilityId,
    jurisdictionId: listing.jurisdictionId,
    ...extra,
  });
}

async function loadExact({ id, subjectType, subjectId }) {
  const record = await GbsServiceListing.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  }).lean();
  if (!record) throw deny('listing_not_found', 404);
  return record;
}

export async function submitCoverageAppeal({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  actor,
  reason,
  explanation,
  evidenceRef,
} = {}) {
  const current = await loadExact({ id, subjectType, subjectId });

  assertAppealEligibility(current);

  const reasonTrimmed = (reason || '').trim().slice(0, GBS_PROVIDER_BOUNDS.NOTES_MAX);
  if (!reasonTrimmed) throw deny('appeal_reason_required', 400);

  const appeal = {
    status: APPEAL_STATUSES.SUBMITTED,
    reason: reasonTrimmed,
    explanation: (explanation || '').trim().slice(0, GBS_PROVIDER_BOUNDS.NOTES_MAX),
    evidenceRef: (evidenceRef || '').trim().slice(0, GBS_PROVIDER_BOUNDS.REFERENCE_MAX) || null,
    submittedAt: new Date(),
    decidedAt: null,
    decisionReason: '',
  };

  const updated = await mutateGbsServiceListingRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    actor,
    set: { appeal },
  });

  const meta = appealCoverageMetadata(current, {
    appealStatus: APPEAL_STATUSES.SUBMITTED,
  });

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_LISTING_APPEAL_SUBMITTED,
    targetType: 'GbsServiceListing',
    targetId: String(id),
    metadata: meta,
  });

  notifyAdminStaff({
    type: 'gbs_listing_appeal_submitted',
    title: 'Coverage appeal submitted',
    body: 'A provider has submitted a coverage appeal for a rejected listing.',
    metadata: meta,
    dedupeKey: `gbs_listing_appeal_submitted:${id}:${current.recordVersion}`,
  }).catch(() => {});

  return updated;
}

export async function approveAppeal({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  actor,
  reason,
} = {}) {
  if (!actor?.isStaff) throw deny('staff_review_required');

  const current = await loadExact({ id, subjectType, subjectId });
  assertAppealDecisionEligibility(current);

  const updated = await mutateGbsServiceListingRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    actor,
    set: {
      appeal: {
        status: APPEAL_STATUSES.APPROVED,
        reason: current.appeal.reason || '',
        explanation: current.appeal.explanation || '',
        evidenceRef: current.appeal.evidenceRef || null,
        submittedAt: current.appeal.submittedAt || null,
        decidedAt: new Date(),
        decisionReason: (reason || '').trim(),
      },
      moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
      adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: '',
      // publicationStatus is stripped by mutateGbsServiceListingRecord —
      // appeal approval must never publish and never touch capability/org trust.
    },
  });

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_LISTING_APPEAL_APPROVED,
    targetType: 'GbsServiceListing',
    targetId: String(id),
    metadata: appealCoverageMetadata(current, {
      appealStatus: APPEAL_STATUSES.APPROVED,
      decision: 'approved',
      toModeration: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    }),
    reason,
  });

  return updated;
}

export async function rejectAppeal({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  actor,
  reason,
} = {}) {
  if (!actor?.isStaff) throw deny('staff_review_required');

  const current = await loadExact({ id, subjectType, subjectId });
  assertAppealDecisionEligibility(current);

  const updated = await mutateGbsServiceListingRecord({
    id,
    expectedVersion,
    subjectType,
    subjectId,
    actor,
    set: {
      appeal: {
        status: APPEAL_STATUSES.REJECTED,
        reason: current.appeal.reason || '',
        explanation: current.appeal.explanation || '',
        evidenceRef: current.appeal.evidenceRef || null,
        submittedAt: current.appeal.submittedAt || null,
        decidedAt: new Date(),
        decisionReason: (reason || '').trim(),
      },
    },
  });

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_LISTING_APPEAL_REJECTED,
    targetType: 'GbsServiceListing',
    targetId: String(id),
    metadata: appealCoverageMetadata(current, {
      appealStatus: APPEAL_STATUSES.REJECTED,
      decision: 'rejected',
      toModeration: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    }),
    reason,
  });

  return updated;
}

export async function listPendingAppeals({ page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const filter = {
    'appeal.status': { $in: [APPEAL_STATUSES.SUBMITTED, APPEAL_STATUSES.UNDER_REVIEW] },
  };
  const [items, total] = await Promise.all([
    GbsServiceListing.find(filter)
      .sort({ 'appeal.submittedAt': 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    GbsServiceListing.countDocuments(filter),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
}
