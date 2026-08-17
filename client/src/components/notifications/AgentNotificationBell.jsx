import { useLocation } from 'react-router-dom';
import { NotificationBellCore } from './NotificationBell';
import { agentInboxApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { isAgentPortalPath } from '../../auth/agentAuthRealm';
import { ROUTES } from '../../constants';
import { resolveProviderNavDomain } from '../../config/agentNavConfig';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

export function AgentNotificationBell() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAgentAuth();
  const enabled = isAgentPortalPath(pathname) && isAuthenticated;
  const domainId = resolveProviderNavDomain(pathname);
  const viewAllRoute = domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
    ? ROUTES.AGENT_BUSINESS_SERVICES_NOTIFICATIONS
    : domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY
      ? ROUTES.AGENT_EDUCATION_NOTIFICATIONS
      : `${ROUTES.AGENT_DASHBOARD}?home=1`;
  return (
    <NotificationBellCore
      api={agentInboxApi}
      enabled={enabled}
      viewAllRoute={viewAllRoute}
    />
  );
}
