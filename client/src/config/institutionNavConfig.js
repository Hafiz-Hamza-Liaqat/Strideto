import { ROUTES } from '../constants';

/** Final Institution IA (Phase 6). No dead entries. */
export function institutionNavItems() {
  return [
    { path: ROUTES.INSTITUTION_DASHBOARD, label: 'Dashboard', end: true },
    { path: ROUTES.INSTITUTION_PROFILE, label: 'Organization Profile' },
    { path: ROUTES.INSTITUTION_VERIFICATION, label: 'Verification' },
    { path: ROUTES.INSTITUTION_CLAIM, label: 'Canonical Claim' },
    { path: ROUTES.INSTITUTION_PROGRAMS, label: 'Programs' },
    { path: ROUTES.INSTITUTION_INTAKES, label: 'Intakes / Admissions' },
    { path: ROUTES.INSTITUTION_APPLICATIONS, label: 'Admission Applications' },
    { path: ROUTES.INSTITUTION_TEST_ACCEPTANCE, label: 'Test Acceptance' },
    { path: ROUTES.INSTITUTION_SCHOLARSHIPS, label: 'Scholarships & Funding' },
    { path: ROUTES.INSTITUTION_DATA_QUALITY, label: 'Data Quality' },
    { path: ROUTES.INSTITUTION_TEAM, label: 'Team' },
    { path: ROUTES.INSTITUTION_NOTIFICATIONS, label: 'Notifications' },
    { path: ROUTES.INSTITUTION_USAGE, label: 'Analytics / Usage' },
    { path: ROUTES.INSTITUTION_BILLING, label: 'Billing' },
    { path: ROUTES.INSTITUTION_SETTINGS, label: 'Settings / Security' },
    { path: ROUTES.INSTITUTION_GUIDELINES, label: 'Help / Guidelines' },
  ];
}
