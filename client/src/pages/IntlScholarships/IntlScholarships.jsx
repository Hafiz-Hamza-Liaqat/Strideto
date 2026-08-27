import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { DEFAULT_KEYWORDS } from '../../seo/config';
import { intlScholarshipsApi, savedApi } from '../../services/listingsService';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatDate';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { coerceCountryCode } from '@shared/international/country.js';

const PER_PAGE = 10;

function intlScholarshipPath(item) {
  return `${ROUTES.INTL_SCHOLARSHIPS}/${item.slug || item._id}`;
}

export default function IntlScholarships() {
  const { t } = useTranslation(['scholarships', 'seo', 'common']);
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [savedIds, setSavedIds] = useState(new Set());
  const urlCountry = coerceCountryCode(searchParams.get('country') || '') || '';
  const initialParams = { limit: PER_PAGE, page: 1, country: urlCountry || undefined };
  const { data, totalPages, loading, error, params, setPage, setFilters } = useListings(intlScholarshipsApi.list, initialParams);

  useEffect(() => {
    const next = coerceCountryCode(searchParams.get('country') || '') || '';
    if ((params.country || '') !== next) setFilters({ country: next || undefined });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCountry = (code) => {
    const next = coerceCountryCode(code) || '';
    setFilters({ country: next || undefined });
    const q = new URLSearchParams(searchParams);
    if (next) q.set('country', next);
    else q.delete('country');
    setSearchParams(q, { replace: true });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    savedApi.get().then(({ data: d }) => {
      const ids = new Set((d.savedIntlScholarships || []).map((s) => s._id));
      setSavedIds(ids);
    }).catch(() => {});
  }, [isAuthenticated]);

  const handleSaveToggle = async (id, save) => {
    if (save) await intlScholarshipsApi.save(id);
    else await intlScholarshipsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <>
      <SeoHead
        title={t('seo:intlScholarshipsTitle')}
        description={t('seo:intlScholarshipsDescription')}
        canonical={ROUTES.INTL_SCHOLARSHIPS}
        keywords={`international scholarships, study abroad, ${DEFAULT_KEYWORDS}`}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('scholarships:intlTitle'), url: ROUTES.INTL_SCHOLARSHIPS },
          ]),
          collectionPageSchema({
            name: t('seo:intlScholarshipsTitle'),
            description: t('seo:intlScholarshipsDescription'),
            url: ROUTES.INTL_SCHOLARSHIPS,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('scholarships:intlTitle')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('scholarships:intlSubtitle')}</p>

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchBar placeholder={t('scholarships:intlSearchPlaceholder')} onSearch={(q) => setFilters({ search: q || undefined })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[220px]">
              <CountrySelect
                allowAll
                value={params.country || ''}
                onChange={applyCountry}
              />
            </div>
            <button
              type="button"
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
              onClick={() => applyCountry('')}
            >
              {t('common:reset', { defaultValue: 'Reset' })}
            </button>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
              value={params.deadline || ''}
              onChange={(e) => setFilters({ deadline: e.target.value || undefined })}
            >
              <option value="">{t('scholarships:anyDeadline')}</option>
              <option value="upcoming">{t('scholarships:upcomingOnly')}</option>
            </select>
          </div>
        </div>

        {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.map((item) => (
              <li key={item._id} className="min-w-0">
                <article className="h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition flex flex-col">
                  <div className="p-4 md:p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link to={intlScholarshipPath(item)} className="font-semibold text-base text-gray-900 dark:text-white hover:text-primary dark:hover:text-mint break-words-safe line-clamp-2">
                          {item.title}
                        </Link>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words-safe">
                          {[item.country, item.university || item.provider].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {isAuthenticated && (
                        <SaveButton saved={savedIds.has(item._id)} onToggle={() => handleSaveToggle(item._id, !savedIds.has(item._id))} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.fundingType ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{item.fundingType}</span>
                      ) : null}
                      {item.visaRequirements ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{t('scholarships:visaInfoAvailable')}</span>
                      ) : null}
                    </div>
                    {item.deadline ? (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('scholarships:deadlinePrefix')} {formatDate(item.deadline)}
                      </p>
                    ) : null}
                    <Link to={intlScholarshipPath(item)} className="inline-block mt-auto pt-3 text-sm text-primary dark:text-mint hover:underline">
                      {t('scholarships:viewDetails')}
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {!loading && data.length === 0 && <p className="text-gray-500 dark:text-gray-400 py-8 text-center">{t('scholarships:noIntlScholarships')}</p>}

        {totalPages > 1 && (
          <Pagination currentPage={params.page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
        )}
      </div>
    </>
  );
}
