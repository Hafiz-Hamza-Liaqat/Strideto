import { REFRESH_SESSION_SUBJECT_TYPES } from './RefreshSessionContracts.js';

/**
 * Canonical contracts for the subject-state-only access-authorization
 * coordinator. Pure data/constants only — no Mongoose and no I/O. Authority:
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md
 * (§12, §14.5, §18).
 */

export const ACCESS_AUTHORIZATION_REALMS = REFRESH_SESSION_SUBJECT_TYPES;

/**
 * Exact §14.5 taxonomy for this coordinator. `ACCESS_DENYLISTED` is
 * deliberately **not** included — the shared denylist check is layered
 * alongside this coordinator at the live middleware layer (§12.1) and is
 * never producible by a subject-state-only coordinator. `SessionSubjectStateProvider`'s
 * `SUBJECT_MISSING`/`SUBJECT_INACTIVE`/`SUBJECT_STATE_INVALID` all
 * collapse into the single `ACCESS_SUBJECT_INACTIVE` external code,
 * matching §14.5's own single-code definition and the anti-enumeration
 * posture already established throughout this architecture (never let a
 * caller distinguish "never existed" from "exists but suspended" from
 * "exists but corrupted").
 */
export const ACCESS_AUTHORIZATION_RESULT_CODES = Object.freeze([
  'ACCESS_AUTHORIZED',
  'ACCESS_SUBJECT_INACTIVE',
  'ACCESS_VERSION_MISMATCH',
  'ACCESS_STORAGE_FAILURE',
  'ACCESS_TOKEN_INVALID',
  'INVALID_INPUT',
]);

/** Never reachable from this coordinator — SEC-3E composition only (§12.1). */
export const ACCESS_DENYLISTED_CODE = 'ACCESS_DENYLISTED';

export function isKnownRealm(value) {
  return ACCESS_AUTHORIZATION_REALMS.includes(value);
}
