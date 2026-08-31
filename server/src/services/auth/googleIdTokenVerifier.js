import jwt from 'jsonwebtoken';
import { googleJwksCache } from './googleJwksCache.js';
import { GOOGLE_ACCEPTED_ISSUERS } from './googleOidcConfig.js';
import {
  normalizeProviderEmail,
  safeProviderDisplayName,
} from '../../../../shared/auth/socialIdentityProviders.js';

/**
 * Google `id_token` verification.
 *
 * Every trust decision about the signing-in person is made here and nowhere
 * else. Nothing downstream reads a claim this module did not verify, and no
 * profile field supplied by the browser is ever consulted.
 *
 * `jsonwebtoken` + Node's `crypto` are sufficient: `crypto.createPublicKey`
 * converts Google's JWKs to PEM (see `googleJwksCache.js`) and `jwt.verify`
 * with a pinned algorithm list does the rest. No additional dependency was
 * needed, so none was added.
 */

export const GOOGLE_ID_TOKEN_RESULTS = Object.freeze({
  VERIFIED: 'id_token_verified',
  MALFORMED: 'id_token_malformed',
  UNSUPPORTED_ALGORITHM: 'id_token_unsupported_algorithm',
  UNKNOWN_KEY: 'id_token_unknown_key',
  SIGNATURE_INVALID: 'id_token_signature_invalid',
  ISSUER_INVALID: 'id_token_issuer_invalid',
  AUDIENCE_INVALID: 'id_token_audience_invalid',
  AZP_INVALID: 'id_token_azp_invalid',
  EXPIRED: 'id_token_expired',
  IAT_INVALID: 'id_token_iat_invalid',
  NONCE_MISMATCH: 'id_token_nonce_mismatch',
  SUBJECT_MISSING: 'id_token_subject_missing',
  EMAIL_MISSING: 'id_token_email_missing',
  EMAIL_UNVERIFIED: 'id_token_email_unverified',
  KEYS_UNAVAILABLE: 'id_token_keys_unavailable',
});

/** RS256 only. `none` and every HMAC algorithm are rejected structurally. */
const ALLOWED_ALGORITHMS = Object.freeze(['RS256']);
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 60;
/** An `iat` further ahead than this is not clock skew, it is a forged token. */
const DEFAULT_MAX_FUTURE_IAT_SECONDS = 300;

function frozen(code, extra = {}) {
  return Object.freeze({ code, ...extra });
}

function decodeHeader(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return decoded && decoded.header ? decoded.header : null;
  } catch {
    return null;
  }
}

export function createGoogleIdTokenVerifier({
  jwksCache = googleJwksCache,
  acceptedIssuers = GOOGLE_ACCEPTED_ISSUERS,
  clockToleranceSeconds = DEFAULT_CLOCK_TOLERANCE_SECONDS,
  maxFutureIatSeconds = DEFAULT_MAX_FUTURE_IAT_SECONDS,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (!jwksCache || typeof jwksCache.getSigningKey !== 'function') {
    throw new TypeError('A jwksCache exposing getSigningKey is required');
  }

  /**
   * @param {object} input
   * @param {string} input.idToken   raw compact JWS from the token endpoint
   * @param {string} input.clientId  the configured GOOGLE_CLIENT_ID
   * @param {string} input.expectedNonce  the nonce from the OAuth transaction
   * @returns {Promise<object>} frozen result; `VERIFIED` carries `assertion`.
   */
  async function verify({ idToken, clientId, expectedNonce } = {}) {
    if (typeof idToken !== 'string' || idToken.length === 0) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.MALFORMED);
    }
    if (typeof clientId !== 'string' || clientId.length === 0) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.AUDIENCE_INVALID);
    }
    if (typeof expectedNonce !== 'string' || expectedNonce.length === 0) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.NONCE_MISMATCH);
    }

    const header = decodeHeader(idToken);
    if (!header) return frozen(GOOGLE_ID_TOKEN_RESULTS.MALFORMED);

    // Checked before any key lookup so an `alg: none` or HS256 token can never
    // reach a verifier that might treat a public key as a shared secret.
    if (!ALLOWED_ALGORITHMS.includes(header.alg)) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.UNSUPPORTED_ALGORITHM);
    }
    if (typeof header.kid !== 'string' || header.kid.length === 0) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.UNKNOWN_KEY);
    }

    const keyResult = await jwksCache.getSigningKey(header.kid);
    if (keyResult.code === 'UNKNOWN_KID') {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.UNKNOWN_KEY);
    }
    if (keyResult.code !== 'KEY_FOUND') {
      // Fail closed: no keys, no authentication. Never "trust on unavailable".
      return frozen(GOOGLE_ID_TOKEN_RESULTS.KEYS_UNAVAILABLE);
    }

    let claims;
    try {
      claims = jwt.verify(idToken, keyResult.pem, {
        algorithms: ALLOWED_ALGORITHMS,
        issuer: [...acceptedIssuers],
        audience: clientId,
        clockTolerance: clockToleranceSeconds,
      });
    } catch (error) {
      if (error?.name === 'TokenExpiredError') {
        return frozen(GOOGLE_ID_TOKEN_RESULTS.EXPIRED);
      }
      if (error?.message && /jwt issuer invalid/i.test(error.message)) {
        return frozen(GOOGLE_ID_TOKEN_RESULTS.ISSUER_INVALID);
      }
      if (error?.message && /jwt audience invalid/i.test(error.message)) {
        return frozen(GOOGLE_ID_TOKEN_RESULTS.AUDIENCE_INVALID);
      }
      return frozen(GOOGLE_ID_TOKEN_RESULTS.SIGNATURE_INVALID);
    }

    if (!claims || typeof claims !== 'object') {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.MALFORMED);
    }

    // `jwt.verify` already enforced iss/aud/exp; these re-checks make the
    // contract explicit and independent of that library's option semantics.
    if (!acceptedIssuers.includes(claims.iss)) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.ISSUER_INVALID);
    }
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (audiences.length !== 1 || audiences[0] !== clientId) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.AUDIENCE_INVALID);
    }
    if (claims.azp !== undefined && claims.azp !== clientId) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.AZP_INVALID);
    }

    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.EXPIRED);
    }
    if (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat)) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.IAT_INVALID);
    }
    if (claims.iat - now() > maxFutureIatSeconds) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.IAT_INVALID);
    }

    if (typeof claims.nonce !== 'string' || claims.nonce !== expectedNonce) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.NONCE_MISMATCH);
    }

    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.SUBJECT_MISSING);
    }
    const email = normalizeProviderEmail(claims.email);
    if (!email) return frozen(GOOGLE_ID_TOKEN_RESULTS.EMAIL_MISSING);
    if (claims.email_verified !== true) {
      return frozen(GOOGLE_ID_TOKEN_RESULTS.EMAIL_UNVERIFIED);
    }

    /**
     * The only value this module hands downstream. Deliberately narrow: the
     * four fields the P1 foundation consumes, all of them verified. `picture`,
     * `hd`, `locale` and the rest are dropped rather than passed along.
     */
    return frozen(GOOGLE_ID_TOKEN_RESULTS.VERIFIED, {
      assertion: Object.freeze({
        provider: 'google',
        subject: claims.sub,
        email,
        emailVerified: true,
        displayName: safeProviderDisplayName(claims.name, email),
      }),
    });
  }

  return Object.freeze({ verify });
}

export const googleIdTokenVerifier = createGoogleIdTokenVerifier();
