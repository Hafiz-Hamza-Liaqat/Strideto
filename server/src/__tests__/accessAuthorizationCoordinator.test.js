/**
 * SEC-3D.4 — dormant access-authorization coordinator tests, against
 * injected doubles (no live MongoDB connection).
 * Run: node src/__tests__/accessAuthorizationCoordinator.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createAccessAuthorizationCoordinator } from '../services/auth/AccessAuthorizationCoordinator.js';
import { ACCESS_AUTHORIZATION_RESULT_CODES } from '../services/auth/AccessAuthorizationContracts.js';

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

function createFakeJwtSessionProvider({ throwOnVerify = false, claims } = {}) {
  const calls = [];
  return {
    verifyAccessToken(token) {
      calls.push(token);
      if (throwOnVerify) throw new Error('invalid token');
      return claims;
    },
    calls,
  };
}

function createFakeSubjectStateProvider({ result, throwOn = false } = {}) {
  const calls = [];
  return {
    async getSubjectState(args) {
      calls.push(args);
      if (throwOn) throw new Error('unexpected');
      return result;
    },
    calls,
  };
}

function validClaims(overrides = {}) {
  return {
    sub: SUBJECT_ID,
    realm: 'user',
    sid: 'sid-1',
    jti: 'jti-1',
    tokenVersion: 4,
    ...overrides,
  };
}

// =======================================================================
// Contract module
// =======================================================================
{
  equal(
    ACCESS_AUTHORIZATION_RESULT_CODES.length,
    6,
    'exactly six result codes'
  );
  equal(
    new Set(ACCESS_AUTHORIZATION_RESULT_CODES).size,
    6,
    'every result code is unique'
  );
  check(
    Object.isFrozen(ACCESS_AUTHORIZATION_RESULT_CODES),
    'result codes frozen'
  );
  check(
    !ACCESS_AUTHORIZATION_RESULT_CODES.includes('ACCESS_DENYLISTED'),
    "ACCESS_DENYLISTED is not part of this coordinator's own result set"
  );
}

// =======================================================================
// Construction validation
// =======================================================================
{
  throwsType(
    () => createAccessAuthorizationCoordinator({}),
    'missing jwtSessionProvider throws'
  );
  throwsType(
    () => createAccessAuthorizationCoordinator({ jwtSessionProvider: {} }),
    'jwtSessionProvider without verifyAccessToken throws'
  );
  throwsType(
    () =>
      createAccessAuthorizationCoordinator({
        jwtSessionProvider: createFakeJwtSessionProvider({
          claims: validClaims(),
        }),
        subjectStateProvider: {},
      }),
    'invalid subjectStateProvider throws'
  );
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ claims: validClaims() }),
    subjectStateProvider: createFakeSubjectStateProvider({
      result: { code: 'SUBJECT_ACTIVE', tokenVersion: 4 },
    }),
  });
  check(
    typeof coordinator.authorize === 'function',
    'construction succeeds and exposes authorize'
  );
}

// =======================================================================
// Input validation
// =======================================================================
{
  const jwt = createFakeJwtSessionProvider({ claims: validClaims() });
  const subjectState = createFakeSubjectStateProvider({
    result: { code: 'SUBJECT_ACTIVE' },
  });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: jwt,
    subjectStateProvider: subjectState,
  });
  deepEqual(
    await coordinator.authorize({ presentedAccessToken: '' }),
    { code: 'INVALID_INPUT' },
    'empty token is invalid input'
  );
  deepEqual(
    await coordinator.authorize({}),
    { code: 'INVALID_INPUT' },
    'missing token field is invalid input'
  );
  equal(jwt.calls.length, 0, 'no JWT verification attempted for invalid input');
  equal(
    subjectState.calls.length,
    0,
    'no subject-state read attempted for invalid input'
  );
}

// =======================================================================
// Invalid access JWT / malformed claims
// =======================================================================
{
  const subjectState = createFakeSubjectStateProvider({
    result: { code: 'SUBJECT_ACTIVE' },
  });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ throwOnVerify: true }),
    subjectStateProvider: subjectState,
  });
  deepEqual(
    await coordinator.authorize({ presentedAccessToken: 'garbage' }),
    { code: 'ACCESS_TOKEN_INVALID' },
    'invalid JWT rejected'
  );
  equal(
    subjectState.calls.length,
    0,
    'no subject-state read attempted after a JWT verification failure'
  );
}

// =======================================================================
// Realm coverage — User and Employer
// =======================================================================
for (const realm of ['user', 'employer']) {
  const subjectState = createFakeSubjectStateProvider({
    result: { code: 'SUBJECT_ACTIVE', tokenVersion: 4 },
  });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({
      claims: validClaims({ realm }),
    }),
    subjectStateProvider: subjectState,
  });
  const result = await coordinator.authorize({ presentedAccessToken: 'token' });
  deepEqual(
    result,
    { code: 'ACCESS_AUTHORIZED' },
    `${realm} realm authorizes successfully`
  );
  equal(
    subjectState.calls[0].realm,
    realm,
    `${realm} realm is passed through to the authoritative read, exactly as claimed`
  );
}

// =======================================================================
// Cross-realm isolation — the coordinator never infers realm from
// whichever model happens to return a document; it uses only the
// verified claim.
// =======================================================================
{
  const subjectState = createFakeSubjectStateProvider({
    result: { code: 'SUBJECT_ACTIVE', tokenVersion: 4 },
  });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({
      claims: validClaims({ realm: 'employer' }),
    }),
    subjectStateProvider: subjectState,
  });
  await coordinator.authorize({ presentedAccessToken: 'token' });
  equal(
    subjectState.calls[0].realm,
    'employer',
    'a User-claimed token never authorizes against the Employer realm and vice versa — the exact claimed realm is always used'
  );
  equal(
    subjectState.calls.length,
    1,
    'exactly one authoritative read for the whole call'
  );
}

// =======================================================================
// Subject-state outcomes
// =======================================================================
for (const [providerCode, expectedCode] of [
  ['SUBJECT_MISSING', 'ACCESS_SUBJECT_INACTIVE'],
  ['SUBJECT_INACTIVE', 'ACCESS_SUBJECT_INACTIVE'],
  ['SUBJECT_STATE_INVALID', 'ACCESS_SUBJECT_INACTIVE'],
  ['TOKEN_VERSION_MISMATCH', 'ACCESS_VERSION_MISMATCH'],
  ['STORAGE_FAILURE', 'ACCESS_STORAGE_FAILURE'],
]) {
  const subjectState = createFakeSubjectStateProvider({
    result: { code: providerCode },
  });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ claims: validClaims() }),
    subjectStateProvider: subjectState,
  });
  const result = await coordinator.authorize({ presentedAccessToken: 'token' });
  deepEqual(
    result,
    { code: expectedCode },
    `provider ${providerCode} maps to ${expectedCode}`
  );
  deepEqual(
    Object.keys(result),
    ['code'],
    `${expectedCode} result carries only a code`
  );
}

// Exact tokenVersion match (already covered by the ACCESS_AUTHORIZED case
// above) — additionally confirm tokenVersion 0 is a legitimate, accepted
// claim value (not mistaken for "missing"/falsy).
{
  const subjectState = createFakeSubjectStateProvider({
    result: { code: 'SUBJECT_ACTIVE', tokenVersion: 0 },
  });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({
      claims: validClaims({ tokenVersion: 0 }),
    }),
    subjectStateProvider: subjectState,
  });
  const result = await coordinator.authorize({ presentedAccessToken: 'token' });
  deepEqual(
    result,
    { code: 'ACCESS_AUTHORIZED' },
    'tokenVersion 0 authorizes correctly, not mistaken for a missing/falsy value'
  );
  equal(
    subjectState.calls[0].expectedTokenVersion,
    0,
    'expectedTokenVersion 0 is passed through exactly'
  );
}

// Provider throws unexpectedly (defensive) — fails closed, never authorized.
{
  const subjectState = createFakeSubjectStateProvider({ throwOn: true });
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ claims: validClaims() }),
    subjectStateProvider: subjectState,
  });
  let threw = false;
  let result;
  try {
    result = await coordinator.authorize({ presentedAccessToken: 'token' });
  } catch {
    threw = true;
  }
  // The coordinator itself does not wrap this provider call in a
  // try/catch, since SessionSubjectStateProvider's own accepted contract
  // never throws (STORAGE_FAILURE is always returned, not thrown) — this
  // test documents that reliance explicitly rather than assuming it.
  check(
    threw || (result && result.code !== 'ACCESS_AUTHORIZED'),
    'an unexpected provider throw never results in ACCESS_AUTHORIZED'
  );
}

// =======================================================================
// No cache, no reuse of a prior decision — every call reads fresh
// =======================================================================
{
  let callCount = 0;
  const subjectState = {
    async getSubjectState() {
      callCount += 1;
      return callCount === 1
        ? { code: 'SUBJECT_ACTIVE', tokenVersion: 4 }
        : { code: 'SUBJECT_INACTIVE' };
    },
  };
  const coordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: createFakeJwtSessionProvider({ claims: validClaims() }),
    subjectStateProvider: subjectState,
  });
  const first = await coordinator.authorize({ presentedAccessToken: 'token' });
  const second = await coordinator.authorize({ presentedAccessToken: 'token' });
  deepEqual(first, { code: 'ACCESS_AUTHORIZED' }, 'first call authorized');
  deepEqual(
    second,
    { code: 'ACCESS_SUBJECT_INACTIVE' },
    'second call, same token, reflects the fresh state — no cached allow'
  );
  equal(callCount, 2, 'each call performs its own fresh authoritative read');
}

// =======================================================================
// No dependency on the denylist, Redis, or RefreshSession
// =======================================================================
{
  const source = await import('node:fs').then((fs) =>
    fs.readFileSync(
      new URL(
        '../services/auth/AccessAuthorizationCoordinator.js',
        import.meta.url
      ),
      'utf8'
    )
  );
  const importLines = source
    .split('\n')
    .filter((line) => line.trim().startsWith('import '));
  check(
    !importLines.some((line) => /tokenStore/.test(line)),
    'no import of utils/tokenStore.js'
  );
  check(
    !importLines.some((line) => /config\/redis/.test(line)),
    'no import of config/redis.js'
  );
  check(
    !importLines.some((line) => /RefreshSession/.test(line)),
    'no import of the RefreshSession model or any of its services'
  );
  check(
    !importLines.some((line) => /AccountSecurityMutation/.test(line)),
    'no import of SEC-3D.2'
  );
  check(
    !importLines.some((line) => /SessionFamilyRevocation/.test(line)),
    'no import of SEC-3D.1'
  );
  check(
    !importLines.some((line) => /ioredis/i.test(line)),
    'no direct Redis client import'
  );
}

console.log(
  `accessAuthorizationCoordinator.test.js: ${assertions} assertions passed`
);
