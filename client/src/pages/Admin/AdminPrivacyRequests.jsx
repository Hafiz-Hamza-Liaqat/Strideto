import { Link } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';

export default function AdminPrivacyRequests() {
  return (
    <AdminRouteGuard permission={PERMISSIONS.USERS_READ}>
      <div className="space-y-4 min-w-0 max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Privacy / legal requests</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Support and privacy handling does not require SuperAdmin access. Staff see only data necessary for the assigned task. Actions are audited. Immediate destructive account deletion is not available from this portal.
        </p>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <p className="font-semibold">Operational queue on this surface</p>
          <p>
            Account export and deletion request contracts exist in the shared platform foundation. The Student-facing operational queue is Phase 3. This page does not invent a fake request list.
          </p>
          <p>Use Support tickets for abuse and user-initiated requests that already exist.</p>
          <Link to={`${ROUTES.ADMIN}/support`} className="inline-flex min-h-[44px] items-center text-primary dark:text-mint underline">
            Open support / user requests
          </Link>
        </div>
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-semibold">Fail-closed privacy boundaries</p>
          <ul className="list-disc list-inside space-y-1">
            <li>SuperAdmin is not universal access to the Student Vault.</li>
            <li>Private Copilot conversations are not visible here.</li>
            <li>Student Budget contents are not visible here.</li>
            <li>Private Agent notes and cases require explicit privileged-support authority and audit.</li>
            <li>Reporter identity is not shown on Trust reports unless policy requires it.</li>
          </ul>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
