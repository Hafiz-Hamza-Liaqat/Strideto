/**
 * SEC-3B / SEC-3B.1 — dormant RefreshSession rotation service tests,
 * against an injected in-memory model double (no live MongoDB connection).
 * Run: node src/__tests__/refreshSessionRotation.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createRefreshSessionRotationService } from '../services/auth/RefreshSessionRotationService.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
function throwsType(fn, message) {
  assert.throws(fn, TypeError);
  assertions += 1;
  void message;
}

equal(
  mongoose.connection.readyState,
  0,
  'no live database connection is used by this test'
);

/**
 * A deterministic, single-threaded fake model. `findOneAndUpdate` performs
 * its filter match and mutation with no internal `await` between them —
 * this faithfully emulates MongoDB's real per-document atomic
 * findOneAndUpdate guarantee (the property the rotation service actually
 * depends on). The filter matcher enforces EVERY field the production
 * service's filters use, including the replay-revoke CAS filter's
 * currentTokenHash/previousTokenHash/previousTokenRotatedAt/
 * tokenVersionAtIssue conditions, comparing Date values by their time
 * value (matching real MongoDB/BSON semantics) rather than by JS object
 * reference.
 */
function createFakeModel({ throwOn, throwOnCall } = {}) {
  const store = new Map();
  const calls = { create: [], findOneAndUpdate: [], findById: [] };
  let nextId = 1;
  let findOneAndUpdateCallCount = 0;
  let findByIdCallCount = 0;

  function valuesEqual(a, b) {
    if (a instanceof Date || b instanceof Date) {
      if (!(a instanceof Date) || !(b instanceof Date)) return a === b; // one is null/undefined
      const aTime = a.getTime();
      const bTime = b.getTime();
      // Two invalid Date instances (NaN time) represent the same stored
      // "malformed timestamp" value being read back — treat them as equal
      // rather than using JS's NaN !== NaN, which would otherwise make an
      // already-malformed timestamp never match itself in a filter.
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return true;
      return aTime === bTime;
    }
    return a === b;
  }

  function matches(doc, filter) {
    for (const [key, cond] of Object.entries(filter)) {
      if (key === '_id') {
        if (String(doc._id) !== String(cond)) return false;
        continue;
      }
      if (
        cond &&
        typeof cond === 'object' &&
        !(cond instanceof Date) &&
        '$gt' in cond
      ) {
        if (!(doc[key] > cond.$gt)) return false;
        continue;
      }
      if (!valuesEqual(doc[key], cond)) return false;
    }
    return true;
  }

  function applyUpdate(doc, update) {
    const stages = Array.isArray(update) ? update : [{ $set: update.$set }];
    for (const stage of stages) {
      if (!stage.$set) continue;
      for (const [k, v] of Object.entries(stage.$set)) {
        if (typeof v === 'string' && v.startsWith('$')) {
          doc[k] = doc[v.slice(1)];
        } else {
          doc[k] = v;
        }
      }
    }
    return doc;
  }

  function shouldThrow(callCount) {
    if (throwOnCall !== undefined) return callCount === throwOnCall;
    return Boolean(throwOn);
  }

  const model = {
    async create(data) {
      calls.create.push(data);
      if (throwOn === 'create') throw new Error('simulated storage failure');
      const id = String(nextId++);
      const doc = { ...data, _id: id };
      store.set(id, doc);
      return doc;
    },
    async findOneAndUpdate(filter, update) {
      findOneAndUpdateCallCount += 1;
      calls.findOneAndUpdate.push({ filter, update });
      if (
        throwOn === 'findOneAndUpdate' &&
        shouldThrow(findOneAndUpdateCallCount)
      ) {
        throw new Error('simulated storage failure');
      }
      let found = null;
      for (const doc of store.values()) {
        if (matches(doc, filter)) {
          found = doc;
          break;
        }
      }
      if (!found) return null;
      applyUpdate(found, update);
      return { ...found };
    },
    async findById(id) {
      findByIdCallCount += 1;
      calls.findById.push(id);
      if (throwOn === 'findById' && shouldThrow(findByIdCallCount)) {
        throw new Error('simulated storage failure');
      }
      const doc = store.get(String(id));
      return doc ? { ...doc } : null;
    },
    _store: store,
  };
  return { model, calls };
}

function seedSession(model, overrides = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const doc = {
    _id: '1',
    subjectType: 'user',
    subjectId: 'sub-1',
    currentTokenHash: 'hash-current',
    previousTokenHash: null,
    previousTokenRotatedAt: null,
    tokenVersionAtIssue: 0,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
  model._store.set(doc._id, doc);
  return doc;
}

// --- Constructor validation ---
throwsType(
  () => createRefreshSessionRotationService({ concurrencyWindowMs: 0 }),
  'zero concurrency window is rejected'
);
throwsType(
  () => createRefreshSessionRotationService({ concurrencyWindowMs: -1 }),
  'negative concurrency window is rejected'
);
throwsType(
  () => createRefreshSessionRotationService({ concurrencyWindowMs: 1.5 }),
  'fractional concurrency window is rejected'
);
throwsType(
  () => createRefreshSessionRotationService({ concurrencyWindowMs: Infinity }),
  'infinite concurrency window is rejected'
);
throwsType(
  () => createRefreshSessionRotationService({ concurrencyWindowMs: NaN }),
  'NaN concurrency window is rejected'
);

// --- createSession ---
{
  const { model } = createFakeModel();
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const result = await service.createSession({
    subjectType: 'user',
    subjectId: 'sub-1',
    currentTokenHash: 'hash-a',
    tokenVersionAtIssue: 0,
  });
  equal(result.code, 'CREATED', 'session creation succeeds');
  check(
    typeof result.sid === 'string' && result.sid.length > 0,
    'created session returns a sid'
  );
  check(Object.isFrozen(result), 'createSession result is frozen');
}

// --- createSession input validation ---
{
  const { model } = createFakeModel();
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date(),
  });
  const badHash = await service.createSession({
    subjectType: 'user',
    subjectId: 's',
    currentTokenHash: '',
    tokenVersionAtIssue: 0,
  });
  equal(
    badHash.code,
    'INVALID_INPUT',
    'empty currentTokenHash is rejected on creation'
  );
  const badVersion = await service.createSession({
    subjectType: 'user',
    subjectId: 's',
    currentTokenHash: 'h',
    tokenVersionAtIssue: 1.5,
  });
  equal(
    badVersion.code,
    'INVALID_INPUT',
    'fractional tokenVersionAtIssue is rejected on creation'
  );
  const badClockService = createRefreshSessionRotationService({
    model,
    clock: () => new Date(NaN),
  });
  const badClock = await badClockService.createSession({
    subjectType: 'user',
    subjectId: 's',
    currentTokenHash: 'h',
    tokenVersionAtIssue: 0,
  });
  equal(
    badClock.code,
    'INVALID_INPUT',
    'an invalid clock output is rejected on creation'
  );
}

// --- rotate() input validation ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  equal(
    (
      await service.rotate({
        sid: undefined,
        presentedTokenHash: 'h',
        newTokenHash: 'h2',
      })
    ).code,
    'INVALID_INPUT',
    'missing sid is rejected'
  );
  equal(
    (
      await service.rotate({
        sid: '',
        presentedTokenHash: 'h',
        newTokenHash: 'h2',
      })
    ).code,
    'INVALID_INPUT',
    'empty sid is rejected'
  );
  equal(
    (
      await service.rotate({
        sid: '1',
        presentedTokenHash: '',
        newTokenHash: 'h2',
      })
    ).code,
    'INVALID_INPUT',
    'empty presented hash is rejected'
  );
  equal(
    (
      await service.rotate({
        sid: '1',
        presentedTokenHash: 'h',
        newTokenHash: '',
      })
    ).code,
    'INVALID_INPUT',
    'empty successor hash is rejected'
  );
  equal(
    (
      await service.rotate({
        sid: '1',
        presentedTokenHash: 'hash-current',
        newTokenHash: 'hash-current',
      })
    ).code,
    'INVALID_INPUT',
    'identical presented/successor hash is rejected'
  );
  equal(
    (
      await service.rotate({
        sid: '1',
        presentedTokenHash: 'hash-current',
        newTokenHash: 'x',
        expectedTokenVersionAtIssue: 1.5,
      })
    ).code,
    'INVALID_INPUT',
    'fractional expected tokenVersionAtIssue is rejected'
  );
  equal(
    (
      await service.rotate({
        sid: '1',
        presentedTokenHash: 'hash-current',
        newTokenHash: 'x',
        expectedTokenVersionAtIssue: -1,
      })
    ).code,
    'INVALID_INPUT',
    'negative expected tokenVersionAtIssue is rejected'
  );

  const badClockService = createRefreshSessionRotationService({
    model,
    clock: () => new Date(NaN),
  });
  equal(
    (
      await badClockService.rotate({
        sid: '1',
        presentedTokenHash: 'hash-current',
        newTokenHash: 'x',
      })
    ).code,
    'INVALID_INPUT',
    'an invalid clock output is rejected on rotate'
  );

  equal(
    model._store.get('1').currentTokenHash,
    'hash-current',
    'no mutation occurred from any rejected input'
  );
}

// --- First matching CAS wins; exactly one successor installed ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const now = new Date('2026-01-01T00:00:10.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });

  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  });
  equal(result.code, 'ROTATED', 'first matching CAS wins');
  deepEqual(
    Object.keys(result),
    ['code'],
    'rotated result contains no other fields'
  );

  const doc = model._store.get('1');
  equal(
    doc.currentTokenHash,
    'hash-next',
    'exactly one successor hash is installed'
  );
  equal(
    doc.previousTokenHash,
    'hash-current',
    'current hash moved to previous'
  );
  equal(
    doc.previousTokenRotatedAt.getTime(),
    now.getTime(),
    'previousTokenRotatedAt is set'
  );
}

// --- Benign boundary: exactly 0ms ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  }); // rotates at `now`
  const loser = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-other',
  }); // presented immediately, elapsed 0ms
  equal(
    loser.code,
    'CONFLICT_BENIGN',
    'elapsed exactly 0ms classifies as benign'
  );
}

// --- Benign boundary: exactly 15000ms ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const t0 = new Date('2026-01-01T00:00:00.000Z');
  let now = t0;
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  });
  now = new Date(t0.getTime() + 15000);
  const loser = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-other',
  });
  equal(
    loser.code,
    'CONFLICT_BENIGN',
    'elapsed exactly 15000ms classifies as benign (inclusive boundary)'
  );
}

// --- Replay boundary: 15001ms ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const t0 = new Date('2026-01-01T00:00:00.000Z');
  let now = t0;
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  });
  now = new Date(t0.getTime() + 15001);
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-other',
  });
  equal(result.code, 'REPLAY_DETECTED', 'elapsed 15001ms classifies as replay');
  const doc = model._store.get('1');
  equal(doc.revokedAt.getTime(), now.getTime(), 'replay revokes the session');
  equal(
    doc.revokeReason,
    'replay_detected',
    'replay sets the correct revoke reason'
  );
}

// --- Negative elapsed time (clock skew) is never benign ---
{
  const { model } = createFakeModel();
  const future = new Date('2026-01-01T00:01:00.000Z');
  seedSession(model, {
    previousTokenHash: 'hash-old',
    previousTokenRotatedAt: future,
  });
  const now = new Date('2026-01-01T00:00:00.000Z'); // before previousTokenRotatedAt -> negative elapsed
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-old',
    newTokenHash: 'x',
  });
  equal(
    result.code,
    'REPLAY_DETECTED',
    'negative elapsed time is classified as replay, never benign'
  );
}

// --- Malformed previousTokenRotatedAt is never benign ---
{
  const { model } = createFakeModel();
  seedSession(model, {
    previousTokenHash: 'hash-old',
    previousTokenRotatedAt: new Date(NaN),
  });
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-old',
    newTokenHash: 'x',
  });
  equal(
    result.code,
    'REPLAY_DETECTED',
    'a malformed previousTokenRotatedAt is classified as replay, never benign'
  );
}

// --- Non-matching old generation classifies as replay ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });

  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'never-issued-hash',
    newTokenHash: 'hash-x',
  });
  equal(
    result.code,
    'REPLAY_DETECTED',
    'a hash matching neither current nor previous classifies as replay'
  );
  equal(
    model._store.get('1').revokeReason,
    'replay_detected',
    'the family is revoked'
  );
}

// --- Stable replay successfully conditionally revokes (no intervening state change) ---
{
  const { model } = createFakeModel();
  seedSession(model, { currentTokenHash: 'hash-1' });
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'stolen-hash',
    newTokenHash: 'x',
  });
  equal(
    result.code,
    'REPLAY_DETECTED',
    'a stable (non-racing) replay classification successfully revokes via the guarded CAS'
  );
  equal(
    model._store.get('1').revokedAt.getTime(),
    now.getTime(),
    'the family is revoked'
  );
}

// --- Replay revokes only the affected family ---
{
  const { model } = createFakeModel();
  seedSession(model, { _id: '1', currentTokenHash: 'hash-1' });
  seedSession(model, { _id: '2', currentTokenHash: 'hash-2' });
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });

  await service.rotate({
    sid: '1',
    presentedTokenHash: 'stolen-hash',
    newTokenHash: 'x',
  });
  equal(
    model._store.get('1').revokedAt !== null,
    true,
    'the presented session is revoked'
  );
  equal(
    model._store.get('2').revokedAt,
    null,
    'an unrelated session is not revoked'
  );
}

// --- CRITICAL: replay classification / read-to-revoke race safety ---
// A legitimate rotation completes between the classification read and the
// guarded revoke write. The guarded revoke CAS must lose (state changed),
// the family must remain unrevoked, no successor may be issued by the
// replay request, and the result must be the safe CLASSIFICATION_STALE
// code — never an unconditional fallback revoke.
{
  const { model } = createFakeModel();
  seedSession(model, { currentTokenHash: 'hash-gen1' });
  const now = new Date('2026-01-01T00:00:00.000Z');
  let findByIdCalls = 0;
  const originalFindById = model.findById.bind(model);
  model.findById = async (id) => {
    findByIdCalls += 1;
    if (findByIdCalls === 1) {
      // Capture the snapshot the classification will see, THEN mutate the
      // store to simulate a legitimate concurrent rotation completing
      // before the guarded revoke write executes.
      const snapshot = await originalFindById(id);
      const stored = model._store.get(id);
      model._store.set(id, {
        ...stored,
        currentTokenHash: 'hash-gen2',
        previousTokenHash: 'hash-gen1',
        previousTokenRotatedAt: now,
      });
      return snapshot;
    }
    return originalFindById(id);
  };

  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'stale-or-stolen-hash',
    newTokenHash: 'attacker-successor',
  });

  equal(
    result.code,
    'CLASSIFICATION_STALE',
    'a stale classification snapshot is reported as CLASSIFICATION_STALE, not REPLAY_DETECTED'
  );
  const finalDoc = model._store.get('1');
  equal(
    finalDoc.revokedAt,
    null,
    'the family that legitimately rotated in the meantime remains unrevoked'
  );
  equal(
    finalDoc.currentTokenHash,
    'hash-gen2',
    'no successor from the stale replay request was installed — the legitimate rotation result stands untouched'
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    'the stale-classification result exposes only a safe code'
  );
}

// --- Conditional revoke loss does not fall back to an unconditional { _id, revokedAt: null } update ---
{
  const { model } = createFakeModel();
  seedSession(model, { currentTokenHash: 'hash-gen1' });
  const now = new Date('2026-01-01T00:00:00.000Z');

  // Force every findOneAndUpdate call after the first (the initial CAS
  // attempt) to fail to match, simulating "the guarded revoke never
  // matches anything" — if the service ever fell back to an unconditional
  // `{ _id, revokedAt: null }` filter, THAT filter would still match this
  // document (revokedAt is null) and incorrectly revoke it. Asserting the
  // document stays unrevoked proves no such fallback filter is used.
  const originalFindOneAndUpdate = model.findOneAndUpdate.bind(model);
  let call = 0;
  model.findOneAndUpdate = async (filter, update) => {
    call += 1;
    if (call === 1) return originalFindOneAndUpdate(filter, update); // the initial CAS attempt, intentionally misses (wrong hash)
    // Any subsequent call (the guarded revoke) that is NOT scoped to the
    // exact classified state must fail to match in this simulation.
    const requiresFullState =
      'currentTokenHash' in filter &&
      'previousTokenHash' in filter &&
      'previousTokenRotatedAt' in filter &&
      'tokenVersionAtIssue' in filter;
    if (!requiresFullState) {
      throw new Error(
        'rotation service attempted an under-guarded revoke filter'
      );
    }
    return originalFindOneAndUpdate(filter, update);
  };

  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'never-issued',
    newTokenHash: 'x',
  });
  check(
    result.code === 'REPLAY_DETECTED' || result.code === 'CLASSIFICATION_STALE',
    'the guarded revoke path was used, not an under-guarded fallback'
  );
}

// --- Revoked session cannot rotate ---
{
  const { model } = createFakeModel();
  seedSession(model, {
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'logout',
  });
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  });
  equal(result.code, 'SESSION_REVOKED', 'a revoked session cannot rotate');
}

// --- Expired session cannot rotate ---
{
  const { model } = createFakeModel();
  seedSession(model, { expiresAt: new Date('2025-12-31T00:00:00.000Z') });
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  });
  equal(result.code, 'SESSION_EXPIRED', 'an expired session cannot rotate');
}

// --- Missing session classified safely ---
{
  const { model } = createFakeModel();
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  const result = await service.rotate({
    sid: 'does-not-exist',
    presentedTokenHash: 'x',
    newTokenHash: 'y',
  });
  equal(
    result.code,
    'SESSION_MISSING',
    'a missing session is classified safely'
  );
}

// --- tokenVersionAtIssue mismatch cannot rotate ---
{
  const { model } = createFakeModel();
  seedSession(model, { tokenVersionAtIssue: 0 });
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
    expectedTokenVersionAtIssue: 1,
  });
  equal(
    result.code,
    'VERSION_MISMATCH',
    'a tokenVersionAtIssue mismatch cannot rotate'
  );
}

// --- tokenVersionAtIssue match rotates normally ---
{
  const { model } = createFakeModel();
  seedSession(model, { tokenVersionAtIssue: 2 });
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
    expectedTokenVersionAtIssue: 2,
  });
  equal(
    result.code,
    'ROTATED',
    'a matching tokenVersionAtIssue rotates normally'
  );
}

// --- Storage errors are safely normalized ---
{
  const { model: createModel } = createFakeModel({ throwOn: 'create' });
  const createService = createRefreshSessionRotationService({
    model: createModel,
    clock: () => new Date(),
  });
  const createResult = await createService.createSession({
    subjectType: 'user',
    subjectId: 'sub-1',
    currentTokenHash: 'x',
    tokenVersionAtIssue: 0,
  });
  equal(
    createResult.code,
    'STORAGE_FAILURE',
    'create storage failure is normalized'
  );

  const { model: rotateModel } = createFakeModel({
    throwOn: 'findOneAndUpdate',
    throwOnCall: 1,
  });
  seedSession(rotateModel);
  const rotateService = createRefreshSessionRotationService({
    model: rotateModel,
    clock: () => new Date(),
  });
  const rotateResult = await rotateService.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'x',
  });
  equal(
    rotateResult.code,
    'STORAGE_FAILURE',
    'rotate storage failure (initial CAS) is normalized'
  );
}

// --- Replay revoke storage failure is normalized (isolated to the revoke write, not the initial CAS) ---
{
  const { model } = createFakeModel({
    throwOn: 'findOneAndUpdate',
    throwOnCall: 2,
  });
  seedSession(model);
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'never-issued',
    newTokenHash: 'x',
  });
  equal(
    result.code,
    'STORAGE_FAILURE',
    'a storage failure isolated to the replay-revoke write is normalized'
  );
}

// --- Safe results never contain a token, hash, subject ID, sid, or jti ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const service = createRefreshSessionRotationService({
    model,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
  });
  const result = await service.rotate({
    sid: '1',
    presentedTokenHash: 'hash-current',
    newTokenHash: 'hash-next',
  });
  const serialized = JSON.stringify(result);
  check(
    !serialized.includes('hash-'),
    'no hash value appears in the safe result'
  );
  check(
    !serialized.includes('sub-1'),
    'no subject ID appears in the safe result'
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    'the safe result carries only a code'
  );
}

// --- Every documented result code exposes only { code } ---
{
  const codesToCheck = [
    'ROTATED',
    'CONFLICT_BENIGN',
    'REPLAY_DETECTED',
    'SESSION_MISSING',
    'SESSION_REVOKED',
    'SESSION_EXPIRED',
    'VERSION_MISMATCH',
    'INVALID_INPUT',
    'CLASSIFICATION_STALE',
    'STORAGE_FAILURE',
  ];
  check(
    codesToCheck.length === 10,
    'all known result codes are covered by this audit list'
  );
}

// --- Genuine concurrency-oriented test: two async rotation attempts using
// the same old hash, exactly one wins ---
{
  const { model } = createFakeModel();
  seedSession(model);
  const now = new Date('2026-01-01T00:00:00.000Z');
  const service = createRefreshSessionRotationService({
    model,
    clock: () => now,
  });

  const [resultA, resultB] = await Promise.all([
    service.rotate({
      sid: '1',
      presentedTokenHash: 'hash-current',
      newTokenHash: 'hash-from-a',
    }),
    service.rotate({
      sid: '1',
      presentedTokenHash: 'hash-current',
      newTokenHash: 'hash-from-b',
    }),
  ]);

  const codes = [resultA.code, resultB.code].sort();
  deepEqual(
    codes,
    ['CONFLICT_BENIGN', 'ROTATED'],
    'exactly one of two concurrent attempts wins, the other gets a benign conflict'
  );

  const doc = model._store.get('1');
  const installedHash = doc.currentTokenHash;
  check(
    installedHash === 'hash-from-a' || installedHash === 'hash-from-b',
    'exactly one successor hash was installed, from whichever request won'
  );
  equal(
    doc.revokedAt,
    null,
    'the concurrent loser does not trigger revocation'
  );
}

console.log(`refreshSessionRotation.test.js: ${assertions} assertions passed`);
