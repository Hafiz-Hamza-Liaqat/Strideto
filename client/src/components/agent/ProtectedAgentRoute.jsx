import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { agentApi } from '../../services/agentService';
import { WorkspaceComingSoon } from '../launch/WorkspaceComingSoon';
import {
  WORKSPACE_LAUNCH_IDS,
  isEducationMobilityWorkspaceLaunched,
  isBusinessServicesWorkspaceLaunched,
  isAnyProviderWorkspaceLaunched,
} from '../../config/workspaceLaunchGates';

function resolveAgentPathWorkspace(pathname) {
  const path = pathname || '';
  if (path.startsWith(ROUTES.AGENT_BUSINESS_SERVICES)) {
    return WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES;
  }
  // Education workspace + legacy education redirects + education onboarding wizard.
  if (
    path.startsWith(ROUTES.AGENT_EDUCATION) ||
    path === ROUTES.AGENT_ONBOARDING ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/profile`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/services`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/marketplace`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/consultations`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/cases`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/leads`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/clients`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/availability`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/verification`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/reviews`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/trust`)
  ) {
    return WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY;
  }
  // Provider home, domain onboarding, shared settings — need at least one domain launched.
  if (
    path === ROUTES.AGENT_DASHBOARD ||
    path === `${ROUTES.AGENT_DASHBOARD}/` ||
    path.startsWith(ROUTES.AGENT_DOMAIN_ONBOARDING) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/team`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/messages`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/notifications`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/help`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/settings`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/commerce`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/usage-billing`) ||
    path.startsWith(`${ROUTES.AGENT_DASHBOARD}/guidelines`)
  ) {
    return 'provider_home';
  }
  return WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY;
}

export function ProtectedAgentRoute({ children }) {
  const { loading, isAuthenticated } = useAgentAuth();
  const location = useLocation();
  const [gate, setGate] = useState({ checked: false, needsOnboarding: false });

  const pathWorkspace = resolveAgentPathWorkspace(location.pathname);

  useEffect(() => {
    if (!isAuthenticated) {
      setGate({ checked: true, needsOnboarding: false });
      return;
    }
    if (!isAnyProviderWorkspaceLaunched()) {
      setGate({ checked: true, needsOnboarding: false });
      return;
    }
    let cancelled = false;
    agentApi.getProviderDomainContext()
      .then(({ data }) => {
        if (!cancelled) setGate({ checked: true, needsOnboarding: data?.needsOnboarding === true });
      })
      .catch(() => {
        if (!cancelled) setGate({ checked: true, needsOnboarding: false });
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, location.pathname]);

  if (pathWorkspace === WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES && !isBusinessServicesWorkspaceLaunched()) {
    return <WorkspaceComingSoon workspaceId={WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES} />;
  }
  if (pathWorkspace === WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY && !isEducationMobilityWorkspaceLaunched()) {
    return <WorkspaceComingSoon workspaceId={WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY} />;
  }
  if (pathWorkspace === 'provider_home' && !isAnyProviderWorkspaceLaunched()) {
    return <WorkspaceComingSoon workspaceId={WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY} />;
  }

  if (loading && !isAuthenticated) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading provider portal…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AGENT_LOGIN} state={{ from: location }} replace />;
  }
  const onDomainOnboarding = location.pathname.startsWith(ROUTES.AGENT_DOMAIN_ONBOARDING)
    || location.pathname === ROUTES.AGENT_ONBOARDING;
  if (gate.checked && gate.needsOnboarding && !onDomainOnboarding) {
    return <Navigate to={ROUTES.AGENT_DOMAIN_ONBOARDING} replace />;
  }
  return children;
}
