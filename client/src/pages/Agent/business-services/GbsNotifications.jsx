import { NotificationsPageContent } from '../../Notifications/NotificationsPage';
import { agentInboxApi } from '../../../services/agentService';
import { ROUTES } from '../../../constants';
import { filterNotificationsForWorkspace } from '../../../config/providerNotificationFilter';

export default function GbsNotifications() {
  return (
    <NotificationsPageContent
      api={agentInboxApi}
      backRoute={ROUTES.AGENT_BUSINESS_SERVICES}
      title="Business Services notifications"
      emptyStateDescription="No Business Services notifications yet. Capability, listing, request, quote, and GbsCase events appear here when they occur. Account-security events tagged system, payment, or support may also appear. Student and consultation events are not shown."
      itemFilter={(item) => filterNotificationsForWorkspace([item], 'business').length === 1}
    />
  );
}
