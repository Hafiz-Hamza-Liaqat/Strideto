import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  SEO_CONFIG,
  buildCanonicalUrl,
  resolveOgImage,
  truncateDescription,
  formatPageTitle,
  getLocaleForLang,
} from '../../seo/config';
import { safeJsonLd } from '../../seo/sanitize';
import { getLanguageConfig } from '../../i18n/config';

/**
 * Unified SEO head component for all pages.
 */
export default function SeoHead({
  title,
  description,
  canonical,
  keywords,
  ogTitle,
  ogDescription,
  ogImage,
  ogImageAlt,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  twitterTitle,
  twitterDescription,
  twitterImage,
  robots,
  noindex = false,
  jsonLd,
  language,
  alternateUrls,
  children,
}) {
  const { lang } = useLanguage();
  const { t } = useTranslation('seo');
  const siteLang = language || lang || 'en';
  const langConfig = getLanguageConfig(siteLang);
  const defaultTitle = t('defaultTitle');
  const defaultDescription = t('defaultDescription');
  const defaultKeywords = t('defaultKeywords');
  const fullTitle = formatPageTitle(title || defaultTitle);
  const desc = truncateDescription(description || defaultDescription);
  const canonicalUrl = !noindex && canonical != null ? buildCanonicalUrl(canonical) : undefined;
  const ogImg = resolveOgImage(ogImage);
  const twImg = resolveOgImage(twitterImage || ogImage);
  const robotsContent = noindex ? 'noindex, nofollow' : robots || 'index, follow';

  const resolvedOgTitle = ogTitle || fullTitle;
  const resolvedOgDesc = truncateDescription(ogDescription || description || defaultDescription);
  const resolvedTwTitle = twitterTitle || resolvedOgTitle;
  const resolvedTwDesc = truncateDescription(twitterDescription || ogDescription || description || defaultDescription);
  const resolvedOgImageAlt = ogImageAlt || resolvedOgTitle;

  // Emit alternates only when a caller supplies a real, independently
  // crawlable localized URL strategy. Client-side `?lang=` preferences are
  // not separate indexable documents.
  const alternates = !noindex && alternateUrls;

  const jsonLdPayload = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd.length === 1
        ? jsonLd[0]
        : { '@context': 'https://schema.org', '@graph': jsonLd }
      : jsonLd
    : null;

  const ogLocale = getLocaleForLang(siteLang);
  const altLocales = ['en', 'ur', 'ar'].filter((l) => l !== siteLang).map(getLocaleForLang);

  return (
    <Helmet prioritizeSeoTags>
      <html lang={siteLang} dir={langConfig.dir} />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      <meta name="robots" content={robotsContent} />
      <meta name="theme-color" content={SEO_CONFIG.themeColor} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {alternates &&
        Object.entries(alternates).map(([hreflang, href]) => (
          <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
        ))}

      <meta property="og:site_name" content={SEO_CONFIG.siteName} />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDesc} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={ogImg} />
      <meta property="og:image:alt" content={resolvedOgImageAlt} />
      <meta property="og:locale" content={ogLocale} />
      {altLocales.map((loc) => (
        <meta key={loc} property="og:locale:alternate" content={loc} />
      ))}

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={SEO_CONFIG.twitterSite} />
      <meta name="twitter:creator" content={SEO_CONFIG.twitterCreator} />
      <meta name="twitter:title" content={resolvedTwTitle} />
      <meta name="twitter:description" content={resolvedTwDesc} />
      <meta name="twitter:image" content={twImg} />
      <meta name="twitter:image:alt" content={resolvedOgImageAlt} />
      {canonicalUrl && <meta name="twitter:url" content={canonicalUrl} />}

      {jsonLdPayload && (
        <script type="application/ld+json">{safeJsonLd(jsonLdPayload)}</script>
      )}
      {children}
    </Helmet>
  );
}
