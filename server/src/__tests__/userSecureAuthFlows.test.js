import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * SEC-3E.1 — see the identical note in `secureAuthConfig.test.js`:
 * `userSecureAuthFlows.js` imports `secureAuthConfig.js` for its own
 * runtime-singleton export, which now requires the flag to be set
 * explicitly before that import evaluates.
 */
process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const { createUserSecureAuthFlows } =
  await import('../services/auth/userSecureAuthFlows.js');

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

const SUBJECT_ID = '507f1f77bcf86cd799439011';
const SID = '507f1f77bcf86cd799439012';
const JTI = 'jti-abc';

function fakeJwtProvider() {
  return { issueAccessToken: () => ({ token: 'access-token' }) };
}

function trustingOrigin(trusted = true) {
  return {
    evaluateRequestOrigin: () => ({
      code: trusted ? 'ORIGIN_TRUSTED' : 'ORIGIN_UNTRUSTED',
    }),
  };
}

function fakeIssuance(result) {
  const calls = [];
  return {
    calls,
    async issueInitialSession(args) {
      calls.push(args);
      return result;
    },
  };
}

function fakeRefreshCoordinator(result) {
  const calls = [];
  return {
    calls,
    async attemptRefresh(args) {
      calls.push(args);
      return result;
    },
  };
}

function fakeFamilyRevocation(
  revokeResult = { code: 'REVOKED_CURRENT_FAMILY' },
  allResult = { code: 'REVOKED_ALL_FAMILIES', revokedCount: 1 }
) {
  const calls = [];
  return {
    calls,
    async revokeCurrentFamily(args) {
      calls.push(['current', args]);
      return revokeResult;
    },
    async revokeAllFamilies(args) {
      calls.push(['all', args]);
      return allResult;
    },
  };
}

function fakeAccountSecurityMutation(overrides = {}) {
  const calls = [];
  return {
    calls,
    async incrementTokenVersionForLogoutAll(args) {
      calls.push(['logoutAll', args]);
      return overrides.logoutAll || { code: 'VERSION_INCREMENTED' };
    },
    async changePassword(args) {
      calls.push(['changePassword', args]);
      return overrides.changePassword || { code: 'VERSION_INCREMENTED' };
    },
    async resetPassword(args) {
      calls.push(['resetPassword', args]);
      return overrides.resetPassword || { code: 'VERSION_INCREMENTED' };
    },
    async suspend(args) {
      calls.push(['suspend', args]);
      return overrides.suspend || { code: 'SUBJECT_STATE_UPDATED' };
    },
    async reactivate(args) {
      calls.push(['reactivate', args]);
      return overrides.reactivate || { code: 'SUBJECT_STATE_UPDATED' };
    },
    async changeRole(args) {
      calls.push(['changeRole', args]);
      return overrides.changeRole || { code: 'SUBJECT_STATE_UPDATED' };
    },
  };
}

function fakeDenylist(
  result = { code: 'DENYLISTED' },
  availability = { code: 'AVAILABLE' }
) {
  const calls = [];
  const availabilityCalls = [];
  return {
    calls,
    availabilityCalls,
    async assertAvailable() {
      availabilityCalls.push(true);
      return availability;
    },
    async denylistJti(jti, ttl) {
      calls.push([jti, ttl]);
      return result;
    },
  };
}

function fakeUserModel(preReadResult = null) {
  return {
    async findOne() {
      return preReadResult;
    },
  };
}

function buildFlows(overrides = {}) {
  return createUserSecureAuthFlows({
    jwtProvider: fakeJwtProvider(),
    originPolicy: overrides.originPolicy || trustingOrigin(true),
    initialSessionIssuanceService:
      overrides.issuance ||
      fakeIssuance({
        code: 'SESSION_ISSUED',
        sid: SID,
        accessToken: 'a',
        refreshToken: 'r',
      }),
    refreshEligibilityCoordinator:
      overrides.refreshCoordinator ||
      fakeRefreshCoordinator({
        code: 'REFRESH_ROTATED',
        accessToken: 'a2',
        refreshToken: 'r2',
      }),
    sessionFamilyRevocationService:
      overrides.familyRevocation || fakeFamilyRevocation(),
    accountSecurityMutationService:
      overrides.accountSecurityMutation || fakeAccountSecurityMutation(),
    denylistService: overrides.denylist || fakeDenylist(),
    userModel: overrides.userModel || fakeUserModel(),
  });
}

// --- issueLoginSession ---------------------------------------------------------
{
  const flows = buildFlows();
  const result = await flows.issueLoginSession({
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(
    result.code === 'SESSION_ISSUED' && result.httpStatus === 200,
    'login session issued'
  );
  check(
    result.accessToken === 'a' && result.refreshToken === 'r',
    'tokens passed through'
  );

  const failing = buildFlows({
    issuance: fakeIssuance({ code: 'STORAGE_FAILURE' }),
  });
  const failResult = await failing.issueLoginSession({
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(failResult.httpStatus === 503, 'issuance failure maps to 503');
}

// --- issueLoginSession: required Redis unavailable before issuance -----------
{
  const issuance = fakeIssuance({
    code: 'SESSION_ISSUED',
    accessToken: 'must-not-escape',
    refreshToken: 'must-not-escape',
  });
  const denylist = fakeDenylist(
    { code: 'DENYLISTED' },
    { code: 'STORAGE_FAILURE' }
  );
  const flows = buildFlows({ issuance, denylist });
  const result = await flows.issueLoginSession({
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(
    result.code === 'STORAGE_FAILURE' && result.httpStatus === 503,
    'Redis outage maps User initial issuance to safe 503'
  );
  check(
    result.body?.error === 'Service temporarily unavailable',
    'User issuance reuses the existing safe public error'
  );
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    'User outage result contains no authenticated credential'
  );
  check(
    issuance.calls.length === 0,
    'User token signing and RefreshSession creation are never reached'
  );
}

// --- refresh: origin rejection --------------------------------------------------
{
  const flows = buildFlows({ originPolicy: trustingOrigin(false) });
  const result = await flows.refresh({
    cookieToken: 'x',
    origin: 'https://evil.example',
  });
  check(
    result.code === 'ORIGIN_VALIDATION_FAILED' && result.httpStatus === 403,
    'untrusted origin rejected on refresh'
  );
}

// --- refresh: missing cookie -----------------------------------------------------
{
  const flows = buildFlows();
  const result = await flows.refresh({ cookieToken: null });
  check(
    result.code === 'REFRESH_TOKEN_INVALID' && result.clearCookie === true,
    'missing cookie treated as invalid, cookie cleared'
  );
}

// --- refresh: rotated success -----------------------------------------------------
{
  const flows = buildFlows();
  const result = await flows.refresh({ cookieToken: 'rt' });
  check(
    result.code === 'REFRESH_ROTATED' && result.httpStatus === 200,
    'rotation success'
  );
  check(
    result.accessToken === 'a2' && result.refreshToken === 'r2',
    'rotated tokens returned'
  );
  check(
    result.clearCookie === false,
    'winning rotation never clears the cookie'
  );
}

// --- refresh: required Redis unavailable before any session mutation ---------
{
  const refreshCoordinator = fakeRefreshCoordinator({
    code: 'REFRESH_ROTATED',
    accessToken: 'must-not-escape',
    refreshToken: 'must-not-escape',
  });
  const familyRevocation = fakeFamilyRevocation();
  const denylist = fakeDenylist(
    { code: 'DENYLISTED' },
    { code: 'STORAGE_FAILURE' }
  );
  const flows = buildFlows({ refreshCoordinator, familyRevocation, denylist });
  const result = await flows.refresh({ cookieToken: 'unchanged-cookie' });
  check(
    result.code === 'STORAGE_FAILURE' && result.httpStatus === 503,
    'Redis outage maps User refresh to safe 503'
  );
  check(result.clearCookie === false, 'transient outage preserves the User cookie');
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    'User outage refresh issues no credential'
  );
  check(
    refreshCoordinator.calls.length === 0,
    'User rotation and token generation are never reached'
  );
  check(
    familyRevocation.calls.length === 0,
    'User outage performs no revoke or family mutation'
  );
}

// --- refresh: benign conflict never clears the winner's cookie -------------------
{
  const flows = buildFlows({
    refreshCoordinator: fakeRefreshCoordinator({ code: 'CONFLICT_BENIGN' }),
  });
  const result = await flows.refresh({ cookieToken: 'rt' });
  check(
    result.code === 'CONFLICT_BENIGN' && result.httpStatus === 409,
    'benign conflict returns 409'
  );
  check(
    result.clearCookie === false,
    'benign conflict never clears the cookie'
  );
  check(result.retryAfterSeconds === 1, 'exact Retry-After value');
}

// --- refresh: terminal failures clear the cookie, transient ones do not ----------
{
  const revoked = buildFlows({
    refreshCoordinator: fakeRefreshCoordinator({ code: 'SESSION_REVOKED' }),
  });
  const r1 = await revoked.refresh({ cookieToken: 'rt' });
  check(r1.clearCookie === true, 'terminal SESSION_REVOKED clears the cookie');

  const storageFailure = buildFlows({
    refreshCoordinator: fakeRefreshCoordinator({ code: 'STORAGE_FAILURE' }),
  });
  const r2 = await storageFailure.refresh({ cookieToken: 'rt' });
  check(
    r2.clearCookie === false,
    'transient STORAGE_FAILURE never clears the cookie'
  );
  check(r2.httpStatus === 503, 'storage failure maps to 503');
}

// --- logoutCurrent: success --------------------------------------------------------
{
  const familyRevocation = fakeFamilyRevocation();
  const denylist = fakeDenylist();
  const flows = buildFlows({ familyRevocation, denylist });
  const principal = { subjectId: SUBJECT_ID, sid: SID, jti: JTI };
  const result = await flows.logoutCurrent({
    principal,
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(
    result.code === 'LOGGED_OUT' && result.clearCookie === true,
    'logout succeeds and clears cookie'
  );
  check(
    familyRevocation.calls[0][1].reason === 'logout',
    'exact revoke reason'
  );
  check(
    familyRevocation.calls[0][1].sessionFamilyId === SID,
    'exact family bound by sid'
  );
  check(denylist.calls[0][0] === JTI, 'denylist keyed by jti');
}

// --- logoutCurrent: partial failure fails closed, never reports success ------------
{
  const familyRevocation = fakeFamilyRevocation({ code: 'STORAGE_FAILURE' });
  const flows = buildFlows({ familyRevocation });
  const principal = { subjectId: SUBJECT_ID, sid: SID, jti: JTI };
  const result = await flows.logoutCurrent({
    principal,
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(
    result.code === 'LOGOUT_PARTIAL_FAILURE' && result.httpStatus === 503,
    'partial failure never reports success'
  );
  check(
    result.clearCookie === false,
    'partial failure does not clear the cookie'
  );
}

// --- logoutAll: tokenVersion first, sweep second ------------------------------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ accountSecurityMutation, familyRevocation });
  const principal = {
    subjectId: SUBJECT_ID,
    sid: SID,
    jti: JTI,
    tokenVersion: 0,
  };
  const result = await flows.logoutAll({
    principal,
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(result.code === 'LOGGED_OUT_ALL', 'logout-all succeeds');
  check(
    accountSecurityMutation.calls[0][0] === 'logoutAll',
    'tokenVersion mutation called first'
  );
  check(
    familyRevocation.calls[0][0] === 'all',
    'family sweep called after version mutation'
  );
  check(
    familyRevocation.calls[0][1].reason === 'logout_all',
    'exact revoke reason for logout-all'
  );
}

// --- logoutAll: version mutation failure fails closed, sweep never runs ------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation({
    logoutAll: { code: 'STORAGE_FAILURE' },
  });
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ accountSecurityMutation, familyRevocation });
  const principal = {
    subjectId: SUBJECT_ID,
    sid: SID,
    jti: JTI,
    tokenVersion: 0,
  };
  const result = await flows.logoutAll({
    principal,
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(
    result.code === 'LOGOUT_ALL_FAILED' && result.httpStatus === 503,
    'version failure fails closed'
  );
  check(
    familyRevocation.calls.length === 0,
    'sweep never runs when the authoritative mutation fails'
  );
}

// --- changePassword: success then cleanup ------------------------------------------
{
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ familyRevocation });
  const principal = { subjectId: SUBJECT_ID, tokenVersion: 0, jti: JTI };
  const result = await flows.changePassword({
    principal,
    newPassword: 'NewPassw0rd!',
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(
    result.code === 'PASSWORD_CHANGED' && result.clearCookie === true,
    'password change succeeds and clears cookie'
  );
  check(
    familyRevocation.calls[0][1].reason === 'password_change',
    'exact revoke reason'
  );
}

// --- resetPassword: uniform response regardless of internal outcome ----------------
{
  const familyRevocation = fakeFamilyRevocation();
  const userModel = fakeUserModel({ _id: SUBJECT_ID });
  const flows = buildFlows({ familyRevocation, userModel });
  const success = await flows.resetPassword({
    hashedToken: 'x'.repeat(64),
    newPassword: 'NewPassw0rd!',
  });
  check(
    success.code === 'RESET_ATTEMPTED' && success.httpStatus === 200,
    'reset returns the uniform response on success'
  );
  check(
    familyRevocation.calls[0][1].reason === 'password_reset',
    'exact revoke reason on successful reset'
  );

  const accountSecurityMutation = fakeAccountSecurityMutation({
    resetPassword: { code: 'RESET_TOKEN_INVALID' },
  });
  const noUserModel = fakeUserModel(null);
  const failFlows = buildFlows({
    accountSecurityMutation,
    familyRevocation: fakeFamilyRevocation(),
    userModel: noUserModel,
  });
  const failure = await failFlows.resetPassword({
    hashedToken: 'x'.repeat(64),
    newPassword: 'NewPassw0rd!',
  });
  check(
    failure.code === 'RESET_ATTEMPTED' && failure.httpStatus === 200,
    'reset returns the identical uniform response on failure — never reveals whether a subject existed'
  );
}

// --- admin-mutation delegations -----------------------------------------------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ accountSecurityMutation, familyRevocation });

  const suspendResult = await flows.suspendUser({ subjectId: SUBJECT_ID });
  check(
    suspendResult.code === 'SUBJECT_STATE_UPDATED',
    'suspend delegates to the primitive'
  );
  check(
    familyRevocation.calls.some(
      ([kind, args]) => kind === 'all' && args.reason === 'account_suspended'
    ),
    'suspend sweeps all families with the exact reason'
  );

  const reactivateResult = await flows.reactivateUser({
    subjectId: SUBJECT_ID,
  });
  check(
    reactivateResult.code === 'SUBJECT_STATE_UPDATED',
    'reactivate delegates to the primitive'
  );

  const roleResult = await flows.changeUserRole({
    subjectId: SUBJECT_ID,
    expectedPriorRole: 'User',
    newRole: 'Admin',
  });
  check(
    roleResult.code === 'SUBJECT_STATE_UPDATED',
    'role change delegates to the primitive'
  );
  check(
    familyRevocation.calls.some(
      ([kind, args]) => kind === 'all' && args.reason === 'role_changed'
    ),
    'role change sweeps all User refresh families'
  );
}

// --- role change: Redis failure precedes account and session mutation -------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({
    accountSecurityMutation,
    familyRevocation,
    denylist: fakeDenylist(
      { code: 'DENYLISTED' },
      { code: 'STORAGE_FAILURE' }
    ),
  });
  const result = await flows.changeUserRole({
    subjectId: SUBJECT_ID,
    expectedPriorRole: 'Admin',
    newRole: 'SuperAdmin',
  });
  check(
    result.code === 'STORAGE_FAILURE',
    'role change fails closed without Redis'
  );
  check(
    accountSecurityMutation.calls.length === 0,
    'failed Redis gate prevents role mutation'
  );
  check(
    familyRevocation.calls.length === 0,
    'failed Redis gate prevents session mutation'
  );
}

console.log(`userSecureAuthFlows.test.js: ${count} assertions passed`);
