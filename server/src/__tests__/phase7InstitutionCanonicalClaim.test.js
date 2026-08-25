/**
 * Phase 7 — Institution Canonical Claim UX + correction / resubmission.
 * Pure source/contract + shared state-machine tests. No live DB.
 *
 * Run: node server/src/__tests__/phase7InstitutionCanonicalClaim.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const portal = await import(pathToFileURL(path.join(root, 'shared/institution/institutionPortal.js')).href);
const svcMod = await import(pathToFileURL(path.join(root, 'server/src/services/institutionPortalService.js')).href);

const claimPage = source('client/src/pages/Institution/InstitutionClaim.jsx');
const portalCtrl = source('server/src/controllers/institutionPortalController.js');
const portalRoutes = source('server/src/routes/institutionPortal.js');
const portalSvc = source('server/src/services/institutionPortalService.js');
const claimModel = source('server/src/models/institution/InstitutionClaim.js');
const admissionSvc = source('server/src/services/institutionAdmissionService.js');
const adminClaimsUi = source('client/src/pages/Admin/AdminCanonicalClaims.jsx');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${label}: ${err.message}`);
  }
}

const S = portal.CLAIM_STATES;

console.log('\nPhase 7 — Institution Canonical Claim\n');

check('CLAIM-01: search-existing path requires selected canonicalInstitutionId before start', () => {
  assert.match(claimPage, /mode === 'search' && !selectedInstitution/);
  assert.match(claimPage, /canonicalInstitutionId: selectedInstitution\._id/);
  assert.match(portalSvc, /Either canonicalInstitutionId or proposedCanonical is required/);
});

check('CLAIM-02: no selected canonical result keeps Start claim blocked', () => {
  assert.match(claimPage, /disabled=\{busy \|\| \(mode === 'search' && !selectedInstitution\)\}/);
  assert.match(claimPage, /Select an existing canonical institution/);
});

check('CLAIM-03: no suitable match exposes Propose New Institution CTA', () => {
  assert.match(claimPage, /Propose New Institution/);
  assert.match(claimPage, /switchToPropose/);
  assert.match(claimPage, /No published match found/);
});

check('CLAIM-04: propose-new is review-controlled and does not auto-approve', () => {
  assert.match(claimPage, /proposedCanonical/);
  assert.match(claimPage, /does not auto-publish a canonical institution/);
  assert.match(portalSvc, /state: CLAIM_STATES\.DRAFT/);
  assert.equal(portal.isValidClaimTransition(S.DRAFT, S.APPROVED), false);
  // Canonical institution for propose-new is created only on admin approve path
  assert.match(portalRoutes, /CanonicalInstitution\.create/);
  assert.match(portalRoutes, /Organization verification must be approved before canonical claim approval/);
});

check('CLAIM-05: Verification Approved + Claim Not Started is valid independent combination', () => {
  assert.match(claimPage, /Organization verification remains separate/);
  assert.match(claimPage, /Canonical Claim Not Started is a valid independent state/);
  assert.match(claimPage, /verification === 'approved' && !claim/);
  assert.match(portalCtrl, /independentFromVerification: true/);
});

check('CLAIM-06: claim approval requires approved organization verification', () => {
  assert.match(portalRoutes, /Organization verification must be approved before canonical claim approval/);
  assert.match(portalRoutes, /verification\.status !== 'approved'/);
});

check('CLAIM-07: provider cannot approve own claim', () => {
  assert.equal(portal.isValidClaimTransition(S.DRAFT, S.APPROVED), false);
  assert.equal(portal.isValidClaimTransition(S.SUBMITTED, S.APPROVED), false);
  assert.equal(portal.isValidClaimTransition(S.NEEDS_INFORMATION, S.APPROVED), false);
  assert.match(claimPage, /cannot self-approve/i);
  assert.match(portalRoutes, /requirePermission\(PERMISSIONS\.VERIFICATION_APPROVE\)/);
  assert.doesNotMatch(portalRoutes, /portal\.post\('\/:organizationId\/claim\/:claimId\/approve'/);
});

check('CORRECTION-01: needs-information exposes provider-safe informationRequestReason', () => {
  assert.match(claimPage, /informationRequestReason/);
  assert.match(claimPage, /More information required/);
  assert.match(portalRoutes, /informationRequestReason/);
  assert.match(claimModel, /informationRequestReason/);
});

check('CORRECTION-02: provider can update evidence and resubmit same claim', () => {
  assert.match(portalSvc, /export async function updateClaimCorrection/);
  assert.match(portalRoutes, /claim\/:claimId.*portalCtrl\.updateClaim|portalCtrl\.updateClaim/);
  assert.match(claimPage, /updateClaim/);
  assert.match(claimPage, /Resubmit claim for review/);
  assert.match(portalSvc, /DRAFT, CLAIM_STATES\.NEEDS_INFORMATION/);
});

check('CORRECTION-03: resubmission / reopen does not create duplicate claim', () => {
  assert.match(portalSvc, /CLAIM_UPDATE_REQUIRED|CLAIM_REOPEN_REQUIRED/);
  assert.match(portalSvc, /export async function reopenRejectedClaim/);
  assert.match(portalSvc, /An open claim already exists\. Update and resubmit the existing claim/);
  assert.match(claimPage, /reopenClaim/);
});

check('CORRECTION-04: internal adminNotes are not exposed to institution', () => {
  const projected = svcMod.projectInstitutionClaim({
    _id: 'c1',
    state: S.NEEDS_INFORMATION,
    informationRequestReason: 'Attach governance page',
    rejectedReason: '',
    adminNotes: 'INTERNAL moderator suspicion notes',
    history: [{ reason: 'staff private', toState: S.NEEDS_INFORMATION }],
    authorityEvidenceUrls: ['https://example.edu/gov'],
  });
  assert.equal(projected.informationRequestReason, 'Attach governance page');
  assert.equal(projected.adminNotes, undefined);
  assert.equal(projected.history, undefined);
  assert.match(portalCtrl, /projectInstitutionClaim/);
});

check('STATE-01: invalid claim transitions are denied', () => {
  assert.equal(portal.isValidClaimTransition(S.APPROVED, S.DRAFT), false);
  assert.equal(portal.isValidClaimTransition(S.REJECTED, S.APPROVED), false);
  assert.equal(portal.isValidClaimTransition(S.SUBMITTED, S.DRAFT), false);
  assert.equal(portal.isValidClaimTransition(S.NEEDS_INFORMATION, S.SUBMITTED), true);
  assert.equal(portal.isValidClaimTransition(S.REJECTED, S.DRAFT), true);
  assert.match(portalRoutes, /isValidClaimTransition\(claim\.state, targetState\)/);
});

check('STATE-02: approved claim path does not mutate OrganizationVerification status', () => {
  // Approval may link Organization/CanonicalInstitution ids, but must not set verification status
  const approveBlock = portalRoutes.slice(
    portalRoutes.indexOf("if (targetState === CLAIM_STATES.APPROVED)"),
    portalRoutes.indexOf('await claim.save();')
  );
  assert.doesNotMatch(approveBlock, /OrganizationVerification\.(findOneAndUpdate|updateOne|updateMany)/);
  assert.doesNotMatch(approveBlock, /status:\s*['"]approved['"]/);
  assert.doesNotMatch(portalSvc, /OrganizationVerification.*claim\.state/);
});

check('STATE-03: rejected and needs_information remain distinct', () => {
  assert.notEqual(S.REJECTED, S.NEEDS_INFORMATION);
  assert.match(portalRoutes, /CLAIM_STATES\.NEEDS_INFORMATION[\s\S]{0,200}informationRequestReason/);
  assert.match(portalRoutes, /CLAIM_STATES\.REJECTED[\s\S]{0,200}rejectedReason/);
  assert.match(claimPage, /claim\.state === 'needs_information'/);
  assert.match(claimPage, /claim\.state === 'rejected'/);
  assert.match(adminClaimsUi, /Information request/);
  assert.match(adminClaimsUi, /Rejection reason/);
});

check('QA-01: qa_test does not make claim approved via assertApprovedClaim', () => {
  const assertBlock = portalSvc.slice(
    portalSvc.indexOf('export async function assertApprovedClaim'),
    portalSvc.indexOf('export async function assertOfficialInstitutionWrite')
  );
  assert.doesNotMatch(assertBlock, /qa_test|OVERRIDE_TYPES|getOverrideService/);
  assert.match(assertBlock, /CLAIM_REQUIRED/);
  assert.match(claimPage, /qa_test does not approve canonical claims/);
});

check('QA-02: Phase 4 dedicated Institution Admissions QA behavior remains unchanged', () => {
  assert.match(admissionSvc, /source: qaBypass \? 'qa_test' : 'organic'/);
  assert.match(admissionSvc, /CLAIM_REQUIRED/);
  assert.match(admissionSvc, /overrideType !== 'qa_test'|OVERRIDE_TYPES\.QA_TEST/);
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
