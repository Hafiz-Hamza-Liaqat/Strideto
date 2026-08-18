import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { adminApi } from '../../services/listingsService';

export default function AdminMonitoring() {
  const { t } = useTranslation(['admin', 'common']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.monitoring()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminRouteGuard permission={PERMISSIONS.ANALYTICS_READ}>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">{t('admin:monitoring')}</h1>
        {loading && <p>{t('common:loading')}</p>}
        {data && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border">
                <p className="text-sm text-gray-500">{t('admin:openSupportTickets')}</p>
                <p className="text-2xl font-bold">{data.queues?.openSupportTickets ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl border">
                <p className="text-sm text-gray-500">{t('admin:newContactMessages')}</p>
                <p className="text-2xl font-bold">{data.queues?.newContactMessages ?? 0}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border">
              <h3 className="font-semibold mb-2">{t('admin:failedEmails')}</h3>
              <p className="text-sm">Last 24h: {data.failedEmails?.last24h ?? 0}</p>
              <ul className="mt-2 text-sm space-y-1 max-h-40 overflow-y-auto">
                {(data.failedEmails?.recent || []).map((e) => (
                  <li key={e._id} className="text-red-600">{e.to}: {e.error}</li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-xl border">
              <h3 className="font-semibold mb-2">{t('admin:cacheStats')}</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data.cache, null, 2)}</pre>
            </div>
            <div className="p-4 rounded-xl border">
              <h3 className="font-semibold mb-2">{t('admin:backgroundTasks')}</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data.backgroundTasks, null, 2)}</pre>
            </div>
          </>
        )}
      </div>
    </AdminRouteGuard>
  );
}
