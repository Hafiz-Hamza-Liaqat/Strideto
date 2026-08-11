/**
 * Data lifecycle foundation (Phase 1 — shared platform foundation).
 *
 * Prefer archive/retention semantics over hard deletion for regulated domains.
 */

export const LIFECYCLE_STATES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  PENDING_DELETION: 'pending_deletion',
  ANONYMIZED: 'anonymized',
});

export const RETENTION_CLASSES = Object.freeze({
  OPERATIONAL: 'operational',
  VERIFICATION_HISTORY: 'verification_history',
  FINANCIAL: 'financial',
  AUDIT: 'audit',
  USER_REQUESTED: 'user_requested',
});

const STATE_SET = new Set(Object.values(LIFECYCLE_STATES));
const CLASS_SET = new Set(Object.values(RETENTION_CLASSES));

export function isValidLifecycleState(value) {
  return typeof value === 'string' && STATE_SET.has(value);
}

export function isValidRetentionClass(value) {
  return typeof value === 'string' && CLASS_SET.has(value);
}

/**
 * Whether a record with the given retention class may be hard-deleted.
 * Financial and audit records are never eligible for immediate hard deletion.
 */
export function isHardDeletionEligible({ retentionClass, lifecycleState }) {
  if (!isValidRetentionClass(retentionClass) || !isValidLifecycleState(lifecycleState)) {
    return false;
  }
  if (retentionClass === RETENTION_CLASSES.FINANCIAL) return false;
  if (retentionClass === RETENTION_CLASSES.AUDIT) return false;
  if (lifecycleState === LIFECYCLE_STATES.PENDING_DELETION) return false;
  return lifecycleState === LIFECYCLE_STATES.ANONYMIZED;
}

/** Domain-specific lifecycle hints (foundation only — UIs deferred to later phases). */
export const DOMAIN_LIFECYCLE_DEFAULTS = Object.freeze({
  verification: { retentionClass: RETENTION_CLASSES.VERIFICATION_HISTORY, archiveOn: ['revoked', 'expired'] },
  job: { retentionClass: RETENTION_CLASSES.OPERATIONAL, archiveOn: ['closed'] },
  application: { retentionClass: RETENTION_CLASSES.OPERATIONAL, archiveOn: ['withdrawn'] },
  document: { retentionClass: RETENTION_CLASSES.OPERATIONAL, archiveOn: ['deleted_pending_retention'] },
  account: { retentionClass: RETENTION_CLASSES.USER_REQUESTED, archiveOn: ['pending_deletion'] },
});
