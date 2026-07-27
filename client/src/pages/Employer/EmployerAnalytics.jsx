import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';

function isExternalJob(j) {
  return j?.applyType === 'external' || j?.applicationsTracked === false;
}

export default function EmployerAnalytics() {
  const { t } = useTranslation(['employer', 'common']);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedJob = useMemo(() => jobs.find((j) => j._id === selectedJobId), [jobs, selectedJobId]);

  useEffect(() => {
    employerApi.getJobs({}).then(({ data }) => setJobs(data.data || [])).catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setAnalytics(null);
      return;
    }
    setLoading(true);
    employerApi
      .jobAnalytics(selectedJobId)
      .then(({ data }) => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, [selectedJobId]);

  const appsDisplay =
    analytics?.applicationsTracked === false || analytics?.applications == null
      ? t('employer:applicationsNotTracked')
      : (analytics?.applications ?? 0);

  const conversionDisplay =
    analytics?.applicationsTracked === false
      ? t('employer:notAvailable')
      : analytics?.conversionRate ?? t('employer:notAvailable');

  return (
    <>
      <SeoHead title={t('employer:analyticsSeoTitle')} description={t('employer:analyticsSeoDesc')} noindex />
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:jobAnalytics')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:analyticsTruthHint')}</p>
      <div className="mb-4 max-w-md min-w-0">
        <label htmlFor="employer-analytics-job" className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-2">
          {t('employer:selectJob')}
        </label>
        <select
          id="employer-analytics-job"
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="">{t('employer:selectJobPlaceholder')}</option>
          {jobs.map((j) => (
            <option key={j._id} value={j._id}>
              {j.title}
              {isExternalJob(j) ? ` (${t('employer:applyMethodExternal')})` : ''}
            </option>
          ))}
        </select>
      </div>
      {!selectedJobId ? (
        <p className="text-sm text-slate-600 dark:text-gray-400">{t('employer:analyticsSelectJobEmpty')}</p>
      ) : loading ? (
        <p className="text-sm text-slate-600 dark:text-gray-400">{t('common:loading')}</p>
      ) : analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-sm text-slate-600 dark:text-gray-400">{t('common:views')}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{analytics.views ?? 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-sm text-slate-600 dark:text-gray-400">{t('common:applications')}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white break-words">{appsDisplay}</p>
            {selectedJob && isExternalJob(selectedJob) ? (
              <p className="text-xs text-slate-500 mt-1">{t('employer:externalAnalyticsHint')}</p>
            ) : null}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 min-w-0">
            <p className="text-sm text-slate-600 dark:text-gray-400">{t('employer:conversionRate')}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white break-words">{conversionDisplay}</p>
            <p className="text-xs text-slate-500 mt-1">{t('employer:conversionFormulaHint')}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">{t('employer:analyticsLoadFailed')}</p>
      )}
    </>
  );
}
