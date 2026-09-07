import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import {
  buildCanonicalQuery,
  canonicalType,
  legacyQuery,
  mapCanonical,
} from '../controllers/schoolsAndCollegesController.js';
import { SCHOOLS_COLLEGES_INSTITUTION_TYPES } from '../../../shared/education/taxonomy.js';

test('Schools & Colleges canonical type mapping is explicit', () => {
  assert.deepEqual(SCHOOLS_COLLEGES_INSTITUTION_TYPES, ['school', 'college', 'institute']);
  assert.equal(canonicalType('school'), 'school');
  assert.equal(canonicalType('college'), 'college');
  assert.equal(canonicalType('technical_institute'), 'institute');
  assert.equal(canonicalType('training_center'), '__unsupported__');
});

test('canonical school query is Pakistan-only and supports filters', () => {
  const query = buildCanonicalQuery({ search: 'academy', province: 'Punjab', city: 'Lahore', type: 'school' });
  const serialized = JSON.stringify(query);
  assert.match(serialized, /"countryCode":"PK"/);
  assert.match(serialized, /"institutionType":"school"/);
  assert.match(serialized, /officialName/);
  assert.match(serialized, /description/);
  assert.match(serialized, /region/);
  assert.match(serialized, /city/);
  assert.match(serialized, /launchEligible/);
});

test('unsupported specialized type cannot enter the canonical query', () => {
  const query = buildCanonicalQuery({ type: 'training_center' });
  assert.equal(query.institutionType, '__unsupported__');
  assert.equal(canonicalType('university'), '__unsupported__');
});

test('legacy fallback preserves supported type filters and rejects unsupported ones', () => {
  assert.equal(legacyQuery({ type: 'institute' }).type, 'technical_institute');
  assert.equal(legacyQuery({ type: 'college' }).type, 'college');
  assert.equal(legacyQuery({ type: 'university' }).type, '__unsupported__');
});

test('canonical projection maps profile fields and published program data without embedded mutation', () => {
  const source = {
    _id: 'institution-id',
    officialName: 'Example College',
    slug: 'example-college',
    countryCode: 'PK',
    region: 'Punjab',
    city: 'Lahore',
    institutionType: 'college',
    description: 'Source-backed summary',
    address: 'Official address',
    logoUrl: 'https://example.edu/logo.png',
    sources: [{ sourceUrl: 'https://example.edu/about' }],
    status: 'published',
    launchEligible: true,
  };
  const mapped = mapCanonical(source, 1, [{ name: 'Intermediate Science' }]);
  assert.equal(mapped.name, source.officialName);
  assert.equal(mapped.countryCode, 'PK');
  assert.equal(mapped.type, 'college');
  assert.equal(mapped.programCount, 1);
  assert.deepEqual(mapped.programs, ['Intermediate Science']);
  assert.equal(mapped.canonicalSource, 'CanonicalInstitution');
});

test('canonical model exposes optional Schools & Colleges profile fields', () => {
  for (const field of ['description', 'address', 'district', 'logoUrl', 'phone', 'email', 'accreditations', 'establishedYear']) {
    assert.ok(CanonicalInstitution.schema.path(field), `${field} schema path`);
  }
});

test('bridge source has no legacy write or embedded-program persistence path', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../controllers/schoolsAndCollegesController.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Institution\.create|Institution\.findOneAndUpdate|Institution\.updateOne/);
  assert.match(source, /Program\.find/);
});
