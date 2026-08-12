import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';

export default function Disclaimer() {
  const { t } = useTranslation(['static']);

  return (
    <PublicInfoPage
      titleKey="disclaimerTitle"
      descriptionKey="disclaimerDescription"
      headingKey="disclaimerHeading"
      breadcrumbKey="breadcrumbDisclaimer"
      canonical={ROUTES.DISCLAIMER}
      ns="static"
      seoNs="static"
      relatedLinks={[{ to: ROUTES.CONTACT, label: t('contactUs') }]}
    >
      <PublicInfoSection title={t('disclaimerIntroTitle')}>
        <p>{t('disclaimerIntroBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('disclaimerAccuracyTitle')}>
        <p>{t('disclaimerAccuracyBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('disclaimerThirdPartyTitle')}>
        <p>{t('disclaimerThirdPartyBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('disclaimerLiabilityTitle')}>
        <p>{t('disclaimerLiabilityBody')}</p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
