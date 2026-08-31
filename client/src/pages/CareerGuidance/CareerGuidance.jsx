import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { DEFAULT_KEYWORDS } from '../../seo/config';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import { careerArticlesApi } from '../../services/listingsService';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { AdHost } from '../../components/ads';
import { DEGREE_ROADMAPS } from '@shared/career/degreeRoadmaps.js';

const SKILL_KEYS = [
  { key: 'webDev', to: ROUTES.TEST_HUB },
  { key: 'dataScience', to: ROUTES.TEST_HUB },
  { key: 'aiMl', to: ROUTES.TEST_HUB },
  { key: 'cybersecurity', to: ROUTES.TEST_HUB },
  { key: 'cloud', to: ROUTES.TEST_HUB },
];

export default function CareerGuidance() {
  const { t } = useTranslation(['career', 'common']);
  const [articles, setArticles] = useState([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [expanded, setExpanded] = useState(DEGREE_ROADMAPS[0]?.id || null);

  const prepTips = t('career:prepTips', { returnObjects: true });

  useEffect(() => {
    careerArticlesApi.list({ limit: 12, page: 1 })
      .then(({ data }) => {
        setArticles(data.data || []);
        setTotalArticles(data.pagination?.total ?? data.data?.length ?? 0);
      })
      .catch(() => setArticles([]))
      .finally(() => setArticlesLoading(false));
  }, []);

  return (
    <>
      <SeoHead
        title={t('career:seoTitle')}
        description={t('career:seoDescription')}
        canonical={ROUTES.CAREER_GUIDANCE}
        keywords={`career guidance, career paths, interview tips, ${DEFAULT_KEYWORDS}`}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('career:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('career:title'), url: ROUTES.CAREER_GUIDANCE },
          ]),
          webPageSchema({
            name: t('career:seoTitle'),
            description: t('career:seoDescription'),
            url: ROUTES.CAREER_GUIDANCE,
          })
        )}
      />
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        <Link to={ROUTES.HOME} className="text-edur-steel dark:text-edur-sky hover:underline text-sm mb-6 inline-block">{t('career:backToHome', { defaultValue: '← Home' })}</Link>
        <AdHost placementId="career-guidance-header" className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">{t('career:title')}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">{t('career:subtitle')}</p>

        <div className="flex flex-wrap gap-2 mb-10">
          {[
            { to: ROUTES.JOBS, label: t('navbar:jobs', { defaultValue: 'Jobs' }) },
            { to: ROUTES.SCHOLARSHIPS, label: t('navbar:scholarships', { defaultValue: 'Scholarships' }) },
            { to: ROUTES.INTERNSHIPS, label: t('navbar:internships', { defaultValue: 'Internships' }) },
            { to: ROUTES.ADMISSIONS, label: t('navbar:admissions', { defaultValue: 'Admissions' }) },
            { to: ROUTES.TEST_HUB, label: t('navbar:testsAndPrep', { defaultValue: 'Tests & Prep' }) },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-edur-steel dark:text-edur-sky hover:border-edur-blue"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <ScrollReveal as="section" className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('career:pathsByDegree')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {t('career:roadmapsIntro', {
              defaultValue: 'Expand a major for roles, skills, optional regional salary examples, certifications, and next steps.',
            })}
          </p>
          <div className="space-y-4">
            {DEGREE_ROADMAPS.map((degree) => {
              const open = expanded === degree.id;
              return (
                <div
                  key={degree.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                    onClick={() => setExpanded(open ? null : degree.id)}
                    aria-expanded={open}
                  >
                    <h3 className="font-semibold text-edur-steel dark:text-edur-sky text-lg">{degree.title}</h3>
                    <span className="text-sm text-gray-500">{open ? 'Hide' : 'View roadmap'}</span>
                  </button>
                  {open ? (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4 text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">Related degrees</h4>
                        <p>{degree.relatedDegrees.join(' · ')}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">Common roles</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {degree.roles.map((r) => <li key={r}>{r}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">Required skills</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {degree.requiredSkills.map((s) => <li key={s}>{s}</li>)}
                        </ul>
                      </div>
                      {degree.salaryPakistanPkr ? (
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                            {t('career:regionalSalaryExample', { defaultValue: 'Regional salary example (Pakistan, PKR/month)' })}
                          </h4>
                          <p>
                            {t('career:junior', { defaultValue: 'Junior' })}: {degree.salaryPakistanPkr.junior}
                            {' · '}
                            {t('career:mid', { defaultValue: 'Mid' })}: {degree.salaryPakistanPkr.mid}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{degree.salaryPakistanPkr.note}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('career:salaryDisclaimer', { defaultValue: 'Indicative only — varies by country, city, and employer.' })}
                          </p>
                        </div>
                      ) : null}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">Certifications</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {degree.certifications.map((c) => <li key={c}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">Career progression</h4>
                        <p>{degree.progression.join(' → ')}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">Learning resources</h4>
                        <ul className="space-y-1">
                          {degree.learning.map((l) => {
                            const href = String(l.href || '').startsWith('/assessments') ? ROUTES.TEST_HUB : l.href;
                            const label = String(l.label || '').replace(/\s*assessment$/i, '').trim() || l.label;
                            return (
                            <li key={l.href}>
                              {l.external ? (
                                <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{l.label}</a>
                              ) : (
                                <Link to={href} className="text-primary hover:underline">{label}</Link>
                              )}
                            </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link to={degree.links.jobs} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">Jobs</Link>
                        <Link to={degree.links.scholarships} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">Scholarships</Link>
                        <Link to={degree.links.internships} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">Internships</Link>
                        <Link to={degree.links.admissions} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">Admissions</Link>
                        <Link to={ROUTES.TEST_HUB} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">Tests & Prep</Link>
                      </div>
                      {degree.faq?.length ? (
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1">FAQ</h4>
                          <ul className="space-y-2">
                            {degree.faq.map((f) => (
                              <li key={f.q}>
                                <p className="font-medium">{f.q}</p>
                                <p className="text-gray-600 dark:text-gray-400">{f.a}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ScrollReveal>

        <ScrollReveal as="section" className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('career:skillDevelopment')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t('career:skillDevelopmentDesc')}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SKILL_KEYS.map(({ key, to }) => (
              <Link
                key={key}
                to={to}
                className="block p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-edur-blue/50 dark:hover:border-edur-sky/50 transition-all duration-200 card-hover"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">{t(`career:skills.${key}.title`)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t(`career:skills.${key}.description`)}</p>
                <span className="text-xs font-medium text-edur-steel dark:text-edur-sky mt-2 inline-block">{t('career:takeAssessment', { defaultValue: 'Take related assessment' })}</span>
              </Link>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal as="section" className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t('career:prepTitle', { defaultValue: 'Interview & application prep' })}
          </h2>
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            {Array.isArray(prepTips) && prepTips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal as="section" className="mb-14" id="career-faq">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('career:faqTitle', { defaultValue: 'Career guidance FAQ' })}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('career:faqIntro', {
              defaultValue: 'Practical answers. Monetary salary figures appear only when country and source provenance support them; otherwise salary is Unavailable / source required.',
            })}
          </p>
          <dl className="space-y-4">
            {[
              {
                q: 'How do I choose a career?',
                a: 'Start from interests and strengths, review degree/role roadmaps on this page, then validate requirements against official program and job sources—not rumor.',
              },
              {
                q: 'Can I change fields?',
                a: 'Yes. Map transferable skills, close gaps with assessments and portfolio evidence, and treat prior experience as complementary rather than wasted.',
              },
              {
                q: 'Degree vs portfolio?',
                a: 'Many roles value both. Degrees help with regulated or academic paths; portfolios and verified skills matter strongly for applied technical and creative roles.',
              },
              {
                q: 'Which certifications matter?',
                a: 'Prefer certifications that employers or regulators explicitly request for your target role and country. Generic badge lists without job relevance are weak signals.',
              },
              {
                q: 'International careers?',
                a: 'Confirm visa, credential recognition, and language requirements from official authorities for the destination country before applying.',
              },
              {
                q: 'Remote careers?',
                a: 'Treat remote as a work-mode filter. Employer eligibility, tax, and time-zone expectations still apply and must be verified on the listing.',
              },
              {
                q: 'How does Skill Trust work?',
                a: 'Skill Trust reflects evidence-backed signals under Strideto policy. Incomplete profiles stay incomplete—never invent confidence from missing data.',
              },
              {
                q: 'How should I prepare for interviews?',
                a: 'Practice role-specific scenarios, review your application snapshot, and prepare questions about responsibilities, team, and evaluation criteria.',
              },
              {
                q: 'How are Strideto recommendations produced?',
                a: 'Recommendations use profile and opportunity signals with deterministic fallbacks. They are guidance aids, not guarantees of admission, hiring, or visa outcomes.',
              },
              {
                q: 'How do I confirm official requirements?',
                a: 'Use official institution/employer pages and source-backed program records. When salary or eligibility data lacks provenance, treat it as Unavailable / source required.',
              },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <dt className="font-semibold text-gray-900 dark:text-white">{item.q}</dt>
                <dd className="mt-2 text-sm text-gray-600 dark:text-gray-400">{item.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to={ROUTES.JOBS} className="inline-flex min-h-[44px] items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Explore Jobs</Link>
            <Link to={ROUTES.PROGRAM_EXPLORER || ROUTES.ADMISSIONS} className="inline-flex min-h-[44px] items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Explore Programs</Link>
            <Link to={ROUTES.TEST_HUB} className="inline-flex min-h-[44px] items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tests & Prep</Link>
          </div>
        </ScrollReveal>

        <ScrollReveal as="section" className="mb-14">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('career:articlesFromDb', { count: totalArticles, defaultValue: 'Career articles' })}
            </h2>
            {totalArticles > articles.length ? (
              <span className="text-sm text-gray-500">{articles.length} / {totalArticles}</span>
            ) : null}
          </div>
          {articlesLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <ListingCardSkeleton /><ListingCardSkeleton />
            </div>
          ) : articles.length === 0 ? (
            <p className="text-gray-500">{t('career:noArticles', { defaultValue: 'No guidance articles yet.' })}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {articles.map((article) => (
                <Link
                  key={article._id || article.slug}
                  to={`${ROUTES.CAREER_GUIDANCE}/${article.slug}`}
                  className="block p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-edur-blue/50"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white">{article.title}</h3>
                  {article.summary ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">{article.summary}</p> : null}
                </Link>
              ))}
            </div>
          )}
        </ScrollReveal>
      </div>
    </>
  );
}
