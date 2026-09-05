import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { webPageSchema, breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { buildCanonicalUrl } from '../../seo/config';
import { internshipsApi, savedApi } from '../../services/listingsService';
import { applicationsApi as oaApi } from '../../services/applicationsApi';
import { ROUTES } from '../../constants';
import { SaveButton } from '../../components/listings/SaveButton';
import { useActiveWorkspace } from '../../context/ActiveWorkspaceContext';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { StudentAuthorityNotice } from '../../components/auth/StudentAuthorityNotice';
import { useToast } from '../../context/ToastContext';
import { isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import { formatDate } from '../../utils/formatDate';
import { loginLocationState } from '../../utils/loginReturn.js';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import { EXTERNAL_APPLY_DISCLOSURE, NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';
import { formatLocationDisplay } from '@shared/international/location.js';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { KeyFacts } from '../../components/public/KeyFacts';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { PublicSourceSection } from '../../components/public/PublicSourceSection';
import {
  resolveInternshipApplicationLink,
  sourceSectionTitle,
} from '@shared/seo/sourceAuthority.js';
import { WORK_MODE_LABELS } from '@shared/publicDiscovery/publicTruth.js';
import { Alert } from '../../components/ui/Alerts';
import { RelatedResources } from '../../components/seo/RelatedResources';
import { ProtectedExternalApplicationLink } from '../../components/public/ProtectedExternalApplicationLink.jsx';

export default function InternshipDetail() {
  const { t } = useTranslation(['internships', 'common', 'navbar']);
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { canActAsStudent, isAuthenticated: workspaceAuth, realm } = useActiveWorkspace();
  const { studentProductEnabled } = useStudentProductEnabled();
  const studentWriteBlocked = workspaceAuth && realm !== 'student' && realm !== 'guest';
  const { toast } = useToast();
  const [internship, setInternship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);

  useEffect(() => {
    internshipsApi.get(idOrSlug).then(({ data }) => setInternship(data)).catch((e) => setError(e.response?.data?.error || t('internshipNotFound', { ns: 'internships' }))).finally(() => setLoading(false));
  }, [idOrSlug]);

  useEffect(() => {
    if (!studentProductEnabled || !internship) return;
    savedApi.get().then(({ data: d }) => {
      const ids = (d.savedInternships || []).map((i) => i._id);
      setSaved(ids.includes(internship._id));
    }).catch(() => {});
  }, [studentProductEnabled, internship]);

  const handleSaveToggle = async (id, save) => {
    if (!id || !studentProductEnabled) return;
    if (save) await internshipsApi.save(id);
    else await internshipsApi.unsave(id);
    setSaved(!!save);
  };

  const handleApply = async () => {
    if (studentWriteBlocked) return;
    if (!canActAsStudent) {
      navigate(ROUTES.LOGIN, { state: loginLocationState(location) });
      return;
    }
    if (!internship || applied) return;
    setApplying(true);
    try {
      await internshipsApi.apply(internship.slug || internship._id);
      setApplied(true);
    } catch (e) {
      if (e.response?.status === 400 && e.response?.data?.error?.includes('Already applied')) setApplied(true);
      else window.alert(e.response?.data?.error || t('applyFailed', { ns: 'internships' }));
    } finally {
      setApplying(false);
    }
  };

  const handleTrackApplication = async () => {
    if (!canActAsStudent || !internship?._id || !isOpportunityApplicationEnabled()) return;
    setTrackLoading(true);
    try {
      const { data: app } = await oaApi.create({
        opportunityType: 'internship',
        opportunityId: internship._id,
        source: internship.applyInPlatform ? 'platform' : 'external',
        title: internship.title,
        companyName: internship.organization || '',
        externalUrl: internship.applicationLink || '',
      });
      toast?.success?.(t('trackedSuccess', { ns: 'internships', defaultValue: 'Added to your application tracker' }));
      navigate(`${ROUTES.APPLICATIONS}/${app._id}`);
    } catch (err) {
      const existingId = err.response?.data?.applicationId || err.response?.data?.id;
      if (existingId) {
        navigate(`${ROUTES.APPLICATIONS}/${existingId}`);
        return;
      }
      navigate(`${ROUTES.APPLICATIONS_NEW}?opportunityId=${internship._id}&type=internship`);
    } finally {
      setTrackLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !internship) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('internshipNotFound', { ns: 'internships' })}</Alert>
        <Link to={ROUTES.INTERNSHIPS} className="text-primary dark:text-mint hover:underline mt-2 inline-block">{t('backToInternships', { ns: 'internships' })}</Link>
      </div>
    );
  }

  const canonicalPath = `${ROUTES.INTERNSHIPS}/${internship.slug || internship._id}`;
  const description = t('detailSeoDescription', {
    title: internship.title,
    organization: internship.organization,
    ns: 'internships',
  }) + (internship.duration ? `. ${internship.duration}` : '');
  const seoTitle = t('detailSeoTitle', { title: internship.title, ns: 'internships' });
  // SEO-P0B — internships carry no publication-authorization model at all: the
  // Internship record has no employer linkage and no authorized-publisher
  // workflow, so every internship on STRIDETO is an editorially curated
  // external opportunity. Curated opportunities must not claim Google for Jobs
  // eligibility on the employer's behalf, so this page emits ordinary WebPage
  // content and links to the official source instead of JobPosting. If an
  // employer-authorized internship workflow is ever built, it must go through
  // shared/seo/jobPostingEligibility.js like jobs do — not around it.
  const postingSchema = webPageSchema({
    name: internship.title,
    description,
    url: buildCanonicalUrl(canonicalPath),
  });

  const applicationLink = publicHttpUrlOrNull(internship.applicationLink);
  const locationLine = formatLocationDisplay(internship) || internship.location || null;
  const workModeLabel = internship.workMode && internship.workMode !== 'unspecified'
    ? (WORK_MODE_LABELS[internship.workMode] || internship.workMode)
    : null;
  const paidLabel = internship.isPaid === true
    ? 'Paid'
    : internship.isPaid === false
      ? 'Compensation not specified as paid'
      : null;

  const internshipFacts = [
    { label: t('organizationLabel', { ns: 'internships', defaultValue: 'Organization' }), value: internship.organization },
    { label: t('locationLabel', { ns: 'internships', defaultValue: 'Location' }), value: locationLine },
    { label: t('workModeLabel', { ns: 'internships', defaultValue: 'Work mode' }), value: workModeLabel },
    { label: t('durationLabel', { ns: 'internships', defaultValue: 'Duration' }), value: internship.duration },
    { label: t('deadlinePrefix', { ns: 'internships' }), value: internship.deadline ? formatDate(internship.deadline) : null },
    { label: t('typeLabel', { ns: 'internships', defaultValue: 'Type' }), value: internship.internshipType },
    { label: t('compensationLabel', { ns: 'internships', defaultValue: 'Compensation' }), value: paidLabel },
  ];

  const internshipSource = resolveInternshipApplicationLink(internship.applicationLink);

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={description}
        canonical={canonicalPath}
        jsonLd={combineSchemas(
          postingSchema,
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('internships', { ns: 'navbar' }), url: ROUTES.INTERNSHIPS },
            { name: internship.title, url: canonicalPath },
          ]),
        )}
      />
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <Link to={ROUTES.INTERNSHIPS} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">{t('backToInternshipsShort', { ns: 'internships' })}</Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white break-words-safe">{internship.title}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-1 break-words-safe">{internship.organization}</p>
            <div className="mt-2"><PublicTrustBadge kind={internship.authorityKind} label={internship.authorityLabel} /></div>
            <div className="mt-4">
              <KeyFacts facts={internshipFacts} headingId="internship-key-facts" />
            </div>
          </div>
          <SaveButton id={internship._id} saved={saved} onToggle={handleSaveToggle} />
        </div>

        {internship.skillset?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {internship.skillset.map((s) => (
              <span key={s} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">{s}</span>
            ))}
          </div>
        )}

        {internship.description && (
          <div className="mt-6 prose dark:prose-invert max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('description', { ns: 'common' })}</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{internship.description}</p>
          </div>
        )}

        {!internship.applyInPlatform && publicHttpUrlOrNull(internship.applicationLink) && (
          <p className="mt-4 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{EXTERNAL_APPLY_DISCLOSURE}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {studentWriteBlocked && internship.applyInPlatform ? <StudentAuthorityNotice /> : null}
          {internship.applyInPlatform && !studentWriteBlocked && (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || applied}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme disabled:opacity-50"
            >
              {applied ? t('applied', { ns: 'internships' }) : applying ? t('applying', { ns: 'internships' }) : t('applyOnPlatform', { ns: 'internships' })}
            </button>
          )}
          {publicHttpUrlOrNull(internship.applicationLink) && (
            <ProtectedExternalApplicationLink
              destination={applicationLink}
              entityType="internship"
              entityId={internship._id}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 dark:hover:bg-mint/10 btn-theme"
            >
              {t('applyCompanyPortal', { ns: 'internships' })}
            </ProtectedExternalApplicationLink>
          )}
          {canActAsStudent && isOpportunityApplicationEnabled() && (
            <button
              type="button"
              onClick={handleTrackApplication}
              disabled={trackLoading}
              className="inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 dark:hover:bg-mint/10 font-medium btn-theme disabled:opacity-50"
            >
              {trackLoading
                ? t('tracking', { ns: 'internships', defaultValue: 'Adding…' })
                : t('trackApplication', { ns: 'internships', defaultValue: 'Track application' })}
            </button>
          )}
        </div>

        <PublicSourceSection title={sourceSectionTitle(internshipSource?.level)}>
          <ProvenanceStrip
            authorityLabel={internship.authorityLabel}
            sourceLabel={internship.sourceWebsite}
            sourceUrl={internshipSource?.url}
            linkLabel={internshipSource?.label}
          />
        </PublicSourceSection>

        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">{NO_GUARANTEE_DISCLAIMER}</p>

        {(internship.related || []).length > 0 && (
          <section className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('similarInternships', { ns: 'internships', defaultValue: 'Similar internships' })}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {(internship.related || []).map((r) => (
                <Link
                  key={r._id}
                  to={`${ROUTES.INTERNSHIPS}/${r.slug || r._id}`}
                  className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition min-w-0"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white break-words-safe">{r.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 break-words-safe">{r.organization}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {Array.isArray(internship.relatedResources) && internship.relatedResources.length > 0 && (
          <RelatedResources
            title={t('careerResources', { ns: 'internships', defaultValue: 'Career resources' })}
            items={internship.relatedResources}
            maxItems={4}
            className="mt-8"
          />
        )}
      </div>
    </>
  );
}
