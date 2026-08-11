/**
 * Employer organization team contract (Phase 4).
 *
 * Server-derived roles. Client may hide UI from capabilities but must never
 * treat client-supplied organizationId/role as authority.
 */

export const EMPLOYER_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  RECRUITER: 'recruiter',
  VIEWER: 'viewer',
});

const ROLE_SET = new Set(Object.values(EMPLOYER_ROLES));
export const isValidEmployerRole = (v) => typeof v === 'string' && ROLE_SET.has(v);

export const EMPLOYER_INVITE_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const EMPLOYER_CAPABILITIES = Object.freeze({
  DASHBOARD_READ: 'dashboard.read',
  JOBS_READ: 'jobs.read',
  JOBS_WRITE: 'jobs.write',
  APPLICATIONS_READ: 'applications.read',
  APPLICATIONS_WRITE: 'applications.write',
  PIPELINE_READ: 'pipeline.read',
  PIPELINE_WRITE: 'pipeline.write',
  INTERVIEWS_READ: 'interviews.read',
  INTERVIEWS_WRITE: 'interviews.write',
  ANALYTICS_READ: 'analytics.read',
  NOTIFICATIONS_READ: 'notifications.read',
  NOTIFICATIONS_WRITE: 'notifications.write',
  VERIFICATION_READ: 'verification.read',
  VERIFICATION_SUBMIT: 'verification.submit',
  TEAM_READ: 'team.read',
  TEAM_MANAGE: 'team.manage',
  BILLING_READ: 'billing.read',
  USAGE_READ: 'usage.read',
  ORG_MANAGE: 'org.manage',
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',
});

const C = EMPLOYER_CAPABILITIES;
const R = EMPLOYER_ROLES;

const ROLE_CAPABILITIES = Object.freeze({
  [R.OWNER]: Object.freeze(Object.values(C)),
  [R.ADMIN]: Object.freeze([
    C.DASHBOARD_READ,
    C.JOBS_READ,
    C.JOBS_WRITE,
    C.APPLICATIONS_READ,
    C.APPLICATIONS_WRITE,
    C.PIPELINE_READ,
    C.PIPELINE_WRITE,
    C.INTERVIEWS_READ,
    C.INTERVIEWS_WRITE,
    C.ANALYTICS_READ,
    C.NOTIFICATIONS_READ,
    C.NOTIFICATIONS_WRITE,
    C.VERIFICATION_READ,
    C.VERIFICATION_SUBMIT,
    C.TEAM_READ,
    C.TEAM_MANAGE,
    C.USAGE_READ,
    C.ORG_MANAGE,
    C.SETTINGS_READ,
    C.SETTINGS_WRITE,
  ]),
  [R.RECRUITER]: Object.freeze([
    C.DASHBOARD_READ,
    C.JOBS_READ,
    C.JOBS_WRITE,
    C.APPLICATIONS_READ,
    C.APPLICATIONS_WRITE,
    C.PIPELINE_READ,
    C.PIPELINE_WRITE,
    C.INTERVIEWS_READ,
    C.INTERVIEWS_WRITE,
    C.ANALYTICS_READ,
    C.NOTIFICATIONS_READ,
    C.NOTIFICATIONS_WRITE,
    C.USAGE_READ,
    C.SETTINGS_READ,
    C.SETTINGS_WRITE,
  ]),
  [R.VIEWER]: Object.freeze([
    C.DASHBOARD_READ,
    C.JOBS_READ,
    C.APPLICATIONS_READ,
    C.PIPELINE_READ,
    C.INTERVIEWS_READ,
    C.ANALYTICS_READ,
    C.NOTIFICATIONS_READ,
    C.USAGE_READ,
    C.SETTINGS_READ,
    C.SETTINGS_WRITE,
  ]),
});

export function capabilitiesForEmployerRole(role) {
  return ROLE_CAPABILITIES[role] || Object.freeze([]);
}

export function employerRoleHasCapability(role, capability) {
  return capabilitiesForEmployerRole(role).includes(capability);
}

/** Admin cannot change Owner membership; only Owner may alter Owner seats. */
export function canChangeMemberRole({ actorRole, targetRole, nextRole }) {
  if (!isValidEmployerRole(actorRole) || !isValidEmployerRole(targetRole) || !isValidEmployerRole(nextRole)) {
    return false;
  }
  if (actorRole === R.OWNER) return true;
  if (actorRole !== R.ADMIN) return false;
  if (targetRole === R.OWNER || nextRole === R.OWNER) return false;
  return true;
}

export function canRemoveMember({ actorRole, targetRole }) {
  if (!isValidEmployerRole(actorRole) || !isValidEmployerRole(targetRole)) return false;
  if (actorRole === R.OWNER) return true;
  if (actorRole !== R.ADMIN) return false;
  return targetRole !== R.OWNER;
}

export function isLastOwnerProtected({ targetRole, activeOwnerCount, nextRole }) {
  if (targetRole !== R.OWNER) return false;
  if (activeOwnerCount > 1) return false;
  if (nextRole && nextRole !== R.OWNER) return true;
  if (!nextRole) return true;
  return false;
}

export const EMPLOYER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const EMPLOYER_INVITE_EMAIL_MAX = 254;
export const EMPLOYER_SEARCH_QUERY_MAX = 200;
