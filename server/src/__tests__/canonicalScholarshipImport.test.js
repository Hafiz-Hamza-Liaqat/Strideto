import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BATCH_TITLES, classify, normalize, payloads, validateBatch } from '../../../scripts/lib/canonicalScholarshipImport.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'qa-artifacts/scholarships-batch01-canonical-ready.json'), 'utf8'));

test('exact Batch 01 allowlist validates', () => {
  assert.equal(validateBatch(artifact).length, 9);
  assert.deepEqual(artifact.records.map((r) => normalize(r.scholarship.title)), BATCH_TITLES.map(normalize));
});

test('payloads preserve draft/source/application/deadline contracts without launchEligible', () => {
  for (const record of artifact.records) {
    const payload = payloads(record);
    assert.equal(payload.scholarship.status, 'draft');
    assert.equal(payload.cycle.status, 'draft');
    assert.ok(payload.scholarship.sources.length > 0);
    assert.ok(payload.cycle.sources.length > 0);
    assert.ok(payload.scholarship.applicationUrl.startsWith('https://'));
    assert.equal(Object.hasOwn(payload.scholarship, 'launchEligible'), false);
    assert.equal(Object.hasOwn(payload.cycle, 'launchEligible'), false);
  }
});

test('duplicate and partial cycle classifications are distinct', () => {
  const record = artifact.records[0];
  const existing = [{ _id: 'sch-1', title: record.scholarship.title, provider: record.scholarship.provider, sources: record.scholarship.sources }];
  assert.equal(classify(record, existing, []).classification, 'EXISTING_SCHOLARSHIP_NEW_CYCLE');
  assert.equal(classify(record, existing, [{ scholarshipId: 'sch-1', academicYear: record.cycle.academicYear }]).classification, 'DUPLICATE_SKIP');
  assert.equal(classify(record, [existing[0], { _id: 'sch-2', title: record.scholarship.title, provider: record.scholarship.provider, sources: record.scholarship.sources }], []).classification, 'REVIEW_REQUIRED');
});

test('invalid/non-draft/source-less batches are rejected before authentication or writes', () => {
  const clone = structuredClone(artifact);
  clone.records[0].scholarship.status = 'published';
  assert.throws(() => validateBatch(clone), /draft/);
  const missingSource = structuredClone(artifact);
  missingSource.records[0].scholarship.sources = [];
  assert.throws(() => validateBatch(missingSource), /source evidence/);
});

test('scholarship preparation artifacts reject common UTF-8 mojibake', () => {
  const forbidden = [
    String.fromCodePoint(0x00e2),
    String.fromCodePoint(0x00c3),
    String.fromCodePoint(0x00c2),
  ];
  for (const relative of [
    'qa-artifacts/scholarships-batch01-candidates.json',
    'qa-artifacts/scholarships-batch01-ready.json',
    'qa-artifacts/scholarships-batch01-canonical-ready.json',
  ]) {
    const raw = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.equal(forbidden.some((sequence) => raw.includes(sequence)), false, relative);
  }
});

test('live mode requires an explicit artifact hash and no legacy/write-broadening path exists', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts/migrate-canonical-scholarships-batch01.mjs'), 'utf8');
  assert.match(runner, /requires --sha256/);
  assert.match(runner, /IMPORT 9/);
  assert.doesNotMatch(runner, /CanonicalInstitution|Legacy Scholarship|findByIdAndDelete/);
  assert.doesNotMatch(runner, /\.publish\(|status:\s*['\"]published['\"]|\/publish/);
});
