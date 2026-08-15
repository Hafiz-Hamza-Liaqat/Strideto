/**
 * Phase 17D-8B1 — create-only Case document indexes (autoIndex=false).
 *
 *   STRIDETO_17D8B1_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8b1_index_run1
 *   node src/__tests__/phase17d8b1LiveIndexIdempotency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GbsCase } from '../models/gbs/GbsCase.js';
import { GbsCaseDocumentRequirement } from '../models/gbs/GbsCaseDocumentRequirement.js';
import { GbsCaseDocumentGrant } from '../models/gbs/GbsCaseDocumentGrant.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import {
  GBS_CASE_CRITICAL_INDEXES,
  GBS_CASE_DOCUMENT_GRANT_CRITICAL_INDEXES,
  GBS_CASE_DOCUMENT_REQUIREMENT_CRITICAL_INDEXES,
  IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  provisionCriticalIdempotencyIndexes,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';

const TEST_URI = process.env.STRIDETO_17D8B1_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8b1_index_run1';
if (!/\/strideto_17d8b1_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8B1_TEST_MONGO_URI must name a disposable strideto_17d8b1_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('GBS document indexes are provisioned create-only while autoIndex is false', async () => {
  assert.equal(process.env.MONGO_AUTO_INDEX, undefined);
  const first = await provisionCriticalIdempotencyIndexes();
  const second = await provisionCriticalIdempotencyIndexes();
  assert.equal(first.case.comparison.ok, true);
  assert.equal(first.caseDocuments.comparison.ok, true);
  assert.equal(first.caseDocumentGrants.comparison.ok, true);
  assert.equal(first.idempotency.comparison.ok, true);
  assert.equal(second.caseDocuments.created.length, 0);
  assert.equal(second.caseDocumentGrants.created.length, 0);

  await GbsCaseDocumentRequirement.collection.createIndex({ leftover: 1 }, { name: 'p17d8b1_keep_me' });
  const again = await provisionMissingIndexes({
    collection: GbsCaseDocumentRequirement.collection,
    expected: GBS_CASE_DOCUMENT_REQUIREMENT_CRITICAL_INDEXES,
  });
  assert.deepEqual(again.created, []);

  const reqIdx = await GbsCaseDocumentRequirement.collection.indexes();
  const grantIdx = await GbsCaseDocumentGrant.collection.indexes();
  const caseIdx = await GbsCase.collection.indexes();
  const idemIdx = await IdempotencyRecord.collection.indexes();
  assert.equal(reqIdx.some((idx) => idx.name === 'p17d8b1_keep_me'), true, 'unrelated index is not removed');
  for (const spec of GBS_CASE_DOCUMENT_REQUIREMENT_CRITICAL_INDEXES) {
    assert.ok(reqIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of GBS_CASE_DOCUMENT_GRANT_CRITICAL_INDEXES) {
    assert.ok(grantIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of GBS_CASE_CRITICAL_INDEXES) {
    assert.ok(caseIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of IDEMPOTENCY_RECORD_CRITICAL_INDEXES) {
    assert.ok(idemIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  const unique = reqIdx.find((idx) => idx.name === 'gbs_case_doc_req_public_ref_unique');
  assert.equal(unique?.unique, true);
});
