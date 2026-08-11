import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { btnPrimary, cardClass, inputClass, labelClass, muted } from './agentUi';

export default function AgentMarketplace() {
  const [data, setData] = useState({ posts: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const load = (params = {}) => agentApi.getMarketplacePosts(params).then((r) => setData(r.data));
  useEffect(() => {
    load().catch((e) => setError(e.response?.data?.error || 'Unable to load marketplace posts.')).finally(() => setLoading(false));
  }, []);
  const action = async (post, kind) => {
    setBusy(post._id); setError('');
    try {
      if (kind === 'submit') await agentApi.submitMarketplacePost(post._id);
      else await agentApi.archiveMarketplacePost(post._id);
      await load({ q, status });
    } catch (e) { setError(e.response?.data?.error || 'Action failed.'); }
    finally { setBusy(''); }
  };
  if (loading) return <p className={muted}>Loading…</p>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Agent marketplace</h1>
          <p className={`mt-1 ${muted}`}>Structured professional posts. Agent statements, official facts, and Strideto information stay separate. Approved-only public projection.</p>
        </div>
        <Link to={ROUTES.AGENT_MARKETPLACE_NEW} className={btnPrimary}>Create draft</Link>
      </div>
      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); load({ q, status }).catch((err) => setError(err.response?.data?.error || 'Search failed.')); }}>
        <label className={labelClass}>Search<input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Title or summary" /></label>
        <label className={labelClass}>Moderation
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All</option>
            {['not_submitted', 'under_review', 'needs_changes', 'approved', 'rejected', 'archived'].map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); setStatus(''); load(); }}>Reset</button>
      </form>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      {data.posts.length === 0 ? <p className={`${cardClass} ${muted}`}>No marketplace posts yet.</p> : (
        <div className="space-y-3">{data.posts.map((post) => (
          <article key={post._id} className={cardClass}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className={`text-xs uppercase ${muted}`}>{post.postType.replaceAll('_', ' ')}</p>
                <h2 className="font-semibold text-gray-900 dark:text-white">{post.title}</h2>
                <p className={`mt-1 ${muted}`}>{post.summary}</p>
              </div>
              <div className={`text-right text-xs ${muted}`}>
                <p>Publication: {post.publicationStatus}</p>
                <p>Moderation: {post.moderationStatus}</p>
              </div>
            </div>
            {post.moderationFeedback ? <p className="mt-3 rounded bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-800 dark:text-amber-200">Moderator feedback: {post.moderationFeedback}</p> : null}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link className="text-primary" to={`${ROUTES.AGENT_MARKETPLACE}/${post._id}/edit`}>Edit</Link>
              {(post.moderationStatus === 'not_submitted' || post.moderationStatus === 'needs_changes') ? (
                <button type="button" disabled={busy === post._id} onClick={() => action(post, 'submit')} className="text-green-700 dark:text-green-400 disabled:opacity-50">Submit for review</button>
              ) : null}
              {post.publicationStatus !== 'archived' ? (
                <button type="button" disabled={busy === post._id} onClick={() => action(post, 'archive')} className={`${muted} disabled:opacity-50`}>Archive</button>
              ) : null}
            </div>
          </article>
        ))}</div>
      )}
    </div>
  );
}
