import { normalizeTimeZone } from '../international/timezone.js';

export const CONSULTATION_STATUSES = Object.freeze({
  REQUESTED: 'requested',
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  RESCHEDULE_REQUESTED: 'reschedule_requested',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  DECLINED: 'declined',
});

export const CONSULTATION_TYPES = Object.freeze({
  INITIAL: 'initial', FOLLOW_UP: 'follow_up', DOCUMENT_REVIEW: 'document_review', OTHER: 'other',
});

export const MEETING_MODES = Object.freeze({
  VIDEO: 'video', AUDIO: 'audio', PHONE: 'phone', IN_PERSON: 'in_person',
  EXTERNAL_LINK: 'external_link', OTHER: 'other',
});

export const CONSULTATION_PAYMENT_STATES = Object.freeze({
  FREE: 'free',
  PAYMENT_REQUIRED_FUTURE: 'payment_required_future',
  PAYMENT_NOT_CONFIGURED: 'payment_not_configured',
  PAYMENT_REQUIRED: 'payment_required',
  PAYMENT_PROCESSING: 'payment_processing',
  PAID: 'paid',
});

export const MESSAGE_TYPES = Object.freeze({
  TEXT: 'text', SYSTEM: 'system', DOCUMENT_REFERENCE: 'document_reference',
});

export const THREAD_STATUSES = Object.freeze({ OPEN: 'open', READ_ONLY: 'read_only', CLOSED: 'closed' });
export const NOTIFICATION_EVENT_STATUSES = Object.freeze({ PENDING: 'pending', CANCELLED: 'cancelled' });

export const CONSULTATION_TRANSITIONS = Object.freeze({
  requested: Object.freeze(['confirmed', 'declined', 'cancelled', 'reschedule_requested']),
  pending_confirmation: Object.freeze(['confirmed', 'declined', 'cancelled', 'reschedule_requested']),
  confirmed: Object.freeze(['reschedule_requested', 'cancelled', 'completed', 'no_show']),
  reschedule_requested: Object.freeze(['confirmed', 'declined', 'cancelled']),
  cancelled: Object.freeze([]), completed: Object.freeze([]), no_show: Object.freeze([]), declined: Object.freeze([]),
});

export const ACTOR_TRANSITIONS = Object.freeze({
  student: Object.freeze(['cancelled', 'reschedule_requested', 'confirmed']),
  agent: Object.freeze(['confirmed', 'declined', 'reschedule_requested', 'cancelled', 'completed', 'no_show']),
});

export function canTransitionConsultation(from, to, actorType) {
  return Boolean(CONSULTATION_TRANSITIONS[from]?.includes(to) && ACTOR_TRANSITIONS[actorType]?.includes(to));
}

export function sanitizeMessageText(value, maxLength = 4000) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function parseLocalTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) <= 23 && Number(match[2]) <= 59 ? minutes : null;
}

export function validateAvailabilityWindows(windows = []) {
  if (!Array.isArray(windows) || windows.length > 21) return { ok: false, error: 'Availability windows must be a bounded list' };
  const normalized = [];
  for (const window of windows) {
    const weekday = Number(window?.weekday);
    const start = parseLocalTime(window?.startLocal);
    const end = parseLocalTime(window?.endLocal);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || start === null || end === null || start >= end) {
      return { ok: false, error: 'Each availability window requires a weekday and valid local start/end time' };
    }
    normalized.push({ weekday, startLocal: window.startLocal, endLocal: window.endLocal, start, end });
  }
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i]; const b = normalized[j];
      if (a.weekday === b.weekday && a.start < b.end && b.start < a.end) {
        return { ok: false, error: 'Availability windows cannot overlap' };
      }
    }
  }
  return { ok: true, value: normalized.map(({ weekday, startLocal, endLocal }) => ({ weekday, startLocal, endLocal })) };
}

export function zonedParts(value, timeZone) {
  const zone = normalizeTimeZone(timeZone);
  const instant = value instanceof Date ? value : new Date(value);
  if (!zone || Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdays[parts.weekday],
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function isSlotInsideAvailability({ start, durationMinutes, timeZone, windows, blockedDates = [] }) {
  const parts = zonedParts(start, timeZone);
  if (!parts || blockedDates.includes(parts.date)) return false;
  return windows.some((window) => {
    const from = parseLocalTime(window.startLocal); const to = parseLocalTime(window.endLocal);
    return window.weekday === parts.weekday && parts.minutes >= from && parts.minutes + durationMinutes <= to;
  });
}

export function messagingAllowed(status, updatedAt, now = new Date(), postConsultationHours = 72) {
  if (!['cancelled', 'completed', 'declined', 'no_show'].includes(status)) return true;
  const closedAt = new Date(updatedAt);
  return !Number.isNaN(closedAt.getTime()) && now.getTime() - closedAt.getTime() <= postConsultationHours * 3600000;
}
