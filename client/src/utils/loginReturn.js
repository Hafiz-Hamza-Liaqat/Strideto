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
