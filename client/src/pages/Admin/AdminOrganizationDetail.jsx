import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminOrganization } from '../../services/adminSuperControlApi';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { PERMISSIONS } from '../../config/rbac';

export default function AdminOrganizationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAdminOrganization(id)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AdminRouteGuard permission={PERMISSIONS.ORGANIZATIONS_READ}>
      <div className="space-y-4 min-w-0">
        <Link to="/admin/sc/organizations" className="text-sm text-primary dark:text-mint underline">← Organizations</Link>
        {loading && <p className="text-sm text-gray-500" aria-busy="true">Loading organization…</p>}
        {error && <p className="text-red-600 dark:text-red-400 text-sm" role="alert">{error}</p>}
        {data?.organization && (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white break-words">{data.organization.displayName}</h1>
            <p className="text-xs text-gray-500">Safe operational inventory. Confidential evidence is not shown here.</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Legal name</dt><dd className="text-gray-900 dark:text-white">{data.organization.legalName || '—'}</dd></div>
              <div><dt className="text-gray-500">Type</dt><dd>{data.organization.organizationType}</dd></div>
              <div><dt className="text-gray-500">Country</dt><dd>{data.organization.countryCode || '—'}</dd></div>
              <div><dt className="text-gray-500">Lifecycle</dt><dd>{data.organization.status}</dd></div>
              <div><dt className="text-gray-500">Verification</dt><dd><AdminStatusBadge value={data.verificationSummary?.status} label={(data.verificationSummary?.status || 'none').replace(/_/g, ' ')} /></dd></div>
              <div><dt className="text-gray-500">Canonical claim</dt><dd>{data.canonicalClaimSummary?.state || '—'}</dd></div>
              <div><dt className="text-gray-500">Created</dt><dd>{data.organization.createdAt ? new Date(data.organization.createdAt).toLocaleString() : '—'}</dd></div>
            </dl>
            {data.verificationSummary && (
              <Link className="inline-block min-h-[44px] text-sm text-primary dark:text-mint underline" to={`/admin/verification-queue?org=${id}`}>
                Open verification dossier
              </Link>
            )}
            {data.canonicalClaimSummary && (
              <Link className="inline-block min-h-[44px] text-sm text-primary dark:text-mint underline ml-4" to={`/admin/sc/claims?claim=${data.canonicalClaimSummary._id}`}>
                Open canonical claim
              </Link>
            )}
          </>
        )}
      </div>
    </AdminRouteGuard>
  );
}
