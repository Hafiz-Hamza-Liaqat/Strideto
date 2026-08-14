import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';
import { btnPrimary, cardClass, inputClass, muted } from './agentUi';

export default function AgentTrust() {
  const [data, setData] = useState({ reviews: [], reports: [], disputes: [] });
  const [verification, setVerification] = useState(null);
  const [domainContext, setDomainContext] = useState({ workspaces: [], addableDomains: [] });
  const [reply, setReply] = useState({});
  const [error, setError] = useState('');
  const load = () => Promise.all([
    agentApi.getReviews(),
    agentApi.getReports(),
    agentApi.getDisputes(),
    agentApi.getVerification().catch(() => ({ data: null })),
    agentApi.getProviderDomainContext().catch(() => ({ data: { workspaces: [], addableDomains: [] } })),
  ]).then(([r, p, d, v, ctx]) => {
    setData({ reviews: r.data.reviews || [], reports: p.data.reports || [], disputes: d.data.disputes || [] });
    setVerification(v.data);
    setDomainContext(ctx.data || { workspaces: [], addableDomains: [] });
  });
  useEffect(() => { load().catch((e) => setError(e.response?.data?.error || 'Unable to load trust center.')); }, []);
  const workspaces = domainContext.workspaces || [];
  const hasBusinessWorkspace = workspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  const canAddBusiness = (domainContext.addableDomains || []).some((d) => d.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Trust & Verification</h1>
        <p className={muted}>Identity, organization, and professional-domain verification are separate. Identity Verified is not Registered Agent capability verified.</p>
      </header>
      {error ? <p className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      <section className={cardClass}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Identity & Organization</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-800 dark:text-gray-200">
          <li>{verification?.emailVerified ? '✓' : '○'} Email</li>
          <li>○ Identity — {verification?.identityStatus || verification?.verificationStatus || 'not submitted'}</li>
          <li>○ Organization — {verification?.verificationStatus || 'unknown'}</li>
        </ul>
        <p className={`mt-2 ${muted}`}>Organization Verified is not a professional title and is not Registered Agent or ACSP verification.</p>
        <Link to={ROUTES.AGENT_VERIFICATION} className="mt-3 inline-block text-sm text-primary">Manage identity & organization verification →</Link>
      </section>
      <section className={cardClass}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Professional domains</h2>
        <p className={`mt-2 ${muted}`}>Only activated domains appear here. Adding a domain does not verify capabilities.</p>
        <p className="mt-2 text-sm">
          Education & Mobility professional verification:{' '}
          {verification?.verificationStatus || 'unknown'}
        </p>
        <Link to={ROUTES.AGENT_VERIFICATION} className="mt-2 inline-block text-sm text-primary">Manage Education Verification →</Link>
        {hasBusinessWorkspace ? (
          <>
            <p className="mt-3 text-sm">
              Business Formation & Corporate Services capabilities are managed in the Business workspace. Capability trust is not granted by domain enrollment.
            </p>
            <Link to={ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES} className="mt-2 inline-block text-sm text-primary">Manage Business Verification →</Link>
          </>
        ) : canAddBusiness ? (
          <>
            <p className="mt-3 text-sm">
              Business Formation & Corporate Services has not been added to this provider. Adding a domain does not verify professional capabilities.
            </p>
            <Link to={`${ROUTES.AGENT_DASHBOARD}?home=1`} className="mt-2 inline-block text-sm text-primary">
              + Add Business Formation & Corporate Services
            </Link>
          </>
        ) : null}
      </section>
      <section className={cardClass}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Organization / professional verification</h2>
        <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">Status: {verification?.verificationStatus || 'unknown'} · Approved capability: {verification?.isApproved ? 'yes' : 'no'}</p>
        <p className={`mt-2 ${muted}`}>Granular badges come from accepted evidence only. Maps/Business cannot alone produce VERIFIED.</p>
        <p className="mt-2 text-sm">Badges: {(verification?.trustBadges || []).join(', ') || 'none'}</p>
        <Link to={ROUTES.AGENT_VERIFICATION} className="mt-3 inline-block text-sm text-primary">Open verification →</Link>
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Verified-interaction reviews</h2>
        {(data.reviews || []).length === 0 ? <p className={`${cardClass} mt-3 ${muted}`}>No reviews yet.</p> : data.reviews.map((x) => (
          <article key={x._id} className={`${cardClass} mt-3`}>
            <p className="text-gray-900 dark:text-white">{x.rating}/5 · {x.body}</p>
            {x.response ? <p className={`mt-2 ${muted}`}>Agent response: {x.response.body}</p> : (
              <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); await agentApi.respondToReview(x._id, reply[x._id]); load(); }}>
                <input aria-label="Professional response" maxLength={1500} className={`${inputClass} flex-1`} onChange={(e) => setReply({ ...reply, [x._id]: e.target.value })} />
                <button type="submit" className={btnPrimary}>Respond</button>
              </form>
            )}
          </article>
        ))}
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Reports</h2>
        <p className={muted}>Reporter identity is private. Reports are not automatic guilt.</p>
        {(data.reports || []).length === 0 ? <p className={`${cardClass} mt-3 ${muted}`}>No reports requiring response.</p> : data.reports.map((x) => (
          <p key={x.id} className={`${cardClass} mt-2 text-gray-900 dark:text-white`}>{x.category} · {x.status}</p>
        ))}
      </section>
      <section>
        <h2 className="font-semibold text-gray-900 dark:text-white">Disputes</h2>
        <p className={muted}>Professional dispute ≠ financial dispute. No automatic refund.</p>
        {(data.disputes || []).length === 0 ? <p className={`${cardClass} mt-3 ${muted}`}>No disputes.</p> : data.disputes.map((x) => (
          <p key={x._id} className={`${cardClass} mt-2 text-gray-900 dark:text-white`}>{x.category} · {x.status}</p>
        ))}
      </section>
    </div>
  );
}
