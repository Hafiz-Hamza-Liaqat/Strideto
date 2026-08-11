import { ROUTES } from '../constants';
import { isSafeInternalReturnPath } from '@shared/publicDiscovery/safePublicUrl.js';

export function loginLocationState(location) {
  if (!location) return undefined;
  const pathname = location.pathname || '';
  const search = location.search || '';
  const combined = `${pathname}${search}`;
  if (!isSafeInternalReturnPath(pathname)) return undefined;
  return { from: { pathname, search, hash: location.hash || '', combined } };
}

export function resolveLoginReturnPath(fromState, fallback = ROUTES.HOME) {
  const pathname = typeof fromState === 'string' ? fromState : fromState?.pathname;
  if (!isSafeInternalReturnPath(pathname)) return fallback;
  const search = typeof fromState === 'object' && isSafeInternalReturnPath(`${pathname}${fromState.search || ''}`)
    ? (fromState.search || '')
    : '';
  return `${pathname}${search}`;
}
