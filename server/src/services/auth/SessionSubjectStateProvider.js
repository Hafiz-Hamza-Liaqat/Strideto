import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { isKnownRealm } from './AuthSessionPrimitiveContracts.js';

/**
 * SEC-3C — dormant, authoritative subject-state provider implementing the
 * §24 "Option A" baseline: a direct, minimal-projection MongoDB read on
 * every call, no cache, no Redis, no process-local fallback, zero
 * staleness by construction. Not imported by any live route, controller,
 * or middleware. Performs no writes. Authority:
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md §24.
 *
 * The models are dependency-injected (default to the real `User`/
 * `Employer` Mongoose models, mirroring SEC-3B's
 * `RefreshSessionRotationService` convention) so tests never need a live
 * database connection — importing a compiled Mongoose model does not
 * connect to MongoDB.
 */

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Repository truth (server/src/models/User.js, server/src/models/Employer.js):
 * `accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' }`
 * for both models — there is no `deleted`/other status in the current
 * schema. Any value outside this exact set (including a hypothetical
 * future `deleted` status not yet reflected here) is treated as
 * SUBJECT_STATE_INVALID and fails closed, never as active.
 */
const KNOWN_ACCOUNT_STATUSES = Object.freeze({
  active: 'active',
  inactive: 'suspended',
});

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isValidSubjectId(value) {
  return isNonEmptyString(value) && OBJECT_ID_PATTERN.test(value);
}

function isValidTokenVersion(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Returns a frozen INVALID_INPUT result, or `null` when input is valid. */
function validateInput({ realm, subjectId, expectedTokenVersion }) {
  if (!isKnownRealm(realm)) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  if (!isValidSubjectId(subjectId)) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  if (
    expectedTokenVersion !== undefined &&
    !isValidTokenVersion(expectedTokenVersion)
  ) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  return null;
}

/**
 * @param {object} [config]
 * @param {object} [config.userModel] — defaults to the real `User` model
 * @param {object} [config.employerModel] — defaults to the real `Employer` model
 */
export function createSessionSubjectStateProvider({
  userModel = User,
  employerModel = Employer,
} = {}) {
  if (!userModel || typeof userModel.findById !== 'function') {
    throw new TypeError('A User model with findById is required');
  }
  if (!employerModel || typeof employerModel.findById !== 'function') {
    throw new TypeError('An Employer model with findById is required');
  }

  const modelsByRealm = { user: userModel, employer: employerModel };

  /**
   * Exactly one authoritative read per call — no cache, no Redis, no
   * process-local fallback, no retry, no second read. §24's exact
   * projection shape: only `tokenVersion` and `accountStatus`.
   */
  async function getSubjectState({ realm, subjectId, expectedTokenVersion }) {
    const inputError = validateInput({
      realm,
      subjectId,
      expectedTokenVersion,
    });
    if (inputError) {
      return inputError;
    }

    const model = modelsByRealm[realm];
    let doc;
    try {
      doc = await model.findById(subjectId, {
        tokenVersion: 1,
        accountStatus: 1,
      });
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    if (!doc) {
      return Object.freeze({ code: 'SUBJECT_MISSING' });
    }

    const { accountStatus, tokenVersion } = doc;

    if (accountStatus === KNOWN_ACCOUNT_STATUSES.inactive) {
      return Object.freeze({ code: 'SUBJECT_INACTIVE' });
    }
    if (accountStatus !== KNOWN_ACCOUNT_STATUSES.active) {
      // Unknown/malformed status — never treated as active.
      return Object.freeze({ code: 'SUBJECT_STATE_INVALID' });
    }
    if (!isValidTokenVersion(tokenVersion)) {
      return Object.freeze({ code: 'SUBJECT_STATE_INVALID' });
    }

    if (
      expectedTokenVersion !== undefined &&
      tokenVersion !== expectedTokenVersion
    ) {
      return Object.freeze({ code: 'TOKEN_VERSION_MISMATCH' });
    }

    return Object.freeze({ code: 'SUBJECT_ACTIVE', tokenVersion });
  }

  return Object.freeze({ getSubjectState });
}
