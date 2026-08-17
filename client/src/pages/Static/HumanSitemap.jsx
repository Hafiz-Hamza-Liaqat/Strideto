import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage } from '../../components/static/PublicInfoPage';
import { Icon } from '../../components/brand/Icon';
import { ROUTES } from '../../constants';

function Group({ title, description, icon, links }) {
  return (
    <section className="min-w-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-mint">
          <Icon name={icon} className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
      </div>
      <ul className="space-y-1">
        {links.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="group flex min-h-[44px] items-center rounded-lg px-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="break-words-safe group-hover:text-primary dark:group-hover:text-mint">{item.label}</span>
            </Link>
            {item.note ? (
              <p className="px-2 pb-1 text-xs text-gray-500 dark:text-gray-400">{item.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HumanSitemap() {
  const { t } = useTranslation(['static', 'navbar', 'footer', 'seo']);

  const groups = [
    {
      title: t('static:sitemapOpportunities', { defaultValue: 'Find opportunities' }),
      description: t('static:sitemapOpportunitiesDesc', { defaultValue: 'Browse jobs, internships, funding, and admissions.' }),
      icon: 'briefcase',
      links: [
        { to: ROUTES.JOBS, label: t('navbar:jobs') },
        { to: ROUTES.INTERNSHIPS, label: t('navbar:internships') },
        { to: ROUTES.SCHOLARSHIPS, label: t('navbar:scholarshipsAndFunding') },
        { to: ROUTES.ADMISSIONS, label: t('navbar:admissionsAndIntakes') },
      ],
    },
    {
      title: t('static:sitemapEducation', { defaultValue: 'Plan your studies' }),
      description: t('static:sitemapEducationDesc', { defaultValue: 'Explore programs, schools, and exam preparation.' }),
      icon: 'document',
      links: [
        { to: ROUTES.PROGRAM_EXPLORER, label: t('navbar:programExplorer', { defaultValue: 'Program Explorer' }) },
        { to: ROUTES.SCHOOLS_AND_COLLEGES, label: t('navbar:schoolsAndColleges') },
        { to: ROUTES.FOREIGN_STUDIES, label: t('navbar:foreignStudies') },
        { to: ROUTES.INTL_SCHOLARSHIPS, label: t('navbar:intlScholarships') },
        { to: ROUTES.TEST_HUB, label: t('navbar:testsAndPrep') },
        { to: ROUTES.EXAM_PREP, label: t('navbar:examPrep') },
      ],
    },
    {
      title: t('static:sitemapProfessional', { defaultValue: 'Get professional help' }),
      description: t('static:sitemapProfessionalDesc', { defaultValue: 'Find agents, marketplace services, and career tools.' }),
      icon: 'search',
      links: [
        { to: ROUTES.AGENT_PUBLIC_DIRECTORY, label: t('navbar:agentsDirectory') },
        { to: ROUTES.AGENT_PUBLIC_MARKETPLACE, label: t('navbar:professionalMarketplace') },
        { to: ROUTES.CAREER_GUIDANCE, label: t('navbar:careerGuidance') },
        { to: ROUTES.RESUME_BUILDER, label: t('navbar:resumeBuilder') },
        { to: ROUTES.BLOG, label: t('footer:careerBlog') },
      ],
    },
    {
      title: t('static:sitemapOrganizations', { defaultValue: 'Organizations' }),
      description: t('static:sitemapOrganizationsDesc', { defaultValue: 'Portals for employers, agents, and institutions.' }),
      icon: 'briefcase',
      links: [
        { to: ROUTES.EMPLOYER_LOGIN, label: t('footer:employerPortal'), note: t('static:sitemapOrgNote') },
        { to: ROUTES.PROVIDERS_EDUCATION_MOBILITY, label: t('footer:educationProviderPortal'), note: t('static:sitemapOrgNote') },
        { to: ROUTES.PROVIDERS_BUSINESS_FORMATION, label: t('footer:businessProviderPortal'), note: t('static:sitemapOrgNote') },
        { to: ROUTES.INSTITUTION_LOGIN, label: t('footer:institutionPortal'), note: t('static:sitemapOrgNote') },
      ],
    },
    {
      title: t('static:sitemapAccount', { defaultValue: 'Account' }),
      description: t('static:sitemapAccountDesc', { defaultValue: 'Sign in or create a student account.' }),
      icon: 'document',
      links: [
        { to: ROUTES.LOGIN, label: t('navbar:login'), note: t('static:sitemapAuthNote') },
        { to: ROUTES.REGISTER, label: t('navbar:register'), note: t('static:sitemapAuthNote') },
      ],
    },
    {
      title: t('static:sitemapHelp', { defaultValue: 'Help & safety' }),
      description: t('static:sitemapHelpDesc', { defaultValue: 'Support, policies, and legal information.' }),
      icon: 'search',
      links: [
        { to: ROUTES.HELP_CENTER, label: t('footer:helpCenter') },
        { to: ROUTES.FAQ, label: t('footer:faq') },
        { to: ROUTES.SUPPORT, label: t('footer:support') },
        { to: ROUTES.CONTACT, label: t('footer:contactLink') },
        { to: ROUTES.PRIVACY_POLICY, label: t('footer:privacyPolicy') },
        { to: ROUTES.TERMS, label: t('footer:termsConditions') },
        { to: ROUTES.REFUND_POLICY, label: t('footer:refundPolicy') },
        { to: ROUTES.COOKIES, label: t('footer:cookiePolicy') },
        { to: ROUTES.DISCLAIMER, label: t('footer:disclaimer') },
      ],
    },
  ];

  return (
    <PublicInfoPage
      titleKey="sitemapTitle"
      descriptionKey="sitemapDescription"
      headingKey="sitemapHeading"
      breadcrumbKey="breadcrumbSitemap"
      canonical={ROUTES.SITEMAP}
      wide
    >
      <p className="!mt-0 text-gray-600 dark:text-gray-300 mb-6">{t('static:sitemapIntro')}</p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 not-prose">
        {groups.map((g) => (
          <Group key={g.title} {...g} />
        ))}
      </div>
    </PublicInfoPage>
  );
}
