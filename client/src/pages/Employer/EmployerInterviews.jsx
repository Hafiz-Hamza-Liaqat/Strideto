import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';

export default function EmployerInterviews() {
  const { t } = useTranslation(['employer', 'common']);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    Promise.allSettled([
      employerApi.interviews(),
      isEmployerIntelligenceEnabled()
        ? employerApi.intelligenceDashboard()
        : Promise.resolve({ data: {} }),
    ])
      .then(([listRes, intelRes]) => {
        const listed = listRes.status === 'fulfilled' ? listRes.value.data.data || [] : [];
        const intel = intelRes.status === 'fulfilled' ? intelRes.value.data?.interviews || [] : [];
        const byId = new Map();
        for (const row of [...intel, ...listed]) {
          const id = String(row.legacyApplicationId || row._id);
          if (!byId.has(id)) byId.set(id, row);
        }
        setRows([...byId.values()]);
      })
      .catch((err) => setError(err.response?.data?.error || t('employer:interviewsLoadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <>
      <SeoHead title={t('employer:interviewsSeoTitle')} description={t('employer:interviewsSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navInterviews')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:interviewsIntro')}</p>
      {error ? <p className="mb-4 text-sm text-red-700" role="alert">{error}</p> : null}
      {(() => {
        const jobs = [...new Set(rows.map((row) => row.jobId?.title || row.jobTitle).filter(Boolean))];
        const statuses = [...new Set(rows.map((row) => row.status || row.interviewStatus).filter(Boolean))];
        const visible = rows.filter((row) => {
          const title = row.jobId?.title || row.jobTitle || '';
          if (jobFilter && title !== jobFilter) return false;
          const status = row.status || row.interviewStatus || '';
          if (statusFilter && status !== statusFilter) return false;
          const when = row.scheduledAt || row.updatedAt;
          if (fromDate && when && new Date(when) < new Date(`${fromDate}T00:00:00`)) return false;
          if (toDate && when && new Date(when) > new Date(`${toDate}T23:59:59`)) return false;
          return true;
        });
        return (
          <>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          Job
          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
            <option value="">{t('common:all')}</option>
            {jobs.map((title) => <option key={title} value={title}>{title}</option>)}
          </select>
        </label>
        {statuses.length ? (
          <label className="text-sm">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
              <option value="">{t('common:all')}</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        ) : null}
        <label className="text-sm">
          From
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
        </label>
        <label className="text-sm">
          To
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
        </label>
      </div>
      {loading ? <p>{t('common:loading')}</p> : visible.length === 0 ? (
        <p className="text-sm text-slate-600">{t('employer:noInterviews')}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => {
            const id = row.legacyApplicationId || row._id;
            const name = row.displayName || row.userId?.name || t('employer:unnamedCandidate');
            const when = row.scheduledAt || row.updatedAt;
            return (
              <li key={id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <Link
                  className="font-medium text-primary hover:underline"
                  to={`${ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES}/${id}`}
                >
                  {name}
                </Link>
                <p className="text-xs text-slate-500 mt-1">
                  {row.jobId?.title || row.jobTitle || ''} {when ? `· ${new Date(when).toLocaleString()}` : ''}
                  {row.timeZone ? ` · ${row.timeZone}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
          </>
        );
      })()}
    </>
  );
}
