import { useState, useEffect, Fragment, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { jobsApi, savedApi, recommendationsApi } from '../../services/listingsService';
import { trackSearchQuery } from '../../utils/platformAnalytics';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import {
  JOB_FAMILIES,
  SPECIALIZATIONS_BY_FAMILY,
  SORT_OPTIONS,
  countryDisplayName,
} from '../../constants/listings';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import { AdHost } from '../../components/ads';
import { LocationCascadeFilter } from '../../components/forms/LocationCascadeFilter';
import { ScrollReveal } from '../../components/ui/ScrollReveal';

const PER_PAGE = 10;

const JOB_SORT_KEYS = {
  newest: 'sortNewest',
  deadline: 'sortDeadline',
};

const selectClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]';

export default function Jobs() {
  const { t } = useTranslation(['jobs', 'common', 'navbar']);
  const { isAuthenticated } = useAuth();
  const [savedIds, setSavedIds] = useState(new Set());
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [, setLoadingRecommended] = useState(false);
  const [geoFacets, setGeoFacets] = useState({ countries: [], regions: [], cities: [] });

  const location = useLocation();
  const initialParams = {
    limit: PER_PAGE,
    sort: 'newest',
    ...(typeof window !== 'undefined' && (() => {
      const p = new URLSearchParams(location.search);
      const o = {};
      ['countryCode', 'region', 'province', 'city', 'jobFamily', 'specialization', 'category', 'organization', 'deadline', 'type', 'applyType', 'workMode', 'search'].forEach((key) => {
        const val = p.get(key);
        if (val) o[key] = val;
      });
      if (o.province && !o.region) o.region = o.province;
      return o;
    })()),
  };
  const { data, total, totalPages, loading, error, params, setPage, setFilters, refetch } = useListings(jobsApi.list, initialParams);
  const jobs = Array.isArray(data) ? data.filter((job) => job && job._id) : [];
  const visibleRecommended = recommendedJobs.filter((job) => job && job._id);

  const countryCode = params.countryCode || '';
  const regionValue = params.region || params.province || '';
  const specializationOptions = useMemo(
    () => (params.jobFamily ? (SPECIALIZATIONS_BY_FAMILY[params.jobFamily] || []) : []),
    [params.jobFamily]
  );

  useEffect(() => {
    jobsApi
      .geoFacets({ countryCode: countryCode || undefined, region: regionValue || undefined })
      .then(({ data: d }) => setGeoFacets(d || { countries: [], regions: [], cities: [] }))
      .catch(() => setGeoFacets({ countries: [], regions: [], cities: [] }));
  }, [countryCode, regionValue]);

  useEffect(() => {
    if (!isAuthenticated) return;
    savedApi.get().then(({ data: d }) => {
      const ids = new Set((d.savedJobs || []).map((j) => j._id));
      setSavedIds(ids);
    }).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingRecommended(true);
    recommendationsApi.get().then(({ data: d }) => setRecommendedJobs(d.jobs || [])).catch(() => setRecommendedJobs([])).finally(() => setLoadingRecommended(false));
  }, [isAuthenticated]);

  const handleSearch = (q) => {
    if (q && q.trim()) trackSearchQuery(q);
    setFilters({ search: q || undefined });
  };

  const handleJobFamilyChange = (value) => {
    setFilters({
      jobFamily: value || undefined,
      specialization: undefined,
      category: undefined,
    });
  };

  const resetFilters = () => setFilters({
    countryCode: undefined,
    region: undefined,
    province: undefined,
    city: undefined,
    jobFamily: undefined,
    specialization: undefined,
    category: undefined,
    organization: undefined,
    deadline: undefined,
    type: undefined,
    applyType: undefined,
    workMode: undefined,
    search: undefined,
  });

  const handleSaveToggle = async (id, save) => {
    if (save) await jobsApi.save(id);
    else await jobsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const seoTitle = t('seoTitle', { ns: 'jobs' });
  const seoDescription = t('seoDescription', { ns: 'jobs' });

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={ROUTES.JOBS}
        keywords={t('seoKeywords', { ns: 'jobs' })}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('jobs', { ns: 'navbar' }), url: ROUTES.JOBS },
          ]),
          collectionPageSchema({
            name: seoTitle,
            description: seoDescription,
            url: ROUTES.JOBS,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <AdHost placementId="jobs-header" className="mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('title', { ns: 'jobs' })}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('subtitle', { ns: 'jobs' })}</p>

        {isAuthenticated && visibleRecommended.length > 0 && (
          <ScrollReveal as="section" className="mb-8 p-4 rounded-xl border border-primary/30 dark:border-mint/30 bg-mint/20 dark:bg-mint/10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('recommended', { ns: 'jobs' })}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleRecommended.slice(0, 3).map((job) => (
                <Link key={job._id} to={`${ROUTES.JOBS}/${job.slug || job._id}`} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md">
                  <span className="font-medium text-gray-900 dark:text-white">{job.title}</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{job.organization || job.company}</p>
                </Link>
              ))}
            </div>
          </ScrollReveal>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 w-full min-w-0">
            <SearchBar
              placeholder={t('searchPlaceholder', { ns: 'jobs' })}
              onSearch={handleSearch}
              className="w-full max-w-xl"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">{t('sortLabel', { ns: 'jobs' })}:</label>
            <select
              value={params.sort || 'newest'}
              onChange={(e) => setFilters({ sort: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
            >
              {SORT_OPTIONS.jobs.map((o) => (
                <option key={o.value} value={o.value}>{t(JOB_SORT_KEYS[o.value], { ns: 'jobs' })}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-56 flex-shrink-0 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('countryLabel', { ns: 'jobs', defaultValue: 'Country' })}
              </label>
              <LocationCascadeFilter
                className="flex flex-col gap-2"
                countryCode={countryCode}
                region={regionValue}
                city={params.city || ''}
                facetRegions={geoFacets.regions}
                facetCities={geoFacets.cities}
                selectClassName={selectClass}
                onChange={({ countryCode: nextCountry, region: nextRegion, city: nextCity }) => {
                  setFilters({
                    countryCode: nextCountry || undefined,
                    region: nextRegion || undefined,
                    province: nextRegion || undefined,
                    city: nextCity || undefined,
                  });
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('jobFamilyLabel', { ns: 'jobs', defaultValue: 'Job Family' })}
              </label>
              <select value={params.jobFamily || ''} onChange={(e) => handleJobFamilyChange(e.target.value)} className={selectClass}>
                <option value="">{t('all', { ns: 'common' })}</option>
                {JOB_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('specializationLabel', { ns: 'jobs', defaultValue: 'Specialization' })}
              </label>
              <select
                value={params.specialization || ''}
                onChange={(e) => setFilters({ specialization: e.target.value || undefined })}
                className={selectClass}
                disabled={!params.jobFamily}
              >
                <option value="">{t('all', { ns: 'common' })}</option>
                {specializationOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('organizationLabel', { ns: 'jobs' })}</label>
              <input
                type="text"
                value={params.organization || ''}
                onChange={(e) => setFilters({ organization: e.target.value || undefined })}
                placeholder={t('filterByName', { ns: 'jobs' })}
                className={`${selectClass} placeholder-gray-500`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('deadlineAfter', { ns: 'jobs' })}</label>
              <input
                type="date"
                value={params.deadline || ''}
                onChange={(e) => setFilters({ deadline: e.target.value || undefined })}
                className={selectClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('typeLabel', { ns: 'jobs' })}</label>
              <select value={params.type || ''} onChange={(e) => setFilters({ type: e.target.value || undefined })} className={selectClass}>
                <option value="">{t('all', { ns: 'common' })}</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('workModeLabel', { ns: 'jobs', defaultValue: 'Work mode' })}</label>
              <select value={params.workMode || ''} onChange={(e) => setFilters({ workMode: e.target.value || undefined })} className={selectClass}>
                <option value="">{t('all', { ns: 'common' })}</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('applicationModeLabel', { ns: 'jobs', defaultValue: 'Application Method' })}</label>
              <select value={params.applyType || ''} onChange={(e) => setFilters({ applyType: e.target.value || undefined })} className={selectClass}>
                <option value="">{t('all', { ns: 'common' })}</option>
                <option value="internal">{t('applyOnStrideto', { ns: 'jobs', defaultValue: 'On Strideto' })}</option>
                <option value="external">{t('applyExternal', { ns: 'jobs', defaultValue: 'Official website' })}</option>
              </select>
            </div>
            <button type="button" onClick={resetFilters} className="text-sm text-primary dark:text-mint hover:underline min-h-[44px]">
              {t('resetFilters', { ns: 'jobs', defaultValue: 'Reset filters' })}
            </button>
            <AdHost placementId="jobs-sidebar" variant="sidebar" />
          </aside>

          <div className="flex-1 min-w-0">
            {error && (
              <Alert variant="error" className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="text-sm font-medium underline min-h-[44px]"
                  >
                    {t('retry', { ns: 'common', defaultValue: 'Try again' })}
                  </button>
                </div>
              </Alert>
            )}
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : jobs.length === 0 && !error ? (
              <EmptyState
                title={t('emptyCatalogTitle', { ns: 'jobs', defaultValue: 'No public jobs yet' })}
                description={t('emptyCatalogBody', { ns: 'jobs', defaultValue: 'Public jobs appear here when they are published and launch-eligible. You can change or reset filters. This is not sample inventory.' })}
                actionLabel={t('resetFilters', { ns: 'jobs', defaultValue: 'Reset filters' })}
                onAction={resetFilters}
              />
            ) : jobs.length === 0 && error ? (
              null
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('jobsFound', { count: total, ns: 'jobs' })}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {jobs.map((job, index) => (
                    <Fragment key={job._id}>
                      {index > 0 && index % 5 === 0 && <AdHost placementId="jobs-infeed" index={index} variant="inline" className="sm:col-span-2" />}
                      <article
                      className={`p-4 rounded-xl border flex flex-col transition-shadow ${job.source === 'scraper' && job.scrapedAt ? 'border-primary/50 dark:border-mint/50 bg-mint/20 dark:bg-mint/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} hover:shadow-md`}
                    >
                      <Link to={`${ROUTES.JOBS}/${job.slug || job._id}`} className="flex-1 block">
                        {job.source === 'scraper' && job.scrapedAt && (
                          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-primary text-white dark:bg-primary mb-2">{t('new', { ns: 'common' })}</span>
                        )}
                        {job.logoUrl && (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 mb-2 flex items-center justify-center text-xs text-gray-400">{t('logo', { ns: 'jobs' })}</div>
                        )}
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white break-words-safe">{job.title}</h2>
                        <p className="text-gray-600 dark:text-gray-400 break-words-safe">{job.organization || job.company}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 break-words-safe">
                          {[
                            [job.city, job.region || job.province].filter(Boolean).join(', ') || job.location,
                            job.countryCode ? countryDisplayName(job.countryCode) : null,
                            job.jobFamily || job.category,
                            job.specialization,
                            job.type,
                          ].filter(Boolean).join(' · ')}
                        </p>
                        {job.deadline && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('deadline', { ns: 'common' })}: {formatDate(job.deadline)}</p>
                        )}
                      </Link>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <SaveButton
                          type="job"
                          id={job._id}
                          saved={savedIds.has(job._id)}
                          onToggle={handleSaveToggle}
                        />
                      </div>
                    </article>
                    </Fragment>
                  ))}
                </div>
                {totalPages > 1 && (
                  <Pagination
                    currentPage={params.page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                )}
              </>
            )}
          </div>
        </div>
        <AdHost placementId="jobs-footer" className="mt-8" />
      </div>
    </>
  );
}
