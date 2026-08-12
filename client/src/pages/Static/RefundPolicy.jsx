import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';

export default function RefundPolicy() {
  const { t } = useTranslation(['static']);

  return (
    <PublicInfoPage
      titleKey="refundTitle"
      descriptionKey="refundDescription"
      headingKey="refundHeading"
      breadcrumbKey="breadcrumbRefund"
      canonical={ROUTES.REFUND_POLICY}
      ns="static"
      seoNs="static"
      relatedLinks={[{ to: ROUTES.CONTACT, label: t('contactUs') }]}
    >
      <PublicInfoSection title={t('refundIntroTitle')}>
        <p>{t('refundIntroBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('refundEmployerTitle')}>
        <p>{t('refundEmployerBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('refundStudentTitle')}>
        <p>{t('refundStudentBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('refundProcessTitle')}>
        <p>{t('refundProcessBody')}</p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
