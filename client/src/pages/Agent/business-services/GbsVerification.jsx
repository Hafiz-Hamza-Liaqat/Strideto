import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, errorBox, h1, muted, wrap } from './gbsUi';
import { businessVerificationSummary } from './businessVerificationPresentation';

function VerificationState({ children, error = false, embedded = false }) {
  const Heading = embedded ? 'h3' : 'h1';
  return <div className="space-y-4"><Heading className={h1}>Business Verification</Heading><div className={error ? errorBox : card} role={error ? 'alert' : 'status'}>{children}</div></div>;
}

/**
 * Business Verification is a summary surface only.
 * Capability/jurisdiction mutations stay on their dedicated pages.
 */
export default function GbsVerification({ embedded = false }) {
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

  if (!selected) return <VerificationState embedded={embedded}>Select an authorized provider subject first.</VerificationState>;
  if (loading) return <VerificationState embedded={embedded}>Loading Business Verification…</VerificationState>;
  if (error) return <VerificationState embedded={embedded} error>{error}</VerificationState>;

  const summary = businessVerificationSummary(caps);
  const { claims, jurisdictionIds } = summary;
  const catalogJurisdictionCount = (catalog?.jurisdictions || []).length;

  return (
    <div className="space-y-5 min-w-0">
      <header className="space-y-2">
        {embedded ? <h3 className={h1}>Business Verification</h3> : <h1 className={h1}>Business Verification</h1>}
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
          <li>Capabilities claimed: {summary.claimed}</li>
          <li>Capabilities under evidence review: {summary.underReview}</li>
          <li>Capabilities needing changes: {summary.needsChanges}</li>
          <li>Capabilities verified for current-reviewed scope: {summary.productionVerified}</li>
          <li>Capabilities suspended or revoked: {summary.suspendedOrRevoked}</li>
          <li>Jurisdiction scopes on claims: {jurisdictionIds.size}</li>
          <li>Catalog jurisdictions available for setup: {catalogJurisdictionCount}</li>
          <li>Service listings (draft/active inventory): {listings.length}</li>
        </ul>
      </section>

      <section className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Capabilities</h3>
        {claims.length === 0 ? (
          <p className={`mt-2 ${muted}`}>No capabilities claimed yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {claims.map((cap) => (
              <li key={cap.id || cap.capabilityId} className={`${card} text-sm`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-words font-medium text-gray-900 dark:text-white">{cap.publicName || cap.capabilityId || 'Capability'}</span>
                  <StatusBadge status={cap.trustStatus} />
                </div>
                <p className={`mt-2 ${muted}`}>Evidence/review state: {cap.trustStatus.replaceAll('_', ' ')}</p>
                <p className={cap.productionAuthorized ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}>Production authority: {cap.authorityLabel}</p>
                <p className={muted}>Jurisdictions: {cap.jurisdictionIds.join(', ') || 'none'}</p>
                <p className={muted}>Entity types: {cap.entityTypeIds.join(', ') || 'none specified'}</p>
                <p className={muted}>Protected-title scope: {cap.protectedTitleIds.join(', ') || (cap.protectedTitleRequired ? 'required but not approved in scope' : 'not required')}</p>
                {(cap.jurisdictionReadiness || []).map((row) => <p key={row.jurisdictionId} className={muted}>{row.jurisdictionId}: {row.productionReady ? 'current reviewed' : `${row.state} — not live`}</p>)}
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
