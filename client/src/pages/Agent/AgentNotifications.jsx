import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { agentInboxApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

export default function AgentNotifications() {
  return (
    <NotificationsPageContent
      api={agentInboxApi}
      backRoute={ROUTES.AGENT_DASHBOARD}
      emptyStateDescription="No Agent notifications yet. Verification, leads, consultations, cases, messages, trust, and commerce events appear here when they occur."
    />
  );
}
