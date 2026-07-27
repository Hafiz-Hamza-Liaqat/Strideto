import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { jobPostingSchema, breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { jobsApi, savedApi, recentViewedApi, coverLetterApi, recommendationsApi, applicationsApi } from '../../services/listingsService';
import { applicationsApi as oaApi } from '../../services/applicationsApi';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi, isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { formatDate } from '../../utils/formatDate';
import { useContentView } from '../../hooks/usePageView';

const JOB_TYPE_BADGE = {
  Government: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Private: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  Internship: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export default function JobDetail() {
  const { t } = useTranslation(['jobs', 'common', 'navbar']);
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [coverLetter, setCoverLetter] = useState(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [applied, setApplied] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyKit, setApplyKit] = useState(null);
  const [selectedDocUrl, setSelectedDocUrl] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const { toast } = useToast();

  useContentView('job', job?._id, 'job_view');

  useEffect(() => {
    jobsApi.get(slug).then(({ data }) => {
      setJob(data);
      if (isAuthenticated && data?._id) recentViewedApi.record('job', data._id).catch(() => {});
    }).catch((err) => setError(err.response?.data?.error || t('failedToLoad', { ns: 'common' }))).finally(() => setLoading(false));
  }, [slug, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    savedApi.get().then(({ data: d }) => setSavedIds(new Set((d.savedJobs || []).map((j) => j._id)))).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !job?._id) return;
    applicationsApi.getMy().then(({ data }) => {
      const list = data.data || [];
      const hasApplied = list.some((a) => (a.job?._id || a.job)?.toString() === job._id.toString());
      setApplied(hasApplied);
    }).catch(() => {});
  }, [isAuthenticated, job?._id]);

  useEffect(() => {
    if (!isAuthenticated || !shouldUseTalentProfileApi()) return;
    talentApi.getApplyKit().then(({ data }) => {
      setApplyKit(data);
      if (data?.resumeDocumentUrl) setSelectedDocUrl(data.resumeDocumentUrl);
    }).catch(() => setApplyKit(null));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    recommendationsApi.get().then(({ data }) => setRecommended(data.jobs || [])).catch(() => setRecommended([]));
  }, [isAuthenticated]);

  const handleSaveToggle = async (id, save) => {
    if (save) await jobsApi.save(id);
    else await jobsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleInternalApply = async (e) => {
    e.preventDefault();
    if (!job || job.applyType !== 'internal') return;
    setApplyLoading(true);
    setApplySuccess(false);
    try {
      const formData = new FormData();
      if (fileInputRef.current?.files?.[0]) {
        formData.append('resume', fileInputRef.current.files[0]);
      } else if (selectedDocUrl) {
        formData.append('resumeURL', selectedDocUrl);
        formData.append('useProfileResume', '1');
      } else {
        formData.append('useProfileResume', '0');
      }
      const { data } = await jobsApi.apply(job._id, formData);
      setApplySuccess(true);
      setApplied(true);
      const trackerId = data?.opportunityApplicationId;
      if (trackerId && isOpportunityApplicationEnabled()) {
        navigate(`${ROUTES.APPLICATIONS}/${trackerId}`, {
          replace: false,
          state: { fromApply: true, message: data?.message },
        });
        return;
      }
      if (isOpportunityApplicationEnabled()) {
        navigate(ROUTES.APPLICATIONS, { replace: false });
      }
    } catch (err) {
      window.alert(err.response?.data?.error || t('applicationFailed', { ns: 'jobs' }));
    } finally {
      setApplyLoading(false);
    }
  };

  const handleTrackApplication = async () => {
    if (!job?._id || !isOpportunityApplicationEnabled()) return;
    setTrackLoading(true);
    try {
      const external = job.applyType === 'external';
      const { data: app } = await oaApi.create({
        opportunityType: 'job',
        opportunityId: job._id,
        source: external ? 'external' : 'platform',
        title: job.title,
        companyName: job.organization || job.company || '',
        externalUrl: external ? (job.applicationLink || job.sourceUrl || '') : '',
      });
      toast?.success?.(t('trackedSuccess', { ns: 'jobs', defaultValue: 'Added to your application tracker' }));
      navigate(`${ROUTES.APPLICATIONS}/${app._id}`);
    } catch (err) {
      const existingId = err.response?.data?.applicationId || err.response?.data?.id;
      if (existingId) {
        navigate(`${ROUTES.APPLICATIONS}/${existingId}`);
        return;
      }
      // Fallback: open prefilled form if create failed
      navigate(`${ROUTES.APPLICATIONS_NEW}?opportunityId=${job._id}&type=job`);
    } finally {
      setTrackLoading(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('jobNotFound', { ns: 'jobs' })}</Alert>
        <Link to={ROUTES.JOBS} className="text-primary dark:text-mint mt-4 inline-block">{t('backToJobs', { ns: 'jobs' })}</Link>
      </div>
    );
  }

  const related = job.related || [];
  const jobType = job.jobType || 'Private';
  const isExternal = job.applyType === 'external';
  const applicationLink = job.applicationLink || job.sourceUrl;
  const applyEmail = job.applyEmail || '';

  const canonicalPath = `${ROUTES.JOBS}/${job.slug || job._id}`;
  const description = job.description || t('detailSeoDescription', {
    title: job.title,
    organization: job.organization || job.company,
    ns: 'jobs',
  });
  const seoTitle = t('detailSeoTitle', { title: job.title, ns: 'jobs' });

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={description}
        canonical={canonicalPath}
        ogImage={job.image || undefined}
        jsonLd={combineSchemas(
          jobPostingSchema(job),
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('jobs', { ns: 'navbar' }), url: ROUTES.JOBS },
            { name: job.title, url: canonicalPath },
          ]),
        )}
      />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <Link to={ROUTES.JOBS} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">{t('backToJobs', { ns: 'jobs' })}</Link>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white break-words-safe">{job.title}</h1>
                <span className={`text-xs font-medium px-2 py-1 rounded ${JOB_TYPE_BADGE[jobType] || JOB_TYPE_BADGE.Private}`}>
                  {jobType}
                </span>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
                {job.organization || job.company}
                {job.employerVerification && (
                  <VerificationBadge level={job.employerVerification.verificationLevel} verified={job.employerVerification.verified} />
                )}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {[job.province || job.location, job.city, job.category, job.type].filter(Boolean).join(' · ')}
              </p>
              {job.educationRequirement && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  <strong>{t('educationLabel', { ns: 'jobs' })}:</strong> {job.educationRequirement}
                </p>
              )}
              {job.experience && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  <strong>{t('experienceLabel', { ns: 'jobs' })}:</strong> {job.experience}
                </p>
              )}
              {job.deadline && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  {t('applicationDeadline', { ns: 'jobs' })}: {formatDate(job.deadline)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:max-w-[min(100%,28rem)] lg:justify-end">
              <SaveButton type="job" id={job._id} saved={savedIds.has(job._id)} onToggle={handleSaveToggle} />
              {isAuthenticated && (
                <Link
                  to={`${ROUTES.RESUME_BUILDER}?optimizeForJob=${job._id}`}
                  className="inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 dark:hover:bg-mint/10 font-medium btn-theme"
                >
                  {t('optimizeResume', { ns: 'jobs' })}
                </Link>
              )}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={async () => {
                    setCoverLetterLoading(true);
                    setCoverLetter(null);
                    try {
                      const { data } = await coverLetterApi.generate(job._id);
                      setCoverLetter(data.coverLetter);
                    } catch (e) {
                      window.alert(e.response?.data?.error || t('generateFailed', { ns: 'jobs' }));
                    } finally {
                      setCoverLetterLoading(false);
                    }
                  }}
                  disabled={coverLetterLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 dark:hover:bg-mint/10 font-medium disabled:opacity-50 btn-theme"
                >
                  {coverLetterLoading ? t('generating', { ns: 'jobs' }) : t('generateCoverLetter', { ns: 'jobs' })}
                </button>
              )}
              {isExternal && (
                <p className="w-full text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  {t('externalApplyLeavesStrideto', {
                    ns: 'jobs',
                    defaultValue:
                      'This job uses an external application process. Completing it happens outside Strideto, so employers will not see your submission in the Strideto applicant dashboard.',
                  })}
                </p>
              )}
              {isExternal && applicationLink && (
                <a href={applicationLink} className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme" target="_blank" rel="noopener noreferrer">
                  {t('applyOfficialWebsite', { ns: 'jobs' })}
                </a>
              )}
              {isExternal && !applicationLink && applyEmail && (
                <a
                  href={`mailto:${applyEmail}`}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme"
                >
                  {t('applyByEmail', { ns: 'jobs', defaultValue: 'Apply by email' })}
                </a>
              )}
              {isAuthenticated && isOpportunityApplicationEnabled() && (
                <button
                  type="button"
                  onClick={handleTrackApplication}
                  disabled={trackLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 dark:hover:bg-mint/10 font-medium btn-theme disabled:opacity-50"
                  title={
                    isExternal
                      ? t('trackExternalHint', {
                          ns: 'jobs',
                          defaultValue: 'Save this opportunity in your personal tracker. The employer will not be notified.',
                        })
                      : undefined
                  }
                >
                  {trackLoading
                    ? t('tracking', { ns: 'jobs', defaultValue: 'Adding…' })
                    : isExternal
                      ? t('trackExternalApplication', { ns: 'jobs', defaultValue: 'Mark as applied (personal tracker)' })
                      : t('trackApplication', { ns: 'jobs', defaultValue: 'Track application' })}
                </button>
              )}
              {!isExternal && isAuthenticated && (
                <>
                  {applied || applySuccess ? (
                    <span className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">{t('applied', { ns: 'jobs' })}</span>
                  ) : (
                    <form onSubmit={handleInternalApply} className="flex flex-col gap-2 w-full">
                      {applyKit?.documents?.length > 0 && (
                        <label className="text-sm text-gray-600 dark:text-gray-400 flex flex-col gap-1">
                          <span>{t('profileResume', { ns: 'jobs', defaultValue: 'Use profile document' })}</span>
                          <select
                            value={selectedDocUrl}
                            onChange={(e) => setSelectedDocUrl(e.target.value)}
                            className="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5"
                          >
                            <option value="">{t('uploadInstead', { ns: 'jobs', defaultValue: 'Upload a file instead' })}</option>
                            {applyKit.documents.filter((d) => d.url).map((d) => (
                              <option key={d._id} value={d.url}>{d.label || d.documentType}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {!selectedDocUrl && (
                        <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-white file:text-sm" />
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="submit" disabled={applyLoading} className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme disabled:opacity-50">
                          {applyLoading ? t('submitting', { ns: 'jobs' }) : t('applyNow', { ns: 'jobs' })}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
              {!isAuthenticated && !isExternal && (
                <Link to={ROUTES.LOGIN} className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme">{t('loginToApply', { ns: 'jobs' })}</Link>
              )}
              {applicationLink && (
                <a href={applicationLink} className="inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 btn-theme" target="_blank" rel="noopener noreferrer">
                  {t('officialWebsite', { ns: 'jobs' })}
                </a>
              )}
            </div>
            </div>
            {coverLetter && (
              <section className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('generatedCoverLetter', { ns: 'jobs' })}</h2>
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans break-words-safe">{coverLetter}</pre>
              </section>
            )}
          </div>
          {job.description && (
            <section className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('description', { ns: 'common' })}</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{job.description}</p>
            </section>
          )}
          {job.requirements && job.requirements.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('requirements', { ns: 'jobs' })}</h2>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </section>
          )}
          {job.applicationInstructions && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('howToApply', { ns: 'jobs' })}</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{job.applicationInstructions}</p>
            </section>
          )}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('share', { ns: 'common' })}:</span>
            <button type="button" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">{t('shareTwitter', { ns: 'jobs' })}</button>
            <button type="button" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">{t('shareLinkedIn', { ns: 'jobs' })}</button>
            <button type="button" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">{t('shareWhatsApp', { ns: 'jobs' })}</button>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('similarJobs', { ns: 'jobs' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link key={r._id} to={`${ROUTES.JOBS}/${r.slug || r._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md card-hover">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{r.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{r.organization || r.company}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.province || r.location} · {formatDate(r.deadline)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recommended.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('recommendedLower', { ns: 'jobs' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {recommended.filter((r) => r._id !== job._id).slice(0, 4).map((r) => (
                <Link key={r._id} to={`${ROUTES.JOBS}/${r.slug || r._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md card-hover">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{r.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{r.organization || r.company}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.province || r.location} · {formatDate(r.deadline)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
