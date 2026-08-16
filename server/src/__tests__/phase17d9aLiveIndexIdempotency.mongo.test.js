/**
 * Phase 17D-9A — create-only filing authorization / submission indexes.
 *
 *   STRIDETO_17D9A_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d9a_index_run1
 *   node src/__tests__/phase17d9aLiveIndexIdempotency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GbsCaseFilingAuthorization } from '../models/gbs/GbsCaseFilingAuthorization.js';
import { GbsExternalFilingSubmission } from '../models/gbs/GbsExternalFilingSubmission.js';
import {
  GBS_EXTERNAL_FILING_CRITICAL_INDEXES,
  GBS_FILING_AUTHORIZATION_CRITICAL_INDEXES,
  provisionCriticalIdempotencyIndexes,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';

const TEST_URI = process.env.STRIDETO_17D9A_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d9a_index_run1';
if (!/\/strideto_17d9a_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D9A_TEST_MONGO_URI must name a disposable strideto_17d9a_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('filing authorization indexes are provisioned create-only while autoIndex is false', async () => {
  assert.equal(process.env.MONGO_AUTO_INDEX, undefined);
  const first = await provisionCriticalIdempotencyIndexes();
  const second = await provisionCriticalIdempotencyIndexes();
  assert.equal(first.filingAuthorizations.comparison.ok, true);
  assert.equal(first.externalFilings.comparison.ok, true);
  assert.equal(second.filingAuthorizations.created.length, 0);
  assert.equal(second.externalFilings.created.length, 0);

  await GbsCaseFilingAuthorization.collection.createIndex({ leftover: 1 }, { name: 'p17d9a_keep_me' });
  const again = await provisionMissingIndexes({
    collection: GbsCaseFilingAuthorization.collection,
    expected: GBS_FILING_AUTHORIZATION_CRITICAL_INDEXES,
  });
  assert.deepEqual(again.created, []);

  const authIdx = await GbsCaseFilingAuthorization.collection.indexes();
  const subIdx = await GbsExternalFilingSubmission.collection.indexes();
  assert.equal(authIdx.some((idx) => idx.name === 'p17d9a_keep_me'), true, 'unrelated index is not removed');
  for (const spec of GBS_FILING_AUTHORIZATION_CRITICAL_INDEXES) {
    assert.ok(authIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of GBS_EXTERNAL_FILING_CRITICAL_INDEXES) {
    assert.ok(subIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  const unique = authIdx.find((idx) => idx.name === 'gbs_filing_auth_public_ref_unique');
  assert.equal(unique?.unique, true);
  const effective = authIdx.find((idx) => idx.name === 'gbs_filing_auth_effective_unique');
  assert.equal(effective?.unique, true);
  const subUnique = subIdx.find((idx) => idx.name === 'gbs_ext_filing_authorization_unique');
  assert.equal(subUnique?.unique, true);
});
