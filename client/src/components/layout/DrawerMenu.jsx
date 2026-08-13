import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { isEmployerPortalPath } from '../../auth/authRealm';
import { DRAWER_NAV_ITEMS } from './navConfig';
import { isNavItemCurrent, isNavPathCurrent } from './Navbar';

const DRAWER_DURATION_MS = 220;

export function DrawerMenu({ open, onClose }) {
  const [openMega, setOpenMega] = useState(null);
  const [exiting, setExiting] = useState(false);
  const exitTimeoutRef = useRef(null);
  const panelRef = useRef(null);
  const { t } = useTranslation(['navbar', 'common']);
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  const navItems = useMemo(
    () =>
      DRAWER_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey.includes(':') ? item.labelKey.split(':')[1] : item.labelKey, { ns: 'navbar' }),
        mega: item.mega?.map((sub) => ({
          ...sub,
          label: t(sub.labelKey.includes(':') ? sub.labelKey.split(':')[1] : sub.labelKey, { ns: 'navbar' }),
        })),
      })),
    [t]
  );

  const handleClose = () => {
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    setExiting(true);
    exitTimeoutRef.current = setTimeout(() => {
      onClose();
      setExiting(false);
      exitTimeoutRef.current = null;
    }, DRAWER_DURATION_MS);
  };

  const show = open || exiting;
  useOverlayA11y({ open: show && !exiting, onClose: handleClose, containerRef: panelRef, trapFocus: true });

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setExiting(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) setOpenMega(null);
  }, [open]);

  useEffect(() => () => {
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
  }, []);

  const isCurrent = (path) => isNavPathCurrent(pathname, path);
  const isItemCurrent = (item) => isNavItemCurrent(pathname, item);

  const linkClass =
    'block px-4 py-3.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors min-h-[44px] flex items-center';
  const currentLinkClass = `${linkClass} bg-primary/10 text-primary font-semibold dark:bg-mint/15 dark:text-mint`;

  const overlayClass = exiting
    ? 'fixed inset-0 bg-black/50 z-[100] animate-overlay-leave'
    : 'fixed inset-0 bg-black/50 z-[100] animate-overlay-enter';
  const asideClass = exiting
    ? 'fixed top-0 end-0 bottom-0 w-72 max-w-[min(85vw,320px)] bg-white dark:bg-gray-900 border-s border-gray-200 dark:border-gray-800 z-[101] overflow-y-auto overscroll-contain shadow-2xl animate-drawer-leave'
    : 'fixed top-0 end-0 bottom-0 w-72 max-w-[min(85vw,320px)] bg-white dark:bg-gray-900 border-s border-gray-200 dark:border-gray-800 z-[101] overflow-y-auto overscroll-contain shadow-2xl animate-drawer-enter';

  const drawer = (
    <>
      <div className={overlayClass} onClick={handleClose} aria-hidden="true" />
      <aside
        id="mobile-drawer"
        ref={panelRef}
        className={asideClass}
        role="dialog"
        aria-modal="true"
        aria-label={t('navbar:mobileMenu')}
        tabIndex={-1}
        style={{ paddingInlineEnd: 'env(safe-area-inset-right, 0)' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <span className="font-bold text-gray-900 dark:text-white text-lg">{t('navbar:menu')}</span>
          <button
            type="button"
            autoFocus
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 -m-2"
            aria-label={t('common:closeMenu')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="p-3 flex flex-col gap-0.5 pb-8 safe-area-inset-bottom" aria-label={t('navbar:mobileMenu')}>
          {navItems.map((item) =>
            item.mega ? (
              <div key={item.path || item.label}>
                <div className="flex items-stretch gap-1">
                  <Link
                    to={item.path}
                    onClick={handleClose}
                    className={`flex-1 ${isItemCurrent(item) ? currentLinkClass : linkClass}`}
                    aria-current={isItemCurrent(item) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenMega((cur) => (cur === item.path ? null : item.path))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-expanded={openMega === item.path}
                    aria-controls={`drawer-submenu-${item.path}`}
                    aria-label={t('navbar:openSubmenu', { label: item.label, defaultValue: `Show ${item.label} pages` })}
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${openMega === item.path ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {openMega === item.path && (
                  <div
                    id={`drawer-submenu-${item.path}`}
                    className="ps-4 py-1 border-s-2 border-gray-200 dark:border-gray-700 ms-4 my-1 space-y-0.5 animate-dropdown-enter"
                  >
                    {item.mega.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={handleClose}
                        className={isCurrent(sub.path) ? currentLinkClass : linkClass}
                        aria-current={isCurrent(sub.path) ? 'page' : undefined}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleClose}
                className={isCurrent(item.path) ? currentLinkClass : linkClass}
                aria-current={isCurrent(item.path) ? 'page' : undefined}
                data-tour={item.tour}
              >
                {item.label}
              </Link>
            )
          )}

          {(isAuthenticated || isEmployer) && (
            <>
              <p className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('navbar:accountMenu')}
              </p>
              {isAuthenticated ? (
                <Link
                  to={ROUTES.DASHBOARD}
                  onClick={handleClose}
                  className={linkClass}
                  data-tour="dashboard"
                  aria-current={isCurrent(ROUTES.DASHBOARD) ? 'page' : undefined}
                >
                  {t('navbar:dashboard')}
                </Link>
              ) : null}
              {isEmployer ? (
                <Link
                  to={ROUTES.EMPLOYER_DASHBOARD}
                  onClick={handleClose}
                  className={linkClass}
                  data-tour="employer-dashboard"
                  aria-current={isEmployerPortalPath(pathname) ? 'page' : undefined}
                >
                  {t('navbar:employerPortal', { defaultValue: 'Employer' })}
                </Link>
              ) : null}
            </>
          )}
        </nav>
      </aside>
    </>
  );

  if (!show) return null;
  return createPortal(drawer, document.body);
}
