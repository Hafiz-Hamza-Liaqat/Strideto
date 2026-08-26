import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { webPageSchema, breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { admissionsApi, savedApi, recentViewedApi } from '../../services/listingsService';
import { applicationsApi } from '../../services/applicationsApi';
import { ROUTES } from '../../constants';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { formatDate, daysUntil } from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import { useContentView } from '../../hooks/usePageView';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi, isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import { ApplyKitBanner } from '../../components/career/ApplyKitBanner';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import { APPLICATION_MODE_LABELS, EXTERNAL_APPLY_DISCLOSURE, NO_GUARANTEE_DISCLAIMER, NOT_SPECIFIED } from '@shared/publicDiscovery/publicTruth.js';
import { formatLocationDisplay } from '@shared/international/location.js';

export default function AdmissionDetail() {
  const { t } = useTranslation(['admissions', 'common', 'navbar', 'applications']);
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [applyKit, setApplyKit] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);

  useContentView('admission', item?._id, 'admission_view');

  useEffect(() => {
    admissionsApi.get(slug).then(({ data }) => {
      setItem(data);
      if (isAuthenticated && data?._id) recentViewedApi.record('admission', data._id).catch(() => {});
    }).catch((err) => setError(err.response?.data?.error || t('failedToLoad', { ns: 'common' }))).finally(() => setLoading(false));
  }, [slug, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    savedApi.get().then(({ data: d }) => setSavedIds(new Set((d.savedAdmissions || []).map((a) => a._id)))).catch(() => {});
    if (shouldUseTalentProfileApi()) {
      talentApi.getApplyKit().then(({ data }) => setApplyKit(data)).catch(() => setApplyKit(null));
    }
  }, [isAuthenticated]);

  const handleSaveToggle = async (id, save) => {
    if (save) await admissionsApi.save(id);
    else await admissionsApi.unsave(id);
    setSavedIds((prev) => { const next = new Set(prev); save ? next.add(id) : next.delete(id); return next; });
  };

  const handleTrackApplication = async () => {
    if (!item?._id) return;
    setTrackLoading(true);
    try {
      const { data: app } = await applicationsApi.create({
        opportunityType: 'admission',
        opportunityId: item._id,
        source: (item.link || item.applyLink) ? 'external' : 'platform',
        title: item.program,
        companyName: item.institution || '',
      });
      navigate(`${ROUTES.APPLICATIONS}/${app._id}`);
    } catch (err) {
      if (err.response?.data?.applicationId) {
        navigate(`${ROUTES.APPLICATIONS}/${err.response.data.applicationId}`);
        return;
      }
      navigate(`${ROUTES.APPLICATIONS_NEW}?opportunityId=${item._id}&type=admission`);
    } finally {
      setTrackLoading(false);
    }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('admissionNotFound', { ns: 'admissions' })}</Alert>
        <Link to={ROUTES.ADMISSIONS} className="text-primary dark:text-mint mt-4 inline-block">{t('backToAdmissions', { ns: 'admissions' })}</Link>
      </div>
    );
  }

  const related = item.related || [];
  const days = daysUntil(item.deadline);
  const canonicalPath = `${ROUTES.ADMISSIONS}/${item.slug || item._id}`;
  const description = item.description || `${item.program} at ${item.institution}`;
  const seoTitle = t('detailSeoTitle', { program: item.program, ns: 'admissions' });

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={description}
        canonical={canonicalPath}
        ogType="website"
        jsonLd={combineSchemas(
          webPageSchema({ name: item.program, description, url: canonicalPath }),
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('admissions', { ns: 'navbar' }), url: ROUTES.ADMISSIONS },
            { name: item.program, url: canonicalPath },
          ]),
        )}
      />
      <article className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <Link to={ROUTES.ADMISSIONS} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">{t('backToAdmissions', { ns: 'admissions' })}</Link>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white break-words-safe">{item.program}</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-1 break-words-safe">{item.institution}</p>
              {formatLocationDisplay(item) ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatLocationDisplay(item)}</p>
              ) : null}
              <div className="mt-2"><PublicTrustBadge kind={item.authorityKind} label={item.authorityLabel} /></div>
              <p className="text-sm text-gray-500 mt-1">{APPLICATION_MODE_LABELS[item.applicationMode] || NOT_SPECIFIED}</p>
              {item.department && <p className="text-sm text-gray-500">{item.department}</p>}
              {item.session && <p className="text-sm text-gray-500">{item.session}</p>}
              {item.deadline && (
                <p className="mt-2">
                  {days != null && days >= 0 ? (
                    <span className="inline-block px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-medium">{t('daysUntilDeadline', { count: days, ns: 'admissions' })}</span>
                  ) : (
                    <span className="text-gray-500">{t('deadline', { ns: 'common' })}: {formatDate(item.deadline)}</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <SaveButton type="admission" id={item._id} saved={savedIds.has(item._id)} onToggle={handleSaveToggle} />
              {publicHttpUrlOrNull(item.link || item.applyLink) && (
                <a href={publicHttpUrlOrNull(item.link || item.applyLink)} className="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme" target="_blank" rel="noopener noreferrer">{t('applyOfficialWebsite', { ns: 'jobs', defaultValue: 'Apply on official website' })}</a>
              )}
              {isAuthenticated && isOpportunityApplicationEnabled() && (
                <button
                  type="button"
                  onClick={handleTrackApplication}
                  disabled={trackLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg border-2 border-primary text-primary dark:text-mint hover:bg-mint/20 btn-theme text-sm font-medium disabled:opacity-50"
                >
                  {trackLoading ? t('applications:create.submitting') : t('applications:createApplication')}
                </button>
              )}
            </div>
          </div>
          {isAuthenticated && <ApplyKitBanner kit={applyKit} />}
          {item.description && (
            <section className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('description', { ns: 'common' })}</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.description}</p>
            </section>
          )}
          {item.eligibility && item.eligibility.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('eligibility', { ns: 'admissions' })}</h2>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">{item.eligibility.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </section>
          )}
          {item.applicationInstructions && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('howToApply', { ns: 'admissions' })}</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.applicationInstructions}</p>
            </section>
          )}
          {publicHttpUrlOrNull(item.link || item.applyLink) && (
            <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">{EXTERNAL_APPLY_DISCLOSURE}</p>
          )}
          <div className="mt-6">
            <ProvenanceStrip authorityLabel={item.authorityLabel} officialUrl={item.sourceUrl || item.link} />
          </div>
          <p className="mt-4 text-xs text-gray-500">{NO_GUARANTEE_DISCLAIMER}</p>
        </div>
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('relatedAdmissions', { ns: 'admissions' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link key={r._id} to={`${ROUTES.ADMISSIONS}/${r.slug || r._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{r.program}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{r.institution}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(r.deadline)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
