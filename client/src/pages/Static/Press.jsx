import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicInfoPage, PublicInfoSection } from '../../components/static/PublicInfoPage';
import { ROUTES } from '../../constants';
import {
  ORGANIZATION_PUBLIC_NAME,
  ORGANIZATION_PUBLIC_URL,
  ORGANIZATION_PRESS_ASSETS,
  organizationPublicSameAs,
} from '@shared/seo/organizationIdentity.js';

function absoluteAssetUrl(path) {
  return `${ORGANIZATION_PUBLIC_URL}${path}`;
}

export default function Press() {
  const { t } = useTranslation(['static']);
  const sameAs = organizationPublicSameAs();
  const assets = [
    { key: 'symbol', label: t('pressAssetSymbol'), path: ORGANIZATION_PRESS_ASSETS.symbol },
    { key: 'logo', label: t('pressAssetLogo'), path: ORGANIZATION_PRESS_ASSETS.logo },
    { key: 'wordmark', label: t('pressAssetWordmark'), path: ORGANIZATION_PRESS_ASSETS.wordmark },
    { key: 'ogImage', label: t('pressAssetOg'), path: ORGANIZATION_PRESS_ASSETS.ogImage },
  ];

  return (
    <PublicInfoPage
      titleKey="pressTitle"
      descriptionKey="pressDescription"
      headingKey="pressHeading"
      breadcrumbKey="breadcrumbPress"
      canonical={ROUTES.PRESS}
      ns="static"
      seoNs="seo"
      relatedLinks={[
        { to: ROUTES.ABOUT, label: t('aboutHeading') },
        { to: ROUTES.CONTACT, label: t('contactUs') },
      ]}
    >
      <PublicInfoSection title={t('pressOverviewTitle')}>
        <p>{t('pressOverviewBody')}</p>
      </PublicInfoSection>

      <PublicInfoSection title={t('pressFactsTitle')}>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-gray-900 dark:text-white">{t('pressFactName')}</dt>
            <dd>{ORGANIZATION_PUBLIC_NAME}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-900 dark:text-white">{t('pressFactWebsite')}</dt>
            <dd>
              <a href={ORGANIZATION_PUBLIC_URL} className="text-primary dark:text-mint hover:underline break-words-safe">
                {ORGANIZATION_PUBLIC_URL}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-900 dark:text-white">{t('pressFactDescription')}</dt>
            <dd>{t('pressFactDescriptionBody')}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-900 dark:text-white">{t('pressFactAudiences')}</dt>
            <dd>{t('pressFactAudiencesBody')}</dd>
          </div>
        </dl>
      </PublicInfoSection>

      <PublicInfoSection title={t('pressPlatformTitle')}>
        <p>{t('pressPlatformBody')}</p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li>{t('pressPlatformJobs')}</li>
          <li>{t('pressPlatformScholarships')}</li>
          <li>{t('pressPlatformAdmissions')}</li>
          <li>{t('pressPlatformEducation')}</li>
          <li>{t('pressPlatformCareer')}</li>
        </ul>
      </PublicInfoSection>

      {sameAs.length > 0 ? (
        <PublicInfoSection title={t('pressSocialTitle')}>
          <ul className="space-y-2">
            {sameAs.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary dark:text-mint hover:underline break-words-safe min-h-[44px] inline-flex items-center"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </PublicInfoSection>
      ) : null}

      <PublicInfoSection title={t('pressAssetsTitle')}>
        <p className="mb-3">{t('pressAssetsBody')}</p>
        <ul className="space-y-2">
          {assets.map(({ key, label, path }) => (
            <li key={key}>
              <a
                href={absoluteAssetUrl(path)}
                className="text-primary dark:text-mint hover:underline break-words-safe"
                download={path.endsWith('.svg') ? undefined : undefined}
              >
                {label}
              </a>
              <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">({path})</span>
            </li>
          ))}
        </ul>
      </PublicInfoSection>

      <PublicInfoSection title={t('pressContactTitle')}>
        <p>
          {t('pressContactBody')}{' '}
          <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">
            {t('contactUs')}
          </Link>
          . {t('pressContactNote')}
        </p>
      </PublicInfoSection>
    </PublicInfoPage>
  );
}
