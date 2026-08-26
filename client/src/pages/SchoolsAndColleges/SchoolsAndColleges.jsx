import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { institutionsApi } from '../../services/listingsService';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { formatLocationDisplay } from '@shared/international/location.js';

const PER_PAGE = 12;
const TYPES = [
  { value: '', labelKey: 'schoolsAllTypes' },
  { value: 'school', labelKey: 'schoolsTypeSchool' },
  { value: 'college', labelKey: 'schoolsTypeCollege' },
  { value: 'technical_institute', labelKey: 'schoolsTypeTechnical' },
  { value: 'training_center', labelKey: 'schoolsTypeTraining' },
];

export default function SchoolsAndColleges() {
  const { t } = useTranslation(['static', 'seo', 'navbar']);
  const { data, totalPages, loading, error, params, setPage, setFilters } = useListings(institutionsApi.list, { limit: PER_PAGE });

  return (
    <>
      <SeoHead
        title={t('static:schoolsTitle')}
        description={t('static:schoolsDescription')}
        canonical={ROUTES.SCHOOLS_AND_COLLEGES}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('static:schoolsHeading'), url: ROUTES.SCHOOLS_AND_COLLEGES },
          ]),
          collectionPageSchema({
            name: t('static:schoolsHeading'),
            description: t('static:schoolsDescription'),
            url: ROUTES.SCHOOLS_AND_COLLEGES,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('static:schoolsHeading')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('static:schoolsIntro')}</p>

        <div className="flex flex-wrap gap-3 mb-6">
          <SearchBar onSearch={(q) => setFilters({ search: q || undefined })} placeholder={t('static:schoolsSearch')} className="w-full min-w-0 sm:flex-1 sm:min-w-[200px]" />
          <select value={params.type || ''} onChange={(e) => setFilters({ type: e.target.value || undefined })} className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            {TYPES.map(({ value, labelKey }) => (
              <option key={value || 'all'} value={value}>{t(`static:${labelKey}`)}</option>
            ))}
          </select>
          <input type="text" placeholder={t('static:schoolsProvince')} value={params.province || ''} onChange={(e) => setFilters({ province: e.target.value || undefined })} className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <ListingCardSkeleton key={i} />)}</div>
        ) : data.length === 0 ? (
          <p className="text-gray-500">{t('static:schoolsEmpty')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => (
              <Link key={item._id} to={`${ROUTES.SCHOOLS_AND_COLLEGES}/${item.slug}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary transition-colors">
                {item.logoUrl && <img src={item.logoUrl} alt="" className="h-12 w-12 object-contain mb-2" loading="lazy" />}
                <p className="text-xs uppercase text-gray-500">{item.type?.replace(/_/g, ' ')}</p>
                <h2 className="font-semibold text-gray-900 dark:text-white">{item.name}</h2>
                {(item.city || item.province || item.country) && <p className="text-sm text-gray-500 mt-1">{formatLocationDisplay(item)}</p>}
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
