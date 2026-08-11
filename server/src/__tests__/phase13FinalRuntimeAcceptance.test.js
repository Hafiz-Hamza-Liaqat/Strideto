import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Phase 13 — focused source contracts for defects found during real-runtime
 * acceptance. Live Docker/browser evidence lives in
 * docs/STRIDETO_PHASE_13_FINAL_REAL_RUNTIME_MULTI_ROLE_ACCEPTANCE.md.
 *
 * Run: node src/__tests__/phase13FinalRuntimeAcceptance.test.js
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const portalRoutes = read('server/src/routes/institutionPortal.js');

check(
  /adminInstitution\.patch\(\s*'\/claims\/:claimId',[\s\S]{0,200}?asyncHandler\(async \(req, res\) => \{/.test(
    portalRoutes
  ),
  'institutionPortal.js: canonical claim PATCH is wrapped in asyncHandler so validation errors cannot kill the replica'
);

check(
  !/CanonicalInstitution\.create\(\{\s*\.\.\.claim\.proposedCanonical/.test(portalRoutes),
  'institutionPortal.js: does not spread a Mongoose subdocument into CanonicalInstitution.create'
);

check(
  /const ci = await CanonicalInstitution\.create\(\{[\s\S]*?officialName,[\s\S]*?institutionType,/.test(portalRoutes),
  'institutionPortal.js: CanonicalInstitution.create sets officialName and institutionType explicitly'
);

check(
  /allowedTypes\.includes\(proposed\.institutionType\)/.test(portalRoutes)
    && /INSTITUTION_TYPES\.UNIVERSITY/.test(portalRoutes),
  'institutionPortal.js: institutionType falls back to a valid taxonomy value when the proposal omits it'
);

const quota = read('server/src/services/employer/employerPublishingQuota.js');
check(
  /overlayOrganizationVerification/.test(quota)
    && /ver\?\.status === 'approved'/.test(quota),
  'employerPublishingQuota.js: Admin-approved organization verification still overlays Employer hiring eligibility'
);

const inbox = read('server/src/routes/userInbox.js');
check(
  /userInboxRouter\.get\('\/inbox\/notifications', requireAuth, listUserNotifications\)/.test(inbox),
  'userInbox.js: GET /inbox/notifications is gated by requireAuth only (realm-agnostic)'
);

const pay = read('server/src/controllers/marketplacePaymentController.js');
check(
  /rejectAuthority/.test(pay)
    && /Client cannot set payment authority fields/.test(pay),
  'marketplacePaymentController.js: client cannot mass-assign paid/refund authority'
);

const docPath = path.join(root, 'docs/STRIDETO_PHASE_13_FINAL_REAL_RUNTIME_MULTI_ROLE_ACCEPTANCE.md');
check(existsSync(docPath), 'Phase 13 freeze document exists');
const doc = readFileSync(docPath, 'utf8');
check(/\*\*Phase 13 status: FROZEN\*\*/.test(doc), 'Phase 13 freeze document records FROZEN');

console.log(`phase13FinalRuntimeAcceptance.test.js: ${count} assertions passed`);
