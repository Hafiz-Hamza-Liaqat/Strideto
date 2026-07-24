import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { StageBadge } from './StageBadge';
import { PIPELINE_STAGES } from '@shared/career/constants.js';
import {
  getAllowedTransitions,
  resolveStageTemplateId,
} from '@shared/career/applicationStageMachine.js';
import { applicationDisplayTitle } from '../../utils/applicationUi';

/**
 * Kanban board grouped by pipelineStage.
 */
export function ApplicationKanbanBoard({ applications, onMoveStage }) {
  const { t } = useTranslation(['applications']);

  const byStage = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, []]));
  for (const app of applications) {
    const stage = app.pipelineStage || 'interested';
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push(app);
  }

  const visibleStages = PIPELINE_STAGES.filter(
    (s) => (byStage[s]?.length || 0) > 0 || ['interested', 'preparing', 'applied', 'interview', 'offer'].includes(s)
  );

  return (
    <div className="md:overflow-x-auto pb-2 -mx-1 px-1" role="region" aria-label={t('applications:views.kanban')}>
      <div className="flex flex-col md:flex-row gap-3 md:min-w-max">
        {visibleStages.map((stage) => (
          <div
            key={stage}
            className="w-full md:w-64 md:shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t(`applications:stages.${stage}`)}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{byStage[stage]?.length || 0}</span>
            </div>
            <ul className="space-y-2 min-h-[4rem]" role="list">
              {(byStage[stage] || []).map((app) => {
                const templateId = app.stageTemplateId
                  || resolveStageTemplateId(app.opportunityRef?.opportunityType || 'job');
                const transitions = app.allowedTransitions
                  || getAllowedTransitions(templateId, app.pipelineStage);
                return (
                  <li key={app._id}>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm">
                      <Link
                        to={`${ROUTES.APPLICATIONS}/${app._id}`}
                        className="block text-sm font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-mint"
                      >
                        {applicationDisplayTitle(app, t)}
                      </Link>
                      {app.companyName ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{app.companyName}</p>
                      ) : null}
                      <div className="mt-2"><StageBadge stage={app.pipelineStage} /></div>
                      {onMoveStage && transitions.length > 0 ? (
                        <label className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                          <span className="sr-only">{t('applications:tracker.moveStage')}</span>
                          <select
                            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs py-1.5"
                            defaultValue=""
                            aria-label={t('applications:tracker.moveStage')}
                            onChange={(e) => {
                              const to = e.target.value;
                              if (to) onMoveStage(app, to);
                              e.target.value = '';
                            }}
                          >
                            <option value="">{t('applications:tracker.moveStage')}</option>
                            {transitions.map((to) => (
                              <option key={to} value={to}>{t(`applications:stages.${to}`)}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
