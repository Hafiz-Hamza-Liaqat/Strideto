import { useTranslation } from 'react-i18next';
import { formatApplicationDate } from '../../utils/applicationUi';
import { StageBadge } from './StageBadge';

export function StageTimeline({ history = [], className = '' }) {
  const { t, i18n } = useTranslation(['applications']);

  if (!history.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400" role="status">
        {t('applications:detail.noStageHistory')}
      </p>
    );
  }

  const items = [...history].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <ol className={`relative border-s border-gray-200 dark:border-gray-700 ms-3 space-y-4 ${className}`} aria-label={t('applications:detail.stageHistoryTitle')}>
      {items.map((entry) => (
        <li key={entry._id || `${entry.fromStage}-${entry.toStage}-${entry.at}`} className="ms-6">
          <span className="absolute flex items-center justify-center w-3 h-3 bg-primary rounded-full -start-1.5 ring-4 ring-white dark:ring-gray-900" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StageBadge stage={entry.toStage} />
            {entry.fromStage !== entry.toStage && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('applications:detail.fromStage', {
                  stage: t(`applications:stages.${entry.fromStage}`, { defaultValue: entry.fromStage }),
                })}
              </span>
            )}
          </div>
          <time className="text-xs text-gray-500 dark:text-gray-400" dateTime={entry.at}>
            {formatApplicationDate(entry.at, i18n.language, { time: true })}
          </time>
          {entry.reason && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {t(`applications:stageHistoryReasons.${entry.reason}`, {
                defaultValue: entry.reason,
              })}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
