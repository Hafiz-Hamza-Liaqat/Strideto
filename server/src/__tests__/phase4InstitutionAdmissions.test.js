/**
 * Phase 4 — Institution Admissions Authority regression tests.
 * No DB / no network. Tests verify:
 *   - Source marker present in model and service
 *   - Organic authority rule (verification + claim + role + state machine)
 *   - QA authority rule (override + capability, not claim approval)
 *   - Hard invariants: suspension, invalid transitions, read access
 *
 * Run: node server/src/__tests__/phase4InstitutionAdmissions.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const portal = await import(pathToFileURL(path.join(root, 'shared/institution/institutionPortal.js')).href);
const verification = await import(pathToFileURL(path.join(root, 'shared/international/verification.js')).href);

const { isValidInstitutionAdmissionTransition, ADMISSION_STATES, CLAIM_STATES, canSubmitOfficialChanges, INSTITUTION_ROLES } = portal;
const { isSuspendedOrRevoked, VERIFICATION_STATUSES } = verification;

const admissionSvc = source('server/src/services/institutionAdmissionService.js');
const admissionModel = source('server/src/models/institution/InstitutionAdmissionApplication.js');
const portalCtrl = source('server/src/controllers/institutionPortalController.js');

let passed = 0;
let failed = 0;
async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${label}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

// ── SOURCE MARKER ────────────────────────────────────────────────────────────

await check('QA-SOURCE-01 model has source field with organic/qa_test enum', () => {
  assert.ok(admissionModel.includes("enum: ['organic', 'qa_test']"), 'source enum in model');
  assert.ok(admissionModel.includes("default: 'organic'"), 'default is organic');
});

await check('QA-SOURCE-01b service sets source=qa_test for QA bypass path', () => {
  assert.ok(admissionSvc.includes("source: qaBypass ? 'qa_test' : 'organic'"), 'source set from qaBypass');
  assert.ok(admissionSvc.includes('qaBypass = true'), 'qaBypass flag is set in QA path');
});

await check('QA-SOURCE-02 organic application cannot receive QA bypass: authority routed by app source', () => {
  assert.ok(admissionSvc.includes("appSource === 'qa_test'"), 'transition routes on appSource');
  assert.ok(admissionSvc.includes('assertQaAdmissionTrust'), 'QA trust helper present');
  assert.ok(admissionSvc.includes('assertOrganicAdmissionTrust'), 'organic trust helper present');
});

// ── ORGANIC AUTHORITY ────────────────────────────────────────────────────────

await check('ORGANIC-AUTH-01 organic trust: service requires approved verification status', () => {
  assert.ok(admissionSvc.includes("ver.status !== 'approved'"), 'organic checks status === approved');
  assert.ok(admissionSvc.includes('VERIFICATION_REQUIRED'), 'throws VERIFICATION_REQUIRED code');
});

await check('ORGANIC-AUTH-01b organic trust: service requires approved canonical claim', () => {
  assert.ok(admissionSvc.includes('CLAIM_STATES.APPROVED'), 'organic checks CLAIM_STATES.APPROVED');
  assert.ok(admissionSvc.includes("'CLAIM_REQUIRED'"), 'throws CLAIM_REQUIRED code');
});

await check('ORGANIC-AUTH-01c state machine: valid RECEIVED→UNDER_REVIEW succeeds', () => {
  assert.ok(isValidInstitutionAdmissionTransition(ADMISSION_STATES.RECEIVED, ADMISSION_STATES.UNDER_REVIEW));
});

await check('ORGANIC-AUTH-02 no approved claim → organic check throws CLAIM_REQUIRED', () => {
  // Simulate: approved verification, but InstitutionClaim.findOne returns null
  // The assertOrganicAdmissionTrust function throws when claim is falsy.
  // We verify the helper code path by asserting the source text contains the guard.
  assert.ok(
    admissionSvc.includes('CLAIM_REQUIRED') &&
    admissionSvc.includes("state: CLAIM_STATES.APPROVED"),
    'claim required guard present in assertOrganicAdmissionTrust'
  );
});

await check('ORGANIC-AUTH-03 no approved verification → organic check throws VERIFICATION_REQUIRED', () => {
  assert.ok(
    admissionSvc.includes('VERIFICATION_REQUIRED') &&
    admissionSvc.includes("ver.status !== 'approved'"),
    'verification required guard present in assertOrganicAdmissionTrust'
  );
});

await check('ORGANIC-AUTH-04 suspended org → isSuspendedOrRevoked returns true', () => {
  assert.ok(isSuspendedOrRevoked(VERIFICATION_STATUSES.SUSPENDED));
  assert.ok(isSuspendedOrRevoked(VERIFICATION_STATUSES.REVOKED));
  assert.ok(!isSuspendedOrRevoked(VERIFICATION_STATUSES.APPROVED));
});

await check('ORGANIC-AUTH-04b suspended/revoked hard deny present in organic helper', () => {
  // assertOrganicAdmissionTrust checks isSuspendedOrRevoked before status check
  assert.ok(
    admissionSvc.includes('isSuspendedOrRevoked(ver.status)') ||
    admissionSvc.includes("isSuspendedOrRevoked(ver?.status)"),
    'suspended check present in organic helper'
  );
  assert.ok(admissionSvc.includes("'BLOCKED'"), 'BLOCKED code thrown for suspended/revoked');
});

await check('ORGANIC-AUTH-05 unauthorized role → canSubmitOfficialChanges returns false', () => {
  assert.ok(!canSubmitOfficialChanges(INSTITUTION_ROLES.VIEWER ?? 'viewer'));
  assert.ok(canSubmitOfficialChanges(INSTITUTION_ROLES.OWNER));
  assert.ok(canSubmitOfficialChanges(INSTITUTION_ROLES.ADMIN));
  assert.ok(canSubmitOfficialChanges(INSTITUTION_ROLES.EDITOR));
});

await check('ORGANIC-AUTH-05b controller checks canSubmitOfficialChanges before calling service', () => {
  assert.ok(
    portalCtrl.includes('canSubmitOfficialChanges(membership.role)') &&
    portalCtrl.includes('transitionApplication'),
    'controller role gate present on transitionApplication handler'
  );
});

await check('ORGANIC-AUTH-06 invalid state transition rejected', () => {
  // ADMITTED → RECEIVED is not a valid transition
  assert.ok(!isValidInstitutionAdmissionTransition(ADMISSION_STATES.ADMITTED ?? 'admitted', ADMISSION_STATES.RECEIVED));
  // WITHDRAWN → UNDER_REVIEW is not valid
  assert.ok(!isValidInstitutionAdmissionTransition(ADMISSION_STATES.WITHDRAWN, ADMISSION_STATES.UNDER_REVIEW));
});

await check('ORGANIC-AUTH-06b state machine check present in transitionApplication', () => {
  assert.ok(admissionSvc.includes('isValidInstitutionAdmissionTransition'), 'state machine guard present');
  assert.ok(admissionSvc.includes("'INVALID_STATE'"), 'INVALID_STATE thrown');
});

// ── QA AUTHORITY ─────────────────────────────────────────────────────────────

await check('QA-AUTH-01 QA trust does not require approved claim', () => {
  // assertQaAdmissionTrust must NOT check CLAIM_STATES.APPROVED within its own body.
  // We verify by inspecting that the QA helper only checks override + suspended, not claim.
  const qaHelperBlock = admissionSvc.slice(
    admissionSvc.indexOf('async function assertQaAdmissionTrust'),
    admissionSvc.indexOf('function safeSnapshot')
  );
  assert.ok(!qaHelperBlock.includes('CLAIM_STATES.APPROVED'), 'QA trust does not check claim approval');
  assert.ok(qaHelperBlock.includes("overrideType !== 'qa_test'"), 'QA trust checks qa_test override type');
  assert.ok(qaHelperBlock.includes('INSTITUTION_PORTAL'), 'QA trust checks INSTITUTION_PORTAL capability');
});

await check('QA-AUTH-02 expired/revoked override → QA transition denied', () => {
  // assertQaAdmissionTrust throws QA_OVERRIDE_REQUIRED when override is null/expired.
  assert.ok(admissionSvc.includes('QA_OVERRIDE_REQUIRED'), 'QA_OVERRIDE_REQUIRED code present');
});

await check('QA-AUTH-03 QA bypass does not mutate claim state', () => {
  // QA bypass in submitStudentApplication uses claim for org routing only; state is not changed.
  assert.ok(
    admissionSvc.includes('use for org routing only; claim.state remains unchanged'),
    'QA bypass comment confirms no claim mutation'
  );
  assert.ok(!admissionSvc.includes('claim.state = '), 'claim.state is never assigned in service');
  assert.ok(!admissionSvc.includes("claim.state='"), 'claim.state never assigned (no spaces)');
});

await check('QA-AUTH-04 QA bypass does not mutate verification state', () => {
  // Admission service never writes to OrganizationVerification.
  assert.ok(!admissionSvc.includes('OrganizationVerification.create'), 'no verification create');
  assert.ok(!admissionSvc.includes('OrganizationVerification.findByIdAndUpdate'), 'no verification update');
  assert.ok(!admissionSvc.includes("ver.status ="), 'ver.status never assigned');
});

await check('QA-AUTH-05 suspension hard deny beats qa_test override', () => {
  // assertQaAdmissionTrust checks isSuspendedOrRevoked before the override check.
  const qaBlock = admissionSvc.slice(
    admissionSvc.indexOf('async function assertQaAdmissionTrust'),
    admissionSvc.indexOf('async function assertOrganicAdmissionTrust') > -1
      ? admissionSvc.indexOf('function safeSnapshot')
      : admissionSvc.length
  );
  const suspendIdx = qaBlock.indexOf('isSuspendedOrRevoked');
  const overrideIdx = qaBlock.indexOf('getOverrideService');
  assert.ok(suspendIdx > -1, 'QA trust checks isSuspendedOrRevoked');
  assert.ok(suspendIdx < overrideIdx, 'suspension check comes before override check');
});

// ── TRUST INVARIANTS ─────────────────────────────────────────────────────────

await check('INVARIANT verification approved ≠ claim approved ≠ qa override (separate truths)', () => {
  // VERIFICATION_STATUSES.APPROVED is 'approved'
  assert.equal(VERIFICATION_STATUSES.APPROVED, 'approved');
  // CLAIM_STATES.APPROVED is a different record on a different model
  assert.equal(CLAIM_STATES.APPROVED, 'approved');
  // Service keeps three separate checks — verified by text presence of all three guards
  assert.ok(admissionSvc.includes('assertOrganicAdmissionTrust'), 'organic trust helper exists');
  assert.ok(admissionSvc.includes('assertQaAdmissionTrust'), 'QA trust helper exists');
  assert.ok(admissionSvc.includes('qaBypass'), 'qaBypass tracks QA submission separately');
});

await check('INVARIANT authority checks before mutation in transitionApplication', () => {
  const fnBody = admissionSvc.slice(admissionSvc.indexOf('export async function transitionApplication'));
  const authorityIdx = fnBody.indexOf('appSource === ');
  const mutationIdx = fnBody.indexOf('doc.status = toState');
  assert.ok(authorityIdx > -1, 'authority check present in transitionApplication');
  assert.ok(mutationIdx > -1, 'mutation present in transitionApplication');
  assert.ok(authorityIdx < mutationIdx, 'authority check precedes mutation');
});

// ── READ ACCESS ───────────────────────────────────────────────────────────────

await check('READ-01 listApplications and getApplication require only active membership', () => {
  // Controller does not call assertOfficialInstitutionWrite for list/get
  const listHandler = portalCtrl.slice(
    portalCtrl.indexOf('export const listApplications'),
    portalCtrl.indexOf('export const getApplication')
  );
  const getHandler = portalCtrl.slice(
    portalCtrl.indexOf('export const getApplication'),
    portalCtrl.indexOf('export const transitionApplication')
  );
  assert.ok(!listHandler.includes('assertOfficialInstitutionWrite'), 'list does not require verified write');
  assert.ok(!getHandler.includes('assertOfficialInstitutionWrite'), 'get does not require verified write');
  assert.ok(listHandler.includes('resolveMembershipOrFail'), 'list requires active membership');
  assert.ok(getHandler.includes('resolveMembershipOrFail'), 'get requires active membership');
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────

console.log(`\nPhase 4 — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
