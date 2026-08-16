import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';
import { SkipLink } from '../../components/a11y/SkipLink';
import { PortalBrand } from '../../components/brand/PortalBrand';
import { AgentNotificationBell } from '../../components/notifications/AgentNotificationBell';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import {
  agentNavGroups,
  isProviderDashboardPath,
  resolveProviderNavDomain,
} from '../../config/agentNavConfig';
import {
  authorizedDomainIdsForSubject,
  readProviderWorkspacePref,
  uniqueProviderSubjects,
  withProviderSubject,
  writeProviderWorkspacePref,
} from '../../config/providerWorkspacePref';
import {
  ActingAsControl,
  ActiveDashboardControl,
  AgentNavSection,
} from '../../components/agent/ProviderWorkspaceControls';
import { agentApi } from '../../services/agentService';
import { gbsProviderApi } from '../../services/gbsProviderApi';
import { portalNavLinkClass } from '../../components/layout/portalNavClasses';

function NavLinks({ location, onNavigate, items, subject }) {
  const activePath = items.reduce((best, { path, end, home }) => {
    const pathname = path.split('?')[0];
    const isHome = home && isProviderDashboardPath(location.pathname, location.search);
    const isMatch = home
      ? isHome
      : end
        ? location.pathname === pathname || location.pathname === `${pathname}/`
        : location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);
    if (!isMatch) return best;
    return !best || pathname.length > (best.split('?')[0].length) ? path : best;
  }, null);

  return items.map(({ path, label }) => {
    const to = withProviderSubject(path, subject);
    return (
      <Link
        key={`${path}-${label}`}
        to={to}
        onClick={onNavigate}
        aria-current={path === activePath ? 'page' : undefined}
        className={portalNavLinkClass(path === activePath)}
      >
        <span className="break-words">{label}</span>
      </Link>
    );
  });
}

function AgentNavTree({ location, onNavigate, groups, accountGroup, subject }) {
  return (
    <>
      {groups.map((group) => (
        <AgentNavSection key={group.id} id={group.id} label={group.label}>
          <NavLinks location={location} onNavigate={onNavigate} items={group.items} subject={subject} />
        </AgentNavSection>
      ))}
      <AgentNavSection id={accountGroup.id} label={accountGroup.label}>
        <NavLinks location={location} onNavigate={onNavigate} items={accountGroup.items} subject={subject} />
      </AgentNavSection>
    </>
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

  const subjectDomainIds = currentSubject?.domainIds || [];
  const preferredDomainId = subjectDomainIds.includes(prefRef.current?.domainId) ? prefRef.current.domainId : null;

  const navModel = useMemo(
    () => agentNavGroups({
      agentType,
      gbsEnabled,
      providerDomainId: routeDomainId,
      workspaces,
      subjectType: params.get('subjectType') || currentSubject?.subjectType,
      subjectId: params.get('subjectId') || currentSubject?.subjectId,
      isProviderHome,
      preferredDomainId,
    }),
    [agentType, gbsEnabled, routeDomainId, workspaces, currentSubject, params, isProviderHome, preferredDomainId]
  );

  useEffect(() => {
    if (!currentSubject) return;
    const domainId = isProviderHome ? preferredDomainId : (navModel.operationalDomainId || preferredDomainId);
    const next = {
      subjectType: currentSubject.subjectType,
      subjectId: String(currentSubject.subjectId),
      domainId: domainId || null,
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
  }, [currentSubject, isProviderHome, navModel.operationalDomainId, preferredDomainId]);

  const canAddCategory = (
    (subjectDomainIds.includes(PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
      && !subjectDomainIds.includes(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES)
      && gbsEnabled)
    || (subjectDomainIds.includes(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES)
      && !subjectDomainIds.includes(PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY))
  );

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.AGENT_LOGIN, { replace: true });
  };

  const chrome = subjects.length ? (
    <>
      <ActingAsControl
        subjects={subjects}
        current={currentSubject}
        activeDomainId={navModel.operationalDomainId}
      />
      <ActiveDashboardControl
        domainIds={subjectDomainIds}
        activeDomainId={navModel.operationalDomainId}
        subject={currentSubject}
        isProviderHome={isProviderHome}
        canAddCategory={canAddCategory}
      />
    </>
  ) : null;

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
            {chrome}
            <nav className="flex-1 min-w-0" aria-label="Provider navigation">
              <AgentNavTree
                location={location}
                onNavigate={() => setMobileOpen(false)}
                groups={navModel.domainGroups}
                accountGroup={navModel.accountGroup}
                subject={currentSubject}
              />
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

      <aside className="hidden lg:flex w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col min-w-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <PortalBrand role="agent" />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Agent Portal</p>
        </div>
        <div className="pt-3">{chrome}</div>
        <nav className="p-2 flex-1 overflow-y-auto min-w-0" aria-label="Provider navigation">
          <AgentNavTree
            location={location}
            groups={navModel.domainGroups}
            accountGroup={navModel.accountGroup}
            subject={currentSubject}
          />
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
