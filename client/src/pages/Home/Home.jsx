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
import { HomeHeroVisual } from '../../components/home/HomeHeroVisual';
import { filterSafeHomepageStats, resolveHomepageHeroCtas, resolveHomepageHeroHeadline, resolveHomepageHeroSubheadline } from '../../utils/homepageCmsSafety';

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
  const heroTitle = resolveHomepageHeroHeadline(
    rawHeadline && !isC61TestMarker(rawHeadline) && !pakistanScoped(rawHeadline) ? rawHeadline : null,
    t('home:heroTitle')
  );
  const heroSub = resolveHomepageHeroSubheadline(
    homepage?.hero?.subheadline && !pakistanScoped(homepage.hero.subheadline) ? homepage.hero.subheadline : null,
    t('home:heroSub')
  );
  const pageSeoTitle = homepage?.seoTitle || t('home:seoTitle');
  const pageSeoDesc = homepage?.metaDescription || DEFAULT_DESCRIPTION;
  const heroBg = homepage?.hero?.backgroundImageUrl;
  const cmsStatsRaw = homepage?.stats?.length ? homepage.stats : null;
  const cmsStats = filterSafeHomepageStats(cmsStatsRaw);
  const showJobs = homepage?.sections?.featuredJobs?.enabled !== false;
  const showScholarships = homepage?.sections?.featuredScholarships?.enabled !== false;
  const showAdmissions = homepage?.sections?.featuredAdmissions?.enabled !== false;
  const testimonials = homepage?.sections?.testimonials;
  const partners = homepage?.sections?.partners;
  const newsletterBlock = homepage?.sections?.newsletter;
  const heroCtasRaw = homepage?.hero?.ctas?.length ? homepage.hero.ctas : null;
  const heroCtasResolved = resolveHomepageHeroCtas(heroCtasRaw);
  const heroCtas = heroCtasResolved?.some((cta) => /government jobs/i.test(cta.label || ''))
    ? null
    : heroCtasResolved;

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
            className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-secondary px-4 py-12 sm:px-6 sm:py-14 md:py-20 dark:from-secondary dark:via-primary dark:to-secondary"
            style={
              heroBg
                ? {
                    backgroundImage: `linear-gradient(rgba(37,99,235,0.92), rgba(15,23,42,0.92)), url(${heroBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <div className="absolute inset-0 bg-primary/10 dark:bg-black/20" aria-hidden />
            <div className="relative mx-auto max-w-6xl">
              <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
                <div className="min-w-0 text-center lg:text-start">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/80 sm:text-sm">
                    {t('home:heroEyebrow')}
                  </p>
                  <h1 className="font-heading mb-4 break-words text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
                    {heroTitle}
                  </h1>
                  <p className="mx-auto mb-6 max-w-xl break-words text-base leading-relaxed text-white/90 sm:text-lg lg:mx-0">
                    {heroSub}
                  </p>

                  <div className="mb-6 w-full min-w-0 lg:max-w-xl">
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

                  {heroCtas ? (
                    <div className="mb-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                      {heroCtas.map((cta, i) => (
                        cta.external ? (
                          <a
                            key={i}
                            href={cta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center rounded-xl border border-white/30 bg-white/20 px-5 py-2.5 font-medium text-white btn-theme hover:bg-white/30"
                          >
                            {cta.label}
                          </a>
                        ) : (
                          <Link
                            key={i}
                            to={cta.url || ROUTES.JOBS}
                            className="inline-flex min-h-[44px] items-center rounded-xl border border-white/30 bg-white/20 px-5 py-2.5 font-medium text-white btn-theme hover:bg-white/30"
                          >
                            {cta.label}
                          </Link>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                      <Link
                        to={ROUTES.JOBS}
                        data-cta="homepage-explore-opportunities"
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-lg btn-theme hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:w-auto"
                      >
                        {t('home:exploreOpportunities')}
                      </Link>
                      <Link
                        to={ROUTES.FOR_EMPLOYERS}
                        data-cta="homepage-for-employers"
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border-2 border-white/70 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm btn-theme hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:w-auto"
                      >
                        {t('home:forEmployersCta')}
                      </Link>
                    </div>
                  )}

                  {!heroCtas && (
                    <nav
                      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm lg:justify-start"
                      aria-label={t('home:quickLinks')}
                    >
                      <Link
                        to={ROUTES.INTERNSHIPS}
                        className="min-h-[44px] inline-flex items-center font-medium text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded"
                      >
                        {t('home:findInternships')}
                      </Link>
                      <Link
                        to={ROUTES.SCHOLARSHIPS}
                        className="min-h-[44px] inline-flex items-center font-medium text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded"
                      >
                        {t('home:findScholarships')}
                      </Link>
                      <Link
                        to={ROUTES.REGISTER}
                        className="min-h-[44px] inline-flex items-center font-medium text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded"
                      >
                        {t('home:createAccount')}
                      </Link>
                    </nav>
                  )}

                  {cmsStats && (
                    <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:mx-0">
                      {cmsStats.map((stat, i) => (
                        <div
                          key={i}
                          className="min-w-0 rounded-xl border border-white/20 bg-white/10 p-3 text-center backdrop-blur sm:p-4"
                        >
                          <div className="break-words text-xl font-bold text-white sm:text-2xl">{stat.value}</div>
                          <div className="break-words text-xs text-white/80 sm:text-sm">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-w-0 pt-2 lg:pt-0">
                  <HomeHeroVisual />
                </div>
              </div>
            </div>
          </section>

          {!heroCtas && (
            <section
              className="border-b border-gray-200 bg-gray-50/80 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/40 sm:px-6"
              aria-label="Platform context"
            >
              <ul className="mx-auto flex max-w-6xl flex-col gap-2 text-sm text-gray-600 dark:text-gray-400 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:gap-y-2">
                <li className="flex items-start gap-2 sm:items-center">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary sm:mt-0" aria-hidden />
                  {t('home:heroTrustBrowse')}
                </li>
                <li className="flex items-start gap-2 sm:items-center">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary sm:mt-0" aria-hidden />
                  {t('home:heroTrustExternal')}
                </li>
                <li className="flex items-start gap-2 sm:items-center">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 sm:mt-0" aria-hidden />
                  {t('home:heroTrustEmployer')}
                </li>
              </ul>
            </section>
          )}
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
