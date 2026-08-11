import { useLocation } from 'react-router-dom';
import { NotificationBellCore } from './NotificationBell';
import { institutionInboxApi } from '../../services/institutionPortalService';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { isInstitutionPortalPath } from '../../auth/institutionAuthRealm';
import { ROUTES } from '../../constants';

export function InstitutionNotificationBell() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useInstitutionAuth();
  const enabled = isInstitutionPortalPath(pathname) && isAuthenticated;
  return (
    <NotificationBellCore
      api={institutionInboxApi}
      enabled={enabled}
      viewAllRoute={ROUTES.INSTITUTION_NOTIFICATIONS}
    />
  );
}
