import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildPayload, classifyDuplicate, validateBatchSize, validateCandidate } from './migrate-canonical-institutions-to-production.mjs';

const base = {
  officialName: 'Example College', slug: 'example-college', institutionType: 'college', countryCode: 'PK',
  officialWebsite: 'https://example.edu.pk/', officialDomain: 'example.edu.pk',
  city: 'Lahore', sources: [{ sourceType: 'institution_homepage', sourceUrl: 'https://example.edu.pk/', publisher: 'Example College', retrievedAt: '2026-09-07T00:00:00Z', verifiedAt: '2026-09-07T00:00:00Z' }],
  status: 'draft', launchEligible: false,
};

test('valid PK candidate passes and draft/launch policy is explicit', () => {
  assert.deepEqual(validateCandidate(base), []);
  assert.equal(buildPayload(base).status, 'draft');
  assert.equal(buildPayload(base).launchEligible, false);
});

test('invalid type, country, source, and publication state are rejected', () => {
  const errors = validateCandidate({ ...base, institutionType: 'university', countryCode: 'GB', sources: [], status: 'published', launchEligible: true });
  assert.ok(errors.some((error) => error.includes('institutionType')));
  assert.ok(errors.some((error) => error.includes('countryCode')));
  assert.ok(errors.some((error) => error.includes('source evidence')));
  assert.ok(errors.some((error) => error.includes('status')));
  assert.ok(errors.some((error) => error.includes('launchEligible')));
});

test('duplicate priority skips exact domain/website/slug and reviews name-location matches', () => {
  assert.equal(classifyDuplicate(base, [{ officialDomain: 'example.edu.pk', slug: 'other', officialName: 'Other', city: 'Lahore' }]).status, 'DUPLICATE_SKIP');
  assert.equal(classifyDuplicate(base, [{ officialDomain: 'other.edu.pk', slug: 'other', officialName: 'Example College', city: 'Lahore' }]).status, 'REVIEW_REQUIRED');
  assert.equal(classifyDuplicate(base, []).status, 'SAFE_TO_CREATE');
});

test('batch size is bounded to 1 through 10', () => {
  validateBatchSize(1);
  validateBatchSize(10);
  assert.throws(() => validateBatchSize(0), /between 1 and 10/);
  assert.throws(() => validateBatchSize(11), /between 1 and 10/);
});

test('payload contains only canonical create fields and no candidate metadata', () => {
  const payload = buildPayload({ ...base, candidateId: 'not-api-field', sourceQuality: 'SOURCE_STRONG', duplicateStatus: 'UNIQUE' });
  assert.equal(payload.candidateId, undefined);
  assert.equal(payload.sourceQuality, undefined);
  assert.equal(payload.status, 'draft');
  assert.equal(payload.launchEligible, false);
});

test('ready input contains exactly nine API-shaped PK candidates', async () => {
  const input = JSON.parse(await fs.readFile('qa-artifacts/schools-colleges-pakistan-batch01a-ready.json', 'utf8'));
  assert.equal(input.candidates.length, 9);
  for (const candidate of input.candidates) {
    assert.deepEqual(validateCandidate(candidate), []);
    assert.equal(candidate.countryCode, 'PK');
    assert.equal(candidate.status, 'draft');
    assert.equal(candidate.launchEligible, false);
  }
});

test('migration source is canonical-only and has no Mongo or legacy endpoint path', async () => {
  const source = await fs.readFile('scripts/migrate-canonical-institutions-to-production.mjs', 'utf8');
  assert.doesNotMatch(source, /mongoose|MongoClient|mongodb:\/\//i);
  assert.doesNotMatch(source, /\/admin\/institutions(?!\/education)/i);
  assert.match(source, /\/admin\/education\/institutions/);
});

test('live path requires explicit MIGRATE confirmation and stops on readback mismatch', async () => {
  const source = await fs.readFile('scripts/migrate-canonical-institutions-to-production.mjs', 'utf8');
  assert.match(source, /Type MIGRATE/);
  assert.match(source, /READBACK_MISMATCH/);
  assert.match(source, /report\.stopped = true/);
});
