/**
 * Account security + privacy control foundation (Phase 1).
 *
 * Shared request/status semantics for export and deletion workflows.
 * Does not perform hard deletion — later phases implement orchestration.
 */

export const ACCOUNT_REQUEST_TYPES = Object.freeze({
  EXPORT: 'export',
  DELETION: 'deletion',
});

export const ACCOUNT_REQUEST_STATUSES = Object.freeze({
  REQUESTED: 'requested',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

const TYPE_SET = new Set(Object.values(ACCOUNT_REQUEST_TYPES));
const STATUS_SET = new Set(Object.values(ACCOUNT_REQUEST_STATUSES));

export function isValidAccountRequestType(value) {
  return typeof value === 'string' && TYPE_SET.has(value);
}

export function isValidAccountRequestStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

/**
 * Validate an account privacy request record (export or deletion).
 */
export function validateAccountPrivacyRequest(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['request must be an object'] };
  }
  if (!input.subjectId) errors.push('subjectId is required');
  if (!isValidAccountRequestType(input.type)) errors.push('invalid request type');
  if (input.status && !isValidAccountRequestStatus(input.status)) {
    errors.push('invalid request status');
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      subjectId: input.subjectId,
      type: input.type,
      status: input.status || ACCOUNT_REQUEST_STATUSES.REQUESTED,
      requestedAt: input.requestedAt || new Date().toISOString(),
      completedAt: input.completedAt || null,
      auditIdentity: input.auditIdentity || null,
    },
  };
}

/** Immutable domains that survive account deletion per retention policy. */
export const IMMUTABLE_POST_DELETION_BOUNDARIES = Object.freeze([
  'audit_log',
  'financial_ledger',
  'verification_audit_trail',
]);
