/**
 * Canonical IANA timezone contract (Mission 1 — International Foundation).
 *
 * This mirrors and generalizes the accepted B3 employer-interview timezone
 * architecture (server/src/utils/appointmentTime.js) so future modules —
 * consultations, institution events, deadlines, the journey planner, alerts —
 * share one validator/formatter instead of re-deriving zone handling each time.
 *
 * Non-negotiables carried over from B3:
 *   - A UTC instant and a timezone identity are SEPARATE concepts. Persist the
 *     instant as UTC; persist the zone identifier alongside it explicitly.
 *   - Never rely on the server process timezone (`process.env.TZ`) for
 *     user-facing scheduling.
 *   - Fixed offsets (`+05:00`) are rejected: an offset is not a zone and cannot
 *     survive a DST boundary.
 *
 * The employer interview path deliberately keeps its own copy of these helpers;
 * this shared module is for NEW modules and does not modify that accepted code.
 *
 * Client- and server-safe: pure JS, only ECMA-402 `Intl`.
 */

/**
 * A tz database identifier: `Area/Location`, optionally `Area/Sub/Location`,
 * plus the bare `UTC` that `Intl` also accepts.
 */
const IANA_SHAPE = /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/;

/**
 * True only for identifiers this runtime can actually format with. The shape
 * test rejects offsets and junk; `Intl` then rejects well-shaped names that are
 * not in the tz database (`Mars/Phobos`) without us bundling a timezone table.
 */
export function isValidTimeZone(value) {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw || !IANA_SHAPE.test(raw)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
    return true;
  } catch {
    return false;
  }
}

/** Normalized identifier, or `null` when the input is not a usable IANA zone. */
export function normalizeTimeZone(value) {
  if (!isValidTimeZone(value)) return null;
  return value.trim();
}

/**
 * Render a UTC instant as a wall clock in an explicit zone. When `timeZone` is
 * absent/invalid, falls back to UTC and labels it (the smallest truthful option
 * — we never silently guess a friendlier-looking local time). Returns `null`
 * for a missing/unparseable instant so callers avoid printing `Invalid Date`.
 *
 * @param {Date|string|number} value UTC instant
 * @param {string} timeZone IANA zone identifier
 * @param {{ locale?: string }} [opts]
 */
export function formatInstantInZone(value, timeZone, { locale = 'en-US' } = {}) {
  if (value == null || value === '') return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  const zone = normalizeTimeZone(timeZone) || 'UTC';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: zone,
      timeZoneName: 'short',
    }).format(instant);
  } catch {
    return instant.toISOString();
  }
}
