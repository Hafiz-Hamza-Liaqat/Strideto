import { NavLink, Outlet } from 'react-router-dom';
import { SearchableSelect } from '../../../components/forms/SearchableSelect';
import { ROUTES } from '../../../constants';
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

function GbsWorkspaceShell() {
  const { loading, error, selected } = useGbsProvider();
  return (
    <div className={page}>
      <header className="space-y-3 min-w-0">
        <h1 className={h1}>Business Formation & Corporate Services</h1>
        <p className={`${muted} ${wrap}`}>
          Company formation and corporate-services provider workspace. This is not the Education & Mobility Services catalog,
          not Identity verification, and not a public marketplace.
        </p>
        {loading ? <div className={skeleton} aria-busy="true" /> : null}
        {error ? <div className={errorBox} role="alert">{error}</div> : null}
        {!loading && !error ? <SubjectSwitcher /> : null}
        {selected ? (
          <p className={`${muted} ${wrap}`}>
            Current subject: <span className="text-gray-900 dark:text-white">{selected.label}</span>
          </p>
        ) : null}
      </header>
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
