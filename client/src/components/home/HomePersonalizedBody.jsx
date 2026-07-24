import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { HomeJobCard, HomeScholarshipCard, HomeAdmissionCard } from '../listings/HomeListingCard';
import { ListingCardSkeleton } from '../listings/ListingCardSkeleton';
import { ScrollReveal } from '../ui/ScrollReveal';
import { NewsletterSubscribe } from '../newsletter/NewsletterSubscribe';
import { formatDate } from '../../utils/formatDate';
import { Button } from '../common/Button';
import { orderedHomeSections } from '../../personalization/layoutPersonalization';

const SKELETON_COUNT = 3;

function readingTimeMinutes(content) {
  if (!content || typeof content !== 'string') return 5;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Homepage body sections, ordered by careerPreferences persona (no content hidden).
 */
export function HomePersonalizedBody({
  persona = 'default',
  homepage,
  t,
  isAuthenticated,
  recommended,
  loadingRecommended,
  loadingTrending,
  loadingBlogs,
  trendingJobs,
  latestScholarships,
  admissionDeadlines,
  blogs,
  savedIds,
  handleSaveJob,
  handleSaveScholarship,
  handleSaveAdmission,
  showJobs,
  showScholarships,
  showAdmissions,
  foreignStudyCountries,
  testimonials,
  partners,
  studentResources,
  newsletterBlock,
}) {
  const { t: tNav } = useTranslation('navbar');
  const order = orderedHomeSections(persona);

  return (
    <div className="flex flex-col">
      {order.map((sectionKey) => {
        if (sectionKey === 'employerCta') {
          return (
            <ScrollReveal
              key="employerCta"
              as="section"
              className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full"
            >
              <div className="rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-1">Hire with Strideto</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Post jobs, review applicants, and manage hiring from your employer dashboard.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to={ROUTES.EMPLOYER_DASHBOARD}>
                    <Button variant="primary" type="button">Employer Dashboard</Button>
                  </Link>
                  <Link to={ROUTES.EMPLOYER_POST_JOB}>
                    <Button variant="cta" type="button">Post a Job</Button>
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'recommended') {
          if (!(isAuthenticated && (recommended.jobs.length > 0 || recommended.scholarships.length > 0 || recommended.admissions.length > 0))) {
            return null;
          }
          return (
            <ScrollReveal key="recommended" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('home:recommendedForYou')}</h2>
              {loadingRecommended ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <ListingCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="space-y-6">
                  {recommended.jobs.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{tNav('jobs')}</h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommended.jobs.slice(0, 3).map((job) => (
                          <HomeJobCard key={job._id} job={job} saved={savedIds.jobs.has(job._id)} onSaveToggle={handleSaveJob} showBadge />
                        ))}
                      </div>
                      <Link to={ROUTES.JOBS} className="text-sm text-primary dark:text-mint mt-2 inline-block">
                        {t('home:viewAllWithType', { viewAll: t('home:viewAll'), type: tNav('jobs').toLowerCase() })}
                      </Link>
                    </div>
                  )}
                  {recommended.scholarships.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{tNav('scholarships')}</h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommended.scholarships.slice(0, 3).map((item) => (
                          <HomeScholarshipCard key={item._id} item={item} saved={savedIds.scholarships.has(item._id)} onSaveToggle={handleSaveScholarship} />
                        ))}
                      </div>
                      <Link to={ROUTES.SCHOLARSHIPS} className="text-sm text-primary dark:text-mint mt-2 inline-block">
                        {t('home:viewAllWithType', { viewAll: t('home:viewAll'), type: tNav('scholarships').toLowerCase() })}
                      </Link>
                    </div>
                  )}
                  {recommended.admissions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{tNav('admissions')}</h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommended.admissions.slice(0, 3).map((item) => (
                          <HomeAdmissionCard key={item._id} item={item} saved={savedIds.admissions.has(item._id)} onSaveToggle={handleSaveAdmission} />
                        ))}
                      </div>
                      <Link to={ROUTES.ADMISSIONS} className="text-sm text-primary dark:text-mint mt-2 inline-block">
                        {t('home:viewAllWithType', { viewAll: t('home:viewAll'), type: tNav('admissions').toLowerCase() })}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </ScrollReveal>
          );
        }

        if (sectionKey === 'jobs' && showJobs) {
          return (
            <ScrollReveal key="jobs" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{homepage?.sections?.featuredJobs?.title || t('home:trendingJobs')}</h2>
              {loadingTrending ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: SKELETON_COUNT }).map((_, i) => <ListingCardSkeleton key={i} />)}
                </div>
              ) : trendingJobs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trendingJobs.map((job) => (
                    <HomeJobCard key={job._id} job={job} saved={savedIds.jobs.has(job._id)} onSaveToggle={handleSaveJob} showBadge />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">{t('home:noTrendingJobs')}</p>
              )}
              <div className="mt-6 text-center">
                <Link to={ROUTES.JOBS} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-edur-steel/10 dark:bg-edur-sky/10 text-edur-steel dark:text-edur-sky font-medium hover:bg-edur-steel/20 dark:hover:bg-edur-sky/20 btn-theme">
                  {t('home:viewAllJobs')}
                </Link>
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'scholarships' && showScholarships) {
          return (
            <ScrollReveal key="scholarships" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{homepage?.sections?.featuredScholarships?.title || t('home:latestScholarships')}</h2>
              {loadingTrending ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: SKELETON_COUNT }).map((_, i) => <ListingCardSkeleton key={i} />)}
                </div>
              ) : latestScholarships.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {latestScholarships.map((item) => (
                    <HomeScholarshipCard key={item._id} item={item} saved={savedIds.scholarships.has(item._id)} onSaveToggle={handleSaveScholarship} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">{t('home:noScholarships')}</p>
              )}
              <div className="mt-6 text-center">
                <Link to={ROUTES.SCHOLARSHIPS} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-edur-steel/10 dark:bg-edur-sky/10 text-edur-steel dark:text-edur-sky font-medium hover:bg-edur-steel/20 dark:hover:bg-edur-sky/20 btn-theme">
                  {t('home:viewAllScholarships')}
                </Link>
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'admissions' && showAdmissions) {
          return (
            <ScrollReveal key="admissions" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{homepage?.sections?.featuredAdmissions?.title || t('home:upcomingAdmissions')}</h2>
              {loadingTrending ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: SKELETON_COUNT }).map((_, i) => <ListingCardSkeleton key={i} />)}
                </div>
              ) : admissionDeadlines.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {admissionDeadlines.map((item) => (
                    <HomeAdmissionCard key={item._id} item={item} saved={savedIds.admissions.has(item._id)} onSaveToggle={handleSaveAdmission} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">{t('home:noAdmissions')}</p>
              )}
              <div className="mt-6 text-center">
                <Link to={ROUTES.ADMISSIONS} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-edur-steel/10 dark:bg-edur-sky/10 text-edur-steel dark:text-edur-sky font-medium hover:bg-edur-steel/20 dark:hover:bg-edur-sky/20 btn-theme">
                  {t('home:viewAllAdmissions')}
                </Link>
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'foreign' && foreignStudyCountries) {
          return (
            <ScrollReveal key="foreign" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('home:foreignStudyOpportunities')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
                {foreignStudyCountries.map(({ name, path, query }) => (
                  <Link
                    key={name}
                    to={`${path}${query || ''}`}
                    className="min-w-0 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-primary/50 card-hover text-center"
                  >
                    <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white break-words">{name}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link to={ROUTES.INTL_SCHOLARSHIPS} className="text-primary dark:text-mint font-medium hover:underline">{t('home:viewAllIntlScholarships')}</Link>
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'testimonials' && testimonials?.enabled && testimonials.items?.length > 0) {
          return (
            <ScrollReveal key="testimonials" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{testimonials.title || 'Testimonials'}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {testimonials.items.map((item, i) => (
                  <blockquote key={i} className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <p className="text-gray-600 dark:text-gray-300 italic">&ldquo;{item.quote}&rdquo;</p>
                    <footer className="mt-3 text-sm font-medium text-gray-900 dark:text-white">{item.author}{item.role ? ` · ${item.role}` : ''}</footer>
                  </blockquote>
                ))}
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'partners' && partners?.enabled && partners.logos?.length > 0) {
          return (
            <ScrollReveal key="partners" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{partners.title || 'Partners'}</h2>
              <div className="flex flex-wrap justify-center gap-6 items-center">
                {partners.logos.map((logo, i) => (
                  logo.url ? (
                    <a key={i} href={logo.url} target="_blank" rel="noopener noreferrer">
                      {logo.imageUrl ? <img src={logo.imageUrl} alt={logo.name || 'Partner'} className="h-12 object-contain" /> : <span>{logo.name}</span>}
                    </a>
                  ) : (
                    <span key={i}>{logo.imageUrl ? <img src={logo.imageUrl} alt={logo.name || 'Partner'} className="h-12 object-contain" /> : logo.name}</span>
                  )
                ))}
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'resources' && studentResources) {
          return (
            <ScrollReveal key="resources" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('home:studentResources')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {studentResources.map(({ label, to, icon, description }) => (
                  <Link
                    key={to}
                    to={to}
                    className="p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-edur-blue/50 dark:hover:border-edur-sky/50 card-hover text-center transition-all duration-200 min-w-0"
                  >
                    <span className="text-2xl block mb-2" aria-hidden>{icon}</span>
                    <span className="font-semibold text-gray-900 dark:text-white block break-words">{label}</span>
                    {description && <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block break-words">{description}</span>}
                  </Link>
                ))}
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'blog') {
          return (
            <ScrollReveal key="blog" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-200 dark:border-gray-700 w-full">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('home:careerBlogArticles')}</h2>
              {loadingBlogs ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
                </div>
              ) : blogs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {blogs.slice(0, 4).map((post) => (
                    <Link
                      key={post._id}
                      to={`${ROUTES.BLOG}/${post.slug}`}
                      className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-edur-blue/50 card-hover"
                    >
                      <span className="text-xs font-medium text-edur-steel dark:text-edur-sky">{post.category || t('home:defaultBlogCategory')}</span>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mt-1">{post.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{post.excerpt}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {t('home:minRead', { minutes: readingTimeMinutes(post.content || post.excerpt) })}
                        {' · '}
                        {post.publishedAt ? formatDate(post.publishedAt) : (post.createdAt ? formatDate(post.createdAt) : '')}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">{t('home:noBlogPosts')}</p>
              )}
              <div className="mt-6 text-center">
                <Link to={ROUTES.BLOG} className="inline-flex items-center px-5 py-2.5 rounded-xl bg-edur-steel/10 dark:bg-edur-sky/10 text-edur-steel dark:text-edur-sky font-medium hover:bg-edur-steel/20 btn-theme">
                  {t('home:readMoreArticles')}
                </Link>
              </div>
            </ScrollReveal>
          );
        }

        if (sectionKey === 'newsletter' && newsletterBlock?.enabled !== false) {
          return (
            <ScrollReveal key="newsletter" as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 border-t border-gray-200 dark:border-gray-700 w-full">
              <div className="max-w-xl mx-auto text-center p-8 rounded-2xl bg-gradient-to-br from-edur-steel/10 to-edur-blue/10 dark:from-edur-steel/20 dark:to-edur-blue/20 border border-edur-sky/30">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{newsletterBlock?.title || t('home:newsletterTitle')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{newsletterBlock?.subtitle || t('home:newsletterDesc')}</p>
                <NewsletterSubscribe />
              </div>
            </ScrollReveal>
          );
        }

        return null;
      })}
    </div>
  );
}

export default HomePersonalizedBody;
