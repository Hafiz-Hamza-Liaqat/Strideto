import { ROUTES } from '../constants';

/**
 * Final Student / Applicant portal navigation (Phase 3).
 * Does not change public navbar labels (Phase 10).
 */
export const STUDENT_PORTAL_NAV = [
  { path: ROUTES.DASHBOARD, labelKey: 'dashboard', end: true },
  { path: ROUTES.TALENT_PROFILE, labelKey: 'talentProfile' },
  { path: ROUTES.APPLICATIONS, labelKey: 'applications' },
  { path: ROUTES.JOURNEY, labelKey: 'journey' },
  { path: ROUTES.JOURNEY_SAVED, labelKey: 'saved' },
  { path: ROUTES.JOURNEY_DEADLINES, labelKey: 'deadlines' },
  { path: ROUTES.VAULT, labelKey: 'vault' },
  { path: ROUTES.CONSULTATIONS, labelKey: 'consultations' },
  { path: ROUTES.CASES, labelKey: 'cases' },
  { path: ROUTES.STUDENT_MESSAGES, labelKey: 'messages' },
  { path: ROUTES.NOTIFICATIONS, labelKey: 'notifications' },
  { path: ROUTES.BUDGET, labelKey: 'budget' },
  { path: ROUTES.COPILOT, labelKey: 'copilot' },
  { path: ROUTES.PRIVACY, labelKey: 'privacy' },
  { path: `${ROUTES.PROFILE}#account-settings`, labelKey: 'account' },
  { path: ROUTES.STUDENT_HELP, labelKey: 'help' },
];

const HIDDEN_PREFIXES = [
  '/admin',
  '/employer',
  '/agent',
  '/institution',
  '/auth',
];

export function isStudentPortalNavVisible(pathname, isAuthenticated) {
  if (!isAuthenticated) return false;
  const path = String(pathname || '');
  return !HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
