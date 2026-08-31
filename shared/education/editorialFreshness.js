import {
  FRESHNESS_STATES,
  VERIFICATION_STATUSES,
  deriveFreshness,
} from '../trust/sourceVerification.js';

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function latestSourceVerifiedAt(sources = []) {
  if (!Array.isArray(sources)) return null;
  return sources
    .map((source) => validDate(source?.verifiedAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

/**
 * Review state for editorial content. A missing nextReviewAt is deliberately
 * not treated as permanently fresh; it remains verified but unscheduled.
 */
export function deriveEditorialFreshness({ sources = [], nextReviewAt = null, now = null } = {}) {
  const lastVerifiedAt = latestSourceVerifiedAt(sources);
  if (!lastVerifiedAt) {
    return {
      lastVerifiedAt: null,
      verificationStatus: VERIFICATION_STATUSES.UNVERIFIED,
      freshnessState: FRESHNESS_STATES.UNKNOWN,
    };
  }

  const reviewAt = validDate(nextReviewAt);
  return {
    lastVerifiedAt,
    verificationStatus: VERIFICATION_STATUSES.VERIFIED,
    freshnessState: reviewAt
      ? deriveFreshness({ lastVerifiedAt, nextReviewAt: reviewAt, now })
      : FRESHNESS_STATES.UNKNOWN,
  };
}

export function editorialFreshnessLabel({ verificationStatus, freshnessState, nextReviewAt } = {}) {
  if (verificationStatus !== VERIFICATION_STATUSES.VERIFIED) return 'Unverified';
  if (!nextReviewAt) return 'Verified — review not scheduled';
  if (freshnessState === FRESHNESS_STATES.FRESH) return 'Current — review scheduled';
  if (freshnessState === FRESHNESS_STATES.STALE) return 'Stale — review required';
  if (freshnessState === FRESHNESS_STATES.REVIEW_DUE) return 'Needs review';
  if (freshnessState === FRESHNESS_STATES.BROKEN) return 'Source unavailable';
  return 'Review status unknown';
}
