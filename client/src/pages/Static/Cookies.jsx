import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';
import {
  isMarketingTechnologyConfigured,
  openCookieSettings,
} from '../../consent/cookieConsentStorage';

export default function Cookies() {
  const { t } = useTranslation(['static', 'common', 'footer']);
  const adsConfigured = isMarketingTechnologyConfigured();

  return (
    <PublicInfoPage
      titleKey="cookiesTitle"
      descriptionKey="cookiesDescription"
      headingKey="cookiesHeading"
      breadcrumbKey="breadcrumbCookies"
      canonical={ROUTES.COOKIES}
      relatedLinks={[
        { to: ROUTES.PRIVACY_POLICY, label: t('common:privacyPolicy') },
        { to: ROUTES.TERMS, label: t('static:breadcrumbTerms') },
        { to: ROUTES.CONTACT, label: t('static:contactUs') },
      ]}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('static:lastUpdated')}</p>

      <PublicInfoSection title={t('static:cookiesWhatTitle')}>
        <p>{t('static:cookiesWhatBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesCategoriesTitle')}>
        <p>{t('static:cookiesCategoriesIntro')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesNecessaryTitle')}>
        <p>{t('static:cookiesNecessaryBody')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>{t('static:cookiesNecessaryItemAuth')}</li>
          <li>{t('static:cookiesNecessaryItemSecurity')}</li>
          <li>{t('static:cookiesNecessaryItemSession')}</li>
          <li>{t('static:cookiesNecessaryItemConsent')}</li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesFunctionalTitle')}>
        <p>{t('static:cookiesFunctionalBody')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>{t('static:cookiesFunctionalItemTheme')}</li>
          <li>{t('static:cookiesFunctionalItemLang')}</li>
          <li>{t('static:cookiesFunctionalItemUi')}</li>
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesAnalyticsTitle')}>
        <p>{t('static:cookiesAnalyticsBody')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>{t('static:cookiesAnalyticsItemSession')}</li>
          <li>{t('static:cookiesAnalyticsItemEvents')}</li>
        </ul>
        <p className="mt-2 text-sm">{t('static:cookiesAnalyticsNoThirdParty')}</p>
      </PublicInfoSection>

      {adsConfigured ? (
        <PublicInfoSection title={t('static:cookiesMarketingTitle')}>
          <p>{t('static:cookiesMarketingBody')}</p>
        </PublicInfoSection>
      ) : (
        <PublicInfoSection title={t('static:cookiesMarketingTitle')}>
          <p>{t('static:cookiesMarketingAbsentBody')}</p>
        </PublicInfoSection>
      )}

      <PublicInfoSection title={t('static:cookiesThirdPartyTitle')}>
        <p>{t('static:cookiesThirdPartyBody')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li>{t('static:cookiesThirdPartyFonts')}</li>
          <li>{t('static:cookiesThirdPartyTurnstile')}</li>
          <li>{t('static:cookiesThirdPartyStripe')}</li>
          {adsConfigured ? <li>{t('static:cookiesThirdPartyAds')}</li> : null}
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesRetentionTitle')}>
        <p>{t('static:cookiesRetentionBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesChoicesTitle')}>
        <p>
          {t('static:cookiesChoicesBody')}{' '}
          <button
            type="button"
            onClick={() => openCookieSettings()}
            className="text-primary dark:text-mint hover:underline font-medium"
          >
            {t('footer:cookieSettings')}
          </button>
          .
        </p>
        <p className="mt-2">{t('static:cookiesBrowserControls')}</p>
        <p className="mt-2">{t('static:cookiesEssentialDisableNote')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('static:cookiesUpdatesTitle')}>
        <p>
          {t('static:cookiesUpdatesBody')}{' '}
          <Link to={ROUTES.PRIVACY_POLICY} className="text-primary dark:text-mint hover:underline">
            {t('common:privacyPolicy')}
          </Link>
          .{' '}
          <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">
            {t('static:contactUs')}
          </Link>{' '}
          {t('static:cookiesContactSuffix')}
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
