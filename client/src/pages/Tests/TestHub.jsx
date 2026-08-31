import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { testsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';

const CATEGORY_LABELS = {
  english_proficiency: 'English Proficiency',
  admissions: 'Admissions',
  national_qualification: 'National Qualification',
  professional: 'Professional',
  other: 'Other',
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

function TestCard({ test }) {
  const detailPath = `${ROUTES.TEST_HUB}/${test.slug}`;
  return (
    <Link
      to={detailPath}
      className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {test.name}
          </h3>
          {test.shortName && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{test.shortName}</p>
          )}
        </div>
        <span className="flex-shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
          {CATEGORY_LABELS[test.category] || test.category}
        </span>
      </div>
      {test.providerId && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {test.providerId.name}
        </p>
      )}
      {test.description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {test.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(test.deliveryModes || []).map((m) => (
          <span key={m} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {m.replace(/_/g, ' ')}
          </span>
        ))}
        {test.validityMonths != null && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            Valid {test.validityMonths} months
          </span>
        )}
      </div>
    </Link>
  );
}

export default function TestHub() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });

  const fetchTests = useCallback(() => {
    setLoading(true);
    setError(null);
    testsApi
      .list({ category: category || undefined, search: search || undefined, page, limit: 20 })
      .then(({ data }) => {
        setTests(data?.data || []);
        setMeta({ total: data?.total || 0, pages: data?.pages || 1 });
      })
      .catch(() => setError('Failed to load tests. Please try again.'))
      .finally(() => setLoading(false));
  }, [category, search, page]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleCategoryChange(e) {
    setCategory(e.target.value);
    setPage(1);
  }

  return (
    <>
      <SeoHead
        title="International Tests for Study & Admissions | Strideto"
        description="International tests for study, admissions and career pathways. Find the right test, understand acceptance and scores, and prepare with trusted resources."
        canonical={ROUTES.TEST_HUB}
      />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          International Tests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          International tests for study, admissions and career pathways.
        </p>
        <div className="mb-6 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-blue-900 dark:text-blue-100">
          <p className="font-medium">Which test do I need?</p>
          <p className="mt-1">Compare test purposes, see where a test is accepted, understand score targets, and find official or trusted preparation resources.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tests…"
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
          <select
            value={category}
            onChange={handleCategoryChange}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        )}

        {!loading && !error && tests.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">No tests found matching your criteria.</p>
        )}

        {!loading && !error && tests.length > 0 && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {meta.total} test{meta.total !== 1 ? 's' : ''} found
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {tests.map((test) => (
                <TestCard key={test._id} test={test} />
              ))}
            </div>

            {/* Pagination */}
            {meta.pages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
                  {page} / {meta.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                  disabled={page === meta.pages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
