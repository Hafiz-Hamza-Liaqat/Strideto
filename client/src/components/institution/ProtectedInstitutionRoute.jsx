import { Navigate, useLocation } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';

export function ProtectedInstitutionRoute({ children }) {
  const { loading, isAuthenticated } = useInstitutionAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-600" role="status">Loading Institution Portal…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.INSTITUTION_LOGIN} state={{ from: location }} replace />;
  }
  return children;
}
