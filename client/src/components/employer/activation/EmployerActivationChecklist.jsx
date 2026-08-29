import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants';
import { deriveEmployerActivationChecklist } from '@shared/employer/employerActivationState.js';

const ROUTE_BY_KEY = {
  settings: ROUTES.EMPLOYER_SETTINGS,
  postJob: ROUTES.EMPLOYER_POST_JOB,
  jobs: ROUTES.EMPLOYER_JOBS,
  applications: ROUTES.EMPLOYER_APPLICATIONS,
};

const ITEM_LABEL_KEYS = {
  profile: 'activationStepProfile',
  firstJob: 'activationStepFirstJob',
  applicationMethod: 'activationStepApplicationMethod',
  published: 'activationStepPublished',
};

/**
 * Compact activation checklist — completion derived from employer + dashboard data.
 */
export function EmployerActivationChecklist({
  employer,
  dashboard,
  onProfileIntent,
  onFirstJobIntent,
  className = '',
}) {
  const { t } = useTranslation(['employer']);
  const state = deriveEmployerActivationChecklist({ employer, dashboard });

  if (!state.showChecklist && state.activationComplete) return null;
  if (!state.showChecklist && (dashboard?.totalJobs || 0) > 0 && state.activationComplete) return null;

  const handleIntent = (itemId) => {
    if (itemId === 'profile' && onProfileIntent) onProfileIntent();
    if (itemId === 'firstJob' && onFirstJobIntent) onFirstJobIntent();
  };

  return (
    <section
      className={`rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-white dark:from-primary/10 dark:via-gray-800 dark:to-gray-800 p-5 sm:p-6 ${className}`}
      aria-labelledby="employer-activation-checklist-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id="employer-activation-checklist-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('employer:activationChecklistHeading')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
            {t('employer:activationChecklistIntro')}
          </p>
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 shrink-0" aria-live="polite">
          {t('employer:activationProgress', {
            completed: state.completedCount,
            total: state.totalCount,
          })}
        </p>
      </div>

      <ol className="space-y-2">
        {state.items.map((item) => {
          const to = ROUTE_BY_KEY[item.routeKey];
          const label = t(`employer:${ITEM_LABEL_KEYS[item.id]}`);
          return (
            <li key={item.id}>
              <Link
                to={to}
                onClick={() => handleIntent(item.id)}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 min-h-[44px] transition-colors ${
                  item.complete
                    ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                    : 'border-gray-200 bg-white hover:border-primary/40 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-primary/40'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    item.complete
                      ? 'bg-emerald-600 text-white'
                      : 'border border-gray-300 text-gray-500 dark:border-gray-500 dark:text-gray-400'
                  }`}
                  aria-hidden="true"
                >
                  {item.complete ? '✓' : '○'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                  {!item.complete && item.id === 'profile' ? (
                    <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {t('employer:activationProfileWhy')}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <Link to={ROUTES.FOR_EMPLOYERS} className="text-primary hover:underline dark:text-mint">
          {t('employer:activationLearnApplications')}
        </Link>
      </p>
    </section>
  );
}
