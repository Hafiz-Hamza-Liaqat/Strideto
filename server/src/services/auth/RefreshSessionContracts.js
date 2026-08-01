/**
 * SEC-3B — dormant contracts shared by the RefreshSession model, the
 * rotation service, and the JWT session provider. Pure data/constants and
 * an error class only — no Mongoose, no I/O, no live route imports this
 * yet. Authority: docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md
 * (§21, §22, §19A).
 */

export const REFRESH_SESSION_SUBJECT_TYPES = Object.freeze([
  'user',
  'employer',
]);

export const REFRESH_SESSION_REVOKE_REASONS = Object.freeze([
  'logout',
  'logout_all',
  'replay_detected',
  'password_change',
  'password_reset',
  'account_suspended',
  'account_deleted',
  'role_changed',
  'admin_revoked',
  /**
   * SEC-3D.3 — the refresh family rotated successfully, but the mandatory
   * authoritative post-rotation subject-state revalidation (readiness
   * audit §11.2) found the successor credential no longer eligible for
   * delivery. Single-family only, system-generated, never used by SEC-3B
   * replay classification or any other event. Added narrowly to this
   * already-checkpointed enum because the accepted architecture already
   * mandated this exact cleanup event without assigning it a truthful
   * audit reason — reusing 'admin_revoked' or 'logout' for it would have
   * misrepresented the event in the revocation audit trail.
   */
  'refresh_final_state_mismatch',
]);

/** §22/§23 — the accepted, tested benign-concurrency window. Not a guess. */
export const REFRESH_SESSION_CONCURRENCY_WINDOW_MS = 15000;

/** Default absolute session lifetime, matching today's REFRESH_EXPIRES_IN default (7d). */
export const REFRESH_SESSION_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Outcome codes returned by the dormant rotation service (§22 steps 5-8). */
export const REFRESH_ROTATION_RESULT_CODES = Object.freeze([
  'ROTATED',
  'CONFLICT_BENIGN',
  'REPLAY_DETECTED',
  'SESSION_MISSING',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'SUBJECT_MISMATCH',
  'VERSION_MISMATCH',
  'STORAGE_FAILURE',
  /**
   * SEC-3B.1 — caller-supplied rotate()/createSession() arguments failed
   * validation before any model call was made (missing/empty sid or
   * hashes, identical presented/successor hash, invalid clock output,
   * invalid concurrency-window configuration).
   */
  'INVALID_INPUT',
  /**
   * SEC-3B.1 — the replay classification read is provably stale: the
   * guarded, state-conditioned revoke CAS (§7) did not match, meaning the
   * session's state changed between the classification read and the
   * revoke attempt (most plausibly a legitimate concurrent rotation
   * completed in between). The family is deliberately left unrevoked
   * rather than falling back to an unconditional revoke.
   */
  'CLASSIFICATION_STALE',
]);

const SAFE_MESSAGES = Object.freeze({
  REFRESH_SESSION_CONTRACT_INVALID: 'The refresh session request is invalid.',
  REFRESH_SESSION_STORAGE_FAILURE: 'The refresh session store is unavailable.',
});

export class RefreshSessionContractError extends Error {
  constructor(code, message = SAFE_MESSAGES[code]) {
    super(message || SAFE_MESSAGES.REFRESH_SESSION_CONTRACT_INVALID);
    this.name = 'RefreshSessionContractError';
    this.code = code;
  }
}

export function isKnownSubjectType(value) {
  return REFRESH_SESSION_SUBJECT_TYPES.includes(value);
}

export function isKnownRevokeReason(value) {
  return REFRESH_SESSION_REVOKE_REASONS.includes(value);
}
