import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { agentInboxApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

export default function AgentNotifications() {
  return (
    <NotificationsPageContent
      api={agentInboxApi}
      backRoute={ROUTES.AGENT_DASHBOARD}
      emptyStateDescription="No Provider notifications yet. Verification, cases, messages, trust, commerce, and workspace events appear here when they occur."
    />
  );
}
