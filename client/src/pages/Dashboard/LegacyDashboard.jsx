import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { Link } from 'react-router-dom';
import { dashboardApi, applicationsApi, referralsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Chatbot } from '../../components/chatbot/Chatbot';
import { ProfileCompletionCard } from '../../components/profile/ProfileCompletionCard';
import { ResumeEncouragementBanner } from '../../components/profile/ResumeEncouragementBanner';

/** Legacy monolithic dashboard — used when VITE_CAREER_DASHBOARD_ENABLED=0 */
export default function LegacyDashboard() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [dashboard, setDashboard] = useState(null);
  const [applications, setApplications] = useState([]);
  const [referralData, setReferralData] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    dashboardApi
      .get()
      .then(({ data }) => {
        setDashboard(data);
        setResumes(data.resumes || []);
      })
      .catch((err) => setError(err.response?.data?.error || t('dashboard:failedLoad')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    applicationsApi.getMy().then(({ data }) => setApplications(data.data || [])).catch(() => setApplications([]));
  }, []);
  useEffect(() => {
    referralsApi.getMy().then(({ data }) => setReferralData(data)).catch(() => setReferralData(null));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 min-w-0 w-full">
        <SeoHead title={t('dashboard:seoTitle')} description={t('dashboard:seoDescriptionShort')} noindex />
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid sm:grid-cols-2 gap-4">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 min-w-0 w-full">
        <SeoHead title={t('dashboard:seoTitle')} noindex />
        <p className="text-red-600 dark:text-red-400">{error || t('dashboard:couldNotLoad')}</p>
      </div>
    );
  }

  const { user: profile, saved, recentlyViewed, trending, notifications } = dashboard;
  const savedJobs = saved?.savedJobs || [];
  const savedScholarships = saved?.savedScholarships || [];
  const savedAdmissions = saved?.savedAdmissions || [];
  const savedInternships = saved?.savedInternships || [];
  const savedIntlScholarships = saved?.savedIntlScholarships || [];
  const recentJobs = recentlyViewed?.jobs || [];
  const recentScholarships = recentlyViewed?.scholarships || [];
  const recentAdmissions = recentlyViewed?.admissions || [];
  const trendingJobs = trending?.jobs || [];
  const trendingScholarships = trending?.scholarships || [];
  const trendingAdmissions = trending?.admissions || [];
  const notifList = notifications || [];

  const quickLinks = [
    { to: ROUTES.APPLICATIONS, label: t('dashboard:myApplications'), primary: true },
    { to: ROUTES.RESUME_BUILDER, label: t('dashboard:resumeBuilder'), outline: true },
    { to: ROUTES.RESUME_ANALYZER, label: t('dashboard:resumeScanner'), outline: true },
    { to: ROUTES.CAREER_GUIDANCE, label: t('dashboard:careerGuidance') },
    { to: ROUTES.EXAM_PREP, label: t('dashboard:examPreparation'), outline: true },
    { to: ROUTES.INTERNSHIPS, label: t('dashboard:internshipsTrainings') },
    { to: ROUTES.WEBINARS, label: t('dashboard:webinars') },
    { to: ROUTES.INTL_SCHOLARSHIPS, label: t('dashboard:intlScholarships') },
    { to: ROUTES.BADGES_LEADERBOARD, label: t('dashboard:badgesLeaderboard'), amber: true },
  ];

  return (
    <>
      <SeoHead title={t('dashboard:seoTitle')} description={t('dashboard:seoDescription')} noindex />

      <div className="max-w-5xl mx-auto px-4 py-8 min-w-0 w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('dashboard:title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('dashboard:welcomeBack', { name: profile?.name || profile?.email })}
          {profile?.headline ? (
            <span className="block text-sm text-gray-500 dark:text-gray-500 mt-1">{profile.headline}</span>
          ) : null}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-4">
            <ResumeEncouragementBanner />
          </div>
          <ProfileCompletionCard />
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {quickLinks.map(({ to, label, primary, outline, amber }) => (
            <Link
              key={to}
              to={to}
              className={
                primary
                  ? 'inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover btn-theme text-sm font-medium'
                  : outline
                    ? 'inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 btn-theme text-sm font-medium'
                    : amber
                      ? 'inline-flex items-center px-4 py-2 rounded-lg border border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-medium'
                      : 'inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium'
              }
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {notifList.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:alertsNotifications')}</h2>
                <ul className="space-y-2">
                  {notifList.slice(0, 5).map((n) => (
                    <li key={n._id}>
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <p className="font-medium text-gray-900 dark:text-white">{n.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{n.message}</p>
                        {n.link && (
                          <a href={n.link} className="text-sm text-primary dark:text-mint mt-2 inline-block hover:underline">
                            {t('dashboard:learnMore')}
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {resumes.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard:myResumes')}</h2>
                  <Link to={ROUTES.RESUME_BUILDER} className="text-sm text-primary dark:text-mint hover:underline">
                    {t('dashboard:createNew')}
                  </Link>
                </div>
                <ul className="space-y-2 mb-6">
                  {resumes.slice(0, 5).map((r) => (
                    <li key={r._id}>
                      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <span className="font-medium text-gray-900 dark:text-white">{r.title || t('dashboard:defaultResumeTitle')}</span>
                        <Link to={`${ROUTES.RESUME_BUILDER}?edit=${r._id}`} className="text-sm text-primary dark:text-mint hover:underline">
                          {t('dashboard:edit')}
                        </Link>
                        <Link to={`${ROUTES.RESUME_BUILDER}?edit=${r._id}`} className="text-sm text-gray-600 dark:text-gray-400 hover:underline">
                          {t('dashboard:downloadOpenPdf')}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard:savedListings')}</h2>
                <Link to={ROUTES.SAVED_JOBS} className="text-sm text-primary dark:text-mint hover:underline">
                  {t('dashboard:viewAllArrow')}
                </Link>
              </div>
              {savedJobs.length + savedScholarships.length + savedAdmissions.length + (savedInternships?.length || 0) + (savedIntlScholarships?.length || 0) === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dashboard:noSavedListings')}</p>
              ) : (
                <ul className="space-y-2">
                  {savedJobs.slice(0, 3).map((j) => (
                    <li key={j._id}>
                      <Link to={`${ROUTES.JOBS}/${j.slug || j._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{j.title}</span>
                        <span className="text-gray-500 dark:text-gray-400"> · {j.organization || j.company}</span>
                      </Link>
                    </li>
                  ))}
                  {savedScholarships.slice(0, 2).map((s) => (
                    <li key={s._id}>
                      <Link to={`${ROUTES.SCHOLARSHIPS}/${s.slug || s._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{s.title}</span>
                        <span className="text-gray-500 dark:text-gray-400"> · {s.provider}</span>
                      </Link>
                    </li>
                  ))}
                  {savedAdmissions.slice(0, 2).map((a) => (
                    <li key={a._id}>
                      <Link to={`${ROUTES.ADMISSIONS}/${a.slug || a._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{a.program}</span>
                        <span className="text-gray-500 dark:text-gray-400"> · {a.institution}</span>
                      </Link>
                    </li>
                  ))}
                  {(savedInternships || []).slice(0, 2).map((i) => (
                    <li key={i._id}>
                      <Link to={`${ROUTES.INTERNSHIPS}/${i.slug || i._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{i.title}</span>
                        <span className="text-gray-500 dark:text-gray-400"> · {i.organization}</span>
                      </Link>
                    </li>
                  ))}
                  {(savedIntlScholarships || []).slice(0, 2).map((s) => (
                    <li key={s._id}>
                      <Link to={`${ROUTES.INTL_SCHOLARSHIPS}/${s._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{s.title}</span>
                        <span className="text-gray-500 dark:text-gray-400"> · {s.country}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {applications.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:appliedJobs')}</h2>
                <ul className="space-y-2">
                  {applications.slice(0, 5).map((a) => (
                    <li key={a._id}>
                      <Link to={`${ROUTES.JOBS}/${a.job?.slug || a.job?._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{a.job?.title}</span>
                        <span className="text-gray-500 dark:text-gray-400"> · {a.job?.organization}</span>
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">{a.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:recentlyViewed')}</h2>
              {(recentJobs.length + recentScholarships.length + recentAdmissions.length) === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dashboard:noRecentlyViewed')}</p>
              ) : (
                <ul className="space-y-2">
                  {recentJobs.slice(0, 2).map((j) => (
                    <li key={j._id}>
                      <Link to={`${ROUTES.JOBS}/${j.slug || j._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        {j.title} · {j.organization || j.company}
                      </Link>
                    </li>
                  ))}
                  {recentScholarships.slice(0, 2).map((s) => (
                    <li key={s._id}>
                      <Link to={`${ROUTES.SCHOLARSHIPS}/${s.slug || s._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        {s.title} · {s.provider}
                      </Link>
                    </li>
                  ))}
                  {recentAdmissions.slice(0, 2).map((a) => (
                    <li key={a._id}>
                      <Link to={`${ROUTES.ADMISSIONS}/${a.slug || a._id}`} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                        {a.program} · {a.institution}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:recommendedOpportunities')}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[...trendingJobs.slice(0, 2), ...trendingScholarships.slice(0, 2), ...trendingAdmissions.slice(0, 2)].map((item) => {
                  const isAdmission = item.program && item.institution;
                  const isJob = (item.company || item.organization) && !isAdmission;
                  const isScholarship = item.provider && item.title && !isAdmission;
                  const slug = item.slug || item._id;
                  const to = isJob ? `${ROUTES.JOBS}/${slug}` : isScholarship ? `${ROUTES.SCHOLARSHIPS}/${slug}` : `${ROUTES.ADMISSIONS}/${slug}`;
                  const title = isJob ? item.title : isScholarship ? item.title : item.program;
                  const sub = isJob ? (item.organization || item.company) : isScholarship ? item.provider : item.institution;
                  return (
                    <Link key={item._id} to={to} className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">{title}</span>
                      <span className="text-gray-500 dark:text-gray-400"> · {sub}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <Chatbot className="mb-6" />
            {referralData && (
              <section className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:referralStats')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('dashboard:referralInvite')}</p>
                <p className="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all text-gray-800 dark:text-gray-200">{referralData.referralLink}</p>
                <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                  {t('dashboard:referred')}: <strong>{referralData.referralCount || 0}</strong> · {t('dashboard:points')}: <strong>{referralData.totalPoints || 0}</strong>
                </p>
              </section>
            )}
            <section className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:leaderboardAchievements')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('dashboard:leaderboardDesc')}</p>
              <Link to={ROUTES.BADGES_LEADERBOARD} className="inline-block text-sm text-primary dark:text-mint hover:underline font-medium">{t('dashboard:viewLeaderboard')}</Link>
            </section>
            <section className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:profileOverview')}</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">{t('dashboard:province')}</dt>
                  <dd className="text-gray-900 dark:text-white">{profile?.province || t('dashboard:none')}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">{t('dashboard:interests')}</dt>
                  <dd className="text-gray-900 dark:text-white">{(profile?.interests || []).length ? profile.interests.join(', ') : t('dashboard:none')}</dd>
                </div>
              </dl>
              <Link to={ROUTES.PROFILE} className="mt-3 inline-block text-sm text-primary dark:text-mint hover:underline">
                {t('dashboard:editProfile')}
              </Link>
            </section>

            <section className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:notificationSettings')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('dashboard:notificationSettingsDesc')}</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${profile?.notifications?.email ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} aria-hidden />
                  {t('dashboard:emailAlerts')} {profile?.notifications?.email ? t('dashboard:on') : t('dashboard:off')}
                </li>
              </ul>
              <Link to={ROUTES.PROFILE} className="mt-3 inline-block text-sm text-primary dark:text-mint hover:underline">
                {t('dashboard:updateInProfile')}
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
