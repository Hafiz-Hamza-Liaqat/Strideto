/**
 * SEC-3D.1 — dormant session-family revocation service tests, against an
 * injected in-memory model double (no live MongoDB connection).
 * Run: node src/__tests__/sessionFamilyRevocation.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { createSessionFamilyRevocationService } from '../services/auth/SessionFamilyRevocationService.js';
import {
  SESSION_FAMILY_REVOCATION_RESULT_CODES,
  SINGLE_FAMILY_REVOKE_REASONS,
  ALL_FAMILY_REVOKE_REASONS,
  isSingleFamilyRevokeReason,
  isAllFamilyRevokeReason,
} from '../services/auth/SessionFamilyRevocationContracts.js';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VALID_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439099';
const VALID_FAMILY_ID = '607f1f77bcf86cd799439011';
const OTHER_FAMILY_ID = '607f1f77bcf86cd799439099';

/**
 * A deterministic, single-threaded fake model. `findOneAndUpdate` and
 * `updateMany` perform their filter match and mutation with no internal
 * `await` between them — this faithfully emulates MongoDB's real
 * per-document atomic guarantee, matching the convention already
 * established in `refreshSessionRotation.test.js`.
 */
function createFakeModel({ throwOn, throwOnCall } = {}) {
  const store = new Map();
  const calls = { findOneAndUpdate: [], findById: [], updateMany: [] };
  const callCounts = { findOneAndUpdate: 0, findById: 0, updateMany: 0 };

  function valuesEqual(a, b) {
    if (a instanceof Date || b instanceof Date) {
      if (!(a instanceof Date) || !(b instanceof Date)) return a === b;
      const aTime = a.getTime();
      const bTime = b.getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return true;
      return aTime === bTime;
    }
    return a === b;
  }

  function matches(doc, filter) {
    for (const [key, cond] of Object.entries(filter)) {
      if (key === '_id' || key === 'subjectId') {
        if (String(doc[key]) !== String(cond)) return false;
        continue;
      }
      if (
        cond &&
        typeof cond === 'object' &&
        !(cond instanceof Date) &&
        '$gt' in cond
      ) {
        if (
          !(doc[key] instanceof Date) ||
          !(doc[key].getTime() > cond.$gt.getTime())
        ) {
          return false;
        }
        continue;
      }
      if (!valuesEqual(doc[key], cond)) return false;
    }
    return true;
  }

  function applyUpdate(doc, update) {
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        doc[k] = v;
      }
    }
    return doc;
  }

  function shouldThrow(op, count) {
    if (throwOnCall !== undefined)
      return op === throwOn && count === throwOnCall;
    return op === throwOn;
  }

  const model = {
    async findOneAndUpdate(filter, update) {
      callCounts.findOneAndUpdate += 1;
      calls.findOneAndUpdate.push({ filter, update });
      if (shouldThrow('findOneAndUpdate', callCounts.findOneAndUpdate)) {
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
    async findById(id, projection) {
      callCounts.findById += 1;
      calls.findById.push({ id, projection });
      if (shouldThrow('findById', callCounts.findById)) {
        throw new Error('simulated storage failure');
      }
      const doc = store.get(String(id));
      if (!doc) return null;
      if (!projection) return { ...doc };
      const projected = { _id: doc._id };
      for (const key of Object.keys(projection)) {
        if (projection[key]) projected[key] = doc[key];
      }
      return projected;
    },
    async updateMany(filter, update) {
      callCounts.updateMany += 1;
      calls.updateMany.push({ filter, update });
      if (shouldThrow('updateMany', callCounts.updateMany)) {
        throw new Error('simulated storage failure');
      }
      let matchedCount = 0;
      let modifiedCount = 0;
      for (const doc of store.values()) {
        if (matches(doc, filter)) {
          matchedCount += 1;
          applyUpdate(doc, update);
          modifiedCount += 1;
        }
      }
      return { acknowledged: true, matchedCount, modifiedCount };
    },
    _store: store,
    _calls: calls,
    _callCounts: callCounts,
  };
  return model;
}

function seedFamily(model, overrides = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const doc = {
    _id: VALID_FAMILY_ID,
    subjectType: 'user',
    subjectId: VALID_USER_ID,
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
  model._store.set(String(doc._id), doc);
  return doc;
}

// =====================================================================
// --- Contract tests ---
// =====================================================================
{
  const codes = SESSION_FAMILY_REVOCATION_RESULT_CODES;
  equal(
    new Set(codes).size,
    codes.length,
    'every result code string is unique'
  );
  check(Object.isFrozen(codes), 'result-code list is frozen');
  check(
    Object.isFrozen(SINGLE_FAMILY_REVOKE_REASONS),
    'single-family reasons list is frozen'
  );
  check(
    Object.isFrozen(ALL_FAMILY_REVOKE_REASONS),
    'all-family reasons list is frozen'
  );

  deepEqual(
    [...SINGLE_FAMILY_REVOKE_REASONS].sort(),
    ['admin_revoked', 'logout', 'refresh_final_state_mismatch'].sort(),
    'allowed single-family reasons are exactly logout, admin_revoked, and the SEC-3D.3 post-rotation mismatch reason'
  );
  deepEqual(
    [...ALL_FAMILY_REVOKE_REASONS].sort(),
    [
      'logout_all',
      'password_change',
      'password_reset',
      'account_suspended',
      'account_deleted',
      'role_changed',
      'admin_revoked',
    ].sort(),
    'allowed all-family reasons match the accepted event matrix exactly'
  );
  check(
    !isAllFamilyRevokeReason('refresh_final_state_mismatch'),
    'the SEC-3D.3 post-rotation mismatch reason is single-family only, never accepted for an all-family sweep'
  );
  check(
    isSingleFamilyRevokeReason('refresh_final_state_mismatch'),
    'the SEC-3D.3 post-rotation mismatch reason is an accepted single-family reason'
  );

  check(
    !isSingleFamilyRevokeReason('replay_detected'),
    'replay_detected is never an allowed single-family reason'
  );
  check(
    !isAllFamilyRevokeReason('replay_detected'),
    'replay_detected is never an allowed all-family reason'
  );
  check(
    !isSingleFamilyRevokeReason('logout_all'),
    'logout_all is never an allowed single-family reason'
  );
  check(
    !isAllFamilyRevokeReason('logout'),
    'logout is never an allowed all-family reason'
  );
  check(
    !isSingleFamilyRevokeReason('not_a_real_reason'),
    'an unsupported reason fails closed for single-family'
  );
  check(
    !isAllFamilyRevokeReason('not_a_real_reason'),
    'an unsupported reason fails closed for all-family'
  );
}

// =====================================================================
// --- Construction tests ---
// =====================================================================
throwsType(
  () => createSessionFamilyRevocationService({}),
  'missing model is rejected'
);
throwsType(
  () => createSessionFamilyRevocationService({ refreshSessionModel: {} }),
  'a model missing every required method is rejected'
);
throwsType(
  () =>
    createSessionFamilyRevocationService({
      refreshSessionModel: {
        findById: async () => null,
        updateMany: async () => ({}),
      },
    }),
  'a model missing findOneAndUpdate is rejected'
);
throwsType(
  () =>
    createSessionFamilyRevocationService({
      refreshSessionModel: {
        findOneAndUpdate: async () => null,
        updateMany: async () => ({}),
      },
    }),
  'a model missing findById is rejected'
);
throwsType(
  () =>
    createSessionFamilyRevocationService({
      refreshSessionModel: {
        findOneAndUpdate: async () => null,
        findById: async () => null,
      },
    }),
  'a model missing updateMany is rejected'
);
throwsType(
  () =>
    createSessionFamilyRevocationService({
      refreshSessionModel: createFakeModel(),
      now: 'not-a-function',
    }),
  'a non-function clock is rejected'
);
{
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: createFakeModel(),
    now: () => new Date(),
  });
  check(
    typeof service.revokeCurrentFamily === 'function' &&
      typeof service.revokeAllFamilies === 'function',
    'valid injected dependencies are accepted'
  );
  check(Object.isFrozen(service), 'the returned service object is frozen');
}
{
  // No process.env dependency — a static-source check, since this
  // property cannot be observed purely through behavior.
  const contractsSource = fs.readFileSync(
    path.join(
      __dirname,
      '../services/auth/SessionFamilyRevocationContracts.js'
    ),
    'utf8'
  );
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../services/auth/SessionFamilyRevocationService.js'),
    'utf8'
  );
  check(
    !contractsSource.includes('process.env') &&
      !serviceSource.includes('process.env'),
    'neither module reads process.env'
  );
}

// =====================================================================
// --- Single-family revocation tests ---
// =====================================================================
for (const realm of ['user', 'employer']) {
  const model = createFakeModel();
  seedFamily(model, { subjectType: realm });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });

  const result = await service.revokeCurrentFamily({
    realm,
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'REVOKED_CURRENT_FAMILY',
    `${realm} single-family revoke succeeds`
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    `${realm} success result carries only a code`
  );

  const doc = model._store.get(VALID_FAMILY_ID);
  check(doc.revokedAt instanceof Date, `${realm} revokedAt is set`);
  equal(
    doc.revokeReason,
    'logout',
    `${realm} revokeReason is set to the supplied reason`
  );
  equal(doc.subjectType, realm, `${realm} subjectType is unchanged`);
  equal(doc.subjectId, VALID_USER_ID, `${realm} subjectId is unchanged`);
  equal(
    doc.currentTokenHash,
    'hash-current',
    `${realm} token hash is untouched`
  );
  equal(
    doc.tokenVersionAtIssue,
    0,
    `${realm} tokenVersionAtIssue is untouched`
  );
  equal(
    doc.expiresAt.getTime(),
    new Date('2026-01-01T00:01:00.000Z').getTime(),
    `${realm} expiresAt is untouched`
  );
}

// --- SEC-3D.3 addition: 'refresh_final_state_mismatch' is single-family only ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'refresh_final_state_mismatch',
  });
  equal(
    result.code,
    'REVOKED_CURRENT_FAMILY',
    'revokeCurrentFamily accepts the new SEC-3D.3 reason'
  );
  equal(
    model._store.get(VALID_FAMILY_ID).revokeReason,
    'refresh_final_state_mismatch',
    'the exact new reason is stored'
  );
  check(
    model._store.get(VALID_FAMILY_ID).subjectType === 'user' &&
      model._store.get(VALID_FAMILY_ID).subjectId === VALID_USER_ID,
    'realm and subject binding remain enforced for the new reason'
  );
}
{
  const model = createFakeModel();
  const doc = seedFamily(model, {
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'logout',
  });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'refresh_final_state_mismatch',
  });
  equal(
    doc.revokeReason,
    'logout',
    'an already-revoked family keeps its original reason — never overwritten by the new reason'
  );
}
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'refresh_final_state_mismatch',
  });
  equal(
    result.code,
    'INVALID_INPUT',
    'revokeAllFamilies rejects the SEC-3D.3 reason — single-family only'
  );
  equal(
    model._callCounts.updateMany,
    0,
    'the all-family rejection occurs before any model access'
  );
  equal(
    model._callCounts.findOneAndUpdate,
    0,
    'no findOneAndUpdate call either, on the rejected all-family attempt'
  );
}

// --- Exact filter and exact $set on the primary write ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    model._calls.findOneAndUpdate.length,
    1,
    'exactly one findOneAndUpdate call occurs'
  );
  const { filter, update } = model._calls.findOneAndUpdate[0];
  deepEqual(
    Object.keys(filter).sort(),
    ['_id', 'subjectType', 'subjectId', 'revokedAt', 'expiresAt'].sort(),
    'the primary filter binds exactly the identifier, realm, subject, revokedAt, and expiresAt'
  );
  equal(
    filter._id,
    VALID_FAMILY_ID,
    'filter binds the exact family identifier'
  );
  equal(filter.subjectType, 'user', 'filter binds the exact realm');
  equal(filter.subjectId, VALID_USER_ID, 'filter binds the exact subject');
  equal(filter.revokedAt, null, 'filter requires revokedAt: null');
  check('$gt' in filter.expiresAt, 'filter requires an unexpired family');
  deepEqual(
    Object.keys(update),
    ['$set'],
    'the update contains only a $set stage'
  );
  deepEqual(
    Object.keys(update.$set).sort(),
    ['revokedAt', 'revokeReason'].sort(),
    'the $set updates only revokedAt and revokeReason — no unrelated field'
  );
}

// --- Invalid input, zero model calls ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });

  const cases = [
    {
      realm: 'admin',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'logout',
    },
    {
      realm: 'user',
      subjectId: 'not-an-object-id',
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'logout',
    },
    {
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: 'not-an-object-id',
      reason: 'logout',
    },
    {
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'not_a_real_reason',
    },
    {
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'replay_detected',
    },
    {
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'logout_all',
    },
  ];
  for (const input of cases) {
    const result = await service.revokeCurrentFamily(input);
    equal(result.code, 'INVALID_INPUT', `rejected: ${JSON.stringify(input)}`);
    deepEqual(
      Object.keys(result),
      ['code'],
      'invalid-input result carries only a code'
    );
  }
  equal(
    model._callCounts.findOneAndUpdate,
    0,
    'no write occurred for any invalid input'
  );
  equal(
    model._callCounts.findById,
    0,
    'no read occurred for any invalid input'
  );

  const badClockService = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date(NaN),
  });
  const badClockResult = await badClockService.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    badClockResult.code,
    'INVALID_INPUT',
    'an invalid clock output is rejected'
  );
  equal(
    model._callCounts.findOneAndUpdate,
    0,
    'no write occurred for an invalid clock'
  );
}

// --- Missing family ---
{
  const model = createFakeModel();
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: OTHER_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'SESSION_MISSING',
    'a non-existent family is classified as missing'
  );
  equal(
    model._callCounts.findById,
    1,
    'exactly one classification read occurs'
  );
}

// --- Subject mismatch, ordered before revoked/expired disclosure ---
{
  const model = createFakeModel();
  seedFamily(model, { subjectId: OTHER_USER_ID });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'SESSION_SUBJECT_MISMATCH',
    'a family owned by a different subject is rejected'
  );

  // Same mismatch, but the family is ALSO already revoked — subject
  // mismatch must still win, never leaking the already-revoked state.
  const model2 = createFakeModel();
  seedFamily(model2, {
    subjectId: OTHER_USER_ID,
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'logout',
  });
  const service2 = createSessionFamilyRevocationService({
    refreshSessionModel: model2,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result2 = await service2.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result2.code,
    'SESSION_SUBJECT_MISMATCH',
    'subject mismatch takes priority over an already-revoked disclosure'
  );

  // Same mismatch, but the family is ALSO expired — subject mismatch
  // must still win, never leaking the expired state.
  const model3 = createFakeModel();
  seedFamily(model3, {
    subjectId: OTHER_USER_ID,
    expiresAt: new Date('2025-12-31T00:00:00.000Z'),
  });
  const service3 = createSessionFamilyRevocationService({
    refreshSessionModel: model3,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result3 = await service3.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result3.code,
    'SESSION_SUBJECT_MISMATCH',
    'subject mismatch takes priority over an expired disclosure'
  );

  // Realm mismatch (subjectType) is also a subject mismatch.
  const model4 = createFakeModel();
  seedFamily(model4, { subjectType: 'employer', subjectId: VALID_USER_ID });
  const service4 = createSessionFamilyRevocationService({
    refreshSessionModel: model4,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result4 = await service4.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result4.code,
    'SESSION_SUBJECT_MISMATCH',
    'a realm mismatch is also a subject mismatch'
  );

  // Compound: subject mismatch AND the family is both revoked AND expired
  // at once — mismatch must still win, disclosing neither.
  const model5 = createFakeModel();
  seedFamily(model5, {
    subjectId: OTHER_USER_ID,
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'logout',
    expiresAt: new Date('2025-12-31T00:00:00.000Z'),
  });
  const service5 = createSessionFamilyRevocationService({
    refreshSessionModel: model5,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result5 = await service5.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result5.code,
    'SESSION_SUBJECT_MISMATCH',
    'subject mismatch takes priority even when the family is simultaneously revoked and expired'
  );

  // Compound: realm mismatch AND the family is both revoked AND expired
  // at once — mismatch must still win, disclosing neither.
  const model6 = createFakeModel();
  seedFamily(model6, {
    subjectType: 'employer',
    subjectId: VALID_USER_ID,
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'logout',
    expiresAt: new Date('2025-12-31T00:00:00.000Z'),
  });
  const service6 = createSessionFamilyRevocationService({
    refreshSessionModel: model6,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result6 = await service6.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result6.code,
    'SESSION_SUBJECT_MISMATCH',
    'realm mismatch takes priority even when the family is simultaneously revoked and expired'
  );

  // Same-subject (no mismatch) compound: revoked AND expired at once —
  // already-revoked must take priority over expired, per the required
  // classification order.
  const model7 = createFakeModel();
  seedFamily(model7, {
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'admin_revoked',
    expiresAt: new Date('2025-12-31T00:00:00.000Z'),
  });
  const service7 = createSessionFamilyRevocationService({
    refreshSessionModel: model7,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result7 = await service7.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result7.code,
    'SESSION_ALREADY_REVOKED',
    'already-revoked takes priority over expired when both are true for the correct subject'
  );
}

// --- Single-family stored-state corruption: malformed/missing expiresAt ---
{
  const cases = [
    ['missing expiresAt', undefined],
    ['invalid Date expiresAt', new Date(NaN)],
    ['non-Date string expiresAt', 'not-a-date'],
  ];
  for (const [label, expiresAt] of cases) {
    const model = createFakeModel();
    seedFamily(model, { expiresAt });
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeCurrentFamily({
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'logout',
    });
    equal(
      result.code,
      'SESSION_EXPIRED',
      `${label} fails closed to SESSION_EXPIRED, never treated as active`
    );
    equal(
      model._callCounts.findOneAndUpdate,
      1,
      `${label}: no fallback write occurs`
    );
    equal(
      model._callCounts.findById,
      1,
      `${label}: exactly one classification read occurs`
    );
    const serialized = JSON.stringify(result);
    check(
      !serialized.includes(VALID_USER_ID) &&
        !serialized.includes(VALID_FAMILY_ID),
      `${label}: no sensitive value appears in the result`
    );
  }
}

// --- Equality boundary: expiresAt exactly equal to now is expired ---
{
  const now = new Date('2026-01-01T00:00:10.000Z');
  const model = createFakeModel();
  seedFamily(model, { expiresAt: new Date(now.getTime()) });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => now,
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'SESSION_EXPIRED',
    'expiresAt exactly equal to now is classified as expired, matching the primary filter’s $gt: now'
  );
}

// --- Single-family stored-state corruption: malformed revokedAt ---
{
  const cases = [
    ['invalid Date revokedAt', new Date(NaN)],
    ['non-Date string revokedAt', 'not-a-date'],
  ];
  for (const [label, revokedAt] of cases) {
    const model = createFakeModel();
    seedFamily(model, { revokedAt, revokeReason: 'logout' });
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeCurrentFamily({
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'admin_revoked',
    });
    equal(
      result.code,
      'SESSION_ALREADY_REVOKED',
      `${label} is treated as truthy/already-revoked, never as an active eligible session (fails closed)`
    );
    equal(
      model._store.get(VALID_FAMILY_ID).revokeReason,
      'logout',
      `${label}: the original revokeReason is never overwritten`
    );
    equal(
      model._callCounts.findOneAndUpdate,
      1,
      `${label}: no second write occurs`
    );
  }
}

// --- Canonical uppercase-hex ObjectId is accepted ---
{
  const upperSubjectId = VALID_USER_ID.toUpperCase();
  const upperFamilyId = VALID_FAMILY_ID.toUpperCase();
  const model = createFakeModel();
  seedFamily(model, { _id: upperFamilyId, subjectId: upperSubjectId });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: upperSubjectId,
    sessionFamilyId: upperFamilyId,
    reason: 'logout',
  });
  equal(
    result.code,
    'REVOKED_CURRENT_FAMILY',
    'a canonical uppercase-hex ObjectId is accepted, not rejected as invalid'
  );
}

// --- Expired family ---
{
  const model = createFakeModel();
  seedFamily(model, { expiresAt: new Date('2025-12-31T00:00:00.000Z') });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'SESSION_EXPIRED',
    'an expired family is classified as expired'
  );
}

// --- Already-revoked family, idempotent repeat ---
{
  const model = createFakeModel();
  seedFamily(model, {
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'logout',
  });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'SESSION_ALREADY_REVOKED',
    'an already-revoked family is classified safely, not as an error'
  );
  equal(
    model._store.get(VALID_FAMILY_ID).revokeReason,
    'logout',
    'the original revokeReason is never overwritten by a repeat call'
  );
}

// --- Repeated call with a different reason cannot overwrite revokeReason ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const first = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    first.code,
    'REVOKED_CURRENT_FAMILY',
    'the first call revokes the family'
  );
  const second = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'admin_revoked',
  });
  equal(
    second.code,
    'SESSION_ALREADY_REVOKED',
    'the second call cannot re-revoke'
  );
  equal(
    model._store.get(VALID_FAMILY_ID).revokeReason,
    'logout',
    'the original revokeReason survives a repeated call with a different reason'
  );
}

// --- CLASSIFICATION_STALE: state changed between the primary write and classification ---
{
  const model = createFakeModel();
  seedFamily(model);
  const now = new Date('2026-01-01T00:00:10.000Z');
  // Force the primary write to always miss (simulating a lost race),
  // then simulate a legitimate concurrent revoke completing before the
  // classification read runs.
  const originalFindOneAndUpdate = model.findOneAndUpdate.bind(model);
  model.findOneAndUpdate = async (filter, update) => {
    model._calls.findOneAndUpdate.push({ filter, update });
    return null; // always miss, regardless of filter match
  };
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => now,
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'CLASSIFICATION_STALE',
    'a family that is still active at classification time, despite the primary write missing, is reported as stale, not silently revoked'
  );
  equal(
    model._store.get(VALID_FAMILY_ID).revokedAt,
    null,
    'no fallback write ever revoked the family'
  );
  void originalFindOneAndUpdate;
}

// --- Update storage failure ---
{
  const model = createFakeModel({ throwOn: 'findOneAndUpdate' });
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'STORAGE_FAILURE',
    'a thrown write error is normalized safely'
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    'storage-failure result carries only a code'
  );
}

// --- Classification-read storage failure ---
{
  const model = createFakeModel({ throwOn: 'findById' });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: OTHER_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'STORAGE_FAILURE',
    'a thrown classification-read error is normalized safely'
  );
}

// --- Malformed (empty but truthy) update result is handled safely ---
{
  const model = createFakeModel();
  seedFamily(model);
  const originalFindOneAndUpdate = model.findOneAndUpdate.bind(model);
  model.findOneAndUpdate = async (filter, update) => {
    const real = await originalFindOneAndUpdate(filter, update);
    return real ? {} : real; // truthy but empty — the service must never read fields off it
  };
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    result.code,
    'REVOKED_CURRENT_FAMILY',
    'a truthy-but-empty driver result is treated as success'
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    'the result never exposes any field from the driver result'
  );
}

// --- At most one classification read, no fallback write ---
{
  const model = createFakeModel();
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: OTHER_FAMILY_ID,
    reason: 'logout',
  });
  equal(
    model._callCounts.findById,
    1,
    'exactly one classification read occurs on a miss'
  );
  equal(
    model._callCounts.findOneAndUpdate,
    1,
    'no second (fallback) write occurs on a miss'
  );
}

// --- Concurrency: two concurrent valid calls permit at most one success ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const [a, b] = await Promise.all([
    service.revokeCurrentFamily({
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'logout',
    }),
    service.revokeCurrentFamily({
      realm: 'user',
      subjectId: VALID_USER_ID,
      sessionFamilyId: VALID_FAMILY_ID,
      reason: 'admin_revoked',
    }),
  ]);
  const codes = [a.code, b.code].sort();
  deepEqual(
    codes,
    ['REVOKED_CURRENT_FAMILY', 'SESSION_ALREADY_REVOKED'],
    'exactly one of two concurrent calls succeeds, the other observes it already revoked'
  );
  const winnerReason =
    a.code === 'REVOKED_CURRENT_FAMILY' ? 'logout' : 'admin_revoked';
  equal(
    model._store.get(VALID_FAMILY_ID).revokeReason,
    winnerReason,
    'the final stored revokeReason belongs to whichever operation actually won'
  );
  equal(
    model._callCounts.findOneAndUpdate,
    2,
    'exactly two primary update attempts occur — both calls used the real production filter'
  );
  check(
    model._callCounts.findById <= 1,
    'at most one classification read is made, by the losing operation only'
  );
  equal(
    [a, b].filter((r) => r.code === 'REVOKED_CURRENT_FAMILY').length,
    1,
    'exactly one successful transition occurs'
  );
  check(
    ![a, b].some(
      (r) =>
        r.code !== 'REVOKED_CURRENT_FAMILY' &&
        r.code !== 'SESSION_ALREADY_REVOKED'
    ),
    'no fallback write produced any other result code'
  );
}

// --- No sensitive exposure across every single-family branch ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeCurrentFamily({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  const serialized = JSON.stringify(result);
  check(
    !serialized.includes(VALID_USER_ID),
    'no subject ID appears in the safe result'
  );
  check(
    !serialized.includes(VALID_FAMILY_ID),
    'no session-family identifier appears in the safe result'
  );
  check(
    !serialized.includes('hash-'),
    'no token hash appears in the safe result'
  );
}

// =====================================================================
// --- All-family revocation tests ---
// =====================================================================
for (const realm of ['user', 'employer']) {
  const model = createFakeModel();
  seedFamily(model, { _id: VALID_FAMILY_ID, subjectType: realm });
  seedFamily(model, {
    _id: OTHER_FAMILY_ID,
    subjectType: realm,
    currentTokenHash: 'hash-2',
  });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm,
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(
    result.code,
    'REVOKED_ALL_FAMILIES',
    `${realm} all-family revoke succeeds`
  );
  equal(result.revokedCount, 2, `${realm} both active families are revoked`);
  deepEqual(
    Object.keys(result).sort(),
    ['code', 'revokedCount'].sort(),
    `${realm} success result carries only code and revokedCount`
  );
  check(
    model._store.get(VALID_FAMILY_ID).revokedAt instanceof Date,
    `${realm} first family revoked`
  );
  check(
    model._store.get(OTHER_FAMILY_ID).revokedAt instanceof Date,
    `${realm} second family revoked`
  );
}

// --- Exact filter and exact $set ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(model._callCounts.updateMany, 1, 'exactly one updateMany call occurs');
  const { filter, update } = model._calls.updateMany[0];
  deepEqual(
    Object.keys(filter).sort(),
    ['subjectType', 'subjectId', 'revokedAt'].sort(),
    'the all-family filter binds exactly realm, subject, and revokedAt: null — no expiresAt precondition (chosen policy)'
  );
  equal(filter.subjectType, 'user');
  equal(filter.subjectId, VALID_USER_ID);
  equal(filter.revokedAt, null);
  deepEqual(Object.keys(update), ['$set']);
  deepEqual(
    Object.keys(update.$set).sort(),
    ['revokedAt', 'revokeReason'].sort()
  );
}

// --- Chosen expired-session policy: expired-but-unrevoked families ARE included ---
{
  const model = createFakeModel();
  seedFamily(model, { expiresAt: new Date('2025-12-31T00:00:00.000Z') });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(
    result.revokedCount,
    1,
    'an expired-but-unrevoked family is included in the sweep, per the chosen policy'
  );
}

// --- Already-revoked families are excluded and never overwritten ---
{
  const model = createFakeModel();
  seedFamily(model, {
    revokedAt: new Date('2025-12-31T00:00:00.000Z'),
    revokeReason: 'replay_detected',
  });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(result.revokedCount, 0, 'an already-revoked family is not counted');
  equal(
    model._store.get(VALID_FAMILY_ID).revokeReason,
    'replay_detected',
    'the historical revokeReason is never overwritten by an all-family sweep'
  );
}

// --- Every supported all-family reason succeeds ---
for (const reason of ALL_FAMILY_REVOKE_REASONS) {
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason,
  });
  equal(
    result.code,
    'REVOKED_ALL_FAMILIES',
    `reason "${reason}" is accepted for all-family revocation`
  );
}

// --- Unsupported reason and other invalid input, zero operations ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const cases = [
    { realm: 'user', subjectId: VALID_USER_ID, reason: 'logout' },
    { realm: 'user', subjectId: VALID_USER_ID, reason: 'replay_detected' },
    { realm: 'admin', subjectId: VALID_USER_ID, reason: 'logout_all' },
    { realm: 'user', subjectId: 'not-an-object-id', reason: 'logout_all' },
  ];
  for (const input of cases) {
    const result = await service.revokeAllFamilies(input);
    equal(result.code, 'INVALID_INPUT', `rejected: ${JSON.stringify(input)}`);
  }
  equal(
    model._callCounts.updateMany,
    0,
    'no updateMany call occurred for any invalid input'
  );

  const badClockService = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date(NaN),
  });
  const badClockResult = await badClockService.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(
    badClockResult.code,
    'INVALID_INPUT',
    'an invalid clock output is rejected'
  );
  equal(
    model._callCounts.updateMany,
    0,
    'no updateMany call occurred for an invalid clock'
  );
}

// --- Zero-matched sweep is an idempotent success, not a failure ---
{
  const model = createFakeModel();
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(
    result.code,
    'REVOKED_ALL_FAMILIES',
    'zero active families is a successful, idempotent cleanup'
  );
  equal(result.revokedCount, 0, 'revokedCount is zero, not an error');
}

// --- Malformed driver results map to STORAGE_FAILURE ---
{
  const malformedResults = [
    null,
    undefined,
    {},
    { acknowledged: false, matchedCount: 1, modifiedCount: 1 },
    { acknowledged: true, modifiedCount: -1 },
    { acknowledged: true, modifiedCount: 1.5 },
    { acknowledged: true, matchedCount: 1, modifiedCount: 2 },
    { acknowledged: true, matchedCount: -1, modifiedCount: 0 },
    { acknowledged: true, matchedCount: 1.5, modifiedCount: 0 },
    // Missing required count fields entirely (matchedCount is now mandatory).
    { acknowledged: true, modifiedCount: 0 },
    { acknowledged: true, matchedCount: 2 },
    // Literal NaN / Infinity / -Infinity for either count field.
    { acknowledged: true, matchedCount: NaN, modifiedCount: 0 },
    { acknowledged: true, matchedCount: 2, modifiedCount: NaN },
    { acknowledged: true, matchedCount: Infinity, modifiedCount: 0 },
    { acknowledged: true, matchedCount: 2, modifiedCount: Infinity },
    { acknowledged: true, matchedCount: -Infinity, modifiedCount: 0 },
    { acknowledged: true, matchedCount: 2, modifiedCount: -Infinity },
    // Unsafe integers — beyond Number.MAX_SAFE_INTEGER, already lost
    // precision; Number.isInteger alone would wrongly accept these.
    {
      acknowledged: true,
      matchedCount: Number.MAX_SAFE_INTEGER + 1,
      modifiedCount: 0,
    },
    {
      acknowledged: true,
      matchedCount: Number.MAX_SAFE_INTEGER + 2,
      modifiedCount: Number.MAX_SAFE_INTEGER + 1,
    },
  ];
  for (const malformed of malformedResults) {
    const model = createFakeModel();
    model.updateMany = async () => malformed;
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeAllFamilies({
      realm: 'user',
      subjectId: VALID_USER_ID,
      reason: 'logout_all',
    });
    equal(
      result.code,
      'STORAGE_FAILURE',
      `malformed driver result is normalized: ${JSON.stringify(malformed)}`
    );
    deepEqual(
      Object.keys(result),
      ['code'],
      'storage-failure result carries only a code'
    );
  }
}

// --- Deterministic all-family result classification matrix ---
{
  // Full positive success: matchedCount === modifiedCount > 0.
  {
    const model = createFakeModel();
    model.updateMany = async () => ({
      acknowledged: true,
      matchedCount: 3,
      modifiedCount: 3,
    });
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeAllFamilies({
      realm: 'user',
      subjectId: VALID_USER_ID,
      reason: 'logout_all',
    });
    equal(
      result.code,
      'REVOKED_ALL_FAMILIES',
      'matchedCount === modifiedCount > 0 is full success'
    );
    equal(result.revokedCount, 3, 'revokedCount equals modifiedCount exactly');
    deepEqual(Object.keys(result).sort(), ['code', 'revokedCount'].sort());
  }

  // Zero-modified idempotent success — including the matchedCount > 0,
  // modifiedCount === 0 case, which retains the existing idempotent
  // success classification per this correction's exact directive.
  for (const counts of [
    { matchedCount: 0, modifiedCount: 0 },
    { matchedCount: 3, modifiedCount: 0 },
  ]) {
    const model = createFakeModel();
    model.updateMany = async () => ({ acknowledged: true, ...counts });
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeAllFamilies({
      realm: 'user',
      subjectId: VALID_USER_ID,
      reason: 'logout_all',
    });
    equal(
      result.code,
      'REVOKED_ALL_FAMILIES',
      `modifiedCount === 0 (matchedCount=${counts.matchedCount}) retains idempotent success`
    );
    equal(
      result.revokedCount,
      0,
      'revokedCount is exactly 0, never misrepresented'
    );
  }

  // Genuine same-call partial: matchedCount > modifiedCount > 0.
  {
    const model = createFakeModel();
    model.updateMany = async () => ({
      acknowledged: true,
      matchedCount: 5,
      modifiedCount: 2,
    });
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeAllFamilies({
      realm: 'user',
      subjectId: VALID_USER_ID,
      reason: 'logout_all',
    });
    equal(
      result.code,
      'REVOCATION_PARTIAL',
      'matchedCount > modifiedCount > 0 is deterministically classified as a partial cleanup'
    );
    equal(
      result.revokedCount,
      2,
      'revokedCount equals the exact modifiedCount, never matchedCount'
    );
    deepEqual(
      Object.keys(result).sort(),
      ['code', 'revokedCount'].sort(),
      'the partial result exposes no matchedCount, identifier, filter, or reason'
    );
    const serialized = JSON.stringify(result);
    check(
      !serialized.includes(VALID_USER_ID) && !serialized.includes('logout_all'),
      'no subject ID or reason value appears in the partial result'
    );
  }

  // modifiedCount > matchedCount remains STORAGE_FAILURE, never a
  // successful state transition of any kind.
  {
    const model = createFakeModel();
    model.updateMany = async () => ({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 2,
    });
    const service = createSessionFamilyRevocationService({
      refreshSessionModel: model,
      now: () => new Date('2026-01-01T00:00:10.000Z'),
    });
    const result = await service.revokeAllFamilies({
      realm: 'user',
      subjectId: VALID_USER_ID,
      reason: 'logout_all',
    });
    equal(
      result.code,
      'STORAGE_FAILURE',
      'modifiedCount > matchedCount is an impossible, malformed relationship — never a success'
    );
  }
}

// --- Thrown storage error, no automatic retry ---
{
  const model = createFakeModel({ throwOn: 'updateMany' });
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  equal(
    result.code,
    'STORAGE_FAILURE',
    'a thrown updateMany error is normalized safely'
  );
  equal(
    model._callCounts.updateMany,
    1,
    'no automatic retry occurs after a storage failure'
  );
}

// --- No sensitive exposure ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const result = await service.revokeAllFamilies({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  const serialized = JSON.stringify(result);
  check(
    !serialized.includes(VALID_USER_ID),
    'no subject ID appears in the safe result'
  );
  check(
    !serialized.includes('hash-'),
    'no token hash appears in the safe result'
  );
}

// --- Caller-supplied inputs are never mutated ---
{
  const model = createFakeModel();
  seedFamily(model);
  const service = createSessionFamilyRevocationService({
    refreshSessionModel: model,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const singleInput = Object.freeze({
    realm: 'user',
    subjectId: VALID_USER_ID,
    sessionFamilyId: VALID_FAMILY_ID,
    reason: 'logout',
  });
  await service.revokeCurrentFamily(singleInput);
  check(
    true,
    'revokeCurrentFamily never attempts to mutate a frozen input object'
  );

  const model2 = createFakeModel();
  seedFamily(model2);
  const service2 = createSessionFamilyRevocationService({
    refreshSessionModel: model2,
    now: () => new Date('2026-01-01T00:00:10.000Z'),
  });
  const allInput = Object.freeze({
    realm: 'user',
    subjectId: VALID_USER_ID,
    reason: 'logout_all',
  });
  await service2.revokeAllFamilies(allInput);
  check(
    true,
    'revokeAllFamilies never attempts to mutate a frozen input object'
  );
}

console.log(`sessionFamilyRevocation.test.js: ${assertions} assertions passed`);
