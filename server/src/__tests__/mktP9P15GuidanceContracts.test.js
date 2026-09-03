import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentContextSummary, buildReadinessPlan, buildApplicationReadiness, classifyGuidanceFreshness, summarizeGuidanceFreshness } from '../../../shared/education/studentGuidance.js';
import fs from 'node:fs';

test('guidance keeps partial profiles factual and reports missing context', () => {
  const summary = buildStudentContextSummary({ personal: {}, education: [], examScores: [], studyGoals: [] });
  assert.deepEqual(summary.known.fieldsOfStudy, []);
  assert.deepEqual(summary.known.destinations, []);
  assert.ok(summary.missing.includes('study_level'));
  assert.equal(summary.hasSufficientContext, false);
});

test('guidance recognizes supported profile context without fabricating values', () => {
  const summary = buildStudentContextSummary({
    personal: { country: 'Pakistan' },
    education: [{ level: 'bachelors' }],
    examScores: [],
    studyGoals: [{ status: 'active', degreeLevel: 'masters', fieldOfStudy: 'Computer Science', destinationCountries: ['Canada'] }],
  });
  assert.equal(summary.known.studyLevel, 'masters');
  assert.deepEqual(summary.known.destinations, ['Canada']);
  assert.equal(summary.known.recordedTests, 0);
  assert.ok(summary.missing.includes('test_scores'));
});

test('readiness distinguishes missing from known ready evidence and keeps unknown requirements explicit', () => {
  const plan = buildReadinessPlan({ profile: { education: [{ gradingSystem: 'gpa', gradeValue: 3.4 }], examScores: [] }, gaps: [{ key: 'profile', label: 'Complete profile', reason: 'missing_field' }] });
  assert.equal(plan.items.find((item) => item.key === 'profile').status, 'MISSING');
  assert.equal(plan.items.find((item) => item.key === 'academic_records').status, 'READY');
  assert.equal(plan.unknownRequirements, true);
});

test('freshness contract is conservative', () => {
  assert.equal(classifyGuidanceFreshness({ freshnessState: 'fresh' }), 'VERIFIED_RECENT');
  assert.equal(classifyGuidanceFreshness({ verificationStatus: 'verified', lastVerifiedAt: '2026-01-01' }), 'VERIFIED');
  assert.equal(classifyGuidanceFreshness({ freshnessState: 'stale' }), 'STALE');
  assert.equal(classifyGuidanceFreshness({}), 'UNKNOWN');
  assert.equal(summarizeGuidanceFreshness([{ freshnessState: 'stale' }, {}]).STALE, 1);
});

test('application readiness uses established checklist requirements and preserves unknowns', () => {
  const readiness = buildApplicationReadiness({
    documents: [{ _id: 'd1', documentType: 'transcript', status: 'active' }],
    checklists: [{ items: [
      { requirementRef: 'transcript', label: 'Transcript', documentRequirementType: 'transcript', status: 'pending' },
      { requirementRef: 'statement', label: 'Statement', documentRequirementType: 'statement', status: 'pending' },
      { requirementRef: 'other', label: 'Portfolio review', status: 'pending' },
    ] }],
    applications: [{ _id: 'a1', targetTitle: 'Example program', status: 'preparing' }],
    deadlines: [{ title: 'Apply by', deadlineAt: '2026-12-01', isDateOnly: true }],
  });
  assert.equal(readiness.documents.find((item) => item.key === 'transcript').status, 'READY');
  assert.equal(readiness.documents.find((item) => item.key === 'statement').status, 'MISSING');
  assert.equal(readiness.unknownRequirements[0].status, 'UNKNOWN');
  assert.equal(readiness.applications[0].status, 'preparing');
  assert.equal(readiness.hardDeadlines[0].deadlineAt, '2026-12-01');
});

test('canonical and legacy institution routes remain dataset-specific', async () => {
  const { resolveInstitutionDetailPath } = await import('../../../shared/seo/entityDetailSeoPolicy.js');
  assert.equal(resolveInstitutionDetailPath({ slug: 'canonical-u' }), '/institutions/canonical-u');
  assert.equal(resolveInstitutionDetailPath({ slug: 'legacy-u' }, { legacy: true }), '/schools-and-colleges/legacy-u');
});

test('private guidance route derives identity and remains outside search/public SEO', () => {
  const controller = fs.readFileSync(new URL('../controllers/personalizationController.js', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../routes/personalization.js', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../services/personalizationService.js', import.meta.url), 'utf8');
  const freshnessController = fs.readFileSync(new URL('../controllers/trust/adminFreshnessController.js', import.meta.url), 'utf8');
  assert.match(controller, /getStudentGuidance\(req\.user\.userId\)/);
  assert.match(route, /\/personalization\/guidance.*\.\.\.auth/);
  assert.doesNotMatch(service, /SearchDocument/);
  assert.match(freshnessController, /adminListFreshnessQueue/);
  assert.match(freshnessController, /limit = Math\.min\(100/);
});
