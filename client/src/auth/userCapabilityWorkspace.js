/**
 * UX-only User-realm workspace mode (student vs business_client).
 * Preference never grants capability. Server capabilities are authoritative.
 */
import { USER_CAPABILITY_IDS } from '@shared/capability/userCapabilities.js';
import { ROUTES } from '../constants';

export const USER_WORKSPACE_PREF_KEY = 'strideto-user-workspace';
export const USER_WORKSPACE_EVENT = 'strideto-user-workspace';
export const USER_WORKSPACE_MODES = Object.freeze(['student', 'business_client']);

export function readUserCapabilities(user) {
  const raw = Array.isArray(user?.capabilities) ? user.capabilities : [];
  const active = raw.filter((id) => typeof id === 'string');
  return {
    active,
    student: active.includes(USER_CAPABILITY_IDS.STUDENT),
    businessClient: active.includes(USER_CAPABILITY_IDS.BUSINESS_CLIENT),
  };
}

/**
 * Server-projected student capability from `/auth/me` (strict).
 * Never infers from role, realm, or isAuthenticated alone.
 * Returns false until capabilities array is present on the user record.
 */
export function hasStudentCapability(user) {
  if (!user || !Array.isArray(user.capabilities)) return false;
  return user.capabilities.includes(USER_CAPABILITY_IDS.STUDENT);
}

/**
 * UX-only optimistic check for nav/chrome while capabilities hydrate.
 * Do not use for student-product API calls — use {@link hasStudentCapability}.
 */
export function hasStudentCapabilityOrPending(user) {
  if (!user) return false;
  if (!Array.isArray(user.capabilities)) return true;
  return user.capabilities.includes(USER_CAPABILITY_IDS.STUDENT);
}

export function isUserWorkspaceMode(value) {
  return USER_WORKSPACE_MODES.includes(value);
}

export function readUserWorkspacePreference() {
  try {
    const raw = localStorage.getItem(USER_WORKSPACE_PREF_KEY);
    return isUserWorkspaceMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeUserWorkspacePreference(mode) {
  if (!isUserWorkspaceMode(mode)) return;
  try {
    localStorage.setItem(USER_WORKSPACE_PREF_KEY, mode);
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_WORKSPACE_EVENT, { detail: mode }));
  }
}

export function clearUserWorkspacePreference() {
  try {
    localStorage.removeItem(USER_WORKSPACE_PREF_KEY);
  } catch {
    /* private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_WORKSPACE_EVENT, { detail: null }));
  }
}

/**
 * Resolve display/workspace mode from server capabilities + optional UX hints.
 * Stale preference for a missing capability is ignored.
 */
export function resolveUserWorkspaceMode(caps, preference = null, pathHint = null) {
  const student = Boolean(caps?.student);
  const businessClient = Boolean(caps?.businessClient);

  if (student && businessClient) {
    if (isUserWorkspaceMode(pathHint)) return pathHint;
    if (isUserWorkspaceMode(preference)) return preference;
    return 'student';
  }
  if (businessClient && !student) return 'business_client';
  if (student && !businessClient) return 'student';
  return 'account';
}

export function defaultUserWorkspaceMode(caps) {
  return resolveUserWorkspaceMode(caps, null, null);
}

export function userWorkspacePresentation(mode) {
  if (mode === 'business_client') {
    return {
      roleLabel: 'Business Client',
      workspaceHref: ROUTES.BUSINESS,
      workspaceLabel: 'Business',
      showStudentLinks: false,
      showBusinessLinks: true,
    };
  }
  if (mode === 'student') {
    return {
      roleLabel: 'Student',
      workspaceHref: ROUTES.DASHBOARD,
      workspaceLabel: 'Student',
      showStudentLinks: true,
      showBusinessLinks: false,
    };
  }
  return {
    roleLabel: 'User',
    workspaceHref: ROUTES.PROFILE,
    workspaceLabel: 'Account',
    showStudentLinks: false,
    showBusinessLinks: false,
  };
}

export function pathHintForUserWorkspace(pathname = '') {
  const path = String(pathname || '');
  if (path === '/business' || path.startsWith('/business/')) return 'business_client';
  return null;
}
