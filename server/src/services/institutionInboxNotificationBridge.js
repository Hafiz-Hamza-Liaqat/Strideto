/**
 * Institution-realm inbox fan-out (Phase 6). In-app only. Never throws into callers.
 * No email, SMS, push, or worker enqueue.
 */
import { InstitutionMembership } from '../models/institution/InstitutionMembership.js';
import { createUserNotificationOnce } from './notificationService.js';
import { INSTITUTION_ROLES } from '../../../shared/institution/institutionPortal.js';

async function finishQuietly(fn) {
  try {
    return await fn();
  } catch {
    return { created: false };
  }
}

export async function notifyInstitutionAccount({
  institutionAccountId,
  type,
  title,
  body,
  link,
  category = 'system',
  dedupeKey,
  metadata,
} = {}) {
  if (!institutionAccountId || !type || !title) return { created: false };
  return finishQuietly(() => createUserNotificationOnce({
    recipientType: 'institution',
    institutionAccountId,
    category,
    type,
    title,
    body,
    link,
    metadata,
    dedupeKey,
  }));
}

export async function notifyInstitutionOrganizationOwners({
  organizationId,
  roles = [INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN],
  ...payload
} = {}) {
  if (!organizationId) return { created: 0 };
  const members = await InstitutionMembership.find({
    organizationId,
    active: true,
    role: { $in: roles },
  }).select('institutionAccountId').lean();
  let created = 0;
  for (const member of members) {
    const outcome = await notifyInstitutionAccount({
      ...payload,
      institutionAccountId: member.institutionAccountId,
      dedupeKey: payload.dedupeKey
        ? `${payload.dedupeKey}:institution:${member.institutionAccountId}`
        : undefined,
    });
    if (outcome?.created) created += 1;
  }
  return { created };
}
