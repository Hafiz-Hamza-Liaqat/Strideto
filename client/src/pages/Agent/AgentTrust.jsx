import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { btnPrimary, cardClass, inputClass, muted } from './agentUi';

export default function AgentTrust() {
  const [data, setData] = useState({ reviews: [], reports: [], disputes: [] });
  const [verification, setVerification] = useState(null);
  const [reply, setReply] = useState({});
  const [error, setError] = useState('');
  const load = () => Promise.all([
    agentApi.getReviews(),
    agentApi.getReports(),
    agentApi.getDisputes(),
    agentApi.getVerification().catch(() => ({ data: null })),
  ]).then(([r, p, d, v]) => {
    setData({ reviews: r.data.reviews || [], reports: p.data.reports || [], disputes: d.data.disputes || [] });
    setVerification(v.data);
  });
  useEffect(() => { load().catch((e) => setError(e.response?.data?.error || 'Unable to load trust center.')); }, []);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Trust / Reviews</h1>
        <p className={muted}>Respond professionally. You cannot remove negative reviews. Reporter identity is private. Professional dispute is not a financial dispute and does not create a refund.</p>
      </header>
      {error ? <p className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
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
