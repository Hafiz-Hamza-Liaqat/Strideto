import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { AdminNotificationBell } from '../../components/notifications/NotificationBell';
import { ROUTES } from '../../constants';
import { usePermissions } from '../../hooks/usePermissions';

export default function Admin() {
  const { t } = useTranslation(['admin', 'common']);
  const location = useLocation();
  const { can, role, loading: permLoading } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOverview =
    location.pathname === ROUTES.ADMIN || location.pathname === `${ROUTES.ADMIN}/`;

  return (
    <>
      {isOverview && (
        <SeoHead title={t('admin:seoTitle')} description={t('admin:seoDescription')} noindex />
      )}

      <div className="flex flex-col lg:flex-row min-w-0 w-full gap-0 lg:gap-0 -mx-4 sm:mx-0">
        <AdminSidebar
          mobileOpen={mobileOpen}
          onMobileOpen={() => setMobileOpen(true)}
          onMobileClose={() => setMobileOpen(false)}
          can={can}
        />

        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto w-full">
            <div className="hidden lg:flex flex-wrap items-center justify-between gap-2 mb-6">
              {isOverview ? (
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{t('admin:title')}</h1>
              ) : (
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('admin:title')}</p>
              )}
              <div className="flex items-center gap-2">
                {!permLoading && role && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {role}
                  </span>
                )}
                <AdminNotificationBell />
              </div>
            </div>

            <div className="min-w-0">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
