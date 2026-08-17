import { useMemo } from 'react';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, GbsRouteState, h1, h2, muted, wrap } from './gbsUi';

function eligibilityLabel(row) {
  if (row.currentReviewed) return 'current reviewed';
  if (row.reviewStatus === 'stale') return 'stale / not current';
  if (row.launchCandidate) return 'candidate / review readiness';
  return 'structural availability';
}

export default function GbsJurisdictions() {
  const { catalog } = useGbsProvider();
  const grouped = useMemo(() => {
    const countries = catalog?.launchCountryCodes || [];
    const jurisdictions = catalog?.jurisdictions || [];
    return countries.map((code) => ({
      code,
      rows: jurisdictions.filter((j) => j.countryCode === code),
    }));
  }, [catalog]);

  if (!catalog) return <GbsRouteState title="Jurisdictions">Catalog is unavailable.</GbsRouteState>;
  const entityTypes = catalog.entityTypes || [];
  const capabilities = catalog.capabilities || [];

  return (
    <div className="space-y-6">
      <h1 className={h1}>Jurisdictions</h1>
      <p className={`${muted} ${wrap}`}>
        Coverage is catalog-backed. Structural US states are listed for setup. Only current reviewed facts may be treated as legal truth. Draft jurisdictions are not CURRENT.
      </p>
      <section className={card}>
        <h2 className={h2}>Canonical capabilities</h2>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {capabilities.map((c) => (
            <li key={c.capabilityId} className={`${wrap} text-sm text-gray-800 dark:text-gray-100`}>
              {c.publicName}
              {c.protectedTitleRequired ? ' · protected title' : ''}
            </li>
          ))}
        </ul>
      </section>
      {grouped.map((group) => (
        <section key={group.code} className="space-y-3">
          <h2 className={h2}>{group.code}</h2>
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {group.rows.map((j) => {
              const entities = entityTypes.filter((e) => e.jurisdictionId === j.id);
              return (
                <li key={j.id} className={card}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className={`font-semibold text-gray-900 dark:text-white ${wrap}`}>{j.name}</h3>
                    <StatusBadge status={j.currentReviewed ? 'current' : j.reviewStatus} label={eligibilityLabel(j)} />
                  </div>
                  <p className={`${muted} mt-2 ${wrap}`}>Registry id: {j.id}</p>
                  <p className={`${muted} ${wrap}`}>
                    Launch candidate: {j.launchCandidate ? 'yes' : 'no'}. Structural: yes.
                  </p>
                  <p className={`mt-2 text-sm text-gray-800 dark:text-gray-100 ${wrap}`}>
                    Entity types: {entities.length ? entities.map((e) => e.displayName || e.officialName || e.code).join(', ') : 'none catalogued'}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
