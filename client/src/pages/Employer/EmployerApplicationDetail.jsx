import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import {
  trackEmployerApplicantEvent,
  EMPLOYER_APPLICANT_ACTIONS,
} from '../../components/employer/applicant/employerApplicantAnalytics';
import { openEmployerApplicationResume } from '../../utils/employerApplicationResume';
import { EmployerApplicationCommunication } from '../../components/applications/ApplicationCommunicationPanel';

function applicationDetailPath(id) {
  return `${ROUTES.EMPLOYER_APPLICATIONS}/${id}`;
}

export default function EmployerApplicationDetail() {
  const { t } = useTranslation(['employer', 'common']);
  const { applicationId } = useParams();
  const [application, setApplication] = useState(null);
  const [jobMeta, setJobMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusSuccess, setStatusSuccess] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [pendingStatus, setPendingStatus] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const openedRef = useRef(false);

  const statusLabel = (s) => {
    const key = LEGACY_STATUS_LABEL_KEYS[s];
    return key ? t(`employer:${key}`, { defaultValue: s }) : s;
  };

  const loadDetail = useCallback(() => {
    if (!applicationId) return;
    setLoading(true);
    setError('');
    employerApi
      .getApplication(applicationId)
      .then(({ data }) => {
        setApplication(data.data || null);
        setJobMeta(data.job || null);
        setError('');
      })
      .catch((err) => {
        setApplication(null);
        setJobMeta(null);
        setError(err.response?.data?.error || t('employer:applicationDetailLoadFailed'));
      })
      .finally(() => setLoading(false));
  }, [applicationId, t]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (loading || !application || openedRef.current) return;
    openedRef.current = true;
    trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.APPLICATION_OPENED, {
      surface: 'application_detail',
      applicationMethod: 'internal',
      hasResume: Boolean(application.hasResume),
      hasCoverLetter: Boolean(application.hasCoverLetter),
    });
  }, [loading, application]);

  useEffect(() => {
    if (!pendingStatus) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPendingStatus(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingStatus]);

  const applicantName =
    application?.candidate?.displayName || application?.userId?.name || t('employer:applicant');
  const applicantEmail = application?.userId?.email || '';

  const performStatusUpdate = async (status) => {
    if (!application || statusUpdating) return;
    setStatusError('');
    setStatusSuccess('');
    setStatusUpdating(true);
    const previousStatus = application.status;
    trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.STATUS_INTENT, {
      surface: 'application_detail',
      statusFrom: previousStatus,
      statusTo: status,
    });
    try {
      const { data } = await employerApi.updateApplicationStatus(application._id, status);
      const nextStatus = data.application?.status || status;
      const nextStage = data.hiringStage ?? application.hiringStage;
      setApplication((prev) =>
        prev ? { ...prev, status: nextStatus, hiringStage: nextStage } : prev
      );
      setStatusSuccess(t('employer:statusUpdateSuccess'));
      trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.STATUS_UPDATED, {
        surface: 'application_detail',
        statusFrom: previousStatus,
        statusTo: nextStatus,
      });
      loadDetail();
    } catch (err) {
      setStatusError(err.response?.data?.error || t('employer:statusUpdateFailed'));
    } finally {
      setStatusUpdating(false);
      setPendingStatus(null);
    }
  };

  const requestStatusUpdate = (status) => {
    if (application?.status === status) return;
    if (status === 'rejected') {
      setPendingStatus(status);
      return;
    }
    performStatusUpdate(status);
  };

  const handleResumeOpen = async () => {
    setResumeError('');
    trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.RESUME_OPEN_INTENT, {
      surface: 'application_detail',
      hasResume: true,
    });
    try {
      await openEmployerApplicationResume(application._id);
    } catch {
      setResumeError(t('employer:resumeOpenFailed'));
    }
  };

  const backToListHref = jobMeta?._id
    ? `${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${jobMeta._id}`
    : ROUTES.EMPLOYER_APPLICATIONS;

  if (loading) {
    return (
      <>
        <SeoHead title={t('employer:reviewApplication')} description={t('employer:applicationsSeoDesc')} noindex />
        <div className="p-8 text-center text-slate-600 dark:text-gray-300">{t('common:loading')}</div>
      </>
    );
  }

  if (error || !application) {
    return (
      <>
        <SeoHead title={t('employer:reviewApplication')} description={t('employer:applicationsSeoDesc')} noindex />
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
            {error || t('employer:applicationDetailLoadFailed')}
          </div>
          <Link to={ROUTES.EMPLOYER_APPLICATIONS} className="text-primary hover:underline inline-flex min-h-[44px] items-center">
            {t('employer:backToApplications')}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title={t('employer:reviewApplication')} description={t('employer:applicationsSeoDesc')} noindex />

      <nav className="mb-4 text-sm">
        <Link to={backToListHref} className="text-primary hover:underline inline-flex min-h-[44px] items-center">
          {t('employer:backToApplications')}
        </Link>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 min-w-0">
        <div className="flex-1 min-w-0 space-y-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white break-words-safe">
              {applicantName}
            </h1>
            {application.candidate?.headline ? (
              <p className="text-sm text-slate-500 mt-1 break-words-safe">{application.candidate.headline}</p>
            ) : null}
            <p className="text-sm text-slate-600 dark:text-gray-300 mt-1 break-all">{applicantEmail}</p>
          </header>

          <section aria-labelledby="application-overview-heading" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 id="application-overview-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
              {t('employer:applicationOverview')}
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">{t('employer:appliedOnLabel')}</dt>
                <dd className="text-gray-900 dark:text-white">
                  {application.appliedDate
                    ? new Date(application.appliedDate).toLocaleString()
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('employer:applicationMethodLabel')}</dt>
                <dd className="text-gray-900 dark:text-white">{t('employer:applyMethodInternal')}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="resume-heading" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 id="resume-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
              {t('employer:resumeSection')}
            </h2>
            {application.hasResume ? (
              <>
                <button
                  type="button"
                  onClick={handleResumeOpen}
                  className="inline-flex min-h-[44px] items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                >
                  {t('employer:openResume')}
                </button>
                {resumeError ? (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                    {resumeError}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-600 dark:text-gray-300">{t('employer:noResumeSubmitted')}</p>
            )}
          </section>

          {application.hasCoverLetter ? (
            <section aria-labelledby="cover-letter-heading" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 id="cover-letter-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                {t('employer:coverLetterSection')}
              </h2>
              <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words-safe">
                {application.coverLetter}
              </div>
            </section>
          ) : null}

          {application.note ? (
            <section aria-labelledby="note-heading" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 id="note-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                {t('employer:applicationNoteSection')}
              </h2>
              <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words-safe">
                {application.note}
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="communication-heading"
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
          >
            <h2 id="communication-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
              {t('employer:communicationSectionTitle')}
            </h2>
            <EmployerApplicationCommunication
              applicationId={application._id}
              communicationApi={{
                list: (appId, params) => employerApi.listApplicationCommunication(appId, params),
                sendMessage: (appId, body) => employerApi.sendApplicationMessage(appId, body),
                createInterviewInvitation: (appId, body) =>
                  employerApi.createApplicationInterviewInvitation(appId, body),
              }}
            />
          </section>

          <p className="text-xs text-slate-500">{t('employer:applicantPrivacyHint')}</p>
        </div>

        <aside className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('employer:jobContext')}</p>
              <p className="font-medium text-gray-900 dark:text-white mt-1 break-words-safe">
                {jobMeta?.title || t('employer:applicant')}
              </p>
              {jobMeta?.status ? (
                <p className="text-xs text-slate-500 mt-1">
                  {t('employer:jobStatusLabel', { status: jobMeta.status })}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{t('employer:currentStatus')}</p>
              {application.hiringStage ? (
                <StageBadge stage={application.hiringStage} />
              ) : (
                <p className="text-sm text-gray-900 dark:text-white">
                  {t('employer:applicationStatusFallback', { status: statusLabel(application.status) })}
                </p>
              )}
            </div>

            {statusSuccess ? (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200 text-sm" role="status">
                {statusSuccess}
              </div>
            ) : null}
            {statusError ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
                {statusError}
              </div>
            ) : null}

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{t('employer:updateStatus')}</p>
              <div className="flex flex-col gap-2">
                {EMPLOYER_SETTABLE_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={application.status === s || statusUpdating}
                    onClick={() => requestStatusUpdate(s)}
                    className="w-full px-3 py-2 text-sm rounded-lg min-h-[44px] border border-gray-200 dark:border-gray-600 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t(`employer:${STATUS_ACTION_LABEL_KEYS[s]}`)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">{t('employer:statusChangeNotifyHint')}</p>
            </div>

            <Link
              to={`${ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES}/${application._id}`}
              className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
            >
              {t('employer:manageCandidateStages')}
            </Link>
          </div>
        </aside>
      </div>

      {pendingStatus === 'rejected' ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full shadow-xl">
            <h2 id="reject-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('employer:confirmRejectTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-gray-300 mt-2">
              {t('employer:confirmRejectWithNotify')}
            </p>
            <div className="flex flex-wrap gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className="px-4 py-2 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => performStatusUpdate('rejected')}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {t('employer:actionReject')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export { applicationDetailPath };
