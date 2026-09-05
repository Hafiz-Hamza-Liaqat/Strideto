import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { jobPostingSchema, breadcrumbSchema, combineSchemas, JOB_POSTING_SURFACES } from '../../seo/schemas';
import { jobsApi, savedApi, recentViewedApi, coverLetterApi, recommendationsApi, applicationsApi } from '../../services/listingsService';
import { applicationsApi as oaApi } from '../../services/applicationsApi';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi, isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import { ROUTES } from '../../constants';
import { useActiveWorkspace } from '../../context/ActiveWorkspaceContext';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { StudentAuthorityNotice } from '../../components/auth/StudentAuthorityNotice';
import { useToast } from '../../context/ToastContext';
import { SaveButton } from '../../components/listings/SaveButton';
import { PublicListingLogo } from '../../components/listings/PublicListingLogo';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { KeyFacts } from '../../components/public/KeyFacts';
import { PublicSourceSection } from '../../components/public/PublicSourceSection';
import {
  resolveJobProvenanceLink,
} from '@shared/seo/sourceAuthority.js';
import { formatDate } from '../../utils/formatDate';
import { useContentView } from '../../hooks/usePageView';
import { loginLocationState } from '../../utils/loginReturn.js';
import { ProtectedExternalApplicationLink } from '../../components/public/ProtectedExternalApplicationLink.jsx';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import {
  APPLICATION_MODE_LABELS,
  EXTERNAL_APPLY_DISCLOSURE,
  JOB_AVAILABILITY,
  NOT_SPECIFIED,
  WORK_MODE_LABELS,
  formatPublicOpenings,
  deriveJobWorkMode,
} from '@shared/publicDiscovery/publicTruth.js';
import { formatLocationDisplay } from '@shared/international/location.js';
import { RelatedResources } from '../../components/seo/RelatedResources';
import { normalizeJobSkills } from '@shared/jobs/jobSkills.js';
import { buildJobDiscoverySummary } from '@shared/jobs/jobDiscovery.js';

const JOB_TYPE_BADGE = {
  Government: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Private: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  Internship: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const ACTION_PRIMARY = 'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme disabled:opacity-50 w-full sm:w-auto';
const ACTION_SECONDARY = 'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 dark:hover:bg-mint/10 font-medium btn-theme disabled:opacity-50 w-full sm:w-auto';

function JobDiscoveryCard({ job, ctaLabel }) {
  const workMode = job.workMode || (job.remote ? 'remote' : job.hybrid ? 'hybrid' : '');
  const locationLine = formatLocationDisplay(job) || job.location || '';
  return (
    <Link
      to={`${ROUTES.JOBS}/${job.slug || job._id}`}
      className="interactive-card block p-4 min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <h3 className="font-semibold text-gray-900 dark:text-white break-words-safe">{job.title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 break-words-safe mt-0.5">{job.organization || job.company}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 break-words-safe">
        {[locationLine, workMode ? (WORK_MODE_LABELS[workMode] || job.type) : job.type, job.deadline ? formatDate(job.deadline) : null].filter(Boolean).join(' · ')}
      </p>
      {job.openingsCount ? (
        <p className="text-xs text-gray-500 mt-1">{job.openingsCount} opening{job.openingsCount === 1 ? '' : 's'}</p>
      ) : null}
      <span className="inline-flex mt-3 min-h-[44px] items-center text-sm font-medium text-primary dark:text-mint">
        {ctaLabel}
      </span>
    </Link>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 min-w-0">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-gray-700 dark:text-gray-300 break-words-safe">{children}</div>
    </section>
  );
}

export default function JobDetail() {
  const { t } = useTranslation(['jobs', 'common', 'navbar']);
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { canActAsStudent, isAuthenticated: workspaceAuth, realm, isHydrating } = useActiveWorkspace();
  const { studentProductEnabled } = useStudentProductEnabled();
  const studentWriteBlocked = workspaceAuth && realm !== 'student' && realm !== 'guest';
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
  const [shareStatus, setShareStatus] = useState('');
  const { toast } = useToast();

  useContentView('job', job?._id, 'job_view');

  useEffect(() => {
    jobsApi.get(slug).then(({ data }) => {
      setJob(data);
      if (studentProductEnabled && data?._id) recentViewedApi.record('job', data._id).catch(() => {});
    }).catch((err) => setError(err.response?.data?.error || t('failedToLoad', { ns: 'common' }))).finally(() => setLoading(false));
  }, [slug, studentProductEnabled, t]);

  useEffect(() => {
    if (!studentProductEnabled) return;
    savedApi.get().then(({ data: d }) => setSavedIds(new Set((d.savedJobs || []).map((j) => j._id)))).catch(() => {});
  }, [studentProductEnabled]);

  useEffect(() => {
    if (!studentProductEnabled || !job?._id) return;
    applicationsApi.getMy().then(({ data }) => {
      const list = data.data || [];
      const hasApplied = list.some((a) => (a.job?._id || a.job)?.toString() === job._id.toString());
      setApplied(hasApplied);
    }).catch(() => {});
  }, [studentProductEnabled, job?._id]);

  useEffect(() => {
    if (!studentProductEnabled || !shouldUseTalentProfileApi()) return;
    talentApi.getApplyKit().then(({ data }) => {
      setApplyKit(data);
      if (data?.resumeDocumentUrl) setSelectedDocUrl(data.resumeDocumentUrl);
    }).catch(() => setApplyKit(null));
  }, [studentProductEnabled]);

  useEffect(() => {
    if (!studentProductEnabled) return;
    recommendationsApi.get().then(({ data }) => setRecommended(data.jobs || [])).catch(() => setRecommended([]));
  }, [studentProductEnabled]);

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
    if (!canActAsStudent) return;
    if (!job || job.applyType !== 'internal') return;
    if (job.acceptingApplications === false) return;
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
    if (!canActAsStudent || !job?._id || !isOpportunityApplicationEnabled()) return;
    setTrackLoading(true);
    try {
      const external = job.applyType === 'external';
      const { data: app } = await oaApi.create({
        opportunityType: 'job',
        opportunityId: job._id,
        source: external ? 'external' : 'platform',
        title: job.title,
        companyName: job.organization || job.company || '',
        externalUrl: external ? (job.applicationLink || '') : '',
      });
      toast?.success?.(t('trackedSuccess', { ns: 'jobs', defaultValue: 'Added to your application tracker' }));
      navigate(`${ROUTES.APPLICATIONS}/${app._id}`);
    } catch (err) {
      const existingId = err.response?.data?.applicationId || err.response?.data?.id;
      if (existingId) {
        navigate(`${ROUTES.APPLICATIONS}/${existingId}`);
        return;
      }
      navigate(`${ROUTES.APPLICATIONS_NEW}?opportunityId=${job._id}&type=job`);
    } finally {
      setTrackLoading(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: job?.title, url });
        setShareStatus(t('shareCopied', { ns: 'jobs', defaultValue: 'Link ready to share' }));
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus(t('shareCopied', { ns: 'jobs', defaultValue: 'Link copied' }));
    } catch {
      setShareStatus('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8" role="status" aria-live="polite">
        <ListingCardSkeleton />
        <span className="sr-only">{t('loading', { ns: 'common' })}</span>
      </div>
    );
  }
  if (error || !job) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('jobNotFound', { ns: 'jobs' })}</Alert>
        <Link to={ROUTES.JOBS} className="text-primary dark:text-mint mt-4 inline-block">{t('backToJobs', { ns: 'jobs' })}</Link>
      </div>
    );
  }

  const related = job.related || [];
  const jobType = job.jobType || 'Private';
  const isExternal = job.applyType === 'external';
  const applicationLink = publicHttpUrlOrNull(job.applicationLink);
  const applyEmail = job.applyEmail || '';
  const openings = formatPublicOpenings(job.openingsCount);
  const workMode = deriveJobWorkMode(job) || 'unspecified';
  const availability = job.availability || JOB_AVAILABILITY.OPEN;
  const accepting = job.acceptingApplications !== false && availability === JOB_AVAILABILITY.OPEN;
  const locationLine = formatLocationDisplay(job) || job.location || NOT_SPECIFIED;
  const compensation = job.salaryRange
    ? [job.salaryRange, job.salaryCurrency].filter(Boolean).join(' ')
    : null;
  const posted = formatDate(job.publishedAt || job.createdAt) || null;
  const deadlineLabel = job.deadline ? formatDate(job.deadline) : null;
  const workModeLabel = WORK_MODE_LABELS[workMode];
  const employerName = job.organization || job.company || null;

  const canonicalPath = `${ROUTES.JOBS}/${job.slug || job._id}`;
  const fallbackDiscoveryDescription = buildJobDiscoverySummary(job) || t('detailSeoDescription', {
    title: job.title,
    organization: job.organization || job.company,
    ns: 'jobs',
  });
  const description = job.metaDescription || fallbackDiscoveryDescription;
  const seoTitle = job.seoTitle || t('detailSeoTitle', { title: job.title, ns: 'jobs' });

  const loginState = loginLocationState(location);

  const jobFacts = [
    { label: t('openingsLabel', { ns: 'jobs', defaultValue: 'Openings' }), value: openings.phrase },
    { label: t('applicationDeadline', { ns: 'jobs' }), value: deadlineLabel },
    { label: t('locationLabel', { ns: 'jobs', defaultValue: 'Location' }), value: locationLine !== NOT_SPECIFIED ? locationLine : null },
    { label: t('workModeLabel', { ns: 'jobs', defaultValue: 'Work mode' }), value: workModeLabel !== NOT_SPECIFIED ? workModeLabel : null },
    { label: t('typeLabel', { ns: 'jobs' }), value: job.type },
    { label: t('compensationLabel', { ns: 'jobs', defaultValue: 'Compensation' }), value: compensation },
    { label: t('posted', { ns: 'jobs' }), value: posted },
    {
      label: t('applicationModeLabel', { ns: 'jobs', defaultValue: 'Application' }),
      value: APPLICATION_MODE_LABELS[job.applyType] || APPLICATION_MODE_LABELS.external,
    },
    { label: t('experienceLabel', { ns: 'jobs' }), value: job.experience },
    { label: t('educationLabel', { ns: 'jobs' }), value: job.educationRequirement },
    {
      label: t('employerLabel', { ns: 'jobs', defaultValue: 'Employer' }),
      value: employerName,
    },
  ];

  const summaryFacts = (
    <KeyFacts
      title={t('summary', { ns: 'jobs', defaultValue: 'Summary' })}
      facts={jobFacts}
      headingId="job-key-facts"
    />
  );

  const jobProvenance = resolveJobProvenanceLink(job);

  const actions = (
    <div className="flex flex-col gap-3 min-w-0">
      {!accepting && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2" role="status">
          {availability === JOB_AVAILABILITY.DEADLINE_PASSED
            ? t('deadlinePassed', { ns: 'jobs', defaultValue: 'The application deadline has passed. This job is not accepting applications.' })
            : t('jobNotAccepting', { ns: 'jobs', defaultValue: 'This job is not accepting applications.' })}
        </p>
      )}
      {isExternal && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          {t('externalApplyLeavesStrideto', { ns: 'jobs', defaultValue: EXTERNAL_APPLY_DISCLOSURE })}
        </p>
      )}
      {isExternal && accepting && applicationLink && (
        <ProtectedExternalApplicationLink
          destination={applicationLink}
          entityType="job"
          entityId={job._id}
          className={ACTION_PRIMARY}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('applyOfficialWebsite', { ns: 'jobs' })}
        </ProtectedExternalApplicationLink>
      )}
      {isExternal && accepting && !applicationLink && applyEmail && (
        <ProtectedExternalApplicationLink
          destination={`mailto:${applyEmail}`}
          entityType="job"
          entityId={job._id}
          destinationType="email"
          className={ACTION_PRIMARY}
        >
          {t('applyByEmail', { ns: 'jobs', defaultValue: 'Apply by email' })}
        </ProtectedExternalApplicationLink>
      )}
      {!isExternal && canActAsStudent && accepting && (
        applied || applySuccess ? (
          <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">{t('applied', { ns: 'jobs' })}</span>
        ) : (
          <form onSubmit={handleInternalApply} className="flex flex-col gap-2 w-full min-w-0">
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
            <button type="submit" disabled={applyLoading} className={ACTION_PRIMARY}>
              {applyLoading ? t('submitting', { ns: 'jobs' }) : t('applyNow', { ns: 'jobs' })}
            </button>
          </form>
        )
      )}
      {studentWriteBlocked && !isExternal && accepting && (
        <StudentAuthorityNotice />
      )}
      {isHydrating && !canActAsStudent && !studentWriteBlocked && !isExternal && accepting && (
        <span className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-primary/60 text-white font-medium w-full sm:w-auto animate-pulse" aria-busy="true">
          {t('loading', { ns: 'common' })}
        </span>
      )}
      {!isHydrating && !canActAsStudent && !studentWriteBlocked && !isExternal && accepting && (
        <Link to={ROUTES.LOGIN} state={loginState} className={ACTION_PRIMARY}>{t('loginToApply', { ns: 'jobs' })}</Link>
      )}
      <SaveButton type="job" id={job._id} saved={savedIds.has(job._id)} onToggle={handleSaveToggle} />
      {canActAsStudent && isOpportunityApplicationEnabled() && (
        <button
          type="button"
          onClick={handleTrackApplication}
          disabled={trackLoading}
          className={ACTION_SECONDARY}
          title={isExternal ? t('trackExternalHint', { ns: 'jobs', defaultValue: 'Save this opportunity in your personal tracker. The employer will not be notified.' }) : undefined}
        >
          {trackLoading
            ? t('tracking', { ns: 'jobs', defaultValue: 'Adding…' })
            : isExternal
              ? t('trackExternalApplication', { ns: 'jobs', defaultValue: 'Mark as applied (personal tracker)' })
              : t('trackApplication', { ns: 'jobs', defaultValue: 'Track application' })}
        </button>
      )}
      {canActAsStudent && (
        <Link to={`${ROUTES.RESUME_BUILDER}?optimizeForJob=${job._id}`} className={ACTION_SECONDARY}>
          {t('optimizeResume', { ns: 'jobs' })}
        </Link>
      )}
      {canActAsStudent && (
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
          className={ACTION_SECONDARY}
        >
          {coverLetterLoading ? t('generating', { ns: 'jobs' }) : t('generateCoverLetter', { ns: 'jobs' })}
        </button>
      )}
      <button type="button" onClick={handleShare} className={ACTION_SECONDARY}>
        {t('share', { ns: 'common' })}
      </button>
      {shareStatus ? <p className="text-xs text-gray-500" role="status">{shareStatus}</p> : null}
    </div>
  );

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={description}
        canonical={canonicalPath}
        ogImage={job.image || undefined}
        jsonLd={combineSchemas(
          // SEO-P0B: only an employer-authorized, currently open job with complete
          // required fields emits JobPosting here; curated external jobs stay
          // ordinary indexable WebPage content with their official-source link.
          jobPostingSchema(job, { surface: JOB_POSTING_SURFACES.DETAIL }),
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('jobs', { ns: 'navbar' }), url: ROUTES.JOBS },
            { name: job.title, url: canonicalPath },
          ]),
        )}
      />
      <article className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 overflow-x-hidden">
        <Link to={ROUTES.JOBS} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">{t('backToJobs', { ns: 'jobs' })}</Link>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:gap-8 lg:items-start">
          <div className="min-w-0">
            <header className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row items-start gap-3">
                <PublicListingLogo
                  logoUrl={job.logoUrl}
                  label={job.organization || job.company || job.title}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg"
                />
                <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white break-words-safe min-w-0">{job.title}</h1>
                <span className={`text-xs font-medium px-2 py-1 rounded ${JOB_TYPE_BADGE[jobType] || JOB_TYPE_BADGE.Private}`}>
                  {jobType}
                </span>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 flex flex-wrap items-center gap-2 break-words-safe">
                {job.organization || job.company || NOT_SPECIFIED}
                {job.employerVerification && (
                  <VerificationBadge level={job.employerVerification.verificationLevel} verified={job.employerVerification.verified} />
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PublicTrustBadge kind={job.authorityKind} label={job.authorityLabel} />
              </div>
              <div className="mt-4 lg:hidden space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4 w-full">
                {summaryFacts}
                {actions}
              </div>
                </div>
              </div>
            </header>

            {coverLetter && (
              <section className="mt-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('generatedCoverLetter', { ns: 'jobs' })}</h2>
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans break-words-safe">{coverLetter}</pre>
              </section>
            )}

            {job.description ? (
              <Section title={t('aboutTheRole', { ns: 'jobs', defaultValue: 'About the role' })}>
                <p className="whitespace-pre-wrap">{job.description}</p>
              </Section>
            ) : null}

            {Array.isArray(job.responsibilities) && job.responsibilities.length > 0 ? (
              <Section title={t('responsibilities', { ns: 'jobs', defaultValue: 'Responsibilities' })}>
                <ul className="list-disc list-inside space-y-1">
                  {job.responsibilities.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </Section>
            ) : null}

            {Array.isArray(job.requirements) && job.requirements.length > 0 ? (
              <Section title={t('requirements', { ns: 'jobs' })}>
                <ul className="list-disc list-inside space-y-1">
                  {job.requirements.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </Section>
            ) : null}

            {normalizeJobSkills(job.skillsRequired).length > 0 ? (
              <Section title={t('skillsLabel', { ns: 'jobs', defaultValue: 'Skills' })}>
                <ul className="flex flex-wrap gap-2">
                  {normalizeJobSkills(job.skillsRequired).map((skill) => (
                    <li key={skill} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm">{skill}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {Array.isArray(job.benefits) && job.benefits.length > 0 ? (
              <Section title="Compensation / Benefits">
                <ul className="list-disc list-inside space-y-1">
                  {job.benefits.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </Section>
            ) : null}

            {job.locationEligibility ? (
              <Section title="Location Eligibility">
                <p className="whitespace-pre-wrap">{job.locationEligibility}</p>
              </Section>
            ) : null}

            {job.educationRequirement ? (
              <Section title={t('educationLabel', { ns: 'jobs' })}>
                <p>{job.educationRequirement}</p>
              </Section>
            ) : null}

            {job.experience ? (
              <Section title={t('experienceLabel', { ns: 'jobs' })}>
                <p>{job.experience}</p>
              </Section>
            ) : null}

            {job.applicationInstructions ? (
              <Section title={t('howToApply', { ns: 'jobs' })}>
                <p className="whitespace-pre-wrap">{job.applicationInstructions}</p>
              </Section>
            ) : null}

            <PublicSourceSection title={t('employerSource', { ns: 'jobs', defaultValue: 'Employer / source' })}>
              <ProvenanceStrip
                authorityLabel={job.authorityLabel}
                sourceLabel={job.sourceWebsite || (job.source === 'employer' ? 'Employer-posted on Strideto' : null)}
                sourceUrl={jobProvenance?.url}
                linkLabel={jobProvenance?.label}
              />
              {job.applicationsTracked === false && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('externalNotTracked', { ns: 'jobs', defaultValue: 'Applicant numbers are not tracked on Strideto for this listing.' })}</p>
              )}
            </PublicSourceSection>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-24 min-w-0 mt-0">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-5">
              {summaryFacts}
              {actions}
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('similarJobs', { ns: 'jobs' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <JobDiscoveryCard key={r._id} job={r} ctaLabel={t('viewJob', { ns: 'jobs', defaultValue: 'View Job' })} />
              ))}
            </div>
          </section>
        )}

        {recommended.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('recommendedLower', { ns: 'jobs' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {recommended.filter((r) => r._id !== job._id).slice(0, 4).map((r) => (
                <JobDiscoveryCard key={r._id} job={r} ctaLabel={t('viewJob', { ns: 'jobs', defaultValue: 'View Job' })} />
              ))}
            </div>
          </section>
        )}

        {Array.isArray(job.relatedResources) && job.relatedResources.length > 0 && (
          <RelatedResources
            title={t('careerResources', { ns: 'jobs', defaultValue: 'Career resources' })}
            items={job.relatedResources}
            maxItems={4}
          />
        )}
      </article>
    </>
  );
}
