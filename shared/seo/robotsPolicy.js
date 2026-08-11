/**
 * Crawler hints only — not an authorization boundary.
 * Private routes remain protected by server auth.
 *
 * `/agent/` (trailing slash) must not match public `/agents`.
 */

export const ROBOTS_DISALLOW_PATHS = Object.freeze([
  '/auth/',
  '/profile',
  '/dashboard',
  '/saved-jobs',
  '/admin',
  '/resume-analyzer',
  '/badges',
  '/talent-profile',
  '/applications',
  '/vault',
  '/budget',
  '/copilot',
  '/account',
  '/employer',
  '/agent/',
  '/institution/',
  '/help/student',
  '/messages',
  '/commerce-history',
  '/marketplace-checkout',
  '/consultations',
  '/cases',
  '/trust-center',
  '/journey',
  '/personalization',
  '/notifications',
  '/exam-prep/quiz/',
]);

/** Client metadata noindex prefixes. `/agent/` does not match `/agents`. */
export const PRIVATE_SEO_PREFIXES = Object.freeze([
  '/auth/',
  '/profile',
  '/dashboard',
  '/saved-jobs',
  '/admin',
  '/resume-analyzer',
  '/badges',
  '/talent-profile',
  '/applications',
  '/vault',
  '/budget',
  '/copilot',
  '/account',
  '/employer',
  '/agent/',
  '/institution/',
  '/help/student',
  '/messages',
  '/commerce-history',
  '/marketplace-checkout',
  '/consultations',
  '/cases',
  '/trust-center',
  '/journey',
  '/personalization',
  '/notifications',
]);

export function isPrivateSeoPath(pathname) {
  const path = pathname || '/';
  return PRIVATE_SEO_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) {
      const exact = prefix.slice(0, -1);
      return path === exact || path.startsWith(prefix);
    }
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

export function buildRobotsTxt(origin) {
  const base = String(origin || '').replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ];
  return lines.join('\n');
}
