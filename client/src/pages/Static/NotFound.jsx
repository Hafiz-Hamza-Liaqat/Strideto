import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';

export default function NotFound() {
  const { t } = useTranslation(['seo', 'common']);

  return (
    <>
      <SeoHead
        title={t('seo:notFoundTitle')}
        description={t('seo:notFoundDescription')}
        canonical="/404"
        noindex
      />
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-6xl font-bold text-primary dark:text-mint mb-4">404</p>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
          {t('seo:notFoundHeading')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {t('seo:notFoundBody')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={ROUTES.HOME}
            className="inline-flex px-5 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover btn-theme text-sm font-medium"
          >
            {t('common:goHome')}
          </Link>
          <Link
            to={ROUTES.JOBS}
            className="inline-flex px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
          >
            {t('seo:browseJobs')}
          </Link>
          <Link
            to={ROUTES.SITEMAP}
            className="inline-flex px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
          >
            {t('seo:browseSitemap')}
          </Link>
        </div>
      </div>
    </>
  );
}
