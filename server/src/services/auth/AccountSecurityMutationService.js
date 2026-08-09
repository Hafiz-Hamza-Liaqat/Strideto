import bcrypt from 'bcryptjs';
import { User } from '../../models/User.js';
import { Employer } from '../../models/Employer.js';
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import {
  isKnownRealm,
  isSafeNonNegativeInteger,
  isValidObjectIdString,
  isValidAccountStatus,
  isValidRole,
  isValidResetTokenHash,
  isWellFormedTokenVersion,
  isBelowTokenVersionMaximum,
  VALID_TOKEN_VERSION_EXPR,
} from './AccountSecurityMutationContracts.js';

/**
 * Bounded tokenVersion and atomic subject-security mutation primitives.
 * Models are dependency-injected (mirrors
 * `SessionFamilyRevocationService.js`'s convention) so tests never need a
 * live MongoDB connection. Authority:
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md (§8, §14.3).
 *
 * This module performs no `RefreshSession` read or write of any kind — it
 * mutates only `User`/`Employer` subject documents. SEC-3D.1's revoke
 * primitive is never imported or called from this file.
 */

const PASSWORD_HASH_COST = 12;
const WRITE_OPTIONS = Object.freeze({ new: false, projection: { _id: 1 } });

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isStrictBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * @param {object} [config]
 * @param {object} [config.userModel] — defaults to the real `User` model.
 * @param {object} [config.employerModel] — defaults to the real `Employer` model.
 * @param {object} [config.agentModel] — defaults to the real `AgentAccount` model.
 * @param {(plain: string) => Promise<string>} [config.hashPassword] — defaults
 *   to `bcrypt.hash(plain, 12)`, injectable so tests can force a hashing
 *   failure without depending on `bcryptjs`'s real timing/behavior.
 * @param {() => Date} [config.now] — clock injection, defaults to `() => new Date()`.
 */
export function createAccountSecurityMutationService({
  userModel = User,
  employerModel = Employer,
  agentModel = AgentAccount,
  hashPassword = (plain) => bcrypt.hash(plain, PASSWORD_HASH_COST),
  now = () => new Date(),
} = {}) {
  if (
    !userModel ||
    typeof userModel.findOneAndUpdate !== 'function' ||
    typeof userModel.findById !== 'function'
  ) {
    throw new TypeError(
      'A User model with findOneAndUpdate and findById is required'
    );
  }
  if (
    !employerModel ||
    typeof employerModel.findOneAndUpdate !== 'function' ||
    typeof employerModel.findById !== 'function'
  ) {
    throw new TypeError(
      'An Employer model with findOneAndUpdate and findById is required'
    );
  }
  if (
    !agentModel ||
    typeof agentModel.findOneAndUpdate !== 'function' ||
    typeof agentModel.findById !== 'function'
  ) {
    throw new TypeError(
      'An AgentAccount model with findOneAndUpdate and findById is required'
    );
  }
  if (typeof hashPassword !== 'function') {
    throw new TypeError('A hashPassword(plain) function is required');
  }
  if (typeof now !== 'function') {
    throw new TypeError('A now() clock function is required');
  }

  const modelsByRealm = Object.freeze({
    user: userModel,
    employer: employerModel,
    agent: agentModel,
  });

  // ---------------------------------------------------------------------
  // Shared tokenVersion-only classification (§8.5.1's fixed precedence for
  // logout-all / admin-revoke / password change's own miss handling).
  // ---------------------------------------------------------------------

  /**
   * Reads exactly `{tokenVersion:1}` and classifies against `expected`.
   * Returns either `{terminal: <code>}` or `{retryEligible: true}` — never
   * both. Callers decide what "above expected" and "at expected" map to,
   * since logout-all/admin-revoke and password change diverge there.
   */
  async function readAndClassifyTokenVersion({ model, subjectId, expected }) {
    let doc;
    try {
      doc = await model.findById(subjectId, { tokenVersion: 1 });
    } catch {
      return { terminal: 'STORAGE_FAILURE' };
    }
    if (!doc) {
      return { terminal: 'SUBJECT_MISSING' };
    }
    const { tokenVersion } = doc;
    if (!isWellFormedTokenVersion(tokenVersion)) {
      return { terminal: 'SUBJECT_STATE_MALFORMED' };
    }
    if (!isBelowTokenVersionMaximum(tokenVersion)) {
      return { terminal: 'VERSION_EXHAUSTED' };
    }
    if (tokenVersion === expected) {
      return { retryEligible: true };
    }
    if (tokenVersion > expected) {
      return { terminal: 'ABOVE_EXPECTED' };
    }
    return { terminal: 'VERSION_REGRESSION' };
  }

  /** One bounded conditional write attempt; `null` on success, else a terminal result. */
  async function attemptConditionalWrite({ model, filter, update }) {
    let result;
    try {
      result = await model.findOneAndUpdate(filter, update, WRITE_OPTIONS);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    return result ? null : undefined; // undefined = "missed, no storage error"
  }

  /**
   * Bare tokenVersion-only guarded increment — the shared write shape for
   * both logout-all and admin-revoke (§8.5.1). `aboveExpectedCode` and
   * `retryEligible` diverge from the caller's own contract (never shared
   * with password change, which uses its own non-retrying path below).
   */
  async function guardedIncrement({ model, subjectId, expected }) {
    const filter = {
      _id: subjectId,
      tokenVersion: { $eq: expected },
      $expr: VALID_TOKEN_VERSION_EXPR,
    };
    const update = { $inc: { tokenVersion: 1 } };

    const writeError = await attemptConditionalWrite({ model, filter, update });
    if (writeError === null) {
      return Object.freeze({ code: 'VERSION_INCREMENTED' });
    }
    if (writeError) {
      return writeError; // STORAGE_FAILURE
    }

    const classification = await readAndClassifyTokenVersion({
      model,
      subjectId,
      expected,
    });
    if (classification.terminal === 'ABOVE_EXPECTED') {
      return Object.freeze({ code: 'VERSION_ALREADY_ADVANCED' });
    }
    if (classification.terminal) {
      return Object.freeze({ code: classification.terminal });
    }

    // retryEligible: exactly one bounded retry, same filter/update.
    const retryError = await attemptConditionalWrite({ model, filter, update });
    if (retryError === null) {
      return Object.freeze({ code: 'VERSION_INCREMENTED' });
    }
    if (retryError) {
      return retryError; // STORAGE_FAILURE
    }
    return Object.freeze({ code: 'CLASSIFICATION_STALE' });
  }

  // ---------------------------------------------------------------------
  // Logout-all — caller-held expectedTokenVersion (§8.5).
  // ---------------------------------------------------------------------
  async function incrementTokenVersionForLogoutAll({
    realm,
    subjectId,
    expectedTokenVersion,
  }) {
    if (!isKnownRealm(realm)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidObjectIdString(subjectId))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isSafeNonNegativeInteger(expectedTokenVersion))
      return Object.freeze({ code: 'INVALID_INPUT' });

    const model = modelsByRealm[realm];
    return guardedIncrement({
      model,
      subjectId,
      expected: expectedTokenVersion,
    });
  }

  // ---------------------------------------------------------------------
  // Admin revoke — service-owned fresh preread every invocation (§8.5).
  // ---------------------------------------------------------------------
  async function incrementTokenVersionForAdminRevoke({ realm, subjectId }) {
    if (!isKnownRealm(realm)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidObjectIdString(subjectId))
      return Object.freeze({ code: 'INVALID_INPUT' });

    const model = modelsByRealm[realm];

    let doc;
    try {
      doc = await model.findById(subjectId, { tokenVersion: 1 });
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (!doc) {
      return Object.freeze({ code: 'SUBJECT_MISSING' });
    }
    const { tokenVersion } = doc;
    if (!isWellFormedTokenVersion(tokenVersion)) {
      return Object.freeze({ code: 'SUBJECT_STATE_MALFORMED' });
    }
    if (!isBelowTokenVersionMaximum(tokenVersion)) {
      return Object.freeze({ code: 'VERSION_EXHAUSTED' });
    }

    return guardedIncrement({ model, subjectId, expected: tokenVersion });
  }

  // ---------------------------------------------------------------------
  // Admin temporary-password reset — one atomic User write.
  // ---------------------------------------------------------------------
  async function adminResetUserPassword({
    subjectId,
    newPassword,
    tempPasswordExpires,
  }) {
    if (!isValidObjectIdString(subjectId)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isNonEmptyString(newPassword) || !isValidDate(tempPasswordExpires)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    const nowValue = now();
    if (!isValidDate(nowValue) || tempPasswordExpires <= nowValue) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    let newHash;
    try {
      newHash = await hashPassword(newPassword);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (!isNonEmptyString(newHash)) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    const writeError = await attemptConditionalWrite({
      model: userModel,
      filter: { _id: subjectId, $expr: VALID_TOKEN_VERSION_EXPR },
      update: {
        $set: {
          password: newHash,
          mustChangePassword: true,
          tempPasswordExpires,
        },
        $inc: { tokenVersion: 1 },
      },
    });
    if (writeError === null) {
      return Object.freeze({ code: 'VERSION_INCREMENTED' });
    }
    if (writeError) {
      return writeError;
    }

    let doc;
    try {
      doc = await userModel.findById(subjectId, { tokenVersion: 1 });
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (!doc) return Object.freeze({ code: 'SUBJECT_MISSING' });
    if (!isWellFormedTokenVersion(doc.tokenVersion)) {
      return Object.freeze({ code: 'SUBJECT_STATE_MALFORMED' });
    }
    if (!isBelowTokenVersionMaximum(doc.tokenVersion)) {
      return Object.freeze({ code: 'VERSION_EXHAUSTED' });
    }
    return Object.freeze({ code: 'CLASSIFICATION_STALE' });
  }

  // ---------------------------------------------------------------------
  // Password change — realm-bound, zero automatic retries (§8.2).
  // ---------------------------------------------------------------------
  async function changePassword({
    realm = 'user',
    subjectId,
    expectedTokenVersion,
    newPassword,
  }) {
    if (!isKnownRealm(realm)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidObjectIdString(subjectId))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isSafeNonNegativeInteger(expectedTokenVersion))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isNonEmptyString(newPassword))
      return Object.freeze({ code: 'INVALID_INPUT' });

    let newHash;
    try {
      newHash = await hashPassword(newPassword);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (!isNonEmptyString(newHash)) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    const filter = {
      _id: subjectId,
      tokenVersion: { $eq: expectedTokenVersion },
      $expr: VALID_TOKEN_VERSION_EXPR,
    };
    const update = { $set: { password: newHash }, $inc: { tokenVersion: 1 } };

    const model = modelsByRealm[realm];
    const writeError = await attemptConditionalWrite({
      model,
      filter,
      update,
    });
    if (writeError === null) {
      return Object.freeze({ code: 'VERSION_INCREMENTED' });
    }
    if (writeError) {
      return writeError; // STORAGE_FAILURE
    }

    // Exactly one classification read, never retried, never for this operation.
    const classification = await readAndClassifyTokenVersion({
      model,
      subjectId,
      expected: expectedTokenVersion,
    });
    if (classification.terminal === 'ABOVE_EXPECTED') {
      return Object.freeze({ code: 'VERSION_CONFLICT' });
    }
    if (classification.retryEligible) {
      // current == expected after the miss — still no proof this write's
      // password landed; unrelated advancement cannot be inferred either.
      return Object.freeze({ code: 'VERSION_CONFLICT' });
    }
    return Object.freeze({ code: classification.terminal });
  }

  // ---------------------------------------------------------------------
  // Password reset — realm-bound, Design 1 (§8.2): 1 write, 0 reads, 0 retries.
  // ---------------------------------------------------------------------
  async function resetPassword({ realm = 'user', hashedToken, newPassword }) {
    if (!isKnownRealm(realm)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidResetTokenHash(hashedToken))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isNonEmptyString(newPassword))
      return Object.freeze({ code: 'INVALID_INPUT' });

    const nowValue = now();
    if (!isValidDate(nowValue)) return Object.freeze({ code: 'INVALID_INPUT' });

    let newHash;
    try {
      newHash = await hashPassword(newPassword);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (!isNonEmptyString(newHash)) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    const filter = {
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: nowValue },
      $expr: VALID_TOKEN_VERSION_EXPR,
    };
    const update = {
      $set: { password: newHash },
      $unset: { passwordResetToken: '', passwordResetExpires: '' },
      $inc: { tokenVersion: 1 },
    };
    if (realm === 'user') {
      update.$set.mustChangePassword = false;
      update.$unset.tempPasswordExpires = '';
    }

    const writeError = await attemptConditionalWrite({
      model: modelsByRealm[realm],
      filter,
      update,
    });
    if (writeError === null) {
      return Object.freeze({ code: 'VERSION_INCREMENTED' });
    }
    if (writeError) {
      return writeError; // STORAGE_FAILURE
    }
    return Object.freeze({ code: 'RESET_TOKEN_INVALID' });
  }

  // ---------------------------------------------------------------------
  // State operations — suspend / reactivate (two modes) / role change (§8.3).
  // ---------------------------------------------------------------------

  /**
   * Shared state-field classification, fixed precedence (§8.3):
   * subject missing -> tokenVersion malformed (if relevant) -> exhausted
   * (if relevant) -> field outside its enum -> already at target ->
   * retry-eligible (still at expected prior) -> conflict.
   */
  async function readAndClassifyState({
    model,
    subjectId,
    fieldName,
    expectedPriorValue,
    targetValue,
    isValidValue,
    tokenVersionRelevant,
  }) {
    const projection = tokenVersionRelevant
      ? { [fieldName]: 1, tokenVersion: 1 }
      : { [fieldName]: 1 };
    let doc;
    try {
      doc = await model.findById(subjectId, projection);
    } catch {
      return { terminal: 'STORAGE_FAILURE' };
    }
    if (!doc) {
      return { terminal: 'SUBJECT_MISSING' };
    }
    if (tokenVersionRelevant) {
      const { tokenVersion } = doc;
      if (!isWellFormedTokenVersion(tokenVersion)) {
        return { terminal: 'SUBJECT_STATE_MALFORMED' };
      }
      if (!isBelowTokenVersionMaximum(tokenVersion)) {
        return { terminal: 'VERSION_EXHAUSTED' };
      }
    }
    const fieldValue = doc[fieldName];
    if (!isValidValue(fieldValue)) {
      return { terminal: 'SUBJECT_STATE_INVALID' };
    }
    if (fieldValue === targetValue) {
      return { terminal: 'SUBJECT_STATE_ALREADY_APPLIED' };
    }
    if (fieldValue === expectedPriorValue) {
      return { retryEligible: true };
    }
    return { terminal: 'SUBJECT_STATE_CONFLICT' };
  }

  /** Shared state-write + classify + one bounded retry, Policy B (§8.5.1). */
  async function performStateMutation({
    model,
    subjectId,
    filter,
    update,
    fieldName,
    expectedPriorValue,
    targetValue,
    isValidValue,
    tokenVersionRelevant,
  }) {
    const writeError = await attemptConditionalWrite({ model, filter, update });
    if (writeError === null) {
      return Object.freeze({ code: 'SUBJECT_STATE_UPDATED' });
    }
    if (writeError) {
      return writeError; // STORAGE_FAILURE
    }

    const classification = await readAndClassifyState({
      model,
      subjectId,
      fieldName,
      expectedPriorValue,
      targetValue,
      isValidValue,
      tokenVersionRelevant,
    });
    if (classification.terminal) {
      return Object.freeze({ code: classification.terminal });
    }

    // retryEligible: exactly one bounded retry, same filter/update.
    const retryError = await attemptConditionalWrite({ model, filter, update });
    if (retryError === null) {
      return Object.freeze({ code: 'SUBJECT_STATE_UPDATED' });
    }
    if (retryError) {
      return retryError; // STORAGE_FAILURE
    }
    return Object.freeze({ code: 'CLASSIFICATION_STALE' });
  }

  async function suspend({ realm, subjectId }) {
    if (!isKnownRealm(realm)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidObjectIdString(subjectId))
      return Object.freeze({ code: 'INVALID_INPUT' });

    const model = modelsByRealm[realm];
    const filter = {
      _id: subjectId,
      accountStatus: 'active',
      $expr: VALID_TOKEN_VERSION_EXPR,
    };
    const update = {
      $set: { accountStatus: 'suspended' },
      $inc: { tokenVersion: 1 },
    };

    return performStateMutation({
      model,
      subjectId,
      filter,
      update,
      fieldName: 'accountStatus',
      expectedPriorValue: 'active',
      targetValue: 'suspended',
      isValidValue: isValidAccountStatus,
      tokenVersionRelevant: true,
    });
  }

  /** §5.1 — one method, one caller-supplied boolean selects the mode. */
  async function reactivate({
    realm,
    subjectId,
    alsoInvalidateAccessTokens = false,
  }) {
    if (!isKnownRealm(realm)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidObjectIdString(subjectId))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isStrictBoolean(alsoInvalidateAccessTokens))
      return Object.freeze({ code: 'INVALID_INPUT' });

    const model = modelsByRealm[realm];

    if (!alsoInvalidateAccessTokens) {
      // Mode A — tokenVersion is never read, guarded, classified, or mutated.
      const filter = { _id: subjectId, accountStatus: 'suspended' };
      const update = { $set: { accountStatus: 'active' } };
      return performStateMutation({
        model,
        subjectId,
        filter,
        update,
        fieldName: 'accountStatus',
        expectedPriorValue: 'suspended',
        targetValue: 'active',
        isValidValue: isValidAccountStatus,
        tokenVersionRelevant: false,
      });
    }

    // Mode B — identical shape to suspend, targeting 'active'.
    const filter = {
      _id: subjectId,
      accountStatus: 'suspended',
      $expr: VALID_TOKEN_VERSION_EXPR,
    };
    const update = {
      $set: { accountStatus: 'active' },
      $inc: { tokenVersion: 1 },
    };
    return performStateMutation({
      model,
      subjectId,
      filter,
      update,
      fieldName: 'accountStatus',
      expectedPriorValue: 'suspended',
      targetValue: 'active',
      isValidValue: isValidAccountStatus,
      tokenVersionRelevant: true,
    });
  }

  async function changeRole({ subjectId, expectedPriorRole, newRole }) {
    if (!isValidObjectIdString(subjectId))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidRole(expectedPriorRole))
      return Object.freeze({ code: 'INVALID_INPUT' });
    if (!isValidRole(newRole)) return Object.freeze({ code: 'INVALID_INPUT' });
    if (expectedPriorRole === newRole)
      return Object.freeze({ code: 'INVALID_INPUT' });

    const filter = {
      _id: subjectId,
      role: expectedPriorRole,
      $expr: VALID_TOKEN_VERSION_EXPR,
    };
    const update = { $set: { role: newRole }, $inc: { tokenVersion: 1 } };

    return performStateMutation({
      model: userModel,
      subjectId,
      filter,
      update,
      fieldName: 'role',
      expectedPriorValue: expectedPriorRole,
      targetValue: newRole,
      isValidValue: isValidRole,
      tokenVersionRelevant: true,
    });
  }

  return Object.freeze({
    incrementTokenVersionForLogoutAll,
    incrementTokenVersionForAdminRevoke,
    adminResetUserPassword,
    changePassword,
    resetPassword,
    suspend,
    reactivate,
    changeRole,
  });
}
