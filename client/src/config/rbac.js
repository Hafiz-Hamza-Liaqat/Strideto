/** Client mirror of server RBAC — keep in sync with server/src/config/rbac.js */

export const ROLES = {
  STUDENT: 'User',
  EDITOR: 'Editor',
  MODERATOR: 'Moderator',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'SuperAdmin',
};

export const STAFF_ROLES = [
  ROLES.EDITOR,
  ROLES.MODERATOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

export const PERMISSIONS = {
  CONTENT_JOBS: 'content:jobs',
  CONTENT_SCHOLARSHIPS: 'content:scholarships',
  CONTENT_ADMISSIONS: 'content:admissions',
  CONTENT_BLOGS: 'content:blogs',
  CONTENT_CAREER: 'content:career',
  CONTENT_FOREIGN: 'content:foreign',
  CONTENT_UNIVERSITIES: 'content:universities',
  CONTENT_COMPANIES: 'content:companies',
  CONTENT_TEMPLATES: 'content:templates',
  CONTENT_MCQS: 'content:mcqs',
  CONTENT_IMPORT: 'content:import',
  CONTENT_SITE: 'content:site',
  CONTENT_PAGES: 'content:pages',
  CONTENT_NAV: 'content:navigation',
  CONTENT_CMS_PUBLISH: 'content:cms:publish',
  MODERATE_JOBS: 'moderate:jobs',
  MODERATE_EMPLOYERS: 'moderate:employers',
  MODERATE_REPORTS: 'moderate:reports',
  MODERATE_ADS: 'moderate:ads',
  MODERATE_SUSPEND: 'moderate:suspend',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  PAYMENTS_READ: 'payments:read',
  EXPORT_DATA: 'export:data',
  ANALYTICS_READ: 'analytics:read',
  AUDIT_READ: 'audit:read',
  SCRAPER_RUN: 'system:scraper',
  NOTIFICATIONS_SEND: 'system:notifications',
  WORKFLOW_VIEW: 'workflow:view',
  WORKFLOW_REVIEW: 'workflow:review',
  WORKFLOW_APPROVE: 'workflow:approve',
  WORKFLOW_PUBLISH: 'workflow:publish',
  WORKFLOW_SCHEDULE: 'workflow:schedule',
  WORKFLOW_MANAGE: 'workflow:manage',
  // Verification (Mission 2)
  VERIFICATION_READ: 'verification:read',
  VERIFICATION_REVIEW: 'verification:review',
  VERIFICATION_APPROVE: 'verification:approve',
  VERIFICATION_REVOKE: 'verification:revoke',

  // Applicant skill claim verification — mirrors server/src/config/rbac.js.
  // Distinct from organization verification: checking a person's portfolio
  // link is a different authority from approving a company's registration.
  SKILL_VERIFICATION_READ: 'skill_verification:read',
  SKILL_VERIFICATION_REVIEW: 'skill_verification:review',
  SKILL_VERIFICATION_APPROVE: 'skill_verification:approve',
  SKILL_VERIFICATION_REVOKE: 'skill_verification:revoke',

  // Super Control Center (Mission 21)
  ORGANIZATIONS_READ: 'admin.organizations.read',
  ORGANIZATIONS_MANAGE: 'admin.organizations.manage',
  TRUST_TRIAGE: 'admin.trust.triage',
  TRUST_RESOLVE: 'admin.trust.resolve',
  CONSULTATION_META_READ: 'admin.consultation.meta.read',
  CASE_META_READ: 'admin.case.meta.read',
  COMMERCE_ADMIN_READ: 'admin.commerce.admin.read',
  RECONCILIATION_MANAGE: 'admin.reconciliation.manage',
  DATA_QUALITY_MANAGE: 'admin.data_quality.manage',
  AI_OPS_READ: 'admin.ai.ops.read',
  SYSTEM_READ: 'admin.system.read',

  USERS_DELETE: 'users:delete',
  ROLES_ASSIGN: 'roles:assign',
  SYSTEM_SETTINGS: 'system:settings',
  SYSTEM_SECRETS: 'system:secrets',
  PRIVILEGED_SUPPORT: 'admin.privileged_support',
  CAPABILITY_OVERRIDE: 'capability:override',
  INVESTOR_READ: 'investor:read',
};

/**
 * Permissions reserved for SuperAdmin. Single source of truth for both the
 * Admin permission list and `hasPermission` — these were two hand-maintained
 * copies, and a permission added to one but missed in the other silently
 * grants the wrong role. Mirrors SUPER_ADMIN_ONLY_PERMISSIONS on the server.
 */
const SUPER_ADMIN_ONLY_PERMISSIONS = [
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.ROLES_ASSIGN,
  PERMISSIONS.SYSTEM_SETTINGS,
  PERMISSIONS.SYSTEM_SECRETS,
  PERMISSIONS.VERIFICATION_REVOKE,
  PERMISSIONS.SKILL_VERIFICATION_REVOKE,
  PERMISSIONS.PRIVILEGED_SUPPORT,
  PERMISSIONS.CAPABILITY_OVERRIDE,
  PERMISSIONS.INVESTOR_READ,
];

const ROLE_PERMISSIONS = {
  [ROLES.EDITOR]: [
    PERMISSIONS.CONTENT_JOBS,
    PERMISSIONS.CONTENT_SCHOLARSHIPS,
    PERMISSIONS.CONTENT_ADMISSIONS,
    PERMISSIONS.CONTENT_BLOGS,
    PERMISSIONS.CONTENT_CAREER,
    PERMISSIONS.CONTENT_FOREIGN,
    PERMISSIONS.CONTENT_UNIVERSITIES,
    PERMISSIONS.CONTENT_COMPANIES,
    PERMISSIONS.CONTENT_TEMPLATES,
    PERMISSIONS.CONTENT_MCQS,
    PERMISSIONS.CONTENT_IMPORT,
    PERMISSIONS.CONTENT_SITE,
    PERMISSIONS.CONTENT_PAGES,
    PERMISSIONS.CONTENT_NAV,
    PERMISSIONS.WORKFLOW_VIEW,
    PERMISSIONS.ANALYTICS_READ,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.MODERATE_JOBS,
    PERMISSIONS.MODERATE_EMPLOYERS,
    PERMISSIONS.MODERATE_REPORTS,
    PERMISSIONS.MODERATE_ADS,
    PERMISSIONS.MODERATE_SUSPEND,
    PERMISSIONS.CONTENT_SITE,
    PERMISSIONS.CONTENT_PAGES,
    PERMISSIONS.CONTENT_NAV,
    PERMISSIONS.CONTENT_CMS_PUBLISH,
    PERMISSIONS.WORKFLOW_VIEW,
    PERMISSIONS.WORKFLOW_REVIEW,
    PERMISSIONS.WORKFLOW_APPROVE,
    PERMISSIONS.WORKFLOW_PUBLISH,
    PERMISSIONS.WORKFLOW_SCHEDULE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.VERIFICATION_READ,
    PERMISSIONS.VERIFICATION_REVIEW,
    // Skill claims: Moderator may inspect, request info, reject and mark
    // evidence-backed — but not issue a verified skill. Approval is a
    // deliberately higher bar than triage.
    PERMISSIONS.SKILL_VERIFICATION_READ,
    PERMISSIONS.SKILL_VERIFICATION_REVIEW,
    // Super Control Center: Moderator bounded inspection
    PERMISSIONS.ORGANIZATIONS_READ,
    PERMISSIONS.TRUST_TRIAGE,
    PERMISSIONS.CONSULTATION_META_READ,
    PERMISSIONS.CASE_META_READ,
    PERMISSIONS.AI_OPS_READ,
    PERMISSIONS.SYSTEM_READ,
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter(
    (p) => !SUPER_ADMIN_ONLY_PERMISSIONS.includes(p)
  ),
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
};

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function getPermissionsForRole(role) {
  if (role === ROLES.ADMIN) return [...ROLE_PERMISSIONS[ROLES.ADMIN]];
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  if (role === ROLES.SUPER_ADMIN) return true;
  if (role === ROLES.ADMIN) {
    if (SUPER_ADMIN_ONLY_PERMISSIONS.includes(permission)) return false;
    return true;
  }
  return getPermissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role, permissions) {
  return permissions.some((p) => hasPermission(role, p));
}
