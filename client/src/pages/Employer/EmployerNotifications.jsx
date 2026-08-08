import { useTranslation } from 'react-i18next';
import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { employerInboxApi } from '../../services/employerService';
import { ROUTES } from '../../constants';

/**
 * /employer/notifications — already protected by the parent EMPLOYER_DASHBOARD
 * route (ProtectedEmployerRoute + EmployerLayout wrap all its children), so
 * this page needs no protection wrapper of its own.
 */
export default function EmployerNotifications() {
  const { t } = useTranslation(['employer']);
  return (
    <NotificationsPageContent
      api={employerInboxApi}
      backRoute={ROUTES.EMPLOYER_DASHBOARD}
      emptyStateDescription={t('employer:notificationsEmptyDescription')}
    />
  );
}
