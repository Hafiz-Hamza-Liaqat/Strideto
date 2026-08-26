import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';

export default function PrivacyPolicy() {
  const { t } = useTranslation(['static', 'common']);

  return (
    <PublicInfoPage
      titleKey="privacyTitle"
      descriptionKey="privacyDescription"
      headingKey="privacyHeading"
      breadcrumbKey="breadcrumbPrivacy"
      canonical={ROUTES.PRIVACY_POLICY}
      seoNs="seo"
      relatedLinks={[
        { to: ROUTES.TERMS, label: t('static:breadcrumbTerms') },
        { to: ROUTES.COOKIES, label: t('static:breadcrumbCookies') },
        { to: ROUTES.CONTACT, label: t('static:contactUs') },
      ]}
    >
      <PublicInfoSection title={t('static:privacyIntroTitle')}>
        <p>{t('static:privacyIntroBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:privacyCollectTitle')}>
        <p>{t('static:privacyCollectBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:privacyUseTitle')}>
        <p>{t('static:privacyUseBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:privacySecurityTitle')}>
        <p>{t('static:privacySecurityBody')}</p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:privacyThirdPartyTitle')}>
        <p>
          {t('static:privacyThirdPartyBody')}{' '}
          <a href="https://policies.google.com/technologies/ads" className="text-primary dark:text-mint hover:underline" target="_blank" rel="noopener noreferrer">
            {t('static:googleAdPolicies')}
          </a>.
        </p>
        <p className="mt-2">
          {t('static:privacyCookieRef')}{' '}
          <Link to={ROUTES.COOKIES} className="text-primary dark:text-mint hover:underline">
            {t('common:cookiePolicy')}
          </Link>
          .
        </p>
      </PublicInfoSection>
      <PublicInfoSection title={t('static:privacyRightsTitle')}>
        <p>{t('static:privacyRightsBody')}</p>
      </PublicInfoSection>
      <p>
        <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">{t('static:contactUs')}</Link>{' '}
        {t('static:privacyContactSuffix')}
      </p>
    </PublicInfoPage>
  );
}
