/**
 * Phase 17D-8A — live-like Case indexes (autoIndex=false).
 *
 *   STRIDETO_17D8A_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8a_index_run1
 *   node src/__tests__/phase17d8aLiveIndexIdempotency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GbsCase } from '../models/gbs/GbsCase.js';
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import {
  GBS_CASE_CRITICAL_INDEXES,
  GBS_QUOTE_CRITICAL_INDEXES,
  IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  compareCriticalIndexes,
  provisionCriticalIdempotencyIndexes,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';

const TEST_URI = process.env.STRIDETO_17D8A_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8a_index_run1';
if (!/\/strideto_17d8a_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8A_TEST_MONGO_URI must name a disposable strideto_17d8a_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('case critical indexes are provisioned create-only while autoIndex is false', async () => {
  assert.equal(process.env.MONGO_AUTO_INDEX, undefined);
  let before = [];
  try {
    before = await GbsCase.collection.indexes();
  } catch (err) {
    assert.equal(Number(err.code) === 26 || err.codeName === 'NamespaceNotFound', true);
  }
  assert.equal(before.filter((idx) => idx.name !== '_id_').length, 0, 'Case starts without application indexes');

  await GbsCase.collection.createIndex({ leftover: 1 }, { name: 'p17d8a_keep_me' });

  const first = await provisionCriticalIdempotencyIndexes();
  const second = await provisionCriticalIdempotencyIndexes();
  const [a, b] = await Promise.all([
    provisionCriticalIdempotencyIndexes(),
    provisionCriticalIdempotencyIndexes(),
  ]);
  assert.equal(first.case.comparison.ok, true);
  assert.equal(first.quote.comparison.ok, true);
  assert.equal(first.idempotency.comparison.ok, true);
  assert.equal(second.case.created.length, 0);
  assert.ok(a.case.comparison.ok && b.case.comparison.ok);

  const caseIdx = await GbsCase.collection.indexes();
  const quoteIdx = await GbsQuote.collection.indexes();
  const idemIdx = await IdempotencyRecord.collection.indexes();
  assert.equal(caseIdx.some((idx) => idx.name === 'p17d8a_keep_me'), true, 'unrelated index is not removed');
  for (const spec of GBS_CASE_CRITICAL_INDEXES) {
    assert.ok(caseIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  const quoteUnique = caseIdx.find((idx) => idx.name === 'gbs_case_quote_unique');
  assert.equal(quoteUnique?.unique, true);
  for (const spec of GBS_QUOTE_CRITICAL_INDEXES) {
    assert.ok(quoteIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of IDEMPOTENCY_RECORD_CRITICAL_INDEXES) {
    assert.ok(idemIdx.some((idx) => idx.name === spec.name), spec.name);
  }

  const again = await provisionMissingIndexes({
    collection: GbsCase.collection,
    expected: GBS_CASE_CRITICAL_INDEXES,
  });
  assert.deepEqual(again.created, []);

  const comparison = compareCriticalIndexes(GBS_CASE_CRITICAL_INDEXES, caseIdx);
  assert.equal(comparison.ok, true);
});
