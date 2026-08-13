import { Navigate, useLocation } from 'react-router-dom';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';

export function ProtectedEmployerRoute({ children }) {
  const { employer, loading, isAuthenticated } = useEmployerAuth();
  const location = useLocation();

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !employer) {
    return <Navigate to={ROUTES.EMPLOYER_LOGIN} state={{ from: location }} replace />;
  }

  return children;
}
