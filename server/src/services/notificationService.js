import { Notification } from '../models/Notification.js';
import { UserNotification } from '../models/UserNotification.js';
import { User } from '../models/User.js';
import { ROLES, STAFF_ROLES } from '../config/rbac.js';
import { evaluateNotificationDelivery } from '../../../shared/platform/notificationPreferencePolicy.js';
import { NOTIFICATION_CHANNELS } from '../../../shared/international/notificationPreferences.js';

export async function createNotification(data) {
  return Notification.create(data);
}

/**
 * Create a per-user/employer/staff inbox notification.
 * Respects user notification preferences for non-mandatory categories.
 */
export async function createUserNotification({
  recipientType,
  userId,
  employerId,
  agentAccountId,
  institutionAccountId,
  category = 'general',
  type,
  title,
  body,
  link,
  metadata,
  dedupeKey,
  criticalSecurity = false,
  channel = NOTIFICATION_CHANNELS.IN_APP,
  skipPreferenceCheck = false,
}) {
  if (!skipPreferenceCheck && recipientType === 'user' && userId) {
    const user = await User.findById(userId).select('notificationPreferences').lean();
    const decision = evaluateNotificationDelivery({
      category,
      channel,
      preferences: user?.notificationPreferences || {},
      criticalSecurity,
    });
    if (!decision.deliver) {
      return null;
    }
  }

  return UserNotification.create({
    recipientType,
    userId,
    employerId,
    agentAccountId,
    institutionAccountId,
    category,
    type,
    title,
    body,
    link,
    metadata,
    dedupeKey,
  });
}

/**
 * Create a notification at most once for a given `dedupeKey`.
 *
 * Relies on the unique partial index rather than a read-then-write check, so two
 * concurrent producers racing on the same authoritative transition cannot both
 * pass a "does it exist yet?" test. The loser sees duplicate-key (11000) and is
 * reported as a no-op — not an error, because the notification the caller
 * wanted does exist.
 *
 * @returns {Promise<{ created: boolean, notification: object|null }>}
 */
export async function createUserNotificationOnce(payload) {
  if (!payload?.dedupeKey) {
    const notification = await createUserNotification(payload);
    return { created: true, notification };
  }
  try {
    const notification = await createUserNotification(payload);
    return { created: true, notification };
  } catch (err) {
    const isDedupeConflict =
      err?.code === 11000 &&
      (err?.keyPattern?.dedupeKey === 1 ||
        err?.keyValue?.dedupeKey === payload.dedupeKey ||
        err?.message?.includes('user_notification_dedupe_unique'));
    if (isDedupeConflict) {
      const existing = await UserNotification.findOne({ dedupeKey: payload.dedupeKey }).lean();
      return { created: false, notification: existing || null };
    }
    throw err;
  }
}

export async function notifyUser(userId, payload) {
  return createUserNotification({ recipientType: 'user', userId, ...payload });
}

export async function notifyEmployer(employerId, payload) {
  return createUserNotification({ recipientType: 'employer', employerId, ...payload });
}

export async function notifyAgent(agentAccountId, payload) {
  return createUserNotification({ recipientType: 'agent', agentAccountId, ...payload });
}

export async function notifyInstitution(institutionAccountId, payload) {
  return createUserNotification({ recipientType: 'institution', institutionAccountId, ...payload });
}

/** Notify all staff users (admins, moderators, editors). */
export async function notifyStaff(payload) {
  const staff = await User.find({ role: { $in: STAFF_ROLES } }).select('_id').lean();
  if (!staff.length) return [];
  const docs = staff.map((u) => ({
    recipientType: 'staff',
    userId: u._id,
    category: payload.category || 'system',
    type: payload.type,
    title: payload.title,
    body: payload.body,
    link: payload.link,
    metadata: payload.metadata,
  }));
  return UserNotification.insertMany(docs);
}

/** Notify Admin and SuperAdmin users only (narrower than notifyStaff). */
export async function notifyAdminStaff(payload) {
  const admins = await User.find({
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  }).select('_id').lean();
  if (!admins.length) return [];
  const docs = admins.map((u) => ({
    recipientType: 'staff',
    userId: u._id,
    category: payload.category || 'system',
    type: payload.type,
    title: payload.title,
    body: payload.body,
    link: payload.link,
    metadata: payload.metadata,
    dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}:staff:${u._id}` : undefined,
  }));
  return UserNotification.insertMany(docs, { ordered: false });
}

export async function getUnreadCount({ recipientType, userId, employerId, agentAccountId, institutionAccountId }) {
  const filter = { recipientType, read: false };
  if (recipientType === 'user' || recipientType === 'staff') filter.userId = userId;
  if (recipientType === 'employer') filter.employerId = employerId;
  if (recipientType === 'agent') filter.agentAccountId = agentAccountId;
  if (recipientType === 'institution') filter.institutionAccountId = institutionAccountId;
  return UserNotification.countDocuments(filter);
}
