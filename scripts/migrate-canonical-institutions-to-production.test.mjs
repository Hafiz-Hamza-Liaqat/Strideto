import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Readable, Writable } from 'node:stream';
import { buildPayload, classifyDuplicate, compareReadback, confirmMigration, isMigrationConfirmation, parseArgs, validateBatchSize, validateCandidate } from './migrate-canonical-institutions-to-production.mjs';

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

test('institution source taxonomy accepts official institution sources and rejects unknown types', () => {
  assert.deepEqual(validateCandidate({ ...base, sources: [{ ...base.sources[0], sourceType: 'institution_homepage' }] }), []);
  assert.ok(validateCandidate({ ...base, sources: [{ ...base.sources[0], sourceType: 'not-a-source-type' }] }).some((error) => error.includes('sourceType')));
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

test('mode selection defaults to dry-run and requires explicit --live', () => {
  assert.deepEqual(parseArgs([]), {
    input: 'qa-artifacts/schools-colleges-pakistan-batch01a-ready.json',
    base: 'https://api.strideto.com/api',
    dryRun: true,
    live: false,
    report: 'qa-artifacts/schools-colleges-pakistan-batch01a-ready.migration-report.json',
  });
  assert.equal(parseArgs(['--dry-run']).dryRun, true);
  assert.equal(parseArgs(['--dry-run']).live, false);
  assert.equal(parseArgs(['--live']).live, true);
  assert.equal(parseArgs(['--live']).dryRun, false);
});

test('confirmation accepts only exact MIGRATE and rejects wrong input', async () => {
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  assert.equal(isMigrationConfirmation(undefined), false);
  assert.equal(isMigrationConfirmation(''), false);
  assert.equal(await confirmMigration({ input: Readable.from(['MIGRATE\n']), output }), true);
  assert.equal(await confirmMigration({ input: Readable.from(['no\n']), output }), false);
});

test('payload contains only canonical create fields and no candidate metadata', () => {
  const payload = buildPayload({ ...base, candidateId: 'not-api-field', sourceQuality: 'SOURCE_STRONG', duplicateStatus: 'UNIQUE' });
  assert.equal(payload.candidateId, undefined);
  assert.equal(payload.sourceQuality, undefined);
  assert.equal(payload.status, 'draft');
  assert.equal(payload.launchEligible, false);
});

test('readback comparator accepts exact and safe string normalization', () => {
  const exact = compareReadback(base, { officialName: 'Example College', slug: 'example-college', institutionType: 'college', countryCode: 'PK', city: 'Lahore', officialWebsite: 'https://example.edu.pk/', officialDomain: 'example.edu.pk', sources: base.sources, status: 'draft', launchEligible: false });
  assert.equal(exact.ok, true);
  assert.ok(exact.fields.every((field) => field.classification !== 'MISMATCH_REAL'));

  const normalized = compareReadback(base, { officialName: ' Example College ', slug: 'EXAMPLE-COLLEGE', institutionType: 'COLLEGE', countryCode: 'pk', city: ' lahore ', officialWebsite: 'https://example.edu.pk/?utm=ignored', officialDomain: 'WWW.EXAMPLE.EDU.PK', sources: base.sources.map((source) => ({ ...source, retrievedAt: '2026-09-07T00:00:00.000Z', verifiedAt: '2026-09-07T00:00:00.000Z' })), status: 'DRAFT', launchEligible: false });
  assert.equal(normalized.ok, true);
  assert.ok(normalized.fields.some((field) => field.classification === 'NORMALIZED_EQUIVALENT'));
});

test('optional empty website/domain values normalize only null, undefined, and empty strings', () => {
  const website = compareReadback({ ...base, officialWebsite: null, officialDomain: null }, {
    ...base, officialWebsite: '', officialDomain: '', sources: base.sources,
  });
  assert.equal(website.ok, true);
  assert.equal(website.fields.find((field) => field.field === 'officialWebsite').classification, 'NORMALIZED_EQUIVALENT');
  assert.equal(website.fields.find((field) => field.field === 'officialDomain').classification, 'NORMALIZED_EQUIVALENT');

  const missingWebsite = compareReadback(base, { ...base, officialWebsite: '', officialDomain: '', sources: base.sources });
  assert.equal(missingWebsite.ok, false);
  assert.equal(missingWebsite.fields.find((field) => field.field === 'officialWebsite').classification, 'MISMATCH_REAL');
});

test('readback comparator retains genuine mismatches and required field absence', () => {
  const comparison = compareReadback(base, { officialName: 'Example College', slug: 'example-college', institutionType: 'college', countryCode: 'PK', city: 'Lahore', officialWebsite: 'https://example.edu.pk/', officialDomain: 'example.edu.pk', sources: base.sources, status: 'draft' });
  assert.equal(comparison.ok, false);
  assert.equal(comparison.fields.find((field) => field.field === 'launchEligible').classification, 'MISMATCH_REAL');
  const wrongIdentity = compareReadback(base, { officialName: 'Other College', slug: 'example-college', institutionType: 'college', countryCode: 'PK', city: 'Lahore', officialWebsite: 'https://example.edu.pk/', officialDomain: 'example.edu.pk', sources: base.sources, status: 'draft', launchEligible: false });
  assert.equal(wrongIdentity.ok, false);
  const wrongSource = compareReadback(base, { officialName: 'Example College', slug: 'example-college', institutionType: 'college', countryCode: 'PK', city: 'Lahore', officialWebsite: 'https://example.edu.pk/', officialDomain: 'example.edu.pk', sources: [{ ...base.sources[0], sourceUrl: 'https://other.example.edu.pk/' }], status: 'draft', launchEligible: false });
  assert.equal(wrongSource.ok, false);
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

test('readback inspector is GET-only and prints only safe fields', async () => {
  const source = await fs.readFile('scripts/inspect-canonical-institution-readback.mjs', 'utf8');
  assert.match(source, /createProductionReadClient/);
  assert.match(source, /allowedPrefixes: \['\/admin\/education\/institutions'\]/);
  assert.doesNotMatch(source, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(source, /password|authorization|cookie|token/i);
});

test('live path requires explicit MIGRATE confirmation and stops on readback mismatch', async () => {
  const source = await fs.readFile('scripts/migrate-canonical-institutions-to-production.mjs', 'utf8');
  assert.match(source, /Type MIGRATE/);
  assert.match(source, /READBACK_MISMATCH/);
  assert.match(source, /POST_SUCCEEDED_READBACK_MISMATCH/);
  assert.match(source, /postSucceeded/);
  assert.match(source, /readbackMismatch/);
  assert.match(source, /report\.stopped = true/);
  assert.match(source, /if \(!live\) \{ report\.results\.push\(result\); continue; \}/);
  assert.match(source, /method: 'POST'/);
  assert.match(source, /const safePlans = \[\]/);
  assert.match(source, /if \(live && safePlans\.length && !await confirmMigration\(\)\)/);
});
