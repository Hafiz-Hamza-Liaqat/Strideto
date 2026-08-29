/** Site-wide SEO configuration for Strideto */
import { LANGUAGES } from '../i18n/config.js';
import { BRAND_NAME, BRAND_TAGLINE, BRAND_SITE_URL } from '../design-system/brand.js';
import { colors } from '../design-system/colors.js';
import { resolvePublicSiteOrigin } from '@shared/seo/publicSiteOrigin.js';
import { PRIVATE_SEO_PREFIXES, isPrivateSeoPath } from '@shared/seo/robotsPolicy.js';

export const SITE_URL = resolvePublicSiteOrigin(import.meta.env.VITE_APP_URL || BRAND_SITE_URL);
export const SITE_NAME = BRAND_NAME;
export const SITE_TAGLINE = BRAND_TAGLINE;
export const DEFAULT_TITLE = 'Jobs, Internships, Scholarships & Hiring | STRIDETO';
export const DEFAULT_DESCRIPTION =
  'Discover jobs, internships, scholarships, and career resources, or publish opportunities and manage supported hiring workflows with STRIDETO.';
export const DEFAULT_KEYWORDS =
  'jobs, scholarships, admissions, internships, career guidance, resume builder, universities, students, education portal, career opportunities, Strideto';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const TWITTER_HANDLE = '@Strideto';
export const THEME_COLOR = colors.primary;
export const LOCALE_EN = 'en_PK';
export const LOCALE_UR = 'ur_PK';
export const LOCALE_AR = 'ar_SA';

export function getLocaleForLang(lang) {
  const cfg = LANGUAGES.find((l) => l.code === lang);
  return cfg?.ogLocale || LOCALE_EN;
}

export const SEO_CONFIG = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  defaultTitle: DEFAULT_TITLE,
  defaultDescription: DEFAULT_DESCRIPTION,
  defaultKeywords: DEFAULT_KEYWORDS,
  defaultOgImage: DEFAULT_OG_IMAGE,
  twitterSite: TWITTER_HANDLE,
  twitterCreator: TWITTER_HANDLE,
  themeColor: THEME_COLOR,
  locale: LOCALE_EN,
};

/** Private route prefixes — excluded from sitemap and marked noindex */
export const PRIVATE_ROUTE_PREFIXES = PRIVATE_SEO_PREFIXES;

export { isPrivateSeoPath };

export function buildCanonicalUrl(path = '/') {
  if (!path) return SITE_URL;
  if (path.startsWith('http')) {
    const url = path.replace(/\/$/, '') || path;
    return url === `${SITE_URL}/` ? SITE_URL : url;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/') return SITE_URL;
  return `${SITE_URL}${normalized.replace(/\/$/, '')}`;
}

export function resolveOgImage(image) {
  if (!image) return DEFAULT_OG_IMAGE;
  if (image.startsWith('http')) return image;
  if (image.startsWith('/')) return `${SITE_URL}${image}`;
  return `${SITE_URL}/${image}`;
}

export function truncateDescription(text, max = 160) {
  if (!text || typeof text !== 'string') return DEFAULT_DESCRIPTION;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

export function buildAlternateUrls(path = '/') {
  const base = buildCanonicalUrl(path);
  const separator = base.includes('?') ? '&' : '?';
  return {
    en: base,
    ur: `${base}${separator}lang=ur`,
    ar: `${base}${separator}lang=ar`,
    'x-default': base,
  };
}

export function formatPageTitle(title, suffix = SITE_NAME) {
  const raw = title == null ? '' : String(title);
  if (!raw.trim() || /undefined|null|\[object Object\]/i.test(raw)) return DEFAULT_TITLE;
  if (raw.includes(suffix) || raw.includes('|')) return raw;
  return `${raw} | ${suffix}`;
}
