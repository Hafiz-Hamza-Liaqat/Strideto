/**
 * Provider Domain HTTP handlers (Phase 17D-3R).
 */
import {
  addProviderDomain,
  completeProviderDomainOnboarding,
  getProviderHomeSummary,
  listAgencyActivatedDomains,
  resolveAccessibleWorkspaces,
} from '../services/gbs/providerDomainService.js';
import {
  isBusinessServicesProviderEnabled,
  isBusinessServicesPublicMarketplaceEnabled,
} from '../../../shared/gbs/constants.js';
import { listProviderDomains, publicProviderDomainProjection } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSION_GROUPS } from '../../../shared/provider/providerDomainPermissions.js';
import {
  WORKSPACE_LAUNCH_IDS,
  isWorkspaceLaunched,
} from '../../../shared/launch/workspaceLaunchGates.js';

function actorFrom(req) {
  return {
    id: req.agent?.agentAccountId,
    agentAccountId: req.agent?.agentAccountId,
    role: 'agent',
    isStaff: false,
    subjectType: 'agent',
    subjectId: req.agent?.agentAccountId,
  };
}

function sendError(res, err) {
  const status = err.status || 500;
  const payload = { error: err.code || err.message || 'server_error' };
  if (err.unknown) payload.unknown = err.unknown;
  if (err.errors) payload.details = err.errors;
  return res.status(status).json(payload);
}

export async function getCatalog(_req, res) {
  const educationLaunched = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, process.env);
  const businessLaunched = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, process.env);
  const businessEnabled = businessLaunched && isBusinessServicesProviderEnabled(process.env);
  return res.json({
    domains: listProviderDomains().map((d) => {
      if (d.domainId === WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY) {
        return {
          ...publicProviderDomainProjection(d.domainId),
          selectable: educationLaunched,
          comingSoon: !educationLaunched,
        };
      }
      if (d.domainId === WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES) {
        return {
          ...publicProviderDomainProjection(d.domainId),
          selectable: businessEnabled,
          comingSoon: !businessEnabled,
        };
      }
      return {
        ...publicProviderDomainProjection(d.domainId),
        selectable: false,
        comingSoon: true,
      };
    }),
    businessServicesProviderEnabled: businessEnabled,
    publicMarketplaceEnabled: isBusinessServicesPublicMarketplaceEnabled(process.env),
    permissionGroups: PROVIDER_DOMAIN_PERMISSION_GROUPS,
  });
}

export async function getHome(req, res) {
  try {
    const summary = await getProviderHomeSummary(req.agent.agentAccountId);
    return res.json(summary);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getContext(req, res) {
  try {
    const resolved = await resolveAccessibleWorkspaces(req.agent.agentAccountId);
    return res.json(resolved);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function completeOnboarding(req, res) {
  try {
    const result = await completeProviderDomainOnboarding({
      agentAccountId: req.agent.agentAccountId,
      domainIds: req.body?.domainIds || req.body?.providerDomainIds,
      actor: actorFrom(req),
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function addDomain(req, res) {
  try {
    const result = await addProviderDomain({
      agentAccountId: req.agent.agentAccountId,
      subjectType: req.body?.subjectType,
      subjectId: req.body?.subjectId,
      domainId: req.body?.domainId,
      actor: actorFrom(req),
    });
    return res.status(result.alreadyActive ? 200 : 201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getAgencyDomains(req, res) {
  try {
    const domainIds = await listAgencyActivatedDomains(req.query.organizationId);
    return res.json({ domainIds, domains: domainIds.map(publicProviderDomainProjection) });
  } catch (err) {
    return sendError(res, err);
  }
}
