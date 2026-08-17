import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { btnPrimary, cardClass, inputClass, labelClass, muted } from './agentUi';

function postDisplayStatus(post) {
  const now = Date.now();
  if (post.publicationStatus === 'published' && post.endsAt && new Date(post.endsAt).getTime() <= now) {
    return 'Expired';
  }
  if (post.publicationStatus === 'published' && post.moderationStatus === 'approved') return 'Published';
  if (post.moderationStatus === 'pending' || post.moderationStatus === 'under_review') return 'Under Review';
  if (post.moderationStatus === 'needs_changes') return 'Needs Changes';
  if (post.moderationStatus === 'rejected') return 'Rejected';
  if (post.publicationStatus === 'draft') return 'Draft';
  if (post.publicationStatus === 'archived') return 'Archived';
  return post.publicationStatus || post.moderationStatus;
}

export default function AgentMarketplace() {
  const [data, setData] = useState({ posts: [], total: 0 });
  const [counts, setCounts] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const load = (params = {}) => agentApi.getMarketplacePosts(params).then((r) => setData(r.data));

  useEffect(() => {
    Promise.all([
      load(),
      agentApi.getMarketplaceCounts().then((r) => setCounts(r.data)).catch(() => setCounts(null)),
      agentApi.getVerification().then((r) => setVerification(r.data)).catch(() => setVerification(null)),
    ])
      .catch((e) => setError(e.response?.data?.error || 'Unable to load marketplace posts.'))
      .finally(() => setLoading(false));
  }, []);

  const educationApproved = verification?.isApproved === true
    || verification?.verificationStatus === 'approved';
  const free = counts?.freeEntitlement || null;
  const freeAvailable = educationApproved && free?.available === true;
  const canCreate = freeAvailable;

  const action = async (post, kind) => {
    setBusy(post._id); setError('');
    try {
      if (kind === 'submit') await agentApi.submitMarketplacePost(post._id);
      else await agentApi.archiveMarketplacePost(post._id);
      await load({ q, status });
      const c = await agentApi.getMarketplaceCounts().catch(() => null);
      if (c) setCounts(c.data);
    } catch (e) { setError(e.response?.data?.error || 'Action failed.'); }
    finally { setBusy(''); }
  };

  if (loading) return <p className={muted}>Loading…</p>;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Marketplace</h1>
          <p className={`mt-1 ${muted}`}>
            Promotional posts are separate from Education services. An active service does not create a Marketplace post.
            Providers cannot self-publish — Admin moderation is required.
          </p>
        </div>
        {canCreate ? (
          <Link to={ROUTES.AGENT_EDUCATION_MARKETPLACE_NEW} className={btnPrimary}>Create promotion</Link>
        ) : (
          <span
            className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
            aria-disabled="true"
          >
            Create promotion (locked)
          </span>
        )}
      </div>

      <section className={cardClass} aria-labelledby="marketplace-eligibility">
        <h2 id="marketplace-eligibility" className="font-semibold text-gray-900 dark:text-white">Marketplace eligibility</h2>
        <ul className={`mt-2 space-y-1 text-sm ${muted}`}>
          <li>
            Education &amp; Mobility professional verification:{' '}
            <span className="text-gray-900 dark:text-white">{educationApproved ? 'Approved' : 'Not approved'}</span>
          </li>
          <li>
            Free promotion entitlement:{' '}
            <span className="text-gray-900 dark:text-white">
              {!educationApproved ? 'Unavailable until Education approval' : (free?.available ? 'Available (one-time, 7 days public)' : 'Used')}
            </span>
          </li>
          <li>
            Paid publishing plans:{' '}
            <span className="text-gray-900 dark:text-white">Not configured</span>
          </li>
          <li>
            Publicly eligible posts: {counts?.publiclyEligible ?? 0}
            {' · '}Drafts: {counts?.drafts ?? 0}
            {' · '}Pending review: {counts?.pendingReview ?? 0}
            {' · '}Expired: {counts?.expired ?? 0}
          </li>
        </ul>
        {!educationApproved ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200" role="status">
            Complete and receive approval for Education &amp; Mobility professional verification before creating a public Marketplace promotion.
            {' '}
            <Link to={ROUTES.AGENT_EDUCATION_VERIFICATION} className="font-medium text-primary underline-offset-2 hover:underline">
              Open Professional Verification
            </Link>
          </p>
        ) : null}
        {educationApproved && free?.consumed ? (
          <p className="mt-3 text-sm text-gray-800 dark:text-gray-200" role="status">
            Free promotion: Used. Paid Marketplace publishing plans are not configured yet.
          </p>
        ) : null}
        {educationApproved && freeAvailable ? (
          <p className={`mt-3 text-sm ${muted}`}>
            Free promotions cannot include off-platform websites, social, WhatsApp, Telegram, mailto, or tel CTAs.
            Keep acquisition inside Strideto. Public duration is 7 days from Admin publication.
          </p>
        ) : null}
      </section>

      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); load({ q, status }).catch((err) => setError(err.response?.data?.error || 'Search failed.')); }}>
        <label className={labelClass}>Search<input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Title or summary" /></label>
        <label className={labelClass}>Moderation
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All</option>
            {['not_submitted', 'pending', 'under_review', 'needs_changes', 'approved', 'rejected', 'archived'].map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); setStatus(''); load(); }}>Reset</button>
      </form>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Marketplace Posts</h2>
      {data.posts.length === 0 ? <p className={`${cardClass} ${muted}`}>No marketplace posts yet. Active Education services do not appear here until you create a promotional post.</p> : (
        <div className="space-y-3">{data.posts.map((post) => (
          <article key={post._id} className={cardClass}>
            <div className="flex flex-wrap justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-xs uppercase ${muted}`}>{String(post.postType || '').replaceAll('_', ' ')}</p>
                <h3 className="font-semibold text-gray-900 dark:text-white break-words">{post.title}</h3>
                <p className={`mt-1 ${muted} break-words`}>{post.summary}</p>
              </div>
              <div className={`text-right text-xs ${muted}`}>
                <p>Status: {postDisplayStatus(post)}</p>
                <p>Publication: {post.publicationStatus}</p>
                <p>Moderation: {post.moderationStatus}</p>
                {post.publishedAt ? <p>Published: {new Date(post.publishedAt).toLocaleString()}</p> : null}
                {post.endsAt ? <p>Expires: {new Date(post.endsAt).toLocaleString()}</p> : null}
                {post.promotionKind === 'free_education' ? <p>Promotion: Free (7-day)</p> : null}
              </div>
            </div>
            {post.moderationFeedback ? <p className="mt-3 rounded bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-800 dark:text-amber-200">Moderator feedback: {post.moderationFeedback}</p> : null}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {(post.moderationStatus === 'not_submitted' || post.moderationStatus === 'needs_changes') ? (
                <Link className="text-primary" to={`${ROUTES.AGENT_EDUCATION_MARKETPLACE}/${post._id}/edit`}>Edit</Link>
              ) : null}
              {(post.moderationStatus === 'not_submitted' || post.moderationStatus === 'needs_changes') ? (
                <button type="button" disabled={busy === post._id || !educationApproved} onClick={() => action(post, 'submit')} className="text-green-700 dark:text-green-400 disabled:opacity-50" aria-busy={busy === post._id}>
                  Submit for review
                </button>
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
