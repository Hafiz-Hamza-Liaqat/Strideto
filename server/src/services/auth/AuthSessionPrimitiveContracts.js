import { REFRESH_SESSION_SUBJECT_TYPES } from './RefreshSessionContracts.js';

/**
 * Canonical contracts shared by the cookie policy, trusted-origin
 * policy, and subject-state provider. Pure data/constants and an error
 * class only — no Express, no Mongoose, and no I/O. Reuses the realm enum
 * as the single source of truth rather
 * than redeclaring it. Authority:
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md
 * (§18, §18A, §18B, §19, §24).
 */

export const AUTH_SESSION_REALMS = REFRESH_SESSION_SUBJECT_TYPES;

export const COOKIE_RESULT_CODES = Object.freeze([
  'COOKIE_WRITTEN',
  'COOKIE_CLEARED',
  'COOKIE_FOUND',
  'COOKIE_MISSING',
  'COOKIE_DUPLICATE',
  'INVALID_COOKIE_INPUT',
  'INVALID_COOKIE_CONFIGURATION',
]);

/**
 * SEC-3C.1 correction: §19 point 4 introduces a forced-preflight header
 * only as a hedged illustrative example ("e.g. `X-Strideto-Client: web`"),
 * not as a finalized, adopted, exact contract — no other passage in the
 * checkpointed architecture report declares it authoritative. SEC-3C
 * originally implemented it as if it were adopted; this was corrected
 * per the SEC-3C-A acceptance audit. No marker evaluator or marker result
 * code exists here. Strict Origin/Referer validation (below) is the
 * authoritative origin-validation primitive from this module.
 */
export const ORIGIN_RESULT_CODES = Object.freeze([
  'ORIGIN_TRUSTED',
  'REFERER_TRUSTED',
  'ORIGIN_MISSING',
  'ORIGIN_NULL',
  'ORIGIN_MALFORMED',
  'ORIGIN_UNTRUSTED',
  'REFERER_MALFORMED',
  'REFERER_UNTRUSTED',
]);

export const SUBJECT_STATE_RESULT_CODES = Object.freeze([
  'SUBJECT_ACTIVE',
  'SUBJECT_MISSING',
  'SUBJECT_INACTIVE',
  'TOKEN_VERSION_MISMATCH',
  'SUBJECT_STATE_INVALID',
  'INVALID_INPUT',
  'STORAGE_FAILURE',
]);

const SAFE_MESSAGES = Object.freeze({
  AUTH_SESSION_PRIMITIVE_INVALID: 'The request could not be validated.',
  AUTH_SESSION_PRIMITIVE_CONFIGURATION_INVALID:
    'The primitive configuration is invalid.',
});

export class AuthSessionPrimitiveError extends Error {
  constructor(code, message = SAFE_MESSAGES[code]) {
    super(message || SAFE_MESSAGES.AUTH_SESSION_PRIMITIVE_INVALID);
    this.name = 'AuthSessionPrimitiveError';
    this.code = code;
  }
}

export function isKnownRealm(value) {
  return AUTH_SESSION_REALMS.includes(value);
}

/** Maximum accepted refresh-token length for cookie write/extraction (§5). */
export const MAX_REFRESH_TOKEN_LENGTH = 4096;

/**
 * SEC-3C.1 — RFC 6265 §4.1.1 `cookie-octet` character class, applied to
 * refresh-token cookie values on both the write and extraction paths.
 * `cookie-octet = %x21 / %x23-2B / %x2D-3A / %x3C-5B / %x5D-7E` — i.e.
 * every printable US-ASCII character except control characters, space,
 * DQUOTE (0x22), comma (0x2C), semicolon (0x3B), and backslash (0x5C).
 * This is the primary validator; Express's own default percent-encoding
 * of the cookie value is defense-in-depth, not relied upon as the sole
 * safeguard.
 */
export const COOKIE_OCTET_PATTERN =
  /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;
