import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { inboxApi } from '../../services/listingsService';
import { Pagination } from '../../components/ui/Pagination';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { EmptyState } from '../../components/common/EmptyState';

const CATEGORIES = ['', 'application', 'scholarship', 'admission', 'interview', 'job', 'payment', 'support', 'system', 'general'];

function NotificationsContent() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [category, setCategory] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (category) params.category = category;
    if (readFilter) params.read = readFilter;
    inboxApi.list(params)
      .then((res) => {
        setItems(res.data?.data || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setUnread(res.data?.unreadCount ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, category, readFilter]);

  const markAll = async () => {
    await inboxApi.markAllRead();
    load();
  };

  const markOne = async (id) => {
    await inboxApi.markRead(id);
    load();
  };

  const remove = async (id) => {
    await inboxApi.remove(id);
    load();
  };

  return (
    <>
      <SeoHead title={t('dashboard:notifications')} noindex />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard:notifications')}</h1>
          {unread > 0 && (
            <button type="button" onClick={markAll} className="text-sm text-primary dark:text-mint hover:underline">
              {t('dashboard:markAllRead')} ({unread})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <select value={readFilter} onChange={(e) => { setReadFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
            <option value="">{t('dashboard:allNotifications')}</option>
            <option value="false">{t('dashboard:unreadOnly')}</option>
            <option value="true">{t('dashboard:readOnly')}</option>
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
            <option value="">{t('dashboard:allCategories')}</option>
            {CATEGORIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-gray-500">{t('common:loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="Stay updated"
            description="Stay updated with the latest opportunities. Enable notifications in your profile preferences."
            actionLabel="Enable Notifications"
            actionTo={ROUTES.PROFILE}
          />
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n._id} className={`p-4 rounded-xl border ${n.read ? 'border-gray-200 dark:border-gray-700' : 'border-primary/30 bg-primary/5'} bg-white dark:bg-gray-800`}>
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{n.title}</p>
                    {n.body && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{n.body}</p>}
                    <p className="text-xs text-gray-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.read && (
                      <button type="button" onClick={() => markOne(n._id)} className="text-xs text-primary dark:text-mint">{t('dashboard:markRead')}</button>
                    )}
                    <button type="button" onClick={() => remove(n._id)} className="text-xs text-red-600">{t('common:delete')}</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}

        <p className="mt-8 text-sm">
          <Link to={ROUTES.DASHBOARD} className="text-primary dark:text-mint hover:underline">{t('dashboard:backToDashboard')}</Link>
        </p>
      </div>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
