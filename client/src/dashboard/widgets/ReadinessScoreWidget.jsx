import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { WidgetShell } from '../WidgetShell';

const PROVIDER_I18N = {
  profile_completeness: 'providerProfile',
  resume_quality: 'providerResume',
  verified_skills: 'providerCredentials',
  document_completeness: 'providerDocuments',
  application_engagement: 'providerApplications',
  skill_coverage: 'providerSkills',
};

/**
 * Career readiness score, trend, checklist, and explanation (C.8.2).
 * @param {{ data?: object }} props
 */
export function ReadinessScoreWidget({ data }) {
  const { t } = useTranslation(['dashboard']);

  if (!data) {
    return (
      <WidgetShell title={t('dashboard:widgets.readinessScore')}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard:widgets.unavailable')}</p>
      </WidgetShell>
    );
  }

  const overall = data.overall ?? 0;
  const trend = data.trend || [];
  const factors = data.factors || [];
  const improvements = data.improvements || [];
  const maxTrend = Math.max(100, ...trend.map((p) => p.overall || 0));

  return (
    <WidgetShell
      title={t('dashboard:widgets.readinessScore')}
      action={(
        <Link to={ROUTES.TALENT_PROFILE} className="text-sm text-primary dark:text-mint hover:underline">
          {t('dashboard:widgets.improveProfile')}
        </Link>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums" aria-live="polite">
              {overall}
              <span className="text-lg font-medium text-gray-500 dark:text-gray-400">/100</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dashboard:widgets.readinessOverall')}</p>
            {data.delta != null ? (
              <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                {data.delta >= 0 ? '+' : ''}{data.delta} {t('dashboard:widgets.readinessDelta')}
              </p>
            ) : null}
            {data.version ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t('dashboard:widgets.readinessVersion', { version: data.version })}
              </p>
            ) : null}
          </div>
          <div className="flex-1 w-full min-w-0 sm:min-w-[10rem]">
            <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${overall}%` }}
                role="progressbar"
                aria-valuenow={overall}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('dashboard:widgets.readinessOverall')}
              />
            </div>
          </div>
        </div>

        {trend.length > 1 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {t('dashboard:widgets.readinessTrend')}
            </h3>
            <div
              className="flex items-end gap-1 h-16"
              role="img"
              aria-label={t('dashboard:widgets.readinessTrend')}
            >
              {trend.map((point, idx) => (
                <div
                  key={`${point.computedAt}-${idx}`}
                  className="flex-1 rounded-t bg-primary/70 dark:bg-mint/60 min-w-0"
                  style={{ height: `${Math.max(8, ((point.overall || 0) / maxTrend) * 100)}%` }}
                  title={`${point.overall}%`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {factors.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {t('dashboard:widgets.readinessFactors')}
            </h3>
            <ul className="space-y-2" role="list">
              {factors.map((f) => {
                const key = PROVIDER_I18N[f.providerId] || f.providerId;
                return (
                  <li key={f.providerId} className="text-sm">
                    <div className="flex justify-between gap-2 mb-0.5">
                      <span className="text-gray-800 dark:text-gray-200">
                        {t(`dashboard:widgets.${key}`, { defaultValue: f.providerId })}
                      </span>
                      <span className="tabular-nums text-gray-600 dark:text-gray-300">{f.score}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full bg-primary/80 rounded-full" style={{ width: `${f.score}%` }} />
                    </div>
                    {f.explanation ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.explanation}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {improvements.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {t('dashboard:widgets.readinessChecklist')}
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300" role="list">
              {improvements.slice(0, 6).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard:widgets.readinessComplete')}</p>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard:widgets.readinessExplainHint')}</p>
      </div>
    </WidgetShell>
  );
}
