import { useLocation } from 'react-router-dom';
import { NotificationBellCore } from './NotificationBell';
import { employerInboxApi } from '../../services/employerService';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { isEmployerPortalPath } from '../../auth/authRealm';
import { ROUTES } from '../../constants';

/** Employer-realm bell — same core as the User bell, Employer-scoped data/auth. */
export function EmployerNotificationBell() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useEmployerAuth();
  const enabled = isEmployerPortalPath(pathname) && isAuthenticated;
  return (
    <NotificationBellCore
      api={employerInboxApi}
      enabled={enabled}
      viewAllRoute={ROUTES.EMPLOYER_NOTIFICATIONS}
    />
  );
}
