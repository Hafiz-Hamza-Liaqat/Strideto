import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { institutionInboxApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';

export default function InstitutionNotifications() {
  return (
    <NotificationsPageContent
      api={institutionInboxApi}
      backRoute={ROUTES.INSTITUTION_DASHBOARD}
      emptyStateDescription="No Institution notifications yet. Verification, canonical claim, admissions, team, and data-quality events appear here when they occur."
    />
  );
}
