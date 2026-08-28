import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';

export default function EditorialPolicy() {
  const { t } = useTranslation(['static']);

  return (
    <PublicInfoPage
      titleKey="editorialPolicyTitle"
      descriptionKey="editorialPolicyDescription"
      headingKey="editorialPolicyHeading"
      breadcrumbKey="breadcrumbEditorialPolicy"
      canonical={ROUTES.EDITORIAL_POLICY}
      ns="static"
      seoNs="seo"
      relatedLinks={[
        { to: ROUTES.ABOUT, label: t('aboutHeading') },
        { to: ROUTES.CONTACT, label: t('contactUs') },
      ]}
    >
      <PublicInfoSection title={t('editorialIntroTitle')}>
        <p>{t('editorialIntroBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialSelectionTitle')}>
        <p>{t('editorialSelectionBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialOpportunitiesTitle')}>
        <p>{t('editorialOpportunitiesBody')}</p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li>{t('editorialOpportunitySalary')}</li>
          <li>{t('editorialOpportunityDeadline')}</li>
          <li>{t('editorialOpportunityEligibility')}</li>
          <li>{t('editorialOpportunityProvider')}</li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialSourcesTitle')}>
        <p>{t('editorialSourcesBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialThirdPartyTitle')}>
        <p>{t('editorialThirdPartyBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialBlogTitle')}>
        <p>{t('editorialBlogBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialAiTitle')}>
        <p>{t('editorialAiBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialVerifyTitle')}>
        <p>{t('editorialVerifyBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('editorialCorrectionsTitle')}>
        <p>
          {t('editorialCorrectionsBody')}{' '}
          <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">
            {t('contactUs')}
          </Link>
          . {t('editorialCorrectionsNote')}
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
