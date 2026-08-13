import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS } from '../../seo/config';
import { ROUTES } from '../../constants';
import { GlobalSearch } from '../../components/search/GlobalSearch';
import { trendingApi, jobsApi, scholarshipsApi, admissionsApi, savedApi, recommendationsApi, blogsApi, monetizationApi } from '../../services/listingsService';
import { useAuth } from '../../context/AuthContext';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { AdHost } from '../../components/ads';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import { useSiteContent } from '../../context/SiteContentContext';
import { isC61TestMarker } from '../../utils/cmsCorruption';
import {
  resolvePersonaBucket,
} from '../../personalization/layoutPersonalization';
import { HomePersonalizedBody } from '../../components/home/HomePersonalizedBody';
import { HomeHeroSkeleton } from '../../components/home/HomeHeroSkeleton';

const TRENDING_JOBS_LIMIT = 8;
const SCHOLARSHIPS_LIMIT = 6;
const ADMISSIONS_LIMIT = 6;
const BLOG_LIMIT = 4;

const FOREIGN_STUDY_COUNTRIES = [
  { name: 'Turkey', path: ROUTES.INTL_SCHOLARSHIPS, query: '?country=TR' },
  { name: 'Germany', path: ROUTES.INTL_SCHOLARSHIPS, query: '?country=DE' },
  { name: 'China', path: ROUTES.INTL_SCHOLARSHIPS, query: '?country=CN' },
  { name: 'Hungary', path: ROUTES.INTL_SCHOLARSHIPS, query: '?country=HU' },
  { name: 'UK', path: ROUTES.INTL_SCHOLARSHIPS, query: '?country=GB' },
  { name: 'Canada', path: ROUTES.INTL_SCHOLARSHIPS, query: '?country=CA' },
];

export default function Home() {
  const { t } = useTranslation(['home', 'common', 'navbar']);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();
  const persona = resolvePersonaBucket(user, isEmployer);
  const { homepage, banners, hasResolved } = useSiteContent();
  const [trendingJobs, setTrendingJobs] = useState([]);
  const [latestScholarships, setLatestScholarships] = useState([]);
  const [admissionDeadlines, setAdmissionDeadlines] = useState([]);
  const [recommended, setRecommended] = useState({ jobs: [], scholarships: [], admissions: [] });
  const [blogs, setBlogs] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [loadingBlogs, setLoadingBlogs] = useState(true);
  const [savedIds, setSavedIds] = useState({ jobs: new Set(), scholarships: new Set(), admissions: new Set() });
  const [countryCode, setCountryCode] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');

  const searchCategories = useMemo(() => [
    { value: 'all', label: t('home:allOpportunities'), type: '' },
    { value: 'jobs', label: t('navbar:jobs'), type: 'job', listing: ROUTES.JOBS },
    { value: 'internships', label: t('navbar:internships'), listing: ROUTES.INTERNSHIPS },
    { value: 'scholarships', label: t('navbar:scholarships'), type: 'scholarship', listing: ROUTES.SCHOLARSHIPS },
    { value: 'admissions', label: t('navbar:admissions'), type: 'admission', listing: ROUTES.ADMISSIONS },
    { value: 'programs', label: t('home:programs'), listing: ROUTES.PROGRAM_EXPLORER },
  ], [t]);

  const studentResources = useMemo(() => {
    const cms = homepage?.sections?.studentResources;
    if (cms?.enabled === false) return null;
    if (cms?.items?.length) {
      return cms.items.map((item) => ({
        label: item.label,
        to: item.path || ROUTES.HOME,
        icon: item.icon || '📄',
        description: item.description || '',
      }));
    }
    return [
      { label: t('home:resourceResumeBuilder'), to: ROUTES.RESUME_BUILDER, icon: '📄', description: t('home:resourceResumeBuilderDesc') },
      { label: t('home:resourceCareerGuidance'), to: ROUTES.CAREER_GUIDANCE, icon: '💡', description: t('home:resourceCareerGuidanceDesc') },
      { label: t('home:resourceExamPrep'), to: ROUTES.EXAM_PREP, icon: '📚', description: t('home:resourceExamPrepDesc') },
      { label: t('home:resourceInternships'), to: ROUTES.INTERNSHIPS, icon: '🎯', description: t('home:resourceInternshipsDesc') },
    ];
  }, [homepage, t]);

  const foreignStudyCountries = useMemo(() => {
    const cms = homepage?.sections?.foreignStudyCountries;
    if (cms?.enabled === false) return null;
    if (cms?.items?.length) {
      return cms.items.map((item) => ({
        name: item.name,
        path: item.path || ROUTES.INTL_SCHOLARSHIPS,
        query: item.query || '',
      }));
    }
    return FOREIGN_STUDY_COUNTRIES;
  }, [homepage]);

  useEffect(() => {
    Promise.all([
      monetizationApi.featuredJobs().then((r) => {
        const featured = r.data?.data || r.data || [];
        if (featured.length) setTrendingJobs(featured.slice(0, TRENDING_JOBS_LIMIT));
        else return trendingApi.jobs().then((res) => setTrendingJobs((res.data?.data || res.data || []).slice(0, TRENDING_JOBS_LIMIT)));
      }).catch(() =>
        trendingApi.jobs().then((r) => setTrendingJobs((r.data?.data || r.data || []).slice(0, TRENDING_JOBS_LIMIT))).catch(() => setTrendingJobs([]))
      ),
      scholarshipsApi.list({ limit: SCHOLARSHIPS_LIMIT }).then((r) => setLatestScholarships(r.data?.data || r.data || [])).catch(() => setLatestScholarships([])),
      admissionsApi.list({ limit: ADMISSIONS_LIMIT, sort: 'deadline' }).then((r) => setAdmissionDeadlines(r.data?.data || r.data || [])).catch(() => setAdmissionDeadlines([])),
    ]).finally(() => setLoadingTrending(false));
  }, []);

  useEffect(() => {
    jobsApi.list({ limit: TRENDING_JOBS_LIMIT, sort: 'newest', ...(countryCode && { countryCode }) }).then((r) => setTrendingJobs(r.data?.data || r.data || [])).catch(() => {});
  }, [countryCode]);

  useEffect(() => {
    if (!isAuthenticated) return;
    savedApi.get().then(({ data }) => {
      setSavedIds({
        jobs: new Set((data.savedJobs || []).map((j) => j._id)),
        scholarships: new Set((data.savedScholarships || []).map((s) => s._id)),
        admissions: new Set((data.savedAdmissions || []).map((a) => a._id)),
      });
    }).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingRecommended(true);
    recommendationsApi.get().then(({ data }) => {
      setRecommended({
        jobs: data.jobs || [],
        scholarships: data.scholarships || [],
        admissions: data.admissions || [],
      });
    }).catch(() => setRecommended({ jobs: [], scholarships: [], admissions: [] })).finally(() => setLoadingRecommended(false));
  }, [isAuthenticated]);

  useEffect(() => {
    blogsApi.list({ limit: BLOG_LIMIT, status: 'published' }).then((r) => setBlogs((r.data?.data || r.data || []).slice(0, BLOG_LIMIT))).catch(() => setBlogs([])).finally(() => setLoadingBlogs(false));
  }, []);

  const selectedCategory = searchCategories.find((c) => c.value === searchCategory);
  const searchTypeFilter = selectedCategory?.type || '';

  const handleSearchNavigate = (path) => {
    const selected = searchCategories.find((c) => c.value === searchCategory);
    if (selected?.listing && selected.value !== 'all') {
      const dest = new URL(selected.listing, window.location.origin);
      if (path.startsWith(ROUTES.SEARCH)) {
        const src = new URL(path, window.location.origin);
        const q = src.searchParams.get('q');
        if (q) dest.searchParams.set(selected.value === 'programs' ? 'search' : 'search', q);
      }
      if (countryCode) {
        dest.searchParams.set(selected.value === 'programs' ? 'country' : 'countryCode', countryCode);
      }
      navigate(`${dest.pathname}${dest.search}`);
      return;
    }
    if (searchTypeFilter && path.startsWith(ROUTES.SEARCH)) {
      const url = new URL(path, window.location.origin);
      url.searchParams.set('type', searchTypeFilter);
      if (countryCode) url.searchParams.set('countryCode', countryCode);
      navigate(`${url.pathname}${url.search}`);
      return;
    }
    navigate(path);
  };

  const handleSaveJob = async (id, save) => {
    if (save) await jobsApi.save(id);
    else await jobsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev.jobs);
      if (save) next.add(id);
      else next.delete(id);
      return { ...prev, jobs: next };
    });
  };
  const handleSaveScholarship = async (id, save) => {
    if (save) await scholarshipsApi.save(id);
    else await scholarshipsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev.scholarships);
      if (save) next.add(id);
      else next.delete(id);
      return { ...prev, scholarships: next };
    });
  };
  const handleSaveAdmission = async (id, save) => {
    if (save) await admissionsApi.save(id);
    else await admissionsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev.admissions);
      if (save) next.add(id);
      else next.delete(id);
      return { ...prev, admissions: next };
    });
  };

  // CMS / i18n hero only after the initial site-content request settles (success, empty, failure, or timeout).
  const rawHeadline = homepage?.hero?.headline;
  const pakistanScoped = (text) => /in Pakistan|across Pakistan|Pakistan's job/i.test(String(text || ''));
  const heroTitle = rawHeadline && !isC61TestMarker(rawHeadline) && !pakistanScoped(rawHeadline) ? rawHeadline : t('home:heroTitle');
  const heroSub = homepage?.hero?.subheadline && !pakistanScoped(homepage.hero.subheadline) ? homepage.hero.subheadline : t('home:heroSub');
  const pageSeoTitle = homepage?.seoTitle || t('home:seoTitle');
  const pageSeoDesc = homepage?.metaDescription || DEFAULT_DESCRIPTION;
  const heroBg = homepage?.hero?.backgroundImageUrl;
  const cmsStats = homepage?.stats?.length ? homepage.stats : null;
  const showJobs = homepage?.sections?.featuredJobs?.enabled !== false;
  const showScholarships = homepage?.sections?.featuredScholarships?.enabled !== false;
  const showAdmissions = homepage?.sections?.featuredAdmissions?.enabled !== false;
  const testimonials = homepage?.sections?.testimonials;
  const partners = homepage?.sections?.partners;
  const newsletterBlock = homepage?.sections?.newsletter;
  const heroCtasRaw = homepage?.hero?.ctas?.length ? homepage.hero.ctas : null;
  const heroCtas = heroCtasRaw?.some((cta) => /government jobs/i.test(cta.label || ''))
    ? null
    : heroCtasRaw;

  return (
    <>
      <SeoHead
        title={pageSeoTitle}
        description={pageSeoDesc}
        canonical={homepage?.canonicalUrl || ROUTES.HOME}
        keywords={DEFAULT_KEYWORDS}
        ogImage={homepage?.ogImageUrl}
        twitterCard={homepage?.twitterCard}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([{ name: t('navbar:home'), url: ROUTES.HOME }]),
          webPageSchema({
            name: pageSeoTitle,
            description: pageSeoDesc,
            url: ROUTES.HOME,
          })
        )}
      />

      {!hasResolved ? (
        <HomeHeroSkeleton />
      ) : (
        <>
          {banners?.length > 0 && (
            <section className="bg-edur-steel dark:bg-gray-900">
              <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
                {banners.map((banner) => (
                  <div
                    key={banner._id}
                    className="relative rounded-xl overflow-hidden p-6 sm:p-8 text-white"
                    style={banner.backgroundImageUrl ? { backgroundImage: `url(${banner.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  >
                    <div className="relative z-10">
                      {banner.headline && <h2 className="text-xl sm:text-2xl font-bold mb-1">{banner.headline}</h2>}
                      {banner.subheadline && <p className="text-white/90 mb-3">{banner.subheadline}</p>}
                      {banner.ctaLabel && banner.ctaUrl && (
                        banner.ctaExternal ? (
                          <a href={banner.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex px-4 py-2 rounded-lg bg-white text-edur-steel font-medium">{banner.ctaLabel}</a>
                        ) : (
                          <Link to={banner.ctaUrl} className="inline-flex px-4 py-2 rounded-lg bg-white text-edur-steel font-medium">{banner.ctaLabel}</Link>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section
            className="relative bg-gradient-to-br from-primary via-primary-hover to-secondary dark:from-secondary dark:via-primary dark:to-secondary py-12 sm:py-14 md:py-24 px-4 sm:px-6 overflow-hidden"
            style={{
              minHeight: '28rem',
              ...(heroBg
                ? { backgroundImage: `linear-gradient(rgba(37,99,235,0.88), rgba(15,23,42,0.88)), url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : {}),
            }}
          >
            <div className="absolute inset-0 bg-primary/10 dark:bg-black/20" aria-hidden />
            <div className="relative max-w-4xl mx-auto text-center animate-fade-in-up">
              <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 break-words px-1">
                {heroTitle}
              </h1>
              <p className="text-base sm:text-lg text-white/95 mb-8 max-w-2xl mx-auto break-words px-1">
                {heroSub}
              </p>
              <div className="w-full max-w-3xl mx-auto mb-6 min-w-0">
                <GlobalSearch
                  placeholder={t('home:keywordSearchPlaceholder')}
                  className="w-full"
                  showCategoryFilter
                  categories={searchCategories}
                  category={selectedCategory?.type || ''}
                  categoryValue={searchCategory}
                  onCategoryChange={(match) => {
                    if (!match) return;
                    setSearchCategory(match.value || 'all');
                  }}
                  showCountryFilter
                  countryCode={countryCode}
                  onCountryChange={setCountryCode}
                  onNavigate={handleSearchNavigate}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {heroCtas ? heroCtas.map((cta, i) => (
                  cta.external ? (
                    <a key={i} href={cta.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/30 btn-theme">{cta.label}</a>
                  ) : (
                    <Link key={i} to={cta.url || ROUTES.JOBS} className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/30 btn-theme">{cta.label}</Link>
                  )
                )) : (
                  <>
                    <Link to={ROUTES.JOBS} className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/30 btn-theme">{t('home:jobsQuick')}</Link>
                    <Link to={ROUTES.SCHOLARSHIPS} className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/30 btn-theme">{t('home:scholarships')}</Link>
                    <Link to={ROUTES.ADMISSIONS} className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/30 btn-theme">{t('home:admissions')}</Link>
                    <Link to={ROUTES.INTERNSHIPS} className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/30 btn-theme">{t('home:internships')}</Link>
                  </>
                )}
              </div>
              {!heroCtas && (
              <div className="flex flex-wrap justify-center gap-3">
                <Link to={ROUTES.JOBS} className="inline-flex items-center px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover shadow-lg btn-theme">
                  {t('home:exploreOpportunities')}
                </Link>
                <Link to={ROUTES.RESUME_BUILDER} className="inline-flex items-center px-6 py-3 rounded-xl bg-white text-primary font-semibold hover:bg-primary-light shadow-lg btn-theme">
                  {t('home:buildYourResume')}
                </Link>
              </div>
              )}
              {cmsStats && (
                <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
                  {cmsStats.map((stat, i) => (
                    <div key={i} className="min-w-0 rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-white break-words">{stat.value}</div>
                      <div className="text-xs sm:text-sm text-white/80 break-words">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <ScrollReveal as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <AdHost placementId="home-top" />
      </ScrollReveal>

      <HomePersonalizedBody
        persona={persona}
        homepage={hasResolved ? homepage : null}
        t={t}
        isAuthenticated={isAuthenticated}
        recommended={recommended}
        loadingRecommended={loadingRecommended}
        loadingTrending={loadingTrending || !hasResolved}
        loadingBlogs={loadingBlogs || !hasResolved}
        trendingJobs={trendingJobs}
        latestScholarships={latestScholarships}
        admissionDeadlines={admissionDeadlines}
        blogs={blogs}
        savedIds={savedIds}
        handleSaveJob={handleSaveJob}
        handleSaveScholarship={handleSaveScholarship}
        handleSaveAdmission={handleSaveAdmission}
        showJobs={showJobs}
        showScholarships={showScholarships}
        showAdmissions={showAdmissions}
        foreignStudyCountries={hasResolved ? foreignStudyCountries : null}
        testimonials={hasResolved ? testimonials : undefined}
        partners={hasResolved ? partners : undefined}
        studentResources={hasResolved ? studentResources : null}
        newsletterBlock={hasResolved ? newsletterBlock : undefined}
      />

      <ScrollReveal><AdHost placementId="home-mid-1" variant="inline" /></ScrollReveal>

      <ScrollReveal as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <AdHost placementId="home-footer" />
      </ScrollReveal>

    </>
  );
}
