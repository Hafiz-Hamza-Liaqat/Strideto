/**
 * Canonical public indexable listing paths for the crawler sitemap.
 * Detail URLs are appended from approved/public projections only.
 */
import { ROBOTS_DISALLOW_PATHS } from './robotsPolicy.js';

export const INDEXABLE_STATIC_PATHS = Object.freeze([
  '/',
  '/jobs',
  '/scholarships',
  '/admissions',
  '/internships',
  '/program-explorer',
  '/tests',
  '/tests/compare',
  '/schools-and-colleges',
  '/foreign-studies',
  '/intl-scholarships',
  '/institutions',
  '/scholarship-intelligence',
  '/providers',
  '/providers/education-mobility',
  '/providers/business-formation',
  '/agents',
  '/agents/marketplace',
  '/services',
  '/career-guidance',
  '/resume-builder',
  '/blog',
  '/webinars',
  '/about',
  '/editorial-policy',
  '/press',
  '/students',
  '/employers',
  '/for-institutions',
  '/contact',
  '/help-center',
  '/faq',
  '/support',
  '/sitemap',
  '/advertise',
  '/submit-opportunity',
  '/privacy-policy',
  '/terms',
  '/cookie-policy',
  '/cookies',
  '/disclaimer',
  '/refund-policy',
  '/careers',
  '/latest-government-jobs',
]);

/**
 * Trailing-slash prefixes match the bare path and its subtree only. `/agent/`
 * must not match public `/agents`, and `/business/` (the private buyer
 * workspace) must not match the public `/business-services` marketplace.
 */
export const FORBIDDEN_SITEMAP_PATHS = ROBOTS_DISALLOW_PATHS;

export function isForbiddenSitemapPath(path) {
  const p = String(path || '');
  return FORBIDDEN_SITEMAP_PATHS.some((prefix) => {
    if (prefix.endsWith('/')) return p === prefix.slice(0, -1) || p.startsWith(prefix);
    return p === prefix || p.startsWith(`${prefix}/`);
  });
}
