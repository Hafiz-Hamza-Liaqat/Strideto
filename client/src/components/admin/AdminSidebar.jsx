import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroups,
  groupContainsActivePath,
  isAdminNavItemActive,
  readExpandedGroups,
  writeExpandedGroups,
} from '../../config/adminNavConfig';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

function NavIcon({ name, className = 'w-4 h-4 shrink-0' }) {
  const props = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.75, 'aria-hidden': true };
  switch (name) {
    case 'home':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5 10v10h14V10" /></svg>;
    case 'chart':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M10 19V9M16 19v-6M22 19H2" /></svg>;
    case 'pulse':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
    case 'health':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M6 12h12M4.5 4.5l15 15" /></svg>;
    case 'ops':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>;
    case 'briefcase':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-10 4h10m-11 4h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2Z" /></svg>;
    case 'award':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M7 4h10l1 4H6l1-4Zm0 0 1 5a2 2 0 0 0 4 0l1-5" /></svg>;
    case 'graduation':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2 8l10 5 10-5-10-5Zm0 7v8m-7-3 7 3 7-3" /></svg>;
    case 'document':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>;
    case 'compass':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="m12 8 2 4-4 2 2-4Z" /></svg>;
    case 'globe':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>;
    case 'building':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V6l8-3v17M12 20h8V10l-4-2v12" /></svg>;
    case 'school':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 1 8l11 5 9-4.09M5 10v8m14-8v8M9 21v-6h6v6" /></svg>;
    case 'office':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6 20V8l6-3 6 3v12M9 20v-4h6v4" /></svg>;
    case 'video':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="m16 8 5-3v14l-5-3M4 6h10v12H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" /></svg>;
    case 'clipboard':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6a2 2 0 0 1 2 2v14H7V7a2 2 0 0 1 2-2Zm0 0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>;
    case 'cms':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>;
    case 'user':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-8 0v1M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>;
    case 'mail':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4V6Zm0 0 8 6 8-6" /></svg>;
    case 'lifebuoy':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>;
    case 'bell':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9l-1-4a5 5 0 0 1 10 0l-1 4Zm-3 3a2 2 0 0 0 2-2H7a2 2 0 0 0 2 2Z" /></svg>;
    case 'alert':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M10.3 4.5h3.4L21 19H3l7.3-14.5Z" /></svg>;
    case 'invite':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11h6M19 8v6M6 8h6a4 4 0 0 1 0 8H6V8Zm0 0V6a2 2 0 0 1 2-2h2" /></svg>;
    case 'shield':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7l-8-4Z" /></svg>;
    case 'credit':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16v10H4V8Zm0 0V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" /></svg>;
    case 'megaphone':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 10v4h4l5 4V6L8 10H4Zm11 2a3 3 0 0 0 0-4" /></svg>;
    case 'newsletter':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4V6Zm0 0 8 6 8-6" /></svg>;
    case 'sparkles':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M5 12H3m18 0h-2M7 7l-1.5-1.5M18.5 18.5 17 17M7 17l-1.5 1.5M18.5 5.5 17 7" /></svg>;
    case 'upload':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M4 20h16" /></svg>;
    case 'list':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case 'profile':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-8 0v1M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>;
    case 'logout':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10 17l-5-5 5-5M5 12h12M19 19V5" /></svg>;
    case 'dashboard':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h7v7H4v-7Zm9 3h7v7h-7v-7Z" /></svg>;
    case 'content':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12v16H6V4Zm3 4h6M9 12h6M9 16h4" /></svg>;
    case 'users':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 8v-1a4 4 0 0 0-3-3.87" /></svg>;
    case 'revenue':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 7H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H7" /></svg>;
    case 'tools':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-1.5-1.5a4 4 0 0 0-1.8-1.5Z" /></svg>;
    case 'settings':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.5-3a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L15.5 2h-7L9.6 4.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1L8.5 22h7l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="2" /></svg>;
  }
}

function NavLinkItem({ item, pathname, onNavigate, t, linkRef }) {
  const active = isAdminNavItemActive(item, pathname);
  return (
    <Link
      ref={active ? linkRef : undefined}
      to={item.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:focus-visible:ring-mint/50 ${
        active
          ? 'bg-primary/10 text-primary dark:text-mint'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <NavIcon name={item.icon || 'list'} />
      <span className="truncate">{t(`admin:${item.labelKey}`)}</span>
    </Link>
  );
}

function NavGroupSection({ group, pathname, expanded, onToggle, onNavigate, t, activeLinkRef }) {
  const panelId = `admin-nav-group-${group.id}`;
  const visibleItems = group.items;

  return (
    <div className="mb-1">
      <button
        type="button"
        id={`${panelId}-btn`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:focus-visible:ring-mint/40"
      >
        <NavIcon name={group.icon} className="w-3.5 h-3.5" />
        <span className="flex-1 text-left truncate">{t(`admin:${group.labelKey}`)}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-btn`}
        hidden={!expanded}
        className="space-y-0.5 pl-1"
      >
        {visibleItems.map((item) => (
          <NavLinkItem key={item.path} item={item} pathname={pathname} onNavigate={onNavigate} t={t} linkRef={activeLinkRef} />
        ))}
      </div>
    </div>
  );
}

function SidebarPanel({ mobile, onClose, groups, can, t, logout }) {
  const location = useLocation();
  const pathname = location.pathname;
  const defaultExpanded = groups.map((g) => g.id);
  const [expanded, setExpanded] = useState(() => readExpandedGroups(defaultExpanded));
  const navRef = useRef(null);
  const activeLinkRef = useRef(null);
  const scrollStorageKey = mobile ? 'admin-sidebar-scroll-mobile' : 'admin-sidebar-scroll-desktop';
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      groups.forEach((group) => {
        if (groupContainsActivePath(group, pathname, can)) next.add(group.id);
      });
      writeExpandedGroups(next);
      return next;
    });
  }, [pathname, groups, can]);

  useEffect(() => {
    restoredScrollRef.current = false;
  }, [pathname, scrollStorageKey]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const saveScroll = () => {
      try {
        sessionStorage.setItem(scrollStorageKey, String(nav.scrollTop));
      } catch {
        /* ignore */
      }
    };

    nav.addEventListener('scroll', saveScroll, { passive: true });
    return () => nav.removeEventListener('scroll', saveScroll);
  }, [scrollStorageKey]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || restoredScrollRef.current) return;

    try {
      const saved = sessionStorage.getItem(scrollStorageKey);
      if (saved != null) {
        nav.scrollTop = Number(saved) || 0;
      }
    } catch {
      /* ignore */
    }

    if (activeLinkRef.current?.scrollIntoView) {
      activeLinkRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    restoredScrollRef.current = true;
  }, [pathname, scrollStorageKey, groups]);

  const toggleGroup = useCallback((groupId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      writeExpandedGroups(next);
      return next;
    });
  }, []);

  const onNavigate = mobile ? onClose : undefined;

  return (
    <>
      <div className={`p-3 border-b border-gray-200 dark:border-gray-700 shrink-0 ${mobile ? '' : 'hidden lg:block'}`}>
        <Link
          to={ROUTES.HOME}
          onClick={onNavigate}
          className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary dark:hover:text-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
        >
          {t('admin:backToSite')}
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('admin:adminPortal')}</p>
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto overscroll-contain p-2 min-h-0" aria-label={t('admin:adminNavigation')}>
        {groups.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            pathname={pathname}
            expanded={expanded.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            onNavigate={onNavigate}
            t={t}
            activeLinkRef={activeLinkRef}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-0.5" role="group" aria-label={t('admin:navGroupSettings')}>
        <p className="px-2 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <NavIcon name="settings" className="w-3.5 h-3.5" />
          {t('admin:navGroupSettings')}
        </p>
        <Link
          to={ROUTES.PROFILE}
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <NavIcon name="profile" />
          {t('common:profile')}
        </Link>
        <button
          type="button"
          onClick={() => { logout(); onNavigate?.(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <NavIcon name="logout" />
          {t('common:logout')}
        </button>
      </div>
    </>
  );
}

export function AdminSidebar({ mobileOpen, onMobileOpen, onMobileClose, can }) {
  const { t } = useTranslation(['admin', 'common']);
  const { logout } = useAuth();
  const drawerRef = useRef(null);
  const groups = filterAdminNavGroups(ADMIN_NAV_GROUPS, can);

  useOverlayA11y({ open: mobileOpen, onClose: onMobileClose, containerRef: drawerRef, trapFocus: true });

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // focus handled by useOverlayA11y
  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-2.5 -mx-4 sm:mx-0 mb-4 border-b border-gray-200 dark:border-gray-700 bg-bg-main/95 dark:bg-secondary/95 backdrop-blur-sm">
        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t('admin:title')}</span>
        <button
          type="button"
          aria-label={t('admin:openAdminMenu')}
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-drawer"
          onClick={onMobileOpen}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px] shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label={t('common:closeMenu')}
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
          />
          <aside
            ref={drawerRef}
            id="admin-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('admin:adminNavigation')}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-xl"
          >
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <span className="font-semibold text-gray-900 dark:text-white text-sm">{t('admin:menu')}</span>
              <button
                type="button"
                aria-label={t('common:close')}
                onClick={onMobileClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SidebarPanel mobile groups={groups} can={can} t={t} logout={logout} onClose={onMobileClose} />
          </aside>
        </div>
      )}

      <aside
        className="hidden lg:flex w-60 xl:w-64 shrink-0 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 sticky top-0 self-start max-h-[calc(100vh-4rem)]"
        aria-label={t('admin:adminNavigation')}
      >
        <SidebarPanel mobile={false} groups={groups} can={can} t={t} logout={logout} onClose={undefined} />
      </aside>
    </>
  );
}