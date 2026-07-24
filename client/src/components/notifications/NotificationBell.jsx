import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { inboxApi } from '../../services/listingsService';
import { useAuth } from '../../context/AuthContext';
import { registerOverlayEscape } from '../../a11y/overlayStack';

export function NotificationBell() {
  const { t } = useTranslation(['common', 'dashboard']);
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const load = () => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      inboxApi.list({ limit: 8 }),
      inboxApi.unreadCount(),
    ])
      .then(([listRes, countRes]) => {
        setItems(listRes.data?.data || []);
        setUnread(countRes.data?.unreadCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    return registerOverlayEscape(() => setOpen(false));
  }, [open]);

  if (!isAuthenticated) return null;

  const markRead = async (id) => {
    await inboxApi.markRead(id).catch(() => {});
    load();
  };

  return (
    <div className="relative" ref={ref} data-tour="notifications">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label={t('dashboard:notifications')}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="notification-panel"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div id="notification-panel" role="region" aria-label={t('dashboard:notifications')} className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-900 dark:text-white">{t('dashboard:notifications')}</span>
            <Link to={ROUTES.NOTIFICATIONS} className="text-xs text-primary dark:text-mint" onClick={() => setOpen(false)}>
              {t('dashboard:viewAll')}
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="p-4 text-sm text-gray-500">{t('common:loading')}</p>}
            {!loading && items.length === 0 && (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t('dashboard:noNotifications')}</p>
            )}
            {items.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => { if (!n.read) markRead(n._id); setOpen(false); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!n.read ? 'bg-primary/5' : ''}`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.body}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
