import jwt from 'jsonwebtoken';
import { User } from '../../models/User.js';
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

/**
 * SEC-3E — User-realm secure authentication flow composition. Orchestrates
 * the canonical security services (never reimplementing any of
 * their logic) into the exact sequences the accepted architecture and this
 * cutover's own task authority require. Framework-agnostic: every function
 * returns a plain result object; the controller layer is the only place
 * that touches Express `req`/`res`.
 */

const REALM = 'user';

function remainingTtlSeconds(decodedExp) {
  if (typeof decodedExp !== 'number' || !Number.isFinite(decodedExp)) return 0;
  return decodedExp - Math.floor(Date.now() / 1000);
}

/**
 * @param {object} config
 * @param {object} config.jwtProvider — required, User-realm `JwtSessionProvider`.
 * @param {object} [config.originPolicy] — required for `refresh`/`logout`/
 *   `logoutAll` trusted-origin enforcement; omit only in tests that do not
 *   exercise those paths.
 * @param {object} [config.cookiePolicy] — required to know cookie identity
 *   for logging/testing; actual cookie IO happens in the controller.
 */
export function createUserSecureAuthFlows({
  jwtProvider,
  originPolicy,
  initialSessionIssuanceService,
  refreshEligibilityCoordinator,
  sessionFamilyRevocationService,
  accountSecurityMutationService,
  denylistService,
  userModel = User,
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
    createSessionFamilyRevocationService({
      refreshSessionModel: RefreshSession,
    });
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

  /** Origin enforcement helper, shared by every state-changing route below. */
  function checkOrigin({ origin, referer }) {
    if (!originPolicy) return { trusted: true }; // test-only escape hatch when omitted
    const result = originPolicy.evaluateRequestOrigin({ origin, referer });
    const trusted =
      result.code === 'ORIGIN_TRUSTED' || result.code === 'REFERER_TRUSTED';
    return { trusted, code: result.code };
  }

  /** Login — issues a brand-new session for an already-authenticated subject. */
  async function issueLoginSession({ subjectId, tokenVersion }) {
    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({
        code: 'STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
      });
    }
    const result = await issuance.issueInitialSession({
      realm: REALM,
      subjectId,
      tokenVersion,
    });
    if (result.code !== 'SESSION_ISSUED') {
      return Object.freeze({
        code: result.code,
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
      });
    }
    return Object.freeze({
      code: 'SESSION_ISSUED',
      httpStatus: 200,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  /** Refresh — cookie-only input, trusted-origin enforced. */
  async function refresh({ cookieToken, origin, referer }) {
    const originCheck = checkOrigin({ origin, referer });
    if (!originCheck.trusted) {
      return Object.freeze({
        code: 'ORIGIN_VALIDATION_FAILED',
        httpStatus: 403,
        body: SAFE_BODIES.ORIGIN_VALIDATION_FAILED,
        clearCookie: false,
      });
    }
    if (!cookieToken) {
      return Object.freeze({
        code: 'REFRESH_TOKEN_INVALID',
        httpStatus: 401,
        body: SAFE_BODIES.REFRESH_UNAUTHORIZED,
        clearCookie: true,
      });
    }

    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({
        code: 'STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
        clearCookie: false,
      });
    }

    const result = await refreshCoordinator.attemptRefresh({
      presentedRefreshToken: cookieToken,
    });

    if (result.code === 'REFRESH_ROTATED') {
      return Object.freeze({
        code: 'REFRESH_ROTATED',
        httpStatus: 200,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        clearCookie: false,
      });
    }
    if (result.code === 'CONFLICT_BENIGN') {
      return Object.freeze({
        code: 'CONFLICT_BENIGN',
        httpStatus: 409,
        body: SAFE_BODIES.REFRESH_CONFLICT,
        retryAfterSeconds: 1,
        clearCookie: false,
      });
    }
    return Object.freeze({
      code: result.code,
      httpStatus: mapRefreshResultToHttpStatus(result.code),
      body:
        mapRefreshResultToHttpStatus(result.code) === 503
          ? SAFE_BODIES.SERVICE_UNAVAILABLE
          : SAFE_BODIES.REFRESH_UNAUTHORIZED,
      clearCookie: shouldClearRefreshCookie(result.code),
    });
  }

  /**
   * Logout-current — bearer-authenticated. `presentedAccessToken`'s exp
   * claim (already verified upstream by the access middleware) supplies
   * the exact remaining denylist TTL; `principal` is the already-verified
   * principal attached by that same middleware.
   */
  async function logoutCurrent({
    principal,
    presentedAccessTokenExp,
    origin,
    referer,
  }) {
    const originCheck = checkOrigin({ origin, referer });
    if (!originCheck.trusted) {
      return Object.freeze({
        code: 'ORIGIN_VALIDATION_FAILED',
        httpStatus: 403,
        body: SAFE_BODIES.ORIGIN_VALIDATION_FAILED,
        clearCookie: false,
      });
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
    const denylistResult = await denylist.denylistJti(
      principal.jti,
      ttlSeconds
    );
    const denylistOk =
      denylistResult.code === 'DENYLISTED' ||
      denylistResult.code === 'DENYLIST_SKIPPED_EXPIRED';

    if (!revokeOk || !denylistOk) {
      // Partial failure — explicit fail-closed response, distinct security
      // event, never silently downgraded to success (§12.1).
      return Object.freeze({
        code: 'LOGOUT_PARTIAL_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
        clearCookie: false,
      });
    }

    return Object.freeze({
      code: 'LOGGED_OUT',
      httpStatus: 200,
      clearCookie: true,
    });
  }

  /** Logout-all — tokenVersion first (authoritative), sweep second (defense-in-depth). */
  async function logoutAll({
    principal,
    presentedAccessTokenExp,
    origin,
    referer,
  }) {
    const originCheck = checkOrigin({ origin, referer });
    if (!originCheck.trusted) {
      return Object.freeze({
        code: 'ORIGIN_VALIDATION_FAILED',
        httpStatus: 403,
        body: SAFE_BODIES.ORIGIN_VALIDATION_FAILED,
        clearCookie: false,
      });
    }

    const versionResult =
      await accountSecurityMutation.incrementTokenVersionForLogoutAll({
        realm: REALM,
        subjectId: principal.subjectId,
        expectedTokenVersion: principal.tokenVersion,
      });

    const versionOk =
      versionResult.code === 'VERSION_INCREMENTED' ||
      versionResult.code === 'VERSION_ALREADY_ADVANCED';
    if (!versionOk) {
      // SUBJECT_MISSING / SUBJECT_STATE_MALFORMED / VERSION_EXHAUSTED /
      // VERSION_REGRESSION / CLASSIFICATION_STALE / STORAGE_FAILURE — none
      // of these prove the sweep is safe to run or the client can be told
      // "logged out." Fail closed uniformly; no tokenVersion is ever
      // exposed.
      return Object.freeze({
        code: 'LOGOUT_ALL_FAILED',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
        clearCookie: false,
      });
    }

    // Defense-in-depth cleanup — best-effort by design (§21/§29); its
    // outcome never overrides the already-authoritative tokenVersion bump.
    await familyRevocation.revokeAllFamilies({
      realm: REALM,
      subjectId: principal.subjectId,
      reason: 'logout_all',
    });

    const ttlSeconds = remainingTtlSeconds(presentedAccessTokenExp);
    await denylist.denylistJti(principal.jti, ttlSeconds);

    return Object.freeze({
      code: 'LOGGED_OUT_ALL',
      httpStatus: 200,
      clearCookie: true,
    });
  }

  /** Password change — authenticated, tokenVersion mutation is the immediate authority. */
  async function changePassword({
    principal,
    newPassword,
    presentedAccessTokenExp,
  }) {
    const result = await accountSecurityMutation.changePassword({
      subjectId: principal.subjectId,
      expectedTokenVersion: principal.tokenVersion,
      newPassword,
    });
    if (result.code !== 'VERSION_INCREMENTED') {
      return Object.freeze({
        code: result.code,
        httpStatus: result.code === 'STORAGE_FAILURE' ? 503 : 409,
        body:
          result.code === 'STORAGE_FAILURE'
            ? SAFE_BODIES.SERVICE_UNAVAILABLE
            : SAFE_BODIES.REFRESH_CONFLICT,
        clearCookie: false,
      });
    }

    await familyRevocation.revokeAllFamilies({
      realm: REALM,
      subjectId: principal.subjectId,
      reason: 'password_change',
    });
    const ttlSeconds = remainingTtlSeconds(presentedAccessTokenExp);
    await denylist.denylistJti(principal.jti, ttlSeconds);

    return Object.freeze({
      code: 'PASSWORD_CHANGED',
      httpStatus: 200,
      clearCookie: true,
    });
  }

  /**
   * Password reset — unauthenticated. Uses the narrowest safe pre-read
   * (`_id` only) purely to know which subject's sessions to clean up after
   * a successful reset; the reset primitive itself performs the single
   * authoritative write. Every unsuccessful attempt returns the identical
   * generic response, regardless of whether a matching subject was found.
   */
  async function resetPassword({ hashedToken, newPassword }) {
    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({
        code: 'STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
        clearCookie: false,
      });
    }

    let subject;
    try {
      subject = await userModel.findOne(
        {
          passwordResetToken: hashedToken,
          passwordResetExpires: { $gt: new Date() },
        },
        { _id: 1 }
      );
    } catch {
      return Object.freeze({
        code: 'STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
        clearCookie: false,
      });
    }
    if (!subject?._id) {
      return Object.freeze({
        code: 'RESET_TOKEN_INVALID',
        httpStatus: 400,
        clearCookie: false,
      });
    }

    const result = await accountSecurityMutation.resetPassword({
      hashedToken,
      newPassword,
    });
    if (result.code !== 'VERSION_INCREMENTED') {
      return Object.freeze({
        code: result.code,
        httpStatus: result.code === 'STORAGE_FAILURE' ? 503 : 400,
        body:
          result.code === 'STORAGE_FAILURE'
            ? SAFE_BODIES.SERVICE_UNAVAILABLE
            : undefined,
        clearCookie: false,
      });
    }

    await familyRevocation.revokeAllFamilies({
      realm: REALM,
      subjectId: subject._id,
      reason: 'password_reset',
    });
    return Object.freeze({
      code: 'PASSWORD_RESET',
      httpStatus: 200,
      clearCookie: true,
    });
  }

  async function adminResetPassword({
    subjectId,
    newPassword,
    tempPasswordExpires,
  }) {
    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({
        code: 'STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
      });
    }

    const result = await accountSecurityMutation.adminResetUserPassword({
      subjectId,
      newPassword,
      tempPasswordExpires,
    });
    if (result.code !== 'VERSION_INCREMENTED') {
      return Object.freeze({
        code: result.code,
        httpStatus: result.code === 'STORAGE_FAILURE' ? 503 : 409,
        body:
          result.code === 'STORAGE_FAILURE'
            ? SAFE_BODIES.SERVICE_UNAVAILABLE
            : SAFE_BODIES.REFRESH_CONFLICT,
      });
    }

    const revocation = await familyRevocation.revokeAllFamilies({
      realm: REALM,
      subjectId,
      reason: 'admin_revoked',
    });
    if (revocation.code !== 'REVOKED_ALL_FAMILIES') {
      return Object.freeze({
        code: 'STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
      });
    }

    return Object.freeze({ code: 'PASSWORD_RESET', httpStatus: 200 });
  }

  async function suspendUser({ subjectId }) {
    const result = await accountSecurityMutation.suspend({
      realm: REALM,
      subjectId,
    });
    if (result.code === 'SUBJECT_STATE_UPDATED') {
      await familyRevocation.revokeAllFamilies({
        realm: REALM,
        subjectId,
        reason: 'account_suspended',
      });
    }
    return result;
  }

  async function reactivateUser({
    subjectId,
    alsoInvalidateAccessTokens = false,
  }) {
    const result = await accountSecurityMutation.reactivate({
      realm: REALM,
      subjectId,
      alsoInvalidateAccessTokens,
    });
    return result;
  }

  async function changeUserRole({ subjectId, expectedPriorRole, newRole }) {
    if (!(await sharedSecurityStateAvailable())) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    const result = await accountSecurityMutation.changeRole({
      subjectId,
      expectedPriorRole,
      newRole,
    });
    if (result.code === 'SUBJECT_STATE_UPDATED') {
      await familyRevocation.revokeAllFamilies({
        realm: REALM,
        subjectId,
        reason: 'role_changed',
      });
    }
    return result;
  }

  return Object.freeze({
    issueLoginSession,
    refresh,
    logoutCurrent,
    logoutAll,
    changePassword,
    resetPassword,
    adminResetPassword,
    suspendUser,
    reactivateUser,
    changeUserRole,
  });
}

function decodeExp(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded && typeof decoded.exp === 'number' ? decoded.exp : 0;
  } catch {
    return 0;
  }
}

export const userSecureAuthFlowsHelpers = Object.freeze({ decodeExp });

/** Canonical runtime singleton. */
export const userSecureAuthFlows = createUserSecureAuthFlows({
  jwtProvider: secureAuthConfig.userJwtProvider,
  originPolicy: secureAuthConfig.originPolicy,
});
