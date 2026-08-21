import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agentPublicApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { SeoHead } from '../../components/seo';
import { ui } from '../../design-system/surfaceClasses';

export default function AgentMarketplace() {
  const { t } = useTranslation('common');
  const [filters, setFilters] = useState({ postType: '', destinationCountry: '', freshness: '' });
  const [data, setData] = useState({ posts: [], page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = (page = 1) => {
    setLoading(true);
    return agentPublicApi
      .getMarketplace({ ...filters, page, limit: 20 })
      .then((r) => setData(r.data))
      .catch(() => setError('Unable to load marketplace.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <SeoHead
        title="Agent opportunity marketplace | Strideto"
        description="Moderated guidance posts from approved agents and agencies. Not a generic classifieds board."
        canonical={ROUTES.AGENT_PUBLIC_MARKETPLACE}
      />
      <div className={`mx-auto max-w-6xl px-4 py-10 min-w-0 ${ui.page}`}>
        <h1 className={ui.h1}>Agent opportunity marketplace</h1>
        <p className={`mt-2 max-w-3xl ${ui.muted}`}>
          Moderated posts from verified agents and agencies — scholarship guidance, university pathways, and service announcements backed by source references. Browse the{' '}
          <Link to={ROUTES.AGENT_PUBLIC_DIRECTORY} className="text-primary dark:text-mint hover:underline">agent directory</Link>{' '}
          for full profiles.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); load(); }}
          className={`mt-6 grid gap-3 sm:grid-cols-4 ${ui.filterPanel}`}
        >
          <select
            aria-label="Post type"
            value={filters.postType}
            onChange={(e) => setFilters((f) => ({ ...f, postType: e.target.value }))}
            className={ui.input}
          >
            <option value="">All post types</option>
            <option value="service_announcement">Service announcements</option>
            <option value="scholarship_guidance">Scholarship guidance</option>
            <option value="university_guidance">University guidance</option>
            <option value="test_guidance">Test guidance</option>
            <option value="career_guidance">Career guidance</option>
          </select>
          <input
            aria-label="Destination country"
            maxLength="2"
            placeholder="Destination country"
            value={filters.destinationCountry}
            onChange={(e) => setFilters((f) => ({ ...f, destinationCountry: e.target.value.toUpperCase() }))}
            className={ui.input}
          />
          <select
            aria-label="Freshness"
            value={filters.freshness}
            onChange={(e) => setFilters((f) => ({ ...f, freshness: e.target.value }))}
            className={ui.input}
          >
            <option value="">Any freshness</option>
            <option value="fresh">Current</option>
            <option value="review_due">Review due</option>
            <option value="stale">Stale</option>
          </select>
          <button type="submit" className={ui.primaryBtn}>Filter</button>
        </form>

        {error ? <p className={`mt-5 ${ui.error}`} role="alert">{error}</p> : null}
        {loading ? (
          <p className={`mt-8 ${ui.muted}`} role="status">{t('loading', { defaultValue: 'Loading…' })}</p>
        ) : data.posts.length === 0 ? (
          <p className={`mt-8 ${ui.empty}`}>No current moderated posts match these filters.</p>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {data.posts.map((post) => (
              <article
                key={post.id}
                className={`${ui.card} p-5 flex flex-col gap-2 min-w-0 transition hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {post.postType.replaceAll('_', ' ')}
                  </span>
                  {post.agent?.agentType && (
                    <span className="text-xs text-slate-500 dark:text-gray-400">{post.agent.agentType}</span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white break-words leading-snug">
                  <Link
                    to={`${ROUTES.AGENT_PUBLIC_MARKETPLACE}/${post.slug}`}
                    className="hover:text-primary dark:hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.summary && (
                  <p className="text-sm text-slate-600 dark:text-gray-300 break-words line-clamp-3">{post.summary}</p>
                )}
                {post.freshnessWarning ? (
                  <p className="rounded bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200">{post.freshnessWarning}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-slate-600 dark:text-gray-400 break-words min-w-0">
                    {post.agent?.professionalName || post.organization?.displayName || 'Unknown provider'}
                  </p>
                  <Link
                    to={`${ROUTES.AGENT_PUBLIC_MARKETPLACE}/${post.slug}`}
                    className="shrink-0 text-xs font-semibold text-primary dark:text-mint hover:underline"
                  >
                    View post →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {data.pages > 1 ? (
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" disabled={data.page <= 1} onClick={() => load(data.page - 1)} className={ui.secondaryBtn}>Previous</button>
            <span className="self-center text-sm">Page {data.page} of {data.pages}</span>
            <button type="button" disabled={data.page >= data.pages} onClick={() => load(data.page + 1)} className={ui.secondaryBtn}>Next</button>
          </div>
        ) : null}
      </div>
    </>
  );
}
