/**
 * Agent authentication realm boundaries.
 * Pure path logic — safe to unit-test without React.
 */

export const AGENT_PUBLIC_AUTH_PATHS = ['/agent/login', '/agent/register'];

const AGENT_PORTAL_ROOT_SEGMENTS = new Set([
  'onboarding',
  'profile',
  'services',
  'verification',
  'team',
  'leads',
  'clients',
  'settings',
  'marketplace',
  'consultations',
  'availability',
]);

export function isAgentPublicAuthPath(pathname = '') {
  return AGENT_PUBLIC_AUTH_PATHS.includes(pathname);
}

export function isAgentPortalPath(pathname = '') {
  if (pathname === '/agent' || pathname === '/agent/') return true;
  if (!pathname.startsWith('/agent/')) return false;
  if (isAgentPublicAuthPath(pathname)) return false;
  const first = pathname.slice('/agent/'.length).split('/').filter(Boolean)[0];
  if (!first) return true;
  return AGENT_PORTAL_ROOT_SEGMENTS.has(first);
}

export function shouldSkipUserAuthBootstrap(pathname = '') {
  return isAgentPortalPath(pathname) || isAgentPublicAuthPath(pathname);
}

export function isAgentRoutePrefix(pathname = '') {
  return pathname === '/agent' || pathname.startsWith('/agent/');
}

export function isAgentPublicDirectoryPath(pathname = '') {
  return pathname === '/agents' || pathname.startsWith('/agents/');
}
