/**
 * SEC-3D.3 — dormant refresh-eligibility and post-rotation revalidation
 * coordinator tests, against injected doubles (no live MongoDB connection).
 * Run: node src/__tests__/refreshEligibilityCoordinator.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createRefreshEligibilityCoordinator } from '../services/auth/RefreshEligibilityCoordinator.js';
import { REFRESH_FINAL_STATE_MISMATCH_REVOKE_REASON } from '../services/auth/RefreshEligibilityContracts.js';

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

const SUBJECT_ID = '507f1f77bcf86cd799439011';
const SID = '607f1f77bcf86cd799439011';

const VALID_CLAIMS = Object.freeze({
  sub: SUBJECT_ID,
  realm: 'user',
  sid: SID,
  jti: 'jti-1',
  tokenVersion: 3,
});

function createFakeJwtSessionProvider({
  throwOnVerify = false,
  claims = VALID_CLAIMS,
  callLog,
} = {}) {
  let issueCounter = 0;
  return {
    verifyRefreshToken(token) {
      callLog?.push(['verifyRefreshToken']);
      if (throwOnVerify) {
        throw new Error('invalid token');
      }
      void token;
      return claims;
    },
    issueRefreshToken(args) {
      callLog?.push(['issueRefreshToken', args]);
      issueCounter += 1;
      return {
        token: `new-refresh-${issueCounter}`,
        jti: `jti-r-${issueCounter}`,
      };
    },
    issueAccessToken(args) {
      callLog?.push(['issueAccessToken', args]);
      issueCounter += 1;
      return {
        token: `new-access-${issueCounter}`,
        jti: `jti-a-${issueCounter}`,
      };
    },
  };
}

function createFakeSessionModel({
  seed = null,
  throwOn = false,
  callLog,
} = {}) {
  const calls = [];
  return {
    async findById(id) {
      calls.push(id);
      callLog?.push(['findById', id]);
      if (throwOn) throw new Error('storage failure');
      if (!seed) return null;
      return { ...seed };
    },
    calls,
  };
}

function createFakeSubjectStateProvider({ results, callLog } = {}) {
  // `results` is an array; each call consumes the next entry (or repeats
  // the last if exhausted) — lets a test script "pre-rotation" vs
  // "post-rotation" reread to return different values.
  let callIndex = 0;
  const calls = [];
  return {
    async getSubjectState(args) {
      calls.push(args);
      callLog?.push(['getSubjectState', args]);
      const result = results[Math.min(callIndex, results.length - 1)];
      callIndex += 1;
      return result;
    },
    calls,
  };
}

function createFakeRotationService({ result, callLog } = {}) {
  const calls = [];
  return {
    async rotate(args) {
      calls.push(args);
      callLog?.push(['rotate', args]);
      return result;
    },
    calls,
  };
}

function createFakeFamilyRevocationService({
  result = { code: 'REVOKED_CURRENT_FAMILY' },
  throwOn = false,
  callLog,
} = {}) {
  const calls = [];
  return {
    async revokeCurrentFamily(args) {
      calls.push(args);
      callLog?.push(['revokeCurrentFamily', args]);
      if (throwOn) throw new Error('storage failure');
      return result;
    },
    calls,
  };
}

function activeState(tokenVersion = 3) {
  return Object.freeze({ code: 'SUBJECT_ACTIVE', tokenVersion });
}

function buildCoordinator(overrides = {}) {
  const jwtSessionProvider =
    overrides.jwtSessionProvider ?? createFakeJwtSessionProvider(overrides.jwt);
  const refreshSessionModel =
    overrides.refreshSessionModel ?? createFakeSessionModel(overrides.session);
  const subjectStateProvider =
    overrides.subjectStateProvider ??
    createFakeSubjectStateProvider(
      overrides.subjectState ?? { results: [activeState(), activeState()] }
    );
  const rotationService =
    overrides.rotationService ??
    createFakeRotationService(
      overrides.rotation ?? { result: { code: 'ROTATED' } }
    );
  const familyRevocationService =
    overrides.familyRevocationService ??
    createFakeFamilyRevocationService(overrides.cleanup);

  return createRefreshEligibilityCoordinator({
    jwtSessionProvider,
    refreshSessionModel,
    subjectStateProvider,
    rotationService,
    familyRevocationService,
  });
}

function seedSession(overrides = {}) {
  return {
    _id: SID,
    subjectType: 'user',
    subjectId: SUBJECT_ID,
    currentTokenHash: 'a'.repeat(64),
    previousTokenHash: null,
    previousTokenRotatedAt: null,
    tokenVersionAtIssue: 3,
    revokedAt: null,
    revokeReason: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

// =======================================================================
// Construction validation
// =======================================================================
{
  const valid = {
    jwtSessionProvider: createFakeJwtSessionProvider(),
    refreshSessionModel: createFakeSessionModel({ seed: seedSession() }),
    subjectStateProvider: createFakeSubjectStateProvider({
      results: [activeState()],
    }),
    rotationService: createFakeRotationService({ result: { code: 'ROTATED' } }),
    familyRevocationService: createFakeFamilyRevocationService(),
  };
  throwsType(
    () =>
      createRefreshEligibilityCoordinator({ ...valid, jwtSessionProvider: {} }),
    'missing jwtSessionProvider methods throws'
  );
  throwsType(
    () =>
      createRefreshEligibilityCoordinator({
        ...valid,
        jwtSessionProvider: undefined,
      }),
    'no jwtSessionProvider throws'
  );
  throwsType(
    () =>
      createRefreshEligibilityCoordinator({
        ...valid,
        refreshSessionModel: {},
      }),
    'invalid refreshSessionModel throws'
  );
  throwsType(
    () =>
      createRefreshEligibilityCoordinator({
        ...valid,
        subjectStateProvider: {},
      }),
    'invalid subjectStateProvider throws'
  );
  throwsType(
    () =>
      createRefreshEligibilityCoordinator({ ...valid, rotationService: {} }),
    'invalid rotationService throws'
  );
  throwsType(
    () =>
      createRefreshEligibilityCoordinator({
        ...valid,
        familyRevocationService: {},
      }),
    'invalid familyRevocationService throws'
  );
  throwsType(
    () => createRefreshEligibilityCoordinator({ ...valid, hashToken: 'nope' }),
    'invalid hashToken throws'
  );
  throwsType(
    () => createRefreshEligibilityCoordinator({ ...valid, now: 'nope' }),
    'invalid now throws'
  );

  // Construction succeeds with every valid dependency supplied explicitly.
  const coordinator = createRefreshEligibilityCoordinator(valid);
  check(
    typeof coordinator.attemptRefresh === 'function',
    'construction succeeds and exposes attemptRefresh'
  );
}

// =======================================================================
// Step 1 — input validation, zero dependency calls
// =======================================================================
{
  const callLog = [];
  const coordinator = buildCoordinator({
    jwt: { callLog },
    session: { callLog, seed: seedSession() },
    subjectState: undefined,
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: '',
  });
  deepEqual(result, { code: 'INVALID_INPUT' }, 'empty token is invalid input');
  equal(callLog.length, 0, 'zero dependency calls for invalid input');

  const missing = await coordinator.attemptRefresh({});
  deepEqual(
    missing,
    { code: 'INVALID_INPUT' },
    'missing token field is invalid input'
  );
}

// =======================================================================
// Step 2/3 — invalid JWT / malformed claims
// =======================================================================
{
  const jwtCallLog = [];
  const sessionCallLog = [];
  const coordinator = buildCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({
      throwOnVerify: true,
      callLog: jwtCallLog,
    }),
    refreshSessionModel: createFakeSessionModel({ callLog: sessionCallLog }),
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'garbage',
  });
  deepEqual(
    result,
    { code: 'REFRESH_TOKEN_INVALID' },
    'invalid JWT maps to REFRESH_TOKEN_INVALID'
  );
  equal(
    sessionCallLog.length,
    0,
    'no session lookup is attempted after a JWT verification failure'
  );
}

// =======================================================================
// Step 3 — session load and binding
// =======================================================================
{
  // Missing session.
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({ seed: null }),
  });
  deepEqual(
    await coordinator.attemptRefresh({ presentedRefreshToken: 'x' }),
    { code: 'SESSION_MISSING' },
    'missing session'
  );
}
{
  // Subject/realm mismatch — session belongs to a different subject.
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession({ subjectId: '507f1f77bcf86cd799439099' }),
    }),
  });
  deepEqual(
    await coordinator.attemptRefresh({ presentedRefreshToken: 'x' }),
    { code: 'SUBJECT_MISMATCH' },
    'subject mismatch on the loaded session'
  );
}
{
  // Realm mismatch — session belongs to a different realm.
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession({ subjectType: 'employer' }),
    }),
  });
  deepEqual(
    await coordinator.attemptRefresh({ presentedRefreshToken: 'x' }),
    { code: 'SUBJECT_MISMATCH' },
    'realm mismatch on the loaded session (same code — a binding failure either way)'
  );
}

// =======================================================================
// Step 4 — session state
// =======================================================================
{
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession({ revokedAt: new Date() }),
    }),
  });
  deepEqual(
    await coordinator.attemptRefresh({ presentedRefreshToken: 'x' }),
    { code: 'SESSION_REVOKED' },
    'revoked session'
  );
}
{
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession({ expiresAt: new Date(Date.now() - 1000) }),
    }),
  });
  deepEqual(
    await coordinator.attemptRefresh({ presentedRefreshToken: 'x' }),
    { code: 'SESSION_EXPIRED' },
    'expired session'
  );
}
{
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession({ tokenVersionAtIssue: 'nope' }),
    }),
  });
  deepEqual(
    await coordinator.attemptRefresh({ presentedRefreshToken: 'x' }),
    { code: 'STORAGE_FAILURE' },
    'malformed session tokenVersionAtIssue'
  );
}

// =======================================================================
// Steps 5/6 — pre-rotation subject eligibility
// =======================================================================
for (const [label, code] of [
  ['missing subject', 'SUBJECT_MISSING'],
  ['inactive subject', 'SUBJECT_INACTIVE'],
  ['malformed subject state', 'SUBJECT_STATE_INVALID'],
  ['tokenVersion mismatch', 'TOKEN_VERSION_MISMATCH'],
]) {
  const rotationCallLog = [];
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({ seed: seedSession() }),
    subjectState: { results: [{ code }] },
    rotationService: createFakeRotationService({
      result: { code: 'ROTATED' },
      callLog: rotationCallLog,
    }),
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'x',
  });
  deepEqual(result, { code }, `pre-rotation ${label} maps to ${code}`);
  equal(
    rotationCallLog.length,
    0,
    `no rotation attempted after pre-rotation ${label}`
  );
}

// =======================================================================
// Step 7 — rotation delegation and pass-through
// =======================================================================
for (const rotationCode of [
  'CONFLICT_BENIGN',
  'REPLAY_DETECTED',
  'SESSION_MISSING',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'VERSION_MISMATCH',
  'STORAGE_FAILURE',
  'CLASSIFICATION_STALE',
]) {
  const cleanupCallLog = [];
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({ seed: seedSession() }),
    rotation: { result: { code: rotationCode } },
    familyRevocationService: createFakeFamilyRevocationService({
      callLog: cleanupCallLog,
    }),
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'x',
  });
  deepEqual(
    result,
    { code: rotationCode },
    `rotation outcome ${rotationCode} is passed through unchanged`
  );
  equal(
    cleanupCallLog.length,
    0,
    `no cleanup call for a non-mismatch rotation outcome (${rotationCode})`
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    `${rotationCode} result carries no extra field`
  );
}

// =======================================================================
// Successful end-to-end rotation
// =======================================================================
{
  const callLog = [];
  const subjectStateProvider = createFakeSubjectStateProvider({
    results: [activeState(3), activeState(3)],
    callLog,
  });
  const coordinator = createRefreshEligibilityCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ callLog }),
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession(),
      callLog,
    }),
    subjectStateProvider,
    rotationService: createFakeRotationService({
      result: { code: 'ROTATED' },
      callLog,
    }),
    familyRevocationService: createFakeFamilyRevocationService({ callLog }),
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'presented-token',
  });
  equal(
    result.code,
    'REFRESH_ROTATED',
    'successful rotation reports REFRESH_ROTATED'
  );
  check(
    typeof result.accessToken === 'string' && result.accessToken.length > 0,
    'success delivers an access token'
  );
  check(
    typeof result.refreshToken === 'string' && result.refreshToken.length > 0,
    'success delivers a refresh token'
  );
  deepEqual(
    Object.keys(result).sort(),
    ['accessToken', 'code', 'refreshToken'],
    'success result carries exactly code, accessToken, refreshToken'
  );

  const order = callLog.map(([name]) => name);
  deepEqual(
    order,
    [
      'verifyRefreshToken',
      'findById',
      'getSubjectState',
      'issueRefreshToken',
      'rotate',
      'getSubjectState',
      'issueAccessToken',
    ],
    'exact call order for a successful rotation'
  );
}

// =======================================================================
// Mandatory post-rotation reread — mismatch cases, each triggering cleanup
// =======================================================================
for (const [label, finalCode] of [
  ['subject deleted after rotation', 'SUBJECT_MISSING'],
  ['subject suspended after rotation', 'SUBJECT_INACTIVE'],
  ['tokenVersion changed after rotation', 'TOKEN_VERSION_MISMATCH'],
  ['malformed final state', 'SUBJECT_STATE_INVALID'],
]) {
  const cleanupCallLog = [];
  const familyRevocationService = createFakeFamilyRevocationService({
    result: { code: 'REVOKED_CURRENT_FAMILY' },
    callLog: cleanupCallLog,
  });
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({ seed: seedSession() }),
    subjectState: { results: [activeState(3), { code: finalCode }] },
    rotation: { result: { code: 'ROTATED' } },
    familyRevocationService,
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'x',
  });
  deepEqual(
    result,
    { code: 'REFRESH_FINAL_STATE_MISMATCH' },
    `${label} yields REFRESH_FINAL_STATE_MISMATCH, no token`
  );
  equal(
    cleanupCallLog.length,
    1,
    `${label} triggers exactly one cleanup attempt`
  );
  const [, cleanupArgs] = cleanupCallLog[0];
  equal(
    cleanupArgs.reason,
    REFRESH_FINAL_STATE_MISMATCH_REVOKE_REASON,
    `${label} cleanup uses the exact SEC-3D.3 reason`
  );
  equal(cleanupArgs.realm, 'user', `${label} cleanup binds realm`);
  equal(cleanupArgs.subjectId, SUBJECT_ID, `${label} cleanup binds subjectId`);
  equal(
    cleanupArgs.sessionFamilyId,
    SID,
    `${label} cleanup binds sessionFamilyId`
  );
}

// =======================================================================
// Indeterminate final reread — STORAGE_FAILURE, thrown exception, unknown
// code, or a malformed result must never be treated as a proven
// eligibility mismatch: no cleanup, no token, fail closed to
// STORAGE_FAILURE only (SEC-3D.3-A correction).
// =======================================================================
for (const [label, finalResultOrThrow] of [
  ['STORAGE_FAILURE', { code: 'STORAGE_FAILURE' }],
  ['unknown/unrecognized code', { code: 'UNEXPECTED_PROVIDER_RESULT' }],
  ['null result', null],
  ['undefined result', undefined],
  ['empty object result', {}],
  ['string result', 'not-an-object'],
]) {
  const callLog = [];
  const subjectStateProvider = createFakeSubjectStateProvider({
    results: [activeState(3), finalResultOrThrow],
    callLog,
  });
  const familyRevocationService = createFakeFamilyRevocationService({
    result: { code: 'REVOKED_CURRENT_FAMILY' },
    callLog,
  });
  const coordinator = createRefreshEligibilityCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ callLog }),
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession(),
      callLog,
    }),
    subjectStateProvider,
    rotationService: createFakeRotationService({
      result: { code: 'ROTATED' },
      callLog,
    }),
    familyRevocationService,
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'x',
  });
  deepEqual(
    result,
    { code: 'STORAGE_FAILURE' },
    `final reread ${label} fails closed to STORAGE_FAILURE, not a proven mismatch`
  );
  check(
    !Object.hasOwn(result, 'accessToken'),
    `final reread ${label}: no access token in the result`
  );
  check(
    !Object.hasOwn(result, 'refreshToken'),
    `final reread ${label}: no refresh token in the result`
  );
  const counts = callLog.reduce((acc, [name]) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  equal(
    counts.revokeCurrentFamily || 0,
    0,
    `final reread ${label}: zero cleanup calls`
  );
  equal(
    counts.issueAccessToken || 0,
    0,
    `final reread ${label}: zero access-token issuance`
  );
  equal(
    counts.verifyRefreshToken,
    1,
    `final reread ${label}: exactly one JWT verification`
  );
  equal(
    counts.findById,
    1,
    `final reread ${label}: exactly one session lookup`
  );
  equal(
    counts.getSubjectState,
    2,
    `final reread ${label}: exactly two subject-state reads (pre and post rotation)`
  );
  equal(
    counts.rotate,
    1,
    `final reread ${label}: exactly one rotation attempt`
  );
  equal(
    counts.issueRefreshToken,
    1,
    `final reread ${label}: exactly one refresh token issued (discarded)`
  );
}

// Final reread throws an exception outright (distinct from returning a
// STORAGE_FAILURE code) — same required fail-closed behavior.
{
  const callLog = [];
  let callIndex = 0;
  const subjectStateProvider = {
    async getSubjectState(args) {
      callIndex += 1;
      callLog.push(['getSubjectState', args]);
      if (callIndex === 1) return activeState(3);
      throw new Error('simulated read failure');
    },
  };
  const familyRevocationService = createFakeFamilyRevocationService({
    result: { code: 'REVOKED_CURRENT_FAMILY' },
    callLog,
  });
  const coordinator = createRefreshEligibilityCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ callLog }),
    refreshSessionModel: createFakeSessionModel({
      seed: seedSession(),
      callLog,
    }),
    subjectStateProvider,
    rotationService: createFakeRotationService({
      result: { code: 'ROTATED' },
      callLog,
    }),
    familyRevocationService,
  });
  let threw = false;
  let result;
  try {
    result = await coordinator.attemptRefresh({ presentedRefreshToken: 'x' });
  } catch {
    threw = true;
  }
  check(
    !threw,
    'a thrown final reread is caught internally, never propagated to the caller'
  );
  deepEqual(
    result,
    { code: 'STORAGE_FAILURE' },
    'a thrown final reread fails closed to STORAGE_FAILURE'
  );
  check(
    !Object.hasOwn(result, 'accessToken'),
    'thrown final reread: no access token'
  );
  check(
    !Object.hasOwn(result, 'refreshToken'),
    'thrown final reread: no refresh token'
  );
  const counts = callLog.reduce((acc, [name]) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  equal(
    counts.revokeCurrentFamily || 0,
    0,
    'thrown final reread: zero cleanup calls'
  );
  equal(
    counts.issueAccessToken || 0,
    0,
    'thrown final reread: zero access-token issuance'
  );
  equal(
    counts.getSubjectState,
    2,
    'thrown final reread: exactly two subject-state read attempts'
  );
  check(
    !('message' in result) && !('stack' in result),
    'thrown final reread: no raw error detail exposed'
  );
}

// =======================================================================
// Cleanup outcome never changes the external result
// =======================================================================
for (const [label, cleanupResult, cleanupThrows] of [
  ['cleanup success', { code: 'REVOKED_CURRENT_FAMILY' }, false],
  ['cleanup already revoked', { code: 'SESSION_ALREADY_REVOKED' }, false],
  ['cleanup storage failure (thrown)', undefined, true],
  ['cleanup storage failure (returned)', { code: 'STORAGE_FAILURE' }, false],
]) {
  const coordinator = buildCoordinator({
    refreshSessionModel: createFakeSessionModel({ seed: seedSession() }),
    subjectState: { results: [activeState(3), { code: 'SUBJECT_INACTIVE' }] },
    rotation: { result: { code: 'ROTATED' } },
    familyRevocationService: createFakeFamilyRevocationService({
      result: cleanupResult,
      throwOn: cleanupThrows,
    }),
  });
  const result = await coordinator.attemptRefresh({
    presentedRefreshToken: 'x',
  });
  deepEqual(
    result,
    { code: 'REFRESH_FINAL_STATE_MISMATCH' },
    `${label}: identical external result regardless of cleanup outcome`
  );
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    `${label}: no token leaks through a mismatch result`
  );
}

// =======================================================================
// Exact call bounds
// =======================================================================
{
  // Pre-rotation failure: findById=1, getSubjectState=1, rotate=0, cleanup=0.
  const callLog = [];
  const subjectStateProvider = createFakeSubjectStateProvider({
    results: [{ code: 'SUBJECT_INACTIVE' }],
    callLog,
  });
  const refreshSessionModel = createFakeSessionModel({
    seed: seedSession(),
    callLog,
  });
  const rotationService = createFakeRotationService({
    result: { code: 'ROTATED' },
    callLog,
  });
  const familyRevocationService = createFakeFamilyRevocationService({
    callLog,
  });
  const coordinator = createRefreshEligibilityCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ callLog }),
    refreshSessionModel,
    subjectStateProvider,
    rotationService,
    familyRevocationService,
  });
  await coordinator.attemptRefresh({ presentedRefreshToken: 'x' });
  const counts = callLog.reduce((acc, [name]) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  equal(counts.findById, 1, 'pre-rotation failure: exactly one session lookup');
  equal(
    counts.getSubjectState,
    1,
    'pre-rotation failure: exactly one subject-state read'
  );
  equal(
    counts.rotate || 0,
    0,
    'pre-rotation failure: rotation never attempted'
  );
  equal(
    counts.revokeCurrentFamily || 0,
    0,
    'pre-rotation failure: no cleanup call'
  );
}
{
  // Mismatch path: findById=1, getSubjectState=2, rotate=1, issueRefreshToken=1, cleanup=1, no issueAccessToken.
  const callLog = [];
  const subjectStateProvider = createFakeSubjectStateProvider({
    results: [activeState(3), { code: 'SUBJECT_INACTIVE' }],
    callLog,
  });
  const refreshSessionModel = createFakeSessionModel({
    seed: seedSession(),
    callLog,
  });
  const rotationService = createFakeRotationService({
    result: { code: 'ROTATED' },
    callLog,
  });
  const familyRevocationService = createFakeFamilyRevocationService({
    callLog,
  });
  const coordinator = createRefreshEligibilityCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ callLog }),
    refreshSessionModel,
    subjectStateProvider,
    rotationService,
    familyRevocationService,
  });
  await coordinator.attemptRefresh({ presentedRefreshToken: 'x' });
  const counts = callLog.reduce((acc, [name]) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  equal(counts.findById, 1, 'mismatch path: exactly one session lookup');
  equal(
    counts.getSubjectState,
    2,
    'mismatch path: exactly two subject-state reads (pre and post rotation)'
  );
  equal(counts.rotate, 1, 'mismatch path: exactly one rotation attempt');
  equal(
    counts.issueRefreshToken,
    1,
    'mismatch path: exactly one refresh token issued (discarded on mismatch)'
  );
  equal(
    counts.issueAccessToken || 0,
    0,
    'mismatch path: access token never issued before final reread succeeds'
  );
  equal(
    counts.revokeCurrentFamily,
    1,
    'mismatch path: exactly one cleanup call'
  );
  check(!counts.rotate || counts.rotate === 1, 'no retry loop on rotation');
}

// =======================================================================
// Sensitive-data non-exposure
// =======================================================================
{
  const cases = [{ presentedRefreshToken: '' }];
  for (const input of cases) {
    const coordinator = buildCoordinator({});
    const result = await coordinator.attemptRefresh(input);
    deepEqual(Object.keys(result), ['code'], 'failure results carry only code');
  }
}

// =======================================================================
// Dormancy
// =======================================================================
{
  const source = await import('node:fs').then((fs) =>
    fs.readFileSync(
      new URL(
        '../services/auth/RefreshEligibilityCoordinator.js',
        import.meta.url
      ),
      'utf8'
    )
  );
  check(
    !/^import .*AccountSecurityMutation/m.test(source),
    'SEC-3D.3 never imports SEC-3D.2'
  );
  check(
    source.includes("from './SessionFamilyRevocationService.js'"),
    'SEC-3D.3 imports SEC-3D.1 only for the cleanup path, as an explicit, expected dependency'
  );
}

console.log(
  `refreshEligibilityCoordinator.test.js: ${assertions} assertions passed`
);
