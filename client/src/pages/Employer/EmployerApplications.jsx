import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';

const STATUS_OPTIONS = ['shortlisted', 'rejected', 'interview', 'hired'];

export default function EmployerApplications() {
  const { t } = useTranslation(['employer', 'common']);
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobMeta, setJobMeta] = useState(null);
  const [tracked, setTracked] = useState(true);
  const [apiMessage, setApiMessage] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(jobId);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');

  const statusLabel = (s) => t(`employer:status${s.charAt(0).toUpperCase()}${s.slice(1)}`, { defaultValue: s });

  useEffect(() => {
    setJobsLoading(true);
    employerApi
      .getJobs({})
      .then(({ data }) => setJobs(data.data || []))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
  }, []);

  useEffect(() => {
    if (jobId) setSelectedJobId(jobId);
  }, [jobId]);

  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);
  const selectedJobIdRef = useRef(selectedJobId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  // A job switch always wins over whatever the previous job's request is
  // doing (force: true, below) — its late response is still discarded by the
  // seq check here, so it can never overwrite the newly-selected job's data.
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
          setError('');
        })
        .catch((err) => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;
          if (!background) {
            setApplications([]);
            setJobMeta(null);
            setError(err.response?.data?.error || t('employer:applicationsLoadFailed'));
          }
          // Background refresh failure: keep the currently rendered list and job meta untouched.
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

  const updateStatus = async (appId, status) => {
    setStatusError('');
    try {
      await employerApi.updateApplicationStatus(appId, status);
      setApplications((prev) => prev.map((a) => (a._id === appId ? { ...a, status } : a)));
      // Optimistic update above keeps the row responsive; a background refetch
      // then reconciles the list/counts against the server without flicker.
      loadApplications({ background: true, force: true });
    } catch (err) {
      setStatusError(err.response?.data?.error || t('employer:statusUpdateFailed'));
    }
  };

  const emptyMessage = () => {
    if (!selectedJobId) return t('employer:selectJobToViewApplications');
    if (isExternal) return apiMessage || t('employer:externalAppsNotVisible');
    return t('employer:noApplicationsYet');
  };

  return (
    <>
      <SeoHead title={t('employer:applications')} description={t('employer:applicationsSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-6">
        {t('employer:applications')}
      </h1>
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

      {jobs.length === 0 && !jobsLoading ? (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <p className="text-sm text-slate-600 dark:text-gray-300">{t('employer:noJobsYet')}</p>
          <Link to={ROUTES.EMPLOYER_POST_JOB} className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center">
            {t('employer:postAJob')}
          </Link>
        </div>
      ) : null}

      {selectedJobId && isExternal ? (
        <div className="mb-4 p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-sm text-violet-900 dark:text-violet-100 space-y-2">
          <p className="font-medium">{t('employer:applyMethodExternal')}</p>
          <p>{apiMessage || t('employer:externalAppsNotVisible')}</p>
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-gray-300">{t('common:loading')}</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-gray-300 space-y-2">
            <p>{emptyMessage()}</p>
            {!selectedJobId || isExternal ? null : (
              <p className="text-xs text-slate-500">{t('employer:internalEmptyHint')}</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {applications.map((app) => (
              <div key={app._id} className="p-4 flex flex-wrap items-start justify-between gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white break-words-safe">
                    {app.candidate?.displayName || app.userId?.name || t('employer:applicant')}
                  </p>
                  {app.candidate?.headline && (
                    <p className="text-sm text-slate-500 break-words-safe">{app.candidate.headline}</p>
                  )}
                  <p className="text-sm text-slate-600 dark:text-gray-300 break-all">{app.userId?.email}</p>
                  {app.candidate?.skills?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1 break-words-safe">{app.candidate.skills.join(' · ')}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {t('employer:appliedOn', {
                      date: app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : '-',
                    })}{' '}
                    · {t('employer:statusLabel', { status: statusLabel(app.status) })}
                  </p>
                  {app.resumeURL && (
                    <a
                      href={app.resumeURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline mt-1 inline-flex min-h-[44px] items-center"
                    >
                      {t('employer:downloadResume')}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(app._id, s)}
                      disabled={app.status === s}
                      className={`px-3 py-2 text-xs rounded-lg min-h-[44px] ${
                        app.status === s
                          ? 'bg-primary text-white'
                          : 'border border-gray-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
