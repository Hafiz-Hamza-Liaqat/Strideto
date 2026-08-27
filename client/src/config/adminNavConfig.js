import { ROUTES } from '../constants';
import { PERMISSIONS } from './rbac';

/** @typedef {{ path: string; labelKey: string; perm?: string | string[]; icon?: string; end?: boolean }} AdminNavItem */
/** @typedef {{ id: string; labelKey: string; icon: string; items: AdminNavItem[] }} AdminNavGroup */

/** Single source of truth for admin sidebar navigation. Keep in sync with routes/index.jsx paths. */
export const ADMIN_NAV_GROUPS = /** @type {AdminNavGroup[]} */ ([
  {
    id: 'operations',
    labelKey: 'navGroupOperations',
    icon: 'shield',
    items: [
      { path: `${ROUTES.ADMIN}/sc/overview`, labelKey: 'navOverview', perm: [PERMISSIONS.SYSTEM_READ, PERMISSIONS.ORGANIZATIONS_READ, PERMISSIONS.ANALYTICS_READ], icon: 'home' },
      { path: `${ROUTES.ADMIN}/sc/organizations`, labelKey: 'navOrganizations', perm: PERMISSIONS.ORGANIZATIONS_READ, icon: 'building' },
      { path: `${ROUTES.ADMIN}/verification-queue`, labelKey: 'navVerificationQueue', perm: PERMISSIONS.VERIFICATION_READ, icon: 'shield' },
      { path: `${ROUTES.ADMIN}/sc/claims`, labelKey: 'navCanonicalClaims', perm: PERMISSIONS.VERIFICATION_READ, icon: 'school' },
      { path: `${ROUTES.ADMIN}/sc/trust`, labelKey: 'navTrustCenter', perm: PERMISSIONS.TRUST_TRIAGE, icon: 'shield' },
      { path: `${ROUTES.ADMIN}/sc/data-quality`, labelKey: 'navDataQuality', perm: PERMISSIONS.DATA_QUALITY_MANAGE, icon: 'list' },
      { path: `${ROUTES.ADMIN}/sc/commerce`, labelKey: 'navCommerce', perm: PERMISSIONS.COMMERCE_ADMIN_READ, icon: 'credit' },
      { path: `${ROUTES.ADMIN}/sc/ai-ops`, labelKey: 'navAiOps', perm: PERMISSIONS.AI_OPS_READ, icon: 'sparkles' },
      { path: `${ROUTES.ADMIN}/sc/system`, labelKey: 'navSystemReadiness', perm: PERMISSIONS.SYSTEM_READ, icon: 'health' },
    ],
  },
  {
    id: 'moderation-support',
    labelKey: 'navGroupModerationSupport',
    icon: 'lifebuoy',
    items: [
      { path: `${ROUTES.ADMIN}/sc/trust`, labelKey: 'navReportsDisputes', perm: PERMISSIONS.TRUST_TRIAGE, icon: 'shield' },
      { path: `${ROUTES.ADMIN}/support`, labelKey: 'navSupportRequests', perm: PERMISSIONS.USERS_READ, icon: 'lifebuoy' },
      { path: `${ROUTES.ADMIN}/privacy-requests`, labelKey: 'navPrivacyLegal', perm: PERMISSIONS.USERS_READ, icon: 'shield' },
      { path: `${ROUTES.ADMIN}/moderation`, labelKey: 'moderation', perm: [PERMISSIONS.MODERATE_JOBS, PERMISSIONS.MODERATE_EMPLOYERS], icon: 'shield' },
      { path: `${ROUTES.ADMIN}/review`, labelKey: 'editorialReview', perm: [PERMISSIONS.WORKFLOW_VIEW, PERMISSIONS.WORKFLOW_REVIEW, PERMISSIONS.WORKFLOW_APPROVE], icon: 'shield' },
      { path: `${ROUTES.ADMIN}/agent-marketplace`, labelKey: 'agentMarketplace', perm: PERMISSIONS.WORKFLOW_REVIEW, icon: 'megaphone' },
    ],
  },
  {
    id: 'business-services',
    labelKey: 'navGroupBusinessServices',
    icon: 'briefcase',
    items: [
      { path: `${ROUTES.ADMIN}/gbs/capabilities`, labelKey: 'gbsCapabilityReviews', perm: PERMISSIONS.VERIFICATION_READ, icon: 'shield' },
      { path: `${ROUTES.ADMIN}/gbs/listings`, labelKey: 'gbsListingReviews', perm: PERMISSIONS.VERIFICATION_READ, icon: 'shield' },
    ],
  },
  {
    id: 'system',
    labelKey: 'navGroupSystem',
    icon: 'settings',
    items: [
      { path: `${ROUTES.ADMIN}/audit`, labelKey: 'navActivityAudit', perm: PERMISSIONS.AUDIT_READ, icon: 'list' },
      { path: `${ROUTES.ADMIN}/inbox`, labelKey: 'navStaffNotifications', icon: 'bell' },
      { path: ROUTES.PROFILE, labelKey: 'navProfileSecurity', icon: 'profile' },
    ],
  },
  {
    id: 'dashboard',
    labelKey: 'navGroupDashboard',
    icon: 'dashboard',
    items: [
      { path: ROUTES.ADMIN, labelKey: 'executiveDashboard', perm: PERMISSIONS.ANALYTICS_READ, icon: 'chart', end: true },
      { path: `${ROUTES.ADMIN}/analytics`, labelKey: 'analytics', perm: PERMISSIONS.ANALYTICS_READ, icon: 'chart' },
      { path: `${ROUTES.ADMIN}/monitoring`, labelKey: 'monitoring', perm: PERMISSIONS.ANALYTICS_READ, icon: 'pulse' },
      { path: `${ROUTES.ADMIN}/platform-ops`, labelKey: 'platformHealth', perm: PERMISSIONS.ANALYTICS_READ, icon: 'health' },
      { path: `${ROUTES.ADMIN}/growth-dashboard`, labelKey: 'platformOperations', perm: PERMISSIONS.ANALYTICS_READ, icon: 'ops' },
    ],
  },
  {
    id: 'content',
    labelKey: 'navGroupContent',
    icon: 'content',
    items: [
      { path: `${ROUTES.ADMIN}/jobs`, labelKey: 'jobs', perm: [PERMISSIONS.CONTENT_JOBS, PERMISSIONS.MODERATE_JOBS], icon: 'briefcase' },
      { path: `${ROUTES.ADMIN}/scholarships`, labelKey: 'scholarships', perm: PERMISSIONS.CONTENT_SCHOLARSHIPS, icon: 'award' },
      { path: `${ROUTES.ADMIN}/admissions`, labelKey: 'admissions', perm: PERMISSIONS.CONTENT_ADMISSIONS, icon: 'graduation' },
      { path: `${ROUTES.ADMIN}/blogs`, labelKey: 'blogs', perm: PERMISSIONS.CONTENT_BLOGS, icon: 'document' },
      { path: `${ROUTES.ADMIN}/career-guidance`, labelKey: 'careerArticles', perm: PERMISSIONS.CONTENT_CAREER, icon: 'compass' },
      { path: `${ROUTES.ADMIN}/foreign-studies`, labelKey: 'foreignStudies', perm: PERMISSIONS.CONTENT_FOREIGN, icon: 'globe' },
      { path: `${ROUTES.ADMIN}/internships`, labelKey: 'internships', perm: PERMISSIONS.CONTENT_JOBS, icon: 'users' },
      { path: `${ROUTES.ADMIN}/universities`, labelKey: 'universities', perm: PERMISSIONS.CONTENT_UNIVERSITIES, icon: 'building' },
      { path: `${ROUTES.ADMIN}/education/institutions`, labelKey: 'educationInstitutions', perm: PERMISSIONS.CONTENT_UNIVERSITIES, icon: 'school' },
      { path: `${ROUTES.ADMIN}/programs`, labelKey: 'programs', perm: PERMISSIONS.CONTENT_UNIVERSITIES, icon: 'graduation' },
      { path: `${ROUTES.ADMIN}/education/scholarships`, labelKey: 'educationScholarships', perm: PERMISSIONS.CONTENT_UNIVERSITIES, icon: 'award' },
      { path: `${ROUTES.ADMIN}/international-scholarships`, labelKey: 'intlScholarships', perm: PERMISSIONS.CONTENT_SCHOLARSHIPS, icon: 'globe' },
      { path: `${ROUTES.ADMIN}/institutions`, labelKey: 'institutions', perm: PERMISSIONS.CONTENT_ADMISSIONS, icon: 'school' },
      { path: `${ROUTES.ADMIN}/companies`, labelKey: 'companies', perm: PERMISSIONS.CONTENT_COMPANIES, icon: 'office' },
      { path: `${ROUTES.ADMIN}/webinars`, labelKey: 'webinars', perm: PERMISSIONS.CONTENT_BLOGS, icon: 'video' },
      { path: `${ROUTES.ADMIN}/education/tests`, labelKey: 'navTestsProviders', perm: PERMISSIONS.CONTENT_ADMISSIONS, icon: 'graduation' },
      { path: `${ROUTES.ADMIN}/education/test-acceptance`, labelKey: 'navTestAcceptance', perm: PERMISSIONS.CONTENT_ADMISSIONS, icon: 'clipboard' },
      { path: `${ROUTES.ADMIN}/exam-preparation`, labelKey: 'examPreparation', perm: PERMISSIONS.CONTENT_MCQS, icon: 'clipboard' },
      { path: `${ROUTES.ADMIN}/site-cms`, labelKey: 'siteCms', perm: [PERMISSIONS.CONTENT_SITE, PERMISSIONS.CONTENT_NAV, PERMISSIONS.CONTENT_PAGES], icon: 'cms' },
      { path: `${ROUTES.ADMIN}/page-builder`, labelKey: 'pageBuilder', perm: PERMISSIONS.CONTENT_SITE, icon: 'content', end: true },
      { path: `${ROUTES.ADMIN}/page-builder/history`, labelKey: 'pageBuilderHistory', perm: PERMISSIONS.CONTENT_SITE, icon: 'content' },
      { path: `${ROUTES.ADMIN}/page-builder/templates`, labelKey: 'blockTemplates', perm: PERMISSIONS.CONTENT_SITE, icon: 'content' },
      { path: `${ROUTES.ADMIN}/page-builder/global-blocks`, labelKey: 'globalBlocks', perm: PERMISSIONS.CONTENT_SITE, icon: 'content' },
      { path: `${ROUTES.ADMIN}/search`, labelKey: 'globalSearch', perm: PERMISSIONS.CONTENT_SITE, icon: 'search' },
      { path: `${ROUTES.ADMIN}/media`, labelKey: 'mediaLibrary', perm: PERMISSIONS.CONTENT_SITE, icon: 'content' },
      { path: `${ROUTES.ADMIN}/forms`, labelKey: 'forms', perm: PERMISSIONS.CONTENT_SITE, icon: 'content' },
      { path: `${ROUTES.ADMIN}/forms/submissions`, labelKey: 'formSubmissions', perm: PERMISSIONS.USERS_READ, icon: 'content' },
    ],
  },
  {
    id: 'users',
    labelKey: 'navGroupUsers',
    icon: 'users',
    items: [
      { path: `${ROUTES.ADMIN}/users`, labelKey: 'users', perm: PERMISSIONS.USERS_READ, icon: 'user' },
      { path: `${ROUTES.ADMIN}/employers`, labelKey: 'employers', perm: PERMISSIONS.USERS_READ, icon: 'building' },
      { path: `${ROUTES.ADMIN}/invitations`, labelKey: 'staffInvitations', perm: PERMISSIONS.USERS_MANAGE, icon: 'invite' },
      { path: `${ROUTES.ADMIN}/contact-messages`, labelKey: 'contactMessages', perm: PERMISSIONS.USERS_READ, icon: 'mail' },
    ],
  },
  {
    id: 'revenue',
    labelKey: 'navGroupRevenue',
    icon: 'revenue',
    items: [
      { path: `${ROUTES.ADMIN}/payments`, labelKey: 'payments', perm: PERMISSIONS.PAYMENTS_READ, icon: 'credit' },
      { path: `${ROUTES.ADMIN}/advertisements`, labelKey: 'advertisements', perm: PERMISSIONS.MODERATE_ADS, icon: 'megaphone' },
      { path: `${ROUTES.ADMIN}/newsletter`, labelKey: 'newsletterAdmin', perm: PERMISSIONS.NOTIFICATIONS_SEND, icon: 'newsletter' },
    ],
  },
  {
    id: 'tools',
    labelKey: 'navGroupTools',
    icon: 'tools',
    items: [
      { path: `${ROUTES.ADMIN}/ai-job-generator`, labelKey: 'aiJobGenerator', perm: PERMISSIONS.CONTENT_JOBS, icon: 'sparkles' },
      { path: `${ROUTES.ADMIN}/import`, labelKey: 'import', perm: PERMISSIONS.CONTENT_IMPORT, icon: 'upload' },
      { path: `${ROUTES.ADMIN}/notifications`, labelKey: 'navBroadcastNotifications', perm: PERMISSIONS.NOTIFICATIONS_SEND, icon: 'bell' },
      { path: `${ROUTES.ADMIN}/announcements`, labelKey: 'navAnnouncements', perm: PERMISSIONS.NOTIFICATIONS_SEND, icon: 'megaphone' },
      { path: `${ROUTES.ADMIN}/alerts`, labelKey: 'alerts', perm: PERMISSIONS.NOTIFICATIONS_SEND, icon: 'alert' },
    ],
  },
]);

const STORAGE_KEY = 'admin-nav-expanded';

/** Legacy route alias — highlights Audit Log in sidebar. */
const PATH_ALIASES = {
  [`${ROUTES.ADMIN}/activity`]: `${ROUTES.ADMIN}/audit`,
};

export function resolveAdminPath(pathname) {
  return PATH_ALIASES[pathname] || pathname;
}

export function isAdminNavItemActive(item, pathname) {
  const resolved = resolveAdminPath(pathname);
  if (item.end || item.path === ROUTES.ADMIN) {
    return resolved === item.path || resolved === `${item.path}/`;
  }
  return resolved === item.path || resolved.startsWith(`${item.path}/`);
}

export function itemAllowed(item, can) {
  if (!item.perm) return true;
  if (Array.isArray(item.perm)) return item.perm.some((p) => can(p));
  return can(item.perm);
}

export function filterAdminNavGroups(groups, can) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => itemAllowed(item, can)),
    }))
    .filter((group) => group.items.length > 0);
}

export function groupContainsActivePath(group, pathname, can) {
  const visible = group.items.filter((item) => itemAllowed(item, can));
  return visible.some((item) => isAdminNavItemActive(item, pathname));
}

export function readExpandedGroups(defaultIds) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(defaultIds);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {
    /* ignore */
  }
  return new Set(defaultIds);
}

export function writeExpandedGroups(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export { STORAGE_KEY as ADMIN_NAV_STORAGE_KEY };
