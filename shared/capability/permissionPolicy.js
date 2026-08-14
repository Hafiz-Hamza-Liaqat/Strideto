/**
 * Source-controlled authorization policy foundation (Phase 17D-1).
 *
 * Core cross-resource authority is NOT editable Admin content.
 * Operational config (rate limits, SLAs, feature flags) remains separate.
 */
import { USER_CAPABILITY_IDS } from './userCapabilities.js';
import { ORGANIZATION_CAPABILITY_IDS } from './organizationCapabilities.js';

export const PERMISSION_POLICY_VERSION = '17d-1.0';

export const AUTH_REALMS = Object.freeze({
  USER: 'user',
  EMPLOYER: 'employer',
  AGENT: 'agent',
  INSTITUTION: 'institution',
  STAFF: 'staff',
});

export const POLICY_ACTIONS = Object.freeze({
  STUDENT_APPLICATION_WRITE: 'student.application.write',
  STUDENT_PRODUCT_WRITE: 'student.product.write',
  GBS_BUYER_ACTION: 'gbs.buyer.action',
  GBS_ORGANIZATION_BUYER_ACTION: 'gbs.organization.buyer.action',
  GBS_PROVIDER_ACTION: 'gbs.provider.action',
  ADMIN_PROVIDER_VERIFICATION: 'admin.provider.verification',
  EMPLOYER_HIRING_ACTION: 'employer.hiring.action',
});

/**
 * Frozen evaluation requirements. Employer cookie never grants GBS buyer authority.
 */
export const ACTION_POLICY = Object.freeze({
  [POLICY_ACTIONS.STUDENT_APPLICATION_WRITE]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.USER,
    requiredUserCapability: USER_CAPABILITY_IDS.STUDENT,
    denyEmployerCookie: true,
    denyUnknownCapability: true,
  }),
  [POLICY_ACTIONS.STUDENT_PRODUCT_WRITE]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.USER,
    requiredUserCapability: USER_CAPABILITY_IDS.STUDENT,
    denyEmployerCookie: true,
    denyUnknownCapability: true,
  }),
  [POLICY_ACTIONS.GBS_BUYER_ACTION]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.USER,
    requiredUserCapability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    denyEmployerCookie: true,
    denyUnknownCapability: true,
  }),
  [POLICY_ACTIONS.GBS_ORGANIZATION_BUYER_ACTION]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.USER,
    requiredUserCapability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    requiredOrganizationCapability: ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT,
    requireMembership: true,
    denyEmployerCookie: true,
    denyUnknownCapability: true,
  }),
  [POLICY_ACTIONS.GBS_PROVIDER_ACTION]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.AGENT,
    requireExactProviderSubject: true,
    denyEmployerCookie: true,
  }),
  [POLICY_ACTIONS.ADMIN_PROVIDER_VERIFICATION]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.STAFF,
    requireStaffRbac: true,
    denyEmployerCookie: true,
  }),
  [POLICY_ACTIONS.EMPLOYER_HIRING_ACTION]: Object.freeze({
    policyVersion: PERMISSION_POLICY_VERSION,
    realm: AUTH_REALMS.EMPLOYER,
    denyGbsBuyerViaEmployerCookie: true,
  }),
});

export function getActionPolicy(actionId) {
  return ACTION_POLICY[actionId] || null;
}

export function isKnownPolicyAction(actionId) {
  return Boolean(ACTION_POLICY[actionId]);
}
