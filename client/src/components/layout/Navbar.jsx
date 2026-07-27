import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { DrawerMenu } from './DrawerMenu';
import { useHeaderNavItems } from '../../hooks/useHeaderNavItems';
import { NotificationBell } from '../notifications/NotificationBell';
import { UserAccountMenu } from './UserAccountMenu';
import { Logo } from '../brand/Logo';
import { TourAnchors } from '../../onboarding/TourAnchors';
import { registerOverlayEscape } from '../../a11y/overlayStack';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, splitNavForDesktop } from './navConfig';

const linkClass =
  'px-2.5 xl:px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint rounded-lg link-hover whitespace-nowrap';

export function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const megaRef = useRef(null);
  const moreRef = useRef(null);
  const menuButtonRef = useRef(null);
  const { t: legacyT } = useLanguage();
  const { t } = useTranslation(['navbar', 'common']);
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  const label = (key) => (key.includes(':') ? t(key.split(':')[1], { ns: key.split(':')[0] }) : legacyT(key));
  const resolvedPrimary = useHeaderNavItems(PRIMARY_NAV_ITEMS, label);
  const resolvedSecondaryFallback = useMemo(
    () =>
      SECONDARY_NAV_ITEMS.map((item) => ({
        ...item,
        label: label(item.labelKey),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- label tied to lang via t/legacyT
    [t, legacyT]
  );

  const { primary: splitPrimary, fromCmsSecondary } = splitNavForDesktop(resolvedPrimary);
  const desktopPrimary = splitPrimary ?? resolvedPrimary;

  const moreItems = useMemo(() => {
    const items = [...(fromCmsSecondary?.length ? fromCmsSecondary : resolvedSecondaryFallback)];
    const paths = new Set(items.map((i) => i.path));
    for (const tool of resolvedSecondaryFallback) {
      if (tool.path === ROUTES.RESUME_BUILDER || tool.path === ROUTES.CAREER_GUIDANCE) {
        if (!paths.has(tool.path)) {
          items.push(tool);
          paths.add(tool.path);
        }
      }
    }
    if (isAuthenticated && !paths.has(ROUTES.DASHBOARD)) {
      items.push({
        path: ROUTES.DASHBOARD,
        label: t('navbar:dashboard'),
        tour: 'dashboard',
      });
    }
    if (isEmployer && !paths.has(ROUTES.EMPLOYER_DASHBOARD)) {
      items.push({
        path: ROUTES.EMPLOYER_DASHBOARD,
        label: t('navbar:employerPortal', { defaultValue: 'Employer' }),
        tour: 'employer-dashboard',
      });
    }
    return items;
  }, [fromCmsSecondary, resolvedSecondaryFallback, isAuthenticated, isEmployer, t]);

  useEffect(() => {
    if (!megaOpen && !moreOpen) return undefined;
    return registerOverlayEscape(() => {
      setMegaOpen(null);
      setMoreOpen(false);
    });
  }, [megaOpen, moreOpen]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setMegaOpen(null);
  }, [pathname]);

  const renderNavLink = (item, key) => {
    if (item.external) {
      return (
        <a
          key={key}
          href={item.path}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-current={undefined}
        >
          {item.label}
          {item.icon ? ` ${item.icon}` : ''}
        </a>
      );
    }
    const current = pathname === item.path || (item.path !== ROUTES.HOME && pathname.startsWith(`${item.path}/`));
    return (
      <Link
        key={key}
        to={item.path}
        className={linkClass}
        aria-current={current ? 'page' : undefined}
      >
        {item.label}
        {item.icon ? ` ${item.icon}` : ''}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-surface/98 dark:bg-surface-dark/98 backdrop-blur safe-area-inset-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 min-w-0">
        <div
          className="flex items-center justify-between h-14 md:h-16 gap-2 min-h-[56px] min-w-0"
          data-tour="nav"
        >
          <Link
            to={ROUTES.HOME}
            className="flex items-center gap-2 shrink-0 min-w-0 max-w-[40%] sm:max-w-none link-hover"
            aria-label={t('common:appName')}
          >
            <span className="inline-flex sm:hidden shrink-0">
              <Logo variant="symbol" height={36} className="shrink-0" />
            </span>
            <span className="hidden sm:inline-flex dark:hidden shrink-0">
              <Logo variant="full" height={36} className="shrink-0" />
            </span>
            <span className="hidden sm:dark:inline-flex shrink-0">
              <Logo variant="full" tone="dark" height={36} className="shrink-0" />
            </span>
          </Link>

          <nav
            className="hidden lg:flex items-center gap-0.5 xl:gap-1 min-w-0 flex-1 justify-center overflow-visible"
            aria-label={t('navbar:mainNav')}
          >
            {!desktopPrimary ? (
              <div className="flex items-center gap-2 animate-pulse" aria-busy="true" aria-label={t('common:loading')}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-14 rounded-lg bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ) : (
              <>
                {desktopPrimary.map((item) =>
                  item.mega ? (
                    <div
                      key={item.label}
                      className="relative shrink-0"
                      ref={megaOpen === item.label ? megaRef : undefined}
                      onMouseEnter={() => setMegaOpen(item.label)}
                      onMouseLeave={() => setMegaOpen(null)}
                    >
                      <button
                        type="button"
                        className={linkClass}
                        aria-expanded={megaOpen === item.label}
                        aria-haspopup="true"
                        onClick={() => setMegaOpen((cur) => (cur === item.label ? null : item.label))}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMegaOpen(item.label);
                          }
                        }}
                      >
                        {item.label} ▾
                      </button>
                      {megaOpen === item.label && (
                        <div className="absolute start-0 top-full pt-1 w-56 animate-dropdown-enter z-50">
                          <div
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2"
                            role="menu"
                          >
                            {item.mega.map((sub) =>
                              sub.external ? (
                                <a
                                  key={sub.path}
                                  role="menuitem"
                                  href={sub.path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block px-4 py-2.5 min-h-[44px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 link-hover rounded-lg"
                                  onClick={() => setMegaOpen(null)}
                                >
                                  {sub.label}
                                </a>
                              ) : (
                                <Link
                                  key={sub.path}
                                  role="menuitem"
                                  to={sub.path}
                                  className="block px-4 py-2.5 min-h-[44px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 link-hover rounded-lg"
                                  onClick={() => setMegaOpen(null)}
                                  aria-current={pathname === sub.path ? 'page' : undefined}
                                >
                                  {sub.label}
                                </Link>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span key={item.path || item.label} className="shrink-0">
                      {renderNavLink(item, item.path || item.label)}
                    </span>
                  )
                )}

                <div className="relative shrink-0" ref={moreRef}>
                  <button
                    type="button"
                    className={linkClass}
                    aria-expanded={moreOpen}
                    aria-haspopup="true"
                    aria-controls="navbar-more-menu"
                    onClick={() => setMoreOpen((o) => !o)}
                  >
                    {t('navbar:more')} ▾
                  </button>
                  {moreOpen && (
                    <div
                      id="navbar-more-menu"
                      role="menu"
                      className="absolute end-0 top-full pt-1 w-56 max-w-[calc(100vw-1.5rem)] animate-dropdown-enter z-50"
                    >
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2">
                        {moreItems.map((item) =>
                          item.external ? (
                            <a
                              key={item.path}
                              role="menuitem"
                              href={item.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-4 py-2.5 min-h-[44px] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                              onClick={() => setMoreOpen(false)}
                              data-tour={item.tour || undefined}
                            >
                              {item.label}
                            </a>
                          ) : (
                            <Link
                              key={item.path}
                              role="menuitem"
                              to={item.path}
                              className="block px-4 py-2.5 min-h-[44px] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                              onClick={() => setMoreOpen(false)}
                              data-tour={item.tour || undefined}
                              aria-current={pathname === item.path ? 'page' : undefined}
                            >
                              {item.label}
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
            <TourAnchors />
            <NotificationBell />
            <UserAccountMenu />
            <button
              ref={menuButtonRef}
              type="button"
              id="mobile-menu-button"
              className="lg:hidden min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDrawerOpen(true);
              }}
              aria-label={t('common:openMenu')}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
