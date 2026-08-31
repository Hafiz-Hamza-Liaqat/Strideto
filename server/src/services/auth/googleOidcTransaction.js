import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { GOOGLE_OAUTH_ROUTE_PREFIX } from './googleOidcConfig.js';
import { JWT_ISSUER } from './secureAuthConfig.js';
// The canonical RFC 6265 cookie-octet set — reused, never forked.
import { COOKIE_OCTET_PATTERN } from './AuthSessionPrimitiveContracts.js';

/**
 * OAuth transaction state: `state`, `nonce`, and the PKCE `code_verifier`,
 * carried across the redirect in one short-lived HttpOnly cookie.
 *
 * The cookie value is a signed JWT rather than raw JSON. That buys three
 * things a plain cookie does not: the transaction cannot be tampered with, the
 * lifetime is enforced cryptographically as well as by `Max-Age`, and the
 * dedicated audience means a transaction cookie can never be presented as — or
 * confused with — an access or refresh token. It carries no access token, no
 * refresh token, and no user identity; only the three transaction values and a
 * `jti` used to burn it after a single use.
 *
 * Cookie IO mirrors `AuthCookiePolicy.js`: raw `Cookie` header parsing with no
 * `cookie-parser` dependency, an identity encoder, and a `__Secure-` prefix in
 * production.
 */

export const OAUTH_TRANSACTION_AUDIENCE = 'strideto-oauth-transaction';
export const OAUTH_TRANSACTION_TTL_SECONDS = 600; // 10 minutes, the stated cap

const COOKIE_NAMES = Object.freeze({
  production: '__Secure-strideto_oauth_tx',
  development: 'strideto_dev_oauth_tx',
});

const MAX_COOKIE_LENGTH = 2048;

export const OAUTH_TRANSACTION_RESULTS = Object.freeze({
  ISSUED: 'transaction_issued',
  VALID: 'transaction_valid',
  MISSING: 'transaction_missing',
  INVALID: 'transaction_invalid',
  EXPIRED: 'transaction_expired',
  REPLAYED: 'transaction_replayed',
  STATE_MISMATCH: 'transaction_state_mismatch',
  STORAGE_FAILURE: 'transaction_storage_failure',
});

function base64Url(buffer) {
  return buffer.toString('base64url');
}

/** 256 bits from the CSPRNG for each value. */
function randomToken() {
  return base64Url(crypto.randomBytes(32));
}

export function deriveCodeChallenge(codeVerifier) {
  return base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
}

/**
 * Constant-time comparison that does not leak length through an early return.
 * `timingSafeEqual` throws on a length mismatch, so both sides are hashed to a
 * fixed width first.
 */
export function timingSafeStringEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = crypto.createHash('sha256').update(left).digest();
  const b = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createGoogleOidcTransactionService({
  signingSecret,
  mode = process.env.NODE_ENV === 'production' ? 'production' : 'development',
  ttlSeconds = OAUTH_TRANSACTION_TTL_SECONDS,
  denylistService,
  now = () => Date.now(),
  randomValue = randomToken,
} = {}) {
  if (typeof signingSecret !== 'string' || signingSecret.length < 32) {
    throw new TypeError('A signing secret of at least 32 characters is required');
  }
  if (mode !== 'production' && mode !== 'development') {
    throw new TypeError('mode must be "production" or "development"');
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > OAUTH_TRANSACTION_TTL_SECONDS) {
    throw new TypeError('ttlSeconds must be a positive integer no greater than 600');
  }

  const secure = mode === 'production';
  const cookieName = COOKIE_NAMES[mode];

  function cookieOptions() {
    return Object.freeze({
      httpOnly: true,
      secure,
      sameSite: 'lax',
      // Scoped to the Google OAuth routes only — never sent to the API at
      // large, and never to the refresh-token path.
      path: GOOGLE_OAUTH_ROUTE_PREFIX,
      maxAge: ttlSeconds * 1000,
      priority: 'high',
      encode: (value) => value,
    });
  }

  /** Creates a fresh transaction and the cookie value that carries it. */
  function createTransaction() {
    const state = randomValue();
    const nonce = randomValue();
    const codeVerifier = randomValue();
    const jti = randomValue();
    const token = jwt.sign(
      { state, nonce, cv: codeVerifier },
      signingSecret,
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: OAUTH_TRANSACTION_AUDIENCE,
        expiresIn: ttlSeconds,
        jwtid: jti,
      }
    );
    return Object.freeze({
      code: OAUTH_TRANSACTION_RESULTS.ISSUED,
      state,
      nonce,
      codeVerifier,
      codeChallenge: deriveCodeChallenge(codeVerifier),
      codeChallengeMethod: 'S256',
      jti,
      cookieValue: token,
    });
  }

  function writeCookie(res) {
    return function write(value) {
      if (!res || typeof res.cookie !== 'function') return false;
      if (typeof value !== 'string' || value.length === 0) return false;
      if (value.length > MAX_COOKIE_LENGTH || !COOKIE_OCTET_PATTERN.test(value)) return false;
      res.cookie(cookieName, value, cookieOptions());
      return true;
    };
  }

  function clearCookie(res) {
    if (!res || typeof res.clearCookie !== 'function') return false;
    const { maxAge, ...clearOptions } = cookieOptions();
    void maxAge;
    res.clearCookie(cookieName, clearOptions);
    return true;
  }

  /** Raw `Cookie` header parsing, symmetric with `AuthCookiePolicy`. */
  function extractCookie(cookieHeader) {
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) return null;
    if (/[\r\n\0]/.test(cookieHeader)) return null;
    const matches = [];
    for (const pair of cookieHeader.split(';')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;
      if (pair.slice(0, eqIndex).trim() !== cookieName) continue;
      matches.push(pair.slice(eqIndex + 1).trim());
    }
    if (matches.length !== 1) return null; // missing or ambiguous duplicate
    const value = matches[0];
    if (value.length === 0 || value.length > MAX_COOKIE_LENGTH) return null;
    if (!COOKIE_OCTET_PATTERN.test(value)) return null;
    return value;
  }

  /**
   * Validates the presented transaction against the `state` Google echoed
   * back, then burns it so the same cookie can never be replayed.
   */
  async function consumeTransaction({ cookieHeader, presentedState }) {
    const cookieValue = extractCookie(cookieHeader);
    if (!cookieValue) return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.MISSING });

    let claims;
    try {
      claims = jwt.verify(cookieValue, signingSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: OAUTH_TRANSACTION_AUDIENCE,
      });
    } catch (error) {
      return Object.freeze({
        code: error?.name === 'TokenExpiredError'
          ? OAUTH_TRANSACTION_RESULTS.EXPIRED
          : OAUTH_TRANSACTION_RESULTS.INVALID,
      });
    }

    if (
      typeof claims.state !== 'string'
      || typeof claims.nonce !== 'string'
      || typeof claims.cv !== 'string'
      || typeof claims.jti !== 'string'
    ) {
      return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.INVALID });
    }

    if (typeof presentedState !== 'string' || presentedState.length === 0) {
      return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.STATE_MISMATCH });
    }
    if (!timingSafeStringEqual(claims.state, presentedState)) {
      return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.STATE_MISMATCH });
    }

    /**
     * True single use. Clearing the cookie alone is a client-side courtesy — a
     * captured cookie could otherwise be presented again within its 10-minute
     * window. The jti is checked and then burned in the same shared store the
     * access-token denylist already uses, so replay is refused server-side.
     */
    if (denylistService) {
      const seen = await denylistService.isJtiDenylisted(claims.jti);
      if (seen.code !== 'CHECKED') {
        return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.STORAGE_FAILURE });
      }
      if (seen.denylisted) {
        return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.REPLAYED });
      }
      const remainingSeconds = Math.max(
        1,
        Math.ceil((claims.exp * 1000 - now()) / 1000)
      );
      const burned = await denylistService.denylistJti(claims.jti, remainingSeconds);
      if (burned.code !== 'DENYLISTED' && burned.code !== 'DENYLIST_SKIPPED_EXPIRED') {
        return Object.freeze({ code: OAUTH_TRANSACTION_RESULTS.STORAGE_FAILURE });
      }
    }

    return Object.freeze({
      code: OAUTH_TRANSACTION_RESULTS.VALID,
      nonce: claims.nonce,
      codeVerifier: claims.cv,
      jti: claims.jti,
    });
  }

  return Object.freeze({
    cookieName,
    cookieOptions,
    createTransaction,
    writeCookie,
    clearCookie,
    extractCookie,
    consumeTransaction,
  });
}
