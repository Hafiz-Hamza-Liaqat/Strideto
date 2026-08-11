/**
 * Agent / Agency team contract (Phase 5).
 * Reuses Mission-11 roles: owner, admin, member. No second taxonomy.
 */

import { AGENT_MEMBER_ROLES } from './constants.js';

export const AGENT_INVITE_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const AGENT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const AGENT_INVITE_EMAIL_MAX = 254;

export const AGENT_INVITABLE_ROLES = Object.freeze([
  AGENT_MEMBER_ROLES.ADMIN,
  AGENT_MEMBER_ROLES.MEMBER,
]);

export const AGENT_CAPABILITIES = Object.freeze({
  DASHBOARD_READ: 'dashboard.read',
  PROFILE_WRITE: 'profile.write',
  VERIFICATION_READ: 'verification.read',
  VERIFICATION_SUBMIT: 'verification.submit',
  SERVICES_MANAGE: 'services.manage',
  MARKETPLACE_MANAGE: 'marketplace.manage',
  LEADS_READ: 'leads.read',
  CLIENTS_READ: 'clients.read',
  CONSULTATIONS_MANAGE: 'consultations.manage',
  CASES_MANAGE: 'cases.manage',
  TEAM_READ: 'team.read',
  TEAM_MANAGE: 'team.manage',
  BILLING_READ: 'billing.read',
  SETTINGS_WRITE: 'settings.write',
});

const C = AGENT_CAPABILITIES;
const R = AGENT_MEMBER_ROLES;

const ROLE_CAPABILITIES = Object.freeze({
  [R.OWNER]: Object.values(C),
  [R.ADMIN]: [
    C.DASHBOARD_READ,
    C.PROFILE_WRITE,
    C.VERIFICATION_READ,
    C.VERIFICATION_SUBMIT,
    C.SERVICES_MANAGE,
    C.MARKETPLACE_MANAGE,
    C.LEADS_READ,
    C.CLIENTS_READ,
    C.CONSULTATIONS_MANAGE,
    C.CASES_MANAGE,
    C.TEAM_READ,
    C.TEAM_MANAGE,
    C.BILLING_READ,
    C.SETTINGS_WRITE,
  ],
  [R.MEMBER]: [
    C.DASHBOARD_READ,
    C.VERIFICATION_READ,
    C.LEADS_READ,
    C.CLIENTS_READ,
    C.CONSULTATIONS_MANAGE,
    C.CASES_MANAGE,
    C.TEAM_READ,
    C.BILLING_READ,
  ],
});

export function capabilitiesForAgentRole(role) {
  return ROLE_CAPABILITIES[role] ? [...ROLE_CAPABILITIES[role]] : [];
}

export function agentRoleHasCapability(role, capability) {
  return capabilitiesForAgentRole(role).includes(capability);
}

export function isInvitableAgentRole(role) {
  return AGENT_INVITABLE_ROLES.includes(role);
}
