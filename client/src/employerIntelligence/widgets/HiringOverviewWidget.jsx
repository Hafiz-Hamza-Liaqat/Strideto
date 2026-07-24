import { useTranslation } from 'react-i18next';
import { Panel, EmptyHint } from './Panel';

export default function HiringOverviewWidget({ data }) {
  const { t } = useTranslation(['employer']);
  if (!data) return <Panel title={t('employer:widgetHiringOverview')}><EmptyHint>{t('employer:noData')}</EmptyHint></Panel>;
  const items = [
    { label: t('employer:activeJobsCard'), value: data.activeJobs },
    { label: t('employer:totalApplicationsCard'), value: data.totalApplications },
    { label: t('employer:shortlistedCard'), value: data.shortlisted },
    { label: t('employer:widgetInterviews'), value: data.interviews },
    { label: t('employer:widgetOffers'), value: data.offers },
    { label: t('employer:widgetHired'), value: data.hired },
  ];
  return (
    <Panel title={t('employer:widgetHiringOverview')}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 break-words leading-tight">{item.label}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">{item.value ?? 0}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
