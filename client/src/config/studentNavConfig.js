import { ROUTES } from '../constants';
import {
  STUDENT_WORKSPACE_PREFIXES,
  isStudentWorkspacePath,
  isStudentPortalNavVisible,
} from './studentWorkspacePaths.js';

export { STUDENT_WORKSPACE_PREFIXES, isStudentWorkspacePath, isStudentPortalNavVisible };

/**
 * Final Student / Applicant portal navigation (Phase 3 destinations, Phase 11 shell).
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

/** Core destinations shown in the workspace bar when width permits. */
export const STUDENT_PORTAL_NAV_CORE_KEYS = Object.freeze([
  'dashboard',
  'talentProfile',
  'applications',
  'journey',
  'vault',
  'notifications',
]);

export const STUDENT_PORTAL_NAV_CORE = STUDENT_PORTAL_NAV.filter((item) =>
  STUDENT_PORTAL_NAV_CORE_KEYS.includes(item.labelKey)
);

export const STUDENT_PORTAL_NAV_OVERFLOW = STUDENT_PORTAL_NAV.filter(
  (item) => !STUDENT_PORTAL_NAV_CORE_KEYS.includes(item.labelKey)
);

export function isStudentNavItemCurrent(pathname, item) {
  const pathOnly = String(item?.path || '').split('#')[0];
  if (item?.end) return pathname === pathOnly;
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}
