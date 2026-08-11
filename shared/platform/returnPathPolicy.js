/**
 * Same-realm login return destinations (Phase 8).
 * A captured `from` path is never an authorization grant.
 */
import { isSafeInternalReturnPath } from '../publicDiscovery/safePublicUrl.js';

export const LOGIN_REALMS = Object.freeze({
  STUDENT: 'student',
  STAFF_OR_STUDENT: 'staff_or_student',
  EMPLOYER: 'employer',
  AGENT: 'agent',
  INSTITUTION: 'institution',
});

const AUTH_LOOP_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/employer/login',
  '/employer/register',
  '/agent/login',
  '/agent/register',
  '/institution/login',
  '/institution/register',
]);

const EMPLOYER_PORTAL_PREFIXES = [
  '/employer/jobs',
  '/employer/applications',
  '/employer/analytics',
  '/employer/settings',
  '/employer/notifications',
  '/employer/intelligence',
  '/employer/interviews',
  '/employer/verification',
  '/employer/plans',
  '/employer/billing',
  '/employer/guidelines',
  '/employer/help',
  '/employer/team',
  '/employer/accept-invitation',
];

const SECRET_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'code',
  'password',
]);

function isPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isEmployerPortalPath(pathname) {
  if (pathname === '/employer' || pathname === '/employer/') return true;
  return EMPLOYER_PORTAL_PREFIXES.some((prefix) => isPrefix(pathname, prefix));
}

export function stripSecretQuery(search) {
  if (!search || typeof search !== 'string') return '';
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return '';
  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return '';
  }
  for (const key of [...params.keys()]) {
    if (SECRET_QUERY_KEYS.has(String(key).toLowerCase())) params.delete(key);
  }
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function pathnameFromReturnState(fromState) {
  if (typeof fromState === 'string') {
    const q = fromState.indexOf('?');
    return (q === -1 ? fromState : fromState.slice(0, q)).trim();
  }
  return typeof fromState?.pathname === 'string' ? fromState.pathname.trim() : '';
}

export function searchFromReturnState(fromState) {
  if (typeof fromState === 'string') {
    const q = fromState.indexOf('?');
    return q === -1 ? '' : fromState.slice(q);
  }
  return typeof fromState?.search === 'string' ? fromState.search : '';
}

export function isRealmReturnPath(pathname, realm) {
  if (!isSafeInternalReturnPath(pathname)) return false;
  if (AUTH_LOOP_PATHS.has(pathname)) return false;

  switch (realm) {
    case LOGIN_REALMS.STAFF_OR_STUDENT:
      return isRealmReturnPath(pathname, LOGIN_REALMS.STUDENT)
        || isPrefix(pathname, '/admin');
    case LOGIN_REALMS.EMPLOYER:
      return isPrefix(pathname, '/employer') && !AUTH_LOOP_PATHS.has(pathname);
    case LOGIN_REALMS.AGENT:
      if (pathname === '/agents' || pathname.startsWith('/agents/')) return false;
      return isPrefix(pathname, '/agent') && !AUTH_LOOP_PATHS.has(pathname);
    case LOGIN_REALMS.INSTITUTION:
      return isPrefix(pathname, '/institution') && !AUTH_LOOP_PATHS.has(pathname);
    case LOGIN_REALMS.STUDENT:
    default:
      if (isPrefix(pathname, '/admin')) return false;
      if (isPrefix(pathname, '/institution')) return false;
      if (pathname === '/agent' || pathname.startsWith('/agent/')) return false;
      if (isEmployerPortalPath(pathname)) return false;
      return true;
  }
}

/**
 * @param {unknown} fromState
 * @param {string} fallback
 * @param {string} [realm]
 */
export function resolveRealmReturnPath(fromState, fallback, realm = LOGIN_REALMS.STUDENT) {
  const pathname = pathnameFromReturnState(fromState);
  if (!isRealmReturnPath(pathname, realm)) return fallback;
  const search = stripSecretQuery(searchFromReturnState(fromState));
  const combined = `${pathname}${search}`;
  if (search && !isSafeInternalReturnPath(combined) && !isSafeInternalReturnPath(pathname)) {
    return fallback;
  }
  return combined;
}
