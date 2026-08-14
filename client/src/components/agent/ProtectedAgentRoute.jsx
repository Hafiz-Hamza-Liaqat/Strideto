import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { agentApi } from '../../services/agentService';

export function ProtectedAgentRoute({ children }) {
  const { loading, isAuthenticated } = useAgentAuth();
  const location = useLocation();
  const [gate, setGate] = useState({ checked: false, needsOnboarding: false });

  useEffect(() => {
    if (!isAuthenticated) {
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
