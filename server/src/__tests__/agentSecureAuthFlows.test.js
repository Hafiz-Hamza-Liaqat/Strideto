import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const { createAgentSecureAuthFlows } =
  await import('../services/auth/agentSecureAuthFlows.js');

assert.strictEqual(mongoose.connection.readyState, 0, 'must not use MongoDB');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const SUBJECT_ID = '507f1f77bcf86cd799439021';
const SID = '507f1f77bcf86cd799439022';

function fakeJwtProvider() {
  return { issueAccessToken: () => ({ token: 'access-token' }) };
}

function trustingOrigin() {
  return { evaluateRequestOrigin: () => ({ code: 'ORIGIN_TRUSTED' }) };
}

function fakeIssuance(result) {
  return {
    async issueInitialSession(_args) {
      return result;
    },
  };
}

function fakeRefreshCoordinator(result) {
  return {
    async attemptRefresh() {
      return result;
    },
  };
}

function fakeFamilyRevocation() {
  return {
    async revokeCurrentFamily() {
      return { code: 'REVOKED_CURRENT_FAMILY' };
    },
    async revokeAllFamilies() {
      return { code: 'REVOKED_ALL_FAMILIES', revokedCount: 1 };
    },
  };
}

function fakeAccountSecurityMutation() {
  return {
    async incrementTokenVersionForLogoutAll() {
      return { code: 'VERSION_INCREMENTED' };
    },
    async changePassword() {
      return { code: 'VERSION_INCREMENTED' };
    },
    async resetPassword() {
      return { code: 'VERSION_INCREMENTED' };
    },
    async suspend() {
      return { code: 'SUBJECT_STATE_UPDATED' };
    },
    async reactivate() {
      return { code: 'SUBJECT_STATE_UPDATED' };
    },
  };
}

function fakeDenylist() {
  return {
    async assertAvailable() {
      return { code: 'AVAILABLE' };
    },
    async denylistJti() {
      return { code: 'DENYLISTED' };
    },
  };
}

const flows = createAgentSecureAuthFlows({
  jwtProvider: fakeJwtProvider(),
  originPolicy: trustingOrigin(),
  initialSessionIssuanceService: fakeIssuance({
    code: 'SESSION_ISSUED',
    sid: SID,
    accessToken: 'a',
    refreshToken: 'r',
  }),
  refreshEligibilityCoordinator: fakeRefreshCoordinator({
    code: 'REFRESH_ROTATED',
    accessToken: 'a2',
    refreshToken: 'r2',
  }),
  sessionFamilyRevocationService: fakeFamilyRevocation(),
  accountSecurityMutationService: fakeAccountSecurityMutation(),
  denylistService: fakeDenylist(),
  agentModel: {
    async findOne() {
      return { _id: SUBJECT_ID };
    },
  },
});

{
  const result = await flows.issueLoginSession({ subjectId: SUBJECT_ID, tokenVersion: 0 });
  check(result.code === 'SESSION_ISSUED' && result.httpStatus === 200, 'agent login session issued');
}

{
  const result = await flows.refresh({
    cookieToken: 'rt',
    origin: 'https://localhost:8443',
    referer: 'https://localhost:8443/agent',
  });
  check(result.code === 'REFRESH_ROTATED' && result.httpStatus === 200, 'agent refresh rotated');
}

{
  const untrusted = createAgentSecureAuthFlows({
    jwtProvider: fakeJwtProvider(),
    originPolicy: { evaluateRequestOrigin: () => ({ code: 'ORIGIN_UNTRUSTED' }) },
    initialSessionIssuanceService: fakeIssuance({ code: 'SESSION_ISSUED' }),
    refreshEligibilityCoordinator: fakeRefreshCoordinator({ code: 'REFRESH_ROTATED' }),
    sessionFamilyRevocationService: fakeFamilyRevocation(),
    accountSecurityMutationService: fakeAccountSecurityMutation(),
    denylistService: fakeDenylist(),
  });
  const result = await untrusted.refresh({
    cookieToken: 'rt',
    origin: 'https://localhost:8443',
    referer: '',
  });
  check(result.code === 'ORIGIN_VALIDATION_FAILED', 'agent refresh wrong origin denied');
}

console.log(`agentSecureAuthFlows: ${count} checks passed`);
