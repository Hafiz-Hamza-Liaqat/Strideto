import { ROUTES } from '../constants';
import { isSafeInternalReturnPath } from '@shared/publicDiscovery/safePublicUrl.js';
import {
  LOGIN_REALMS,
  resolveRealmReturnPath,
} from '@shared/platform/returnPathPolicy.js';

export { LOGIN_REALMS, resolveRealmReturnPath };

export function loginLocationState(location) {
  if (!location) return undefined;
  const pathname = location.pathname || '';
  const search = location.search || '';
  if (!isSafeInternalReturnPath(pathname)) return undefined;
  return { from: { pathname, search, hash: location.hash || '', combined: `${pathname}${search}` } };
}

export function resolveLoginReturnPath(fromState, fallback = ROUTES.HOME, realm = LOGIN_REALMS.STUDENT) {
  return resolveRealmReturnPath(fromState, fallback, realm);
}

const AUTH_RETURN_PATH_KEY = 'strideto.auth.return';

/** Store only a validated same-app path while registration/verification completes. */
export function rememberLoginReturnPath(path) {
  const safe = resolveLoginReturnPath(path, '', LOGIN_REALMS.STUDENT);
  try {
    if (safe) sessionStorage.setItem(AUTH_RETURN_PATH_KEY, safe);
    else sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    // Blocked storage falls back to the normal post-auth destination.
  }
  return safe || null;
}

/** Read once so an old application intent cannot be reused indefinitely. */
export function takeLoginReturnPath() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    return null;
  }
  return resolveLoginReturnPath(raw, '', LOGIN_REALMS.STUDENT) || null;
}

/** Convert a validated path into the React Router state shape used by Login. */
export function loginStateFromPath(path) {
  const safe = resolveLoginReturnPath(path, '', LOGIN_REALMS.STUDENT);
  if (!safe) return undefined;
  const parsed = new URL(safe, 'https://strideto.invalid');
  return loginLocationState({
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
  });
}
