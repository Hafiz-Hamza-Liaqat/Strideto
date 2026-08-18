import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { adminApi } from '../../services/listingsService';

function StatusBadge({ status }) {
  const ok = status === 'up' || status === 'configured' || status === 'ok';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ok ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
      {status}
    </span>
  );
}

export default function AdminPlatformOps() {
  const { t } = useTranslation(['admin', 'common']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi.platformHealth()
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.ANALYTICS_READ, PERMISSIONS.SYSTEM_SETTINGS]}>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">{t('admin:platformOps')}</h1>
        {loading && <p className="text-gray-500">{t('common:loading')}</p>}
        {error && <p className="text-red-600">{error}</p>}
        {data && (
          <>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <p className="text-sm text-gray-500 mb-1">{t('admin:overallStatus')}</p>
              <p className="text-2xl font-bold capitalize">{data.status}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(data.services || {}).map(([key, val]) => (
                <div key={key} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <p className="font-medium capitalize mb-2">{key}</p>
                  <StatusBadge status={val.status || val.configured ? 'configured' : 'unknown'} />
                  {val.uptimeSeconds != null && <p className="text-xs text-gray-500 mt-2">Uptime: {val.uptimeSeconds}s</p>}
                  {val.error && <p className="text-xs text-red-600 mt-1">{val.error}</p>}
                </div>
              ))}
            </div>
            {data.environment && (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold mb-2">{t('admin:envValidation')}</h3>
                <p className="text-sm">Node: {data.environment.nodeEnv}</p>
                {data.environment.missing?.length > 0 && <p className="text-sm text-red-600">Missing: {data.environment.missing.join(', ')}</p>}
                {data.environment.warnings?.length > 0 && <p className="text-sm text-amber-600">Warnings: {data.environment.warnings.join(', ')}</p>}
              </div>
            )}
            {data.disk && (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('admin:diskUsage')}</h3>
                <pre className="whitespace-pre-wrap">{JSON.stringify(data.disk, null, 2)}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </AdminRouteGuard>
  );
}
