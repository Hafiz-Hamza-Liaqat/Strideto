import mongoose from 'mongoose';
import { RefreshSession } from '../../models/RefreshSession.js';
import { hashRefreshToken } from './refreshTokenHash.js';
import { REFRESH_SESSION_DEFAULT_TTL_MS } from './RefreshSessionContracts.js';
import {
  isKnownRealm,
  isValidObjectIdString,
} from './AccountSecurityMutationContracts.js';

/**
 * SEC-3E — secure initial login-session issuance. Not part of the dormant
 * SEC-3B/3C/3D foundation itself; this is the new composition-layer piece
 * those phases explicitly left for the live cutover (SEC-3B report §10:
 * "SEC-3D.3... does not eliminate... SEC-3E owns the live composition").
 *
 * `RefreshSessionRotationService.createSession()` is deliberately not used
 * here — it lets MongoDB generate `_id` and only returns it after the
 * document already exists, but the `sid` must be embedded in both tokens
 * *before* the tokens exist, and the tokens must exist before the document
 * can store their hash. The `_id` is therefore generated locally (an
 * ordinary, valid `ObjectId`, not a security-sensitive value — MongoDB
 * accepts a caller-supplied `_id` on `create()` identically to a
 * server-generated one) and used as the stable `sid` from the very first
 * step.
 */

function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * @param {object} config
 * @param {object} config.jwtProvider — required, realm-specific
 *   `JwtSessionProvider` instance (no safe default — carries signing
 *   secrets); must expose `issueRefreshToken`/`issueAccessToken`.
 * @param {object} [config.refreshSessionModel] — defaults to the real
 *   `RefreshSession` model.
 * @param {(token: string) => string} [config.hashToken] — defaults to
 *   `hashRefreshToken`.
 * @param {() => Date} [config.now] — clock injection.
 * @param {number} [config.ttlMs] — session lifetime, defaults to the
 *   accepted 7-day `REFRESH_SESSION_DEFAULT_TTL_MS`.
 * @param {() => object} [config.generateId] — defaults to
 *   `() => new mongoose.Types.ObjectId()`, injectable for deterministic
 *   tests.
 */
export function createInitialSessionIssuanceService({
  jwtProvider,
  refreshSessionModel = RefreshSession,
  hashToken = hashRefreshToken,
  now = () => new Date(),
  ttlMs = REFRESH_SESSION_DEFAULT_TTL_MS,
  generateId = () => new mongoose.Types.ObjectId(),
} = {}) {
  if (
    !jwtProvider ||
    typeof jwtProvider.issueRefreshToken !== 'function' ||
    typeof jwtProvider.issueAccessToken !== 'function'
  ) {
    throw new TypeError(
      'A jwtProvider exposing issueRefreshToken and issueAccessToken is required'
    );
  }
  if (
    !refreshSessionModel ||
    typeof refreshSessionModel.create !== 'function'
  ) {
    throw new TypeError('A RefreshSession model with create is required');
  }
  if (typeof hashToken !== 'function') {
    throw new TypeError('A hashToken(token) function is required');
  }
  if (typeof now !== 'function') {
    throw new TypeError('A now() clock function is required');
  }
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new TypeError('ttlMs must be a positive finite integer');
  }
  if (typeof generateId !== 'function') {
    throw new TypeError('A generateId() function is required');
  }

  /**
   * Issue a brand-new session for a just-authenticated subject (login,
   * and registration only when registration itself authenticates).
   * `subjectId`/`tokenVersion` must come from an authoritative, freshly
   * loaded subject document — never client input. Fails closed: on any
   * error, no token is returned and no partial document is left behind
   * (the only write is the single `create()` call; a failure there could
   * never have written anything, since Mongo `create()` is a single-
   * document, single-shot insert).
   */
  async function issueInitialSession({ realm, subjectId, tokenVersion }) {
    if (!isKnownRealm(realm)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isValidObjectIdString(String(subjectId || ''))) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!isSafeNonNegativeInteger(tokenVersion)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    const nowValue = now();
    if (!isValidDate(nowValue)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    const sid = String(generateId());

    let refreshToken;
    let accessToken;
    try {
      refreshToken = jwtProvider.issueRefreshToken({
        sub: String(subjectId),
        realm,
        sid,
        tokenVersion,
      }).token;
      accessToken = jwtProvider.issueAccessToken({
        sub: String(subjectId),
        realm,
        sid,
        tokenVersion,
      }).token;
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    let currentTokenHash;
    try {
      currentTokenHash = hashToken(refreshToken);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    try {
      await refreshSessionModel.create({
        _id: sid,
        subjectType: realm,
        subjectId,
        currentTokenHash,
        previousTokenHash: null,
        previousTokenRotatedAt: null,
        tokenVersionAtIssue: tokenVersion,
        lastUsedAt: nowValue,
        expiresAt: new Date(nowValue.getTime() + ttlMs),
        revokedAt: null,
        revokeReason: null,
      });
    } catch {
      // No cookie is ever written and no token is ever returned to the
      // browser when persistence fails — the caller must not proceed.
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    return Object.freeze({
      code: 'SESSION_ISSUED',
      sid,
      accessToken,
      refreshToken,
    });
  }

  return Object.freeze({ issueInitialSession });
}
