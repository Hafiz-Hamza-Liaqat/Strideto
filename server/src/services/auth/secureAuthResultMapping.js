/**
 * SEC-3E — one finite HTTP-mapping layer for the secure authentication
 * flows, shared by both realms rather than scattered ad hoc mappings in
 * each controller. Uses the exact code names exported by the actual
 * coordinators (`RefreshEligibilityCoordinator`/`AccessAuthorizationCoordinator`)
 * — no near-synonym is ever invented here.
 */

const REFRESH_UNAUTHORIZED_CODES = new Set([
  'REFRESH_TOKEN_INVALID',
  'SESSION_MISSING',
  'SUBJECT_MISMATCH',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'VERSION_MISMATCH',
  'REFRESH_FINAL_STATE_MISMATCH',
  'REPLAY_DETECTED',
  'SUBJECT_MISSING',
  'SUBJECT_INACTIVE',
  'SUBJECT_STATE_INVALID',
  'TOKEN_VERSION_MISMATCH',
]);

const REFRESH_UNAVAILABLE_CODES = new Set([
  'STORAGE_FAILURE',
  'CLASSIFICATION_STALE',
]);

/**
 * Maps a `RefreshEligibilityCoordinator.attemptRefresh` result code to the
 * accepted HTTP status. `CONFLICT_BENIGN` uses the checkpointed conflict
 * mapping (architecture report §22 step 8): HTTP 409 with a `Retry-After`
 * header — the caller (the refresh controller) is responsible for setting
 * that header, since this pure function returns only a status code.
 */
export function mapRefreshResultToHttpStatus(code) {
  if (code === 'REFRESH_ROTATED') return 200;
  if (code === 'CONFLICT_BENIGN') return 409;
  if (REFRESH_UNAUTHORIZED_CODES.has(code)) return 401;
  if (REFRESH_UNAVAILABLE_CODES.has(code) || code === 'INVALID_INPUT')
    return 503;
  // Any unrecognized code fails closed to the safest generic status —
  // never treated as success.
  return 503;
}

/**
 * Refresh outcomes that must clear the realm's refresh cookie — every
 * terminal credential failure. `CONFLICT_BENIGN` and `STORAGE_FAILURE`/
 * `CLASSIFICATION_STALE` are deliberately excluded: a benign conflict must
 * never overwrite or clear the winning request's cookie, and a transient
 * infrastructure failure must never be treated as proof the credential is
 * bad.
 */
const REFRESH_COOKIE_CLEAR_CODES = new Set([
  'REFRESH_TOKEN_INVALID',
  'SESSION_MISSING',
  'SUBJECT_MISMATCH',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'VERSION_MISMATCH',
  'REFRESH_FINAL_STATE_MISMATCH',
  'REPLAY_DETECTED',
  'SUBJECT_MISSING',
  'SUBJECT_INACTIVE',
  'SUBJECT_STATE_INVALID',
  'TOKEN_VERSION_MISMATCH',
]);

export function shouldClearRefreshCookie(code) {
  return REFRESH_COOKIE_CLEAR_CODES.has(code);
}

const ACCESS_UNAUTHORIZED_CODES = new Set([
  'ACCESS_TOKEN_INVALID',
  'ACCESS_SUBJECT_INACTIVE',
  'ACCESS_VERSION_MISMATCH',
]);

/** Maps an `AccessAuthorizationCoordinator.authorize` result code to HTTP status. */
export function mapAccessResultToHttpStatus(code) {
  if (code === 'ACCESS_AUTHORIZED') return 200;
  if (ACCESS_UNAUTHORIZED_CODES.has(code)) return 401;
  if (code === 'ACCESS_STORAGE_FAILURE' || code === 'INVALID_INPUT') return 503;
  return 503;
}

/** Generic, non-identifying public bodies — never expose internal codes/state. */
export const SAFE_BODIES = Object.freeze({
  INVALID_CREDENTIALS: Object.freeze({ error: 'Invalid email or password' }),
  REFRESH_UNAUTHORIZED: Object.freeze({
    error: 'Refresh token invalid, expired, or revoked',
  }),
  REFRESH_CONFLICT: Object.freeze({ error: 'refresh_conflict' }),
  SERVICE_UNAVAILABLE: Object.freeze({
    error: 'Service temporarily unavailable',
  }),
  ACCESS_UNAUTHORIZED: Object.freeze({ error: 'Invalid or expired token' }),
  AUTHENTICATION_REQUIRED: Object.freeze({ error: 'Authentication required' }),
  ORIGIN_VALIDATION_FAILED: Object.freeze({
    error: 'origin_validation_failed',
  }),
});
