/**
 * Explicit Student workspace allowlist. Slash-boundary matching so that:
 * - /agent  (private Agent realm) never matches /agents (public directory)
 * - /profile does not match /program-explorer
 * - /business never matches (Business Client workspace)
 */
export const STUDENT_WORKSPACE_PREFIXES = Object.freeze([
  '/dashboard',
  '/talent-profile',
  '/applications',
  '/journey',
  '/vault',
  '/consultations',
  '/cases',
  '/messages',
  '/notifications',
  '/budget',
  '/copilot',
  '/account',
  '/profile',
  '/help/student',
]);

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isStudentWorkspacePath(pathname) {
  const path = String(pathname || '');
  return STUDENT_WORKSPACE_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * Student portal nav requires User auth AND student capability AND a student
 * workspace path. Business Client-only accounts never see this nav.
 * Preference alone cannot invent student capability.
 */
export function isStudentPortalNavVisible(pathname, isAuthenticated, options = {}) {
  if (!isAuthenticated) return false;
  if (options.hasStudentCapability === false) return false;
  if (options.userWorkspace === 'business_client') return false;
  return isStudentWorkspacePath(pathname);
}
