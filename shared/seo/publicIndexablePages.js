/**
 * Canonical public indexable listing paths for the crawler sitemap.
 * Detail URLs are appended from approved/public projections only.
 */

export const INDEXABLE_STATIC_PATHS = Object.freeze([
  '/',
  '/jobs',
  '/scholarships',
  '/admissions',
  '/internships',
  '/program-explorer',
  '/tests',
  '/exam-prep',
  '/schools-and-colleges',
  '/foreign-studies',
  '/intl-scholarships',
  '/agents',
  '/agents/marketplace',
  '/services',
  '/career-guidance',
  '/resume-builder',
  '/blog',
  '/webinars',
  '/about',
  '/contact',
  '/help-center',
  '/faq',
  '/support',
  '/sitemap',
  '/advertise',
  '/submit-opportunity',
  '/privacy-policy',
  '/terms',
  '/cookies',
  '/disclaimer',
  '/refund-policy',
  '/careers',
  '/latest-government-jobs',
]);

export const FORBIDDEN_SITEMAP_PATHS = Object.freeze([
  '/license',
  '/admin',
  '/dashboard',
  '/talent-profile',
  '/applications',
  '/vault',
  '/budget',
  '/copilot',
  '/account',
  '/employer',
  '/agent/',
  '/institution/',
]);

export function isForbiddenSitemapPath(path) {
  const p = String(path || '');
  return FORBIDDEN_SITEMAP_PATHS.some((prefix) => {
    if (prefix.endsWith('/')) return p === prefix.slice(0, -1) || p.startsWith(prefix);
    return p === prefix || p.startsWith(`${prefix}/`);
  });
}
