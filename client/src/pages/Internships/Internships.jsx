import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { internshipsApi, savedApi } from '../../services/listingsService';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { formatDate } from '../../utils/formatDate';
import { EmptyState } from '../../components/common/EmptyState';
import { Alert } from '../../components/ui/Alerts';
import { NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';
import { LocationCascadeFilter } from '../../components/forms/LocationCascadeFilter';
import { formatLocationDisplay } from '@shared/international/location.js';

const PER_PAGE = 10;
const DURATIONS = ['2 months', '3 months', '4 months', '6 months'];
const FIELDS = ['Software', 'Marketing', 'Finance', 'HR', 'Design', 'Data', 'Engineering', 'Content'];
const selectClass =
  'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]';

export default function Internships() {
  const { t } = useTranslation(['internships', 'common', 'navbar']);
  const { studentProductEnabled } = useStudentProductEnabled();
  const [savedIds, setSavedIds] = useState(new Set());

  const location = useLocation();
  const initialParams = {
    limit: PER_PAGE,
    page: 1,
    ...(typeof window !== 'undefined' && (() => {
      const p = new URLSearchParams(location.search);
      const o = {};
      ['countryCode', 'region', 'city', 'field', 'specialization', 'workMode', 'isPaid', 'duration', 'applyMethod', 'search'].forEach((key) => {
        const val = p.get(key);
        if (val) o[key] = val;
      });
      return o;
    })()),
  };
  const { data, totalPages, loading, error, params, setPage, setFilters } = useListings(internshipsApi.list, initialParams);

  useEffect(() => {
    if (!studentProductEnabled) return;
    savedApi.get().then(({ data: d }) => {
      const ids = new Set((d.savedInternships || []).map((i) => i._id));
      setSavedIds(ids);
    }).catch(() => {});
  }, [studentProductEnabled]);

  const handleSaveToggle = async (id, save) => {
    if (save) await internshipsApi.save(id);
    else await internshipsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const seoTitle = t('seoTitle', { ns: 'internships' });
  const seoDescription = t('seoDescription', { ns: 'internships' });

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={ROUTES.INTERNSHIPS}
        keywords={t('seoKeywords', { ns: 'internships' })}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('internships', { ns: 'navbar' }), url: ROUTES.INTERNSHIPS },
          ]),
          collectionPageSchema({
            name: seoTitle,
            description: seoDescription,
            url: ROUTES.INTERNSHIPS,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('title', { ns: 'internships' })}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('subtitle', { ns: 'internships' })}</p>

        <div className="flex flex-col gap-4 mb-6">
          <SearchBar placeholder={t('searchPlaceholder', { ns: 'internships' })} onSearch={(q) => setFilters({ search: q || undefined })} />
          <LocationCascadeFilter
            countryCode={params.countryCode || ''}
            region={params.region || ''}
            city={params.city || ''}
            selectClassName={selectClass}
            onChange={({ countryCode, region, city }) => setFilters({
              countryCode: countryCode || undefined,
              region: region || undefined,
              city: city || undefined,
            })}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <select className={selectClass} value={params.field || ''} onChange={(e) => setFilters({ field: e.target.value || undefined })}>
              <option value="">{t('anyField', { ns: 'internships' })}</option>
              {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className={selectClass} value={params.workMode || ''} onChange={(e) => setFilters({ workMode: e.target.value || undefined })}>
              <option value="">Work mode</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on_site">On-site</option>
            </select>
            <select className={selectClass} value={params.isPaid ?? ''} onChange={(e) => setFilters({ isPaid: e.target.value === '' ? undefined : e.target.value })}>
              <option value="">Compensation</option>
              <option value="true">{t('paid', { ns: 'internships' })}</option>
              <option value="false">{t('unpaid', { ns: 'internships' })}</option>
              <option value="unknown">Unknown</option>
            </select>
            <select className={selectClass} value={params.duration || ''} onChange={(e) => setFilters({ duration: e.target.value || undefined })}>
              <option value="">{t('anyDuration', { ns: 'internships' })}</option>
              {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={selectClass} value={params.applyMethod || ''} onChange={(e) => setFilters({ applyMethod: e.target.value || undefined })}>
              <option value="">Application method</option>
              <option value="internal">On Strideto</option>
              <option value="external">Official website</option>
            </select>
          </div>
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.map((item) => (
              <li key={item._id}>
                <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition flex flex-col h-full">
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Title + save */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link to={`${ROUTES.INTERNSHIPS}/${item.slug || item._id}`} className="font-semibold text-base text-gray-900 dark:text-white hover:text-primary dark:hover:text-mint break-words-safe line-clamp-2">
                          {item.title}
                        </Link>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words-safe">{item.organization}</p>
                      </div>
                      <SaveButton id={item._id} saved={savedIds.has(item._id)} onToggle={handleSaveToggle} />
                    </div>

                    {/* Compact fact row */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.internshipType && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{item.internshipType}</span>
                      )}
                      {item.workMode && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">{item.workMode.replace('_', ' ')}</span>
                      )}
                      {item.isPaid === true && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">Paid</span>
                      )}
                      {item.isPaid === false && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Unpaid</span>
                      )}
                    </div>

                    {/* Location + duration + deadline */}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                      {(item.countryCode || item.location || item.region || item.province) && (
                        <p>{formatLocationDisplay(item) || item.location}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3">
                        {item.duration && <span>{item.duration}</span>}
                        {item.deadline && <span>{t('deadlinePrefix', { ns: 'internships' })} {formatDate(item.deadline)}</span>}
                      </div>
                    </div>

                    {/* Skills */}
                    {item.skillset?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.skillset.slice(0, 5).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">{s}</span>
                        ))}
                        {item.skillset.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs text-gray-500">+{item.skillset.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer CTA */}
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                    <Link
                      to={`${ROUTES.INTERNSHIPS}/${item.slug || item._id}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover btn-theme"
                    >
                      {t('viewAndApply', { ns: 'internships' })}
                    </Link>
                    {!(item.applyInPlatform || item.applyMethod === 'internal') && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Official website</span>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {!loading && data.length === 0 && (
          <EmptyState
            title={t('noInternships', { ns: 'internships' })}
            description="Internships appear here when they are published and launch-eligible. Change or reset filters if you applied any. This is not sample inventory."
            actionLabel="Reset filters"
            onAction={() => setFilters({ search: undefined, countryCode: undefined, region: undefined, city: undefined })}
          />
        )}

        {totalPages > 1 && (
          <Pagination currentPage={params.page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
        )}
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">{NO_GUARANTEE_DISCLAIMER}</p>
      </div>
    </>
  );
}
