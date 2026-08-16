/**
 * Client-side availability helpers. Server remains authoritative for overlap,
 * timezone, and persistence. Client checks are UX guidance only.
 */

export const WEEKDAY_NAMES = Object.freeze([
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]);

/** Mon–Fri 09:00–17:00. Used only when no saved availability exists. */
export const DEFAULT_WORK_WEEK_WINDOWS = Object.freeze(
  [1, 2, 3, 4, 5].map((weekday) => Object.freeze({
    weekday,
    startLocal: '09:00',
    endLocal: '17:00',
  }))
);

export function blankAvailabilityWindow() {
  return { weekday: 1, startLocal: '09:00', endLocal: '17:00' };
}

function parseLocalMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatLocalClock(hhmm) {
  const minutes = parseLocalMinutes(hhmm);
  if (minutes === null) return String(hhmm || '');
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/**
 * Find same-day interval overlaps. Duplicate weekdays without interval overlap
 * are allowed (e.g. Mon 09–12 and Mon 14–17).
 */
export function findOverlappingWindowPairs(windows = []) {
  const pairs = [];
  const list = Array.isArray(windows) ? windows : [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (Number(a?.weekday) !== Number(b?.weekday)) continue;
      const aStart = parseLocalMinutes(a?.startLocal);
      const aEnd = parseLocalMinutes(a?.endLocal);
      const bStart = parseLocalMinutes(b?.startLocal);
      const bEnd = parseLocalMinutes(b?.endLocal);
      if (aStart === null || aEnd === null || bStart === null || bEnd === null) continue;
      if (aStart >= aEnd || bStart >= bEnd) continue;
      if (aStart < bEnd && bStart < aEnd) {
        pairs.push({ i, j, weekday: Number(a.weekday), a, b });
      }
    }
  }
  return pairs;
}

export function describeWindowOverlap(pair) {
  const day = WEEKDAY_NAMES[pair.weekday] || 'Weekday';
  return `${day} ${formatLocalClock(pair.a.startLocal)}–${formatLocalClock(pair.a.endLocal)} overlaps another ${day} window.`;
}

export function humanizeSpecialtySlug(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
