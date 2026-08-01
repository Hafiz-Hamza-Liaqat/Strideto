import {
  REFRESH_SESSION_SUBJECT_TYPES,
  REFRESH_SESSION_REVOKE_REASONS,
} from './RefreshSessionContracts.js';

/**
 * SEC-3D.1 — dormant contracts for session-family revocation. Pure
 * data/constants and an error class only — no Mongoose, no I/O, no live
 * route imports this yet. Reuses SEC-3B's realm enum and revoke-reason
 * enum as the single source of truth rather than redeclaring them.
 * Authority: docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md
 * (§9, §10, §14.2).
 */

export const SESSION_FAMILY_REALMS = REFRESH_SESSION_SUBJECT_TYPES;

/**
 * Every safe result code `SessionFamilyRevocationService` can return.
 * `REVOKED_CURRENT_FAMILY` is the one canonical single-family success
 * code — the accepted readiness audit (§14.2/§19) names this and
 * `SESSION_REVOKED` as the same concept ("SESSION_REVOKED; or
 * REVOKED_CURRENT_FAMILY"); `REVOKED_CURRENT_FAMILY` is used throughout
 * this module rather than exporting two literal codes for one concept.
 * `REVOCATION_PARTIAL` (SEC-3D.1.1) — reachable directly from
 * `revokeAllFamilies`: returned when a single `updateMany` call's own
 * driver result reports `matchedCount > modifiedCount > 0` — some
 * matched families were not actually modified, a genuine, same-call
 * partial cleanup observable from the result this service already has.
 * `revokedCount` on that result equals the exact `modifiedCount`. This
 * is distinct from, and does not replace, the separate cross-operation
 * question a future SEC-3D.2 coordinator will face (composing this
 * service's `STORAGE_FAILURE` with a preceding, already-committed
 * `tokenVersion` mutation) — this module has no visibility into any
 * operation outside its own `RefreshSession` writes, but it does not
 * need any to detect and report the within-operation partial case.
 */
export const SESSION_FAMILY_REVOCATION_RESULT_CODES = Object.freeze([
  'INVALID_INPUT',
  'REVOKED_CURRENT_FAMILY',
  'SESSION_ALREADY_REVOKED',
  'SESSION_MISSING',
  'SESSION_EXPIRED',
  'SESSION_SUBJECT_MISMATCH',
  'REVOKED_ALL_FAMILIES',
  'REVOCATION_PARTIAL',
  'CLASSIFICATION_STALE',
  'STORAGE_FAILURE',
]);

/**
 * Reasons appropriate for revoking exactly one family (§9 of the
 * readiness audit). Deliberately excludes `'replay_detected'` — that is
 * SEC-3B's own exclusive, already-implemented replay-revocation path
 * (`RefreshSessionRotationService.rotate()`'s guarded revoke CAS); this
 * service must never create a second, competing replay path. Excludes
 * every bulk-oriented reason (§10) — a single-family operation should
 * never be invoked with a reason whose accepted semantics are "revoke
 * everything for this subject." `'admin_revoked'` is included because the
 * accepted event matrix (§5) lists admin-initiated revocation as "Either,
 * admin choice" between current-family and all-family scope.
 */
export const SINGLE_FAMILY_REVOKE_REASONS = Object.freeze([
  'logout',
  'admin_revoked',
  /**
   * SEC-3D.3 addition — the exact reason for the mandatory post-rotation
   * final-state-mismatch cleanup path (readiness audit §11.2/§18). Single-
   * family only: it revokes exactly the one family that just rotated, never
   * a bulk sweep, so it is never added to `ALL_FAMILY_REVOKE_REASONS`.
   */
  'refresh_final_state_mismatch',
]);

/**
 * Reasons appropriate for all-family (bulk) cleanup (§10 of the readiness
 * audit), matching the accepted event matrix (§5) exactly: every event
 * whose access-token implication is "immediate via tokenVersion,
 * best-effort revoke all sessions." Excludes `'logout'` (single-family
 * only) and `'replay_detected'` (SEC-3B-exclusive, never a bulk
 * operation).
 */
export const ALL_FAMILY_REVOKE_REASONS = Object.freeze([
  'logout_all',
  'password_change',
  'password_reset',
  'account_suspended',
  'account_deleted',
  'role_changed',
  'admin_revoked',
]);

// Defensive invariant: every configured reason above must be a real,
// already-accepted RefreshSession revokeReason — this module must never
// introduce a reason string the SEC-3B schema doesn't already recognize.
for (const reason of [
  ...SINGLE_FAMILY_REVOKE_REASONS,
  ...ALL_FAMILY_REVOKE_REASONS,
]) {
  if (!REFRESH_SESSION_REVOKE_REASONS.includes(reason)) {
    throw new Error(
      `SessionFamilyRevocationContracts: "${reason}" is not a recognized RefreshSession revokeReason`
    );
  }
}

const SAFE_MESSAGES = Object.freeze({
  SESSION_FAMILY_REVOCATION_INVALID: 'The request could not be validated.',
  SESSION_FAMILY_REVOCATION_CONFIGURATION_INVALID:
    'The service configuration is invalid.',
});

export class SessionFamilyRevocationError extends Error {
  constructor(code, message = SAFE_MESSAGES[code]) {
    super(message || SAFE_MESSAGES.SESSION_FAMILY_REVOCATION_INVALID);
    this.name = 'SessionFamilyRevocationError';
    this.code = code;
  }
}

export function isKnownRealm(value) {
  return SESSION_FAMILY_REALMS.includes(value);
}

export function isSingleFamilyRevokeReason(value) {
  return SINGLE_FAMILY_REVOKE_REASONS.includes(value);
}

export function isAllFamilyRevokeReason(value) {
  return ALL_FAMILY_REVOKE_REASONS.includes(value);
}

/** RefreshSession `_id`/`subjectId` are Mongo ObjectIds — a valid string
 * form is exactly 24 hex characters, matching
 * `SessionSubjectStateProvider.js`'s existing convention. */
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isValidObjectIdString(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}
