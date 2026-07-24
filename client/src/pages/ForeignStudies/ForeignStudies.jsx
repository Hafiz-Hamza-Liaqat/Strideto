import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { foreignStudiesApi } from '../../services/listingsService';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { formatDate } from '../../utils/formatDate';

const PER_PAGE = 12;
const LEVELS = ['', 'Undergraduate', 'Graduate', 'PhD', 'Short Course', 'Other'];

export default function ForeignStudies() {
  const { t } = useTranslation(['static', 'seo', 'navbar', 'common']);
  const { data, totalPages, loading, error, params, setPage, setFilters } = useListings(foreignStudiesApi.list, { limit: PER_PAGE });

  return (
    <>
      <SeoHead
        title={t('static:foreignStudiesTitle')}
        description={t('static:foreignStudiesDescription')}
        canonical={ROUTES.FOREIGN_STUDIES}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('static:foreignStudiesHeading'), url: ROUTES.FOREIGN_STUDIES },
          ]),
          collectionPageSchema({
            name: t('static:foreignStudiesHeading'),
            description: t('static:foreignStudiesDescription'),
            url: ROUTES.FOREIGN_STUDIES,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('static:foreignStudiesHeading')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('static:foreignStudiesIntro')}</p>

        <div className="flex flex-wrap gap-3 mb-6">
          <SearchBar onSearch={(q) => setFilters({ search: q || undefined })} placeholder={t('static:foreignStudiesSearch')} className="w-full min-w-0 sm:flex-1 sm:min-w-[200px]" />
          <select value={params.level || ''} onChange={(e) => setFilters({ level: e.target.value || undefined })} className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            <option value="">{t('static:foreignStudiesAllLevels')}</option>
            {LEVELS.filter(Boolean).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="text" placeholder={t('static:foreignStudiesCountry')} value={params.country || ''} onChange={(e) => setFilters({ country: e.target.value || undefined })} className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <ListingCardSkeleton key={i} />)}</div>
        ) : data.length === 0 ? (
          <p className="text-gray-500">{t('static:foreignStudiesEmpty')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => (
              <Link key={item._id} to={`${ROUTES.FOREIGN_STUDIES}/${item.slug || item._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary dark:hover:border-mint transition-colors">
                {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-3" loading="lazy" />}
                <p className="text-xs text-primary dark:text-mint font-medium">{item.country}</p>
                <h2 className="font-semibold text-gray-900 dark:text-white mt-1">{item.program || item.institution || item.country}</h2>
                {item.institution && <p className="text-sm text-gray-500 mt-1">{item.institution}</p>}
                {item.deadline && <p className="text-xs text-gray-400 mt-2">{t('static:foreignStudiesDeadline')}: {formatDate(item.deadline)}</p>}
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination page={params.page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </>
  );
}
