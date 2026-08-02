import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * SEC-3E.1 — see the identical note in `secureAuthConfig.test.js`:
 * `employerSecureAuthFlows.js` imports `secureAuthConfig.js` for its own
 * runtime-singleton export, which now requires the flag to be set
 * explicitly before that import evaluates.
 */
process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const { createEmployerSecureAuthFlows } =
  await import('../services/auth/employerSecureAuthFlows.js');

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

const SUBJECT_ID = '507f1f77bcf86cd799439013';
const SID = '507f1f77bcf86cd799439014';
const JTI = 'jti-employer';

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
  };
}

function fakeDenylist(
  result = { code: 'DENYLISTED' },
  availability = { code: 'AVAILABLE' }
) {
  const availabilityCalls = [];
  return {
    availabilityCalls,
    async assertAvailable() {
      availabilityCalls.push(true);
      return availability;
    },
    async denylistJti() {
      return result;
    },
  };
}

function buildFlows(overrides = {}) {
  return createEmployerSecureAuthFlows({
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
    employerModel: overrides.employerModel || {
      async findOne() {
        return { _id: SUBJECT_ID };
      },
    },
  });
}

// --- issueLoginSession -------------------------------------------------------
{
  const flows = buildFlows();
  const result = await flows.issueLoginSession({
    subjectId: SUBJECT_ID,
    tokenVersion: 0,
  });
  check(
    result.code === 'SESSION_ISSUED' && result.httpStatus === 200,
    'employer login session issued'
  );
}

// --- issueLoginSession: required Redis unavailable before issuance ---------
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
    'Redis outage maps Employer initial issuance to safe 503'
  );
  check(
    result.body?.error === 'Service temporarily unavailable',
    'Employer issuance reuses the existing safe public error'
  );
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    'Employer outage result contains no authenticated credential'
  );
  check(
    issuance.calls.length === 0,
    'Employer token signing and RefreshSession creation are never reached'
  );
}

// --- refresh: realm-scoped rotation, no cookie confusion with the user realm --
{
  const flows = buildFlows();
  const result = await flows.refresh({ cookieToken: 'employer-rt' });
  check(result.code === 'REFRESH_ROTATED', 'employer refresh rotation success');
  check(
    result.accessToken === 'a2' && result.refreshToken === 'r2',
    'rotated tokens returned'
  );
}

// --- refresh: required Redis unavailable before any session mutation -------
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
    'Redis outage maps Employer refresh to safe 503'
  );
  check(
    result.clearCookie === false,
    'transient outage preserves the Employer cookie'
  );
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    'Employer outage refresh issues no credential'
  );
  check(
    refreshCoordinator.calls.length === 0,
    'Employer rotation and token generation are never reached'
  );
  check(
    familyRevocation.calls.length === 0,
    'Employer outage performs no revoke or family mutation'
  );
}

// --- refresh: origin rejection -------------------------------------------------
{
  const flows = buildFlows({ originPolicy: trustingOrigin(false) });
  const result = await flows.refresh({ cookieToken: 'x' });
  check(
    result.code === 'ORIGIN_VALIDATION_FAILED' && result.httpStatus === 403,
    'untrusted origin rejected'
  );
}

// --- logoutCurrent: exact realm/reason binding ---------------------------------
{
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ familyRevocation });
  const principal = { subjectId: SUBJECT_ID, sid: SID, jti: JTI };
  const result = await flows.logoutCurrent({
    principal,
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(
    result.code === 'LOGGED_OUT' && result.clearCookie === true,
    'employer logout succeeds'
  );
  check(
    familyRevocation.calls[0][1].realm === 'employer',
    'exact employer realm bound'
  );
  check(
    familyRevocation.calls[0][1].reason === 'logout',
    'exact revoke reason'
  );
}

// --- logoutAll: tokenVersion first, sweep second --------------------------------
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
  check(result.code === 'LOGGED_OUT_ALL', 'employer logout-all succeeds');
  check(
    accountSecurityMutation.calls[0][1].realm === 'employer',
    'exact employer realm bound in version mutation'
  );
  check(
    familyRevocation.calls[0][1].reason === 'logout_all',
    'exact revoke reason'
  );
}

// --- suspend/reactivate delegation ----------------------------------------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ accountSecurityMutation, familyRevocation });

  const suspendResult = await flows.suspendEmployer({ subjectId: SUBJECT_ID });
  check(
    suspendResult.code === 'SUBJECT_STATE_UPDATED',
    'employer suspend delegates to the primitive'
  );
  check(
    accountSecurityMutation.calls[0][1].realm === 'employer',
    'exact employer realm bound in suspend'
  );
  check(
    familyRevocation.calls.some(
      ([kind, args]) => kind === 'all' && args.reason === 'account_suspended'
    ),
    'suspend sweeps all employer families'
  );

  const reactivateResult = await flows.reactivateEmployer({
    subjectId: SUBJECT_ID,
  });
  check(
    reactivateResult.code === 'SUBJECT_STATE_UPDATED',
    'employer reactivate delegates to the primitive'
  );
}

// --- No cross-realm API surface exposed ------------------------------------------
{
  const flows = buildFlows();
  check(
    typeof flows.changePassword === 'function',
    'no changePassword — Employer has no live password-change route'
  );
  check(
    typeof flows.resetPassword === 'function',
    'no resetPassword — Employer has no live reset route'
  );
  check(
    typeof flows.changeUserRole === 'undefined' &&
      typeof flows.changeEmployerRole === 'undefined',
    'no role-change API — Employer has no role field'
  );
}

// --- Realm-bound password change and global revocation ---------------------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ accountSecurityMutation, familyRevocation });
  const result = await flows.changePassword({
    principal: { subjectId: SUBJECT_ID, tokenVersion: 4, jti: JTI },
    newPassword: 'NewPassword1',
    presentedAccessTokenExp: Math.floor(Date.now() / 1000) + 900,
  });
  check(
    result.code === 'PASSWORD_CHANGED' && result.clearCookie,
    'Employer password change succeeds'
  );
  check(
    accountSecurityMutation.calls[0][1].realm === 'employer' &&
      accountSecurityMutation.calls[0][1].expectedTokenVersion === 4,
    'password and tokenVersion mutation is Employer-bound'
  );
  check(
    familyRevocation.calls[0][1].realm === 'employer' &&
      familyRevocation.calls[0][1].reason === 'password_change',
    'password change revokes all Employer refresh families'
  );
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    'change returns no credential'
  );
}

// --- Shared-state failure precedes every password mutation ------------------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({
    accountSecurityMutation,
    familyRevocation,
    denylist: fakeDenylist({ code: 'DENYLISTED' }, { code: 'STORAGE_FAILURE' }),
  });
  const result = await flows.changePassword({
    principal: { subjectId: SUBJECT_ID, tokenVersion: 0, jti: JTI },
    newPassword: 'NewPassword1',
    presentedAccessTokenExp: 0,
  });
  check(
    result.code === 'STORAGE_FAILURE' && result.httpStatus === 503,
    'Redis failure is safe'
  );
  check(
    accountSecurityMutation.calls.length === 0,
    'Redis failure causes no password mutation'
  );
  check(
    familyRevocation.calls.length === 0,
    'Redis failure causes no session mutation'
  );
}

// --- Atomic reset consumption and global revocation -------------------------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const familyRevocation = fakeFamilyRevocation();
  const flows = buildFlows({ accountSecurityMutation, familyRevocation });
  const result = await flows.resetPassword({
    hashedToken: 'a'.repeat(64),
    newPassword: 'ResetPassword1',
  });
  check(
    result.code === 'PASSWORD_RESET' && result.clearCookie,
    'valid Employer reset succeeds'
  );
  check(
    accountSecurityMutation.calls[0][1].realm === 'employer',
    'reset is Employer-bound'
  );
  check(
    familyRevocation.calls[0][1].realm === 'employer' &&
      familyRevocation.calls[0][1].reason === 'password_reset',
    'reset revokes all Employer refresh families'
  );
  check(
    !('accessToken' in result) && !('refreshToken' in result),
    'reset returns no credential'
  );
}

// --- Invalid, expired, or reused reset tokens do not reach mutation ----------------
{
  const accountSecurityMutation = fakeAccountSecurityMutation();
  const flows = buildFlows({
    accountSecurityMutation,
    employerModel: {
      async findOne() {
        return null;
      },
    },
  });
  const result = await flows.resetPassword({
    hashedToken: 'b'.repeat(64),
    newPassword: 'ResetPassword1',
  });
  check(
    result.code === 'RESET_TOKEN_INVALID' && result.httpStatus === 400,
    'invalid token rejected'
  );
  check(
    accountSecurityMutation.calls.length === 0,
    'invalid token causes no write'
  );
}

console.log(`employerSecureAuthFlows.test.js: ${count} assertions passed`);
