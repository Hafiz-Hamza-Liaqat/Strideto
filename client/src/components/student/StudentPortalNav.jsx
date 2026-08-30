import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import {
  isStudentPortalNavVisible,
  isStudentNavItemCurrent,
  STUDENT_PORTAL_NAV,
  STUDENT_PORTAL_NAV_CORE,
  STUDENT_PORTAL_NAV_OVERFLOW,
} from '../../config/studentNavConfig';
import {
  USER_WORKSPACE_EVENT,
  hasStudentCapabilityOrPending,
  readUserWorkspacePreference,
} from '../../auth/userCapabilityWorkspace';

function navLinkClass(current) {
  return `inline-flex items-center min-h-[44px] px-3 text-sm rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    current
      ? 'bg-primary/10 text-primary dark:text-mint font-medium'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;
}

function NavItemLink({ item, pathname, onClick, className }) {
  const { t } = useTranslation(['student']);
  const current = isStudentNavItemCurrent(pathname, item);
  return (
    <Link
      to={item.path}
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      className={className || navLinkClass(current)}
    >
      {t(`student:nav.${item.labelKey}`, { defaultValue: item.labelKey })}
    </Link>
  );
}

function WorkspaceOverflowMenu({ items, pathname, label, currentInMenu, menuId, align = 'end' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = menuId || 'student-workspace-overflow';
  const alignClass = align === 'start' ? 'start-0' : 'end-0';

  useOverlayA11y({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    trapFocus: false,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className={`${navLinkClass(currentInMenu)} gap-1`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{label}</span>
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          role="menu"
          aria-label={label}
          className={`absolute ${alignClass} z-30 mt-1 max-h-[min(24rem,calc(100dvh-8rem))] w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800`}
        >
          <ul>
            {items.map((item) => {
              const current = isStudentNavItemCurrent(pathname, item);
              return (
                <li key={item.path} role="none">
                  <NavItemLink
                    item={item}
                    pathname={pathname}
                    onClick={() => setOpen(false)}
                    className={`mx-1 block w-[calc(100%-0.5rem)] ${navLinkClass(current)}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function StudentPortalNav() {
  const { t } = useTranslation(['student']);
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [userWorkspace, setUserWorkspace] = useState(readUserWorkspacePreference);
  const studentCapable = hasStudentCapabilityOrPending(user);

  useEffect(() => {
    const sync = () => setUserWorkspace(readUserWorkspacePreference());
    window.addEventListener(USER_WORKSPACE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(USER_WORKSPACE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!isStudentPortalNavVisible(pathname, isAuthenticated, {
    hasStudentCapability: studentCapable,
    userWorkspace,
  })) return null;

  const overflowHasCurrent = STUDENT_PORTAL_NAV_OVERFLOW.some((item) =>
    isStudentNavItemCurrent(pathname, item)
  );
  const anyCurrent = STUDENT_PORTAL_NAV.some((item) => isStudentNavItemCurrent(pathname, item));

  return (
    <nav
      aria-label={t('student:portalNavLabel', { defaultValue: 'Student portal' })}
      className="border-b border-gray-200 bg-white/90 dark:border-gray-800 dark:bg-gray-900/90"
    >
      <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-1 px-3 py-1 sm:px-6">
        <ul className="hidden min-w-0 items-center gap-1 min-[1200px]:flex">
          {STUDENT_PORTAL_NAV_CORE.map((item) => (
            <li key={item.path}>
              <NavItemLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
        <div className="hidden min-[1200px]:block">
          <WorkspaceOverflowMenu
            items={STUDENT_PORTAL_NAV_OVERFLOW}
            pathname={pathname}
            label={t('student:moreWorkspace', { defaultValue: 'More' })}
            currentInMenu={overflowHasCurrent}
            menuId="student-workspace-overflow-more"
            align="end"
          />
        </div>
        <div className="min-[1200px]:hidden">
          <WorkspaceOverflowMenu
            items={STUDENT_PORTAL_NAV}
            pathname={pathname}
            label={t('student:workspaceMenu', { defaultValue: 'Workspace' })}
            currentInMenu={anyCurrent}
            menuId="student-workspace-overflow-workspace"
            align="start"
          />
        </div>
      </div>
    </nav>
  );
}
