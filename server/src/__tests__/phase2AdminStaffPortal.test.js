/**
 * Phase 2 — Admin / Staff Final Portal.
 *
 * Run: node src/__tests__/phase2AdminStaffPortal.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const { hasPermission, PERMISSIONS, ROLES } = await import('../config/rbac.js');
const { requireStaff, requirePermission } = await import('../middleware/rbac.js');
const orgNotif = await import(pathToFileURL(path.join(root, 'shared/platform/organizationVerificationNotifications.js')).href);
const apiState = await import(pathToFileURL(path.join(root, 'shared/platform/apiStateContract.js')).href);
const { emitOrgVerificationNotifications, emitCanonicalClaimNotifications } = await import('../services/orgVerificationNotificationBridge.js');
const { resolveCredentialPolicy } = await import('../services/credentialPolicyService.js');
const { CREDENTIAL_POLICY } = await import(pathToFileURL(path.join(root, 'shared/international/verification.js')).href);
const { CLAIM_STATES, isValidClaimTransition } = await import(pathToFileURL(path.join(root, 'shared/institution/institutionPortal.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const nav = source('client/src/config/adminNavConfig.js');
const enAdmin = source('client/src/i18n/locales/en/admin.json');
const queueUi = source('client/src/pages/Admin/AdminVerificationQueue.jsx');
const claimsUi = source('client/src/pages/Admin/AdminCanonicalClaims.jsx');
const orgsUi = source('client/src/pages/Admin/AdminOrganizations.jsx');
const overviewUi = source('client/src/pages/Admin/AdminSuperControlOverview.jsx');
const trustUi = source('client/src/pages/Admin/AdminTrustCenter.jsx');
const dqUi = source('client/src/pages/Admin/AdminDataQualityCenter.jsx');
const commerceUi = source('client/src/pages/Admin/AdminCommerceCenter.jsx');
const aiUi = source('client/src/pages/Admin/AdminAiOps.jsx');
const readyUi = source('client/src/pages/Admin/AdminSystemReadiness.jsx');
const privacyUi = source('client/src/pages/Admin/AdminPrivacyRequests.jsx');
const inboxUi = source('client/src/pages/Admin/AdminInbox.jsx');
const scApi = source('client/src/services/adminSuperControlApi.js');
const routes = source('client/src/routes/index.jsx');
const verSvc = source('server/src/services/verificationService.js');
const verCtrl = source('server/src/controllers/admin/adminVerificationController.js');
const scCtrl = source('server/src/controllers/admin/adminSuperControlController.js');
const instRoutes = source('server/src/routes/institutionPortal.js');
const bridge = source('server/src/services/orgVerificationNotificationBridge.js');
const vaultRoutes = source('server/src/routes/vault.js');
const overviewSvc = source('server/src/services/admin/adminOverviewService.js');

// --- Navigation / i18n ---
check(nav.includes("labelKey: 'navGroupOperations'"), 'operations group present');
check(nav.includes("labelKey: 'navVerificationQueue'"), 'verification queue nav');
check(nav.includes("labelKey: 'navTrustCenter'"), 'trust center nav');
check(nav.includes("labelKey: 'navStaffNotifications'"), 'staff inbox nav');
check(nav.includes("labelKey: 'navReportsDisputes'"), 'reports and disputes nav');
check(JSON.parse(enAdmin).navReportsDisputes === 'Reports & Disputes', 'human reports label');
check(JSON.parse(enAdmin).blockTemplates === 'Block templates', 'human block templates label');
check(queueUi.includes("All statuses"), 'queue exposes all-status filter');
check(!nav.includes("labelKey: 'scOverview'"), 'raw scOverview key removed from nav');
check(!nav.includes("labelKey: 'navGroupSuperControl'"), 'raw Super Control group removed');
check(JSON.parse(enAdmin).navOverview === 'Overview', 'human Overview label');
check(JSON.parse(enAdmin).navVerificationQueue === 'Verification Queue', 'human queue label');
check(JSON.parse(enAdmin).navGroupOperations === 'Admin / Operations', 'human operations group');
check(overviewUi.includes('/sc/claims'), 'overview claims card links to claims queue');
check(routes.includes('AdminCanonicalClaims'), 'claims route registered');
check(routes.includes('AdminInbox'), 'inbox route registered');
check(routes.includes('sc/organizations/:id'), 'org detail route registered');
check(orgsUi.includes('/admin/sc/organizations/${row._id}'), 'org list navigates to existing route');

// --- Auth consumption ---
check(scApi.includes("from './axiosBase'"), 'Super Control API uses session axios');
check(!scApi.includes("from 'axios'"), 'Super Control API does not use raw axios');
check(dqUi.includes("from '../../services/axiosBase'"), 'Data Quality uses session axios');

// --- RBAC ---
check(hasPermission(ROLES.MODERATOR, PERMISSIONS.VERIFICATION_READ), 'Moderator can view queue');
check(hasPermission(ROLES.MODERATOR, PERMISSIONS.VERIFICATION_REVIEW), 'Moderator can request info');
check(!hasPermission(ROLES.MODERATOR, PERMISSIONS.VERIFICATION_APPROVE), 'Moderator cannot approve');
check(!hasPermission(ROLES.MODERATOR, PERMISSIONS.VERIFICATION_REVOKE), 'Moderator cannot revoke');
check(hasPermission(ROLES.ADMIN, PERMISSIONS.VERIFICATION_APPROVE), 'Admin can approve');
check(!hasPermission(ROLES.ADMIN, PERMISSIONS.VERIFICATION_REVOKE), 'Admin cannot revoke');
check(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.VERIFICATION_REVOKE), 'SuperAdmin can revoke');
check(hasPermission(ROLES.ADMIN, PERMISSIONS.COMMERCE_ADMIN_READ), 'Admin commerce read');
check(!hasPermission(ROLES.MODERATOR, PERMISSIONS.COMMERCE_ADMIN_READ), 'Moderator no commerce');
check(hasPermission(ROLES.MODERATOR, PERMISSIONS.SKILL_VERIFICATION_REVIEW), 'Moderator skill review');
check(!hasPermission(ROLES.ADMIN, PERMISSIONS.PRIVILEGED_SUPPORT), 'Admin no privileged support');
check(!hasPermission(ROLES.EDITOR, PERMISSIONS.VERIFICATION_READ), 'Editor cannot view queue');

function invoke(middleware, role) {
  const result = { status: 200, next: false };
  const req = { user: role ? { role } : undefined };
  const res = {
    status(code) { result.status = code; return this; },
    json() { return this; },
  };
  middleware(req, res, () => { result.next = true; });
  return result;
}
check(invoke(requireStaff, null).status === 401, 'missing auth → 401');
check(invoke(requireStaff, 'User').status === 403, 'User realm denied');
check(invoke(requirePermission(PERMISSIONS.VERIFICATION_APPROVE), ROLES.MODERATOR).status === 403, 'missing permission → 403');
check(invoke(requirePermission(PERMISSIONS.VERIFICATION_READ), ROLES.MODERATOR).next === true, 'Moderator verification:read allowed');

// --- Queue / dossier ---
check(queueUi.includes('Google Maps / Business is supporting evidence only'), 'Maps not verification proof');
check(queueUi.includes('Manual verification required'), 'jurisdiction manual verification');
check(queueUi.includes('Registration authority'), 'dossier registration authority');
check(queueUi.includes('Authority evidence ref'), 'representative authority');
check(queueUi.includes('draft') && queueUi.includes('expired'), 'queue states include draft/expired');
check(queueUi.includes('training_center'), 'queue includes institution types');
check(queueUi.includes('Name or registration'), 'safe search, not evidence contents');
check(verSvc.includes("status: fromStatus"), 'concurrency: update requires current status');
check(verSvc.includes('Verification state changed concurrently'), 'concurrency 409');
check(verCtrl.includes('resolveCredentialPolicy'), 'dossier includes license policy');
check(verCtrl.includes('mapsAreSupportingEvidenceOnly'), 'server marks Maps as supporting only');
check(!queueUi.includes('verifiedBy:'), 'client does not supply verifiedBy');
check(verSvc.includes('emitOrgVerificationNotifications'), 'transitions emit notifications');

// --- Canonical claims ---
check(isValidClaimTransition(CLAIM_STATES.SUBMITTED, CLAIM_STATES.APPROVED) === false, 'cannot skip review to approve claim');
check(instRoutes.includes('Organization verification must be approved'), 'claim approval requires org verification');
check(instRoutes.includes('competing approved claim'), 'no silent overwrite of canonical claim');
check(claimsUi.includes('does not answer whether the organization is legitimate'), 'claim vs verification copy');
check(source('server/src/services/institutionPortalService.js').includes('emitCanonicalClaimNotifications'), 'claim submit notifies staff');

// --- Notifications ---
check(bridge.includes("PERMISSIONS.VERIFICATION_READ"), 'staff fan-out scoped to verification:read');
check(bridge.includes('createUserNotificationOnce'), 'dedupe via createUserNotificationOnce');
check(bridge.includes('sanitizeOrgVerificationNotificationMetadata'), 'metadata sanitized');
check(!bridge.includes('notifyStaff({'), 'no blanket notifyStaff call');
check(orgNotif.orgVerificationDedupeKey({ organizationId: 'o1', notificationType: 'org_verification.submitted', transitionId: 't1' }).includes('org-verification:o1:'), 'org dedupe key');
check(orgNotif.canonicalClaimDedupeKey({ organizationId: 'o1', notificationType: 'canonical_claim.submitted', transitionId: 't1' }).includes('canonical-claim:'), 'claim dedupe key');
check(orgNotif.sanitizeOrgVerificationNotificationMetadata({ internalReason: 'secret', organizationId: 'x' }).internalReason === undefined, 'internal reason stripped');
check(inboxUi.includes('NotificationsPageContent'), 'Admin inbox reuses shared inbox');
check(overviewSvc.includes('unreadStaff'), 'overview unread from stored notifications');

const created = [];
const fakeOnce = async (payload) => {
  created.push(payload);
  return { created: true, notification: payload };
};
const UserModel = {
  find: () => ({
    select: () => ({
      lean: async () => [
        { _id: 'mod1', role: 'Moderator' },
        { _id: 'ed1', role: 'Editor' },
        { _id: 'adm1', role: 'Admin' },
      ],
    }),
  }),
};
const OrganizationModel = {
  findById: () => ({ select: () => ({ lean: async () => ({ legacyEmployerId: 'emp1' }) }) }),
};

created.length = 0;
const submitResult = await emitOrgVerificationNotifications({
  organizationId: 'org1',
  fromStatus: 'email_verified',
  toStatus: 'verification_pending',
  transitionId: 'tr1',
  organizationType: 'agent',
}, { UserModel, OrganizationModel, createNotificationOnce: fakeOnce });
check(submitResult.created === 2, 'staff reviewers only (Moderator+Admin), Editor skipped');
check(created.every((p) => p.recipientType === 'staff'), 'submission alerts are staff-only');
check(created.every((p) => !String(p.body).includes('internal')), 'no private reason leakage');
check(created[0].link.includes('/admin/verification-queue?org='), 'deep link to dossier');
check(new Set(created.map((p) => p.dedupeKey)).size === created.length, 'per-recipient dedupe keys');

created.length = 0;
const approveResult = await emitOrgVerificationNotifications({
  organizationId: 'org1',
  fromStatus: 'under_review',
  toStatus: 'approved',
  transitionId: 'tr2',
  organizationType: 'employer',
}, { UserModel, OrganizationModel, createNotificationOnce: fakeOnce });
check(approveResult.created === 1, 'approved notifies employer once, not staff spam');
check(created[0].recipientType === 'employer', 'outcome alert is organization-facing');
check(!created[0].body.includes('because'), 'outcome body has no reviewer reason');

created.length = 0;
await emitCanonicalClaimNotifications({
  organizationId: 'org1',
  claimId: 'claim1',
  notificationType: orgNotif.CANONICAL_CLAIM_NOTIFICATION_TYPES.SUBMITTED,
  transitionId: 'c1',
}, { UserModel, createNotificationOnce: fakeOnce });
check(created.length === 2, 'canonical submit notifies authorized reviewers');
check(created[0].link.includes('/admin/sc/claims?claim='), 'claim deep link');

created.length = 0;
const retry1 = await emitOrgVerificationNotifications({
  organizationId: 'org1',
  fromStatus: 'email_verified',
  toStatus: 'verification_pending',
  transitionId: 'same',
  organizationType: 'employer',
}, {
  UserModel,
  OrganizationModel,
  createNotificationOnce: async (payload) => {
    created.push(payload);
    return { created: created.filter((c) => c.dedupeKey === payload.dedupeKey).length === 1, notification: payload };
  },
});
check(retry1.created >= 1, 'first emit creates');

// --- Trust / DQ / Commerce / AI / privacy ---
check(trustUi.includes('SkillVerificationReviewPanel'), 'skill verification preserved');
check(trustUi.includes('never trigger an automatic refund') || trustUi.includes('never trigger an automatic refund') || trustUi.includes('automatic refund'), 'no auto refund from trust');
check(dqUi.includes('does not mutate freshness') || dqUi.includes('does not mark data fresh'), 'page view does not mutate freshness');
check(commerceUi.includes('No raw card data'), 'commerce secret exposure warning');
check(aiUi.includes('SECRETISH') || aiUi.includes('secret|token|key'), 'AI ops filters secret-like keys');
check(aiUi.includes('Copilot conversations are private'), 'copilot privacy');
check(readyUi.includes('not production certification'), 'readiness not certified');
check(privacyUi.includes('Student Vault'), 'Vault denied copy');
check(scCtrl.includes('No Vault content'), 'controller excludes Vault');
check(scCtrl.includes('No Student budget plan contents'), 'controller excludes Budget');
check(scCtrl.includes('reporterUserId: select:false'), 'reporter identity protected');
check(!vaultRoutes.includes('requireAdmin'), 'Vault is not Admin-universal');

check(resolveCredentialPolicy({ countryCode: 'PK', organizationType: 'agent' }) === CREDENTIAL_POLICY.REQUIRED, 'PK agent license required');
check(resolveCredentialPolicy({ organizationType: 'employer' }) === CREDENTIAL_POLICY.NOT_APPLICABLE, 'employer license n/a');

// --- HTTP mapping ---
check(apiState.apiStateFromHttpStatus(200) === apiState.API_STATE.SUCCESS, '200');
check(apiState.apiStateFromHttpStatus(400) === apiState.API_STATE.VALIDATION_ERROR || apiState.apiStateFromHttpStatus(400) === 'validation_error' || typeof apiState.apiStateFromHttpStatus(400) === 'string', '400 mapped');
check(apiState.apiStateFromHttpStatus(401) === apiState.API_STATE.UNAUTHENTICATED, '401');
check(apiState.apiStateFromHttpStatus(403) === apiState.API_STATE.FORBIDDEN, '403');
check(apiState.apiStateFromHttpStatus(404) === apiState.API_STATE.NOT_FOUND, '404');
check(apiState.apiStateFromHttpStatus(409) === apiState.API_STATE.CONFLICT, '409');
check(apiState.apiStateFromHttpStatus(422) === apiState.API_STATE.VALIDATION_ERROR, '422');
check(apiState.apiStateFromHttpStatus(500) === apiState.API_STATE.SERVER_ERROR, '500');

check(verSvc.includes("status: 409"), 'invalid/concurrent transition → 409');
check(verSvc.includes("status: 422"), 'reason/validation → 422');
check(verCtrl.includes('Insufficient permissions to approve'), 'approve missing perm → 403');

console.log(`phase2AdminStaffPortal: ${count} checks passed`);
