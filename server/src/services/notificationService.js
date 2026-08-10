import { Notification } from '../models/Notification.js';
import { UserNotification } from '../models/UserNotification.js';
import { User } from '../models/User.js';
import { STAFF_ROLES } from '../config/rbac.js';

export async function createNotification(data) {
  return Notification.create(data);
}

/**
 * Create a per-user/employer/staff inbox notification.
 */
export async function createUserNotification({
  recipientType,
  userId,
  employerId,
  category = 'general',
  type,
  title,
  body,
  link,
  metadata,
  dedupeKey,
}) {
  return UserNotification.create({
    recipientType,
    userId,
    employerId,
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

export async function getUnreadCount({ recipientType, userId, employerId }) {
  const filter = { recipientType, read: false };
  if (recipientType === 'user' || recipientType === 'staff') filter.userId = userId;
  if (recipientType === 'employer') filter.employerId = employerId;
  return UserNotification.countDocuments(filter);
}
