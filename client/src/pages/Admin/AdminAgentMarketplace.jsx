import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { adminApi } from '../../services/listingsService';

const control = 'rounded border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export default function AdminAgentMarketplace() {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState('submitted');
  const [data, setData] = useState({ posts: [] });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => adminApi.agentMarketplaceQueue({ status: status === 'submitted' ? 'pending' : status }).then((r) => setData(r.data)), [status]);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => setError(e.response?.data?.error || 'Unable to load moderation queue.')).finally(() => setLoading(false));
  }, [load]);

  const open = async (id) => {
    setSelected(id);
    setError('');
    try { setDetail((await adminApi.agentMarketplaceDetail(id)).data); } catch (e) { setError(e.response?.data?.error || 'Unable to load post.'); }
  };
  const act = async (action) => {
    setBusy(true);
    setError('');
    try {
      await adminApi.moderateAgentMarketplace(selected, action, reason);
      setReason(''); setDetail(null); setSelected(null); await load();
    } catch (e) { setError(e.response?.data?.error || 'Moderation action failed.'); } finally { setBusy(false); }
  };

  return <>
    <SeoHead title="Agent marketplace moderation" noindex />
    <div className="space-y-5 text-gray-900 dark:text-gray-100">
      <div><h1 className="text-2xl font-semibold">Agent marketplace moderation</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review organization trust, Agent statements, canonical references, provenance, freshness, and policy signals.</p></div>
      <label className="inline-flex flex-col gap-1 text-sm font-medium">Moderation status<select value={status} onChange={(e) => setStatus(e.target.value)} className={control}><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="needs_changes">Needs changes</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label>
      {error && <p className="rounded bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p>}
      {loading ? <p className="text-slate-500 dark:text-slate-400" role="status">{t('loading', { defaultValue: 'Loading…' })}</p> : <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">{data.posts.length === 0 ? <p className="rounded border border-gray-200 p-5 text-sm text-slate-500 dark:border-gray-700 dark:text-slate-400">Queue is empty.</p> : data.posts.map((post) => <button type="button" key={post._id} onClick={() => open(post._id)} className={`block w-full rounded-xl border bg-white p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-gray-800 ${selected === post._id ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}><p className="text-xs uppercase text-slate-500 dark:text-slate-400">{post.postType.replaceAll('_', ' ')}</p><p className="font-semibold">{post.title}</p><p className="mt-1 text-sm">{post.organizationId?.displayName}</p><p className="mt-2 text-xs">{post.moderationStatus} · source {post.sourceFreshnessState}</p></button>)}</div>
        {detail && <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs uppercase text-blue-700 dark:text-blue-300">Agent statement</p><h2 className="mt-1 text-lg font-semibold">{detail.post.title}</h2><p className="mt-2 whitespace-pre-line text-sm">{detail.post.agentStatement}</p><div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2"><p>Organization: {detail.post.organizationId?.displayName}</p><p>Verification: {detail.verificationStatus}</p><p>Freshness: {detail.post.sourceFreshnessState}</p><p>Badges: {detail.trustBadges.join(', ') || 'none'}</p></div>{detail.policySignals.length > 0 && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Policy signals: {detail.policySignals.join(', ')}</p>}<div className="mt-4"><h3 className="text-xs font-bold uppercase text-green-800 dark:text-green-300">Canonical/source-backed facts</h3>{detail.post.factualClaims?.map((claim) => <p key={claim.claimKey} className="mt-1 text-sm">{claim.statement}</p>)}{detail.sources.map((source) => <p key={source._id} className="mt-1 text-xs">{source.label || source.url} · {source.status}</p>)}</div><label className="mt-4 flex flex-col gap-1 text-sm font-medium">Moderation reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for changes, rejection, suspension, or archive" className={control} /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => act('begin_review')} className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">Begin review</button><button type="button" disabled={busy} onClick={() => act('approve')} className="rounded bg-green-700 px-3 py-2 text-sm text-white">Approve & publish</button><button type="button" disabled={busy} onClick={() => act('request_changes')} className="rounded bg-amber-600 px-3 py-2 text-sm text-white">Request changes</button><button type="button" disabled={busy} onClick={() => act('reject')} className="rounded bg-red-700 px-3 py-2 text-sm text-white">Reject</button>{detail.post.moderationStatus === 'approved' && <button type="button" disabled={busy} onClick={() => act('suspend')} className="rounded bg-slate-800 px-3 py-2 text-sm text-white">Suspend</button>}</div><div className="mt-5"><h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Moderation history</h3>{detail.history.map((item) => <p key={item._id} className="mt-1 text-xs">{item.action}: {item.fromStatus} → {item.toStatus}{item.reason ? ` — ${item.reason}` : ''}</p>)}</div></section>}
      </div>}
    </div>
  </>;
}
