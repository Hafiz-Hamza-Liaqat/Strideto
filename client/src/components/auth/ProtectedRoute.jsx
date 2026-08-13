import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, STAFF_ROLES } from '../../constants';

/**
 * Protects routes that require authentication.
 * requireRole: array of allowed roles. Use requireStaff for admin panel.
 */
export function ProtectedRoute({ children, requireRole, requireStaff }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const { t } = useTranslation(['static', 'common']);

  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">{t('common:loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (requireStaff && !STAFF_ROLES.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('insufficientPermissions')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('noAccessPage')}</p>
      </div>
    );
  }

  if (requireRole && !requireRole.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('insufficientPermissions')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('noAccessPage')}</p>
      </div>
    );
  }

  return children;
}
