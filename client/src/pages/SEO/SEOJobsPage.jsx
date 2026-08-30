import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, itemListSchema, combineSchemas } from '../../seo/schemas';
import { ROUTES } from '../../constants';
import { seoApi } from '../../services/listingsService';
import { HomeJobCard } from '../../components/listings/HomeListingCard';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { jobsApi, savedApi } from '../../services/listingsService';

export default function SEOJobsPage() {
  const { t } = useTranslation(['jobs', 'navbar']);
  const { slug: paramSlug } = useParams();
  const location = useLocation();
  const pathSlug = (location.pathname || '').replace(/^\//, '').split('?')[0];
  const slug = paramSlug || pathSlug;
  const { studentProductEnabled } = useStudentProductEnabled();
  const [meta, setMeta] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());

  const isCategory = ['government-jobs', 'private-jobs', 'internship-jobs'].includes(slug);
  const isLatestGov = pathSlug === 'latest-government-jobs';
  const sourceSlug = ['fpsc-jobs', 'nts-jobs', 'ppsc-jobs', 'wapda-jobs'].includes(pathSlug)
    ? pathSlug.replace(/-jobs$/, '')
    : null;

  useEffect(() => {
    if (!slug && !isLatestGov && !sourceSlug) return;
    let api;
    if (isLatestGov) api = () => seoApi.latestGovernmentJobs();
    else if (sourceSlug) api = () => seoApi.jobsBySource(sourceSlug);
    else if (isCategory) api = () => seoApi.jobsByCategory(slug);
    else api = () => seoApi.jobsIn(slug);
    api()
      .then(({ data }) => {
        setMeta(data.meta);
        setJobs(data.data || []);
      })
      .catch(() => setMeta({ title: t('jobs:seoFallbackTitle'), description: t('jobs:findJobsPakistan') }))
      .finally(() => setLoading(false));
  }, [slug, isCategory, isLatestGov, sourceSlug, t]);

  useEffect(() => {
    if (!studentProductEnabled) return;
    savedApi.get().then(({ data }) => setSavedIds(new Set((data.savedJobs || []).map((j) => j._id)))).catch(() => {});
  }, [studentProductEnabled]);

  const handleSave = async (id, save) => {
    if (save) await jobsApi.save(id);
    else await jobsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const canonical = meta?.canonical || (isLatestGov
    ? '/latest-government-jobs'
    : sourceSlug
      ? `/${sourceSlug}-jobs`
      : isCategory
        ? `/${slug}`
        : `/jobs-in-${slug}`);

  const pageTitle = meta?.title?.split('|')[0]?.trim() || (isCategory ? slug.replace(/-/g, ' ') : t('jobs:jobsInProvince', { province: slug }));
  const description = meta?.description || t('jobs:findJobsPakistan');

  return (
    <>
      <SeoHead
        title={meta?.title || pageTitle}
        description={description}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('navbar:home'), url: ROUTES.HOME },
            { name: t('jobs:breadcrumbJobs'), url: ROUTES.JOBS },
            { name: pageTitle, url: canonical },
          ]),
          collectionPageSchema({ name: pageTitle, description, url: canonical }),
          jobs.length > 0 && itemListSchema({ name: pageTitle, description, items: jobs })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {pageTitle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          <Link to={ROUTES.JOBS} className="text-primary dark:text-mint hover:underline text-sm mt-2 inline-block">{t('jobs:allJobs')}</Link>
        </div>
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : jobs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <HomeJobCard key={job._id} job={job} saved={savedIds.has(job._id)} onSaveToggle={handleSave} showBadge />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            {t('jobs:noJobsFound')}{' '}
            <Link to={ROUTES.JOBS} className="text-primary dark:text-mint">{t('jobs:browseAllJobs')}</Link>
          </p>
        )}
      </div>
    </>
  );
}
