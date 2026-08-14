import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { SkipLink } from '../../components/a11y/SkipLink';
import { PortalBrand } from '../../components/brand/PortalBrand';
import { AgentNotificationBell } from '../../components/notifications/AgentNotificationBell';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { agentNavItems, resolveProviderNavDomain } from '../../config/agentNavConfig';
import { agentApi } from '../../services/agentService';
import { gbsProviderApi } from '../../services/gbsProviderApi';
import { portalNavLinkClass } from '../../components/layout/portalNavClasses';

const PREF_KEY = 'strideto-provider-workspace';

function NavLinks({ location, onNavigate, items }) {
  const activePath = items.reduce((best, { path, end, home }) => {
    const pathname = path.split('?')[0];
    const isHome = home && (location.pathname === ROUTES.AGENT_DASHBOARD || location.search.includes('home=1'));
    const isMatch = home
      ? isHome
      : end
        ? location.pathname === pathname || location.pathname === `${pathname}/`
        : location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);
    if (!isMatch) return best;
    return !best || pathname.length > (best.split('?')[0].length) ? path : best;
  }, null);

  return items.map(({ path, label }) => (
    <Link
      key={`${path}-${label}`}
      to={path}
      onClick={onNavigate}
      aria-current={path === activePath ? 'page' : undefined}
      className={portalNavLinkClass(path === activePath)}
    >
      {label}
    </Link>
  ));
}

function WorkspaceSwitcher({ workspaces, current }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOverlayA11y({ open, onClose: () => setOpen(false), containerRef: ref, trapFocus: true });
  const label = current
    ? `${current.label} · ${current.domain?.publicName || current.domainId}`
    : 'Provider Home';

  return (
    <div className="px-2 pb-3 min-w-0">
      <p className="px-1 mb-1 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Current workspace</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-left text-sm text-gray-900 dark:text-white"
      >
        <span className="block break-words">{label}</span>
      </button>
      {open ? (
        <ul
          ref={ref}
          role="listbox"
          aria-label="Provider workspace"
          className="mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          <li>
            <Link
              to={`${ROUTES.AGENT_DASHBOARD}?home=1`}
              className="block px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 break-words"
              onClick={() => setOpen(false)}
            >
              Provider Home
            </Link>
          </li>
          {workspaces.map((row) => (
            <li key={`${row.subjectType}:${row.subjectId}:${row.domainId}`}>
              <Link
                to={`${row.path}?subjectType=${row.subjectType}&subjectId=${row.subjectId}`}
                className="block px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 break-words"
                onClick={() => {
                  try {
                    localStorage.setItem(PREF_KEY, JSON.stringify({
                      subjectType: row.subjectType,
                      subjectId: row.subjectId,
                      domainId: row.domainId,
                    }));
                  } catch { /* UX only */ }
                  setOpen(false);
                }}
              >
                <span className="block font-medium break-words">{row.label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 break-words">{row.domain?.publicName}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AgentLayout() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { agent, logout } = useAgentAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agentType, setAgentType] = useState(agent?.agentType || '');
  const [gbsEnabled, setGbsEnabled] = useState(false);
  const [context, setContext] = useState({ workspaces: [] });
  const panelRef = useRef(null);
  useOverlayA11y({ open: mobileOpen, onClose: () => setMobileOpen(false), containerRef: panelRef, trapFocus: true });

  useEffect(() => {
    agentApi.getProfile().then(({ data }) => setAgentType(data.profile?.agentType || '')).catch(() => {});
    gbsProviderApi.getEnabled().then(({ data }) => setGbsEnabled(data?.enabled === true)).catch(() => setGbsEnabled(false));
    agentApi.getProviderDomainContext().then(({ data }) => setContext(data || { workspaces: [] })).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const domainId = resolveProviderNavDomain(location.pathname);
  const workspaces = context.workspaces || [];
  const current = workspaces.find((w) => {
    const qType = params.get('subjectType');
    const qId = params.get('subjectId');
    if (qType && qId) {
      return w.domainId === domainId && w.subjectType === qType && String(w.subjectId) === String(qId);
    }
    return w.domainId === domainId;
  }) || workspaces.find((w) => w.domainId === domainId) || null;

  const items = useMemo(
    () => agentNavItems({
      agentType,
      gbsEnabled,
      providerDomainId: domainId || (workspaces.length === 1 ? workspaces[0].domainId : null),
      workspaces,
      subjectType: params.get('subjectType'),
      subjectId: params.get('subjectId'),
    }),
    [agentType, gbsEnabled, domainId, workspaces, params]
  );

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.AGENT_LOGIN, { replace: true });
  };

  return (
    <div className="min-h-screen max-w-full bg-bg-main dark:bg-secondary flex flex-col lg:flex-row">
      <SkipLink />
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 safe-area-inset-top">
        <PortalBrand role="agent" className="truncate min-w-0" height={26} />
        <div className="flex items-center gap-1 shrink-0">
          <AgentNotificationBell />
          <button
            type="button"
            aria-label="Open provider menu"
            aria-expanded={mobileOpen}
            aria-controls="agent-mobile-nav"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px]"
          >
            ☰
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside
            id="agent-mobile-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Provider navigation"
            tabIndex={-1}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col overflow-y-auto overscroll-contain outline-none"
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-semibold text-gray-900 dark:text-white">Menu</span>
              <button type="button" aria-label="Close" onClick={() => setMobileOpen(false)} className="min-h-[44px] min-w-[44px] rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
            </div>
            <WorkspaceSwitcher workspaces={workspaces} current={current} />
            <nav className="space-y-1 flex-1">
              <NavLinks location={location} onNavigate={() => setMobileOpen(false)} items={items} />
            </nav>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
              <p className="text-xs text-gray-500 truncate px-2 break-words-safe">{agent?.email || ''}</p>
              <button type="button" onClick={() => { handleLogout(); setMobileOpen(false); }} className="mt-2 w-full text-left px-3 py-2.5 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg min-h-[44px]">
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-60 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col min-w-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <PortalBrand role="agent" />
        </div>
        <WorkspaceSwitcher workspaces={workspaces} current={current} />
        <nav className="p-2 flex-1 space-y-1 overflow-y-auto" aria-label="Provider navigation">
          <NavLinks location={location} items={items} />
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-2 break-words-safe">{agent?.email || ''}</p>
          <button type="button" onClick={handleLogout} className="mt-2 w-full text-left px-3 py-1.5 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg min-h-[44px]">
            Log out
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto min-w-0 outline-none">
        <div className="hidden lg:flex items-center justify-end px-4 sm:px-6 md:px-8 pt-4 max-w-6xl mx-auto w-full">
          <AgentNotificationBell />
        </div>
        <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
