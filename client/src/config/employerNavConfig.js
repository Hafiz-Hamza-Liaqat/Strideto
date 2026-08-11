import { ROUTES } from '../constants';
import { EMPLOYER_CAPABILITIES as C } from '@shared/employer/team.js';

/**
 * Final Employer IA (Phase 4).
 *
 * Pipeline and Interviews are not reimplemented: Pipeline deep-links to the
 * existing Intelligence pipeline. Interviews lists owned interviews and
 * deep-links into candidate detail (existing scheduler).
 */
export function employerNavItems({ showIntelligence = false, capabilities = [] } = {}) {
  const known = Array.isArray(capabilities) && capabilities.length > 0;
  const has = (cap) => !cap || !known || capabilities.includes(cap);
  const items = [
    { path: ROUTES.EMPLOYER_DASHBOARD, labelKey: 'dashboardHeading' },
    showIntelligence
      ? { path: ROUTES.EMPLOYER_INTELLIGENCE, labelKey: 'intelligenceHeading', capability: C.DASHBOARD_READ }
      : null,
    { path: ROUTES.EMPLOYER_JOBS, labelKey: 'myJobPosts', capability: C.JOBS_READ },
    { path: ROUTES.EMPLOYER_POST_JOB, labelKey: 'postNewJob', capability: C.JOBS_WRITE },
    { path: ROUTES.EMPLOYER_APPLICATIONS, labelKey: 'applications', capability: C.APPLICATIONS_READ },
    showIntelligence
      ? { path: ROUTES.EMPLOYER_INTELLIGENCE_PIPELINE, labelKey: 'navPipeline', capability: C.PIPELINE_READ }
      : null,
    { path: ROUTES.EMPLOYER_INTERVIEWS, labelKey: 'navInterviews', capability: C.INTERVIEWS_READ },
    { path: ROUTES.EMPLOYER_ANALYTICS, labelKey: 'analytics', capability: C.ANALYTICS_READ },
    { path: ROUTES.EMPLOYER_NOTIFICATIONS, labelKey: 'notifications', capability: C.NOTIFICATIONS_READ },
    { path: ROUTES.EMPLOYER_VERIFICATION, labelKey: 'navVerification', capability: C.VERIFICATION_READ },
    { path: ROUTES.EMPLOYER_PLANS_USAGE, labelKey: 'navPlansUsage', capability: C.USAGE_READ },
    { path: ROUTES.EMPLOYER_BILLING, labelKey: 'navBilling', capability: C.BILLING_READ },
    { path: ROUTES.EMPLOYER_GUIDELINES, labelKey: 'navGuidelines' },
    { path: ROUTES.EMPLOYER_TEAM, labelKey: 'navTeam', capability: C.TEAM_READ },
    { path: ROUTES.EMPLOYER_SETTINGS, labelKey: 'settings' },
    { path: ROUTES.EMPLOYER_HELP, labelKey: 'navHelp' },
  ];
  return items.filter((item) => item && has(item.capability));
}
