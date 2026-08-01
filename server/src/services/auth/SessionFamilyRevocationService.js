import {
  isKnownRealm,
  isSingleFamilyRevokeReason,
  isAllFamilyRevokeReason,
  isValidObjectIdString,
} from './SessionFamilyRevocationContracts.js';

/**
 * SEC-3D.1 — dormant session-family revocation service. Not imported by
 * any live route, controller, or middleware. The model is
 * dependency-injected (mirrors `RefreshSessionRotationService.js`'s
 * convention) so tests never need a live MongoDB connection. Authority:
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md (§9, §10).
 *
 * This module performs no `tokenVersion` mutation, no JWT verification,
 * no token hashing, and accepts no plaintext access/refresh token — it
 * only ever reads/writes `RefreshSession` documents by `_id`,
 * `subjectType`, `subjectId`, and `revokedAt`/`revokeReason`.
 */

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * SEC-3D.1.1 — mandatory safe-integer validation for driver-reported
 * counts. `Number.isInteger` alone accepts values beyond
 * `Number.MAX_SAFE_INTEGER` that have already lost floating-point
 * precision; `Number.isSafeInteger` is the correct guard for a count that
 * must be trusted as exact. Also rejects `NaN` and `±Infinity`, both of
 * which `Number.isInteger` already rejects, restated here as one single
 * source of truth for every count field this service validates.
 */
function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * @param {object} config
 * @param {object} config.refreshSessionModel — a model exposing
 *   `findOneAndUpdate`, `findById`, and `updateMany`; defaults to none —
 *   the caller must inject one (real or a test double).
 * @param {() => Date} [config.now] — clock injection, defaults to
 *   `() => new Date()`.
 */
export function createSessionFamilyRevocationService({
  refreshSessionModel,
  now = () => new Date(),
} = {}) {
  if (
    !refreshSessionModel ||
    typeof refreshSessionModel.findOneAndUpdate !== 'function' ||
    typeof refreshSessionModel.findById !== 'function' ||
    typeof refreshSessionModel.updateMany !== 'function'
  ) {
    throw new TypeError(
      'A RefreshSession model with findOneAndUpdate, findById, and updateMany is required'
    );
  }
  if (typeof now !== 'function') {
    throw new TypeError('A now() clock function is required');
  }

  /**
   * Read at most one document, using the minimum projection needed to
   * distinguish every miss outcome. Subject binding is checked first, on
   * purpose — a mismatched subject must resolve identically regardless of
   * the target family's actual revoked/expired state, so an attacker
   * probing a family that isn't theirs never learns anything about it
   * (§6's classification-ordering requirement).
   */
  async function classifyMiss({ sessionFamilyId, realm, subjectId, nowValue }) {
    let doc;
    try {
      doc = await refreshSessionModel.findById(sessionFamilyId, {
        subjectType: 1,
        subjectId: 1,
        revokedAt: 1,
        expiresAt: 1,
      });
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    if (!doc) {
      return Object.freeze({ code: 'SESSION_MISSING' });
    }
    if (
      doc.subjectType !== realm ||
      String(doc.subjectId) !== String(subjectId)
    ) {
      return Object.freeze({ code: 'SESSION_SUBJECT_MISMATCH' });
    }
    if (doc.revokedAt) {
      return Object.freeze({ code: 'SESSION_ALREADY_REVOKED' });
    }
    if (
      !isValidDate(doc.expiresAt) ||
      doc.expiresAt.getTime() <= nowValue.getTime()
    ) {
      return Object.freeze({ code: 'SESSION_EXPIRED' });
    }
    // Subject matches, not revoked, not expired — the primary update's
    // own filter should have matched this exact state; it didn't, so the
    // state changed between the two reads (a genuine concurrent race).
    // Never falls back to an unconditional write from here.
    return Object.freeze({ code: 'CLASSIFICATION_STALE' });
  }

  /**
   * Revoke exactly one session family. Never revokes using the family
   * identifier alone — `subjectType`/`subjectId` are always bound in the
   * same conditional filter as the identifier, so an attacker who does
   * not also know the correct subject can never revoke a family that
   * isn't theirs.
   */
  async function revokeCurrentFamily({
    realm,
    subjectId,
    sessionFamilyId,
    reason,
  }) {
    if (!isKnownRealm(realm)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isValidObjectIdString(subjectId)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isValidObjectIdString(sessionFamilyId)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isSingleFamilyRevokeReason(reason)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    const nowValue = now();
    if (!isValidDate(nowValue)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    let updated;
    try {
      updated = await refreshSessionModel.findOneAndUpdate(
        {
          _id: sessionFamilyId,
          subjectType: realm,
          subjectId,
          revokedAt: null,
          expiresAt: { $gt: nowValue },
        },
        { $set: { revokedAt: nowValue, revokeReason: reason } }
      );
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    if (updated) {
      return Object.freeze({ code: 'REVOKED_CURRENT_FAMILY' });
    }

    // Zero documents modified — classify why, via at most one bounded
    // read. Never retried, never followed by an unconditional write.
    return classifyMiss({ sessionFamilyId, realm, subjectId, nowValue });
  }

  /**
   * Best-effort bulk revocation of every active family for one subject.
   * Historical already-revoked families (any reason) are never touched —
   * the `revokedAt: null` filter clause guarantees this by construction.
   * Chosen expired-session policy (§10, explicitly not mandated by the
   * accepted audit): every currently-unrevoked family is included in the
   * sweep, regardless of `expiresAt` — a simpler, single-condition filter
   * that treats "not yet revoked" as the only precondition for a full
   * cleanup pass, consistent with §21's "revoke everything for this
   * subject" semantics. An already-expired family that also gets marked
   * revoked here is harmless: it was already unusable, and this only
   * keeps `revokeReason` audit-accurate.
   */
  async function revokeAllFamilies({ realm, subjectId, reason }) {
    if (!isKnownRealm(realm)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isValidObjectIdString(subjectId)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isAllFamilyRevokeReason(reason)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    const nowValue = now();
    if (!isValidDate(nowValue)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    let result;
    try {
      result = await refreshSessionModel.updateMany(
        { subjectType: realm, subjectId, revokedAt: null },
        { $set: { revokedAt: nowValue, revokeReason: reason } }
      );
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    if (!result || typeof result !== 'object' || result.acknowledged !== true) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    const { matchedCount, modifiedCount } = result;
    // Mongoose 8.23.0's real updateMany result always includes both
    // counts (installed-version-confirmed) — both are required, not
    // optional, and both must be safe, non-negative integers.
    if (
      !isSafeNonNegativeInteger(modifiedCount) ||
      !isSafeNonNegativeInteger(matchedCount)
    ) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (modifiedCount > matchedCount) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    // SEC-3D.1.1 — deterministic classification, exactly:
    //   modifiedCount === matchedCount && modifiedCount > 0 -> full success
    //   modifiedCount === 0                                 -> idempotent success (unchanged)
    //   matchedCount > modifiedCount && modifiedCount > 0    -> partial (same-call, driver-observable)
    if (modifiedCount === 0) {
      return Object.freeze({ code: 'REVOKED_ALL_FAMILIES', revokedCount: 0 });
    }
    if (modifiedCount === matchedCount) {
      return Object.freeze({
        code: 'REVOKED_ALL_FAMILIES',
        revokedCount: modifiedCount,
      });
    }
    // matchedCount > modifiedCount > 0 — a genuine, same-call partial
    // cleanup: some matched families were not actually modified. Reported
    // distinctly rather than folded into an undifferentiated success, so
    // a future caller can distinguish "everything matched was revoked"
    // from "only some of it was." No reconciliation read, no second
    // mutation, no retry, no broadened filter — the caller decides.
    return Object.freeze({
      code: 'REVOCATION_PARTIAL',
      revokedCount: modifiedCount,
    });
  }

  return Object.freeze({ revokeCurrentFamily, revokeAllFamilies });
}
