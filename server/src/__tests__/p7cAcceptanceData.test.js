import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackScopeLabel, mergeProgramAcceptanceWithInstitutionFallback, projectPublicAcceptance } from '../../../shared/education/acceptanceExplorer.js';
import {
  INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK,
  identity,
  seedInternationalTestAcceptances,
  completeSource,
} from '../seed/internationalTestAcceptances.js';
import { INTERNATIONAL_INSTITUTION_LAUNCH_PACK } from '../seed/internationalInstitutions.js';
import { PUB_STATUSES } from '../../../shared/education/taxonomy.js';

const clone = (value) => structuredClone(value);

function memoryModel(initial = []) {
  const rows = initial.map((row, index) => ({ ...clone(row), _id: row._id || `id-${index + 1}` }));
  let nextId = rows.length + 1;
  return {
    rows,
    async findOne(query) {
      return rows.find((row) => Object.entries(query).every(([key, value]) => String(row[key] ?? '') === String(value ?? ''))) || null;
    },
    async create(value) {
      const row = { ...clone(value), _id: `id-${nextId++}` };
      rows.push(row);
      return row;
    },
  };
}

function launchModels() {
  const institutions = memoryModel(INTERNATIONAL_INSTITUTION_LAUNCH_PACK.map(({ institution }, index) => ({ ...institution, _id: `institution-${index + 1}` })));
  const programs = memoryModel(INTERNATIONAL_INSTITUTION_LAUNCH_PACK.flatMap(({ institution, programs: definitions }) => definitions.map((program) => ({ ...program, _id: `program-${program.slug}`, institutionId: institutions.rows.find((row) => row.slug === institution.slug)._id }))));
  const tests = memoryModel(['ielts', 'toefl-ibt', 'pte-academic', 'duolingo-english-test', 'gre', 'gmat'].map((slug) => ({ _id: `test-${slug}`, slug })));
  const acceptances = memoryModel();
  return { Test: tests, CanonicalInstitution: institutions, Program: programs, TestAcceptance: acceptances };
}

test('launch pack is source-backed and contains no scholarship or synthetic fixture claims', () => {
  const total = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.length;
  assert.equal(total, 35);
  const byTest = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.reduce((groups, claim) => {
    (groups[claim.testSlug] ||= []).push(claim);
    return groups;
  }, {});
  assert.equal(Object.values(byTest).reduce((sum, claims) => sum + claims.length, 0), total);
  assert.deepEqual(Object.fromEntries(Object.entries(byTest).map(([testSlug, claims]) => [testSlug, claims.length])), {
    ielts: 12, 'toefl-ibt': 11, 'pte-academic': 9, 'duolingo-english-test': 3,
  });
  assert.equal(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.filter((claim) => claim.acceptanceScope === 'institution').length, 9);
  assert.equal(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.filter((claim) => claim.acceptanceScope === 'program').length, 26);
  const keys = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.map((claim) => identity({
    testId: claim.testSlug, acceptanceScope: claim.acceptanceScope,
    institutionId: claim.institutionSlug, programId: claim.programSlug || null, intake: claim.intake,
  }));
  assert.equal(new Set(keys).size, keys.length, 'logical acceptance keys must be unique');
  const serialized = JSON.stringify(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK).toLowerCase();
  for (const fixture of ['p1a university', 'example university', 'university x', 'canonical tech university', 'scholarship', 'funding']) assert.equal(serialized.includes(fixture), false);
  assert.ok(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.every((claim) => completeSource(claim.sources)));
  assert.ok(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.every((claim) => claim.acceptanceStatus === 'accepted'));
  const trinityProgramClaims = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.filter((claim) => claim.institutionSlug === 'trinity-college-dublin' && claim.programSlug);
  assert.equal(trinityProgramClaims.length, 8, 'Trinity program-specific delta is exactly eight claims');
});

test('isolated seed resolves canonical references and preserves exact scores/scopes', async () => {
  const models = launchModels();
  const result = await seedInternationalTestAcceptances({ models });
  assert.equal(result.ok, true);
  assert.equal(result.summary.inserted, 35);
  assert.equal(result.scholarshipInferenceCount, 0);
  assert.equal(models.TestAcceptance.rows.length, 35);
  assert.equal(result.claims.filter((claim) => claim.acceptanceScope === 'institution').length, 9);
  assert.equal(result.claims.filter((claim) => claim.acceptanceScope === 'program').length, 26);
  assert.ok(models.TestAcceptance.rows.some((row) => row.testId === 'test-toefl-ibt' && row.minimumOverallScore === 4.5));
  assert.ok(models.TestAcceptance.rows.some((row) => row.minimumOverallScore === 7 && row.sectionMinimums.some((part) => part.minimum === 6.5)));
  assert.ok(models.TestAcceptance.rows.every((row) => row.status === PUB_STATUSES.PUBLISHED && row.verificationStatus === 'verified' && row.freshnessState === 'fresh'));
  assert.equal(models.TestAcceptance.rows.filter((row) => row.degreeLevels.includes('bachelor')).length, 7);
});

test('second seed run is idempotent and preserves reviewed acceptance records', async () => {
  const models = launchModels();
  await seedInternationalTestAcceptances({ models });
  models.TestAcceptance.rows[0].conditions = 'Reviewed editorial condition';
  models.TestAcceptance.rows[0].minimumOverallScore = 99;
  const result = await seedInternationalTestAcceptances({ models });
  assert.equal(result.ok, true);
  assert.equal(result.summary['existing-eligible'], 35);
  assert.equal(models.TestAcceptance.rows.length, 35);
  assert.equal(models.TestAcceptance.rows[0].conditions, 'Reviewed editorial condition');
  assert.equal(models.TestAcceptance.rows[0].minimumOverallScore, 99);
});

test('missing references fail truthfully and contradictory existing claims surface conflict', async () => {
  const models = launchModels();
  models.Test.rows.splice(models.Test.rows.findIndex((row) => row.slug === 'ielts'), 1);
  const missing = await seedInternationalTestAcceptances({ models });
  assert.equal(missing.ok, false);
  assert.ok(missing.claims.some((claim) => claim.status === 'missing-test'));

  const conflictModels = launchModels();
  const definition = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK[0];
  conflictModels.TestAcceptance.rows.push({
    _id: 'conflict', testId: 'test-ielts', institutionId: 'institution-1', programId: null,
    acceptanceScope: 'institution', intake: '', acceptanceStatus: 'not_accepted', status: 'published',
  });
  const conflict = await seedInternationalTestAcceptances({ models: conflictModels });
  assert.equal(conflict.claims.find((claim) => claim.testSlug === definition.testSlug && claim.institutionSlug === definition.institutionSlug).status, 'conflict');
});

test('program-specific claims remain authoritative while institution claims remain fallback for other tests', () => {
  const institutionClaims = [
    { testId: 'ielts', acceptanceScope: 'institution', minimumOverallScore: 6.5 },
    { testId: 'toefl-ibt', acceptanceScope: 'institution', minimumOverallScore: 4.5 },
  ];
  const programClaims = [{ testId: 'ielts', acceptanceScope: 'program', minimumOverallScore: 7 }];
  const resolved = mergeProgramAcceptanceWithInstitutionFallback(programClaims, institutionClaims);
  assert.equal(resolved.programClaims[0].minimumOverallScore, 7);
  assert.equal(resolved.institutionFallback.length, 1);
  assert.equal(resolved.institutionFallback[0].testId, 'toefl-ibt');
});

test('Trinity Band B is program-specific for both canonical launch programs', () => {
  const trinity = INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.filter((claim) => claim.institutionSlug === 'trinity-college-dublin');
  assert.equal(trinity.filter((claim) => claim.acceptanceScope === 'institution').length, 4);
  assert.equal(trinity.filter((claim) => claim.acceptanceScope === 'program').length, 8);
  assert.ok(trinity.filter((claim) => claim.programSlug === 'trinity-college-dublin-computer-science-data-science').every((claim) => claim.minimumOverallScore != null));
  assert.ok(trinity.filter((claim) => claim.programSlug === 'trinity-college-dublin-computer-science').every((claim) => claim.degreeLevels.includes('bachelor')));
  assert.match(fallbackScopeLabel('institution'), /Institution-level guidance/);
});

test('public projection preserves scope, score context, conditions, and source context', () => {
  const publicClaim = projectPublicAcceptance({
    _id: 'claim', testId: { _id: 'toefl', name: 'TOEFL iBT', scoreScale: '1-6 current scale' },
    acceptanceScope: 'institution', acceptanceStatus: 'accepted', minimumOverallScore: 4.5,
    sectionMinimums: [{ sectionName: 'Writing', minimum: 4.5 }],
    conditions: 'Current 1-6 scale; verify the program page for higher requirements.',
    sources: [{ sourceType: 'official_university', sourceUrl: 'https://example.edu/requirements', publisher: 'Example University', evidenceRef: 'English requirements', verifiedAt: '2026-09-01T00:00:00.000Z', retrievedAt: '2026-09-01T00:00:00.000Z' }],
    verificationStatus: 'verified', freshnessState: 'fresh', lastVerifiedAt: '2026-09-01T00:00:00.000Z', status: 'published',
  });
  assert.equal(publicClaim.acceptanceScope, 'institution');
  assert.equal(publicClaim.minimumOverallScore, 4.5);
  assert.equal(publicClaim.testScoreScale, '1-6 current scale');
  assert.match(publicClaim.conditions, /1-6 scale/);
  assert.equal(publicClaim.sources[0].sourceUrl, 'https://example.edu/requirements');
  assert.equal(publicClaim.sources[0].evidenceRef, 'English requirements');
  assert.equal(publicClaim.adminNotes, undefined);
});

test('canonical launch programs and institutions remain unchanged and no TestAcceptance data is added to their packs', () => {
  assert.equal(INTERNATIONAL_INSTITUTION_LAUNCH_PACK.length, 6);
  assert.equal(INTERNATIONAL_INSTITUTION_LAUNCH_PACK.flatMap(({ programs }) => programs).length, 12);
  assert.ok(INTERNATIONAL_ACCEPTANCE_LAUNCH_PACK.every((claim) => !claim.scholarship && !claim.funding));
});
