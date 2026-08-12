import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { PortalWelcomeBanner } from '../../components/welcome/PortalWelcomeBanner';
import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed';
import { useEmployerAuth } from '../../context/EmployerAuthContext';

const Card = ({ title, value, sub, to }) => {
  const inner = (
    <>
      <p className="text-sm text-slate-600 dark:text-gray-400 font-medium">{title}</p>
      <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mt-1 break-words">{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">{sub}</p>}
    </>
  );
  const cls = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm min-w-0 block';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
};

export default function EmployerDashboard() {
  const { t } = useTranslation(['employer', 'common']);
  const { employer } = useEmployerAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // A single in-flight guard both prevents duplicate simultaneous requests
    // (visibility + focus firing together) and, because only one request can
    // ever be pending at a time, makes a stale response overwriting a newer
    // one structurally impossible — there is never a second request for an
    // earlier one to race against.
    const loadDashboard = ({ background = false } = {}) => {
      if (document.hidden) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!background) setLoading(true);

      employerApi
        .dashboard()
        .then(({ data: d }) => {
          if (!mountedRef.current) return;
          setData(d);
          setLoadError(false);
        })
        .catch(() => {
          if (!mountedRef.current) return;
          if (!background) {
            // Initial load has no prior data to protect — fall back to the
            // existing safe zeroed state and surface the error banner.
            setLoadError(true);
            setData({
              activeJobs: 0,
              totalApplications: 0,
              totalViews: 0,
              shortlistedCandidates: 0,
              jobs: [],
              conversionRateLabel: 'n/a',
            });
          }
          // Background refresh failure: keep whatever metrics are already
          // rendered rather than clearing them to zero, and don't retry.
        })
        .finally(() => {
          inFlightRef.current = false;
          if (mountedRef.current && !background) setLoading(false);
        });
    };

    loadDashboard({ background: false });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadDashboard({ background: true });
    };
    const handleFocus = () => loadDashboard({ background: true });

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }

  const conversionDisplay = data?.conversionRateLabel ?? (data?.conversionRate != null ? `${data.conversionRate}%` : 'n/a');

  return (
    <>
      <SeoHead title={t('employer:dashboard')} description={t('employer:dashboardSeoDesc')} noindex />
      <PortalWelcomeBanner
        realm="employer"
        userId={employer?._id || employer?.employerId}
        displayName={employer?.companyName || employer?.contactName}
      />
      <AnnouncementFeed title="Employer announcements" className="mb-6" />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{t('employer:dashboardHeading')}</h1>
        <VerificationBadge level={data?.verificationLevel} verified={data?.verified} />
      </div>
      {loadError ? (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-300" role="status">
          {t('employer:dashboardLoadFailed')}
        </p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card title={t('employer:activeJobsCard')} value={data?.activeJobs ?? 0} sub={t('employer:activeJobsHint')} to={ROUTES.EMPLOYER_JOBS} />
        <Card
          title={t('employer:totalApplicationsCard')}
          value={data?.totalInternalApplications ?? data?.totalApplications ?? 0}
          sub={t('employer:internalApplicationsHint')}
          to={ROUTES.EMPLOYER_APPLICATIONS}
        />
        <Card title={t('employer:totalViewsCard')} value={data?.totalViews ?? 0} to={ROUTES.EMPLOYER_ANALYTICS} />
        <Card title={t('employer:shortlistedCard')} value={data?.shortlistedCandidates ?? 0} to={ROUTES.EMPLOYER_APPLICATIONS} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Card title={t('employer:draftJobsCard')} value={data?.draftJobs ?? 0} to={`${ROUTES.EMPLOYER_JOBS}?status=draft`} />
        <Card title={t('employer:pendingApprovalCard')} value={data?.pendingApprovalJobs ?? 0} to={`${ROUTES.EMPLOYER_JOBS}?status=pending`} />
        <Card title={t('employer:closedJobsCard')} value={data?.closedJobs ?? 0} to={`${ROUTES.EMPLOYER_JOBS}?status=closed`} />
        <Card title={t('employer:newApplicationsCard')} value={data?.newApplications ?? 0} sub={t('employer:last7Days')} to={ROUTES.EMPLOYER_APPLICATIONS} />
        <Card title={t('employer:conversionRate')} value={conversionDisplay} sub={t('employer:conversionInternalHint')} to={ROUTES.EMPLOYER_ANALYTICS} />
        <Card title={t('employer:totalJobsCard')} value={data?.totalJobs ?? 0} to={ROUTES.EMPLOYER_JOBS} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Card title={t('employer:interviewsCard')} value={data?.interviews ?? 0} to={ROUTES.EMPLOYER_INTERVIEWS} />
        <Card title={t('employer:unreadNotificationsCard')} value={data?.unreadNotifications ?? 0} to={ROUTES.EMPLOYER_NOTIFICATIONS} />
        <Card title={t('employer:verificationStateCard')} value={data?.verificationState || (data?.verified ? 'approved' : 'unverified')} to={ROUTES.EMPLOYER_VERIFICATION} />
        <Card
          title={t('employer:planQuotaCard')}
          value={data?.planSummary ? `${data.planSummary.dailyRemaining ?? '—'}` : '—'}
          sub={t('employer:planQuotaHint')}
          to={ROUTES.EMPLOYER_PLANS_USAGE}
        />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('employer:recentJobPosts')}</h2>
          {(data?.jobs || []).length > 0 ? (
            <span className="text-xs text-slate-500">{t('employer:recentJobsCount', { count: data.jobs.length })}</span>
          ) : null}
        </div>
        <div className="divide-y divide-gray-200 dark:border-gray-700">
          {(data?.jobs || []).length === 0 ? (
            <div className="p-8 text-center text-slate-600 dark:text-gray-300">
              {t('employer:noJobsYet')}{' '}
              <Link to={ROUTES.EMPLOYER_POST_JOB} className="text-primary hover:underline font-medium">
                {t('employer:postFirstJob')}
              </Link>
            </div>
          ) : (
            (data?.jobs || []).map((j) => (
              <div key={j._id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <Link
                    to={`${ROUTES.EMPLOYER_JOBS}?id=${j._id}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary break-words"
                  >
                    {j.title}
                  </Link>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mt-0.5">
                    {j.applicationsTracked === false || j.applications == null
                      ? t('employer:jobStatsExternal', {
                          views: j.views,
                          shortlisted: j.shortlisted,
                        })
                      : t('employer:jobStats', {
                          views: j.views,
                          applications: j.applications,
                          shortlisted: j.shortlisted,
                        })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
