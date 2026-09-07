import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  APPROVED_TARGETS,
  CONFIRMATION,
  EXCLUDED_TARGET,
  buildPublicationPayload,
  extractInventoryPage,
  isPublishConfirmation,
  runPublication,
  selectApprovedCandidates,
  validatePreflightRecord,
} from './publish-canonical-institutions-batch01a.mjs';

const candidate = (target, overrides = {}) => ({
  productionId: target.id,
  officialName: target.officialName,
  slug: target.slug,
  countryCode: 'PK',
  status: 'draft',
  launchEligible: false,
  sources: [{ sourceUrl: `https://example.test/${target.slug}`, sourceType: 'institution_homepage' }],
  ...overrides,
});

const row = (target, overrides = {}) => ({
  _id: target.id,
  officialName: target.officialName,
  slug: target.slug,
  countryCode: 'PK',
  status: 'draft',
  launchEligible: false,
  sources: [{ sourceUrl: `https://example.test/${target.slug}` }],
  ...overrides,
});

test('allowlist contains exactly eight approved records and excludes Girls Cadet College', () => {
  assert.equal(APPROVED_TARGETS.length, 8);
  assert.equal(APPROVED_TARGETS.some((item) => item.id === EXCLUDED_TARGET.id), false);
});

test('publication payload is status-only', () => {
  assert.deepEqual(buildPublicationPayload(), { status: 'published' });
});

test('exact confirmation is required', () => {
  assert.equal(CONFIRMATION, 'PUBLISH 8');
  assert.equal(isPublishConfirmation('PUBLISH 8'), true);
  assert.equal(isPublishConfirmation('publish 8'), false);
  assert.equal(isPublishConfirmation('MIGRATE'), false);
});

test('selection ignores the excluded source record and selects only approved records', () => {
  const input = APPROVED_TARGETS.map(candidate);
  assert.equal(selectApprovedCandidates({ candidates: input }).length, 8);
  const selected = selectApprovedCandidates({ candidates: [...input, candidate(EXCLUDED_TARGET)] });
  assert.equal(selected.length, 8);
  assert.equal(selected.some((item) => item.productionId === EXCLUDED_TARGET.id), false);
});

test('preflight requires exact identity, draft state, false launch eligibility, PK, sources, and one match', () => {
  const target = APPROVED_TARGETS[0];
  const good = validatePreflightRecord(candidate(target), row(target), [row(target)]);
  assert.equal(good.ok, true);
  assert.equal(validatePreflightRecord(candidate(target), row(target, { slug: 'wrong' }), [row(target)]).ok, false);
  assert.equal(validatePreflightRecord(candidate(target), row(target, { status: 'published', launchEligible: false }), [row(target)]).ok, false);
  assert.equal(validatePreflightRecord(candidate(target), row(target, { launchEligible: null }), [row(target)]).ok, false);
  assert.equal(validatePreflightRecord(candidate(target), row(target, { sources: [] }), [row(target)]).ok, false);
  assert.equal(validatePreflightRecord(candidate(target), row(target), [row(target), row(target)]).ok, false);
});

test('already published exact target is safely resumable without requiring republish', () => {
  const target = APPROVED_TARGETS[0];
  const result = validatePreflightRecord(candidate(target), row(target, { status: 'published', launchEligible: true }), [row(target)]);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyPublished, true);
});

test('wrong ID is rejected even when slug matches', () => {
  const target = APPROVED_TARGETS[0];
  assert.equal(validatePreflightRecord(candidate(target), row(target, { _id: 'other' }), [row(target)]).ok, false);
});

test('dry-run performs complete preflight and zero mutations', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strideto-publish-test-'));
  const inputPath = path.join(dir, 'batch.json');
  await fs.writeFile(inputPath, JSON.stringify({ candidates: APPROVED_TARGETS.map(candidate) }));
  const rows = APPROVED_TARGETS.map(row);
  let patchCalls = 0;
  const client = {
    async get(requestPath) {
      if (requestPath.includes('?page=')) return { data: rows, pagination: { pages: 1 } };
      return rows.find((item) => requestPath.endsWith(item._id));
    },
    async patch() { patchCalls += 1; throw new Error('mutation must not be called in dry-run'); },
  };
  const report = await runPublication({ inputPath, client, live: false });
  assert.equal(report.preflightPassed, true);
  assert.equal(report.published, 0);
  assert.equal(patchCalls, 0);
});

test('inventory extraction accepts the controller shape and the unwrapped array shape', () => {
  const rows = [{ _id: APPROVED_TARGETS[0].id }];
  assert.deepEqual(extractInventoryPage({ data: rows, pages: 1 }), { rows, pages: 1 });
  assert.deepEqual(extractInventoryPage(rows), { rows, pages: 1 });
});

test('all eight approved targets resolve exactly once from an unwrapped inventory array', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strideto-publish-test-'));
  const inputPath = path.join(dir, 'batch.json');
  await fs.writeFile(inputPath, JSON.stringify({ candidates: APPROVED_TARGETS.map(candidate) }));
  const rows = APPROVED_TARGETS.map(row);
  let patchCalls = 0;
  const client = {
    async get(requestPath) {
      if (requestPath.includes('?page=')) return rows;
      return rows.find((item) => requestPath.endsWith(item._id));
    },
    async patch() { patchCalls += 1; throw new Error('dry-run must not patch'); },
  };
  const report = await runPublication({ inputPath, client, live: false });
  assert.equal(report.preflightPassed, true);
  assert.equal(report.results.filter((result) => result.preflight === 'PASS').length, 8);
  assert.equal(patchCalls, 0);
});

test('missing or duplicate inventory identity fails preflight', () => {
  const target = APPROVED_TARGETS[0];
  assert.match(validatePreflightRecord(candidate(target), row(target), []).errors.join('; '), /match count is 0/);
  assert.match(validatePreflightRecord(candidate(target), row(target), [row(target), row(target)]).errors.join('; '), /match count is 2/);
});

test('exact GET-by-ID disagreement fails despite an inventory match', () => {
  const target = APPROVED_TARGETS[0];
  const result = validatePreflightRecord(candidate(target), row(target, { officialName: 'Wrong Name' }), [row(target)]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('; '), /slug\/name mismatch/);
});

test('live intent without exact confirmation performs zero mutations', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strideto-publish-test-'));
  const inputPath = path.join(dir, 'batch.json');
  await fs.writeFile(inputPath, JSON.stringify({ candidates: APPROVED_TARGETS.map(candidate) }));
  const rows = APPROVED_TARGETS.map(row);
  let patchCalls = 0;
  const client = {
    async get(requestPath) {
      if (requestPath.includes('?page=')) return { data: rows, pagination: { pages: 1 } };
      return rows.find((item) => requestPath.endsWith(item._id));
    },
    async patch() { patchCalls += 1; return {}; },
  };
  const report = await runPublication({ inputPath, client, live: true, confirm: async () => false });
  assert.equal(report.preflightPassed, true);
  assert.equal(report.confirmationReceived, false);
  assert.equal(report.stopped, true);
  assert.equal(patchCalls, 0);
});
