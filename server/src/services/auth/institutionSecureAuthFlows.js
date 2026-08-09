/**
 * Institution-realm secure authentication flow composition (Mission 18).
 *
 * Mirrors agentSecureAuthFlows.js for the 'institution' realm.
 * Isolated from User, Employer, and Agent realms.
 */
import { RefreshSession } from '../../models/RefreshSession.js';
import { createInitialSessionIssuanceService } from './initialSessionIssuance.js';
import { createRefreshEligibilityCoordinator } from './RefreshEligibilityCoordinator.js';
import { createSessionFamilyRevocationService } from './SessionFamilyRevocationService.js';
import { createAccountSecurityMutationService } from './AccountSecurityMutationService.js';
import { createAccessDenylistService } from './accessDenylist.js';
import {
  mapRefreshResultToHttpStatus,
  shouldClearRefreshCookie,
  SAFE_BODIES,
} from './secureAuthResultMapping.js';
import { secureAuthConfig } from './secureAuthConfig.js';

const REALM = 'institution';

function remainingTtlSeconds(decodedExp) {
  if (typeof decodedExp !== 'number' || !Number.isFinite(decodedExp)) return 0;
  return decodedExp - Math.floor(Date.now() / 1000);
}

export function createInstitutionSecureAuthFlows({
  jwtProvider,
  originPolicy,
  initialSessionIssuanceService,
  refreshEligibilityCoordinator,
  sessionFamilyRevocationService,
  accountSecurityMutationService,
  denylistService,
} = {}) {
  if (!jwtProvider || typeof jwtProvider.issueAccessToken !== 'function') {
    throw new TypeError('jwtProvider is required');
  }

  const issuance =
    initialSessionIssuanceService ||
    createInitialSessionIssuanceService({ jwtProvider });
  const refreshCoordinator =
    refreshEligibilityCoordinator ||
    createRefreshEligibilityCoordinator({ jwtSessionProvider: jwtProvider });
  const familyRevocation =
    sessionFamilyRevocationService ||
    createSessionFamilyRevocationService({ refreshSessionModel: RefreshSession });
  const accountSecurityMutation =
    accountSecurityMutationService || createAccountSecurityMutationService();
  const denylist =
    denylistService ||
    createAccessDenylistService({
      requireSharedStore: secureAuthConfig.requireSharedDenylistStore || false,
    });
  if (typeof denylist.assertAvailable !== 'function') {
    throw new TypeError('denylistService exposing assertAvailable is required');
  }

  async function sharedSecurityStateAvailable() {
    const result = await denylist.assertAvailable();
    return result && result.code === 'AVAILABLE';
  }

  function checkOrigin({ origin, referer }) {
    if (!originPolicy) return { trusted: true };
    const result = originPolicy.evaluateRequestOrigin({ origin, referer });
    const trusted =
      result.code === 'ORIGIN_TRUSTED' || result.code === 'REFERER_TRUSTED';
    return { trusted, code: result.code };
  }

  async function issueLoginSession({ subjectId, tokenVersion }) {
    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({ code: 'STORAGE_FAILURE', httpStatus: 503, body: SAFE_BODIES.SERVICE_UNAVAILABLE });
    }
    const result = await issuance.issueInitialSession({ realm: REALM, subjectId, tokenVersion });
    if (result.code !== 'SESSION_ISSUED') {
      return Object.freeze({ code: result.code, httpStatus: 503, body: SAFE_BODIES.SERVICE_UNAVAILABLE });
    }
    return Object.freeze({
      code: 'SESSION_ISSUED',
      httpStatus: 200,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  async function refresh({ cookieToken, origin, referer }) {
    const originCheck = checkOrigin({ origin, referer });
    if (!originCheck.trusted) {
      return Object.freeze({ code: 'ORIGIN_VALIDATION_FAILED', httpStatus: 403, body: SAFE_BODIES.ORIGIN_VALIDATION_FAILED, clearCookie: false });
    }
    if (!cookieToken) {
      return Object.freeze({ code: 'REFRESH_TOKEN_INVALID', httpStatus: 401, body: SAFE_BODIES.REFRESH_UNAUTHORIZED, clearCookie: true });
    }
    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({ code: 'STORAGE_FAILURE', httpStatus: 503, body: SAFE_BODIES.SERVICE_UNAVAILABLE, clearCookie: false });
    }
    const result = await refreshCoordinator.attemptRefresh({ presentedRefreshToken: cookieToken });
    if (result.code === 'REFRESH_ROTATED') {
      return Object.freeze({ code: 'REFRESH_ROTATED', httpStatus: 200, accessToken: result.accessToken, refreshToken: result.refreshToken, clearCookie: false });
    }
    if (result.code === 'CONFLICT_BENIGN') {
      return Object.freeze({ code: 'CONFLICT_BENIGN', httpStatus: 409, body: SAFE_BODIES.REFRESH_CONFLICT, retryAfterSeconds: 1, clearCookie: false });
    }
    return Object.freeze({
      code: result.code,
      httpStatus: mapRefreshResultToHttpStatus(result.code),
      body: mapRefreshResultToHttpStatus(result.code) === 503 ? SAFE_BODIES.SERVICE_UNAVAILABLE : SAFE_BODIES.REFRESH_UNAUTHORIZED,
      clearCookie: shouldClearRefreshCookie(result.code),
    });
  }

  async function logoutCurrent({ principal, presentedAccessTokenExp, origin, referer }) {
    const originCheck = checkOrigin({ origin, referer });
    if (!originCheck.trusted) {
      return Object.freeze({ code: 'ORIGIN_VALIDATION_FAILED', httpStatus: 403, body: SAFE_BODIES.ORIGIN_VALIDATION_FAILED, clearCookie: false });
    }

    const revokeResult = await familyRevocation.revokeCurrentFamily({
      realm: REALM,
      subjectId: principal.subjectId,
      sessionFamilyId: principal.sid,
      reason: 'logout',
    });
    const revokeOk =
      revokeResult.code === 'REVOKED_CURRENT_FAMILY' ||
      revokeResult.code === 'SESSION_ALREADY_REVOKED' ||
      revokeResult.code === 'SESSION_MISSING';

    const ttlSeconds = remainingTtlSeconds(presentedAccessTokenExp);
    const denylistResult = await denylist.denylistJti(principal.jti, ttlSeconds);
    const denylistOk =
      denylistResult.code === 'DENYLISTED' ||
      denylistResult.code === 'DENYLIST_SKIPPED_EXPIRED';

    if (!revokeOk || !denylistOk) {
      return Object.freeze({ code: 'LOGOUT_PARTIAL_FAILURE', httpStatus: 503, body: SAFE_BODIES.SERVICE_UNAVAILABLE, clearCookie: false });
    }
    return Object.freeze({ code: 'LOGGED_OUT', httpStatus: 200, clearCookie: true });
  }

  async function logoutAll({ principal, presentedAccessTokenExp, origin, referer }) {
    const originCheck = checkOrigin({ origin, referer });
    if (!originCheck.trusted) {
      return Object.freeze({ code: 'ORIGIN_VALIDATION_FAILED', httpStatus: 403, body: SAFE_BODIES.ORIGIN_VALIDATION_FAILED, clearCookie: false });
    }

    const versionResult = await accountSecurityMutation.incrementTokenVersionForLogoutAll({
      realm: REALM,
      subjectId: principal.subjectId,
      expectedTokenVersion: principal.tokenVersion,
    });

    const versionOk =
      versionResult.code === 'VERSION_INCREMENTED' ||
      versionResult.code === 'VERSION_ALREADY_ADVANCED';
    if (!versionOk) {
      return Object.freeze({ code: 'LOGOUT_ALL_FAILED', httpStatus: 503, body: SAFE_BODIES.SERVICE_UNAVAILABLE, clearCookie: false });
    }

    await familyRevocation.revokeAllFamilies({
      realm: REALM,
      subjectId: principal.subjectId,
      reason: 'logout_all',
    });

    const ttlSeconds = remainingTtlSeconds(presentedAccessTokenExp);
    await denylist.denylistJti(principal.jti, ttlSeconds).catch(() => {});

    return Object.freeze({ code: 'LOGGED_OUT_ALL', httpStatus: 200, clearCookie: true });
  }

  return Object.freeze({ issueLoginSession, refresh, logoutCurrent, logoutAll });
}

export const institutionSecureAuthFlows = createInstitutionSecureAuthFlows({
  jwtProvider: secureAuthConfig.institutionJwtProvider,
  originPolicy: secureAuthConfig.originPolicy,
});
