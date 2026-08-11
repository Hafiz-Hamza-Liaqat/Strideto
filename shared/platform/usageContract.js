/**
 * Usage / quota shared representation (Phase 1).
 *
 * Complements Commerce Money semantics; does not implement role pricing.
 */

export function normalizeUsageQuota(input = {}) {
  const limit = input.limit;
  const used = typeof input.used === 'number' && input.used >= 0 ? input.used : 0;
  const hasLimit = typeof limit === 'number' && limit >= 0;
  const remaining = hasLimit ? Math.max(0, limit - used) : null;

  return Object.freeze({
    limit: hasLimit ? limit : null,
    used,
    remaining,
    period: input.period || null,
    nextReset: input.nextReset || null,
    source: input.source || null,
    policyVersion: input.policyVersion || null,
    unknown: !hasLimit && input.unknown !== false,
  });
}

/** True when quota is exhausted (only when limit is known). */
export function isQuotaExhausted(quota) {
  const q = normalizeUsageQuota(quota);
  if (q.unknown || q.limit === null) return false;
  return q.used >= q.limit;
}
