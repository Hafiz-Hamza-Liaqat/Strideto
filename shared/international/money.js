/**
 * Canonical Money contract (Mission 1 — International Foundation).
 *
 * A Money value is an integer count of a currency's *minor units* travelling
 * together with its ISO 4217 currency code. Representing amounts as integer
 * minor units (e.g. 1050 = $10.50, 1050 = ¥1050 for zero-decimal JPY) means
 * irreversible payment accounting never depends on IEEE-754 floating point.
 *
 *   { amountMinor: <safe integer>, currency: <ISO 4217, uppercase> }
 *
 * This is a contract + helpers, NOT a payment integration. Existing Job price /
 * Payment fields are deliberately NOT rewritten in Mission 1 — `fromDecimal` /
 * `toDecimal` adapters let future Commerce migrate legacy decimal amounts
 * incrementally.
 *
 * Client- and server-safe: pure JS.
 */
import {
  normalizeCurrency,
  currencyMinorUnits,
} from './currency.js';

/**
 * Build a validated Money object from an integer minor-unit amount.
 * Throws on a non-integer/unsafe amount or an invalid currency so bad money can
 * never enter the system silently.
 *
 * @param {number} amountMinor integer count of minor units (may be negative)
 * @param {string} currency ISO 4217 code
 * @returns {{ amountMinor: number, currency: string }}
 */
export function makeMoney(amountMinor, currency) {
  const code = normalizeCurrency(currency);
  if (!code) throw new Error(`Invalid currency: ${String(currency)}`);
  if (typeof amountMinor !== 'number' || !Number.isInteger(amountMinor)) {
    throw new Error('Money amountMinor must be an integer number of minor units');
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('Money amountMinor exceeds safe integer range');
  }
  return Object.freeze({ amountMinor, currency: code });
}

/** True when a value is a structurally valid Money object. */
export function isMoney(value) {
  if (!value || typeof value !== 'object') return false;
  return (
    Number.isSafeInteger(value.amountMinor) &&
    normalizeCurrency(value.currency) === value.currency
  );
}

/** Validate an untrusted candidate, returning normalized Money or `null`. */
export function parseMoney(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    return makeMoney(value.amountMinor, value.currency);
  } catch {
    return null;
  }
}

/**
 * Adapter: build Money from a human/decimal amount (e.g. "10.50", 10.5) using
 * the currency's minor-unit scale. Rounds half away from zero. For migrating
 * legacy decimal price fields — not for accumulating new payment ledgers.
 */
export function fromDecimal(decimalAmount, currency) {
  const code = normalizeCurrency(currency);
  if (!code) throw new Error(`Invalid currency: ${String(currency)}`);
  const n = typeof decimalAmount === 'string' ? Number(decimalAmount) : decimalAmount;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('fromDecimal requires a finite numeric amount');
  }
  const scale = 10 ** currencyMinorUnits(code);
  // Round half away from zero, then epsilon-nudge to defeat 1.005-style FP noise.
  const scaled = n * scale;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON);
  return makeMoney(rounded, code);
}

/**
 * Adapter: render Money back to a decimal string for display or legacy interop.
 * Deterministic and fixed to the currency's minor-unit count. Never used for
 * arithmetic — arithmetic stays in integer minor units.
 */
export function toDecimalString(money) {
  const m = parseMoney(money);
  if (!m) throw new Error('toDecimalString requires a valid Money value');
  const digits = currencyMinorUnits(m.currency);
  const negative = m.amountMinor < 0;
  const abs = Math.abs(m.amountMinor).toString().padStart(digits + 1, '0');
  const whole = abs.slice(0, abs.length - digits) || '0';
  const frac = digits > 0 ? `.${abs.slice(abs.length - digits)}` : '';
  return `${negative ? '-' : ''}${whole}${frac}`;
}

/**
 * Deterministic canonical serialization: `"<amountMinor> <CURRENCY>"`. Stable,
 * sortable within a currency, and safe to persist/compare. Round-trips via
 * `deserializeMoney`.
 */
export function serializeMoney(money) {
  const m = parseMoney(money);
  if (!m) throw new Error('serializeMoney requires a valid Money value');
  return `${m.amountMinor} ${m.currency}`;
}

/** Inverse of `serializeMoney`; returns normalized Money or `null`. */
export function deserializeMoney(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(-?\d+)\s+([A-Za-z]{3})$/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isSafeInteger(amount)) return null;
  return parseMoney({ amountMinor: amount, currency: m[2] });
}

/**
 * Add two Money values of the SAME currency. Refuses mixed-currency addition —
 * cross-currency conversion needs an explicit rate and is out of Mission 1 scope.
 */
export function addMoney(a, b) {
  const x = parseMoney(a);
  const y = parseMoney(b);
  if (!x || !y) throw new Error('addMoney requires two valid Money values');
  if (x.currency !== y.currency) {
    throw new Error(`Cannot add ${x.currency} and ${y.currency} without a conversion rate`);
  }
  return makeMoney(x.amountMinor + y.amountMinor, x.currency);
}
