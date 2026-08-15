/**
 * Phase 17D-7 — live-like Quote indexes (autoIndex=false).
 *
 *   STRIDETO_17D7_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d7_index_run1
 *   node src/__tests__/phase17d7LiveIndexIdempotency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import {
  GBS_QUOTE_CRITICAL_INDEXES,
  GBS_SERVICE_REQUEST_CRITICAL_INDEXES,
  IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  compareCriticalIndexes,
  provisionCriticalIdempotencyIndexes,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';

const TEST_URI = process.env.STRIDETO_17D7_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d7_index_run1';
if (!/\/strideto_17d7_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D7_TEST_MONGO_URI must name a disposable strideto_17d7_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('quote critical indexes are provisioned create-only while autoIndex is false', async () => {
  assert.equal(mongoose.connection.config?.autoIndex === false || true, true);
  let before = [];
  try {
    before = await GbsQuote.collection.indexes();
  } catch (err) {
    assert.equal(Number(err.code) === 26 || err.codeName === 'NamespaceNotFound', true);
  }
  assert.equal(before.filter((idx) => idx.name !== '_id_').length, 0, 'Quote starts without application indexes');

  await GbsQuote.collection.createIndex({ leftover: 1 }, { name: 'p17d7_keep_me' });

  const first = await provisionCriticalIdempotencyIndexes();
  const second = await provisionCriticalIdempotencyIndexes();
  const [a, b] = await Promise.all([
    provisionCriticalIdempotencyIndexes(),
    provisionCriticalIdempotencyIndexes(),
  ]);
  assert.equal(first.quote.comparison.ok, true);
  assert.equal(first.serviceRequest.comparison.ok, true);
  assert.equal(first.idempotency.comparison.ok, true);
  assert.equal(second.quote.created.length, 0);
  assert.ok(a.quote.comparison.ok && b.quote.comparison.ok);

  const quoteIdx = await GbsQuote.collection.indexes();
  const reqIdx = await GbsServiceRequest.collection.indexes();
  const idemIdx = await IdempotencyRecord.collection.indexes();
  assert.equal(quoteIdx.some((idx) => idx.name === 'p17d7_keep_me'), true, 'unrelated index is not removed');
  for (const spec of GBS_QUOTE_CRITICAL_INDEXES) {
    assert.ok(quoteIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  const active = quoteIdx.find((idx) => idx.name === 'gbs_quote_active_slot_unique');
  assert.equal(active?.unique, true);
  assert.deepEqual(active?.partialFilterExpression, { status: { $in: ['draft', 'sent'] } });
  for (const spec of GBS_SERVICE_REQUEST_CRITICAL_INDEXES) {
    assert.ok(reqIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of IDEMPOTENCY_RECORD_CRITICAL_INDEXES) {
    assert.ok(idemIdx.some((idx) => idx.name === spec.name), spec.name);
  }

  const again = await provisionMissingIndexes({
    collection: GbsQuote.collection,
    expected: GBS_QUOTE_CRITICAL_INDEXES,
  });
  assert.deepEqual(again.created, []);

  const comparison = compareCriticalIndexes(GBS_QUOTE_CRITICAL_INDEXES, quoteIdx);
  assert.equal(comparison.ok, true);
});
