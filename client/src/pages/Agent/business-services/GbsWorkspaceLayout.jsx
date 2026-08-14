import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SearchableSelect } from '../../../components/forms/SearchableSelect';
import { ROUTES } from '../../../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';
import { agentApi } from '../../../services/agentService';
import { GbsProviderContextProvider, useGbsProvider } from './GbsProviderContext';
import { card, errorBox, h1, muted, page, skeleton, wrap } from './gbsUi';

const SUBNAV = [
  { to: ROUTES.AGENT_BUSINESS_SERVICES, label: 'Overview', end: true },
  { to: ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES, label: 'Capabilities' },
  { to: ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS, label: 'Jurisdictions' },
  { to: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS, label: 'Service Listings' },
];

function SubjectSwitcher() {
  const { subjects, selected, selectSubject } = useGbsProvider();
  if (!selected || subjects.length <= 1) return null;
  return (
    <div className="min-w-0 max-w-xl">
      <label htmlFor="gbs-subject-switcher" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
        Acting as
      </label>
      <SearchableSelect
        id="gbs-subject-switcher"
        aria-label="Business Services provider subject"
        value={`${selected.subjectType}:${selected.subjectId}`}
        onChange={(next) => {
          const match = subjects.find((s) => `${s.subjectType}:${s.subjectId}` === next);
          if (match) selectSubject(match);
        }}
        options={subjects.map((s) => ({
          value: `${s.subjectType}:${s.subjectId}`,
          label: s.label,
        }))}
      />
      <p className={`${muted} mt-1`}>
        Subject selection is workspace context only. The server re-checks membership on every action.
      </p>
    </div>
  );
}

function GbsSetupState({ enabled, loadError }) {
  const navigate = useNavigate();
  const { reload } = useGbsProvider();
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState('');

  const addIndependentBusiness = async () => {
    setBusy(true);
    setAddError('');
    try {
      const { data } = await agentApi.getProviderDomainContext();
      const subjectId = data?.accountId;
      if (!subjectId) throw new Error('missing_subject');
      await agentApi.addProviderDomain({
        subjectType: 'agent',
        subjectId,
        domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      });
      await reload();
      navigate(`${ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES}?subjectType=agent&subjectId=${subjectId}`);
    } catch (err) {
      setAddError(err.response?.data?.error || 'Unable to add Business Formation & Corporate Services.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return <div className={errorBox} role="alert">{loadError}</div>;
  }

  if (!enabled) {
    return (
      <div className={card}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Coming soon</h2>
        <p className={`mt-2 ${muted} ${wrap}`}>
          Business Formation & Corporate Services is not available in this environment.
        </p>
        <Link to={`${ROUTES.AGENT_DASHBOARD}?home=1`} className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary">
          Back to Provider Home
        </Link>
      </div>
    );
  }

  return (
    <div className={card}>
      <h2 className="font-semibold text-gray-900 dark:text-white break-words">Business Formation & Corporate Services</h2>
      <p className={`mt-2 ${muted} ${wrap}`}>
        This provider category has not been added to this provider subject. Opening this URL does not activate
        the domain and does not verify professional capabilities.
      </p>
      {addError ? <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{addError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy}
          onClick={addIndependentBusiness}
        >
          {busy ? 'Adding…' : 'Add Business Formation & Corporate Services'}
        </button>
        <Link
          to={`${ROUTES.AGENT_DASHBOARD}?home=1`}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Provider Home
        </Link>
      </div>
    </div>
  );
}

function GbsWorkspaceShell() {
  const { loading, error, enabled, subjects, selected } = useGbsProvider();
  const authorized = enabled && subjects.length > 0;

  return (
    <div className={page}>
      <header className="space-y-3 min-w-0">
        <h1 className={h1}>Business Formation & Corporate Services</h1>
        <p className={`${muted} ${wrap}`}>
          Company formation and corporate-services provider workspace. This is not the Education & Mobility Services catalog,
          not Identity verification, and not a public marketplace.
        </p>
        {loading ? <div className={skeleton} aria-busy="true" /> : null}
        {authorized && error ? <div className={errorBox} role="alert">{error}</div> : null}
        {authorized && !loading ? <SubjectSwitcher /> : null}
        {authorized && selected ? (
          <p className={`${muted} ${wrap}`}>
            Current subject: <span className="text-gray-900 dark:text-white">{selected.label}</span>
          </p>
        ) : null}
      </header>
      {authorized ? (
        <>
          <nav aria-label="Business Services sections" className="flex flex-wrap gap-2">
            {SUBNAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium ${wrap} ${
                    isActive
                      ? 'bg-blue-700 text-white dark:bg-blue-600'
                      : 'border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="min-w-0">
            {loading ? (
              <div className={`${card} space-y-3`} aria-busy="true">
                <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </>
      ) : loading ? null : (
        <GbsSetupState enabled={enabled} loadError={error} />
      )}
    </div>
  );
}

export default function GbsWorkspaceLayout() {
  return (
    <GbsProviderContextProvider>
      <GbsWorkspaceShell />
    </GbsProviderContextProvider>
  );
}
