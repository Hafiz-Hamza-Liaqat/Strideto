import { Navigate, useLocation } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';

export function ProtectedAgentRoute({ children }) {
  const { loading, isAuthenticated } = useAgentAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading agent portal…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AGENT_LOGIN} state={{ from: location }} replace />;
  }
  return children;
}
