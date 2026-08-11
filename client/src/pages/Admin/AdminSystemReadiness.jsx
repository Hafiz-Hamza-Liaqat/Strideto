import { useEffect, useState } from 'react';
import { getAdminSystemReadiness } from '../../services/adminSuperControlApi';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';

function ReadinessRow({ label, value, warn }) {
  const highlight = warn === true || (typeof value === 'number' && warn && value > 0);
  return (
    <div className={`flex items-start justify-between gap-3 py-2 px-3 rounded ${highlight ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-white dark:bg-gray-800'} border border-gray-100 dark:border-gray-700 mb-1`}>
      <span className="text-sm text-gray-700 dark:text-gray-200 min-w-0 break-words">{label}</span>
      <span className={`text-sm font-semibold shrink-0 ${highlight ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
        {typeof value === 'string' && value.length > 80 ? '' : (value ?? '—')}
      </span>
    </div>
  );
}

export default function AdminSystemReadiness() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAdminSystemReadiness()
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading system readiness…</p>;
  if (error) return <p className="text-red-600 text-sm p-4" role="alert">Error: {error}</p>;

  const { queues, ai, components } = data ?? {};

  return (
    <AdminRouteGuard permission={PERMISSIONS.SYSTEM_READ}>
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">System Readiness</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Operational backlog and provider readiness from persisted data.
        This is not production certification. No secrets or environment values are exposed.
        For infrastructure health see <a href="/admin/platform-ops" className="underline">Platform Health</a>.
      </p>

      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Generated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}
      </p>

      {components && (
        <>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Runtime components</h2>
          <div className="mb-6">
            {Object.entries(components).map(([key, val]) => (
              <div key={key} className="mb-2 rounded border border-gray-100 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{key.replace(/_/g, ' ')}: {val?.status || '—'}</p>
                {val?.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{val.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Operational Queues</h2>
      <div className="mb-6">
        <ReadinessRow label="Verification Backlog" value={queues?.verificationBacklog} warn />
        <ReadinessRow label="Reconciliation Mismatches" value={queues?.reconciliationMismatches} warn />
        <ReadinessRow label="Broken / Unavailable Sources" value={queues?.brokenSources} warn />
        <ReadinessRow label="Refunds Pending" value={queues?.refundsPending} warn />
      </div>

      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">AI Provider</h2>
      <div className="mb-6">
        <ReadinessRow label="Copilot Provider State" value={ai?.copilotProvider?.state ?? '—'} />
      </div>

      {data?.notes?.length > 0 && (
        <div className="rounded border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {data.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
    </AdminRouteGuard>
  );
}
