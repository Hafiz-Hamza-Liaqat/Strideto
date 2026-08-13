import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useLanguage } from '../../context/LanguageContext';
import { DrawerMenu } from './DrawerMenu';
import { NotificationBell } from '../notifications/NotificationBell';
import { UserAccountMenu } from './UserAccountMenu';
import { Logo } from '../brand/Logo';
import { TourAnchors } from '../../onboarding/TourAnchors';
import { registerOverlayEscape } from '../../a11y/overlayStack';
import { PRIMARY_NAV_ITEMS } from './navConfig';

export function isNavPathCurrent(pathname, path) {
  if (!path) return false;
  if (path === ROUTES.HOME) return pathname === ROUTES.HOME;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isNavItemCurrent(pathname, item) {
  if (item?.mega?.some((sub) => isNavPathCurrent(pathname, sub.path))) return true;
  return isNavPathCurrent(pathname, item?.path);
}

const linkClass = 'nav-item';

export function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(null);
  const megaRef = useRef(null);
  const firstMenuItemRef = useRef(null);
  const menuButtonRef = useRef(null);
  const { t: legacyT } = useLanguage();
  const { t } = useTranslation(['navbar', 'common']);
  const { pathname } = useLocation();

  const label = (key) => (key.includes(':') ? t(key.split(':')[1], { ns: key.split(':')[0] }) : legacyT(key));
  const navItems = useMemo(
    () =>
      PRIMARY_NAV_ITEMS.map((item) => ({
        ...item,
        label: label(item.labelKey),
        mega: item.mega?.map((sub) => ({ ...sub, label: label(sub.labelKey) })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- label tied to lang via t/legacyT
    [t, legacyT]
  );

  useEffect(() => {
    if (!megaOpen) return undefined;
    return registerOverlayEscape(() => setMegaOpen(null));
  }, [megaOpen]);

  useEffect(() => {
    setMegaOpen(null);
  }, [pathname]);

  useEffect(() => {
    if (!megaOpen) return undefined;
    const onDoc = (event) => {
      if (megaRef.current && !megaRef.current.contains(event.target)) setMegaOpen(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [megaOpen]);

  const renderNavLink = (item, key) => {
    const current = isNavItemCurrent(pathname, item);
    return (
      <Link
        key={key}
        to={item.path}
        className={linkClass}
        aria-current={current ? 'page' : undefined}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="public-navbar sticky top-0 z-40 border-b backdrop-blur safe-area-inset-top">
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
              <Logo variant="symbol" tone="light" height={36} className="shrink-0" />
            </span>
            <span className="hidden sm:inline-flex shrink-0">
              <Logo variant="full" tone="light" height={36} className="shrink-0" />
            </span>
          </Link>

          <nav
            className="hidden min-[1440px]:flex items-center gap-0.5 min-w-0 flex-1 justify-center overflow-visible"
            aria-label={t('navbar:mainNav')}
          >
            {navItems.map((item) =>
              item.mega ? (
                <div
                  key={item.path || item.label}
                  className="relative shrink-0"
                  ref={megaOpen === item.label ? megaRef : undefined}
                  onMouseEnter={() => setMegaOpen(item.label)}
                  onMouseLeave={() => setMegaOpen(null)}
                >
                  <Link
                    to={item.path}
                    className={linkClass}
                    aria-current={isNavItemCurrent(pathname, item) ? 'page' : undefined}
                    aria-expanded={megaOpen === item.label}
                    aria-haspopup="true"
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setMegaOpen(item.label);
                        requestAnimationFrame(() => firstMenuItemRef.current?.focus());
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                  {megaOpen === item.label && (
                    <div className="absolute start-0 top-full pt-1 w-64 max-w-[calc(100vw-1.5rem)] animate-dropdown-enter z-50">
                      <div
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2 max-h-[min(70vh,24rem)] overflow-y-auto"
                        role="menu"
                      >
                        {item.mega.map((sub, idx) => (
                          <Link
                            key={sub.path}
                            ref={idx === 0 ? firstMenuItemRef : undefined}
                            role="menuitem"
                            to={sub.path}
                            className="block px-4 py-2.5 min-h-[44px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700 rounded-lg"
                            onClick={() => setMegaOpen(null)}
                            aria-current={isNavPathCurrent(pathname, sub.path) ? 'page' : undefined}
                          >
                            {sub.label}
                          </Link>
                        ))}
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
          </nav>

          <div className="public-navbar-tools flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
            <TourAnchors />
            <NotificationBell />
            <UserAccountMenu />
            <button
              ref={menuButtonRef}
              type="button"
              id="mobile-menu-button"
              className="min-[1440px]:hidden min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 active:bg-white/15 cursor-pointer"
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

      <DrawerMenu
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          requestAnimationFrame(() => menuButtonRef.current?.focus({ preventScroll: true }));
        }}
      />
    </header>
  );
}
