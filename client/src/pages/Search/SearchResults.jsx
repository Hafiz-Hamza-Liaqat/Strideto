import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { searchApi } from '../../services/searchApi';
import { trackSearchQuery } from '../../utils/platformAnalytics';
import { useLanguage } from '../../context/LanguageContext';
import { entityTypeLabel } from '@shared/search/entityTypes.js';

export default function SearchResults() {
  const { t } = useTranslation('common');
  const { lang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') || '';
  const page = Number(searchParams.get('page') || 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q || q.length < 2) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    searchApi.search({ q, type: type || undefined, page, limit: 20, locale: lang })
      .then(({ data: res }) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) { setError('Search failed'); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    trackSearchQuery(q);
    return () => { cancelled = true; };
  }, [q, type, page, lang]);

  const canonical = useMemo(() => {
    const params = new URLSearchParams({ q });
    if (type) params.set('type', type);
    if (page > 1) params.set('page', String(page));
    return `${ROUTES.SEARCH}?${params.toString()}`;
  }, [q, type, page]);

  const title = q ? `Search: ${q}` : t('search');
  const types = ['', 'job', 'scholarship', 'intl-scholarship', 'admission', 'university', 'blog', 'career-guidance', 'program', 'legacy-institution', 'company', 'test'];

  return (
    <>
      <SeoHead
        title={title}
        description={q ? `Search results for ${q} on Strideto` : 'Search Strideto'}
        canonical={q ? canonical : ROUTES.SEARCH}
        noindex
      />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>

        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filter by type">
          {types.map((et) => {
            const active = (type || '') === et;
            const label = et ? entityTypeLabel(et) : 'All';
            return (
              <button
                key={et || 'all'}
                type="button"
                role="tab"
                aria-selected={active}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => {
                  const params = { q };
                  if (et) params.type = et;
                  setSearchParams(params);
                }}
                disabled={!q || q.length < 2}
              >
                {label}
              </button>
            );
          })}
        </div>

        {!q || q.length < 2 ? (
          <p className="text-gray-500">Enter at least 2 characters to search.</p>
        ) : loading ? (
          <p className="text-gray-500" role="status">Searching…</p>
        ) : error ? (
          <p className="text-red-600" role="alert">{error}</p>
        ) : !data?.results?.length ? (
          <div className="text-gray-500 border border-dashed rounded-lg p-8 text-center space-y-2">
            <p>No results for &ldquo;{q}&rdquo;{type ? ` in ${entityTypeLabel(type)}` : ''}.</p>
            <p className="text-sm">
              Try different keywords or clear filters. If the site was just seeded, ask an admin to use
              {' '}
              <strong>Rebuild Search Index</strong>
              {' '}
              in Admin → Global Search.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              {data.total} result{data.total === 1 ? '' : 's'}
              {data.elapsedTime != null ? ` · ${data.elapsedTime}ms` : ''}
            </p>
            <ul className="space-y-4">
              {data.results.map((item) => (
                <li key={`${item.entityType}-${item.id}`}>
                  <Link
                    to={item.url || '#'}
                    className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-primary"
                    onClick={() => searchApi.click({ query: q, entityType: item.entityType, entityId: item.id, url: item.url })}
                  >
                    <span className="text-xs font-medium text-primary uppercase">{entityTypeLabel(item.entityType)}</span>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{item.title}</h2>
                    {item.summary ? <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.summary}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
            {data.pagination?.totalPages > 1 ? (
              <nav className="flex gap-2 mt-8 justify-center" aria-label="Search pagination">
                {page > 1 ? (
                  <button
                    type="button"
                    className="px-3 py-1 rounded border text-sm"
                    onClick={() => setSearchParams({ q, ...(type && { type }), page: String(page - 1) })}
                  >
                    Previous
                  </button>
                ) : null}
                <span className="px-3 py-1 text-sm text-gray-500">
                  Page {page} of {data.pagination.totalPages}
                </span>
                {page < data.pagination.totalPages ? (
                  <button
                    type="button"
                    className="px-3 py-1 rounded border text-sm"
                    onClick={() => setSearchParams({ q, ...(type && { type }), page: String(page + 1) })}
                  >
                    Next
                  </button>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
