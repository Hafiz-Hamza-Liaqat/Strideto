/**
 * Shared authorization decision contract (Phase 17D-1).
 *
 * Canonical evaluation order from the frozen lock:
 * 1. Authentication
 * 2. Global/account security state
 * 3. Required active capability grant
 * 4. Membership / tenant
 * 5. Object authorization
 * 6. Workflow / policy
 * 7. Abuse / resource budget
 * 8. Optimistic concurrency
 * 9. Perform + audit
 *
 * No frontend property may override server capability state.
 * activeWorkspace / preference / localStorage have ZERO authority.
 */
import { securityAccessAllows, resolveSecurityAccess, SECURITY_ACCESS } from './securityAccess.js';
import { grantStatusAuthorizes } from '../capability/grantStatus.js';
import { isKnownUserCapability } from '../capability/userCapabilities.js';
import { isKnownOrganizationCapability } from '../capability/organizationCapabilities.js';
import { getActionPolicy, isKnownPolicyAction, AUTH_REALMS } from '../capability/permissionPolicy.js';

export const AUTH_DECISION_CODES = Object.freeze({
  ALLOWED: 'allowed',
  UNAUTHENTICATED: 'unauthenticated',
  SECURITY_DENIED: 'security_denied',
  CAPABILITY_DENIED: 'capability_denied',
  UNKNOWN_CAPABILITY: 'unknown_capability',
  TENANT_DENIED: 'tenant_denied',
  OBJECT_DENIED: 'object_denied',
  POLICY_DENIED: 'policy_denied',
  EMPLOYER_COOKIE_DENIED: 'employer_cookie_denied',
  WORKSPACE_PREFERENCE_IGNORED: 'workspace_preference_has_zero_authority',
});

function deny(code, status = 403, message = 'Forbidden') {
  return Object.freeze({
    allowed: false,
    code,
    status,
    message,
    policyVersion: null,
  });
}

function allow(extra = {}) {
  return Object.freeze({
    allowed: true,
    code: AUTH_DECISION_CODES.ALLOWED,
    status: 200,
    message: 'ok',
    ...extra,
  });
}

export function ignoreWorkspacePreference(_value) {
  return AUTH_DECISION_CODES.WORKSPACE_PREFERENCE_IGNORED;
}

/**
 * Tenant / object authorization primitive. Unknown relationship denies.
 * Sequential public identifiers are not authority — callers pass opaque ids.
 */
export function authorizeTenantScope({ principalTenantId, resourceTenantId } = {}) {
  if (principalTenantId == null || resourceTenantId == null || principalTenantId === '' || resourceTenantId === '') {
    return deny(AUTH_DECISION_CODES.TENANT_DENIED, 403, 'Unknown tenant');
  }
  if (String(principalTenantId) !== String(resourceTenantId)) {
    return deny(AUTH_DECISION_CODES.TENANT_DENIED, 403, 'Wrong tenant');
  }
  return allow();
}

/**
 * Evaluate a source-controlled action against a resolved authorization context.
 * Context must be built from server-authoritative state only.
 *
 * @param {{
 *   authenticated?: boolean,
 *   realm?: string,
 *   employerPrincipal?: boolean,
 *   principal?: object,
 *   organization?: object,
 *   activeUserCapabilities?: string[],
 *   activeOrganizationCapabilities?: string[],
 *   membership?: boolean,
 *   principalTenantId?: string,
 *   resourceTenantId?: string,
 *   objectAuthorized?: boolean,
 *   actionId?: string,
 *   requiredUserCapability?: string,
 *   requiredOrganizationCapability?: string,
 *   activeWorkspace?: string,
 *   preference?: string,
 * }} ctx
 */
export function authorizeAction(ctx = {}) {
  ignoreWorkspacePreference(ctx.activeWorkspace || ctx.preference);

  if (ctx.authenticated === false || ctx.authenticated == null && !ctx.principal) {
    return deny(AUTH_DECISION_CODES.UNAUTHENTICATED, 401, 'Authentication required');
  }

  const policy = ctx.actionId ? getActionPolicy(ctx.actionId) : null;
  if (ctx.actionId && !isKnownPolicyAction(ctx.actionId)) {
    return deny(AUTH_DECISION_CODES.POLICY_DENIED, 403, 'Unknown action');
  }

  if ((policy?.denyEmployerCookie || ctx.denyEmployerCookie) && ctx.employerPrincipal) {
    return deny(AUTH_DECISION_CODES.EMPLOYER_COOKIE_DENIED, 403, 'Employer session cannot authorize this action');
  }

  if (policy?.realm === AUTH_REALMS.EMPLOYER && ctx.actionId) {
    // Hiring-only realm: never treat as GBS buyer.
    if (ctx.requiredUserCapability || policy.requiredUserCapability) {
      return deny(AUTH_DECISION_CODES.EMPLOYER_COOKIE_DENIED, 403, 'Employer cookie is not GBS buyer authority');
    }
  }

  const security = resolveSecurityAccess(ctx.principal || {});
  if (!securityAccessAllows(security)) {
    return deny(AUTH_DECISION_CODES.SECURITY_DENIED, 403, 'Security denied');
  }
  if (ctx.organization) {
    const orgSecurity = resolveSecurityAccess(ctx.organization);
    if (!securityAccessAllows(orgSecurity)) {
      return deny(AUTH_DECISION_CODES.SECURITY_DENIED, 403, 'Security denied');
    }
  }

  const requiredUserCap = ctx.requiredUserCapability || policy?.requiredUserCapability;
  if (requiredUserCap) {
    if (!isKnownUserCapability(requiredUserCap)) {
      return deny(AUTH_DECISION_CODES.UNKNOWN_CAPABILITY, 403, 'Unknown capability');
    }
    const active = Array.isArray(ctx.activeUserCapabilities) ? ctx.activeUserCapabilities : [];
    if (!active.includes(requiredUserCap)) {
      return deny(AUTH_DECISION_CODES.CAPABILITY_DENIED, 403, 'Capability denied');
    }
  }

  const requiredOrgCap = ctx.requiredOrganizationCapability || policy?.requiredOrganizationCapability;
  if (requiredOrgCap) {
    if (!isKnownOrganizationCapability(requiredOrgCap)) {
      return deny(AUTH_DECISION_CODES.UNKNOWN_CAPABILITY, 403, 'Unknown capability');
    }
    if (policy?.requireMembership || ctx.requireMembership) {
      if (ctx.membership !== true) {
        return deny(AUTH_DECISION_CODES.TENANT_DENIED, 403, 'Membership required');
      }
    }
    const orgActive = Array.isArray(ctx.activeOrganizationCapabilities)
      ? ctx.activeOrganizationCapabilities
      : [];
    if (!orgActive.includes(requiredOrgCap)) {
      return deny(AUTH_DECISION_CODES.CAPABILITY_DENIED, 403, 'Organization capability denied');
    }
  }

  if (ctx.resourceTenantId !== undefined || ctx.principalTenantId !== undefined) {
    const tenant = authorizeTenantScope({
      principalTenantId: ctx.principalTenantId,
      resourceTenantId: ctx.resourceTenantId,
    });
    if (!tenant.allowed) return tenant;
  }

  if (ctx.objectAuthorized === false) {
    return deny(AUTH_DECISION_CODES.OBJECT_DENIED, 403, 'Object authorization denied');
  }

  return allow({
    policyVersion: policy?.policyVersion || ctx.policyVersion || null,
    realm: ctx.realm || policy?.realm || null,
    requiredUserCapability: requiredUserCap || null,
    requiredOrganizationCapability: requiredOrgCap || null,
  });
}

export function hasActiveGrant(grants, capabilityId) {
  if (!Array.isArray(grants)) return false;
  return grants.some(
    (g) => g.capability === capabilityId && grantStatusAuthorizes(g.status)
  );
}
