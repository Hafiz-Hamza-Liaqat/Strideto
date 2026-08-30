/**
 * Canonical social-identity provider registry (Google Sign-In P1).
 *
 * Provider-neutral by construction: nothing here is Google-specific and
 * nothing here performs provider verification. Provider-specific token
 * verification belongs in per-provider adapters added later (P2+).
 *
 * This list is deliberately a strict subset of
 * `shared/auth/connectedAccounts.js`'s `CONNECTED_ACCOUNT_PROVIDERS` — that
 * module remains the single source of truth for which providers exist at all
 * and for the `OAUTH_<PROVIDER>_ENABLED` configuration convention. This module
 * only names the providers whose *identity persistence* the P1 foundation
 * supports.
 */
export const SOCIAL_IDENTITY_PROVIDERS = Object.freeze([
  'google',
  'linkedin',
  'facebook',
]);

const PROVIDER_SET = new Set(SOCIAL_IDENTITY_PROVIDERS);

export function isKnownSocialIdentityProvider(provider) {
  return typeof provider === 'string' && PROVIDER_SET.has(provider);
}

/**
 * The provider subject (`sub`) is the canonical external identity. It is
 * compared byte-exact — never lowercased, coerced, or derived from an email
 * address. A subject that is not a non-empty, already-trimmed string of
 * bounded length is not a subject.
 */
export const MAX_PROVIDER_SUBJECT_LENGTH = 255;

export function isValidProviderSubject(subject) {
  return (
    typeof subject === 'string'
    && subject.length > 0
    && subject.length <= MAX_PROVIDER_SUBJECT_LENGTH
    && subject.trim() === subject
  );
}

/**
 * Email is metadata only. It is normalized solely so the *existing account*
 * lookup uses the same normalization `User.email` already applies (`trim` +
 * `lowercase`). It is never an identity key.
 */
export function normalizeProviderEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidProviderEmail(email) {
  const normalized = normalizeProviderEmail(email);
  return normalized.length > 0 && EMAIL_REGEX.test(normalized);
}

/**
 * Provider display names are untrusted free text. Bound the length and strip
 * C0/C1 control characters before the value is ever persisted as `User.name`.
 * Written as an explicit code-point filter rather than a control-character
 * regex so the source file itself stays free of raw control bytes.
 */
export const MAX_PROVIDER_DISPLAY_NAME_LENGTH = 120;

function isControlCodePoint(codePoint) {
  return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
}

export function stripControlCharacters(value) {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const character of value) {
    out += isControlCodePoint(character.codePointAt(0)) ? ' ' : character;
  }
  return out;
}

export function safeProviderDisplayName(displayName, fallbackEmail = '') {
  const cleaned = stripControlCharacters(displayName).replace(/\s+/g, ' ').trim();
  if (cleaned.length > 0) return cleaned.slice(0, MAX_PROVIDER_DISPLAY_NAME_LENGTH);
  const local = normalizeProviderEmail(fallbackEmail).split('@')[0] || '';
  return local.slice(0, MAX_PROVIDER_DISPLAY_NAME_LENGTH);
}
