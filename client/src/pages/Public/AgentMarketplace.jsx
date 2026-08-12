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
              <Link
                key={post.id}
                to={`${ROUTES.AGENT_PUBLIC_MARKETPLACE}/${post.slug}`}
                className={`${ui.card} p-5 transition hover:border-blue-400 dark:hover:border-blue-500`}
              >
                <div className="flex justify-between gap-3">
                  <span className="text-xs uppercase text-blue-700 dark:text-blue-300">{post.postType.replaceAll('_', ' ')}</span>
                  <span className="text-xs text-slate-500 dark:text-gray-400">{post.agent?.agentType}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold break-words-safe">{post.title}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 break-words-safe">{post.summary}</p>
                <p className="mt-4 text-xs text-slate-500 dark:text-gray-400">
                  By {post.agent?.professionalName || post.organization?.displayName}
                </p>
                {post.freshnessWarning ? (
                  <p className="mt-3 rounded bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200">{post.freshnessWarning}</p>
                ) : null}
              </Link>
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
