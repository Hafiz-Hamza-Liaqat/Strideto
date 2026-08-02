import { RefreshSession } from '../../models/RefreshSession.js';
import {
  REFRESH_SESSION_CONCURRENCY_WINDOW_MS,
  REFRESH_SESSION_DEFAULT_TTL_MS,
} from './RefreshSessionContracts.js';

/**
 * Canonical rotation service implementing the exact one-successor
 * CAS contract from
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md §22.
 * The model is dependency-injected (mirrors
 * services/publishing/outbox/MongoosePublishingOutboxRepository.js) so
 * tests never need a live MongoDB connection.
 *
 * Every returned result is a frozen `{ code }` object only — no token,
 * hash, subject ID, `sid`, or `jti` is ever echoed back, on any branch.
 *
 * SEC-3B.1 correction: added call-time input validation, fixed a
 * negative-elapsed-time misclassification in the benign-conflict window
 * check, and replaced the replay-revocation write (previously an
 * unconditional `{ _id, revokedAt: null }` filter, a stale-read race) with
 * a revoke CAS conditioned on the exact state that was classified.
 */
export function createRefreshSessionRotationService({
  model = RefreshSession,
  clock = () => new Date(),
  concurrencyWindowMs = REFRESH_SESSION_CONCURRENCY_WINDOW_MS,
} = {}) {
  if (
    !model ||
    typeof model.create !== 'function' ||
    typeof model.findOneAndUpdate !== 'function' ||
    typeof model.findById !== 'function'
  ) {
    throw new TypeError('A RefreshSession model is required');
  }
  if (typeof clock !== 'function') {
    throw new TypeError('A clock function is required');
  }
  if (!Number.isInteger(concurrencyWindowMs) || concurrencyWindowMs <= 0) {
    throw new TypeError(
      'concurrencyWindowMs must be a positive finite integer'
    );
  }

  /**
   * Build a new session-family record from safe identifiers and an
   * already-computed refresh-token hash (see refreshTokenHash.js). Returns
   * the new session's `_id` — this is not a leak, it is the sid the caller
   * must embed in the tokens it issues.
   */
  async function createSession({
    subjectType,
    subjectId,
    currentTokenHash,
    tokenVersionAtIssue,
    ttlMs = REFRESH_SESSION_DEFAULT_TTL_MS,
  }) {
    const now = clock();
    if (!isValidDate(now)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isNonEmptyString(currentTokenHash)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!Number.isInteger(tokenVersionAtIssue) || tokenVersionAtIssue < 0) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    let doc;
    try {
      doc = await model.create({
        subjectType,
        subjectId,
        currentTokenHash,
        tokenVersionAtIssue,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
      });
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    return Object.freeze({ code: 'CREATED', sid: String(doc._id) });
  }

  /**
   * Attempt one atomic CAS rotation. `sid` identifies the session family;
   * `presentedTokenHash` is the hash of the refresh token the caller
   * presented; `newTokenHash` is the hash of the token to install as the
   * new current hash on success; `expectedTokenVersionAtIssue`, when
   * supplied, is folded into the same atomic filter so a stale session
   * (predating a tokenVersion bump) cannot win the CAS.
   */
  async function rotate({
    sid,
    presentedTokenHash,
    newTokenHash,
    expectedTokenVersionAtIssue,
  }) {
    const inputError = validateRotateInput({
      sid,
      presentedTokenHash,
      newTokenHash,
      expectedTokenVersionAtIssue,
    });
    if (inputError) {
      return inputError;
    }

    const now = clock();
    if (!isValidDate(now)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    const filter = {
      _id: sid,
      currentTokenHash: presentedTokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    };
    if (expectedTokenVersionAtIssue !== undefined) {
      filter.tokenVersionAtIssue = expectedTokenVersionAtIssue;
    }

    let won;
    try {
      won = await model.findOneAndUpdate(
        filter,
        [
          {
            $set: {
              previousTokenHash: '$currentTokenHash',
              previousTokenRotatedAt: now,
              currentTokenHash: newTokenHash,
              lastUsedAt: now,
            },
          },
        ],
        { new: true }
      );
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    if (won) {
      return Object.freeze({ code: 'ROTATED' });
    }

    return classifyMiss({
      model,
      sid,
      presentedTokenHash,
      expectedTokenVersionAtIssue,
      now,
      concurrencyWindowMs,
    });
  }

  return Object.freeze({ createSession, rotate });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/** Returns a frozen INVALID_INPUT result, or `null` when input is valid. */
function validateRotateInput({
  sid,
  presentedTokenHash,
  newTokenHash,
  expectedTokenVersionAtIssue,
}) {
  if (!isNonEmptyString(sid)) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  if (!isNonEmptyString(presentedTokenHash)) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  if (!isNonEmptyString(newTokenHash)) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  if (presentedTokenHash === newTokenHash) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  if (
    expectedTokenVersionAtIssue !== undefined &&
    (!Number.isInteger(expectedTokenVersionAtIssue) ||
      expectedTokenVersionAtIssue < 0)
  ) {
    return Object.freeze({ code: 'INVALID_INPUT' });
  }
  return null;
}

/**
 * Elapsed time is only "benign" when it is a finite, non-negative number
 * within the concurrency window. A negative value (the observed
 * `previousTokenRotatedAt` is after `now` — clock skew or a malformed
 * timestamp) or a non-finite value is never benign, regardless of its
 * magnitude relative to the window.
 */
function isBenignElapsed(elapsedMs, concurrencyWindowMs) {
  return (
    Number.isFinite(elapsedMs) &&
    elapsedMs >= 0 &&
    elapsedMs <= concurrencyWindowMs
  );
}

/**
 * Classify a snapshot of the session document as benign-conflict or
 * replay. Pure function of the snapshot — used both for the initial
 * classification and, after a lost guarded revoke, to determine whether a
 * clear terminal state now applies.
 */
function classifySnapshot({
  doc,
  presentedTokenHash,
  expectedTokenVersionAtIssue,
  now,
  concurrencyWindowMs,
}) {
  if (!doc) {
    return 'SESSION_MISSING';
  }
  if (doc.revokedAt) {
    return 'SESSION_REVOKED';
  }
  if (!isValidDate(doc.expiresAt) || doc.expiresAt.getTime() <= now.getTime()) {
    return 'SESSION_EXPIRED';
  }
  if (
    expectedTokenVersionAtIssue !== undefined &&
    doc.tokenVersionAtIssue !== expectedTokenVersionAtIssue
  ) {
    return 'VERSION_MISMATCH';
  }

  const isPreviousToken = doc.previousTokenHash === presentedTokenHash;
  const elapsedMs = isValidDate(doc.previousTokenRotatedAt)
    ? now.getTime() - doc.previousTokenRotatedAt.getTime()
    : NaN;

  if (isPreviousToken && isBenignElapsed(elapsedMs, concurrencyWindowMs)) {
    return 'CONFLICT_BENIGN';
  }
  return 'REPLAY_DETECTED';
}

async function classifyMiss({
  model,
  sid,
  presentedTokenHash,
  expectedTokenVersionAtIssue,
  now,
  concurrencyWindowMs,
}) {
  let doc;
  try {
    doc = await model.findById(sid);
  } catch {
    return Object.freeze({ code: 'STORAGE_FAILURE' });
  }

  const classification = classifySnapshot({
    doc,
    presentedTokenHash,
    expectedTokenVersionAtIssue,
    now,
    concurrencyWindowMs,
  });

  if (classification !== 'REPLAY_DETECTED') {
    return Object.freeze({ code: classification });
  }

  // Replay: revoke this one document, but only via a CAS conditioned on
  // the exact state just classified — never an unconditional
  // `{ _id, revokedAt: null }` write. If the document has changed since
  // the read above (most plausibly because a legitimate concurrent
  // rotation completed in between), this filter simply will not match,
  // and the family is deliberately left unrevoked.
  const revokeFilter = {
    _id: sid,
    revokedAt: null,
    currentTokenHash: doc.currentTokenHash,
    previousTokenHash: doc.previousTokenHash,
    previousTokenRotatedAt: doc.previousTokenRotatedAt,
    tokenVersionAtIssue: doc.tokenVersionAtIssue,
  };

  let revoked;
  try {
    revoked = await model.findOneAndUpdate(revokeFilter, {
      $set: { revokedAt: now, revokeReason: 'replay_detected' },
    });
  } catch {
    return Object.freeze({ code: 'STORAGE_FAILURE' });
  }

  if (revoked) {
    return Object.freeze({ code: 'REPLAY_DETECTED' });
  }

  // The guarded revoke lost the race — the snapshot we classified against
  // is stale. Perform exactly one bounded re-read to check for a clear,
  // safe terminal state; never retry the revoke itself, and never fall
  // back to an unconditional write.
  let reread;
  try {
    reread = await model.findById(sid);
  } catch {
    return Object.freeze({ code: 'STORAGE_FAILURE' });
  }

  if (!reread) {
    return Object.freeze({ code: 'SESSION_MISSING' });
  }
  if (reread.revokedAt) {
    return Object.freeze({ code: 'SESSION_REVOKED' });
  }
  if (
    !isValidDate(reread.expiresAt) ||
    reread.expiresAt.getTime() <= now.getTime()
  ) {
    return Object.freeze({ code: 'SESSION_EXPIRED' });
  }
  // Present, not revoked, not expired — the state changed underneath the
  // classification (the signature of a legitimate intervening rotation).
  // Not a safely determinable terminal state: report it as such rather
  // than guessing, and issue no successor and no revocation.
  return Object.freeze({ code: 'CLASSIFICATION_STALE' });
}
