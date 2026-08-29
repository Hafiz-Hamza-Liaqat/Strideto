/**
 * Verified public Organization identity (SEO-P6).
 * Single source for fields safe to use in schema, About, and Press.
 * No secrets. No unverified registration, address, or founding metadata.
 */
import { PRODUCTION_PUBLIC_ORIGIN } from './publicSiteOrigin.js';
import { organizationSameAsUrls } from '../social/officialSocialLinks.js';

export const ORGANIZATION_PUBLIC_NAME = 'Strideto';

export const ORGANIZATION_PUBLIC_URL = PRODUCTION_PUBLIC_ORIGIN;

export const ORGANIZATION_PUBLIC_DESCRIPTION =
  'STRIDETO connects students and early-career talent with jobs, internships, scholarships, and career resources while giving employers a dedicated workspace to publish opportunities and manage supported hiring workflows.';

export const ORGANIZATION_LOGO_PATH = '/branding/logo-symbol.svg';

export const ORGANIZATION_LOGO_URL = `${ORGANIZATION_PUBLIC_URL}${ORGANIZATION_LOGO_PATH}`;

/** Public brand assets suitable for press/download links (paths only). */
export const ORGANIZATION_PRESS_ASSETS = Object.freeze({
  symbol: '/branding/logo-symbol.svg',
  logo: '/branding/logo.svg',
  logoDark: '/branding/logo-dark.svg',
  logoLight: '/branding/logo-light.svg',
  wordmark: '/branding/wordmark.svg',
  ogImage: '/og-image.png',
  favicon: '/favicon.svg',
});

/**
 * Confirmed official social/profile URLs for sameAs and public pages.
 * @returns {string[]}
 */
export function organizationPublicSameAs() {
  return organizationSameAsUrls();
}

/**
 * @returns {{ name: string, url: string, description: string, logoUrl: string, sameAs: string[] }}
 */
export function publicOrganizationIdentity() {
  return {
    name: ORGANIZATION_PUBLIC_NAME,
    url: ORGANIZATION_PUBLIC_URL,
    description: ORGANIZATION_PUBLIC_DESCRIPTION,
    logoUrl: ORGANIZATION_LOGO_URL,
    sameAs: organizationPublicSameAs(),
  };
}
