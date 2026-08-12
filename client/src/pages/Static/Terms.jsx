import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';

export default function Terms() {
  const { t } = useTranslation(['static']);

  return (
    <PublicInfoPage
      titleKey="termsTitle"
      descriptionKey="termsDescription"
      headingKey="termsHeading"
      breadcrumbKey="breadcrumbTerms"
      canonical={ROUTES.TERMS}
      seoNs="seo"
      relatedLinks={[
        { to: ROUTES.PRIVACY_POLICY, label: t('static:breadcrumbPrivacy') },
        { to: ROUTES.CONTACT, label: t('static:contactUs') },
      ]}
    >
      <PublicInfoSection title={t('static:termsAcceptTitle')}>
        <p>{t('static:termsAcceptBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:termsUseTitle')}>
        <p>{t('static:termsUseBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:termsAccountTitle')}>
        <p>{t('static:termsAccountBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:termsListingsTitle')}>
        <p>{t('static:termsListingsBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:termsLiabilityTitle')}>
        <p>{t('static:termsLiabilityBody')}</p>
      </PublicInfoSection>
      <p>
        <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">{t('static:contactUs')}</Link>{' '}
        {t('static:termsContactSuffix')}
      </p>
    </PublicInfoPage>
  );
}
