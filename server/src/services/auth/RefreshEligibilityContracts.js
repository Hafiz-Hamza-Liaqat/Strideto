import { REFRESH_SESSION_SUBJECT_TYPES } from './RefreshSessionContracts.js';

/**
 * Canonical contracts for the refresh-eligibility and post-rotation
 * revalidation coordinator. Pure data/constants only — no Mongoose and no
 * I/O. Authority:
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md
 * (§11, §14.4, §18).
 */

export const REFRESH_ELIGIBILITY_REALMS = REFRESH_SESSION_SUBJECT_TYPES;

/**
 * Final external result codes for `attemptRefresh`. Deliberately reuses
 * already-established names rather than inventing near-synonyms:
 * `SESSION_MISSING`/`SESSION_REVOKED`/`SESSION_EXPIRED`/`SUBJECT_MISMATCH`/
 * `VERSION_MISMATCH`/`CONFLICT_BENIGN`/`REPLAY_DETECTED`/
 * `CLASSIFICATION_STALE`/`INVALID_INPUT` are the exact
 * `REFRESH_ROTATION_RESULT_CODES` values `RefreshSessionRotationService`
 * already defines (§18's "pass-through... unchanged from SEC-3B"
 * requirement — `SUBJECT_MISMATCH` in particular is already reserved in
 * that contract but never produced by the rotation service itself; this
 * coordinator is its first real producer, for the session-binding check).
 * `SUBJECT_MISSING`/`SUBJECT_INACTIVE`/`SUBJECT_STATE_INVALID`/
 * `TOKEN_VERSION_MISMATCH` are `SessionSubjectStateProvider`'s own exact
 * codes, reused unchanged for the pre-rotation and post-rotation subject
 * reads (§14.1). `REFRESH_ROTATED` and `REFRESH_FINAL_STATE_MISMATCH` are
 * this coordinator's own two external codes, per §14.4.
 */
export const REFRESH_ELIGIBILITY_RESULT_CODES = Object.freeze([
  'REFRESH_ROTATED',
  'REFRESH_FINAL_STATE_MISMATCH',
  'INVALID_INPUT',
  'REFRESH_TOKEN_INVALID',
  'SESSION_MISSING',
  'SUBJECT_MISMATCH',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'VERSION_MISMATCH',
  'CONFLICT_BENIGN',
  'REPLAY_DETECTED',
  'CLASSIFICATION_STALE',
  'SUBJECT_MISSING',
  'SUBJECT_INACTIVE',
  'SUBJECT_STATE_INVALID',
  'TOKEN_VERSION_MISMATCH',
  'STORAGE_FAILURE',
]);

/**
 * Internal-only sub-classification of the post-rotation-mismatch cleanup
 * attempt (§11.2/§14.4). Never returned externally — every mismatch,
 * regardless of which of these applies, maps to the single external
 * `REFRESH_FINAL_STATE_MISMATCH` code.
 */
export const ROTATED_FAMILY_CLEANUP_RESULT_CODES = Object.freeze([
  'ROTATED_FAMILY_REVOKED',
  'ROTATED_FAMILY_CLEANUP_FAILED',
]);

/** §11.2 — the exact, narrowly-scoped SEC-3D.3 cleanup revoke reason. */
export const REFRESH_FINAL_STATE_MISMATCH_REVOKE_REASON =
  'refresh_final_state_mismatch';

export function isKnownRealm(value) {
  return REFRESH_ELIGIBILITY_REALMS.includes(value);
}
