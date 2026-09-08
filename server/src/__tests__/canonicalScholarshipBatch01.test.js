import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateSource } from '../../../shared/international/evidence.js';
import { isValidDegreeLevel, isValidPubStatus } from '../../../shared/education/taxonomy.js';
import { isValidApplicationMethod, isValidFundingType, isValidScholarshipType } from '../../../shared/education/scholarshipIntelligence.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'qa-artifacts/scholarships-batch01-canonical-ready.json'), 'utf8'));

test('canonical scholarship batch contains only the nine local ready records', () => {
  assert.equal(artifact.records.length, 9);
  assert.equal(artifact.duplicatePreflight.productionRead, false);
  assert.ok(!artifact.records.some((r) => /erasmus/i.test(r.scholarship.title)));
});

test('canonical records use accepted draft fields and preserve official evidence', () => {
  for (const record of artifact.records) {
    const scholarship = record.scholarship;
    assert.equal(scholarship.status, 'draft');
    assert.equal(record.canonicalState, 'draft_non_public');
    assert.equal(scholarship.sources.length > 0, true);
    assert.match(scholarship.sources[0].sourceUrl, /^https:\/\//);
    assert.equal(scholarship.sources[0].publisher.length > 0, true);
    assert.equal(scholarship.applicationUrl.startsWith('https://'), true);
    assert.equal(record.cycle.status, 'draft');
    assert.equal(record.cycle.sources.length > 0, true);
  }
});

test('deadline semantics never invent a date for non-fixed cycles', () => {
  const byTitle = new Map(artifact.records.map((r) => [r.scholarship.title, r]));
  assert.equal(byTitle.get('Clarendon Fund Scholarship 2027').cycle.deadlineAt, null);
  assert.equal(byTitle.get('UBC International Scholars Program 2027').cycle.deadlineAt, null);
  assert.equal(byTitle.get('Monash Awards 2027').cycle.deadlineAt, null);
  assert.equal(byTitle.get('Reach Oxford Scholarship 2027').cycle.deadlineAt, '2027-01-26');
  assert.equal(byTitle.get('University of Sydney RTP and International Stipend Scholarships 2027').cycle.deadlineAt, '2026-09-11');
});

test('canonical preparation is an offline artifact operation', () => {
  assert.equal(artifact.status, 'PREPRODUCTION');
  assert.equal(artifact.duplicatePreflight.productionRead, false);
  assert.equal(Object.hasOwn(artifact.records[0].scholarship, 'launchEligible'), false);
});

test('mapped payload values satisfy the shared canonical vocabularies', () => {
  for (const record of artifact.records) {
    const scholarship = record.scholarship;
    assert.equal(isValidScholarshipType(scholarship.scholarshipType), true);
    assert.equal(isValidFundingType(scholarship.funding.type), true);
    assert.equal(isValidApplicationMethod(scholarship.applicationMethod), true);
    assert.equal(isValidPubStatus(scholarship.status), true);
    assert.ok(scholarship.degreeLevels.every(isValidDegreeLevel));
    assert.equal(validateSource(scholarship.sources[0]).ok, true);
    assert.equal(validateSource(record.cycle.sources[0]).ok, true);
    assert.equal(scholarship.sources[0].sourceUrl, record.cycle.sources[0].sourceUrl);
  }
});
