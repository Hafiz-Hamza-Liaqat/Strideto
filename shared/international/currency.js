/**
 * Canonical ISO 4217 currency contract (Mission 1 — International Foundation).
 *
 * Currency is validated by shape + a standards-derived allow-set. Human labels
 * come from `Intl.DisplayNames` (locale-aware) rather than a bundled table.
 *
 * Minor units (the number of decimal places a currency subdivides into) are the
 * one thing ECMA-402 does not always expose cheaply and that money accounting
 * MUST get right, so a small, auditable exception table is kept here for the
 * zero-decimal and three-decimal currencies. Everything not listed is treated
 * as the ISO 4217 default of 2 minor-unit digits.
 *
 * No PKR default is embedded: callers always pass an explicit currency.
 *
 * Client- and server-safe: pure JS, only ECMA-402 `Intl`.
 */

/**
 * Standards-derived set of active ISO 4217 alphabetic currency codes.
 * Auditable, uppercase, 3 letters each. This is the validation boundary.
 */
export const ISO_4217_CURRENCIES = Object.freeze([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM',
  'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN',
  'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP',
  'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD',
  'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL',
  'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD',
  'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK',
  'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT',
  'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
  'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU',
  'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR',
  'ZMW', 'ZWL',
]);

const CURRENCY_SET = new Set(ISO_4217_CURRENCIES);

/** ISO 4217 currencies with ZERO minor-unit digits (no fractional subunit). */
export const ZERO_DECIMAL_CURRENCIES = Object.freeze([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX',
  'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/** ISO 4217 currencies with THREE minor-unit digits. */
export const THREE_DECIMAL_CURRENCIES = Object.freeze([
  'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND',
]);

const ZERO_SET = new Set(ZERO_DECIMAL_CURRENCIES);
const THREE_SET = new Set(THREE_DECIMAL_CURRENCIES);

/** True for a syntactically valid 3-letter currency code (any case). */
export function isCurrencyShape(value) {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim());
}

/**
 * Normalize a currency to canonical uppercase storage form, or `null` when the
 * input is not a real, active ISO 4217 alphabetic code.
 */
export function normalizeCurrency(value) {
  if (!isCurrencyShape(value)) return null;
  const code = value.trim().toUpperCase();
  return CURRENCY_SET.has(code) ? code : null;
}

/** True only for a real, active ISO 4217 currency code (any case). */
export function isValidCurrency(value) {
  return normalizeCurrency(value) !== null;
}

/**
 * Number of minor-unit digits for a currency (its ISO 4217 "exponent").
 * Zero-decimal currencies → 0, three-decimal → 3, everything else → 2.
 * Throws for an invalid currency so money math never silently mis-scales.
 */
export function currencyMinorUnits(value) {
  const code = normalizeCurrency(value);
  if (!code) throw new Error(`Invalid currency: ${String(value)}`);
  if (ZERO_SET.has(code)) return 0;
  if (THREE_SET.has(code)) return 3;
  return 2;
}

/** True when a currency has no fractional subunit (integer-only amounts). */
export function isZeroDecimalCurrency(value) {
  return currencyMinorUnits(value) === 0;
}

/**
 * Locale-aware display name for a currency code, or empty string when unknown.
 * @param {string} value ISO 4217 code
 * @param {string|string[]} [locale='en']
 */
export function currencyDisplayName(value, locale = 'en') {
  const code = normalizeCurrency(value);
  if (!code) return '';
  try {
    const dn = new Intl.DisplayNames(Array.isArray(locale) ? locale : [locale], {
      type: 'currency',
    });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}
