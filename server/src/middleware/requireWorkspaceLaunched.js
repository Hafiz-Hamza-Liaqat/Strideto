/**
 * Server-authoritative staged-workspace launch middleware.
 * Request body / query / headers cannot override launch state.
 */
import {
  WORKSPACE_LAUNCH_IDS,
  isWorkspaceLaunched,
  workspaceComingSoonBody,
} from '../../../shared/launch/workspaceLaunchGates.js';

export { WORKSPACE_LAUNCH_IDS };

export function requireWorkspaceLaunched(workspaceId) {
  return function workspaceLaunchGate(req, res, next) {
    if (!isWorkspaceLaunched(workspaceId, process.env)) {
      return res.status(403).json(workspaceComingSoonBody(workspaceId));
    }
    return next();
  };
}

export const requireInstitutionWorkspaceLaunched = requireWorkspaceLaunched(
  WORKSPACE_LAUNCH_IDS.INSTITUTION
);

export const requireEducationMobilityWorkspaceLaunched = requireWorkspaceLaunched(
  WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY
);

export const requireBusinessServicesWorkspaceLaunched = requireWorkspaceLaunched(
  WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES
);

/**
 * Shared provider APIs: allow when Education and/or Business workspace is launched.
 */
export function requireAnyProviderWorkspaceLaunched(req, res, next) {
  const eduOk = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, process.env);
  const bizOk = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, process.env);
  if (!eduOk && !bizOk) {
    return res.status(403).json(workspaceComingSoonBody(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY));
  }
  return next();
}

/**
 * Agent registration: enforce launch against the server-resolved domain set.
 * Empty domain lists fail closed (invite/body omission cannot bypass).
 * Request-supplied domains alone are never trusted — callers must pass
 * invite domainAccess and/or validated selection results.
 */
export function assertAgentRegistrationDomainsLaunched(domainIds) {
  const ids = Array.isArray(domainIds) ? [...new Set(domainIds.filter(Boolean))] : [];
  const eduOk = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, process.env);
  const bizOk = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, process.env);

  if (!eduOk && !bizOk) {
    return { ok: false, workspace: WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY };
  }

  if (ids.length === 0) {
    return { ok: false, workspace: WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY };
  }

  for (const id of ids) {
    if (id === WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY && !eduOk) {
      return { ok: false, workspace: WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY };
    }
    if (id === WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES && !bizOk) {
      return { ok: false, workspace: WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES };
    }
  }
  return { ok: true };
}
