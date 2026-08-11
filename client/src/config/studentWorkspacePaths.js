/**
 * Explicit Student workspace allowlist. Slash-boundary matching so that:
 * - /agent  (private Agent realm) never matches /agents (public directory)
 * - /profile does not match /program-explorer
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

export function isStudentPortalNavVisible(pathname, isAuthenticated) {
  if (!isAuthenticated) return false;
  return isStudentWorkspacePath(pathname);
}
