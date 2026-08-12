import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';

export default function EmployerPlansUsage() {
  const { t } = useTranslation(['employer', 'common']);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employerApi
      .plansUsage()
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || t('employer:usageLoadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <p>{t('common:loading')}</p>;

  const daily = data?.usage?.daily || {};
  const rolling = data?.usage?.rolling30Days || {};
  const active = data?.usage?.activeFreeJobs || {};

  return (
    <>
      <SeoHead title={t('employer:plansUsageSeoTitle')} description={t('employer:plansUsageSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navPlansUsage')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:plansUsageIntro')}</p>
      {error ? <p className="mb-4 text-sm text-red-700" role="alert">{error}</p> : null}
      {!data ? null : (
        <>
          <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 max-w-xl">
            <p className="text-sm text-slate-500">{t('employer:entitlementSnapshot', { defaultValue: 'Publishing entitlement' })}</p>
            <p className="text-lg font-semibold mt-1 capitalize">{(data.entitlement?.type || 'not_configured').replaceAll('_', ' ')}</p>
            <p className="text-xs mt-2 text-slate-600 dark:text-gray-400">
              {data.entitlement?.policyCode ? `${data.entitlement.policyCode} v${data.entitlement.policyVersion}` : t('employer:notConfigured', { defaultValue: 'Policy not configured' })}
            </p>
          </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-slate-500">{t('employer:currentPolicy')}</p>
            <p className="text-lg font-semibold mt-1">{data.policy?.code}</p>
            <p className="text-xs mt-2">{t('employer:verificationRequired')}: {String(data.policy?.verificationRequired)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-slate-500">{t('employer:draftsUnlimited')}</p>
            <p className="text-2xl font-semibold mt-1">{data.drafts?.count ?? 0}</p>
            <p className="text-xs mt-2">{t('employer:draftsDoNotConsume')}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-slate-500">{t('employer:freeDailySubmissions')}</p>
            <p className="text-2xl font-semibold mt-1">{daily.remaining ?? '—'} / {daily.limit ?? '—'}</p>
            <p className="text-xs mt-2">{t('employer:usedCount', { count: daily.used ?? 0 })}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-slate-500">{t('employer:rolling30Day')}</p>
            <p className="text-2xl font-semibold mt-1">{rolling.remaining ?? '—'} / {rolling.limit ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-slate-500">{t('employer:activeFreeJobs')}</p>
            <p className="text-2xl font-semibold mt-1">{active.remaining ?? '—'} / {active.limit ?? '—'}</p>
            <p className="text-xs mt-2">{t('employer:activeLimitAtApproval')}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-slate-500">{t('employer:nextReset')}</p>
            <p className="text-lg font-semibold mt-1">
              {data.nextReset ? new Date(data.nextReset).toLocaleString() : t('employer:notApplicable')}
            </p>
            <p className="text-xs mt-2">{t('employer:closedJobs')}: {data.closedJobs ?? 0}</p>
          </div>
        </div>
        </>
      )}
      <ul className="mt-8 text-sm list-disc list-inside space-y-1 text-slate-700 dark:text-gray-300 max-w-2xl">
        <li>{t('employer:quotaRuleDraft')}</li>
        <li>{t('employer:quotaRuleSubmit')}</li>
        <li>{t('employer:quotaRuleActive')}</li>
        <li>{t('employer:quotaRuleRolling')}</li>
        <li>{t('employer:quotaRuleVisibility')}</li>
      </ul>
      <p className="mt-4 text-sm">
        <Link to={ROUTES.EMPLOYER_GUIDELINES} className="text-primary hover:underline">{t('employer:readGuidelines')}</Link>
      </p>
    </>
  );
}
