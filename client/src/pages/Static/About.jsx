import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';
import { ORGANIZATION_PUBLIC_URL } from '@shared/seo/organizationIdentity.js';
import { OFFICIAL_LINKEDIN_COMPANY_URL } from '@shared/social/officialSocialLinks.js';

export default function About() {
  const { t } = useTranslation(['static']);

  return (
    <PublicInfoPage
      titleKey="aboutTitle"
      descriptionKey="aboutDescription"
      headingKey="aboutHeading"
      breadcrumbKey="breadcrumbAbout"
      canonical={ROUTES.ABOUT}
      ns="static"
      seoNs="seo"
      relatedLinks={[
        { to: ROUTES.EDITORIAL_POLICY, label: t('aboutRelatedEditorial') },
        { to: ROUTES.PRESS, label: t('aboutRelatedPress') },
        { to: ROUTES.CONTACT, label: t('contactUs') },
      ]}
    >
      <PublicInfoSection title={t('aboutWhatTitle')}>
        <p>{t('aboutWhatBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('aboutAudiencesTitle')}>
        <ul className="list-disc list-inside space-y-2">
          <li>{t('aboutAudienceStudents')}</li>
          <li>{t('aboutAudienceJobSeekers')}</li>
          <li>{t('aboutAudienceEmployers')}</li>
          <li>{t('aboutAudienceInstitutions')}</li>
          <li>{t('aboutAudienceProviders')}</li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('aboutPlatformTitle')}>
        <p>{t('aboutPlatformIntro')}</p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><Link to={ROUTES.JOBS} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformJobs')}</Link></li>
          <li><Link to={ROUTES.SCHOLARSHIPS} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformScholarships')}</Link></li>
          <li><Link to={ROUTES.ADMISSIONS} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformAdmissions')}</Link></li>
          <li><Link to={ROUTES.INTERNSHIPS} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformInternships')}</Link></li>
          <li><Link to={ROUTES.PROGRAM_EXPLORER} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformPrograms')}</Link></li>
          <li><Link to={ROUTES.BLOG} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformBlog')}</Link></li>
          <li><Link to={ROUTES.CAREER_GUIDANCE} className="text-primary dark:text-mint hover:underline">{t('aboutPlatformCareer')}</Link></li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('aboutNotClaimTitle')}>
        <ul className="list-disc list-inside space-y-2">
          <li>{t('aboutNotClaim1')}</li>
          <li>{t('aboutNotClaim2')}</li>
          <li>{t('aboutNotClaim3')}</li>
          <li>{t('aboutNotClaim4')}</li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('aboutWorkspacesTitle')}>
        <p>{t('aboutWorkspacesBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('aboutOfficialTitle')}>
        <p>
          {t('aboutOfficialWebsite')}{' '}
          <a
            href={ORGANIZATION_PUBLIC_URL}
            className="text-primary dark:text-mint hover:underline break-words-safe"
          >
            {ORGANIZATION_PUBLIC_URL}
          </a>
        </p>
        <p className="mt-3">
          {t('aboutOfficialLinkedIn')}{' '}
          <a
            href={OFFICIAL_LINKEDIN_COMPANY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary dark:text-mint hover:underline break-words-safe"
          >
            {OFFICIAL_LINKEDIN_COMPANY_URL}
          </a>
        </p>
      </PublicInfoSection>

      <PublicInfoSection title={t('aboutContactTitle')}>
        <p>
          {t('aboutContactBody')}{' '}
          <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">
            {t('contactUs')}
          </Link>
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
