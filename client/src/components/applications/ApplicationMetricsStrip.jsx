import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

/**
 * Lightweight tracker metrics strip.
 */
export function ApplicationMetricsStrip({ metrics, className = '' }) {
  const { t } = useTranslation(['applications']);
  if (!metrics) return null;

  const tiles = [
    { key: 'active', label: t('applications:metrics.active'), value: metrics.active ?? 0 },
    { key: 'interviews', label: t('applications:metrics.interviews'), value: metrics.interviewsScheduled ?? 0 },
    { key: 'offers', label: t('applications:metrics.offers'), value: metrics.offersReceived ?? 0 },
    { key: 'response', label: t('applications:metrics.responseRate'), value: `${metrics.responseRate ?? 0}%` },
    { key: 'completion', label: t('applications:metrics.completionRate'), value: `${metrics.completionRate ?? 0}%` },
  ];

  return (
    <section className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 ${className}`} aria-label={t('applications:metrics.title')}>
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{tile.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tile.label}</p>
        </div>
      ))}
      <p className="col-span-full text-xs text-gray-500 dark:text-gray-400 mt-1">
        {t('applications:metrics.disclaimer')}
      </p>
      <div className="col-span-full flex flex-wrap gap-3 mt-1">
        <Link to={ROUTES.APPLICATIONS_NEW} className="text-sm text-primary dark:text-mint hover:underline font-medium">
          {t('applications:createApplication')}
        </Link>
        <Link to={ROUTES.APPLICATIONS} className="text-sm text-gray-600 dark:text-gray-400 hover:underline">
          {t('applications:metrics.openTracker')}
        </Link>
      </div>
    </section>
  );
}
