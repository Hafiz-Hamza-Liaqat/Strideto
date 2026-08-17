import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { SkipLink } from '../../components/a11y/SkipLink';
import { PortalBrand } from '../../components/brand/PortalBrand';
import { AgentNotificationBell } from '../../components/notifications/AgentNotificationBell';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import {
  agentNavGroups,
  isProviderDashboardPath,
  resolveActiveNavPath,
  resolveProviderNavDomain,
} from '../../config/agentNavConfig';
import {
  authorizedDomainIdsForSubject,
  readProviderWorkspacePref,
  uniqueProviderSubjects,
  withProviderSubject,
  writeProviderWorkspacePref,
} from '../../config/providerWorkspacePref';
import { ActingAsControl, AgentNavSection } from '../../components/agent/ProviderWorkspaceControls';
import { agentApi } from '../../services/agentService';
import { gbsProviderApi } from '../../services/gbsProviderApi';
import { portalNavLinkClass } from '../../components/layout/portalNavClasses';

function NavLinks({ onNavigate, items, subject, activePath }) {
  return items.map(({ path, label }) => {
    const to = withProviderSubject(path, subject);
    const isActive = path === activePath;
    return (
      <Link
        key={`${path}-${label}`}
        to={to}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={portalNavLinkClass(isActive)}
      >
        <span className="break-words">{label}</span>
      </Link>
    );
  });
}

function AgentNavTree({ location, onNavigate, groups, subject, settingsItem }) {
  const allItems = [
    ...groups.flatMap((group) => group.items || []),
    ...(settingsItem ? [settingsItem] : []),
  ];
  const activePath = resolveActiveNavPath(location, allItems);
  return (
    <>
      {groups.map((group) => (
        <AgentNavSection key={group.id} id={group.id} label={group.label}>
          <NavLinks
            onNavigate={onNavigate}
            items={group.items}
            subject={subject}
            activePath={activePath}
          />
        </AgentNavSection>
      ))}
    </>
  );
}

function SidebarFooter({ agent, onLogout, settingsItem, subject, location, onNavigate }) {
  const activePath = resolveActiveNavPath(location, settingsItem ? [settingsItem] : []);
  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-2 break-words-safe mb-1">{agent?.email || ''}</p>
      {settingsItem ? (
        <NavLinks
          onNavigate={onNavigate}
          items={[settingsItem]}
          subject={subject}
          activePath={activePath}
        />
      ) : null}
      <button
        type="button"
        onClick={onLogout}
        className="mt-1 w-full text-left px-3 py-2.5 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg min-h-[44px]"
      >
        Log out
      </button>
    </div>
  );
}

export default function AgentLayout() {
  const location = useLocation();
  const [params, setSearchParams] = useSearchParams();
  const { agent, logout } = useAgentAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agentType, setAgentType] = useState(agent?.agentType || '');
  const [gbsEnabled, setGbsEnabled] = useState(false);
  const [context, setContext] = useState({ workspaces: [] });
  const panelRef = useRef(null);
  const prevSubjectRef = useRef(null);
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

  const workspaces = useMemo(() => context.workspaces || [], [context.workspaces]);
  const routeDomainId = resolveProviderNavDomain(location.pathname);
  const isProviderHome = isProviderDashboardPath(location.pathname, location.search);
  const prefRef = useRef(readProviderWorkspacePref());

  const subjects = useMemo(() => {
    return uniqueProviderSubjects(workspaces).map((subject) => ({
      ...subject,
      domainIds: authorizedDomainIdsForSubject(workspaces, subject),
    }));
  }, [workspaces]);

  const currentSubject = useMemo(() => {
    const qType = params.get('subjectType');
    const qId = params.get('subjectId');
    const pref = prefRef.current;
    if (qType && qId) {
      const fromUrl = subjects.find((s) => s.subjectType === qType && String(s.subjectId) === String(qId));
      if (fromUrl) return fromUrl;
    }
    if (pref) {
      const fromPref = subjects.find((s) => s.subjectType === pref.subjectType && String(s.subjectId) === String(pref.subjectId));
      if (fromPref) return fromPref;
    }
    if (routeDomainId) {
      const forDomain = workspaces.find((w) => w.domainId === routeDomainId);
      if (forDomain) {
        return subjects.find((s) => s.subjectType === forDomain.subjectType && String(s.subjectId) === String(forDomain.subjectId)) || null;
      }
    }
    return subjects[0] || null;
  }, [params, subjects, routeDomainId, workspaces]);

  const navModel = useMemo(
    () => agentNavGroups({
      agentType,
      gbsEnabled,
      providerDomainId: routeDomainId,
      workspaces,
      subjectType: params.get('subjectType') || currentSubject?.subjectType,
      subjectId: params.get('subjectId') || currentSubject?.subjectId,
      isProviderHome,
    }),
    [agentType, gbsEnabled, routeDomainId, workspaces, currentSubject, params, isProviderHome]
  );

  useEffect(() => {
    const qType = params.get('subjectType');
    const qId = params.get('subjectId');
    if (qType && qId) {
      prevSubjectRef.current = { subjectType: qType, subjectId: qId };
      return;
    }
    const prev = prevSubjectRef.current;
    if (!prev || (!isProviderHome && !routeDomainId)) return;
    const next = new URLSearchParams(params);
    next.set('subjectType', prev.subjectType);
    next.set('subjectId', prev.subjectId);
    setSearchParams(next, { replace: true });
  }, [params, isProviderHome, routeDomainId, setSearchParams]);

  useEffect(() => {
    if (!currentSubject) return;
    const domainId = isProviderHome ? null : (navModel.operationalDomainId || null);
    const next = {
      subjectType: currentSubject.subjectType,
      subjectId: String(currentSubject.subjectId),
      domainId,
    };
    const prev = prefRef.current;
    if (
      prev
      && prev.subjectType === next.subjectType
      && String(prev.subjectId) === next.subjectId
      && (prev.domainId || null) === next.domainId
    ) {
      return;
    }
    writeProviderWorkspacePref(next);
    prefRef.current = next;
  }, [currentSubject, isProviderHome, navModel.operationalDomainId]);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.AGENT_LOGIN, { replace: true });
  };

  const chrome = subjects.length ? (
    <ActingAsControl
      subjects={subjects}
      current={currentSubject}
      activeDomainId={navModel.operationalDomainId}
      isProviderHome={isProviderHome}
      hideBacklink={isProviderHome}
    />
  ) : null;

  const navTree = (
    <AgentNavTree
      location={location}
      groups={navModel.domainGroups}
      subject={currentSubject}
      settingsItem={navModel.settingsItem}
    />
  );

  const footerProps = {
    agent,
    settingsItem: navModel.settingsItem,
    subject: currentSubject,
    location,
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
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col outline-none"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <span className="font-semibold text-gray-900 dark:text-white">Menu</span>
              <button type="button" aria-label="Close" onClick={() => setMobileOpen(false)} className="min-h-[44px] min-w-[44px] rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
            </div>
            <div className="shrink-0">{chrome}</div>
            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2" aria-label="Provider navigation">
              {navTree}
            </nav>
            <SidebarFooter
              {...footerProps}
              onLogout={() => { handleLogout(); setMobileOpen(false); }}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col min-w-0 min-h-screen">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <PortalBrand role="agent" />
        </div>
        <div className="pt-3 shrink-0">{chrome}</div>
        <nav className="p-2 flex-1 min-h-0 overflow-y-auto" aria-label="Provider navigation">
          {navTree}
        </nav>
        <SidebarFooter {...footerProps} onLogout={handleLogout} />
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
