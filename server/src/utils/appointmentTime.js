/**
 * PF-EMP-INT-B3B: appointment time identity.
 *
 * An interview instant on its own is not enough to communicate an appointment. The
 * Employer picks a wall clock in their own zone; the server stores the resolved UTC
 * instant; and every candidate-facing message then has to re-render that instant in
 * *some* zone. Before this module that zone was whatever the API container happened
 * to run in — UTC on staging — so an interview booked for 7:30 PM Asia/Karachi was
 * announced to the candidate as 2:30 PM with no zone label at all.
 *
 * These helpers make the rendering zone an explicit property of the appointment
 * rather than a property of the process. `process.env.TZ` is deliberately never
 * consulted, and no regional default is inferred: an appointment either carries a
 * zone the Employer's browser stated, or it is rendered in UTC and says so.
 */

/**
 * A tz database identifier: `Area/Location`, optionally `Area/Sub/Location`, plus the
 * bare `UTC` that `Intl` also accepts. Fixed offsets such as `+05:00` are rejected on
 * purpose — an offset is not a zone, it cannot survive a DST boundary, and accepting
 * one would let a caller store something we could not re-render correctly later.
 */
const IANA_SHAPE = /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/;

/**
 * True only for identifiers this runtime can actually format with. The shape test
 * rejects offsets and obvious junk; `Intl` then rejects well-shaped names that are not
 * in the tz database (`Mars/Phobos`), which is the check that keeps us honest without
 * bundling a timezone table.
 */
export function isValidIanaTimeZone(value) {
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
  if (!isValidIanaTimeZone(value)) return null;
  return value.trim();
}

/**
 * Render an instant as the wall clock a candidate should actually turn up at.
 *
 * `timeZone` is the appointment's own zone. When it is absent — every appointment
 * written before this phase — we fall back to UTC and label it, which is the smallest
 * truthful option available: we genuinely do not know what the Employer intended, so
 * we state an unambiguous instant instead of guessing a friendlier-looking one.
 *
 * Returns `null` for a missing or unparseable instant so callers can keep their own
 * "details were updated" wording rather than printing `Invalid Date`.
 */
export function formatAppointmentTime(value, timeZone, { locale = 'en-US' } = {}) {
  if (!value) return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  const zone = normalizeTimeZone(timeZone) || 'UTC';
  const isFallbackZone = !normalizeTimeZone(timeZone);

  let text;
  try {
    // Explicit components rather than dateStyle/timeStyle: ECMA-402 forbids combining
    // those shorthands with `timeZoneName`, and the resulting RangeError would silently
    // drop every appointment into the fallback below.
    text = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: zone,
      timeZoneName: 'short',
    }).format(instant);
  } catch {
    // A zone that validated at write time but is unknown to this runtime: still
    // better to emit a labelled UTC instant than to leak the container's zone.
    text = `${instant.toISOString()} (UTC)`;
    return { text, zone: 'UTC', iso: instant.toISOString(), isFallbackZone: true };
  }

  // `timeZoneName: 'short'` renders zones without a common abbreviation as a GMT
  // offset (`GMT+5`), which is accurate but does not say *which* zone. Appending the
  // identifier keeps the candidate able to check the time themselves.
  const label = text.includes(zone) ? text : `${text} (${zone})`;

  return { text: label, zone, iso: instant.toISOString(), isFallbackZone };
}
