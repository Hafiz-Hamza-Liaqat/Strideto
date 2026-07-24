import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { WidgetShell } from '../WidgetShell';
import { StageBadge } from '../../components/applications/StageBadge';

/**
 * Tracker-aware applications summary widget (C.8.0.6 / C.8.1).
 * @param {{ data?: object }} props
 */
export function ApplicationsSummaryWidget({ data }) {
  const { t } = useTranslation(['dashboard', 'applications']);

  if (!data) {
    return (
      <WidgetShell title={t('dashboard:widgets.applicationsSummary')}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard:widgets.unavailable')}</p>
      </WidgetShell>
    );
  }

  const stages = data.byStage || {};
  const metrics = data.metrics || {};
  const counts = [
    { key: 'applied', label: t('dashboard:widgets.stageApplied'), value: stages.applied || 0 },
    { key: 'interview', label: t('dashboard:widgets.stageInterview'), value: stages.interview || 0 },
    { key: 'offers', label: t('dashboard:widgets.stageOffers'), value: stages.offers || 0 },
    { key: 'accepted', label: t('dashboard:widgets.stageAccepted'), value: stages.accepted || 0 },
    { key: 'rejected', label: t('dashboard:widgets.stageRejected'), value: stages.rejected || 0 },
  ];

  return (
    <WidgetShell
      title={t('dashboard:widgets.applicationsSummary')}
      action={(
        <Link to={ROUTES.APPLICATIONS} className="text-sm text-primary dark:text-mint hover:underline">
          {t('dashboard:viewAllArrow')}
        </Link>
      )}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.active ?? data.total ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard:widgets.trackerActive')}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.interviewsScheduled ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard:widgets.trackerInterviews')}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.offersReceived ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard:widgets.trackerOffers')}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.responseRate ?? 0}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard:widgets.trackerResponse')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {counts.map(({ key, label, value }) => (
          <div key={key} className="min-w-0 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Link
          to={ROUTES.APPLICATIONS}
          className="inline-flex items-center px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium min-h-[40px]"
        >
          {t('dashboard:widgets.openTracker')}
        </Link>
        <Link
          to={ROUTES.APPLICATIONS_NEW}
          className="inline-flex items-center px-3 py-2 rounded-lg border border-primary text-primary dark:text-mint text-sm font-medium min-h-[40px]"
        >
          {t('dashboard:widgets.trackNew')}
        </Link>
      </div>

      {(data.recent || []).length > 0 ? (
        <ul className="space-y-2">
          {data.recent.map((app) => (
            <li key={app._id}>
              <Link
                to={`${ROUTES.APPLICATIONS}/${app._id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40 text-sm"
              >
                <span className="font-medium text-gray-900 dark:text-white">{app.title}</span>
                <StageBadge stage={app.pipelineStage} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard:noApplications')}</p>
      )}
    </WidgetShell>
  );
}
