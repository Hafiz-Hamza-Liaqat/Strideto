import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { SETUP_STEPS, card, emptyBox, errorBox, h2, muted, wrap } from './gbsUi';

const COUNTER_CARDS = [
  ['capabilityClaims', 'Capability claims'],
  ['verifiedCapabilities', 'Verified capabilities'],
  ['capabilitiesUnderReview', 'Capabilities under review'],
  ['capabilitiesNeedingInformation', 'Needs information'],
  ['suspendedCapabilities', 'Suspended capabilities'],
  ['jurisdictionsCoveredByVerified', 'Jurisdictions with verified coverage'],
  ['draftListings', 'Draft listings'],
  ['listingsUnderReview', 'Listings under review'],
  ['approvedInternalListings', 'Approved internal listings'],
];

export default function GbsOverview() {
  const { selected } = useGbsProvider();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      setSummary(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi
      .getOverview(selected)
      .then(({ data }) => {
        if (!cancelled) {
          setSummary(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? 'Provider subject is not available.' : 'Unable to load overview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!selected) {
    return <div className={emptyBox}>No authorized Business Services subject is available.</div>;
  }
  if (loading) {
    return <div className={`${card} ${muted}`} aria-busy="true">Loading overview…</div>;
  }
  if (error) {
    return <div className={errorBox} role="alert">{error}</div>;
  }

  const counters = summary?.counters || {};

  return (
    <div className="space-y-6">
      <section aria-labelledby="gbs-counters-heading">
        <h2 id="gbs-counters-heading" className={h2}>Workspace status</h2>
        <p className={`${muted} mt-1`}>Counts are server-authoritative for the selected subject only.</p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {COUNTER_CARDS.map(([key, label]) => (
            <li key={key} className={card}>
              <p className={`${muted} ${wrap}`}>{label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{counters[key] ?? 0}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className={card} aria-labelledby="gbs-setup-heading">
        <h2 id="gbs-setup-heading" className={h2}>Setup readiness</h2>
        <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-gray-800 dark:text-gray-100">
          {SETUP_STEPS.map((step) => (
            <li key={step} className={wrap}>{step}</li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES} className={`${ui.primaryBtn} ${wrap}`}>
            Open capabilities
          </Link>
          <Link to={ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS} className={`${ui.secondaryBtn} ${wrap}`}>
            Open listings
          </Link>
        </div>
      </section>
    </div>
  );
}
