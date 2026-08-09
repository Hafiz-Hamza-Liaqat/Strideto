import {
  isKnownRealm,
  MAX_REFRESH_TOKEN_LENGTH,
  COOKIE_OCTET_PATTERN,
} from './AuthSessionPrimitiveContracts.js';

/**
 * Canonical realm-isolated refresh-cookie policy. Authority:
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md
 * §18, §18A, §18B.
 *
 * Repository-confirmed route paths (server/src/routes/auth.js,
 * server/src/routes/employer.js): user refresh is `/api/auth/refresh-token`,
 * employer refresh is `/api/auth/employer/refresh-token` — matching the
 * architecture report exactly. The report's production user cookie name is
 * `__Secure-strideto_user_rt` (§18/§18A) — the distinct SEC-3C task prompt
 * that requested this module said `__Secure-strideto_rt`; the architecture
 * report is the authority and is followed here, see the SEC-3C report §3
 * for the explicit reconciliation note.
 */

const COOKIE_DESCRIPTORS = Object.freeze({
  production: Object.freeze({
    user: Object.freeze({
      name: '__Secure-strideto_user_rt',
      path: '/api/auth/refresh-token',
    }),
    employer: Object.freeze({
      name: '__Secure-strideto_employer_rt',
      path: '/api/auth/employer/refresh-token',
    }),
    agent: Object.freeze({
      name: '__Secure-strideto_agent_rt',
      path: '/api/auth/agent/refresh-token',
    }),
    // Mission 18 — Institution realm (additive)
    institution: Object.freeze({
      name: '__Secure-strideto_institution_rt',
      path: '/api/auth/institution/refresh-token',
    }),
  }),
  development: Object.freeze({
    user: Object.freeze({
      name: 'strideto_dev_rt',
      path: '/api/auth/refresh-token',
    }),
    employer: Object.freeze({
      name: 'strideto_dev_employer_rt',
      path: '/api/auth/employer/refresh-token',
    }),
    agent: Object.freeze({
      name: 'strideto_dev_agent_rt',
      path: '/api/auth/agent/refresh-token',
    }),
    // Mission 18 — Institution realm (additive)
    institution: Object.freeze({
      name: 'strideto_dev_institution_rt',
      path: '/api/auth/institution/refresh-token',
    }),
  }),
});

/**
 * Pure resolver for the canonical runtime. Never reads `process.env`
 * itself — the caller supplies `nodeEnv`/`appEnv` explicitly. Production
 * is refused when the two disagree about production status (§18B's
 * "NODE_ENV/an equivalent app-env flag resolves ambiguously" hard-fail
 * condition — `APP_ENV` is a real, already-used repository env var, see
 * server/src/routes/health.js).
 */
export function resolveRuntimeMode({ nodeEnv, appEnv } = {}) {
  const nodeIsProd = nodeEnv === 'production';
  if (appEnv !== undefined) {
    const appIsProd = appEnv === 'production';
    if (nodeIsProd !== appIsProd) {
      throw new TypeError(
        'runtime mode is ambiguous: NODE_ENV and APP_ENV disagree about production status'
      );
    }
  }
  return nodeIsProd ? 'production' : 'development';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isHttpsUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function assertValidConfig({ mode, apiOrigin, trustedOrigins, maxAgeMs }) {
  if (mode !== 'production' && mode !== 'development') {
    throw new TypeError(
      'AuthCookiePolicy requires an unambiguous production or development mode'
    );
  }
  if (!Number.isInteger(maxAgeMs) || maxAgeMs <= 0) {
    throw new TypeError('maxAgeMs must be a positive finite integer');
  }
  if (!Array.isArray(trustedOrigins)) {
    throw new TypeError('trustedOrigins must be an array');
  }
  if (mode === 'production') {
    if (!isNonEmptyString(apiOrigin) || !isHttpsUrl(apiOrigin)) {
      throw new TypeError('apiOrigin must be an HTTPS origin in production');
    }
    if (trustedOrigins.length === 0) {
      throw new TypeError('trustedOrigins must not be empty in production');
    }
  }
}

/**
 * @param {object} config
 * @param {'production'|'development'} config.mode
 * @param {string} config.apiOrigin
 * @param {string[]} config.trustedOrigins
 * @param {number} config.maxAgeMs
 */
export function createAuthCookiePolicy(config) {
  assertValidConfig(config || {});
  const { mode, maxAgeMs } = config;
  const descriptors = COOKIE_DESCRIPTORS[mode];
  const secure = mode === 'production';

  function descriptorFor(realm) {
    if (!isKnownRealm(realm)) {
      throw new TypeError('realm must be "user", "employer", or "agent"');
    }
    return descriptors[realm];
  }

  function getCookieName(realm) {
    return descriptorFor(realm).name;
  }

  function getCookiePath(realm) {
    return descriptorFor(realm).path;
  }

  function cookieOptions(realm) {
    const { path } = descriptorFor(realm);
    return Object.freeze({
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path,
      maxAge: maxAgeMs,
      priority: 'high',
      /**
       * SEC-3C.1 — identity encoder. `isValidToken` already restricts
       * every written value to the RFC 6265 `cookie-octet` character set
       * (COOKIE_OCTET_PATTERN), which requires no escaping to be a safe
       * Set-Cookie value. Overriding Express's default
       * `encodeURIComponent`-based encoding keeps the value byte-exact on
       * the wire, symmetric with `extractRefreshToken` no longer decoding
       * on read (below) — without this, Express would percent-encode
       * cookie-octet-safe characters such as `=`, breaking round-trip
       * fidelity for values like `abc=def=ghi`.
       */
      encode: (value) => value,
    });
  }

  /**
   * SEC-3C.1 — primary validator: every character must be an RFC 6265
   * `cookie-octet` (§4.1.1). This rejects control characters, CR, LF,
   * NUL, horizontal tab, space, DQUOTE, comma, semicolon, backslash, and
   * non-ASCII characters outright, at the application layer — Express's
   * own default percent-encoding of the cookie value is defense-in-depth
   * on top of this, never the sole safeguard. A valid token is never
   * trimmed or otherwise transformed; `COOKIE_OCTET_PATTERN` itself
   * already excludes whitespace, so a whitespace-only or
   * whitespace-containing value is rejected by the pattern, not by a
   * separate trim-based check.
   */
  function isValidToken(token) {
    return (
      typeof token === 'string' &&
      token.length > 0 &&
      token.length <= MAX_REFRESH_TOKEN_LENGTH &&
      COOKIE_OCTET_PATTERN.test(token)
    );
  }

  /**
   * Write the realm-specific refresh cookie through an injected,
   * Express-response-shaped boundary (`{ cookie(name, value, options) }`).
   * Never logs or returns the token.
   */
  function writeRefreshCookie({ res, realm, token }) {
    if (!isKnownRealm(realm)) {
      return Object.freeze({ code: 'INVALID_COOKIE_INPUT' });
    }
    if (!res || typeof res.cookie !== 'function') {
      return Object.freeze({ code: 'INVALID_COOKIE_CONFIGURATION' });
    }
    if (!isValidToken(token)) {
      return Object.freeze({ code: 'INVALID_COOKIE_INPUT' });
    }
    const { name } = descriptorFor(realm);
    res.cookie(name, token, cookieOptions(realm));
    return Object.freeze({ code: 'COOKIE_WRITTEN' });
  }

  /**
   * Clear the realm-specific refresh cookie using the exact same name and
   * matching attributes used to set it (minus `maxAge`, which
   * `res.clearCookie` does not require and which some Express/`cookie`
   * versions treat as extraneous on a clearing response). May be called
   * even when the incoming request did not itself carry the cookie — the
   * response only needs to declare matching attributes (§18).
   */
  function clearRefreshCookie({ res, realm }) {
    if (!isKnownRealm(realm)) {
      return Object.freeze({ code: 'INVALID_COOKIE_INPUT' });
    }
    if (!res || typeof res.clearCookie !== 'function') {
      return Object.freeze({ code: 'INVALID_COOKIE_CONFIGURATION' });
    }
    const { name, path } = descriptorFor(realm);
    const { maxAge, ...clearOptions } = cookieOptions(realm);
    void maxAge;
    res.clearCookie(name, { ...clearOptions, path });
    return Object.freeze({ code: 'COOKIE_CLEARED' });
  }

  /**
   * Extract exactly one realm-scoped refresh token from a raw `Cookie`
   * request header. No `cookie-parser` dependency. Distinguishes missing
   * from malformed/duplicate input; never logs the header or the token.
   *
   * SEC-3C.1: the selected value is validated and returned exactly as
   * parsed — `decodeURIComponent` is deliberately not used. Decoding
   * before validating would let a percent-encoded unsafe sequence (e.g.
   * `%0D%0A`, itself composed entirely of cookie-octet-safe characters)
   * slip past the cookie-octet check only to reveal a raw CR/LF after
   * decoding; validating the exact wire bytes closes that gap. This is
   * symmetric with `writeRefreshCookie`'s identity `encode`, so a value
   * round-trips byte-for-byte with no decoding/encoding layer to bypass.
   */
  function extractRefreshToken({ cookieHeader, realm }) {
    if (!isKnownRealm(realm)) {
      return Object.freeze({ code: 'INVALID_COOKIE_INPUT' });
    }
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
      return Object.freeze({ code: 'COOKIE_MISSING' });
    }
    // Reject a Cookie header carrying CR, LF, or NUL before any parsing —
    // these can never legitimately appear in a real HTTP header value and
    // are rejected outright rather than parsed defensively.
    if (/[\r\n\0]/.test(cookieHeader)) {
      return Object.freeze({ code: 'INVALID_COOKIE_INPUT' });
    }
    const { name } = descriptorFor(realm);
    const pairs = cookieHeader.split(';');
    const matches = [];
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;
      const rawKey = pair.slice(0, eqIndex).trim();
      if (rawKey !== name) continue;
      const rawValue = pair.slice(eqIndex + 1).trim();
      matches.push(rawValue);
    }
    if (matches.length === 0) {
      return Object.freeze({ code: 'COOKIE_MISSING' });
    }
    if (matches.length > 1) {
      return Object.freeze({ code: 'COOKIE_DUPLICATE' });
    }
    const value = matches[0];
    if (!isValidToken(value)) {
      return value.length === 0
        ? Object.freeze({ code: 'COOKIE_MISSING' })
        : Object.freeze({ code: 'INVALID_COOKIE_INPUT' });
    }
    return Object.freeze({ code: 'COOKIE_FOUND', token: value });
  }

  return Object.freeze({
    mode,
    getCookieName,
    getCookiePath,
    writeRefreshCookie,
    clearRefreshCookie,
    extractRefreshToken,
  });
}
