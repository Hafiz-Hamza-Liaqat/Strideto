import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { agentInboxApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import {
  filterNotificationsForWorkspace,
  rewriteNotificationLinkForWorkspace,
} from '../../config/providerNotificationFilter';

export default function EducationNotifications() {
  return (
    <NotificationsPageContent
      api={agentInboxApi}
      backRoute={ROUTES.AGENT_EDUCATION}
      title="Education notifications"
      emptyStateDescription="No Education notifications yet. Education verification, marketplace, leads, consultations, ProfessionalCase, and reviews appear here. Account-security events tagged system, payment, or support may also appear."
      itemFilter={(item) => filterNotificationsForWorkspace([item], 'education').length === 1}
      rewriteLink={(link) => rewriteNotificationLinkForWorkspace(link, 'education')}
    />
  );
}
