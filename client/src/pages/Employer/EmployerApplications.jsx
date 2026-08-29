import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { StageBadge } from '../../components/applications/StageBadge';
import {
  EMPLOYER_SETTABLE_STATUSES,
  STATUS_ACTION_LABEL_KEYS,
  LEGACY_STATUS_LABEL_KEYS,
} from '../../utils/employerApplicationStatus';
import { applicationDetailPath } from './EmployerApplicationDetail';
import { openEmployerApplicationResume } from '../../utils/employerApplicationResume';
import {
  trackEmployerApplicationsView,
  trackEmployerApplicantEmptyStateView,
  trackEmployerApplicantEvent,
  EMPLOYER_APPLICANT_ACTIONS,
} from '../../components/employer/applicant/employerApplicantAnalytics';

const STATUS_OPTIONS = EMPLOYER_SETTABLE_STATUSES;

export default function EmployerApplications() {
  const { t } = useTranslation(['employer', 'common']);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const jobId = searchParams.get('jobId');
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobMeta, setJobMeta] = useState(null);
  const [tracked, setTracked] = useState(true);
  const [apiMessage, setApiMessage] = useState('');
  const [listTruncated, setListTruncated] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(jobId);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusSuccess, setStatusSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const statusLabel = (s) => {
    const key = LEGACY_STATUS_LABEL_KEYS[s];
    return key ? t(`employer:${key}`, { defaultValue: s }) : s;
  };

  useEffect(() => {
    setJobsLoading(true);
    employerApi
      .getJobOptions()
      .then(({ data }) => setJobs(data.data || []))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
  }, []);

  useEffect(() => {
    if (jobId) setSelectedJobId(jobId);
  }, [jobId]);

  useEffect(() => {
    if (jobsLoading) return;
    trackEmployerApplicationsView(location.key, {
      applicationMethod: selectedJobId ? 'job_scoped' : 'all_jobs',
    });
  }, [jobsLoading, location.key, selectedJobId]);

  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);
  const selectedJobIdRef = useRef(selectedJobId);
  const emptyStateTrackedRef = useRef('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  const loadApplications = useCallback(
    ({ background = false, force = false } = {}) => {
      const targetJobId = selectedJobIdRef.current;
      if (!targetJobId) return;
      if (document.hidden) return;
      if (inFlightRef.current && !force) return;
      inFlightRef.current = true;
      const seq = ++requestSeqRef.current;
      if (!background) {
        setLoading(true);
        setError('');
        setApiMessage('');
      }
      employerApi
        .getJobApplications(targetJobId)
        .then(({ data }) => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;
          setApplications(data.data || []);
          setJobMeta(data.job || null);
          setTracked(data.applicationsTracked !== false);
          setApiMessage(data.message || '');
          setListTruncated(Boolean(data.truncated));
          setSubmittedCount(
            data.submittedApplicationsCount != null ? data.submittedApplicationsCount : null
          );
          setError('');
        })
        .catch((err) => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;
          if (!background) {
            setApplications([]);
            setJobMeta(null);
            setError(err.response?.data?.error || t('employer:applicationsLoadFailed'));
          }
        })
        .finally(() => {
          if (seq === requestSeqRef.current) inFlightRef.current = false;
          if (mountedRef.current && !background && seq === requestSeqRef.current) setLoading(false);
        });
    },
    [t]
  );

  useEffect(() => {
    if (!selectedJobId) {
      setApplications([]);
      setJobMeta(null);
      setTracked(true);
      setApiMessage('');
      setListTruncated(false);
      setSubmittedCount(null);
      setLoading(false);
      return;
    }
    loadApplications({ background: false, force: true });
  }, [selectedJobId, loadApplications]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadApplications({ background: true });
    };
    const handleFocus = () => loadApplications({ background: true });

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadApplications]);

  const selectedFromList = jobs.find((j) => j._id === selectedJobId);
  const isExternal =
    jobMeta?.applyType === 'external' ||
    tracked === false ||
    selectedFromList?.applyType === 'external' ||
    selectedFromList?.applicationsTracked === false;

  const internalJobs = jobs.filter(
    (j) => j.applyType !== 'external' && j.applicationsTracked !== false
  );
  const hasAnyInternalJob = internalJobs.length > 0;
  const globalInternalApplicationTotal = internalJobs.reduce(
    (sum, j) => sum + (j.submittedApplicationsCount ?? j.applicationsCount ?? 0),
    0
  );

  const updateStatus = async (appId, status) => {
    setStatusError('');
    setStatusSuccess('');
    const previous = applications.find((a) => a._id === appId)?.status;
    trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.STATUS_INTENT, {
      surface: 'applications_inbox',
      statusFrom: previous,
      statusTo: status,
    });
    try {
      await employerApi.updateApplicationStatus(appId, status);
      setApplications((prev) => prev.map((a) => (a._id === appId ? { ...a, status } : a)));
      setStatusSuccess(t('employer:statusUpdateSuccess'));
      trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.STATUS_UPDATED, {
        surface: 'applications_inbox',
        statusFrom: previous,
        statusTo: status,
      });
      loadApplications({ background: true, force: true });
    } catch (err) {
      setStatusError(err.response?.data?.error || t('employer:statusUpdateFailed'));
    }
  };

  const externalDisclosureMessage = () => {
    const link = jobMeta?.applicationLink || selectedFromList?.applicationLink;
    const email = jobMeta?.applyEmail || selectedFromList?.applyEmail;
    if (link) return t('employer:externalUrlAppsNotVisible');
    if (email) return t('employer:externalEmailAppsNotVisible');
    return apiMessage || t('employer:externalAppsNotVisible');
  };

  const visibleApplications = applications.filter((app) => {
    if (statusFilter && app.status !== statusFilter && app.hiringStage !== statusFilter) return false;
    const applied = app.appliedDate || app.createdAt;
    if (fromDate && applied && new Date(applied) < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && applied && new Date(applied) > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  });

  const emptyMessage = () => {
    if (!selectedJobId) {
      if (hasAnyInternalJob && globalInternalApplicationTotal === 0) {
        return t('employer:globalNoApplicationsYet');
      }
      return t('employer:selectJobToViewApplications');
    }
    if (isExternal) return externalDisclosureMessage();
    return t('employer:noApplicationsYet');
  };

  const emptySurfaceKey = !selectedJobId
    ? 'global_no_selection'
    : isExternal
      ? `external_job:${selectedJobId}`
      : `internal_empty:${selectedJobId}`;

  useEffect(() => {
    if (loading || jobsLoading) return;
    const showEmpty =
      (jobs.length === 0 && !jobsLoading) ||
      (selectedJobId && !loading && visibleApplications.length === 0) ||
      (!selectedJobId && hasAnyInternalJob && globalInternalApplicationTotal === 0);
    if (!showEmpty) return;
    if (emptyStateTrackedRef.current === emptySurfaceKey) return;
    emptyStateTrackedRef.current = emptySurfaceKey;
    trackEmployerApplicantEmptyStateView(emptySurfaceKey, {
      applicationMethod: isExternal ? 'external' : 'internal',
    });
  }, [
    loading,
    jobsLoading,
    jobs.length,
    selectedJobId,
    visibleApplications.length,
    hasAnyInternalJob,
    globalInternalApplicationTotal,
    emptySurfaceKey,
    isExternal,
  ]);

  const handleResumeOpen = async (appId) => {
    trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.RESUME_OPEN_INTENT, {
      surface: 'applications_inbox',
      hasResume: true,
    });
    try {
      await openEmployerApplicationResume(appId);
    } catch {
      setStatusError(t('employer:resumeOpenFailed'));
    }
  };

  return (
    <>
      <SeoHead title={t('employer:applications')} description={t('employer:applicationsSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:applications')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-300 mb-6">{t('employer:applicationsInboxHint')}</p>

      <div className="mb-4 max-w-md min-w-0">
        <label htmlFor="employer-apps-job" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('employer:selectJob')}
        </label>
        <select
          id="employer-apps-job"
          value={selectedJobId || ''}
          onChange={(e) => setSelectedJobId(e.target.value || null)}
          disabled={jobsLoading}
          className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="">{t('employer:selectJobPlaceholder')}</option>
          {jobs.map((j) => (
            <option key={j._id} value={j._id}>
              {j.title}
              {j.applyType === 'external' || j.applicationsTracked === false
                ? ` (${t('employer:applyMethodExternal')})`
                : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedJobId && jobMeta && !isExternal ? (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm space-y-1">
          <p className="font-medium text-gray-900 dark:text-white break-words-safe">{jobMeta.title}</p>
          <p className="text-slate-600 dark:text-gray-300">
            {t('employer:applicationMethodLabel')}: {t('employer:applyMethodInternal')}
          </p>
          {submittedCount != null ? (
            <p className="text-slate-600 dark:text-gray-300">
              {t('employer:stridetoApplicationsCount', { count: submittedCount })}
            </p>
          ) : null}
          {jobMeta.status ? (
            <p className="text-slate-500">{t('employer:jobStatusLabel', { status: jobMeta.status })}</p>
          ) : null}
          <Link
            to={`/employer/jobs/${selectedJobId}/edit`}
            className="text-primary hover:underline inline-flex min-h-[44px] items-center text-sm"
          >
            {t('employer:viewJob')}
          </Link>
        </div>
      ) : null}

      {selectedJobId && !isExternal ? (
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-sm">
            {t('employer:status', { defaultValue: 'Status' })}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
            >
              <option value="">{t('common:all')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('employer:filterFrom')}
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
          </label>
          <label className="text-sm">
            {t('employer:filterTo')}
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 block min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
          </label>
        </div>
      ) : null}

      {jobs.length === 0 && !jobsLoading ? (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <p className="text-sm text-slate-600 dark:text-gray-300">{t('employer:noJobsYet')}</p>
          <Link to={ROUTES.EMPLOYER_POST_JOB} className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center">
            {t('employer:postAJob')}
          </Link>
        </div>
      ) : null}

      {!selectedJobId && hasAnyInternalJob && globalInternalApplicationTotal === 0 && !jobsLoading ? (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
          <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">{t('employer:globalNoApplicationsYet')}</p>
          <p className="text-sm text-slate-600 dark:text-gray-300">{t('employer:globalNoApplicationsHint')}</p>
          <div className="flex flex-wrap gap-4">
            <Link to={ROUTES.EMPLOYER_JOBS} className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center">
              {t('employer:manageJobs')}
            </Link>
            <Link to={ROUTES.EMPLOYER_POST_JOB} className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center">
              {t('employer:postAnotherOpportunity')}
            </Link>
          </div>
        </div>
      ) : null}

      {selectedJobId && isExternal ? (
        <div className="mb-4 p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-sm text-violet-900 dark:text-violet-100 space-y-2">
          <p className="font-medium">{t('employer:applyMethodExternal')}</p>
          <p>{externalDisclosureMessage()}</p>
          {jobMeta?.applicationLink ? (
            <a
              href={jobMeta.applicationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary dark:text-mint hover:underline inline-flex min-h-[44px] items-center"
            >
              {t('employer:openApplicationDestination')}
            </a>
          ) : null}
          {jobMeta?.applyEmail ? (
            <a
              href={`mailto:${jobMeta.applyEmail}`}
              className="block text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center"
            >
              {t('employer:openApplicationEmail')}: {jobMeta.applyEmail}
            </a>
          ) : null}
          <Link
            to={`/employer/jobs/${selectedJobId}/edit`}
            className="text-primary hover:underline inline-flex min-h-[44px] items-center"
          >
            {t('employer:viewJob')}
          </Link>
        </div>
      ) : null}

      {listTruncated ? (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm" role="status">
          {t('employer:applicationsListTruncated')}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      {statusError ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
          {statusError}
        </div>
      ) : null}
      {statusSuccess ? (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200 text-sm" role="status">
          {statusSuccess}
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-gray-300">{t('common:loading')}</div>
        ) : visibleApplications.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-gray-300 space-y-2">
            <p>{emptyMessage()}</p>
            {!selectedJobId || isExternal ? null : (
              <p className="text-xs text-slate-500">{t('employer:internalEmptyHint')}</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label={t('employer:applications')}>
            {visibleApplications.map((app) => (
              <li key={app._id} className="p-4 flex flex-wrap items-start justify-between gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white break-words-safe">
                    {app.candidate?.displayName || app.userId?.name || t('employer:applicant')}
                  </p>
                  {jobMeta?.title ? (
                    <p className="text-xs text-slate-500 mt-0.5 break-words-safe">{jobMeta.title}</p>
                  ) : null}
                  {app.candidate?.headline ? (
                    <p className="text-sm text-slate-500 break-words-safe">{app.candidate.headline}</p>
                  ) : null}
                  <p className="text-sm text-slate-600 dark:text-gray-300 break-all">{app.userId?.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {app.hasResume ? (
                      <span>{t('employer:resumeSubmitted')}</span>
                    ) : (
                      <span>{t('employer:noResumeIndicator')}</span>
                    )}
                    {app.hasCoverLetter ? (
                      <span>{t('employer:coverLetterSubmitted')}</span>
                    ) : null}
                  </div>
                  {app.hiringStage ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">{t('employer:hiringStageLabel')}:</span>
                      <StageBadge stage={app.hiringStage} />
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500" title={t('employer:historicalApplicationHint')}>
                      {t('employer:applicationStatusFallback', { status: statusLabel(app.status) })}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {t('employer:appliedOn', {
                      date: app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : '-',
                    })}
                  </p>
                  <div className="flex flex-wrap gap-x-4 mt-2">
                    <Link
                      to={applicationDetailPath(app._id)}
                      className="text-sm font-medium text-primary hover:underline inline-flex min-h-[44px] items-center"
                    >
                      {t('employer:reviewApplication')}
                    </Link>
                    <Link
                      to={`${ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES}/${app._id}`}
                      className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                    >
                      {t('employer:manageCandidateStages')}
                    </Link>
                    {app.hasResume ? (
                      <button
                        type="button"
                        onClick={() => handleResumeOpen(app._id)}
                        className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                      >
                        {t('employer:downloadResume')}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(app._id, s)}
                      disabled={app.status === s}
                      className="px-3 py-2 text-xs rounded-lg min-h-[44px] border border-gray-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      {t(`employer:${STATUS_ACTION_LABEL_KEYS[s]}`)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
