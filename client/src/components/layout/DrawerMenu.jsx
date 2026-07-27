import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useHeaderNavItems } from '../../hooks/useHeaderNavItems';
import { useAuth } from '../../context/AuthContext';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { isEmployerPortalPath } from '../../auth/authRealm';
import { DRAWER_NAV_ITEMS } from './navConfig';

const DRAWER_DURATION_MS = 220;

export function DrawerMenu({ open, onClose }) {
  const [educationOpen, setEducationOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimeoutRef = useRef(null);
  const panelRef = useRef(null);
  const { t } = useTranslation(['navbar', 'common']);
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  const label = (key) => {
    const [ns, k] = key.includes(':') ? key.split(':') : ['navbar', key];
    return t(k, { ns });
  };
  const resolvedNavItems = useHeaderNavItems(DRAWER_NAV_ITEMS, label);

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
    if (!open) setEducationOpen(false);
  }, [open]);

  useEffect(() => () => {
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
  }, []);

  const isCurrent = (path) => {
    if (!path) return false;
    if (path === ROUTES.HOME) return pathname === ROUTES.HOME;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const linkClass =
    'block px-4 py-3.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors min-h-[44px] flex items-center';

  const overlayClass = exiting
    ? 'fixed inset-0 bg-black/50 z-[100] lg:hidden animate-overlay-leave'
    : 'fixed inset-0 bg-black/50 z-[100] lg:hidden animate-overlay-enter';
  const asideClass = exiting
    ? 'fixed top-0 end-0 bottom-0 w-72 max-w-[min(85vw,320px)] bg-white dark:bg-gray-900 border-s border-gray-200 dark:border-gray-800 z-[101] lg:hidden overflow-y-auto overscroll-contain shadow-2xl animate-drawer-leave'
    : 'fixed top-0 end-0 bottom-0 w-72 max-w-[min(85vw,320px)] bg-white dark:bg-gray-900 border-s border-gray-200 dark:border-gray-800 z-[101] lg:hidden overflow-y-auto overscroll-contain shadow-2xl animate-drawer-enter';

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
          {!resolvedNavItems ? (
            <div className="space-y-2 animate-pulse p-2" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-11 rounded-lg bg-gray-200 dark:bg-gray-700" />
              ))}
            </div>
          ) : (
            <>
              {resolvedNavItems.map((item) =>
                item.mega ? (
                  <div key={item.label || 'edu'}>
                    <button
                      type="button"
                      onClick={() => setEducationOpen((o) => !o)}
                      className={`w-full text-start ${linkClass} flex justify-between items-center`}
                      aria-expanded={educationOpen}
                      aria-controls="drawer-education-submenu"
                    >
                      {item.label}
                      <svg
                        className={`w-5 h-5 transition-transform ${educationOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {educationOpen && (
                      <div
                        id="drawer-education-submenu"
                        className="ps-4 py-1 border-s-2 border-gray-200 dark:border-gray-700 ms-4 my-1 space-y-0.5 animate-dropdown-enter"
                      >
                        {item.mega.map((sub) =>
                          sub.external ? (
                            <a
                              key={sub.path}
                              href={sub.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={handleClose}
                              className={linkClass}
                            >
                              {sub.label}
                            </a>
                          ) : (
                            <Link
                              key={sub.path}
                              to={sub.path}
                              onClick={handleClose}
                              className={linkClass}
                              aria-current={isCurrent(sub.path) ? 'page' : undefined}
                            >
                              {sub.label}
                            </Link>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ) : item.external ? (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleClose}
                    className={linkClass}
                    data-tour={item.tour}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleClose}
                    className={linkClass}
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
            </>
          )}
        </nav>
      </aside>
    </>
  );

  if (!show) return null;
  return createPortal(drawer, document.body);
}
