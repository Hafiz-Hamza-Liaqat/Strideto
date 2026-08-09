/**
 * Notification preference contract (Mission 1 — International Foundation).
 *
 * Additive, future-facing preference vocabulary. It complements the existing
 * `User.notifications` channel booleans (email/push/whatsapp/telegram) — those
 * keep working; this adds the CATEGORY dimension future modules need
 * (scholarships, tests, deadlines, …) plus a channel vocabulary.
 *
 * Two hard rules:
 *   1. Transactional/security communication is SEPARABLE from marketing. A
 *      `promotions` opt-out never silences a security or transactional message.
 *   2. Mission 1 builds NO SMS/push/WhatsApp delivery — only the preference
 *      contract. Delivery is later missions' concern.
 *
 * Client- and server-safe: pure JS.
 */

/** Notification categories users can tune (marketing + product). */
export const NOTIFICATION_CATEGORIES = Object.freeze({
  SCHOLARSHIPS: 'scholarships',
  TESTS: 'tests',
  DEADLINES: 'deadlines',
  APPLICATIONS: 'applications',
  CONSULTANT_MESSAGES: 'consultant_messages',
  APPOINTMENTS: 'appointments',
  JOBS: 'jobs',
  PROMOTIONS: 'promotions',
});

/**
 * Categories that carry transactional/security intent and therefore CANNOT be
 * fully disabled by a marketing opt-out. `promotions` is the only purely
 * marketing category in the base set.
 */
export const TRANSACTIONAL_CATEGORIES = Object.freeze([
  NOTIFICATION_CATEGORIES.APPLICATIONS,
  NOTIFICATION_CATEGORIES.DEADLINES,
  NOTIFICATION_CATEGORIES.APPOINTMENTS,
  NOTIFICATION_CATEGORIES.CONSULTANT_MESSAGES,
]);

/** Delivery channels. `push` and `sms`/`whatsapp` are DECLARED, not delivered. */
export const NOTIFICATION_CHANNELS = Object.freeze({
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push', // future
  SMS: 'sms', // future
  WHATSAPP: 'whatsapp', // future
});

const CATEGORY_SET = new Set(Object.values(NOTIFICATION_CATEGORIES));
const CHANNEL_SET = new Set(Object.values(NOTIFICATION_CHANNELS));
const TRANSACTIONAL_SET = new Set(TRANSACTIONAL_CATEGORIES);

/** True for a known notification category. */
export function isValidCategory(value) {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

/** True for a known channel. */
export function isValidChannel(value) {
  return typeof value === 'string' && CHANNEL_SET.has(value);
}

/** True when a category is transactional/security (not silenceable as marketing). */
export function isTransactionalCategory(value) {
  return TRANSACTIONAL_SET.has(value);
}

/**
 * Validate + normalize a preference map: `{ [category]: { [channel]: boolean } }`.
 * Unknown categories/channels are rejected. Absent entries are simply omitted
 * (callers apply their own defaults). A marketing opt-out on a transactional
 * category is normalized: transactional categories cannot be turned off — the
 * value is coerced back to `true` and the coercion is reported.
 *
 * @returns {{ ok: true, value: object, coerced: string[] } | { ok: false, errors: string[] }}
 */
export function validateNotificationPreferences(input = {}) {
  const errors = [];
  const coerced = [];
  const out = {};

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['preferences must be a plain object'] };
  }

  for (const category of Object.keys(input)) {
    if (!isValidCategory(category)) {
      errors.push(`unknown category: ${category}`);
      continue;
    }
    const channels = input[category];
    if (typeof channels !== 'object' || channels === null || Array.isArray(channels)) {
      errors.push(`category ${category} must map to a channel object`);
      continue;
    }
    const normalizedChannels = {};
    for (const channel of Object.keys(channels)) {
      if (!isValidChannel(channel)) {
        errors.push(`unknown channel: ${channel} (category ${category})`);
        continue;
      }
      let enabled = Boolean(channels[channel]);
      if (!enabled && isTransactionalCategory(category)) {
        enabled = true;
        coerced.push(`${category}.${channel}`);
      }
      normalizedChannels[channel] = enabled;
    }
    out[category] = normalizedChannels;
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: out, coerced };
}
