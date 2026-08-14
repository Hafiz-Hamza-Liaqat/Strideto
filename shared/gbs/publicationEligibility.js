/**
 * Canonical CURRENT-public eligibility for GBS catalog facts (Phase 17D-2).
 *
 * Only `current` may later be projected as current-public.
 * No public route exists in this phase.
 *
 * Frozen model:
 * reviewStatus == reviewed
 * AND superseded == false
 * AND now <= reviewDueAt
 * AND effectiveFrom <= now where set
 * AND (effectiveTo absent OR now < effectiveTo)
 */
import {
  CATALOG_REVIEW_STATUSES,
  CATALOG_STATUSES,
  PUBLICATION_ELIGIBILITY_STATES,
} from './catalogConstants.js';

function toDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @returns {{ state: string, eligibleCurrent: boolean, reason: string }}
 */
export function resolvePublicationEligibility(record = {}, { now = new Date() } = {}) {
  const clock = toDate(now) || new Date();
  const reviewStatus = record.reviewStatus;
  const superseded = record.superseded === true;
  const status = record.status || CATALOG_STATUSES.ACTIVE;

  if (status && status !== CATALOG_STATUSES.ACTIVE) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.INACTIVE,
      eligibleCurrent: false,
      reason: 'record_inactive',
    };
  }
  if (reviewStatus === CATALOG_REVIEW_STATUSES.REJECTED) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.REJECTED,
      eligibleCurrent: false,
      reason: 'rejected',
    };
  }
  if (superseded || reviewStatus === CATALOG_REVIEW_STATUSES.SUPERSEDED) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.SUPERSEDED,
      eligibleCurrent: false,
      reason: 'superseded',
    };
  }
  if (reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT || !reviewStatus) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.DRAFT,
      eligibleCurrent: false,
      reason: 'draft',
    };
  }
  if (reviewStatus === CATALOG_REVIEW_STATUSES.UNDER_REVIEW) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.UNDER_REVIEW,
      eligibleCurrent: false,
      reason: 'under_review',
    };
  }
  if (reviewStatus === CATALOG_REVIEW_STATUSES.STALE) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.STALE,
      eligibleCurrent: false,
      reason: 'marked_stale',
    };
  }

  const effectiveFrom = toDate(record.effectiveFrom);
  const effectiveTo = toDate(record.effectiveTo);
  if (effectiveFrom && clock < effectiveFrom) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.NOT_YET_EFFECTIVE,
      eligibleCurrent: false,
      reason: 'not_yet_effective',
    };
  }
  if (effectiveTo && clock >= effectiveTo) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.EXPIRED,
      eligibleCurrent: false,
      reason: 'expired',
    };
  }

  const reviewDueAt = toDate(record.reviewDueAt);
  if (reviewDueAt && clock > reviewDueAt) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.STALE,
      eligibleCurrent: false,
      reason: 'review_due_passed',
    };
  }

  if (reviewStatus !== CATALOG_REVIEW_STATUSES.REVIEWED) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.DRAFT,
      eligibleCurrent: false,
      reason: 'not_reviewed',
    };
  }
  if (!reviewDueAt) {
    return {
      state: PUBLICATION_ELIGIBILITY_STATES.STALE,
      eligibleCurrent: false,
      reason: 'review_due_required',
    };
  }

  return {
    state: PUBLICATION_ELIGIBILITY_STATES.CURRENT,
    eligibleCurrent: true,
    reason: 'current',
  };
}

export function isCurrentPublicEligible(record, opts) {
  return resolvePublicationEligibility(record, opts).eligibleCurrent === true;
}
