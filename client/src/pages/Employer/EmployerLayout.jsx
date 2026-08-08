import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';
import { SkipLink } from '../../components/a11y/SkipLink';
import { FeedbackWidget } from '../../components/feedback/FeedbackWidget';
import { EmployerNotificationBell } from '../../components/notifications/EmployerNotificationBell';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';

function NavLinks({ location, onNavigate, t, showIntelligence }) {
  const menu = [
    { path: ROUTES.EMPLOYER_DASHBOARD, labelKey: 'dashboardHeading' },
    ...(showIntelligence ? [{ path: ROUTES.EMPLOYER_INTELLIGENCE, labelKey: 'intelligenceHeading' }] : []),
    { path: ROUTES.EMPLOYER_JOBS, labelKey: 'myJobPosts' },
    { path: ROUTES.EMPLOYER_POST_JOB, labelKey: 'postNewJob' },
    { path: ROUTES.EMPLOYER_APPLICATIONS, labelKey: 'applications' },
    { path: ROUTES.EMPLOYER_ANALYTICS, labelKey: 'analytics' },
    { path: ROUTES.EMPLOYER_NOTIFICATIONS, labelKey: 'notifications' },
    { path: ROUTES.EMPLOYER_SETTINGS, labelKey: 'settings' },
  ];

  // Exactly one nav item is active: the most specific (longest) path that
  // matches the current location. Prefix matching alone would light up both
  // "My Job Posts" (/employer/jobs) and "Post New Job" (/employer/jobs/new)
  // on the post-new route; choosing the longest match fixes that.
  const activePath = menu.reduce((best, { path }) => {
    const isMatch =
      location.pathname === path ||
      (path !== ROUTES.EMPLOYER_DASHBOARD && location.pathname.startsWith(`${path}/`));
    if (!isMatch) return best;
    return !best || path.length > best.length ? path : best;
  }, null);

  return menu.map(({ path, labelKey }) => (
    <Link
      key={path}
      to={path}
      onClick={onNavigate}
      aria-current={path === activePath ? 'page' : undefined}
      className={`block px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] flex items-center ${
        path === activePath
          ? 'bg-primary/10 text-primary dark:text-mint'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {labelKey === 'dashboardHeading'
        ? t('employer:dashboardHeading')
        : t(`employer:${labelKey}`, { defaultValue: labelKey === 'notifications' ? 'Notifications' : labelKey })}
    </Link>
  ));
}

export default function EmployerLayout() {
  const { t } = useTranslation(['employer', 'common']);
  const location = useLocation();
  const { employer, logout } = useEmployerAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showIntelligence = isEmployerIntelligenceEnabled();
  const panelRef = useRef(null);
  useOverlayA11y({ open: mobileOpen, onClose: () => setMobileOpen(false), containerRef: panelRef, trapFocus: true });

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary flex flex-col lg:flex-row overflow-x-hidden">
      <SkipLink />
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 safe-area-inset-top">
        <Link to={ROUTES.EMPLOYER_DASHBOARD} className="font-semibold text-gray-900 dark:text-white truncate min-w-0">
          {t('employer:employerBrand')}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <EmployerNotificationBell />
          <button
            type="button"
            aria-label={t('employer:openEmployerMenu')}
            aria-expanded={mobileOpen}
            aria-controls="employer-mobile-nav"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px] shrink-0"
          >
            ☰
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label={t('common:closeMenu')}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="employer-mobile-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('employer:employerNavigation')}
            tabIndex={-1}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col overflow-y-auto overscroll-contain outline-none"
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-semibold text-gray-900 dark:text-white">{t('employer:menu')}</span>
              <button
                type="button"
                aria-label={t('common:close')}
                onClick={() => setMobileOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-1 flex-1">
              <NavLinks location={location} onNavigate={() => setMobileOpen(false)} t={t} showIntelligence={showIntelligence} />
            </nav>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
              <p className="text-xs text-gray-500 truncate px-2 break-words-safe">{employer?.companyName}</p>
              <button
                type="button"
                onClick={() => { logout(); setMobileOpen(false); }}
                className="mt-2 w-full text-left px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg min-h-[44px]"
              >
                {t('employer:logOut')}
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-56 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col" data-tour="employer-dashboard">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link to={ROUTES.HOME} className="text-gray-900 dark:text-white font-semibold tracking-tight">
            {t('common:appName')}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('employer:employerPortal')}</p>
        </div>
        <nav className="p-2 flex-1 space-y-1">
          <NavLinks location={location} t={t} showIntelligence={showIntelligence} />
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-2 break-words-safe">{employer?.companyName}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full text-left px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {t('employer:logOut')}
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto min-w-0 outline-none">
        <div className="hidden lg:flex items-center justify-end px-4 sm:px-6 md:px-8 pt-4 max-w-6xl mx-auto w-full">
          <EmployerNotificationBell />
        </div>
        <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <FeedbackWidget />
    </div>
  );
}
