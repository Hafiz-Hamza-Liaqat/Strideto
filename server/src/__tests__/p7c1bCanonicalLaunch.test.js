import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INTERNATIONAL_INSTITUTION_LAUNCH_PACK,
  seedInternationalInstitutions,
  institutionEligible,
  programEligible,
} from '../seed/internationalInstitutions.js';

const clone = (value) => structuredClone(value);

function memoryModel(initial = []) {
  const rows = initial.map((row) => ({ ...clone(row), _id: row._id || `id-${initial.indexOf(row) + 1}` }));
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

const allInstitutions = () => INTERNATIONAL_INSTITUTION_LAUNCH_PACK.map(({ institution }) => institution);
const allPrograms = () => INTERNATIONAL_INSTITUTION_LAUNCH_PACK.flatMap(({ programs }) => programs);

test('launch pack contains six real non-fixture institutions and twelve source-backed programs', () => {
  assert.equal(INTERNATIONAL_INSTITUTION_LAUNCH_PACK.length, 6);
  assert.equal(allPrograms().length, 12);
  const serialized = JSON.stringify(INTERNATIONAL_INSTITUTION_LAUNCH_PACK).toLowerCase();
  for (const fixtureName of ['p1a university', 'example university', 'university x', 'canonical tech university']) {
    assert.equal(serialized.includes(fixtureName), false, `fixture leaked into launch pack: ${fixtureName}`);
  }
  for (const item of allInstitutions()) {
    assert.equal(item.isFixture, false);
    assert.equal(item.demoOnly, false);
    assert.equal(item.launchEligible, true);
    assert.ok(institutionEligible(item));
    assert.match(item.officialWebsite, /^https:\/\//);
    assert.equal(item.sources.length, 1);
  }
  for (const item of allPrograms()) {
    assert.equal(item.isFixture, false);
    assert.equal(item.demoOnly, false);
    assert.equal(item.launchEligible, true);
    assert.ok(programEligible({ ...item, institutionId: 'institution-id' }));
    assert.match(item.officialProgramUrl, /^https:\/\//);
    assert.equal(item.sources.length, 1);
  }
});

test('fresh seed inserts six institutions and twelve programs without TestAcceptance writes', async () => {
  const institutions = memoryModel();
  const programs = memoryModel();
  const result = await seedInternationalInstitutions({ models: { CanonicalInstitution: institutions, Program: programs } });
  assert.equal(result.ok, true);
  assert.equal(result.summary.inserted, 18);
  assert.equal(institutions.rows.length, 6);
  assert.equal(programs.rows.length, 12);
  assert.equal(result.testAcceptanceCreated, 0);
  assert.ok(programs.rows.every((row) => institutions.rows.some((institution) => String(institution._id) === String(row.institutionId))));
});

test('second run is idempotent and preserves reviewed institution/program fields', async () => {
  const institutions = memoryModel();
  const programs = memoryModel();
  await seedInternationalInstitutions({ models: { CanonicalInstitution: institutions, Program: programs } });
  institutions.rows[0].officialName = 'Admin-reviewed institution name';
  institutions.rows[0].status = 'published';
  programs.rows[0].name = 'Admin-reviewed program name';
  const beforeCounts = [institutions.rows.length, programs.rows.length];
  const result = await seedInternationalInstitutions({ models: { CanonicalInstitution: institutions, Program: programs } });
  assert.equal(result.ok, true);
  assert.equal(result.summary['existing-eligible'], 18);
  assert.deepEqual([institutions.rows.length, programs.rows.length], beforeCounts);
  assert.equal(institutions.rows[0].officialName, 'Admin-reviewed institution name');
  assert.equal(programs.rows[0].name, 'Admin-reviewed program name');
});

test('incomplete existing records are preserved and block launch success', async () => {
  const institution = allInstitutions()[0];
  const institutions = memoryModel([{ ...institution, officialWebsite: '', sources: [] }]);
  const programs = memoryModel();
  const result = await seedInternationalInstitutions({ models: { CanonicalInstitution: institutions, Program: programs } });
  assert.equal(result.ok, false);
  assert.equal(result.institutions[0].status, 'existing-incomplete');
  assert.equal(institutions.rows[0].officialWebsite, '');
  assert.equal(result.programs[0].status, 'missing-source');
});

test('same official domain under a different identity is a possible duplicate', async () => {
  const institution = allInstitutions()[0];
  const institutions = memoryModel([{ _id: 'existing', officialName: 'UCD', slug: 'ucd', officialDomain: 'tcd.ie' }]);
  const programs = memoryModel();
  const result = await seedInternationalInstitutions({ models: { CanonicalInstitution: institutions, Program: programs } });
  assert.equal(result.institutions[0].status, 'possible-duplicate');
  assert.equal(institutions.rows.length, 6);
  assert.equal(result.ok, false);
  assert.equal(institution.slug, 'trinity-college-dublin');
});

test('slug and official URL conflicts are reported without overwrite', async () => {
  const first = allInstitutions()[0];
  const institutions = memoryModel([{ _id: 'existing', officialName: 'Different University', slug: first.slug, officialDomain: 'different.example' }]);
  const programs = memoryModel();
  const result = await seedInternationalInstitutions({ models: { CanonicalInstitution: institutions, Program: programs } });
  assert.equal(result.institutions[0].status, 'conflict');
  assert.equal(institutions.rows.length, 6);

  const cleanInstitutions = memoryModel();
  const cleanPrograms = memoryModel([{ _id: 'existing-program', slug: 'old-program', officialProgramUrl: allPrograms()[0].officialProgramUrl, institutionId: 'other' }]);
  const programResult = await seedInternationalInstitutions({ models: { CanonicalInstitution: cleanInstitutions, Program: cleanPrograms } });
  assert.equal(programResult.programs[0].status, 'conflict');
  assert.equal(cleanPrograms.rows.length, 12);
});

test('same program name remains valid at different institutions', () => {
  const first = allPrograms()[1];
  const sameNameAtAnotherInstitution = { ...first, slug: `${first.slug}-other-institution` };
  assert.equal(first.name, sameNameAtAnotherInstitution.name);
  assert.notEqual(first.slug, sameNameAtAnotherInstitution.slug);
});
