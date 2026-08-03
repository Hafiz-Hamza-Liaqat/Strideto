import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { inboxApi } from '../../services/listingsService';
import { useAuth } from '../../context/AuthContext';
import { useUserNavbarSession } from '../../hooks/useUserNavbarSession';
import { registerOverlayEscape } from '../../a11y/overlayStack';
import { isSafeInternalLink } from '../../utils/notificationLink';

/**
 * Shared bell core, parameterized by recipient realm. `api` must expose
 * list/unreadCount/markRead with the same shape as inboxApi. `enabled` is
 * resolved by the caller (each realm has its own auth/session gating) so
 * this component never calls realm-specific hooks itself.
 */
export function NotificationBellCore({ api, enabled, viewAllRoute }) {
  const { t } = useTranslation(['common', 'dashboard']);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const load = () => {
    if (!enabled) return;
    setLoading(true);
    Promise.all([
      api.list({ limit: 8 }),
      api.unreadCount(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

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

  if (!enabled) return null;

  const markRead = async (id) => {
    await api.markRead(id).catch(() => {});
    load();
  };

  const handleActivate = (n) => {
    const safe = isSafeInternalLink(n.link);
    if (!n.read) markRead(n._id);
    setOpen(false);
    if (safe) navigate(n.link);
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
            <Link to={viewAllRoute} className="text-xs text-primary dark:text-mint" onClick={() => setOpen(false)}>
              {t('dashboard:viewAll')}
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="p-4 text-sm text-gray-500">{t('common:loading')}</p>}
            {!loading && items.length === 0 && (
              <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t('dashboard:noNotifications')}</p>
            )}
            {items.map((n) => {
              const safe = isSafeInternalLink(n.link);
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => handleActivate(n)}
                  aria-label={safe
                    ? t('dashboard:openNotification', { title: n.title, defaultValue: `Open: ${n.title}` })
                    : n.title}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.body}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** User/staff realm bell — behavior unchanged from before this refactor. */
export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { enabled: userNavbarSession } = useUserNavbarSession();
  return (
    <NotificationBellCore
      api={inboxApi}
      enabled={userNavbarSession && isAuthenticated}
      viewAllRoute={ROUTES.NOTIFICATIONS}
    />
  );
}
