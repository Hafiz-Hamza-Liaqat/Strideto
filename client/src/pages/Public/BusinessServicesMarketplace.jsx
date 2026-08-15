import { useEffect, useMemo, useState } from 'react';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { Pagination } from '../../components/ui/Pagination';
import { gbsMarketplaceApi } from '../../services/gbsMarketplaceApi';
import { useBusinessServicesMarketplaceEnabled } from '../../hooks/useBusinessServicesMarketplaceEnabled';
import NotFound from '../Static/NotFound';
import { GbsMarketplaceCard } from './GbsMarketplaceCard';

const selectClass = ui.input;

export default function BusinessServicesMarketplace() {
  const { enabled, loading: flagLoading } = useBusinessServicesMarketplaceEnabled();
  const [filters, setFilters] = useState({
    q: '',
    capabilityId: '',
    jurisdictionId: '',
    countryCode: '',
    subjectType: '',
    pricingMode: '',
    sort: 'newest',
  });
  const [result, setResult] = useState({ items: [], total: 0, page: 1, pages: 1, limit: 20, filters: { capabilities: [], jurisdictions: [] } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
      page,
      limit: 20,
    }),
    [filters, page]
  );

  useEffect(() => {
    if (enabled !== true) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    gbsMarketplaceApi
      .list(query)
      .then(({ data }) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err.response?.status === 404) setError('not_found');
          else setError('Unable to load Business Services listings.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, query]);

  if (flagLoading) {
    return (
      <>
        <SeoHead title="Business Services | Strideto" noindex />
        <div className="mx-auto max-w-6xl px-4 py-10 text-slate-500" role="status" aria-busy="true">
          Loading marketplace…
        </div>
      </>
    );
  }
  if (enabled !== true || error === 'not_found') return <NotFound />;

  const capabilities = result.filters?.capabilities || [];
  const jurisdictions = result.filters?.jurisdictions || [];
  const countryCodes = [...new Set(jurisdictions.map((j) => j.countryCode).filter(Boolean))].sort();
  const emptyMarketplace = !loading && !error && result.total === 0 && !filters.q && !filters.capabilityId && !filters.jurisdictionId && !filters.subjectType && !filters.pricingMode;
  const noResults = !loading && !error && result.total === 0 && !emptyMarketplace;

  return (
    <>
      <SeoHead
        title="Business Services | Strideto"
        description="Discover Admin-approved Business Formation and Corporate Services listings with verified professional capabilities."
        canonical={ROUTES.BUSINESS_SERVICES}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: 'Home', url: ROUTES.HOME },
            { name: 'Business Services', url: ROUTES.BUSINESS_SERVICES },
          ]),
          collectionPageSchema({
            name: 'Business Services',
            description: 'Approved Business Formation and Corporate Services listings on Strideto.',
            url: ROUTES.BUSINESS_SERVICES,
          })
        )}
      />
      <div className={`mx-auto max-w-6xl px-4 py-10 ${ui.page}`}>
        <h1 className={ui.h1}>Business Services</h1>
        <p className={`mt-2 max-w-3xl ${ui.muted}`}>
          Browse Admin-approved company formation, registered agent, registered office, document preparation, and EIN assistance listings.
          Professional verification is shown per capability. Requesting a service is not available yet.
        </p>

        <form
          className={`mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${ui.filterPanel}`}
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="gbs-search" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Search
            </label>
            <input
              id="gbs-search"
              type="search"
              value={filters.q}
              onChange={(e) => {
                setFilters((f) => ({ ...f, q: e.target.value }));
                setPage(1);
              }}
              className={selectClass}
              placeholder="Service, provider, capability, or jurisdiction"
            />
          </div>
          <div>
            <label htmlFor="gbs-capability" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Service
            </label>
            <select
              id="gbs-capability"
              className={selectClass}
              value={filters.capabilityId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, capabilityId: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">All services</option>
              {capabilities.map((c) => (
                <option key={c.id} value={c.id}>{c.publicName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gbs-country" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Country
            </label>
            <select
              id="gbs-country"
              className={selectClass}
              value={filters.countryCode}
              onChange={(e) => {
                setFilters((f) => ({ ...f, countryCode: e.target.value, jurisdictionId: '' }));
                setPage(1);
              }}
            >
              <option value="">All countries</option>
              {countryCodes.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gbs-jurisdiction" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Jurisdiction
            </label>
            <select
              id="gbs-jurisdiction"
              className={selectClass}
              value={filters.jurisdictionId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, jurisdictionId: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">All jurisdictions</option>
              {jurisdictions
                .filter((j) => !filters.countryCode || j.countryCode === filters.countryCode)
                .map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="gbs-subject" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Provider type
            </label>
            <select
              id="gbs-subject"
              className={selectClass}
              value={filters.subjectType}
              onChange={(e) => {
                setFilters((f) => ({ ...f, subjectType: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">Independent and Agency</option>
              <option value="agent">Independent</option>
              <option value="organization">Agency</option>
            </select>
          </div>
          <div>
            <label htmlFor="gbs-pricing" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Pricing model
            </label>
            <select
              id="gbs-pricing"
              className={selectClass}
              value={filters.pricingMode}
              onChange={(e) => {
                setFilters((f) => ({ ...f, pricingMode: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">All pricing</option>
              <option value="fixed">Fixed</option>
              <option value="starting_at">Starting at</option>
              <option value="range">Range</option>
              <option value="quote_required">Quote required</option>
            </select>
          </div>
          <div>
            <label htmlFor="gbs-sort" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Sort
            </label>
            <select
              id="gbs-sort"
              className={selectClass}
              value={filters.sort}
              onChange={(e) => {
                setFilters((f) => ({ ...f, sort: e.target.value }));
                setPage(1);
              }}
            >
              <option value="newest">Newest</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </form>

        {loading ? (
          <p className="mt-8 text-slate-500" role="status" aria-busy="true">Loading listings…</p>
        ) : null}
        {error && error !== 'not_found' ? (
          <p className={`mt-8 ${ui.error}`} role="alert">{error}</p>
        ) : null}
        {emptyMarketplace ? (
          <p className={`mt-8 ${ui.empty}`}>No Business Services listings are publicly available yet.</p>
        ) : null}
        {noResults ? (
          <p className={`mt-8 ${ui.empty}`}>No listings match these filters.</p>
        ) : null}

        {!loading && result.items?.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {result.items.map((item) => (
              <GbsMarketplaceCard key={item.slug || item.id} item={item} />
            ))}
          </div>
        ) : null}

        {result.pages > 1 ? (
          <Pagination currentPage={result.page} totalPages={result.pages} onPageChange={setPage} />
        ) : null}
      </div>
    </>
  );
}
