import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { EmptyState } from '../../components/common/EmptyState';

const STATUS_FILTERS = ['', 'draft', 'active', 'closed'];

function isExternalJob(j) {
  return j?.applyType === 'external' || j?.applicationsTracked === false;
}

/** Presentation-only 3-way split for copy — does not affect tracking/filter logic. */
function applyMethodKind(j) {
  if (!isExternalJob(j)) return 'internal';
  if (j?.applicationLink) return 'external_url';
  if (j?.applyEmail) return 'external_email';
  return 'external_url';
}

function formatApplicationCount(j, t) {
  if (isExternalJob(j)) return t('employer:applicationsNotTracked');
  const n = j.submittedApplicationsCount ?? j.applicationsCount ?? 0;
  return String(n);
}

export default function EmployerJobs() {
  const { t } = useTranslation(['employer', 'common']);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [actionJobId, setActionJobId] = useState('');

  const loadJobs = useCallback(() => {
    setLoading(true);
    setError('');
    return employerApi
      .getJobs({ status: status || undefined })
      .then(({ data }) => setJobs(data.data || []))
      .catch(() => {
        setJobs([]);
        setError(t('employer:jobsLoadFailed'));
      })
      .finally(() => setLoading(false));
  }, [status, t]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const editPath = (id) => `/employer/jobs/${id}/edit`;

  const runJobAction = async (id, action) => {
    if (actionJobId) return;
    setActionJobId(id);
    try {
      if (action === 'close') await employerApi.closeJob(id);
      else if (action === 'reopen') await employerApi.reopenJob(id);
      else if (action === 'activate') await employerApi.activateJob(id, {});
      await loadJobs();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:jobActionFailed'));
    } finally {
      setActionJobId('');
    }
  };

  const JobActions = ({ j }) => (
    <div className="flex flex-wrap gap-2">
      {j.status !== 'closed' ? (
        <Link to={editPath(j._id)} className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center">
          {t('employer:editJob')}
        </Link>
      ) : (
        <button
          type="button"
          disabled={actionJobId === j._id}
          onClick={() => runJobAction(j._id, 'reopen')}
          className="text-sm text-primary hover:underline min-h-[44px]"
        >
          {t('employer:reopenJob')}
        </button>
      )}
      {j.status === 'draft' ? (
        <button
          type="button"
          disabled={actionJobId === j._id}
          onClick={() => runJobAction(j._id, 'activate')}
          className="text-sm text-slate-700 dark:text-gray-300 hover:underline min-h-[44px]"
        >
          {t('employer:activateJob')}
        </button>
      ) : null}
      {j.status !== 'closed' ? (
        <button
          type="button"
          disabled={actionJobId === j._id}
          onClick={() => {
            if (window.confirm(t('employer:confirmCloseJob'))) runJobAction(j._id, 'close');
          }}
          className="text-sm text-red-600 hover:underline min-h-[44px]"
        >
          {t('employer:closeJob')}
        </button>
      ) : null}
    </div>
  );

  const statusLabel = (s) => {
    if (!s) return t('common:all');
    const key = s === 'active' ? 'active' : s === 'draft' ? 'draft' : s === 'closed' ? 'closed' : s;
    return t(`common:${key}`, { defaultValue: s });
  };

  return (
    <>
      <SeoHead title={t('employer:myJobsSeoTitle')} description={t('employer:myJobsSeoDesc')} noindex />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {t('employer:myJobPosts')}
        </h1>
        <Link
          to={ROUTES.EMPLOYER_POST_JOB}
          className="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg min-h-[44px] inline-flex items-center shrink-0"
        >
          {t('employer:postNewJob')}
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm rounded-lg min-h-[44px] ${
              status === s
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-gray-300">{t('common:loading')}</div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon="🏢"
            title={t('employer:postFirstJob')}
            description={t('employer:noJobsYet')}
            actionLabel={t('employer:postAJob')}
            actionTo={ROUTES.EMPLOYER_POST_JOB}
          />
        ) : (
          <>
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {jobs.map((j) => (
                <div key={j._id} className="p-4 space-y-2 min-w-0">
                  <Link
                    to={`/jobs/${j.slug}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary break-words-safe block"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {j.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded ${
                        j.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : j.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {statusLabel(j.status)}
                    </span>
                    {j.approvalStatus && j.approvalStatus !== 'approved' ? (
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700">
                        {t(`employer:approval_${j.approvalStatus}`, { defaultValue: j.approvalStatus })}
                      </span>
                    ) : null}
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded ${
                        isExternalJob(j) ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {isExternalJob(j) ? t('employer:applyMethodExternal') : t('employer:applyMethodInternal')}
                    </span>
                    <span>
                      {t('common:views')}: {j.views ?? 0}
                    </span>
                    <span>
                      {t('common:applications')}: {formatApplicationCount(j, t)}
                    </span>
                  </div>
                  {isExternalJob(j) ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {applyMethodKind(j) === 'external_email'
                          ? t('employer:jobPostsExternalEmailNotTracked')
                          : t('employer:jobPostsExternalUrlNotTracked')}
                      </p>
                      {j.applicationLink ? (
                        <a
                          href={j.applicationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                        >
                          {t('employer:openApplicationDestination')}
                        </a>
                      ) : j.applyEmail ? (
                        <a
                          href={`mailto:${j.applyEmail}`}
                          className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                        >
                          {t('employer:openApplicationEmail')}
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 dark:text-gray-400">{t('employer:jobPostsInternalTracked')}</p>
                      <Link
                        to={`${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${j._id}`}
                        className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                      >
                        {t('employer:viewApplications')}
                      </Link>
                    </div>
                  )}
                  <JobActions j={j} />
                </div>
              ))}
            </div>
            <div className="hidden md:block table-scroll">
              <table className="w-full min-w-0">
                <thead className="bg-slate-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:title')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:status')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('employer:applyMethod')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:views')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:applications')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {jobs.map((j) => (
                    <tr key={j._id}>
                      <td className="py-3 px-4 min-w-0">
                        <Link
                          to={`/jobs/${j.slug}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-primary break-words-safe"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {j.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded ${
                            j.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : j.status === 'draft'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabel(j.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-gray-300">
                        {isExternalJob(j) ? t('employer:applyMethodExternal') : t('employer:applyMethodInternal')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{j.views ?? 0}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{formatApplicationCount(j, t)}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {isExternalJob(j) ? (
                            j.applicationLink ? (
                              <a
                                href={j.applicationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                {t('employer:openApplicationDestination')}
                              </a>
                            ) : j.applyEmail ? (
                              <a href={`mailto:${j.applyEmail}`} className="text-sm text-primary hover:underline">
                                {t('employer:openApplicationEmail')}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-500">
                                {applyMethodKind(j) === 'external_email'
                                  ? t('employer:jobPostsExternalEmailNotTracked')
                                  : t('employer:jobPostsExternalUrlNotTracked')}
                              </span>
                            )
                          ) : (
                            <Link
                              to={`${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${j._id}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {t('employer:viewApplications')}
                            </Link>
                          )}
                          <JobActions j={j} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
