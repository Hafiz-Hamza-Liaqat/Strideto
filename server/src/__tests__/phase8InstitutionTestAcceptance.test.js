/**
 * Phase 8 — Institution Test Acceptance completeness.
 * Pure source/contract + shared validation tests. No live DB.
 *
 * Run: node server/src/__tests__/phase8InstitutionTestAcceptance.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const ae = await import(pathToFileURL(path.join(root, 'shared/education/acceptanceExplorer.js')).href);
const truth = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/publicTruth.js')).href);
const portal = await import(pathToFileURL(path.join(root, 'shared/institution/institutionPortal.js')).href);
const verification = await import(pathToFileURL(path.join(root, 'shared/international/verification.js')).href);

const portalSvc = source('server/src/services/institutionPortalService.js');
const portalCtrl = source('server/src/controllers/institutionPortalController.js');
const portalRoutes = source('server/src/routes/institutionPortal.js');
const taModel = source('server/src/models/education/TestAcceptance.js');
const testModel = source('server/src/models/education/Test.js');
const taPage = source('client/src/pages/Institution/InstitutionTestAcceptance.jsx');
const clientApi = source('client/src/services/institutionPortalService.js');
const acceptCtrl = source('server/src/controllers/education/testAcceptanceController.js');
const adminAccept = source('server/src/controllers/education/adminAcceptanceController.js');
const adminRoutes = source('server/src/routes/adminEducation.js');
const publicTruth = source('shared/publicDiscovery/publicTruth.js');
const acceptanceExplorer = source('shared/education/acceptanceExplorer.js');

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

console.log('\nPhase 8 — Institution Test Acceptance Completeness\n');

// ── Authority / create / publish gates ───────────────────────────────────────

check('TEST-01: official trusted institution path can create/save test acceptance draft', () => {
  assert.match(portalCtrl, /createTestAcceptance[\s\S]*assertOfficialInstitutionWrite/);
  assert.match(portalCtrl, /canSubmitOfficialChanges\(membership\.role\)/);
  assert.match(portalSvc, /export async function createOrUpdateTestAcceptance/);
  assert.match(portalSvc, /status: PUB_STATUSES\.DRAFT/);
  assert.match(portalRoutes, /portal\.post\('\/:organizationId\/test-acceptance'/);
});

check('TEST-02: unverified institution cannot publish official test acceptance', () => {
  assert.match(portalCtrl, /publishTestAcceptance[\s\S]*assertOfficialInstitutionWrite/);
  assert.match(portalSvc, /export async function assertApprovedVerification/);
  assert.match(portalSvc, /Organization verification must be approved/);
  assert.match(portalSvc, /export async function publishTestAcceptance/);
});

check('TEST-03: no approved canonical claim → publication denied', () => {
  assert.match(portalSvc, /assertOfficialInstitutionWrite[\s\S]*assertApprovedClaim/);
  assert.match(portalSvc, /Approved canonical institution claim required/);
  assert.match(portalCtrl, /publishTestAcceptance[\s\S]*assertOfficialInstitutionWrite/);
});

check('TEST-04: suspended/revoked institution → hard denied', () => {
  assert.match(portalSvc, /isSuspendedOrRevoked\(v\.status\)/);
  assert.match(portalSvc, /Organization is suspended or revoked/);
  assert.equal(verification.isSuspendedOrRevoked('suspended'), true);
  assert.equal(verification.isSuspendedOrRevoked('revoked'), true);
  assert.equal(verification.canExercisePrivilegedCapability('suspended'), false);
  assert.equal(verification.canExercisePrivilegedCapability('revoked'), false);
});

check('TEST-05: unauthorized/read-only member cannot publish', () => {
  assert.equal(portal.canSubmitOfficialChanges('viewer'), false);
  assert.equal(portal.canSubmitOfficialChanges('editor'), true);
  assert.match(portalCtrl, /publishTestAcceptance[\s\S]*canSubmitOfficialChanges\(membership\.role\)[\s\S]*Insufficient role/);
  assert.match(portalCtrl, /archiveTestAcceptance[\s\S]*canSubmitOfficialChanges\(membership\.role\)/);
});

// ── Identity ─────────────────────────────────────────────────────────────────

check('IDENTITY-01: student-facing rule includes human-readable test identity', () => {
  assert.match(acceptanceExplorer, /extractTestIdentity/);
  assert.match(acceptanceExplorer, /testIdentity/);
  assert.match(acceptCtrl, /populate[\s\S]*providerId[\s\S]*name slug/);
  const projected = ae.projectPublicAcceptance({
    _id: 'a1',
    testId: {
      _id: 't1',
      name: 'IELTS Academic',
      shortName: 'IELTS',
      slug: 'ielts-academic',
      providerId: { name: 'British Council' },
    },
    acceptanceStatus: 'accepted',
    acceptanceScope: 'institution',
    status: 'published',
    sectionMinimums: [],
    sources: [],
  });
  assert.equal(projected.testIdentity.name, 'IELTS Academic');
  assert.equal(projected.testIdentity.providerName, 'British Council');
  assert.equal(projected.testIdentity.slug, 'ielts-academic');
});

check('IDENTITY-02: opaque/invalid test identity is rejected where catalog exists', () => {
  assert.match(testModel, /stableId/);
  assert.match(testModel, /slug/);
  assert.match(portalSvc, /resolvePublishedCatalogTest/);
  assert.match(portalSvc, /Unknown or unpublished test catalog identity/);
  assert.match(taPage, /Select published test/);
  assert.match(taPage, /testsApi\.list/);
});

// ── Scores ───────────────────────────────────────────────────────────────────

check('SCORE-01: minimum overall score persists correctly', () => {
  assert.match(taModel, /minimumOverallScore/);
  assert.match(portalSvc, /minimumOverallScore/);
  assert.match(taPage, /minimumOverallScore/);
});

check('SCORE-02: optional section score requirements persist', () => {
  assert.match(taModel, /sectionMinimums/);
  assert.match(taModel, /sectionName/);
  assert.match(portalSvc, /normalizeSectionMinimums/);
  assert.match(taPage, /Section minimums/);
  const ok = ae.normalizeSectionMinimums([
    { sectionName: 'Listening', minimum: 6 },
    { section: 'Reading', minimumScore: 6.5 },
  ]);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.length, 2);
  assert.equal(ok.value[1].sectionName, 'Reading');
  assert.equal(ok.value[1].minimum, 6.5);
});

check('SCORE-03: duplicate/invalid section requirements rejected', () => {
  const dup = ae.normalizeSectionMinimums([
    { sectionName: 'Listening', minimum: 6 },
    { sectionName: 'listening', minimum: 7 },
  ]);
  assert.equal(dup.ok, false);
  assert.match(dup.error, /duplicate/i);
  const bad = ae.normalizeSectionMinimums([{ sectionName: 'Writing', minimum: 'x' }]);
  assert.equal(bad.ok, false);
  assert.match(portalSvc, /normalizeSectionMinimums[\s\S]*VALIDATION/);
});

// ── Validity / effective period ──────────────────────────────────────────────

check('VALIDITY-01: valid effective period accepted', () => {
  const ok = ae.validateEffectivePeriod('2026-01-01', '2026-12-31');
  assert.equal(ok.ok, true);
  assert.ok(ok.effectiveFrom instanceof Date);
  assert.ok(ok.effectiveUntil instanceof Date);
  assert.match(taModel, /effectiveFrom/);
  assert.match(taModel, /effectiveUntil/);
});

check('VALIDITY-02: effectiveUntil before effectiveFrom rejected', () => {
  const bad = ae.validateEffectivePeriod('2026-12-31', '2026-01-01');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /effectiveUntil must be on or after effectiveFrom/);
  assert.match(portalSvc, /validateEffectivePeriod/);
});

check('VALIDITY-03: result validity duration validated', () => {
  assert.match(taModel, /resultValidityMonths/);
  assert.equal(ae.validateResultValidityMonths(24).ok, true);
  assert.equal(ae.validateResultValidityMonths(24).value, 24);
  assert.equal(ae.validateResultValidityMonths(0).ok, false);
  assert.equal(ae.validateResultValidityMonths(-1).ok, false);
  assert.equal(ae.validateResultValidityMonths(1.5).ok, false);
  assert.equal(ae.validateResultValidityMonths('').ok, true);
  assert.equal(ae.validateResultValidityMonths('').value, null);
  assert.match(portalSvc, /validateResultValidityMonths/);
  assert.match(taPage, /resultValidityMonths/);
});

// ── Publication visibility ───────────────────────────────────────────────────

check('PUB-01: draft requirement is NOT student-visible', () => {
  assert.equal(truth.isCurrentAcceptanceClaim({ status: 'draft' }), false);
  const filter = truth.currentAcceptanceMongoFilter();
  assert.equal(filter.status, 'published');
  assert.match(acceptCtrl, /currentAcceptanceMongoFilter/);
  assert.match(taPage, /Drafts are not student-visible until published/);
});

check('PUB-02: published requirement IS student-visible', () => {
  assert.equal(truth.isCurrentAcceptanceClaim({ status: 'published', supersededById: null }), true);
  assert.match(portalSvc, /status: PUB_STATUSES\.PUBLISHED/);
  assert.match(portalRoutes, /test-acceptance\/:testAcceptanceId\/publish/);
  assert.match(clientApi, /publishTestAcceptance/);
});

check('PUB-03: archived/inactive requirement is NOT student-visible', () => {
  assert.equal(truth.isCurrentAcceptanceClaim({ status: 'archived' }), false);
  assert.match(portalSvc, /export async function archiveTestAcceptance/);
  assert.match(portalSvc, /Only published Test Acceptance records can be archived/);
  assert.match(portalRoutes, /test-acceptance\/:testAcceptanceId\/archive/);
});

// ── Scope ────────────────────────────────────────────────────────────────────

check('SCOPE-01: institution scope works', () => {
  assert.equal(ae.ACCEPTANCE_SCOPES.INSTITUTION, 'institution');
  assert.match(portalSvc, /ACCEPTANCE_SCOPES\.INSTITUTION/);
  assert.match(taPage, /ACCEPTANCE_SCOPES\.INSTITUTION/);
});

check('SCOPE-02: program scope must reference institution-owned program', () => {
  assert.match(portalSvc, /programId is required for program and program_intake scope/);
  assert.match(portalSvc, /assertProgramOwnership/);
  assert.match(portalSvc, /Program does not belong to this institution/);
});

check('SCOPE-03: intake scope must reference valid institution-owned intake if supported', () => {
  assert.match(portalSvc, /assertIntakeBelongsToProgram/);
  assert.match(portalSvc, /intake must reference an institution-owned program intake/);
  assert.match(portalSvc, /intake is required for program_intake scope/);
  assert.match(taPage, /ACCEPTANCE_SCOPES\.PROGRAM_INTAKE/);
});

// ── Security / QA ────────────────────────────────────────────────────────────

check('SECURITY-01: student/public response excludes internal/admin fields', () => {
  const projected = ae.projectPublicAcceptance({
    _id: 'a1',
    testId: 't1',
    acceptanceStatus: 'accepted',
    acceptanceScope: 'institution',
    status: 'published',
    sectionMinimums: [],
    sources: [],
    adminNotes: 'SECRET staff note',
  });
  assert.ok(!('adminNotes' in projected));
  assert.match(portalSvc, /select\('-adminNotes'\)/);
  assert.match(acceptCtrl, /projectPublicAcceptance|function project\(doc\)/);
});

check('QA-01: qa_test does not convert Test Acceptance publication into organic approved claim/verification truth', () => {
  // Official write still requires approved claim (no QA claim forge).
  assert.match(portalSvc, /assertOfficialInstitutionWrite[\s\S]*assertApprovedClaim/);
  assert.match(portalSvc, /Approved canonical institution claim required/);
  // Suspended/revoked remain absolute hard deny even with overrides.
  assert.match(portalSvc, /Absolute hard deny: suspended and revoked/);
  // No Phase-4-style admissions QA exception wired into Test Acceptance publish.
  assert.doesNotMatch(portalSvc, /publishTestAcceptance[\s\S]{0,400}qa_test[\s\S]{0,200}admissions/);
  assert.doesNotMatch(portalCtrl, /publishTestAcceptance[\s\S]{0,500}OVERRIDE_TYPES\.QA_TEST/);
});

// ── UX / admin oversight presence ────────────────────────────────────────────

check('UX: provider page supports create, scope, scores, validity, draft/publish/archive', () => {
  assert.match(taPage, /Record draft/);
  assert.match(taPage, /Publish/);
  assert.match(taPage, /Archive/);
  assert.match(taPage, /Section minimums/);
  assert.match(taPage, /Policy effective from/);
  assert.match(taPage, /Result validity/);
  assert.match(taPage, /Country-wide policy/);
  assert.doesNotMatch(taPage, /ACCEPTANCE_SCOPES\.COUNTRY/);
});

check('ADMIN: existing Admin Test Acceptance oversight routes remain present (no new workflow invented)', () => {
  assert.match(adminRoutes, /education\/acceptance/);
  assert.match(adminAccept, /adminListAcceptance/);
  assert.match(adminAccept, /adminUpdateAcceptance/);
});

check('SUPERSEDE-01: admin supersede writes model-valid archived + supersededById (not out-of-enum superseded)', () => {
  assert.match(adminAccept, /PUB_STATUSES\.ARCHIVED/);
  assert.match(adminAccept, /old\.status = PUB_STATUSES\.ARCHIVED/);
  assert.match(adminAccept, /old\.supersededById = newClaim\._id/);
  assert.doesNotMatch(adminAccept, /status\s*=\s*['"]superseded['"]/);
  assert.doesNotMatch(adminAccept, /status:\s*['"]superseded['"]/);
  // Model enum remains draft|published|archived only
  assert.match(taModel, /enum: Object\.values\(PUB_STATUSES\)/);
  assert.doesNotMatch(taModel, /superseded['"]\s*,/);
});

check('SUPERSEDE-02: superseded predecessor is excluded from public/current results', () => {
  const predecessor = {
    status: 'archived',
    supersededById: 'replacement-1',
    effectiveFrom: null,
    effectiveUntil: null,
  };
  assert.equal(truth.isCurrentAcceptanceClaim(predecessor), false);
  const filter = truth.currentAcceptanceMongoFilter();
  assert.equal(filter.status, 'published');
  // archived predecessor cannot match published filter
  assert.notEqual(predecessor.status, filter.status);
  // pointer also excludes even if status were wrongly published
  assert.equal(
    truth.isCurrentAcceptanceClaim({ status: 'published', supersededById: 'replacement-1' }),
    false
  );
});

check('SUPERSEDE-03: replacement follows existing draft→publish workflow to become current', () => {
  assert.match(adminAccept, /status: PUB_STATUSES\.DRAFT/);
  // Draft replacement is not student-visible until published
  assert.equal(truth.isCurrentAcceptanceClaim({ status: 'draft', supersededById: null }), false);
  // After publish via existing status transition, it becomes current
  assert.equal(truth.isCurrentAcceptanceClaim({ status: 'published', supersededById: null }), true);
  assert.match(adminAccept, /targetStatus === 'published'|PUB_STATUSES\.PUBLISHED/);
});

check('PROJECTION: student-facing acceptance includes score/validity fields and excludes adminNotes', () => {
  const projected = ae.projectPublicAcceptance({
    _id: 'a2',
    testId: { _id: 't2', name: 'TOEFL iBT', shortName: 'TOEFL', slug: 'toefl-ibt', providerId: { name: 'ETS' } },
    acceptanceStatus: 'accepted',
    acceptanceScope: 'program',
    minimumOverallScore: 90,
    sectionMinimums: [{ sectionName: 'Reading', minimum: 20 }],
    effectiveFrom: '2026-01-01',
    effectiveUntil: '2026-12-31',
    resultValidityMonths: 24,
    adminNotes: 'INTERNAL staff note',
    reviewedBy: 'staff-1',
    status: 'published',
    sources: [{ sourceUrl: 'https://example.edu/policy', sourceType: 'institution_official' }],
  });
  assert.equal(projected.testIdentity.name, 'TOEFL iBT');
  assert.equal(projected.minimumOverallScore, 90);
  assert.equal(projected.sectionMinimums[0].sectionName, 'Reading');
  assert.equal(projected.effectiveFrom, '2026-01-01');
  assert.equal(projected.effectiveUntil, '2026-12-31');
  assert.equal(projected.resultValidityMonths, 24);
  assert.equal(projected.adminNotes, undefined);
  assert.equal(projected.reviewedBy, undefined);
});

check('FILTER: public mongo filter treats null supersededById as current', () => {
  assert.match(publicTruth, /supersededById: null/);
  assert.match(publicTruth, /supersededById: \{ \$exists: false \}/);
  const filter = truth.currentAcceptanceMongoFilter(new Date('2026-06-01T00:00:00Z'));
  assert.equal(filter.status, 'published');
  assert.ok(Array.isArray(filter.$and));
  assert.ok(filter.$and.some((clause) => Array.isArray(clause.$or) && clause.$or.some((entry) => entry.supersededById === null)));
});

console.log(`\nPhase 8 results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
