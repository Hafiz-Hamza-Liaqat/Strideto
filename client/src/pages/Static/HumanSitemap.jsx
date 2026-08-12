import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';

function Group({ title, links }) {
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        {title}
      </h2>
      <ul className="space-y-2">
        {links.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="text-primary dark:text-mint hover:underline break-words-safe min-h-[44px] inline-flex items-center"
            >
              {item.label}
            </Link>
            {item.note ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.note}</p>
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
      title: t('static:sitemapOpportunities'),
      links: [
        { to: ROUTES.JOBS, label: t('navbar:jobs') },
        { to: ROUTES.INTERNSHIPS, label: t('navbar:internships') },
        { to: ROUTES.SCHOLARSHIPS, label: t('navbar:scholarshipsAndFunding') },
        { to: ROUTES.ADMISSIONS, label: t('navbar:admissionsAndIntakes') },
      ],
    },
    {
      title: t('static:sitemapEducation'),
      links: [
        { to: ROUTES.PROGRAM_EXPLORER, label: t('navbar:studyAndInstitutions') },
        { to: ROUTES.SCHOOLS_AND_COLLEGES, label: t('navbar:schoolsAndColleges') },
        { to: ROUTES.FOREIGN_STUDIES, label: t('navbar:foreignStudies') },
        { to: ROUTES.INTL_SCHOLARSHIPS, label: t('navbar:intlScholarships') },
        { to: ROUTES.TEST_HUB, label: t('navbar:testsAndPrep') },
        { to: ROUTES.EXAM_PREP, label: t('navbar:examPrep') },
      ],
    },
    {
      title: t('static:sitemapProfessional'),
      links: [
        { to: ROUTES.SERVICES, label: t('navbar:services') },
        { to: ROUTES.AGENT_PUBLIC_DIRECTORY, label: t('navbar:agentsDirectory') },
        { to: ROUTES.AGENT_PUBLIC_MARKETPLACE, label: t('navbar:professionalMarketplace') },
        { to: ROUTES.CAREER_GUIDANCE, label: t('navbar:careerGuidance') },
        { to: ROUTES.RESUME_BUILDER, label: t('navbar:resumeBuilder') },
      ],
    },
    {
      title: t('static:sitemapAccount'),
      links: [
        { to: ROUTES.LOGIN, label: t('navbar:login'), note: t('static:sitemapAuthNote') },
        { to: ROUTES.REGISTER, label: t('navbar:register'), note: t('static:sitemapAuthNote') },
      ],
    },
    {
      title: t('static:sitemapOrganizations'),
      links: [
        { to: ROUTES.EMPLOYER_LOGIN, label: t('footer:employerPortal'), note: t('static:sitemapOrgNote') },
        { to: ROUTES.AGENT_LOGIN, label: t('footer:agentPortal'), note: t('static:sitemapOrgNote') },
        { to: ROUTES.INSTITUTION_LOGIN, label: t('footer:institutionPortal'), note: t('static:sitemapOrgNote') },
      ],
    },
    {
      title: t('static:sitemapHelp'),
      links: [
        { to: ROUTES.HELP_CENTER, label: t('footer:helpCenter') },
        { to: ROUTES.SUPPORT, label: t('footer:support') },
        { to: ROUTES.CONTACT, label: t('footer:contactLink') },
        { to: ROUTES.FAQ, label: t('footer:faq') },
      ],
    },
    {
      title: t('static:sitemapLegal'),
      links: [
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
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 not-prose">
        {groups.map((g) => (
          <Group key={g.title} title={g.title} links={g.links} />
        ))}
      </div>
    </PublicInfoPage>
  );
}
