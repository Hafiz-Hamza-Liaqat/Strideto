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
