/**
 * Phase 17D-2 — Mongo CAS for official source / provider review.
 *
 * Requires a disposable database name. Never points at edurozgaar.
 *
 *   STRIDETO_17D2_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d2_integrity_run1
 *   node src/__tests__/phase17d2Concurrency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import { mutateProviderCapabilityRecord } from '../services/platform/optimisticConcurrency.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { GbsOfficialSource } from '../models/gbs/GbsOfficialSource.js';
import { GbsGovernmentFee } from '../models/gbs/GbsGovernmentFee.js';

const TEST_URI = process.env.STRIDETO_17D2_TEST_MONGO_URI || '';
if (!/\/strideto_17d2_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D2_TEST_MONGO_URI must name a disposable strideto_17d2_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([ProviderCapability.init(), GbsOfficialSource.init(), GbsGovernmentFee.init()]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('ProviderCapability review CAS: stale write 409, version +1', async () => {
  const doc = await ProviderCapability.create({
    subjectType: 'agent',
    subjectId: 'agent-17d2',
    capabilityId: 'business_formation',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED,
    recordVersion: 0,
  });

  const [a, b] = await Promise.allSettled([
    mutateProviderCapabilityRecord({
      id: doc._id,
      expectedVersion: 0,
      subjectType: 'agent',
      subjectId: 'agent-17d2',
      set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED },
      actor: { id: 'staff-1' },
    }),
    mutateProviderCapabilityRecord({
      id: doc._id,
      expectedVersion: 0,
      subjectType: 'agent',
      subjectId: 'agent-17d2',
      set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED },
      actor: { id: 'staff-2' },
    }),
  ]);
  const ok = [a, b].filter((r) => r.status === 'fulfilled');
  const conflict = [a, b].filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(conflict.length, 1);
  assert.equal(conflict[0].reason.code, OPTIMISTIC_CONCURRENCY_CODE);
  assert.equal(conflict[0].reason.status, 409);
  assert.equal(ok[0].value.recordVersion, 1);
});

test('wrong subject ProviderCapability review is 404 without existence leak', async () => {
  const doc = await ProviderCapability.create({
    subjectType: 'agent',
    subjectId: 'agent-owner',
    capabilityId: 'registered_agent',
    recordVersion: 0,
  });
  await assert.rejects(
    () =>
      mutateProviderCapabilityRecord({
        id: doc._id,
        expectedVersion: 0,
        subjectType: 'agent',
        subjectId: 'agent-other',
        set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED },
        actor: { id: 'staff-1' },
      }),
    (err) => err.status === 404 && !String(err.message).includes('agent-owner')
  );
});

test('Official source CAS does not silently overwrite', async () => {
  const created = await GbsOfficialSource.create({
    sourceId: 'src:cas',
    authorityId: 'auth:US-WY-SOS',
    jurisdictionId: 'j:US-WY',
    sourceUrl: 'https://sos.wyo.gov/business/default.aspx',
    sourceType: 'official_registrar',
    factCategory: 'government_fee',
    reviewStatus: 'reviewed',
    sourceVersion: 1,
    recordVersion: 0,
  });
  const updated = await GbsOfficialSource.findOneAndUpdate(
    { _id: created._id, recordVersion: 0 },
    { $set: { title: 'v2' }, $inc: { recordVersion: 1 } },
    { new: true }
  );
  const stale = await GbsOfficialSource.findOneAndUpdate(
    { _id: created._id, recordVersion: 0 },
    { $set: { title: 'stale' }, $inc: { recordVersion: 1 } },
    { new: true }
  );
  assert.equal(updated.recordVersion, 1);
  assert.equal(stale, null);
});

test('Government fee revision keeps previous sourceVersion row', async () => {
  await GbsGovernmentFee.create({
    feeId: 'fee:cas',
    jurisdictionId: 'j:US-WY',
    authorityId: 'auth:US-WY-SOS',
    feeCategory: 'formation_filing',
    label: 'v1',
    currency: 'USD',
    amountModel: 'fixed',
    amount: 100,
    sourceId: 'src:cas',
    sourceVersion: 1,
    reviewStatus: 'reviewed',
    recordVersion: 0,
  });
  await GbsGovernmentFee.create({
    feeId: 'fee:cas',
    jurisdictionId: 'j:US-WY',
    authorityId: 'auth:US-WY-SOS',
    feeCategory: 'formation_filing',
    label: 'v2',
    currency: 'USD',
    amountModel: 'fixed',
    amount: 120,
    sourceId: 'src:cas',
    sourceVersion: 2,
    reviewStatus: 'reviewed',
    recordVersion: 0,
  });
  const rows = await GbsGovernmentFee.find({ feeId: 'fee:cas' }).lean();
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.sourceVersion === 1).amount, 100);
  assert.equal(rows.find((r) => r.sourceVersion === 2).amount, 120);
});
