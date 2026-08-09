/**
 * Authentication realm boundaries (user vs employer vs agent vs public).
 * Pure path logic — safe to unit-test without React.
 */
import { isAgentPortalPath, isAgentPublicAuthPath } from './agentAuthRealm';

export const EMPLOYER_PUBLIC_AUTH_PATHS = ['/employer/login', '/employer/register'];

const EMPLOYER_PORTAL_ROOT_SEGMENTS = new Set([
  'intelligence',
  'jobs',
  'applications',
  'analytics',
  'settings',
  'notifications',
]);

export function isEmployerPublicAuthPath(pathname = '') {
  return EMPLOYER_PUBLIC_AUTH_PATHS.includes(pathname);
}

/**
 * Authenticated employer app shell (sidebar layout), not public /employer/:slug profiles.
 */
export function isEmployerPortalPath(pathname = '') {
  if (pathname === '/employer' || pathname === '/employer/') return true;
  if (!pathname.startsWith('/employer/')) return false;
  if (isEmployerPublicAuthPath(pathname)) return false;
  const first = pathname.slice('/employer/'.length).split('/').filter(Boolean)[0];
  if (!first) return true;
  return EMPLOYER_PORTAL_ROOT_SEGMENTS.has(first);
}

/**
 * User session bootstrap (/auth/me) must not run on employer portal or employer auth pages.
 */
export function shouldSkipUserAuthBootstrap(pathname = '') {
  return isEmployerPortalPath(pathname) || isEmployerPublicAuthPath(pathname) ||
    isAgentPortalPath(pathname) || isAgentPublicAuthPath(pathname);
}

/**
 * Navbar user widgets (notifications, talent summary) must not run on employer routes.
 */
export function shouldEnableUserNavbarSession(pathname = '', { isUserAuthenticated = false } = {}) {
  if (isEmployerPortalPath(pathname) || isEmployerPublicAuthPath(pathname) ||
      isAgentPortalPath(pathname) || isAgentPublicAuthPath(pathname)) return false;
  return isUserAuthenticated;
}

/**
 * Any route under /employer (portal, auth, or public profile).
 */
export function isEmployerRoutePrefix(pathname = '') {
  return pathname === '/employer' || pathname.startsWith('/employer/');
}
