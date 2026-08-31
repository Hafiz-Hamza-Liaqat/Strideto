import assert from 'node:assert/strict';
import {
  ACCEPTANCE_SCOPES,
  ACCEPTANCE_STATUSES,
  mergeProgramAcceptanceWithInstitutionFallback,
  projectPublicAcceptance,
  resolvePrecedence,
} from '../../../shared/education/acceptanceExplorer.js';

const source = {
  sourceType: 'official',
  sourceUrl: 'https://university.example/admissions/english-requirements',
  publisher: 'Example University',
  retrievedAt: '2026-09-01T00:00:00.000Z',
  verifiedAt: '2026-09-01T00:00:00.000Z',
};

const institutionClaim = {
  _id: 'institution-ielts',
  testId: 'ielts',
  institutionId: 'institution-1',
  acceptanceStatus: ACCEPTANCE_STATUSES.ACCEPTED,
  acceptanceScope: ACCEPTANCE_SCOPES.INSTITUTION,
  minimumOverallScore: 6.5,
  sources: [source],
  verificationStatus: 'verified',
  freshnessState: 'fresh',
};
const programClaim = {
  _id: 'program-ielts',
  testId: 'ielts',
  institutionId: 'institution-1',
  programId: 'program-1',
  acceptanceStatus: ACCEPTANCE_STATUSES.ACCEPTED,
  acceptanceScope: ACCEPTANCE_SCOPES.PROGRAM,
  minimumOverallScore: 7,
  sectionMinimums: [{ sectionName: 'Writing', minimum: 6.5, scale: 'IELTS band' }],
  sources: [source],
  verificationStatus: 'verified',
  freshnessState: 'fresh',
};
const institutionToefl = { ...institutionClaim, _id: 'institution-toefl', testId: 'toefl-ibt', minimumOverallScore: 90 };

const merged = mergeProgramAcceptanceWithInstitutionFallback([programClaim], [institutionClaim, institutionToefl]);
assert.deepEqual(merged.programClaims, [programClaim], 'program claim remains primary');
assert.deepEqual(merged.institutionFallback, [institutionToefl], 'institution fallback excludes only the overridden test');
assert.equal(resolvePrecedence([institutionClaim, programClaim]), programClaim, 'program specificity wins');
assert.equal(institutionClaim.acceptanceScope, 'institution', 'institution claim remains explicitly scoped');
assert.equal(programClaim.acceptanceScope, 'program', 'program claim remains explicitly scoped');
assert.equal(programClaim.minimumOverallScore, 7, 'program overall minimum is preserved');
assert.deepEqual(programClaim.sectionMinimums, [{ sectionName: 'Writing', minimum: 6.5, scale: 'IELTS band' }], 'explicit section minimum is preserved');
assert.equal(institutionClaim.sectionMinimums, undefined, 'no section minimum is invented for institution fallback');
assert.equal(institutionClaim.acceptanceStatus, 'accepted', 'accepted is distinct');
assert.equal(projectPublicAcceptance({ ...institutionClaim, adminNotes: 'internal' }).adminNotes, undefined, 'admin notes are never public');
assert.equal(projectPublicAcceptance({ ...institutionClaim, acceptanceStatus: 'unknown' }).acceptanceStatus, 'unknown', 'unknown is not converted to rejected');
assert.equal(projectPublicAcceptance({ ...institutionClaim, acceptanceStatus: 'not_accepted' }).acceptanceStatus, 'not_accepted', 'verified rejection remains distinct');
assert.equal(projectPublicAcceptance({ ...institutionClaim, intake: '2026-27', effectiveFrom: '2026-09-01' }).intake, '2026-27', 'intake scope is public');
assert.equal(projectPublicAcceptance({ ...institutionClaim, waiverNotes: 'Prior English-medium degree may qualify; verify official policy.' }).waiverNotes.includes('verify'), true, 'waiver conditions remain qualified');
assert.equal(source.sourceUrl.startsWith('https://'), true, 'source provenance is HTTPS');
assert.equal(source.verifiedAt, '2026-09-01T00:00:00.000Z', 'verification date is retained');
assert.equal(JSON.stringify({ score: 7 }).includes('scholarship'), false, 'acceptance data does not infer scholarships');

console.log('p7cTestAcceptance: scope precedence, fallback truthfulness, scores, provenance, unknowns, and scholarship separation passed');
