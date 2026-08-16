/**
 * Phase 17D-8B2A — scan job lease / idempotency (Mongo).
 *
 *   STRIDETO_17D8B2A_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8b2a_jobs_run1
 *   node src/__tests__/phase17d8b2aScanJob.mongo.test.js
 */
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GbsDocumentScanJob } from '../models/gbs/GbsDocumentScanJob.js';
import {
  GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';
import {
  claimNextScanJob,
  completeScanJob,
  enqueueGbsDocumentScanJob,
  requeueOrFailScanJob,
} from '../services/hsi/gbsDocumentScanJobService.js';
import { HSI_SCAN_JOB_STATUSES } from '../../../shared/gbs/hsiSecurity.js';

const TEST_URI = process.env.STRIDETO_17D8B2A_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8b2a_jobs_run1';
if (!/\/strideto_17d8b2a_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8B2A_TEST_MONGO_URI must name a disposable strideto_17d8b2a_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  await provisionMissingIndexes({
    collection: GbsDocumentScanJob.collection,
    expected: GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES,
  });
});

beforeEach(async () => {
  await GbsDocumentScanJob.deleteMany({});
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('duplicate version+checksum converges to one job', async () => {
  const versionId = new mongoose.Types.ObjectId();
  const checksum = 'a'.repeat(64);
  const first = await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: versionId,
    opaqueStorageRef: `hsi/${'b'.repeat(32)}`,
    checksumSha256: checksum,
    mimeType: 'application/pdf',
    sizeBytes: 12,
    classification: 'highly_sensitive_identity',
  });
  const second = await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: versionId,
    opaqueStorageRef: `hsi/${'c'.repeat(32)}`,
    checksumSha256: checksum,
    mimeType: 'application/pdf',
    sizeBytes: 12,
    classification: 'highly_sensitive_identity',
  });
  assert.equal(String(first._id), String(second._id));
  assert.equal(await GbsDocumentScanJob.countDocuments({ vaultDocumentVersionId: versionId }), 1);
});

test('two claimants cannot lease the same job', async () => {
  const versionId = new mongoose.Types.ObjectId();
  await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: versionId,
    opaqueStorageRef: `hsi/${'d'.repeat(32)}`,
    checksumSha256: 'e'.repeat(64),
    mimeType: 'application/pdf',
    sizeBytes: 12,
    classification: 'highly_sensitive_identity',
  });
  const [a, b] = await Promise.all([
    claimNextScanJob({ leaseOwner: 'exec-a' }),
    claimNextScanJob({ leaseOwner: 'exec-b' }),
  ]);
  const claimed = [a, b].filter(Boolean);
  assert.equal(claimed.length, 1);
});

test('expired lease is recoverable and max attempts are bounded', async () => {
  const versionId = new mongoose.Types.ObjectId();
  await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: versionId,
    opaqueStorageRef: `hsi/${'f'.repeat(32)}`,
    checksumSha256: '1'.repeat(64),
    mimeType: 'application/pdf',
    sizeBytes: 12,
    classification: 'highly_sensitive_identity',
  });
  const first = await claimNextScanJob({ leaseOwner: 'crashed', now: new Date(), leaseMs: 1 });
  assert.ok(first);
  await GbsDocumentScanJob.updateOne(
    { _id: first._id },
    { $set: { leaseExpiresAt: new Date(Date.now() - 1000) } }
  );
  const recovered = await claimNextScanJob({ leaseOwner: 'recovered', now: new Date() });
  assert.ok(recovered);
  assert.equal(String(recovered._id), String(first._id));
  assert.equal(recovered.attempt, 2);

  await requeueOrFailScanJob(recovered, { lastErrorCode: 'timeout', timeout: true });
  const third = await claimNextScanJob({
    leaseOwner: 'third',
    now: new Date(Date.now() + 120_000),
  });
  assert.ok(third);
  const dead = await requeueOrFailScanJob(third, { lastErrorCode: 'timeout', timeout: true });
  assert.ok(dead);
  assert.equal(dead.status, HSI_SCAN_JOB_STATUSES.TIMEOUT);
  const none = await claimNextScanJob({ leaseOwner: 'none' });
  assert.equal(none, null);
});

test('completeScanJob is CAS-protected', async () => {
  const versionId = new mongoose.Types.ObjectId();
  await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: versionId,
    opaqueStorageRef: `hsi/${'9'.repeat(32)}`,
    checksumSha256: '2'.repeat(64),
    mimeType: 'application/pdf',
    sizeBytes: 12,
    classification: 'highly_sensitive_identity',
  });
  const leased = await claimNextScanJob({ leaseOwner: 'one' });
  const first = await completeScanJob(leased, { status: HSI_SCAN_JOB_STATUSES.CLEAN });
  const second = await completeScanJob(leased, { status: HSI_SCAN_JOB_STATUSES.CLEAN });
  assert.ok(first);
  assert.equal(second, null);
});
