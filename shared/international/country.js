/**
 * Canonical ISO 3166-1 alpha-2 country contract (Mission 1 — International Foundation).
 *
 * Strideto is international by architecture. Every NEW feature that stores a
 * country stores a normalized ISO 3166-1 alpha-2 code (e.g. `PK`, `US`, `GB`),
 * never a free-text name and never an implicit Pakistan default.
 *
 * Display names are resolved at runtime via `Intl.DisplayNames` so we do not
 * bundle and maintain a table of hundreds of country names. A small, auditable,
 * standards-derived allow-set of alpha-2 codes is kept here purely for
 * *validation* (is this a real, currently-assigned code?) — the human labels
 * still come from the platform's Intl data, which is locale-aware.
 *
 * Legacy compatibility: existing records may store a country *name*
 * ("Pakistan") rather than a code. `coerceCountryCode` accepts either and does a
 * best-effort resolution so callers can migrate incrementally without a
 * destructive backfill.
 *
 * Client- and server-safe: pure JS, no Node-only or DOM-only globals beyond the
 * ECMA-402 `Intl` object, which exists in every supported runtime.
 */

/**
 * Standards-derived set of ISO 3166-1 alpha-2 codes (officially assigned).
 * Auditable and intentionally small (2-char strings only). This is the
 * *validation* boundary; display labels come from `Intl.DisplayNames`.
 */
export const ISO_3166_ALPHA2 = Object.freeze([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU',
  'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL',
  'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC',
  'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV',
  'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG',
  'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD',
  'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT',
  'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM',
  'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH',
  'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK',
  'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH',
  'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW',
  'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR',
  'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR',
  'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC',
  'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL',
  'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY',
  'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA',
  'ZM', 'ZW',
]);

const ALPHA2_SET = new Set(ISO_3166_ALPHA2);

/**
 * Minimal legacy name → code map for the handful of names Strideto records are
 * known to have stored as free text before this contract existed. Intentionally
 * NOT exhaustive: it exists so migration reads do not silently drop legacy
 * "Pakistan" values, not to become a second country database.
 */
const LEGACY_NAME_TO_CODE = Object.freeze({
  PAKISTAN: 'PK',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  USA: 'US',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  'UNITED ARAB EMIRATES': 'AE',
  UAE: 'AE',
  'SAUDI ARABIA': 'SA',
  CANADA: 'CA',
  AUSTRALIA: 'AU',
  GERMANY: 'DE',
  CHINA: 'CN',
  INDIA: 'IN',
});

/** True for a syntactically valid alpha-2 string (two ASCII letters). */
export function isAlpha2Shape(value) {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value.trim());
}

/**
 * Normalize an alpha-2 code to canonical uppercase storage form, or `null` when
 * the input is not a real, officially-assigned ISO 3166-1 alpha-2 code.
 */
export function normalizeCountryCode(value) {
  if (!isAlpha2Shape(value)) return null;
  const code = value.trim().toUpperCase();
  return ALPHA2_SET.has(code) ? code : null;
}

/** True only for a real, officially-assigned alpha-2 code (any case). */
export function isValidCountryCode(value) {
  return normalizeCountryCode(value) !== null;
}

/**
 * Reverse lookup: resolve a locale display name to its ISO alpha-2 code.
 * Iterates the full ISO_3166_ALPHA2 set and checks Intl.DisplayNames.
 * Accepts any casing. Returns null when no match is found or Intl is absent.
 */
function resolveDisplayNameToCode(displayName) {
  if (typeof displayName !== 'string' || !displayName.trim()) return null;
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    const needle = displayName.trim().toLowerCase();
    for (const code of ISO_3166_ALPHA2) {
      const name = dn.of(code);
      if (name && name.toLowerCase() === needle) return code;
    }
  } catch {
    // Intl.DisplayNames unavailable — fall through to null
  }
  return null;
}

/**
 * Best-effort coercion accepting either an alpha-2 code OR a display name.
 * Resolution order:
 *   1. Direct normalizeCountryCode (fast path for ISO2 input)
 *   2. LEGACY_NAME_TO_CODE map (common abbreviations/alternate names)
 *   3. Reverse Intl.DisplayNames lookup (handles any locale display name)
 *
 * Returns the canonical alpha-2 code or `null`.
 */
export function coerceCountryCode(value) {
  const direct = normalizeCountryCode(value);
  if (direct) return direct;
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  const legacy = LEGACY_NAME_TO_CODE[key];
  if (legacy) return legacy;
  return resolveDisplayNameToCode(value);
}

/**
 * Locale-aware display name for a country code. Resolution order:
 *   1. `Intl.DisplayNames` (locale-aware, always current) when available;
 *   2. the code itself as a last-resort label.
 *
 * Never throws: an unknown/invalid code returns an empty string.
 *
 * @param {string} value alpha-2 code (or legacy name — coerced first)
 * @param {string|string[]} [locale='en'] BCP-47 locale(s)
 */
export function countryDisplayName(value, locale = 'en') {
  const code = coerceCountryCode(value);
  if (!code) return '';
  try {
    const dn = new Intl.DisplayNames(Array.isArray(locale) ? locale : [locale], {
      type: 'region',
    });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

/**
 * Optional subdivision (region/state/province) support WITHOUT hardcoding any
 * one country's list. A subdivision is validated only for shape here — an
 * ISO 3166-2 code is `<alpha2>-<1..3 alphanumerics>` (e.g. `PK-PB`, `US-CA`,
 * `GB-ENG`). Jurisdiction-specific catalogs are deferred to later missions.
 */
export function isIso31662Shape(value) {
  if (typeof value !== 'string') return false;
  const m = value.trim().toUpperCase().match(/^([A-Z]{2})-([A-Z0-9]{1,3})$/);
  return !!m && ALPHA2_SET.has(m[1]);
}

/** Normalize an ISO 3166-2 subdivision to canonical uppercase, or `null`. */
export function normalizeSubdivisionCode(value) {
  return isIso31662Shape(value) ? value.trim().toUpperCase() : null;
}
