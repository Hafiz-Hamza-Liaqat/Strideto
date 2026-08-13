/**
 * International phone contract (Mission 1 — International Foundation).
 *
 * Canonical storage is an E.164-compatible string: a leading `+`, a country
 * calling code, then subscriber digits, up to 15 digits total (ITU-T E.164).
 * Display/input formatting is deliberately kept separate from canonical storage
 * so a UI can show `+92 300 1234567` while the database holds `+923001234567`.
 *
 * No `+92` (Pakistan) assumption is embedded. Full carrier-grade parsing (per
 * national number plans) is intentionally out of Mission 1 scope; if a later
 * mission needs it, prefer a mature dependency (e.g. libphonenumber) rather than
 * growing this. SMS/WhatsApp verification is NOT built here.
 *
 * The existing legacy Employer/User `phone` fields (free-text) are untouched;
 * `normalizePhone` is available to adapt them on read where useful.
 *
 * Client- and server-safe: pure JS.
 */

/**
 * A well-formed E.164 number: `+`, a first significant digit 1–9, then up to 14
 * more digits (15 digits max overall).
 */
const E164 = /^\+[1-9]\d{1,14}$/;

/** True for a string already in canonical E.164 form. */
export function isE164(value) {
  return typeof value === 'string' && E164.test(value.trim());
}

/**
 * Normalize loose phone input to E.164-compatible canonical form, or `null`.
 *
 * Accepts common human formatting (spaces, dashes, parentheses, dots) and a
 * leading `+`. Does NOT invent a country code: a number without a leading `+`
 * (or an international `00` prefix) cannot be safely attributed to a country and
 * returns `null`, because guessing a default country is exactly the Pakistan
 * assumption this foundation forbids. Callers that know the dialing region can
 * pass `defaultCountryCallingCode` to supply it explicitly.
 *
 * @param {string} value raw phone input
 * @param {{ defaultCountryCallingCode?: string }} [opts] e.g. '92' — used only
 *   for local-format numbers; never assumed.
 */
export function normalizePhone(value, { defaultCountryCallingCode } = {}) {
  if (typeof value !== 'string') return null;
  let raw = value.trim();
  if (!raw) return null;

  // International access prefix `00` → `+`.
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;

  let candidate;
  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (defaultCountryCallingCode) {
    const cc = String(defaultCountryCallingCode).replace(/[^\d]/g, '');
    if (!cc) return null;
    // Drop a single leading national trunk `0` before prefixing the country code.
    const national = digits.replace(/^0+/, '');
    candidate = `+${cc}${national}`;
  } else {
    // No country context → cannot safely canonicalize.
    return null;
  }

  return E164.test(candidate) ? candidate : null;
}

/** True when the input can be normalized to canonical E.164 form. */
export function isValidPhone(value, opts) {
  return normalizePhone(value, opts) !== null;
}

import { COUNTRY_CALLING_CODES } from './callingCodes.js';
import { ISO_3166_ALPHA2, countryDisplayName, normalizeCountryCode } from './country.js';

export { COUNTRY_CALLING_CODES };

/** Resolve the country calling code digits for an ISO alpha-2 code, or `null`. */
export function getCountryCallingCode(countryCode) {
  if (typeof countryCode !== 'string') return null;
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_CALLING_CODES[code] ?? null;
}

const CALLING_CODE_ROWS = ISO_3166_ALPHA2
  .map((countryCode) => {
    const callingCode = COUNTRY_CALLING_CODES[countryCode];
    if (!callingCode) return null;
    return { countryCode, callingCode };
  })
  .filter(Boolean);

/** Longest calling-code first so +1876 matches JM before +1 matches US/CA. */
const CALLING_CODES_BY_LENGTH = [...new Set(CALLING_CODE_ROWS.map((row) => row.callingCode))]
  .sort((a, b) => b.length - a.length);

/**
 * Phone-country catalog derived from the canonical ISO list + ITU calling codes.
 * Sorted by localized display name. Does not invent a default country.
 */
export function listPhoneCountries(locale = 'en') {
  return CALLING_CODE_ROWS
    .map((row) => ({
      countryCode: row.countryCode,
      callingCode: row.callingCode,
      name: countryDisplayName(row.countryCode, locale),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}

/**
 * Countries that share a calling-code prefix. Never assume one country per dial code.
 */
export function countriesForCallingCode(callingCode) {
  const digits = String(callingCode || '').replace(/[^\d]/g, '');
  if (!digits) return [];
  return CALLING_CODE_ROWS
    .filter((row) => row.callingCode === digits)
    .map((row) => row.countryCode);
}

/**
 * Parse an E.164 string into ISO identity + national number.
 * Uses longest calling-code prefix. Shared codes (US/CA +1) prefer `preferredCountry`
 * when that country is a valid candidate; otherwise countryCode stays empty.
 */
export function parseE164ToPhoneParts(value, { preferredCountry } = {}) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const digits = value.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) return null;
  const rest = digits.slice(1);
  const hint = normalizeCountryCode(preferredCountry);
  for (const callingCode of CALLING_CODES_BY_LENGTH) {
    if (!rest.startsWith(callingCode)) continue;
    const candidates = countriesForCallingCode(callingCode);
    const countryCode = (hint && candidates.includes(hint))
      ? hint
      : (candidates.length === 1 ? candidates[0] : '');
    return {
      countryCode,
      callingCode,
      nationalNumber: rest.slice(callingCode.length),
    };
  }
  return null;
}

/**
 * Build an E.164 string from structured parts when the national number is present.
 * Returns `null` when dial code or national digits are missing/invalid.
 */
export function formatPhoneE164({ countryCode, dialCode, nationalNumber } = {}) {
  const cc = String(dialCode || getCountryCallingCode(countryCode) || '').replace(/[^\d]/g, '');
  const national = String(nationalNumber || '').replace(/[^\d]/g, '').replace(/^0+/, '');
  if (!cc || !national) return null;
  return normalizePhone(`+${cc}${national}`);
}
