/**
 * Canonical Scholarship Intelligence Explorer (Mission 7).
 *
 * Browses published, source-backed scholarships. No personalized eligibility
 * decisions are shown here (Mission 8). Stale/broken-source warnings are
 * surfaced when the API returns them.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { useCollectionSeo } from '../../seo/collectionSeo';
import { ROUTES } from '../../constants';
import { canonicalScholarshipsApi } from '../../services/listingsService';
import { Pagination } from '../../components/ui/Pagination';

const FUNDING_LABELS = {
  full: 'Fully Funded',
  partial: 'Partial',
  fixed_amount: 'Fixed Amount',
  component_based: 'Component-Based',
  unknown: 'Funding Unspecified',
};

const DEGREE_LABELS = {
  high_school: 'High School',
  diploma: 'Diploma',
  certificate: 'Certificate',
  bachelor: 'Bachelor',
  master: 'Master',
  phd: 'PhD',
  postdoc: 'Postdoc',
  professional: 'Professional',
};

const SCHOLARSHIP_TYPE_LABELS = {
  government: 'Government',
  institutional: 'Institutional',
  private: 'Private',
  international_org: 'International Org',
  bilateral: 'Bilateral',
  fellowship: 'Fellowship',
  other: 'Other',
};

const PAGE_SIZE = 20;

function FundingBadge({ type }) {
  const colors = {
    full: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    fixed_amount: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    component_based: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || colors.unknown}`}>
      {FUNDING_LABELS[type] || 'Funding Unspecified'}
    </span>
  );
}

function ScholarshipCard({ scholarship }) {
  const detailPath = `${ROUTES.CANONICAL_SCHOLARSHIPS}/${scholarship.slug}`;
  const countries = (scholarship.destinationCountries || []).filter((c) => c !== '*');
  const degrees = (scholarship.degreeLevels || []).map((d) => DEGREE_LABELS[d] || d);

  return (
    <Link
      to={detailPath}
      className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
            {scholarship.title}
          </h3>
          {scholarship.provider?.name && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {scholarship.provider.name}
            </p>
          )}
        </div>
        <FundingBadge type={scholarship.funding?.type} />
      </div>

      {scholarship.summary && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {scholarship.summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {scholarship.scholarshipType && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {SCHOLARSHIP_TYPE_LABELS[scholarship.scholarshipType] || scholarship.scholarshipType}
          </span>
        )}
        {countries.slice(0, 3).map((c) => (
          <span key={c} className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {c}
          </span>
        ))}
        {countries.length > 3 && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            +{countries.length - 3} more
          </span>
        )}
        {degrees.slice(0, 2).map((d) => (
          <span key={d} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {d}
          </span>
        ))}
      </div>

      {scholarship.lastVerifiedAt && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Verified {new Date(scholarship.lastVerifiedAt).toLocaleDateString()}
        </p>
      )}
    </Link>
  );
}

function FilterBar({ filters, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={filters.country || ''}
        onChange={(e) => onChange({ ...filters, country: e.target.value || undefined, page: 1 })}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option value="">All Countries</option>
        <option value="GB">United Kingdom</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="AU">Australia</option>
        <option value="DE">Germany</option>
        <option value="FR">France</option>
        <option value="NL">Netherlands</option>
        <option value="JP">Japan</option>
        <option value="CN">China</option>
        <option value="TR">Turkey</option>
      </select>

      <select
        value={filters.degree || ''}
        onChange={(e) => onChange({ ...filters, degree: e.target.value || undefined, page: 1 })}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option value="">All Degrees</option>
        {Object.entries(DEGREE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      <select
        value={filters.fundingType || ''}
        onChange={(e) => onChange({ ...filters, fundingType: e.target.value || undefined, page: 1 })}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option value="">All Funding Types</option>
        {Object.entries(FUNDING_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      <select
        value={filters.scholarshipType || ''}
        onChange={(e) => onChange({ ...filters, scholarshipType: e.target.value || undefined, page: 1 })}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option value="">All Types</option>
        {Object.entries(SCHOLARSHIP_TYPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

export default function ScholarshipIntelligence() {
  const [filters, setFilters] = useState({ page: 1, limit: PAGE_SIZE });
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await canonicalScholarshipsApi.list(params);
      setData(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, total: 0, pages: 1 });
    } catch (err) {
      setError('Failed to load scholarships. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(filters); }, [filters, fetch]);

  const handleFiltersChange = (next) => setFilters(next);
  const handlePage = (p) => setFilters((f) => ({ ...f, page: p }));

  const collectionSeo = useCollectionSeo(ROUTES.CANONICAL_SCHOLARSHIPS);

  return (
    <>
      <SeoHead
        title="Scholarship Intelligence | Strideto"
        description="Browse source-backed international scholarship opportunities by country, degree, field, and funding type."
        canonical={collectionSeo.canonical}
        noindex={collectionSeo.noindex}
        robots={collectionSeo.robots}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Scholarship Intelligence
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Source-backed scholarship data. Always verify directly with the awarding body before applying.
            </p>
          </div>

          <div className="mb-6">
            <FilterBar filters={filters} onChange={handleFiltersChange} />
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="py-20 text-center text-gray-500 dark:text-gray-400">
              No scholarships found matching your filters.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((s) => (
                <ScholarshipCard key={s._id} scholarship={s} />
              ))}
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={handlePage}
              />
            </div>
          )}

          <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
            Scholarship data is sourced from official providers and verified periodically. Strideto does not guarantee funding, admission, visa approval, or employment outcomes.
          </p>
        </div>
      </div>
    </>
  );
}
