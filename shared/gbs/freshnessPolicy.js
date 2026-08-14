/**
 * Versioned GBS catalog freshness policy (Phase 17D-2).
 * Operational days live here, never in page/controller if/else.
 */
export const FRESHNESS_POLICY_VERSION = '17d-2.0';

export const FRESHNESS_POLICY = Object.freeze({
  schemaVersion: FRESHNESS_POLICY_VERSION,
  reviewIntervalDaysByClass: Object.freeze({
    government_fee: 90,
    formation_rule: 180,
    authority_identity: 365,
    periodic_obligation: 180,
    source_default: 180,
  }),
});

export function reviewIntervalDaysForClass(freshnessClass, policy = FRESHNESS_POLICY) {
  const table = policy.reviewIntervalDaysByClass || {};
  const days = table[freshnessClass] ?? table.source_default;
  return Number.isInteger(days) && days > 0 ? days : 180;
}

export function computeReviewDueAt(lastReviewedAt, freshnessClass, policy = FRESHNESS_POLICY) {
  const start = lastReviewedAt ? new Date(lastReviewedAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const days = reviewIntervalDaysForClass(freshnessClass, policy);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
