import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';

export default function Cookies() {
  const { t } = useTranslation(['static', 'common']);

  return (
    <PublicInfoPage
      titleKey="cookiesTitle"
      descriptionKey="cookiesDescription"
      headingKey="cookiesHeading"
      breadcrumbKey="breadcrumbCookies"
      canonical={ROUTES.COOKIES}
      relatedLinks={[
        { to: ROUTES.PRIVACY_POLICY, label: t('common:privacyPolicy') },
        { to: ROUTES.CONTACT, label: t('static:contactUs') },
      ]}
    >
      <PublicInfoSection title={t('static:cookiesWhatTitle')}>
        <p>{t('static:cookiesWhatBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:cookiesHowTitle')}>
        <p>{t('static:cookiesHowBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:cookiesChoicesTitle')}>
        <p>
          {t('static:cookiesChoicesBody')}{' '}
          <Link to={ROUTES.PRIVACY_POLICY} className="text-primary dark:text-mint hover:underline">
            {t('common:privacyPolicy')}
          </Link>
          .
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
