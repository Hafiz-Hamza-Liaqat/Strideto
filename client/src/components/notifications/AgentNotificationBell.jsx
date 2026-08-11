import { useLocation } from 'react-router-dom';
import { NotificationBellCore } from './NotificationBell';
import { agentInboxApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { isAgentPortalPath } from '../../auth/agentAuthRealm';
import { ROUTES } from '../../constants';

export function AgentNotificationBell() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAgentAuth();
  const enabled = isAgentPortalPath(pathname) && isAuthenticated;
  return (
    <NotificationBellCore
      api={agentInboxApi}
      enabled={enabled}
      viewAllRoute={ROUTES.AGENT_NOTIFICATIONS}
    />
  );
}
