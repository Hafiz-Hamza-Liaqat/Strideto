/**
 * Conceptual crawler access evaluation for wildcard robots policy (SEO-P7).
 * Does not add per-bot rules — mirrors shared disallow paths for any user-agent.
 */
import { isRobotsDisallowedPath, buildRobotsTxt } from './robotsPolicy.js';

export function isPublicPathAllowedByRobots(pathname) {
  return !isRobotsDisallowedPath(pathname);
}

/** Wildcard policy applies equally to all crawlers unless a future explicit group overrides it. */
export function evaluateCrawlerPathAccess(_userAgent, pathname) {
  const disallowed = isRobotsDisallowedPath(pathname);
  return {
    publicContentAccess: !disallowed,
    privateRouteBlocked: disallowed,
  };
}

export function robotsTxtHasExplicitUserAgentGroup(robotsTxt, userAgent) {
  const needle = `User-agent: ${userAgent}`;
  return String(robotsTxt || '').split('\n').some((line) => line.trim() === needle);
}

export function buildProductionRobotsTxt(origin) {
  return buildRobotsTxt(origin);
}
