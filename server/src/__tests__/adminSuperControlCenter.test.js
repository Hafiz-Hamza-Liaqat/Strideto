/**
 * Mission 21 — Admin Super-Control Center verification.
 * Pure contract/security tests: no DB, network, providers, workers, or live actions.
 * Run: node src/__tests__/adminSuperControlCenter.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = rel => readFileSync(path.join(root, rel), 'utf8');
const ctrl = source('server/src/controllers/admin/adminSuperControlController.js');
const routes = source('server/src/routes/adminSuperControl.js');
const adminRoutes = source('server/src/routes/admin.js');
const overview = source('server/src/services/admin/adminOverviewService.js');
const serverRbac = source('server/src/config/rbac.js');
const clientRbac = source('client/src/config/rbac.js');
const auditCtrl = source('server/src/controllers/admin/auditLogController.js');
const usersCtrl = source('server/src/controllers/admin/usersController.js');
const verificationRoutes = source('server/src/routes/adminVerification.js');
const institutionRoutes = source('server/src/routes/institutionPortal.js');
const freshnessRoutes = source('server/src/routes/adminFreshness.js');
const freshnessController = source('server/src/controllers/trust/adminFreshnessController.js');
const marketplaceRoutes = source('server/src/routes/adminAgentMarketplace.js');

function fnSource(name) {
  const start = ctrl.indexOf(`export const ${name} =`);
  assert.notEqual(start, -1, `${name} export missing`);
  const next = ctrl.indexOf('\nexport const ', start + 1);
  return ctrl.slice(start, next === -1 ? ctrl.length : next);
}

const { hasPermission, PERMISSIONS, ROLES } = await import('../config/rbac.js');
const { requireStaff, requirePermission } = await import('../middleware/rbac.js');

let passed = 0;
let failed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error });
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  }
}

function invoke(middleware, role) {
  const result = { status: 200, body: null, next: false };
  const req = { user: role ? { role } : undefined };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  middleware(req, res, () => { result.next = true; });
  return result;
}

console.log('\n=== Mission 21 — Admin Super-Control Center Tests ===\n');

await check('1. Admin realm authentication is required', () => {
  assert.equal(invoke(requireStaff, null).status, 401);
});
await check('2. User realm is denied', () => assert.equal(invoke(requireStaff, 'User').status, 403));
await check('3. Employer realm is denied', () => assert.equal(invoke(requireStaff, 'Employer').status, 403));
await check('4. Agent realm is denied', () => assert.equal(invoke(requireStaff, 'Agent').status, 403));
await check('5. Institution realm is denied', () => assert.equal(invoke(requireStaff, 'Institution').status, 403));
await check('6. Moderator permissions are bounded', () => {
  assert.equal(hasPermission(ROLES.MODERATOR, PERMISSIONS.TRUST_TRIAGE), true);
  assert.equal(hasPermission(ROLES.MODERATOR, PERMISSIONS.TRUST_RESOLVE), false);
  assert.equal(hasPermission(ROLES.MODERATOR, PERMISSIONS.COMMERCE_ADMIN_READ), false);
  assert.equal(hasPermission(ROLES.MODERATOR, PERMISSIONS.PRIVILEGED_SUPPORT), false);
});
await check('7. Admin permissions exclude super-only support', () => {
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.TRUST_RESOLVE), true);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.COMMERCE_ADMIN_READ), true);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.PRIVILEGED_SUPPORT), false);
});
await check('8. SuperAdmin has high-risk authority', () => {
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.PRIVILEGED_SUPPORT), true);
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.VERIFICATION_REVOKE), true);
});
await check('9. Client role forgery cannot satisfy server permission middleware', () => {
  const forged = invoke(requirePermission(PERMISSIONS.TRUST_RESOLVE), 'User');
  assert.equal(forged.status, 403);
  assert.equal(forged.next, false);
});
await check('10. Admin actor identity is server-derived', () => {
  assert.match(ctrl, /userId:\s*req\.user\?\.userId/);
  assert.doesNotMatch(ctrl, /actorId:\s*req\.body/);
});
await check('11. Overview uses persisted domain metrics', () => {
  assert.match(overview, /User\.countDocuments/);
  assert.match(overview, /Organization\.countDocuments/);
  assert.match(overview, /ProfessionalReport\.countDocuments/);
});
await check('12. Overview fabricates no trend/revenue/success metrics', () => {
  assert.doesNotMatch(overview, /revenue|successRate|admissionSuccessRate|trend:/i);
});
await check('13. Mission 2 verification queue is reused', () => {
  assert.match(adminRoutes, /adminVerificationRouter/);
  assert.match(overview, /OrganizationVerification/);
});
await check('14. Moderator severe verification action is denied', () => {
  assert.equal(hasPermission(ROLES.MODERATOR, PERMISSIONS.VERIFICATION_APPROVE), false);
  assert.equal(hasPermission(ROLES.MODERATOR, PERMISSIONS.VERIFICATION_REVOKE), false);
  assert.match(verificationRoutes, /VERIFICATION_APPROVE/);
});
await check('15. High-impact organization/report action requires authority and reason', () => {
  assert.match(routes, /trust\/reports\/:id'[\s\S]*TRUST_RESOLVE/);
  assert.match(fnSource('updateReport'), /reason is required/);
});
await check('16. Institution claim queue remains authoritative', () => {
  assert.match(institutionRoutes, /admin\/institution/);
  assert.match(overview, /InstitutionClaim\.countDocuments/);
});
await check('17. Education freshness aggregation is present', () => {
  assert.match(overview, /freshnessState:\s*'stale'/);
  assert.match(overview, /freshnessState:\s*'review_due'/);
});
await check('18. Stale and broken data are visible', () => {
  assert.match(overview, /staleFacts/);
  assert.match(overview, /brokenSources/);
  assert.match(freshnessRoutes, /trust\/metrics/);
  assert.match(freshnessController, /stale/);
  assert.match(freshnessController, /broken/);
});
await check('19. Conflict visibility is retained', () => {
  assert.match(overview, /InstitutionDataConflict\.countDocuments/);
  assert.match(overview, /openConflicts/);
});
await check('20. Marketplace moderation is reused', () => {
  assert.match(adminRoutes, /adminAgentMarketplaceRouter/);
  assert.match(overview, /AgentMarketplacePost\.countDocuments/);
  assert.match(marketplaceRoutes, /\/moderate/);
});
await check('21. Report/dispute queues expose safe projections', () => {
  assert.doesNotMatch(fnSource('listReports'), /\.select\([^)]*reporterUserId/);
  assert.doesNotMatch(fnSource('listDisputes'), /studentUserId|reporterUserId/);
});
await check('22. Reporter identity is protected', () => {
  assert.doesNotMatch(fnSource('listReports'), /\.select\([^)]*reporterUserId/);
});
await check('23. Consultation projection is operational only', () => {
  assert.match(ctrl, /CONSULTATION_SAFE_FIELDS/);
  assert.doesNotMatch(fnSource('listConsultations'), /\.select\([^)]*studentNote/);
});
await check('24. Private messages are hidden', () => {
  assert.doesNotMatch(fnSource('listConsultations'), /Message|messageBody|privateMessage/);
});
await check('25. Private case notes are hidden', () => {
  assert.doesNotMatch(fnSource('listCases'), /privateNote|agentNote|studentNote/);
});
await check('26. Vault contents are hidden', () => {
  assert.doesNotMatch(fnSource('listConsultations') + fnSource('listCases'), /VaultDocument|vault/i);
});
await check('27. Privileged investigation requires context, reason, purpose, and permission', () => {
  const src = fnSource('openPrivilegedInvestigation');
  assert.match(src, /PRIVILEGED_SUPPORT/);
  assert.match(src, /contextType/);
  assert.match(src, /reason.*purpose|purpose.*reason/s);
});
await check('28. Privileged investigation is audited', () => {
  const src = fnSource('openPrivilegedInvestigation');
  assert.match(src, /logAudit/);
  assert.match(src, /investigation_opened/);
});
await check('29. Commerce views use explicit safe projections', () => {
  assert.match(fnSource('listReconciliation'), /\.select\('/);
  assert.match(fnSource('listRefunds'), /\.select\('/);
});
await check('30. Ledger is immutable through Admin API', () => {
  assert.doesNotMatch(routes + ctrl, /editLedger|setBalance/);
});
await check('31. Admin cannot manually mark payment paid', () => assert.doesNotMatch(routes + ctrl, /markPaymentPaid/));
await check('32. Admin cannot manually mark refund complete', () => assert.doesNotMatch(routes + ctrl, /markRefundComplete/));
await check('33. Admin cannot manually mark payout paid', () => assert.doesNotMatch(routes + ctrl, /markPayoutPaid/));
await check('34. Refund initiation remains outside the control center', () => assert.doesNotMatch(routes + ctrl, /initiateRefund/));
await check('35. Reconciliation mismatch is visible', () => {
  assert.match(overview, /reconciliationMismatches/);
  assert.match(fnSource('listReconciliation'), /CommerceReconciliation/);
});
await check('36. Connect projection is safe', () => {
  const src = fnSource('listConnectAccounts');
  assert.match(src, /onboardingStatus/);
  assert.doesNotMatch(src, /\.select\([^)]*connectedAccountId/);
});
await check('37. Bank and KYC secrets are hidden', () => {
  assert.match(fnSource('listConnectAccounts'), /bank account details/);
  assert.match(fnSource('listConnectAccounts'), /KYC raw data/);
});
await check('38. Copilot conversations are hidden', () => assert.match(fnSource('getAiOpsStatus'), /individual student copilot conversations/));
await check('39. AI operational state is safe', () => {
  const src = fnSource('getAiOpsStatus');
  assert.match(src, /getCopilotProviderStatus/);
  assert.match(src, /no external provider call/);
});
await check('40. Student Budget plans are hidden', () => assert.doesNotMatch(ctrl + routes, /StudentCostPlan|BudgetPlan/));
await check('41. Audit listing is bounded', () => assert.match(auditCtrl, /Math\.min\(100/));
await check('42. Audit is immutable through the control center', () => assert.doesNotMatch(routes + ctrl, /deleteAudit|editAudit|rewriteAudit/));
await check('43. Audit overview uses a redacted allowlist', () => {
  assert.match(overview, /\.select\('actorEmail actorRole action targetType targetLabel status createdAt'\)/);
  assert.doesNotMatch(overview, /\.select\([^)]*(password|token|rawBody|before after)/i);
});
await check('44. No unsafe global-search endpoint was introduced', () => assert.doesNotMatch(routes, /global-search|\/search/));
await check('45. Search excludes Vault and messages', () => assert.doesNotMatch(routes + ctrl, /searchVault|searchMessages/));
await check('46. User pagination is bounded', () => assert.match(usersCtrl, /Math\.min\(100/));
await check('47. Organization pagination is bounded', () => assert.match(fnSource('listOrganizations'), /parsePagination/));
await check('48. Financial pagination is bounded', () => assert.match(fnSource('listReconciliation'), /parsePagination/));
await check('49. Organization sorting uses an allowlist', () => {
  const src = fnSource('listOrganizations');
  assert.match(src, /SAFE_SORT/);
  assert.match(src, /new Set/);
});
await check('50. Query and regex injection are constrained', () => {
  const src = fnSource('listOrganizations');
  assert.doesNotMatch(src, /\.find\(req\.query\)/);
  assert.match(src, /escapeRegex/);
  assert.match(ctrl, /function escapeRegex/);
});
await check('51. High-impact actions audit actor and reason', () => {
  const src = fnSource('resolveDispute') + fnSource('updateReport');
  assert.match(src, /actor\(req\)/);
  assert.match(src, /reason/);
  assert.match(src, /logAudit/);
});
await check('52. Overview avoids unbounded collection loads', () => {
  assert.match(overview, /countDocuments/);
  assert.doesNotMatch(overview, /\.find\(\)\.lean\(\)/);
  assert.match(overview, /\.limit\(5\)/);
});
await check('53. No Admin impersonation exists', () => assert.doesNotMatch(routes + ctrl, /loginAs|impersonat/i));
await check('54. No destructive bulk action exists', () => assert.doesNotMatch(routes + ctrl, /bulkSuspend|bulkDelete|deleteMany/));
await check('55. Country/rollout readiness is a safe projection', () => {
  const src = fnSource('getSystemReadiness');
  assert.match(src, /Persisted domain data|in-process config/);
  assert.doesNotMatch(src, /process\.env/);
});
await check('56. Environment values and secrets are not exposed', () => {
  const src = fnSource('getSystemReadiness');
  assert.match(src, /environment variable values/);
  assert.match(src, /Stripe keys/);
  assert.doesNotMatch(src, /process\.env/);
});
await check('57. Notification visibility causes no delivery', () => assert.doesNotMatch(routes + ctrl, /sendMail|sendEmail|sendSms|sendPush|deliverNotification/));
await check('58. No Stripe or provider calls are made', () => {
  assert.doesNotMatch(ctrl, /stripe\.|new Stripe|fetch\(|axios\./i);
  assert.match(fnSource('getAiOpsStatus'), /no external provider call/);
});
await check('59. No worker or live operation is started', () => assert.doesNotMatch(routes + ctrl, /startWorker|triggerScraper|worker\.start|queue\.process/));
await check('60. Accepted domain authority remains intact', () => {
  assert.match(adminRoutes, /adminVerificationRouter/);
  assert.match(adminRoutes, /adminEducationRouter/);
  assert.match(adminRoutes, /adminFreshnessRouter/);
  assert.match(adminRoutes, /adminAgentMarketplaceRouter/);
  assert.match(serverRbac, /PRIVILEGED_SUPPORT/);
  assert.match(clientRbac, /PRIVILEGED_SUPPORT/);
});

console.log(`\n  ${passed}/60 tests passed`);
if (failed) {
  console.error(`  ${failed} failed`);
  process.exitCode = 1;
} else {
  console.log('  Mission 21 verification passed.');
}
