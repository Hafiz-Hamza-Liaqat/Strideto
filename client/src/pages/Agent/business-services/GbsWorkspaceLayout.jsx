import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
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
  { to: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS, label: 'My Services' },
  { to: ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS, label: 'Requests' },
  { to: ROUTES.AGENT_BUSINESS_SERVICES_QUOTES, label: 'Quotes' },
  { to: ROUTES.AGENT_BUSINESS_SERVICES_CASES, label: 'Cases' },
];

function SubjectSwitcher() {
  const { subjects, selected, selectSubject } = useGbsProvider();
  const [params, setParams] = useSearchParams();
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
          if (!match) return;
          selectSubject(match);
          const nextParams = new URLSearchParams(params);
          nextParams.set('subjectType', match.subjectType);
          nextParams.set('subjectId', String(match.subjectId));
          setParams(nextParams, { replace: true });
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

function requestedProviderSubject(params, accountId) {
  const subjectType = params.get('subjectType');
  const subjectId = params.get('subjectId');
  if ((subjectType === 'organization' || subjectType === 'agent') && subjectId) {
    return { subjectType, subjectId };
  }
  return { subjectType: 'agent', subjectId: accountId || '' };
}

function GbsSetupState({ enabled, loadError }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reload } = useGbsProvider();
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState('');

  const addBusinessForRequestedSubject = async () => {
    setBusy(true);
    setAddError('');
    try {
      const { data } = await agentApi.getProviderDomainContext();
      const subject = requestedProviderSubject(params, data?.accountId);
      if (!subject.subjectId) throw new Error('missing_subject');
      await agentApi.addProviderDomain({
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      });
      await reload();
      navigate(`${ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES}?subjectType=${subject.subjectType}&subjectId=${subject.subjectId}`);
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
          Back to Provider Dashboard
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
          onClick={addBusinessForRequestedSubject}
        >
          {busy ? 'Adding…' : 'Add Business Formation & Corporate Services'}
        </button>
        <Link
          to={`${ROUTES.AGENT_DASHBOARD}?home=1`}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Provider Dashboard
        </Link>
      </div>
    </div>
  );
}

function GbsWorkspaceShell() {
  const [params] = useSearchParams();
  const { loading, error, enabled, subjects, selected, selectSubject } = useGbsProvider();
  const requested = requestedProviderSubject(params, null);
  const urlSpecifiesSubject = (
    (params.get('subjectType') === 'organization' || params.get('subjectType') === 'agent')
    && Boolean(params.get('subjectId'))
  );
  const requestedMatch = urlSpecifiesSubject
    ? subjects.find((s) => s.subjectType === requested.subjectType && String(s.subjectId) === String(requested.subjectId))
    : null;
  const authorized = Boolean(enabled && (urlSpecifiesSubject ? requestedMatch : subjects.length > 0));

  useEffect(() => {
    if (!requestedMatch) return;
    if (
      selected
      && selected.subjectType === requestedMatch.subjectType
      && String(selected.subjectId) === String(requestedMatch.subjectId)
    ) {
      return;
    }
    selectSubject(requestedMatch);
  }, [requestedMatch, selected, selectSubject]);

  return (
    <div className={page}>
      <header className="space-y-3 min-w-0">
        <Link to={`${ROUTES.AGENT_DASHBOARD}?home=1`} className="text-sm font-medium text-primary hover:underline">
          ← Provider Dashboard
        </Link>
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
