import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';

export default function HelpCenter() {
  const { t } = useTranslation(['static', 'footer']);

  const roleGuides = [
    {
      title: t('static:helpStudentTitle'),
      body: t('static:helpStudentBody'),
      to: ROUTES.STUDENT_HELP,
      cta: t('static:helpStudentCta'),
    },
    {
      title: t('static:helpEmployerTitle'),
      body: t('static:helpEmployerBody'),
      to: ROUTES.EMPLOYER_HELP,
      cta: t('static:helpEmployerCta'),
    },
    {
      title: t('static:helpAgentTitle'),
      body: t('static:helpAgentBody'),
      to: ROUTES.AGENT_GUIDELINES,
      cta: t('static:helpAgentCta'),
    },
    {
      title: t('static:helpInstitutionTitle'),
      body: t('static:helpInstitutionBody'),
      to: ROUTES.INSTITUTION_GUIDELINES,
      cta: t('static:helpInstitutionCta'),
    },
  ];

  return (
    <PublicInfoPage
      titleKey="helpTitle"
      descriptionKey="helpDescription"
      headingKey="helpHeading"
      breadcrumbKey="breadcrumbHelp"
      canonical={ROUTES.HELP_CENTER}
      showSupportTruth
      relatedLinks={[
        { to: ROUTES.FAQ, label: t('static:breadcrumbFaq') },
        { to: ROUTES.CONTACT, label: t('static:contactUs') },
        { to: ROUTES.SUPPORT, label: t('static:helpTopicSafety') },
      ]}
    >
      <p className="text-lg">{t('static:helpIntro')}</p>

      <PublicInfoSection title={t('static:helpGettingStartedTitle')}>
        <p>{t('static:helpGettingStartedBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:helpSearchTitle')}>
        <p>{t('static:helpSearchBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:helpApplyTitle')}>
        <p>{t('static:helpApplyBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:helpRolesTitle')}>
        <p className="mb-4">{t('static:helpRolesIntro')}</p>
        <ul className="space-y-4">
          {roleGuides.map((item) => (
            <li key={item.to} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">{item.body}</p>
              <Link to={item.to} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
                {item.cta}
              </Link>
            </li>
          ))}
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:helpTopicsTitle')}>
        <ul className="space-y-2">
          <li><Link to={ROUTES.PRIVACY_POLICY} className="text-primary dark:text-mint hover:underline">{t('footer:privacyPolicy', { ns: 'footer' })}</Link></li>
          <li><Link to={ROUTES.REFUND_POLICY} className="text-primary dark:text-mint hover:underline">{t('footer:refundPolicy', { ns: 'footer' })}</Link></li>
          <li><Link to={ROUTES.SUPPORT} className="text-primary dark:text-mint hover:underline">{t('static:helpTopicSafety')}</Link></li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:helpNeedMoreTitle')}>
        <p>
          {t('static:helpNeedMorePrefix')}{' '}
          <Link to={ROUTES.FAQ} className="text-primary dark:text-mint hover:underline">{t('static:breadcrumbFaq')}</Link>
          {' '}{t('static:helpNeedMoreOr')}{' '}
          <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">{t('static:contactUs').toLowerCase()}</Link>
          {' '}{t('static:helpNeedMoreSuffix')}
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
