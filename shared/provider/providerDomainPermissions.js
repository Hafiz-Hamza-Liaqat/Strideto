/**
 * Source-controlled Provider Domain operational permissions (Phase 17D-3R).
 *
 * These grant workspace duties only. They never mint professional verification
 * or ProviderCapability trust.
 */
import { AGENT_CAPABILITIES, capabilitiesForAgentRole } from '../agent/team.js';
import { AGENT_MEMBER_ROLES } from '../agent/constants.js';
import { PROVIDER_DOMAIN_IDS, isKnownProviderDomainId } from './providerDomains.js';

export const PROVIDER_DOMAIN_PERMISSIONS = Object.freeze({
  EDUCATION_VIEW: 'education_mobility.view',
  EDUCATION_SERVICES_MANAGE: 'education_mobility.services.manage',
  EDUCATION_MARKETPLACE_MANAGE: 'education_mobility.marketplace.manage',
  EDUCATION_LEADS_MANAGE: 'education_mobility.leads.manage',
  EDUCATION_CONSULTATIONS_MANAGE: 'education_mobility.consultations.manage',
  EDUCATION_CASES_MANAGE: 'education_mobility.cases.manage',
  BUSINESS_VIEW: 'business_services.view',
  BUSINESS_CAPABILITIES_MANAGE: 'business_services.capabilities.manage',
  BUSINESS_JURISDICTIONS_MANAGE: 'business_services.jurisdictions.manage',
  BUSINESS_LISTINGS_MANAGE: 'business_services.listings.manage',
  BUSINESS_REQUESTS_MANAGE: 'business_services.requests.manage',
  BUSINESS_QUOTES_MANAGE: 'business_services.quotes.manage',
  BUSINESS_CASES_MANAGE: 'business_services.cases.manage',
  BUSINESS_CASE_DOCUMENTS_MANAGE: 'business_services.case_documents.manage',
});

const P = PROVIDER_DOMAIN_PERMISSIONS;

export const PROVIDER_DOMAIN_PERMISSION_GROUPS = Object.freeze({
  [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY]: Object.freeze([
    { permissionId: P.EDUCATION_VIEW, publicLabel: 'Can access workspace', required: true },
    { permissionId: P.EDUCATION_SERVICES_MANAGE, publicLabel: 'Manage services' },
    { permissionId: P.EDUCATION_MARKETPLACE_MANAGE, publicLabel: 'Manage marketplace' },
    { permissionId: P.EDUCATION_LEADS_MANAGE, publicLabel: 'Manage leads' },
    { permissionId: P.EDUCATION_CONSULTATIONS_MANAGE, publicLabel: 'Manage consultations/cases' },
    { permissionId: P.EDUCATION_CASES_MANAGE, publicLabel: 'Manage consultations/cases' },
  ]),
  [PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES]: Object.freeze([
    { permissionId: P.BUSINESS_VIEW, publicLabel: 'Can access workspace', required: true },
    { permissionId: P.BUSINESS_CAPABILITIES_MANAGE, publicLabel: 'Manage capabilities/setup' },
    { permissionId: P.BUSINESS_JURISDICTIONS_MANAGE, publicLabel: 'Manage capabilities/setup' },
    { permissionId: P.BUSINESS_LISTINGS_MANAGE, publicLabel: 'Manage service listings' },
    { permissionId: P.BUSINESS_REQUESTS_MANAGE, publicLabel: 'Manage service requests' },
    { permissionId: P.BUSINESS_QUOTES_MANAGE, publicLabel: 'Manage quotes' },
    { permissionId: P.BUSINESS_CASES_MANAGE, publicLabel: 'Manage cases' },
    {
      permissionId: P.BUSINESS_CASE_DOCUMENTS_MANAGE,
      publicLabel: 'Manage case documents',
      explicitAssignment: true,
    },
  ]),
});

/** Sensitive duties that Owner/Admin must never inherit from role alone. */
export const EXPLICIT_ASSIGNMENT_PERMISSIONS = Object.freeze([
  P.BUSINESS_CASE_DOCUMENTS_MANAGE,
]);

const EXPLICIT_ASSIGNMENT_SET = new Set(EXPLICIT_ASSIGNMENT_PERMISSIONS);

export function permissionRequiresExplicitAssignment(permissionId) {
  return EXPLICIT_ASSIGNMENT_SET.has(permissionId);
}

const PERMISSION_SET = new Set(Object.values(PROVIDER_DOMAIN_PERMISSIONS));

export function isKnownProviderDomainPermission(value) {
  return typeof value === 'string' && PERMISSION_SET.has(value);
}

export function permissionsForDomain(domainId) {
  return (PROVIDER_DOMAIN_PERMISSION_GROUPS[domainId] || []).map((row) => row.permissionId);
}

export function viewPermissionForDomain(domainId) {
  if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) return P.EDUCATION_VIEW;
  if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) return P.BUSINESS_VIEW;
  return null;
}

export function defaultPermissionsForInvite({ domainId, role } = {}) {
  if (!isKnownProviderDomainId(domainId)) return [];
  const view = viewPermissionForDomain(domainId);
  const operational = permissionsForDomain(domainId).filter(
    (id) => !permissionRequiresExplicitAssignment(id)
  );
  if (role === AGENT_MEMBER_ROLES.OWNER || role === AGENT_MEMBER_ROLES.ADMIN) {
    return [...operational];
  }
  if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    return [
      P.EDUCATION_VIEW,
      P.EDUCATION_LEADS_MANAGE,
      P.EDUCATION_CONSULTATIONS_MANAGE,
      P.EDUCATION_CASES_MANAGE,
    ];
  }
  return view ? [view] : [];
}

/**
 * Legacy memberships without domainAccess: map existing role capabilities
 * onto education_mobility only. Never auto-grant business_services.
 */
export function legacyEducationPermissionsForRole(role) {
  const caps = new Set(capabilitiesForAgentRole(role));
  const out = [P.EDUCATION_VIEW];
  if (caps.has(AGENT_CAPABILITIES.SERVICES_MANAGE)) out.push(P.EDUCATION_SERVICES_MANAGE);
  if (caps.has(AGENT_CAPABILITIES.MARKETPLACE_MANAGE)) out.push(P.EDUCATION_MARKETPLACE_MANAGE);
  if (caps.has(AGENT_CAPABILITIES.LEADS_READ)) out.push(P.EDUCATION_LEADS_MANAGE);
  if (caps.has(AGENT_CAPABILITIES.CONSULTATIONS_MANAGE)) out.push(P.EDUCATION_CONSULTATIONS_MANAGE);
  if (caps.has(AGENT_CAPABILITIES.CASES_MANAGE)) out.push(P.EDUCATION_CASES_MANAGE);
  return out;
}

export function normalizeDomainAccessList(raw) {
  if (!Array.isArray(raw)) return [];
  const byDomain = new Map();
  for (const row of raw) {
    const domainId = typeof row?.domainId === 'string' ? row.domainId.trim() : '';
    if (!isKnownProviderDomainId(domainId)) continue;
    const permissions = Array.isArray(row.permissions)
      ? [...new Set(row.permissions.filter(isKnownProviderDomainPermission))]
      : [];
    const view = viewPermissionForDomain(domainId);
    if (view && !permissions.includes(view)) permissions.unshift(view);
    const allowed = new Set(permissionsForDomain(domainId));
    byDomain.set(domainId, {
      domainId,
      permissions: permissions.filter((id) => allowed.has(id)),
    });
  }
  return [...byDomain.values()];
}

export function membershipHasDomainPermission(domainAccess, domainId, permissionId) {
  if (!isKnownProviderDomainId(domainId) || !isKnownProviderDomainPermission(permissionId)) {
    return false;
  }
  const row = (Array.isArray(domainAccess) ? domainAccess : []).find((item) => item.domainId === domainId);
  if (!row) return false;
  const perms = Array.isArray(row.permissions) ? row.permissions : [];
  return perms.includes(viewPermissionForDomain(domainId)) && perms.includes(permissionId);
}

/**
 * Owner/Admin receive operational domain duties from the catalog, except
 * explicit-assignment permissions (Case documents). Those require the
 * permission to be stored on membership.domainAccess. Team duty never mints
 * ProviderCapability.
 */
export function membershipSatisfiesDomainPermission(membership, domainId, permissionId) {
  if (!membership || !isKnownProviderDomainId(domainId) || !isKnownProviderDomainPermission(permissionId)) {
    return false;
  }
  if (permissionRequiresExplicitAssignment(permissionId)) {
    return membershipHasDomainPermission(membership.domainAccess, domainId, permissionId);
  }
  if (membership.role === AGENT_MEMBER_ROLES.OWNER || membership.role === AGENT_MEMBER_ROLES.ADMIN) {
    return permissionsForDomain(domainId).includes(permissionId);
  }
  return membershipHasDomainPermission(membership.domainAccess, domainId, permissionId);
}
