/**
 * Notification preference runtime policy (Phase 1).
 *
 * Evaluates whether an in-app (or future channel) delivery should proceed
 * given user preferences. Critical security/trust events are never
 * suppressible via marketing opt-out.
 */
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  isTransactionalCategory,
  isValidCategory,
  isValidChannel,
} from '../international/notificationPreferences.js';

/** Categories that must always deliver in-app regardless of user opt-out. */
export const MANDATORY_IN_APP_CATEGORIES = Object.freeze([
  'security',
  'verification',
  'system',
  'trust',
]);

/** Map legacy UserNotification.category values to preference categories. */
export const LEGACY_CATEGORY_TO_PREFERENCE = Object.freeze({
  application: NOTIFICATION_CATEGORIES.APPLICATIONS,
  applications: NOTIFICATION_CATEGORIES.APPLICATIONS,
  job: NOTIFICATION_CATEGORIES.JOBS,
  jobs: NOTIFICATION_CATEGORIES.JOBS,
  scholarship: NOTIFICATION_CATEGORIES.SCHOLARSHIPS,
  scholarships: NOTIFICATION_CATEGORIES.SCHOLARSHIPS,
  test: NOTIFICATION_CATEGORIES.TESTS,
  tests: NOTIFICATION_CATEGORIES.TESTS,
  deadline: NOTIFICATION_CATEGORIES.DEADLINES,
  deadlines: NOTIFICATION_CATEGORIES.DEADLINES,
  consultation: NOTIFICATION_CATEGORIES.CONSULTANT_MESSAGES,
  appointment: NOTIFICATION_CATEGORIES.APPOINTMENTS,
  promotion: NOTIFICATION_CATEGORIES.PROMOTIONS,
  promotions: NOTIFICATION_CATEGORIES.PROMOTIONS,
  verification: 'verification',
  security: 'security',
  system: 'system',
  trust: 'trust',
  general: NOTIFICATION_CATEGORIES.APPLICATIONS,
});

export function resolvePreferenceCategory(notificationCategory) {
  if (!notificationCategory) return NOTIFICATION_CATEGORIES.APPLICATIONS;
  const key = String(notificationCategory).toLowerCase();
  return LEGACY_CATEGORY_TO_PREFERENCE[key] || key;
}

/**
 * Decide whether a notification should be created/delivered on a channel.
 *
 * @param {object} params
 * @param {string} params.category - UserNotification.category or event category
 * @param {string} params.channel - NOTIFICATION_CHANNELS value
 * @param {object} [params.preferences] - normalized category→channel map
 * @param {boolean} [params.criticalSecurity] - force deliver
 * @returns {{ deliver: boolean, reason: string }}
 */
export function evaluateNotificationDelivery({
  category,
  channel = NOTIFICATION_CHANNELS.IN_APP,
  preferences = {},
  criticalSecurity = false,
} = {}) {
  if (!isValidChannel(channel)) {
    return { deliver: false, reason: 'unknown_channel' };
  }

  const prefCategory = resolvePreferenceCategory(category);

  if (criticalSecurity || MANDATORY_IN_APP_CATEGORIES.includes(prefCategory)) {
    if (channel === NOTIFICATION_CHANNELS.IN_APP) {
      return { deliver: true, reason: 'mandatory_in_app' };
    }
    return { deliver: true, reason: 'critical_security' };
  }

  if (isTransactionalCategory(prefCategory)) {
    const channelPrefs = preferences[prefCategory];
    if (channelPrefs && channelPrefs[channel] === false) {
      return { deliver: false, reason: 'transactional_coerced_off_attempt' };
    }
    return { deliver: true, reason: 'transactional_default_on' };
  }

  if (!isValidCategory(prefCategory)) {
    return { deliver: true, reason: 'unknown_category_default_on' };
  }

  const channelPrefs = preferences[prefCategory];
  if (!channelPrefs) {
    return { deliver: true, reason: 'no_preference_default_on' };
  }

  if (channelPrefs[channel] === false) {
    return { deliver: false, reason: 'user_opted_out' };
  }

  return { deliver: true, reason: 'preference_allowed' };
}
