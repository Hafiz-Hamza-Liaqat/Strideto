import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { admissionsApi, savedApi } from '../../services/listingsService';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import { SORT_OPTIONS } from '../../constants/listings';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { formatDate, daysUntil } from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import { AdHost } from '../../components/ads';
import { EmptyState } from '../../components/common/EmptyState';
import { OfficialIntakesRail } from '../../components/public/OfficialDiscoveryRail';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';

const PER_PAGE = 10;

const ADMISSION_SORT_KEYS = {
  newest: 'sortNewest',
  deadline: 'sortDeadline',
};

export default function Admissions() {
  const { t } = useTranslation(['admissions', 'common', 'navbar']);
  const { isAuthenticated } = useAuth();
  const [savedIds, setSavedIds] = useState(new Set());
  const { data, total, totalPages, loading, error, params, setPage, setFilters } = useListings(admissionsApi.list, { limit: PER_PAGE, sort: 'newest' });

  useEffect(() => {
    if (!isAuthenticated) return;
    savedApi.get().then(({ data: d }) => setSavedIds(new Set((d.savedAdmissions || []).map((a) => a._id)))).catch(() => {});
  }, [isAuthenticated]);

  const handleSearch = (q) => setFilters({ search: q || undefined });
  const handleSaveToggle = async (id, save) => {
    if (save) await admissionsApi.save(id);
    else await admissionsApi.unsave(id);
    setSavedIds((prev) => { const next = new Set(prev); save ? next.add(id) : next.delete(id); return next; });
  };

  const seoTitle = t('seoTitle', { ns: 'admissions' });
  const seoDescription = t('seoDescription', { ns: 'admissions' });

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={ROUTES.ADMISSIONS}
        keywords={t('seoKeywords', { ns: 'admissions' })}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('admissions', { ns: 'navbar' }), url: ROUTES.ADMISSIONS },
          ]),
          collectionPageSchema({
            name: seoTitle,
            description: seoDescription,
            url: ROUTES.ADMISSIONS,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <AdHost placementId="admissions-header" className="mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('title', { ns: 'admissions' })}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('subtitle', { ns: 'admissions' })}</p>
        <OfficialIntakesRail />

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 w-full min-w-0">
            <SearchBar placeholder={t('searchPlaceholder', { ns: 'admissions' })} onSearch={handleSearch} className="w-full max-w-xl" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">{t('sortLabel', { ns: 'admissions' })}:</label>
            <select value={params.sort || 'newest'} onChange={(e) => setFilters({ sort: e.target.value })} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm">
              {SORT_OPTIONS.admissions.map((o) => <option key={o.value} value={o.value}>{t(ADMISSION_SORT_KEYS[o.value], { ns: 'admissions' })}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-56 flex-shrink-0 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('universityCollegeLabel', { ns: 'admissions' })}</label>
              <input type="text" value={params.university || ''} onChange={(e) => setFilters({ university: e.target.value || undefined })} placeholder={t('filterByName', { ns: 'admissions' })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('programDepartmentLabel', { ns: 'admissions' })}</label>
              <input type="text" value={params.program || ''} onChange={(e) => setFilters({ program: e.target.value || undefined })} placeholder={t('filterProgram', { ns: 'admissions' })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('deadlineAfter', { ns: 'admissions' })}</label>
              <input type="date" value={params.deadline || ''} onChange={(e) => setFilters({ deadline: e.target.value || undefined })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm" />
            </div>
            <AdHost placementId="admissions-sidebar" variant="sidebar" />
          </aside>

          <div className="flex-1 min-w-0">
            {error && <Alert variant="error" className="mb-4">{error}</Alert>}
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : data.length === 0 ? (
              <EmptyState
                icon="🏛"
                title="No public admissions yet"
                description="Admissions appear here when they are published and launch-eligible. Change or reset filters if you applied any. This is not sample inventory."
                actionLabel="Reset filters"
                onAction={() => setFilters({ search: undefined, deadline: undefined, province: undefined })}
              />
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('admissionsFound', { count: total, ns: 'admissions' })}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {data.map((a) => {
                    const days = daysUntil(a.deadline);
                    return (
                      <article key={a._id} className={`p-4 rounded-xl border flex flex-col transition-shadow ${a.source === 'scraper' && a.scrapedAt ? 'border-primary/50 dark:border-mint/50 bg-mint/20 dark:bg-mint/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} hover:shadow-md`}>
                        <Link to={`${ROUTES.ADMISSIONS}/${a.slug || a._id}`} className="flex-1 block">
                          {a.source === 'scraper' && a.scrapedAt && (
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-primary text-white dark:bg-primary mb-2">{t('new', { ns: 'common' })}</span>
                          )}
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-white break-words-safe">{a.program}</h2>
                          <p className="text-gray-600 dark:text-gray-400 break-words-safe">{a.institution}</p>
                          <div className="mt-1"><PublicTrustBadge kind={a.authorityKind} label={a.authorityLabel} /></div>
                          {a.department && <p className="text-sm text-gray-500">{a.department}</p>}
                          {a.session && <p className="text-sm text-gray-500">{a.session}</p>}
                          {a.deadline && (
                            <p className="text-xs mt-2">
                              {days != null && days >= 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">{t('daysLeft', { count: days, ns: 'admissions' })}</span>
                              ) : (
                                <span className="text-gray-500">{t('deadline', { ns: 'common' })}: {formatDate(a.deadline)}</span>
                              )}
                            </p>
                          )}
                        </Link>
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <SaveButton type="admission" id={a._id} saved={savedIds.has(a._id)} onToggle={handleSaveToggle} />
                        </div>
                      </article>
                    );
                  })}
                </div>
                {totalPages > 1 && <Pagination currentPage={params.page} totalPages={totalPages} onPageChange={setPage} />}
              </>
            )}
          </div>
        </div>
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">{NO_GUARANTEE_DISCLAIMER}</p>
      </div>
    </>
  );
}
