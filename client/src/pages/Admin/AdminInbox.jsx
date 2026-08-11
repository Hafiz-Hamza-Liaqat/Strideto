import { NotificationsPageContent } from '../Notifications/NotificationsPage';
import { inboxApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';

export default function AdminInbox() {
  return (
    <AdminRouteGuard>
      <div className="min-w-0 -mx-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 px-4 pt-2">
          Staff in-app inbox. Unread counts come from stored notifications. No email is sent.
        </p>
        <NotificationsPageContent
          api={inboxApi}
          backRoute={`${ROUTES.ADMIN}/sc/overview`}
          emptyStateDescription="No staff notifications yet. Verification and claim events appear here when review is required."
        />
      </div>
    </AdminRouteGuard>
  );
}
