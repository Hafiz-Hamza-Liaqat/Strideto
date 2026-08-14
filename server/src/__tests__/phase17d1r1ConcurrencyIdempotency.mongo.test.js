/**
 * Phase 17D-1R1 — Mongo-atomic ProviderCapability CAS + multi-instance idempotency.
 *
 * Requires a disposable database name. Never points at edurozgaar / staging app data.
 *
 *   STRIDETO_17D1R1_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d1r1_integrity_run1
 *   node src/__tests__/phase17d1r1ConcurrencyIdempotency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import {
  IDEMPOTENCY_CODES,
  IDEMPOTENCY_STATUSES,
  IDEMPOTENCY_STORE_KINDS,
  createInMemoryIdempotencyStore,
} from '../../../shared/platform/idempotency.js';
import { mutateProviderCapabilityRecord } from '../services/platform/optimisticConcurrency.js';
import { createMongoIdempotencyStore } from '../services/platform/mongoIdempotencyStore.js';
import {
  assertHighValueIdempotencyStore,
  executeHighValueIdempotentCommand,
  executeIdempotentCommand,
  fingerprintRequest,
} from '../services/platform/idempotencyService.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';

const TEST_URI = process.env.STRIDETO_17D1R1_TEST_MONGO_URI || '';
if (!/\/strideto_17d1r1_integrity_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error(
    'STRIDETO_17D1R1_TEST_MONGO_URI must name a disposable strideto_17d1r1_integrity_* database'
  );
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([ProviderCapability.init(), IdempotencyRecord.init()]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('in-memory store cannot silently be production / high-value authority', () => {
  const memory = createInMemoryIdempotencyStore();
  assert.equal(memory.kind, IDEMPOTENCY_STORE_KINDS.IN_MEMORY);
  assert.throws(
    () => assertHighValueIdempotencyStore(memory),
    (err) => err.code === IDEMPOTENCY_CODES.STORE_NOT_SHARED && err.status === 503
  );
  assert.throws(
    () => executeHighValueIdempotentCommand(memory, { commandType: 'x', idempotencyKey: 'k', fingerprint: 'f', perform: async () => {} }),
    (err) => err.code === IDEMPOTENCY_CODES.STORE_NOT_SHARED
  );
});

test('executeIdempotentCommand refuses a missing store', async () => {
  await assert.rejects(
    () => executeIdempotentCommand({ commandType: 'x', idempotencyKey: 'k', fingerprint: 'f', perform: async () => {} }),
    (err) => err.code === IDEMPOTENCY_CODES.STORE_REQUIRED
  );
});

test('ProviderCapability compare-and-swap is atomic: one success, one 409, version +1', async () => {
  const doc = await ProviderCapability.create({
    subjectType: 'agent',
    subjectId: 'agent-cas-1',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
    recordVersion: 0,
  });

  const results = await Promise.allSettled([
    mutateProviderCapabilityRecord({
      id: doc._id,
      expectedVersion: 0,
      subjectType: 'agent',
      subjectId: 'agent-cas-1',
      set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED },
    }),
    mutateProviderCapabilityRecord({
      id: doc._id,
      expectedVersion: 0,
      subjectType: 'agent',
      subjectId: 'agent-cas-1',
      set: { trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED },
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'exactly one durable mutation succeeds');
  assert.equal(rejected.length, 1, 'exactly one competitor fails');
  assert.equal(rejected[0].reason.code, OPTIMISTIC_CONCURRENCY_CODE);
  assert.equal(rejected[0].reason.status, 409);

  const fresh = await ProviderCapability.findById(doc._id).lean();
  assert.equal(fresh.recordVersion, 1, 'recordVersion increments exactly once');
  assert.ok(
    fresh.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED ||
      fresh.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
    'winner persisted exactly one of the competing changes'
  );
});

test('wrong tenant is not leaked through conflict handling', async () => {
  const doc = await ProviderCapability.create({
    subjectType: 'agent',
    subjectId: 'agent-tenant-a',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
    recordVersion: 0,
  });

  await assert.rejects(
    () =>
      mutateProviderCapabilityRecord({
        id: doc._id,
        expectedVersion: 0,
        subjectType: 'organization',
        subjectId: 'org-other',
        set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED },
      }),
    (err) => err.status === 404 && err.code === 'provider_capability_not_found'
  );

  const fresh = await ProviderCapability.findById(doc._id).lean();
  assert.equal(fresh.recordVersion, 0);
  assert.equal(fresh.trustStatus, PROVIDER_TRUST_STATUSES.CLAIMED);
});

test('stale expectedVersion on the authorized subject is 409, not 404', async () => {
  const doc = await ProviderCapability.create({
    subjectType: 'agent',
    subjectId: 'agent-stale',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
    recordVersion: 2,
  });
  await assert.rejects(
    () =>
      mutateProviderCapabilityRecord({
        id: doc._id,
        expectedVersion: 1,
        subjectType: 'agent',
        subjectId: 'agent-stale',
        set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED },
      }),
    (err) => err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409
  );
});

test('two Mongo store instances: one effect, replay, fingerprint conflict, IN_PROGRESS, crash window', async () => {
  const sharedOpts = { staleMs: 60_000, maxWaitMs: 1500, pollMs: 20 };
  const storeA = createMongoIdempotencyStore(sharedOpts);
  const storeB = createMongoIdempotencyStore(sharedOpts);
  assert.equal(storeA.kind, IDEMPOTENCY_STORE_KINDS.MONGO);
  assert.equal(storeB.kind, IDEMPOTENCY_STORE_KINDS.MONGO);

  let effects = 0;
  const fp = fingerprintRequest({ cmd: 'fixture.side-effect', n: 1 });
  const input = {
    principalId: 'user-1',
    tenantId: 'org-1',
    commandType: 'gbs.test.command',
    idempotencyKey: 'key-shared',
    fingerprint: fp,
    perform: async () => {
      effects += 1;
      await new Promise((r) => setTimeout(r, 120));
      return { commandId: 'cmd-1' };
    },
  };

  const [a, b] = await Promise.all([storeA.execute(input), storeB.execute({ ...input })]);
  assert.equal(effects, 1, 'two instances sharing Mongo execute the callback once');
  assert.equal([a, b].filter((r) => r.replay).length, 1, 'second caller sees the same logical command');
  assert.equal([a, b].filter((r) => r.replay === false).length, 1, 'one caller performs');
  assert.deepEqual(a.result?.commandId || b.result?.commandId, 'cmd-1');

  const replay = await storeB.execute({
    ...input,
    perform: async () => {
      effects += 1;
      return { commandId: 'should-not' };
    },
  });
  assert.equal(replay.replay, true);
  assert.equal(replay.code, IDEMPOTENCY_CODES.REPLAY);
  assert.equal(effects, 1, 'same key + same fingerprint replays without a second effect');

  await assert.rejects(
    () =>
      storeA.execute({
        ...input,
        fingerprint: fingerprintRequest({ cmd: 'fixture.side-effect', n: 2 }),
        perform: async () => {
          effects += 1;
        },
      }),
    (err) => err.code === IDEMPOTENCY_CODES.CONFLICT && err.status === 409
  );
  assert.equal(effects, 1, 'fingerprint mismatch does not perform');

  const inflightStore = createMongoIdempotencyStore({
    staleMs: 60_000,
    maxWaitMs: 180,
    pollMs: 20,
  });
  const inflightKey = {
    principalId: 'user-2',
    tenantId: 'org-1',
    commandType: 'gbs.test.command',
    idempotencyKey: 'key-inflight',
  };
  await IdempotencyRecord.create({
    ...inflightKey,
    fingerprint: fingerprintRequest({ inflight: true }),
    status: IDEMPOTENCY_STATUSES.IN_PROGRESS,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  });
  await assert.rejects(
    () =>
      inflightStore.execute({
        ...inflightKey,
        fingerprint: fingerprintRequest({ inflight: true }),
        perform: async () => {
          effects += 1;
          return { leaked: true };
        },
      }),
    (err) => err.code === IDEMPOTENCY_CODES.IN_FLIGHT
  );
  assert.equal(effects, 1, 'IN_PROGRESS duplicate cannot execute again');
  const still = await IdempotencyRecord.findOne(inflightKey).lean();
  assert.equal(still.status, IDEMPOTENCY_STATUSES.IN_PROGRESS, 'abandoned reservation is not marked completed');

  const recoverStore = createMongoIdempotencyStore({
    staleMs: 80,
    maxWaitMs: 500,
    pollMs: 20,
  });
  const crashKey = {
    principalId: 'user-3',
    tenantId: 'org-1',
    commandType: 'gbs.test.command',
    idempotencyKey: 'key-crash',
  };
  const crashFp = fingerprintRequest({ crash: true });
  await IdempotencyRecord.create({
    ...crashKey,
    fingerprint: crashFp,
    status: IDEMPOTENCY_STATUSES.IN_PROGRESS,
    createdAt: new Date(Date.now() - 200),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const recovered = await recoverStore.execute({
    ...crashKey,
    fingerprint: crashFp,
    perform: async () => {
      effects += 1;
      return { recovered: true };
    },
  });
  assert.equal(recovered.replay, false);
  assert.equal(effects, 2, 'stale IN_PROGRESS may be retried after bounded recovery window');
  const afterCrash = await IdempotencyRecord.findOne(crashKey).lean();
  assert.equal(afterCrash.status, IDEMPOTENCY_STATUSES.COMPLETED);
  assert.equal(afterCrash.resultMeta.recovered, true);
});
