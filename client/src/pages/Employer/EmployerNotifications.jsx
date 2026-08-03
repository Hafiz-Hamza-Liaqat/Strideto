import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { employerInboxApi } from '../../services/employerService';
import { ROUTES } from '../../constants';

/**
 * /employer/notifications — already protected by the parent EMPLOYER_DASHBOARD
 * route (ProtectedEmployerRoute + EmployerLayout wrap all its children), so
 * this page needs no protection wrapper of its own.
 */
export default function EmployerNotifications() {
  return (
    <NotificationsPageContent
      api={employerInboxApi}
      backRoute={ROUTES.EMPLOYER_DASHBOARD}
      emptyStateDescription="You'll see updates here when your job listings are reviewed, approved, or need attention."
    />
  );
}
