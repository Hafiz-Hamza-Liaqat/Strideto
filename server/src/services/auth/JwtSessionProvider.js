import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  REFRESH_SESSION_SUBJECT_TYPES,
  RefreshSessionContractError,
} from './RefreshSessionContracts.js';

/**
 * SEC-3B — dormant JWT/session-security module. Fully isolated from the
 * live `utils/jwt.js` helper (still unchanged, still what every current
 * route uses). No route or controller imports this yet.
 *
 * Configuration is injected explicitly (never read from `process.env`
 * directly inside this module) so tests never depend on real secrets and
 * so a future wiring phase can supply production config without editing
 * this file. Authority:
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md §19A.
 */

const ALLOWED_ALGORITHM = 'HS256';
const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';

// Mirrors validateEnv.js's existing INSECURE_JWT_SECRETS policy — the same
// list, not a diverging one — plus the same 32-character minimum.
const INSECURE_SECRETS = new Set([
  'change-me-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'dev-only-jwt-secret-min-32-characters-long',
]);
const MIN_SECRET_LENGTH = 32;

function isWeakSecret(secret) {
  return (
    typeof secret !== 'string' ||
    secret.length < MIN_SECRET_LENGTH ||
    INSECURE_SECRETS.has(secret)
  );
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function assertValidConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('JwtSessionProvider requires a configuration object');
  }
  const {
    accessSecret,
    refreshSecret,
    issuer,
    accessAudience,
    refreshAudience,
  } = config;

  if (isWeakSecret(accessSecret)) {
    throw new TypeError(
      'accessSecret is missing or does not meet the minimum security policy'
    );
  }
  if (isWeakSecret(refreshSecret)) {
    throw new TypeError(
      'refreshSecret is missing or does not meet the minimum security policy'
    );
  }
  if (accessSecret === refreshSecret) {
    throw new TypeError('accessSecret and refreshSecret must not be equal');
  }
  if (!isNonEmptyString(issuer)) {
    throw new TypeError('issuer must be a non-empty string');
  }
  if (!isNonEmptyString(accessAudience)) {
    throw new TypeError('accessAudience must be a non-empty string');
  }
  if (!isNonEmptyString(refreshAudience)) {
    throw new TypeError('refreshAudience must be a non-empty string');
  }
  if (accessAudience === refreshAudience) {
    throw new TypeError('accessAudience and refreshAudience must not be equal');
  }
}

function assertRealm(realm) {
  if (!REFRESH_SESSION_SUBJECT_TYPES.includes(realm)) {
    throw new RefreshSessionContractError(
      'REFRESH_SESSION_CONTRACT_INVALID',
      'realm must be "user" or "employer"'
    );
  }
}

function assertNonEmptyClaim(value, name) {
  if (!isNonEmptyString(value) && typeof value !== 'number') {
    throw new RefreshSessionContractError(
      'REFRESH_SESSION_CONTRACT_INVALID',
      `${name} is required`
    );
  }
}

/**
 * SEC-3B.1 — narrowly scoped non-negative-integer validator, applied to
 * `tokenVersion` at both issuance and verification so a fractional,
 * infinite, or negative value can never be embedded in a signed token in
 * the first place (issuance previously only checked `typeof === 'number'`,
 * deferring the real check to verification of an already-issued token).
 */
function assertNonNegativeIntegerClaim(value, name) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RefreshSessionContractError(
      'REFRESH_SESSION_CONTRACT_INVALID',
      `${name} must be a non-negative integer`
    );
  }
}

/**
 * @param {object} config
 * @param {string} config.accessSecret
 * @param {string} config.refreshSecret
 * @param {string} config.issuer
 * @param {string} config.accessAudience
 * @param {string} config.refreshAudience
 * @param {string} [config.accessLifetime='15m']
 * @param {string} [config.refreshLifetime='7d']
 */
export function createJwtSessionProvider(config) {
  assertValidConfig(config);
  const {
    accessSecret,
    refreshSecret,
    issuer,
    accessAudience,
    refreshAudience,
    accessLifetime = '15m',
    refreshLifetime = '7d',
  } = config;

  function issueAccessToken({ sub, realm, sid, tokenVersion }) {
    assertRealm(realm);
    assertNonEmptyClaim(sub, 'sub');
    assertNonEmptyClaim(sid, 'sid');
    assertNonNegativeIntegerClaim(tokenVersion, 'tokenVersion');

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub, realm, sid, tokenVersion, type: ACCESS_TOKEN_TYPE },
      accessSecret,
      {
        algorithm: ALLOWED_ALGORITHM,
        issuer,
        audience: accessAudience,
        expiresIn: accessLifetime,
        jwtid: jti,
      }
    );
    return { token, jti };
  }

  function issueRefreshToken({ sub, realm, sid, tokenVersion }) {
    assertRealm(realm);
    assertNonEmptyClaim(sub, 'sub');
    assertNonEmptyClaim(sid, 'sid');
    assertNonNegativeIntegerClaim(tokenVersion, 'tokenVersion');

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub, realm, sid, tokenVersion, type: REFRESH_TOKEN_TYPE },
      refreshSecret,
      {
        algorithm: ALLOWED_ALGORITHM,
        issuer,
        audience: refreshAudience,
        expiresIn: refreshLifetime,
        jwtid: jti,
      }
    );
    return { token, jti };
  }

  function verifyClaims(decoded, expectedType) {
    if (decoded.type !== expectedType) {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'token type mismatch'
      );
    }
    if (!REFRESH_SESSION_SUBJECT_TYPES.includes(decoded.realm)) {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'token realm is invalid'
      );
    }
    if (!isNonEmptyString(decoded.sub)) {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'sub is missing'
      );
    }
    if (!isNonEmptyString(decoded.sid)) {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'sid is missing'
      );
    }
    if (!isNonEmptyString(decoded.jti)) {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'jti is missing'
      );
    }
    assertNonNegativeIntegerClaim(decoded.tokenVersion, 'tokenVersion');
    return Object.freeze({
      sub: decoded.sub,
      realm: decoded.realm,
      sid: decoded.sid,
      jti: decoded.jti,
      tokenVersion: decoded.tokenVersion,
    });
  }

  function verifyAccessToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, accessSecret, {
        algorithms: [ALLOWED_ALGORITHM],
        issuer,
        audience: accessAudience,
      });
    } catch {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'access token verification failed'
      );
    }
    return verifyClaims(decoded, ACCESS_TOKEN_TYPE);
  }

  function verifyRefreshToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, refreshSecret, {
        algorithms: [ALLOWED_ALGORITHM],
        issuer,
        audience: refreshAudience,
      });
    } catch {
      throw new RefreshSessionContractError(
        'REFRESH_SESSION_CONTRACT_INVALID',
        'refresh token verification failed'
      );
    }
    return verifyClaims(decoded, REFRESH_TOKEN_TYPE);
  }

  return Object.freeze({
    issueAccessToken,
    issueRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
  });
}
