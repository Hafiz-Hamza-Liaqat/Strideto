import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { DEFAULT_KEYWORDS } from '../../seo/config';
import { useAuth } from '../../context/AuthContext';
import { resumesApi } from '../../services/listingsService';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi } from '../../config/careerFeatureFlags';
import { ROUTES } from '../../constants';
import { defaultResume, normalizeResumeSkills } from './resumeDefaults';
import { TemplateSelector } from './TemplateSelector';
import { ResumeWizard } from './ResumeWizard';
import { ResumePreview } from './ResumePreview';
import { ResumeScore } from './ResumeScore';
import { ResumeDownload } from './ResumeDownload';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../../components/common/EmptyState';

export default function ResumeBuilder() {
  const { t } = useTranslation(['resume', 'common']);
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || searchParams.get('id');
  const optimizeForJobId = searchParams.get('optimizeForJob');
  const [resume, setResume] = useState(defaultResume);
  const [resumeId, setResumeId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const previewRef = useRef(null);
  const optimizeRequested = useRef(false);
  const { toast } = useToast();

  const [, setResumeSource] = useState(null);

  const mapViewToResume = (r) => ({
    title: r.title || t('resume:defaultTitle'),
    template: r.template || 'modern-professional',
    personalInfo: r.personalInfo || {},
    careerObjective: r.careerObjective || '',
    education: r.education || [],
    skills: normalizeResumeSkills(r.skills),
    experience: r.experience || [],
    projects: r.projects || [],
    certifications: r.certifications || [],
    languages: r.languages || [],
    references: r.references || [],
    awards: r.awards || [],
    volunteerExperience: r.volunteerExperience || [],
    publications: r.publications || [],
    interests: r.interests || [],
    professionalMemberships: r.professionalMemberships || [],
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadTalent = () =>
      talentApi.getResumeBuilder().then(({ data }) => {
        setResume(mapViewToResume(data));
        setResumeId(data.resumeVersionId || data.legacyResumeId || null);
        setResumeSource(data.source || 'talent-profile');
      });

    const loadLegacyById = () =>
      resumesApi.getById(editId).then(({ data }) => {
        const r = data;
        setResume(mapViewToResume(r));
        setResumeId(r._id);
        setResumeSource('legacy-resume');
      });

    if (shouldUseTalentProfileApi() && !editId) {
      setLoading(true);
      loadTalent()
        .catch(() => toast.error(t('resume:loadError')))
        .finally(() => setLoading(false));
      return;
    }

    if (!editId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    if (shouldUseTalentProfileApi()) {
      loadTalent()
        .catch(() => loadLegacyById())
        .catch(() => toast.error(t('resume:loadError')))
        .finally(() => setLoading(false));
    } else {
      loadLegacyById()
        .catch(() => toast.error(t('resume:loadError')))
        .finally(() => setLoading(false));
    }
  }, [editId, isAuthenticated, toast, t]);

  useEffect(() => {
    if (!optimizeForJobId || !isAuthenticated || optimizeRequested.current) return;
    optimizeRequested.current = true;
    const call = resumeId
      ? resumesApi.optimizeForJob(resumeId, optimizeForJobId)
      : resumesApi.optimizeForJob(null, optimizeForJobId, resume);
    call.then(({ data }) => setOptimizeResult(data)).catch(() => setOptimizeResult(null));
  }, [optimizeForJobId, isAuthenticated, resumeId, resume]);

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error(t('resume:loginToSave'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: resume.title,
        template: resume.template,
        personalInfo: resume.personalInfo,
        careerObjective: resume.careerObjective,
        education: resume.education,
        skills: normalizeResumeSkills(resume.skills),
        experience: resume.experience,
        projects: resume.projects,
        certifications: (resume.certifications || []).filter(Boolean),
        languages: (resume.languages || []).filter(Boolean),
        references: resume.references || [],
        awards: resume.awards || [],
        volunteerExperience: resume.volunteerExperience || [],
        publications: resume.publications || [],
        interests: (resume.interests || []).filter(Boolean),
        professionalMemberships: resume.professionalMemberships || [],
      };
      if (shouldUseTalentProfileApi()) {
        const { data } = await talentApi.saveResumeBuilder(payload);
        setResume(mapViewToResume(data));
        setResumeId(data.resumeVersionId || data.legacyResumeId || resumeId);
        setResumeSource(data.source || 'talent-profile');
        toast.success(t('resume:updatedSuccess'));
      } else if (resumeId) {
        await resumesApi.update(resumeId, payload);
        toast.success(t('resume:updatedSuccess'));
      } else {
        const { data } = await resumesApi.create(payload);
        setResumeId(data._id);
        setResumeSource('legacy-resume');
        toast.success(t('resume:savedSuccess'));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('resume:saveError'));
    } finally {
      setSaving(false);
    }
  };

  const fileName = (resume.personalInfo?.fullName || t('resume:defaultTitle')).replace(/\s+/g, '-') + '-Strideto';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title={t('resume:seoTitle')}
        description={t('resume:seoDescription')}
        canonical={ROUTES.RESUME_BUILDER}
        keywords={`resume builder, CV maker, ${DEFAULT_KEYWORDS}`}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('resume:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('resume:breadcrumbResume'), url: ROUTES.RESUME_BUILDER },
          ]),
          webPageSchema({
            name: t('resume:seoTitle'),
            description: t('resume:seoDescription'),
            url: ROUTES.RESUME_BUILDER,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 min-w-0 w-full">
        <Link to={ROUTES.DASHBOARD} className="text-primary dark:text-mint hover:underline text-sm mb-4 inline-block">{t('resume:backToDashboard')}</Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('resume:title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('resume:subtitle')}</p>

        {!resumeId && (
          <div className="mb-6">
            <EmptyState
              icon="📄"
              title="Build a professional resume"
              description="A professional resume improves your chances of success."
              actionLabel="Build Resume"
              actionTo={ROUTES.RESUME_BUILDER}
            />
          </div>
        )}

        {optimizeResult && (
          <div className="mb-6 p-4 rounded-xl border border-primary/30 dark:border-mint/30 bg-primary/5 dark:bg-mint/10">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('resume:optimizeFor', { jobTitle: optimizeResult.jobTitle })}</h3>
            {optimizeResult.missingKeywords?.length > 0 && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1 break-words">
                <strong>{t('resume:considerAdding')}</strong> {optimizeResult.missingKeywords.join(', ')}
              </p>
            )}
            {optimizeResult.suggestions?.map((s, i) => (
              <p key={i} className="text-sm text-gray-600 dark:text-gray-400">{s}</p>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-3 space-y-6 min-w-0">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('resume:resumeName')}</label>
                <input
                  type="text"
                  value={resume.title || ''}
                  onChange={(e) => setResume({ ...resume, title: e.target.value })}
                  placeholder={t('resume:resumeNamePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('resume:chooseTemplate')}</h2>
              <TemplateSelector value={resume.template} onChange={(tpl) => setResume({ ...resume, template: tpl })} />
            </div>
            <ResumeWizard
              resume={resume}
              onChange={setResume}
              stepIndex={stepIndex}
              setStepIndex={setStepIndex}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isAuthenticated}
                className="px-4 py-2.5 min-h-[44px] rounded-lg bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 dark:bg-mint dark:text-gray-900 dark:hover:bg-mint/90"
              >
                {saving ? t('common:saving') : resumeId ? t('resume:updateResume') : t('resume:saveResume')}
              </button>
              {!isAuthenticated && (
                <Link to={ROUTES.LOGIN} className="text-sm text-primary dark:text-mint hover:underline">
                  {t('resume:loginToSaveMultiple')}
                </Link>
              )}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <ResumePreview ref={previewRef} resume={resume} template={resume.template} />
            <ResumeScore resume={resume} />
            <ResumeDownload previewRef={previewRef} fileName={fileName} />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link to={ROUTES.RESUME_ANALYZER} className="text-primary dark:text-mint hover:underline text-sm">
            {t('resume:analyzeWithAi')}
          </Link>
        </div>
      </div>
    </>
  );
}
