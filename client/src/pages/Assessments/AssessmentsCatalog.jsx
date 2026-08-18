import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { assessmentsApi } from '../../services/assessmentsApi';
import { isAssessmentsEnabled } from '../../config/careerFeatureFlags';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';

export default function AssessmentsCatalog() {
  const { t } = useTranslation(['assessments', 'common']);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [family, setFamily] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAssessmentsEnabled()) {
      setLoading(false);
      return;
    }
    Promise.all([
      assessmentsApi.list().then(({ data }) => setItems(data.data || [])),
      assessmentsApi.listCategories().then(({ data }) => setCategories(data.data || [])).catch(() => {}),
    ])
      .catch((err) => setError(err.response?.data?.error || t('assessments:loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  if (!isAssessmentsEnabled()) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <SeoHead title={t('assessments:title')} noindex />
        <h1 className="sr-only">{t('assessments:title')}</h1>
        <p role="alert">{t('assessments:featureDisabled')}</p>
      </div>
    );
  }

  const visible = family === 'all' ? items : items.filter((a) => a.family === family);

  return (
    <>
      <SeoHead title={t('assessments:title')} description={t('assessments:subtitle')} noindex />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 min-w-0 w-full">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{t('assessments:title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('assessments:subtitle')}</p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm min-h-[40px] ${family === 'all' ? 'bg-primary text-white' : 'border border-gray-300 dark:border-gray-600'}`}
            onClick={() => setFamily('all')}
          >
            {t('assessments:filters.all')}
          </button>
          {['general_employment', 'technical', 'professional'].map((f) => (
            <button
              key={f}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-sm min-h-[40px] ${family === f ? 'bg-primary text-white' : 'border border-gray-300 dark:border-gray-600'}`}
              onClick={() => setFamily(f)}
            >
              {t(`assessments:families.${f}`)}
            </button>
          ))}
        </div>

        {error ? <p className="text-red-600 dark:text-red-400 mb-4" role="alert">{error}</p> : null}
        {loading ? (
          <div className="space-y-3"><ListingCardSkeleton /><ListingCardSkeleton /></div>
        ) : visible.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('assessments:empty')}</p>
        ) : (
          <ul className="space-y-3" role="list">
            {visible.map((a) => (
              <li key={a._id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <Link to={`${ROUTES.ASSESSMENTS}/${a.slug}`} className="text-lg font-semibold text-primary dark:text-mint hover:underline">
                  {a.title}
                </Link>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t(`assessments:categories.${a.categorySlug}`, { defaultValue: a.categorySlug })}
                  {' · '}
                  {a.durationMinutes} {t('assessments:minutes')}
                  {' · '}
                  {t('assessments:passingScore', { score: a.passingScore })}
                </p>
                {a.description ? <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{a.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {categories.length > 0 ? (
          <p className="mt-6 text-xs text-gray-400">{t('assessments:categoriesAvailable', { count: categories.length })}</p>
        ) : null}
      </div>
    </>
  );
}
