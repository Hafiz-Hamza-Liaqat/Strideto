/**
 * Crawler hints only — not an authorization boundary.
 * Private routes remain protected by server auth.
 *
 * A trailing slash marks a *private base path*: the bare path and everything
 * beneath it are private, while a longer sibling path is public. `/agent/` must
 * not match public `/agents`, `/institution/` must not match `/institutions`,
 * and `/business/` must not match the public `/business-services` acquisition
 * surface (SEO-P0A).
 *
 * A bare prefix rule alone cannot express that: `Disallow: /business` also
 * blocks `/business-services`, and `Disallow: /business/` alone leaves the bare
 * `/business` page crawlable. So `buildRobotsTxt` expands every trailing-slash
 * entry into the narrowest pair of rules that covers both and neither more nor
 * less — see `robotsRulesForPath`. `isPrivateSeoPath` applies exactly the same
 * exact-base-or-subtree rule in the application, so the crawler directive and
 * the page's own noindex can never disagree.
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
  '/business/',
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

/**
 * Client metadata noindex paths, same convention as ROBOTS_DISALLOW_PATHS: a
 * trailing slash means the exact base path AND its subtree, so `/agent/` covers
 * `/agent` and `/agent/leads` but never public `/agents`.
 */
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
  '/business/',
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

/**
 * Exact base OR subtree — never a naive `startsWith`, which would drag the
 * public sibling (`/agents`, `/institutions`, `/business-services`) into the
 * private set. This is the application-side twin of `robotsRulesForPath`.
 */
export function matchesPrivatePathRule(path, prefix) {
  if (prefix.endsWith('/')) {
    const exactBase = prefix.slice(0, -1);
    return path === exactBase || path.startsWith(prefix);
  }
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isPrivateSeoPath(pathname) {
  const path = pathname || '/';
  return PRIVATE_SEO_PREFIXES.some((prefix) => matchesPrivatePathRule(path, prefix));
}

/** True when robots.txt blocks `path` under the shared policy. */
export function isRobotsDisallowedPath(pathname) {
  const path = pathname || '/';
  return ROBOTS_DISALLOW_PATHS.some((prefix) => matchesPrivatePathRule(path, prefix));
}

/**
 * The robots rules for one policy path.
 *
 * A private base path (trailing slash) becomes two rules: an exact-match `$`
 * rule for the bare path, and the trailing-slash prefix rule for its subtree.
 * Any longer sibling path matches neither and stays crawlable. A path without a
 * trailing slash is an ordinary prefix rule and is emitted unchanged.
 */
export function robotsRulesForPath(path) {
  if (!path.endsWith('/')) return [`Disallow: ${path}`];
  return [`Disallow: ${path.slice(0, -1)}$`, `Disallow: ${path}`];
}

export function buildRobotsTxt(origin) {
  const base = String(origin || '').replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW_PATHS.flatMap(robotsRulesForPath),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ];
  return lines.join('\n');
}
