import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createInitialSessionIssuanceService } from '../services/auth/initialSessionIssuance.js';

assert.strictEqual(
  mongoose.connection.readyState,
  0,
  'must not be connected to MongoDB'
);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function fakeJwtProvider({
  throwOnAccess = false,
  throwOnRefresh = false,
} = {}) {
  return {
    issueAccessToken({ sub, realm, sid, tokenVersion }) {
      if (throwOnAccess) throw new Error('boom');
      return {
        token: `access:${sub}:${realm}:${sid}:${tokenVersion}`,
        jti: 'jti-access',
      };
    },
    issueRefreshToken({ sub, realm, sid, tokenVersion }) {
      if (throwOnRefresh) throw new Error('boom');
      return {
        token: `refresh:${sub}:${realm}:${sid}:${tokenVersion}`,
        jti: 'jti-refresh',
      };
    },
  };
}

function fakeModel({ throwOnCreate = false } = {}) {
  const calls = [];
  return {
    calls,
    async create(doc) {
      calls.push(doc);
      if (throwOnCreate) throw new Error('storage down');
      return { ...doc };
    },
  };
}

const SUBJECT_ID = '507f1f77bcf86cd799439011';

// --- Input validation, zero model calls -------------------------------------
{
  const model = fakeModel();
  const svc = createInitialSessionIssuanceService({
    jwtProvider: fakeJwtProvider(),
    refreshSessionModel: model,
  });

  const badRealm = await svc.issueInitialSession({
    realm: 'admin',
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(badRealm.code === 'INVALID_INPUT', 'bad realm rejected');

  const badSubject = await svc.issueInitialSession({
    realm: 'user',
    subjectId: 'not-an-id',
    tokenVersion: 0,
  });
  check(badSubject.code === 'INVALID_INPUT', 'bad subjectId rejected');

  const badVersion = await svc.issueInitialSession({
    realm: 'user',
    subjectId: SUBJECT_ID,
    tokenVersion: -1,
  });
  check(badVersion.code === 'INVALID_INPUT', 'negative tokenVersion rejected');

  const fractional = await svc.issueInitialSession({
    realm: 'user',
    subjectId: SUBJECT_ID,
    tokenVersion: 1.5,
  });
  check(
    fractional.code === 'INVALID_INPUT',
    'fractional tokenVersion rejected'
  );

  check(model.calls.length === 0, 'zero model calls on any invalid input');
}

// --- Successful issuance -----------------------------------------------------
{
  const model = fakeModel();
  const generateId = () => 'fixed-sid-123';
  const svc = createInitialSessionIssuanceService({
    jwtProvider: fakeJwtProvider(),
    refreshSessionModel: model,
    generateId,
    now: () => new Date('2026-01-01T00:00:00Z'),
  });

  const result = await svc.issueInitialSession({
    realm: 'user',
    subjectId: SUBJECT_ID,
    tokenVersion: 3,
  });
  check(result.code === 'SESSION_ISSUED', 'session issued');
  check(result.sid === 'fixed-sid-123', 'stable sid returned');
  check(
    result.accessToken.includes(':fixed-sid-123:3'),
    'access token carries the preallocated sid and tokenVersion'
  );
  check(
    result.refreshToken.includes(':fixed-sid-123:3'),
    'refresh token carries the preallocated sid and tokenVersion'
  );
  check(model.calls.length === 1, 'exactly one document created');

  const doc = model.calls[0];
  check(
    doc._id === 'fixed-sid-123',
    'document _id equals the preallocated sid'
  );
  check(doc.subjectType === 'user', 'subjectType set');
  check(doc.subjectId === SUBJECT_ID, 'subjectId set');
  check(doc.tokenVersionAtIssue === 3, 'tokenVersionAtIssue snapshot set');
  check(doc.previousTokenHash === null, 'previousTokenHash null');
  check(doc.previousTokenRotatedAt === null, 'previousTokenRotatedAt null');
  check(doc.revokedAt === null, 'revokedAt null');
  check(doc.revokeReason === null, 'revokeReason null');
  check(
    typeof doc.currentTokenHash === 'string' &&
      doc.currentTokenHash.length === 64,
    'only the hash is persisted, sha256 hex length'
  );
  check(
    doc.currentTokenHash !== result.refreshToken,
    'raw refresh token is never the persisted value'
  );
  check(
    doc.expiresAt.getTime() === new Date('2026-01-08T00:00:00Z').getTime(),
    'expiresAt is now + 7d default TTL'
  );
}

// --- Storage failure: no token returned, no cookie-worthy value leaked -----
{
  const model = fakeModel({ throwOnCreate: true });
  const svc = createInitialSessionIssuanceService({
    jwtProvider: fakeJwtProvider(),
    refreshSessionModel: model,
  });
  const result = await svc.issueInitialSession({
    realm: 'employer',
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(
    result.code === 'STORAGE_FAILURE',
    'create() failure maps to STORAGE_FAILURE'
  );
  check(
    Object.keys(result).length === 1,
    'failure result carries only {code}, no token'
  );
}

// --- Token-issuance failure never reaches the model at all -------------------
{
  const model = fakeModel();
  const svc = createInitialSessionIssuanceService({
    jwtProvider: fakeJwtProvider({ throwOnRefresh: true }),
    refreshSessionModel: model,
  });
  const result = await svc.issueInitialSession({
    realm: 'user',
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(
    result.code === 'STORAGE_FAILURE',
    'refresh-token signing failure fails closed'
  );
  check(
    model.calls.length === 0,
    'no document created when token issuance fails first'
  );
}

// --- Constructor validation ---------------------------------------------------
{
  assert.throws(
    () =>
      createInitialSessionIssuanceService({ refreshSessionModel: fakeModel() }),
    /jwtProvider/
  );
  count += 1;
  assert.throws(
    () =>
      createInitialSessionIssuanceService({
        jwtProvider: fakeJwtProvider(),
        refreshSessionModel: {},
      }),
    /RefreshSession model/
  );
  count += 1;
}

console.log(`initialSessionIssuance.test.js: ${count} assertions passed`);
