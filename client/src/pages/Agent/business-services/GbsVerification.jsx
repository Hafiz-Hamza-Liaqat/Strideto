import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, errorBox, h2, muted, wrap } from './gbsUi';

/**
 * Business Verification is a summary surface only.
 * Capability/jurisdiction mutations stay on their dedicated pages.
 */
export default function GbsVerification() {
  const { selected, catalog } = useGbsProvider();
  const [caps, setCaps] = useState([]);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      setCaps([]);
      setListings([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      gbsProviderApi.listCapabilities(selected),
      gbsProviderApi.listListings(selected).catch(() => ({ data: { items: [] } })),
    ])
      .then(([c, l]) => {
        if (cancelled) return;
        setCaps(c.data?.items || []);
        setListings(l.data?.items || []);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load Business Verification summary.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selected]);

  if (!selected) return <div className={emptyBox}>Select an authorized provider subject first.</div>;
  if (loading) return <div className={`${card} ${muted}`} aria-busy="true">Loading Business Verification…</div>;
  if (error) return <div className={errorBox} role="alert">{error}</div>;

  const claimed = caps.length;
  const approvedCaps = caps.filter((c) => {
    const s = String(c.verificationStatus || c.status || '').toLowerCase();
    return s === 'verified' || s === 'approved';
  }).length;
  const pendingCaps = caps.filter((c) => {
    const s = String(c.verificationStatus || c.status || '').toLowerCase();
    return s.includes('pending') || s.includes('review') || s.includes('submitted') || s.includes('claimed');
  }).length;
  const jurisdictionIds = new Set();
  for (const cap of caps) {
    for (const j of cap.jurisdictionIds || cap.jurisdictions || []) {
      jurisdictionIds.add(typeof j === 'string' ? j : j.jurisdictionId || j.id);
    }
  }
  const catalogJurisdictionCount = (catalog?.jurisdictions || []).length;

  return (
    <div className="space-y-5 min-w-0">
      <header className="space-y-2">
        <h2 className={h2}>Business Verification</h2>
        <p className={`${muted} ${wrap}`}>
          Summary of organization and Business Services eligibility for{' '}
          <span className="text-gray-900 dark:text-white">{selected.label}</span>.
          Claiming a capability does not verify it. Protected titles remain evidence-gated.
          Business public marketplace remains off.
        </p>
      </header>

      <section className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Domain state</h3>
        <ul className={`mt-2 space-y-1 text-sm ${wrap}`}>
          <li>Provider subject: {selected.label}</li>
          <li>Domain enrollment: active for this subject (enrollment ≠ verification)</li>
          <li>Capabilities claimed: {claimed}</li>
          <li>Capabilities pending / claimed: {pendingCaps}</li>
          <li>Capabilities verified (server status): {approvedCaps}</li>
          <li>Jurisdiction scopes on claims: {jurisdictionIds.size}</li>
          <li>Catalog jurisdictions available for setup: {catalogJurisdictionCount}</li>
          <li>Service listings (draft/active inventory): {listings.length}</li>
        </ul>
      </section>

      <section className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Capabilities</h3>
        {caps.length === 0 ? (
          <p className={`mt-2 ${muted}`}>No capabilities claimed yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {caps.map((cap) => (
              <li key={cap._id || cap.capabilityId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="break-words text-gray-900 dark:text-white">
                  {cap.capabilityId || cap.label || 'Capability'}
                </span>
                <StatusBadge status={cap.verificationStatus || cap.status || 'claimed'} />
              </li>
            ))}
          </ul>
        )}
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES} className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary">
          Manage capabilities →
        </Link>
      </section>

      <section className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Jurisdictions</h3>
        <p className={`mt-2 ${muted} ${wrap}`}>
          Business jurisdictions are legal/professional service scopes configured with capabilities.
          They are not Education study destinations.
        </p>
        {jurisdictionIds.size === 0 ? (
          <p className={`mt-2 ${muted}`}>No jurisdiction scopes on claimed capabilities yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm break-words">
            {[...jurisdictionIds].filter(Boolean).map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        )}
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS} className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary">
          Manage jurisdictions →
        </Link>
      </section>

      <section className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Eligibility blockers</h3>
        <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${wrap}`}>
          <li>Public Business marketplace discovery is disabled in this environment.</li>
          <li>Capability claims never self-verify; Admin/evidence approval is required.</li>
          <li>Protected-title activity requires the exact corresponding verified capability and jurisdiction.</li>
          <li>Education professional approval does not grant Business eligibility.</li>
        </ul>
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS} className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary">
          Manage services →
        </Link>
      </section>
    </div>
  );
}
