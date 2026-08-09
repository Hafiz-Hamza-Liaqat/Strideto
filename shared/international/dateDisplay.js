/**
 * Locale-aware date / number DISPLAY helpers (Mission 1 — Foundation).
 *
 * Display only. Persistence stays canonical (UTC instants, integer minor units,
 * ISO codes) — these helpers never change what is stored, only how it is shown.
 * They make NO assumptions about US date order, a Pakistan locale, or the server
 * process timezone: locale and timezone are always explicit arguments.
 *
 * Client- and server-safe: pure JS, only ECMA-402 `Intl`.
 */
import { normalizeTimeZone } from './timezone.js';

/**
 * Format a date for display in an explicit locale + timezone. Falls back to a
 * plain ISO date string if `Intl` rejects the options. Returns '' for a
 * missing/unparseable value.
 *
 * @param {Date|string|number} value
 * @param {{ locale?: string, timeZone?: string, dateStyle?: string }} [opts]
 */
export function formatDate(value, { locale = 'en', timeZone, dateStyle = 'medium' } = {}) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const zone = timeZone ? normalizeTimeZone(timeZone) : null;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle,
      ...(zone ? { timeZone: zone } : {}),
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Format a plain number for display in an explicit locale.
 * @param {number} value
 * @param {{ locale?: string, maximumFractionDigits?: number }} [opts]
 */
export function formatNumber(value, { locale = 'en', maximumFractionDigits } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      ...(maximumFractionDigits != null ? { maximumFractionDigits } : {}),
    }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a Money value (integer minor units + ISO currency) for display, in an
 * explicit locale, using the currency's own minor-unit scale. This is the one
 * display helper that understands the Money contract; it imports lazily-safe
 * pure helpers so it stays side-effect free.
 *
 * @param {{ amountMinor: number, currency: string }} money
 * @param {{ locale?: string }} [opts]
 */
export function formatMoney(money, { locale = 'en' } = {}) {
  if (!money || typeof money !== 'object') return '';
  const { amountMinor, currency } = money;
  if (!Number.isSafeInteger(amountMinor) || typeof currency !== 'string') return '';
  const code = currency.trim().toUpperCase();
  try {
    // Let Intl determine the minor-unit scale for the currency itself.
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amountMinor / 10 ** digits);
  } catch {
    return `${amountMinor} ${code}`;
  }
}
