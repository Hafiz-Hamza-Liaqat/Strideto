import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { SkipLink } from '../../components/a11y/SkipLink';
import { PortalBrand } from '../../components/brand/PortalBrand';
import { AgentNotificationBell } from '../../components/notifications/AgentNotificationBell';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { agentNavItems } from '../../config/agentNavConfig';
import { agentApi } from '../../services/agentService';
import { portalNavLinkClass } from '../../components/layout/portalNavClasses';

function NavLinks({ location, onNavigate, agentType }) {
  const menu = agentNavItems({ agentType });
  const activePath = menu.reduce((best, { path, end }) => {
    const isMatch = end
      ? location.pathname === path || location.pathname === `${path}/`
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (!isMatch) return best;
    return !best || path.length > best.length ? path : best;
  }, null);

  return menu.map(({ path, label }) => (
    <Link
      key={path}
      to={path}
      onClick={onNavigate}
      aria-current={path === activePath ? 'page' : undefined}
      className={portalNavLinkClass(path === activePath)}
    >
      {label}
    </Link>
  ));
}

export default function AgentLayout() {
  const location = useLocation();
  const { agent, logout } = useAgentAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agentType, setAgentType] = useState(agent?.agentType || '');
  const panelRef = useRef(null);
  useOverlayA11y({ open: mobileOpen, onClose: () => setMobileOpen(false), containerRef: panelRef, trapFocus: true });

  useEffect(() => {
    agentApi.getProfile().then(({ data }) => setAgentType(data.profile?.agentType || '')).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
            aria-label="Open agent menu"
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
            aria-label="Agent navigation"
            tabIndex={-1}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col overflow-y-auto overscroll-contain outline-none"
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-semibold text-gray-900 dark:text-white">Menu</span>
              <button type="button" aria-label="Close" onClick={() => setMobileOpen(false)} className="min-h-[44px] min-w-[44px] rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
            </div>
            <nav className="space-y-1 flex-1">
              <NavLinks location={location} onNavigate={() => setMobileOpen(false)} agentType={agentType} />
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

      <aside className="hidden lg:flex w-60 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <PortalBrand role="agent" />
        </div>
        <nav className="p-2 flex-1 space-y-1 overflow-y-auto" aria-label="Agent navigation">
          <NavLinks location={location} agentType={agentType} />
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
