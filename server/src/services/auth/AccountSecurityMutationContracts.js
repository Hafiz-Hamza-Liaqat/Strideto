import { REFRESH_SESSION_SUBJECT_TYPES } from './RefreshSessionContracts.js';

/**
 * SEC-3D.2 — dormant contracts for the bounded tokenVersion and
 * atomic subject-security mutation primitives. Pure data/constants and an
 * error class only — no Mongoose, no I/O, no live route imports this yet.
 * Authority: docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md
 * (§8, §14.3, §18).
 */

export const ACCOUNT_SECURITY_MUTATION_REALMS = REFRESH_SESSION_SUBJECT_TYPES;

/** Password change/reset and role change have no live Employer route (§8.2/§8.3). */
export const USER_ONLY_REALM = 'user';

/**
 * Final SEC-3D.2 result taxonomy (§14.3) — 15 unique codes. Every public
 * result of this module's service is exactly `{ code }`, never a second
 * field — there is no SEC-3D.1-style count/revocation concept here, since
 * every write below is a single `findOneAndUpdate` (document-or-null),
 * never `updateMany`.
 */
export const ACCOUNT_SECURITY_MUTATION_RESULT_CODES = Object.freeze([
  'VERSION_INCREMENTED',
  'VERSION_ALREADY_ADVANCED',
  'VERSION_CONFLICT',
  'VERSION_REGRESSION',
  'SUBJECT_STATE_UPDATED',
  'SUBJECT_STATE_ALREADY_APPLIED',
  'SUBJECT_STATE_CONFLICT',
  'SUBJECT_STATE_INVALID',
  'SUBJECT_STATE_MALFORMED',
  'VERSION_EXHAUSTED',
  'RESET_TOKEN_INVALID',
  'SUBJECT_MISSING',
  'CLASSIFICATION_STALE',
  'INVALID_INPUT',
  'STORAGE_FAILURE',
]);

/** Matches `User.js`'s own `role` enum exactly — role change is User-only. */
export const ACCOUNT_ROLE_VALUES = Object.freeze([
  'User',
  'Editor',
  'Moderator',
  'Admin',
  'SuperAdmin',
]);

/** Matches both `User.js`/`Employer.js`'s `accountStatus` enum exactly. */
export const ACCOUNT_STATUS_VALUES = Object.freeze(['active', 'suspended']);

/**
 * Recursively freezes every nested array/object so a consumer cannot mutate
 * a deeply-nested branch of a shared exported structure (`Object.freeze` on
 * its own is shallow — it would leave `VALID_TOKEN_VERSION_EXPR.$cond[1]`,
 * for example, fully mutable). No external dependency; a handful of lines
 * is sufficient for this module's own exported constants.
 */
function deepFreeze(value) {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function')
  ) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze(value[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * §8.1 — the corrected, hardened tokenVersion well-formedness guard. `$mod`
 * is reached only inside the branch already gated by `$isNumber === true`
 * and the range check `=== true`, so no expression error is possible on a
 * malformed stored value. Used as the `$expr` clause on every write below
 * that increments `tokenVersion`. Deep-frozen: every nested array/object in
 * this structure is immutable, not only the outermost object, so no
 * consumer can silently alter the guard that future writes rely on.
 */
export const VALID_TOKEN_VERSION_EXPR = deepFreeze({
  $cond: [
    { $isNumber: '$tokenVersion' },
    {
      $cond: [
        {
          $and: [
            { $gte: ['$tokenVersion', 0] },
            { $lt: ['$tokenVersion', Number.MAX_SAFE_INTEGER] },
          ],
        },
        { $eq: [{ $mod: ['$tokenVersion', 1] }, 0] },
        false,
      ],
    },
    false,
  ],
});

/**
 * Pure-JS mirror of `VALID_TOKEN_VERSION_EXPR`'s well-formedness half, used
 * by classification reads (which fetch a plain field value, not an
 * aggregation-evaluated boolean) to decide `SUBJECT_STATE_MALFORMED` vs.
 * `VERSION_EXHAUSTED` vs. a genuine numeric comparison. `Number.isSafeInteger`
 * already caps acceptance at `Number.MAX_SAFE_INTEGER` inclusive, matching
 * the guard's own numeric/range/integer checks.
 */
export function isWellFormedTokenVersion(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** True only when a well-formed value is strictly below the maximum bound. */
export function isBelowTokenVersionMaximum(value) {
  return value < Number.MAX_SAFE_INTEGER;
}

const SAFE_MESSAGES = Object.freeze({
  ACCOUNT_SECURITY_MUTATION_INVALID: 'The request could not be validated.',
  ACCOUNT_SECURITY_MUTATION_CONFIGURATION_INVALID:
    'The service configuration is invalid.',
});

export class AccountSecurityMutationError extends Error {
  constructor(code, message = SAFE_MESSAGES[code]) {
    super(message || SAFE_MESSAGES.ACCOUNT_SECURITY_MUTATION_INVALID);
    this.name = 'AccountSecurityMutationError';
    this.code = code;
  }
}

export function isKnownRealm(value) {
  return ACCOUNT_SECURITY_MUTATION_REALMS.includes(value);
}

export function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function isValidAccountStatus(value) {
  return ACCOUNT_STATUS_VALUES.includes(value);
}

export function isValidRole(value) {
  return ACCOUNT_ROLE_VALUES.includes(value);
}

/** RefreshSession/SessionFamilyRevocation convention, reused: ObjectId string. */
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isValidObjectIdString(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

/**
 * §8.2 — canonical already-hashed reset-token format this module accepts:
 * a lowercase 64-character hex SHA-256 digest, matching the exact output of
 * the existing, unmodified `server/src/utils/tokenStore.js`'s
 * `hashResetToken`. This module never hashes the raw token itself.
 */
export const RESET_TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isValidResetTokenHash(value) {
  return typeof value === 'string' && RESET_TOKEN_HASH_PATTERN.test(value);
}
