import assert from 'node:assert/strict';
import mongoose from 'mongoose';

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

/**
 * SEC-3E.1 — see the identical note in `secureAuthConfig.test.js`:
 * importing this module (even transitively, via `secureAccessAuthorization.js`'s
 * own runtime-singleton export at its bottom) triggers `secureAuthConfig.js`'s
 * top-level `buildSecureAuthConfig(process.env)` call. The flag must be set
 * before that happens; a dynamic `import()` (not hoisted) makes that
 * possible from within a single self-contained test file.
 */
process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const { createJwtSessionProvider } =
  await import('../services/auth/JwtSessionProvider.js');
const { createAccessAuthorizationCoordinator } =
  await import('../services/auth/AccessAuthorizationCoordinator.js');
const { createSecureAccessAuthorization } =
  await import('../services/auth/secureAccessAuthorization.js');

const userProvider = createJwtSessionProvider({
  accessSecret: 'a'.repeat(32),
  refreshSecret: 'b'.repeat(32),
  issuer: 'strideto-api',
  accessAudience: 'strideto-user-access',
  refreshAudience: 'strideto-user-refresh',
});
const employerProvider = createJwtSessionProvider({
  accessSecret: 'c'.repeat(32),
  refreshSecret: 'd'.repeat(32),
  issuer: 'strideto-api',
  accessAudience: 'strideto-employer-access',
  refreshAudience: 'strideto-employer-refresh',
});

const USER_ID = '507f1f77bcf86cd799439011';
const EMPLOYER_ID = '507f1f77bcf86cd799439013';
const SID = '507f1f77bcf86cd799439012';

function fakeSubjectStateProvider(state) {
  return {
    async getSubjectState() {
      return state;
    },
  };
}

/** Existing-behavior fake: matches any presented tokenVersion, returns `role` (or null). */
function fakeUserModel(role) {
  return {
    async findOne() {
      if (role === null) return null;
      return { role };
    },
  };
}

function fakeDenylist(denylisted = false, storageFailure = false) {
  return {
    async isJtiDenylisted() {
      if (storageFailure) return { code: 'STORAGE_FAILURE' };
      return { code: 'CHECKED', denylisted };
    },
  };
}

function buildComposition({
  subjectState = { code: 'SUBJECT_ACTIVE', tokenVersion: 0 },
  denylisted = false,
  denylistStorageFailure = false,
  userRole = 'User',
  userModel,
} = {}) {
  const userCoordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: userProvider,
    subjectStateProvider: fakeSubjectStateProvider(subjectState),
  });
  const employerCoordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: employerProvider,
    subjectStateProvider: fakeSubjectStateProvider(subjectState),
  });
  return createSecureAccessAuthorization({
    userJwtProvider: userProvider,
    employerJwtProvider: employerProvider,
    denylistService: fakeDenylist(denylisted, denylistStorageFailure),
    userAccessCoordinator: userCoordinator,
    employerAccessCoordinator: employerCoordinator,
    userModel: userModel || fakeUserModel(userRole),
  });
}

// --- Missing/malformed Authorization header ----------------------------------
{
  const composition = buildComposition();
  const missing = await composition.authorizeRequest({
    authorizationHeader: undefined,
  });
  check(
    missing.code === 'ACCESS_TOKEN_MISSING' && missing.httpStatus === 401,
    'missing header rejected'
  );
  const malformed = await composition.authorizeRequest({
    authorizationHeader: 'Bearer ',
  });
  check(
    malformed.code === 'ACCESS_TOKEN_MISSING',
    'empty bearer token rejected'
  );
}

// --- Successful User authorization, principal attached correctly -------------
{
  const composition = buildComposition({ userRole: 'Admin' });
  const token = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });
  check(result.code === 'ACCESS_AUTHORIZED', 'user token authorized');
  check(result.principal.realm === 'user', 'principal realm=user');
  check(result.principal.subjectId === USER_ID, 'principal subjectId matches');
  check(result.principal.sid === SID, 'principal sid attached');
  check(
    result.principal.role === 'Admin',
    'principal role loaded from the version-bound read'
  );
  check(typeof result.principal.exp === 'number', 'principal exp attached');
  check(
    Object.keys(result.principal).sort().join(',') ===
      'exp,jti,realm,role,sid,subjectId,tokenVersion',
    'principal exposes only the minimal expected fields'
  );
}

// --- Successful Employer authorization, fixed role marker --------------------
{
  const composition = buildComposition();
  const token = employerProvider.issueAccessToken({
    sub: EMPLOYER_ID,
    realm: 'employer',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });
  check(result.code === 'ACCESS_AUTHORIZED', 'employer token authorized');
  check(result.principal.realm === 'employer', 'principal realm=employer');
  check(
    result.principal.role === 'employer',
    'employer role is the fixed realm marker, no DB read needed'
  );
}

// --- Cross-realm rejection: a user token never verifies via the employer provider ---
{
  const composition = buildComposition();
  const userToken = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  assert.throws(() => employerProvider.verifyAccessToken(userToken));
  count += 1;
  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${userToken}`,
  });
  check(
    result.principal.realm === 'user',
    'a genuine user token is never authorized under the employer realm'
  );
}

// --- Malformed/garbage token ---------------------------------------------------
{
  const composition = buildComposition();
  const result = await composition.authorizeRequest({
    authorizationHeader: 'Bearer not-a-real-jwt',
  });
  check(
    result.code === 'ACCESS_TOKEN_INVALID' && result.httpStatus === 401,
    'garbage token rejected'
  );
}

// --- Denylisted jti -------------------------------------------------------------
{
  const composition = buildComposition({ denylisted: true });
  const token = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });
  check(
    result.code === 'ACCESS_DENYLISTED' && result.httpStatus === 401,
    'denylisted jti rejected before authorization'
  );
}

// --- Denylist storage failure fails closed --------------------------------------
{
  const composition = buildComposition({ denylistStorageFailure: true });
  const token = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });
  check(
    result.code === 'ACCESS_STORAGE_FAILURE' && result.httpStatus === 503,
    'denylist storage failure fails closed, never authorized'
  );
}

// --- Subject inactive / version mismatch / storage failure pass through -------
{
  const inactive = buildComposition({
    subjectState: { code: 'SUBJECT_INACTIVE' },
  });
  const token1 = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const r1 = await inactive.authorizeRequest({
    authorizationHeader: `Bearer ${token1}`,
  });
  check(
    r1.code === 'ACCESS_SUBJECT_INACTIVE' && r1.httpStatus === 401,
    'inactive subject rejected'
  );

  const mismatch = buildComposition({
    subjectState: { code: 'TOKEN_VERSION_MISMATCH' },
  });
  const token2 = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const r2 = await mismatch.authorizeRequest({
    authorizationHeader: `Bearer ${token2}`,
  });
  check(
    r2.code === 'ACCESS_VERSION_MISMATCH' && r2.httpStatus === 401,
    'stale tokenVersion rejected'
  );

  const storageFailure = buildComposition({
    subjectState: { code: 'STORAGE_FAILURE' },
  });
  const token3 = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const r3 = await storageFailure.authorizeRequest({
    authorizationHeader: `Bearer ${token3}`,
  });
  check(
    r3.code === 'ACCESS_STORAGE_FAILURE' && r3.httpStatus === 503,
    'subject-state storage failure maps to 503, never authorized'
  );
}

// --- No sensitive data ever leaked in a failure body -----------------------------
{
  const composition = buildComposition({ denylisted: true });
  const token = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;
  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });
  const bodyText = JSON.stringify(result.body);
  check(!bodyText.includes(USER_ID), 'no subject id leaked in body');
  check(!bodyText.includes(token), 'no raw token leaked in body');
}

// =================================================================================
// SEC-3E.1 — role-authority race correction: deterministic interleaving tests.
// The role query MUST be bound to both subject ID and the exact verified
// tokenVersion, in the same database read, so a role change that races
// ahead of (or behind) that already-authorized version can never be
// attached to the request that was authorized against the older version.
// =================================================================================

// --- Promotion between authorization reads: version-bound query finds no document ---
{
  // Coordinator authorizes tokenVersion=0 (its own read observed 0).
  const subjectStateProvider = fakeSubjectStateProvider({
    code: 'SUBJECT_ACTIVE',
    tokenVersion: 0,
  });
  const userCoordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: userProvider,
    subjectStateProvider,
  });

  const queryCalls = [];
  const userModel = {
    async findOne(filter, projection) {
      queryCalls.push({ filter, projection });
      // Real DB state: the promotion has ALREADY committed by the time
      // this query runs — role=Admin AND tokenVersion=1. A query
      // requiring the exact already-authorized tokenVersion (0) must
      // therefore find nothing.
      if (filter.tokenVersion === 0) return null;
      return { role: 'Admin' };
    },
  };

  const composition = createSecureAccessAuthorization({
    userJwtProvider: userProvider,
    employerJwtProvider: employerProvider,
    denylistService: fakeDenylist(),
    userAccessCoordinator: userCoordinator,
    userModel,
  });

  const oldToken = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;

  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${oldToken}`,
  });

  check(
    result.code !== 'ACCESS_AUTHORIZED',
    'old token is not authorized when the role query misses on version'
  );
  check(
    result.code === 'ACCESS_VERSION_MISMATCH',
    'result is the exact stale-authorization code'
  );
  check(result.httpStatus === 401, 'safe 401 result');
  check(!('principal' in result), 'no principal attached');
  check(queryCalls.length === 1, 'exactly one role query attempted');
  check(
    queryCalls[0].filter._id === USER_ID,
    'query filter contains the exact subject ID'
  );
  check(
    queryCalls[0].filter.tokenVersion === 0,
    'query filter contains the exact verified tokenVersion'
  );
  check(
    JSON.stringify(queryCalls[0].projection) === JSON.stringify({ role: 1 }),
    'query projects only role'
  );
}

// --- Promotion strictly after the role snapshot: current request keeps the old role ---
{
  const subjectStateProvider = fakeSubjectStateProvider({
    code: 'SUBJECT_ACTIVE',
    tokenVersion: 0,
  });
  const userCoordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: userProvider,
    subjectStateProvider,
  });

  // The version-bound role query itself observes the pre-promotion state
  // (role=User, tokenVersion still 0 at the moment of THIS read) — the
  // promotion, in this scenario, commits only after this read returns.
  const userModel = {
    async findOne(filter) {
      if (filter.tokenVersion === 0) return { role: 'User' };
      return { role: 'Admin' };
    },
  };

  const composition = createSecureAccessAuthorization({
    userJwtProvider: userProvider,
    employerJwtProvider: employerProvider,
    denylistService: fakeDenylist(),
    userAccessCoordinator: userCoordinator,
    userModel,
  });

  const token = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;

  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });

  check(
    result.code === 'ACCESS_AUTHORIZED',
    'authorized using the pre-promotion snapshot'
  );
  check(
    result.principal.role === 'User',
    'the current request never acquires Admin, even though a promotion is imminent'
  );
  check(result.principal.role !== 'Admin', 'explicitly never Admin');
}

// --- Demotion before the role lookup: coordinator itself rejects on stale version ---
{
  // Demotion already committed: authoritative tokenVersion is now 1.
  const subjectStateProvider = {
    async getSubjectState({ expectedTokenVersion }) {
      if (expectedTokenVersion === 1)
        return { code: 'SUBJECT_ACTIVE', tokenVersion: 1 };
      return { code: 'TOKEN_VERSION_MISMATCH' };
    },
  };
  const userCoordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: userProvider,
    subjectStateProvider,
  });

  let roleQueryCalls = 0;
  const userModel = {
    async findOne() {
      roleQueryCalls += 1;
      return { role: 'User' };
    },
  };

  const composition = createSecureAccessAuthorization({
    userJwtProvider: userProvider,
    employerJwtProvider: employerProvider,
    denylistService: fakeDenylist(),
    userAccessCoordinator: userCoordinator,
    userModel,
  });

  // Old token issued while tokenVersion was still 0 (subject was Admin then).
  const oldAdminToken = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;

  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${oldAdminToken}`,
  });

  check(
    result.code === 'ACCESS_VERSION_MISMATCH',
    'demoted-old-token rejected at the coordinator step'
  );
  check(result.httpStatus === 401, 'safe 401 result');
  check(!('principal' in result), 'no principal attached');
  check(
    roleQueryCalls === 0,
    'the role query is never reached at all once the coordinator itself already rejects — the earlier, cheaper check short-circuits'
  );
}

// --- Role query storage failure: safe 503, no principal, no role, no raw error ----
{
  const subjectStateProvider = fakeSubjectStateProvider({
    code: 'SUBJECT_ACTIVE',
    tokenVersion: 0,
  });
  const userCoordinator = createAccessAuthorizationCoordinator({
    jwtSessionProvider: userProvider,
    subjectStateProvider,
  });
  const userModel = {
    async findOne() {
      throw new Error(
        'connection reset by peer — must never leak into the response'
      );
    },
  };
  const composition = createSecureAccessAuthorization({
    userJwtProvider: userProvider,
    employerJwtProvider: employerProvider,
    denylistService: fakeDenylist(),
    userAccessCoordinator: userCoordinator,
    userModel,
  });
  const token = userProvider.issueAccessToken({
    sub: USER_ID,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  }).token;

  const result = await composition.authorizeRequest({
    authorizationHeader: `Bearer ${token}`,
  });

  check(
    result.code === 'ACCESS_STORAGE_FAILURE',
    'query throw maps to the exact storage-failure code'
  );
  check(result.httpStatus === 503, 'safe 503 result');
  check(!('principal' in result), 'no principal attached on storage failure');
  check(
    !('role' in (result.principal || {})),
    'no role attached on storage failure'
  );
  check(
    !JSON.stringify(result).includes('connection reset'),
    'no raw error text leaked into the result'
  );
}

console.log(`secureAccessAuthorization.test.js: ${count} assertions passed`);
