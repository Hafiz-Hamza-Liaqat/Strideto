import { createUserNotificationOnce } from '../notificationService.js';
import { logger } from '../../utils/logger.js';

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function notifySecurity({ realm, subjectId, type, title, body, link }) {
  if (!subjectId) return { created: false };
  const dedupeKey = `security:${realm}:${String(subjectId)}:${type}:${dayKey()}`;
  const base = {
    category: 'system',
    type,
    title,
    body,
    link,
    dedupeKey,
    criticalSecurity: true,
    skipPreferenceCheck: true,
  };
  try {
    if (realm === 'user') {
      return await createUserNotificationOnce({ ...base, recipientType: 'user', userId: subjectId });
    }
    if (realm === 'employer') {
      return await createUserNotificationOnce({ ...base, recipientType: 'employer', employerId: subjectId });
    }
    if (realm === 'agent') {
      return await createUserNotificationOnce({ ...base, recipientType: 'agent', agentAccountId: subjectId });
    }
    if (realm === 'institution') {
      return await createUserNotificationOnce({
        ...base,
        recipientType: 'institution',
        institutionAccountId: subjectId,
      });
    }
  } catch (err) {
    logger.warn('security_notification_failed', { realm, type, errorClass: err?.name });
  }
  return { created: false };
}

export async function notifyPasswordChanged(realm, subjectId) {
  return notifySecurity({
    realm,
    subjectId,
    type: 'security.password_changed',
    title: 'Password changed',
    body: 'Your password was changed. If this was not you, reset it and review your sessions.',
    link: '/settings',
  });
}

export async function notifyLogoutAllCompleted(realm, subjectId) {
  return notifySecurity({
    realm,
    subjectId,
    type: 'security.logout_all',
    title: 'Signed out of all sessions',
    body: 'All other sessions were revoked. Sign in again on devices you still use.',
    link: '/login',
  });
}
