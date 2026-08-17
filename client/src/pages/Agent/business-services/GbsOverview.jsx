import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { SETUP_STEPS, card, emptyBox, errorBox, h1, h2, muted, wrap } from './gbsUi';
import { SeoHead } from '../../../components/seo';

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
  ['openCases', 'Open service Cases'],
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
  const attention = [
    Number(counters.capabilitiesNeedingInformation) > 0
      ? { to: ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES, label: 'Capabilities needing information', value: counters.capabilitiesNeedingInformation }
      : null,
    Number(counters.listingsUnderReview) > 0
      ? { to: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS, label: 'Listings under review', value: counters.listingsUnderReview }
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <SeoHead title="Business Services Overview" noindex />
      <h1 className={h1}>Overview</h1>
      {attention.length ? (
        <section className={card} aria-labelledby="gbs-attention-heading">
          <h2 id="gbs-attention-heading" className={h2}>Needs your attention</h2>
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className="text-sm font-medium text-primary hover:underline">
                  {item.label}: {item.value}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={card} aria-labelledby="gbs-operations-heading">
        <h2 id="gbs-operations-heading" className={h2}>Operational attention</h2>
        {(() => {
          const rows = [
            ...(summary?.attention?.requests || []).map((item) => ({ ...item, kind: 'Request', to: `${ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS}/${item.ref}` })),
            ...(summary?.attention?.quotes || []).map((item) => ({ ...item, kind: 'Quote awaiting customer', to: `${ROUTES.AGENT_BUSINESS_SERVICES_QUOTES}/${item.ref}` })),
            ...(summary?.attention?.cases || []).map((item) => ({ ...item, kind: 'Case', to: `${ROUTES.AGENT_BUSINESS_SERVICES_CASES}/${item.ref}` })),
            ...(summary?.attention?.messages || []).map((item) => ({ ...item, kind: 'Recent message', to: ROUTES.AGENT_BUSINESS_SERVICES_MESSAGES })),
          ].slice(0, 10);
          return rows.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{rows.map((item, index) => <li key={`${item.kind}-${item.ref}-${index}`}><Link to={item.to} className="block rounded-lg border border-gray-200 p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700"><span className={`${muted} text-xs font-semibold uppercase`}>{item.kind}</span><span className="block font-medium text-gray-900 dark:text-white">{item.title || item.ref}</span><span className={muted}>{item.status?.replaceAll('_', ' ') || item.contextType?.replaceAll('_', ' ')}</span></Link></li>)}</ul> : <p className={`${muted} mt-3`}>You are up to date. No current Business Services item needs attention.</p>;
        })()}
      </section>
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
          <Link to={ROUTES.AGENT_BUSINESS_SERVICES_CASES} className={`${ui.secondaryBtn} ${wrap}`}>
            Open cases
          </Link>
        </div>
      </section>
    </div>
  );
}
