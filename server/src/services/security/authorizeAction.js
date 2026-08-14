/**
 * Shared server-side authorization primitives (Phase 17D-1).
 *
 * Evaluation order: auth → global security → active capability → membership/tenant
 * → object → workflow/policy → abuse → optimistic concurrency → perform + audit.
 *
 * Workspace / preference / headers never authorize.
 */
import {
  authorizeAction,
  AUTH_DECISION_CODES,
} from '../../../../shared/security/authorizeAction.js';
import {
  resolveSecurityAccess,
  securityAccessAllows,
  SECURITY_ACCESS,
} from '../../../../shared/security/securityAccess.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { ORGANIZATION_CAPABILITY_IDS } from '../../../../shared/capability/organizationCapabilities.js';
import { POLICY_ACTIONS } from '../../../../shared/capability/permissionPolicy.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { resolveUserCapabilitiesForRequest, getUserCapabilityService } from '../capability/userCapabilityRuntime.js';
import { resolveOrganizationCapabilitiesForRequest } from '../capability/organizationCapabilityRuntime.js';

export {
  authorizeAction,
  resolveSecurityAccess,
  securityAccessAllows,
  AUTH_DECISION_CODES,
  SECURITY_ACCESS,
  POLICY_ACTIONS,
};

function denyBody(decision) {
  return {
    error: decision.message,
    code: decision.code,
  };
}

export async function loadUserRecordForAuth(req) {
  if (req.userRecord) return req.userRecord;
  if (!req.user?.userId) return null;
  const { User } = await import('../../models/User.js');
  const record = await User.findById(req.user.userId)
    .select('role accountStatus capabilitySchemaVersion capabilityInitializationState tokenVersion')
    .lean();
  req.userRecord = record;
  if (record && req.user) {
    req.user.accountStatus = record.accountStatus;
    req.user.capabilitySchemaVersion = record.capabilitySchemaVersion ?? 0;
    req.user.capabilityInitializationState = record.capabilityInitializationState;
    req.user.role = record.role || req.user.role;
  }
  return record;
}

export async function authorizeUserCapability(req, capabilityId, { actionId } = {}) {
  if (req.employer) {
    const decision = authorizeAction({
      authenticated: true,
      employerPrincipal: true,
      principal: req.employer,
      denyEmployerCookie: true,
      requiredUserCapability: capabilityId,
      actionId,
      activeWorkspace: req.body?.activeWorkspace || req.headers?.['x-active-workspace'],
    });
    await logAudit({
      action: GBS_AUDIT_EVENTS.CAPABILITY_DENIED,
      status: 'failure',
      metadata: redactAuditMetadata({ reason: decision.code, capabilityId }),
    });
    return decision;
  }

  const userRecord = await loadUserRecordForAuth(req);
  if (!req.user) {
    return authorizeAction({ authenticated: false });
  }

  const security = resolveSecurityAccess(userRecord || req.user);
  if (!securityAccessAllows(security)) {
    await logAudit({
      action: GBS_AUDIT_EVENTS.SECURITY_DENIED,
      status: 'failure',
      targetId: String(req.user.userId || ''),
      metadata: redactAuditMetadata({ reason: security.reason, capabilityId }),
    });
    return {
      allowed: false,
      code: AUTH_DECISION_CODES.SECURITY_DENIED,
      status: 403,
      message: 'Security denied',
    };
  }

  const resolved = await resolveUserCapabilitiesForRequest(req);
  const service = getUserCapabilityService();
  const hasCap = service.hasActiveUserCapability(resolved, capabilityId);
  const decision = authorizeAction({
    authenticated: true,
    principal: userRecord || req.user,
    employerPrincipal: false,
    requiredUserCapability: capabilityId,
    activeUserCapabilities: hasCap ? [capabilityId, ...resolved.active] : resolved.active,
    actionId,
    activeWorkspace: req.body?.activeWorkspace || req.headers?.['x-active-workspace'],
    preference: req.body?.preference,
  });
  if (!decision.allowed && decision.code === AUTH_DECISION_CODES.CAPABILITY_DENIED) {
    await logAudit({
      action: GBS_AUDIT_EVENTS.CAPABILITY_DENIED,
      status: 'failure',
      targetId: String(req.user.userId || ''),
      metadata: redactAuditMetadata({ capabilityId }),
    });
  }
  return decision;
}

export async function authorizeGbsBuyerAction(req, extra = {}) {
  return authorizeUserCapability(req, USER_CAPABILITY_IDS.BUSINESS_CLIENT, {
    actionId: POLICY_ACTIONS.GBS_BUYER_ACTION,
    ...extra,
  });
}

export async function authorizeGbsOrganizationBuyerAction(req, { organization, membership } = {}) {
  const userDecision = await authorizeUserCapability(req, USER_CAPABILITY_IDS.BUSINESS_CLIENT, {
    actionId: POLICY_ACTIONS.GBS_ORGANIZATION_BUYER_ACTION,
  });
  if (!userDecision.allowed) return userDecision;

  const orgResolved = await resolveOrganizationCapabilitiesForRequest(req, organization || {});
  return authorizeAction({
    authenticated: true,
    principal: req.userRecord || req.user,
    organization,
    membership: membership === true,
    requiredUserCapability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    requiredOrganizationCapability: ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT,
    activeUserCapabilities: [USER_CAPABILITY_IDS.BUSINESS_CLIENT],
    activeOrganizationCapabilities: orgResolved.active,
    actionId: POLICY_ACTIONS.GBS_ORGANIZATION_BUYER_ACTION,
    employerPrincipal: Boolean(req.employer),
  });
}

export { denyBody };
