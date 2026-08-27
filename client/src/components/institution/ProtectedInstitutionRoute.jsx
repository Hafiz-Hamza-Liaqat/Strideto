import { Navigate, useLocation } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { WorkspaceComingSoon } from '../launch/WorkspaceComingSoon';
import {
  WORKSPACE_LAUNCH_IDS,
  isInstitutionWorkspaceLaunched,
} from '../../config/workspaceLaunchGates';

export function ProtectedInstitutionRoute({ children }) {
  const { loading, isAuthenticated } = useInstitutionAuth();
  const location = useLocation();

  // Launch gate precedes auth/dashboard mount and private API fan-out.
  if (!isInstitutionWorkspaceLaunched()) {
    return <WorkspaceComingSoon workspaceId={WORKSPACE_LAUNCH_IDS.INSTITUTION} />;
  }

  if (loading && !isAuthenticated) {
    return <div className="grid min-h-screen place-items-center text-slate-600" role="status">Loading Institution Portal…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.INSTITUTION_LOGIN} state={{ from: location }} replace />;
  }
  return children;
}
