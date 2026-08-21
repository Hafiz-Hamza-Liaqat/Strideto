import { useMemo } from 'react';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, GbsRouteState, h1, h2, muted, wrap } from './gbsUi';
import { countryDisplayName } from '@shared/international/country.js';

const DISCOVERABILITY_ONLY_CODES = Object.freeze([
  'DE', 'FR', 'IN', 'JP', 'NL', 'IE', 'NZ', 'ZA', 'SA',
]);

function eligibilityLabel(row) {
  if (row.currentReviewed) return 'current reviewed';
  if (row.reviewStatus === 'stale') return 'stale / not current';
  if (row.launchCandidate) return 'candidate / review readiness';
  return 'Coverage not yet verified';
}

export default function GbsJurisdictions() {
  const { catalog } = useGbsProvider();
  const grouped = useMemo(() => {
    const jurisdictions = catalog?.jurisdictions || [];
    const launchSet = new Set(catalog?.launchCountryCodes || []);
    const countryLevel = jurisdictions.filter((j) => !j.parentJurisdictionId);
    const sorted = [
      ...countryLevel.filter((j) => launchSet.has(j.countryCode)),
      ...countryLevel.filter((j) => !launchSet.has(j.countryCode)),
    ];
    return sorted.map((countryEntry) => {
      const code = countryEntry.countryCode;
      const subnational = jurisdictions.filter((j) => !!j.parentJurisdictionId && j.countryCode === code);
      return { code, countryName: countryEntry.name || code, countryEntry, subnational, isLaunch: launchSet.has(code) };
    });
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
          <h2 className={h2}>
            {group.countryName}
            {!group.isLaunch && (
              <span className={`ml-2 text-xs font-normal ${muted}`}>— Coverage not yet verified</span>
            )}
          </h2>
          {group.countryEntry && (
            <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
              <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${wrap}`}>
                National / Federal level
              </span>
              <StatusBadge
                status={group.countryEntry.currentReviewed ? 'current' : group.countryEntry.reviewStatus}
                label={eligibilityLabel(group.countryEntry)}
              />
            </div>
          )}
          {!group.subnational.length && (
            <p className={`${muted} text-sm italic ${wrap}`}>
              Subnational coverage not yet verified — structural availability only.
            </p>
          )}
          {group.subnational.length > 0 && (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {group.subnational.map((j) => {
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
          )}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className={h2}>International discoverability index</h2>
        <p className={`${muted} text-sm ${wrap}`}>
          The following countries are listed for discoverability only. Provider coverage is not yet available in these markets. No formation rules, fees, or entity types are catalogued.
        </p>
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {DISCOVERABILITY_ONLY_CODES.map((code) => (
            <li key={code} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
              <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${wrap}`}>
                {countryDisplayName(code)}
              </span>
              <StatusBadge status="draft" label="Coverage not yet verified" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
