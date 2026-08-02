import { RefreshSession } from '../../models/RefreshSession.js';
import { hashRefreshToken } from './refreshTokenHash.js';
import { createSessionSubjectStateProvider } from './SessionSubjectStateProvider.js';
import { createRefreshSessionRotationService } from './RefreshSessionRotationService.js';
import { createSessionFamilyRevocationService } from './SessionFamilyRevocationService.js';
import { REFRESH_FINAL_STATE_MISMATCH_REVOKE_REASON } from './RefreshEligibilityContracts.js';

/**
 * The final reread's only proven-ineligibility outcomes (§11.2). A
 * `STORAGE_FAILURE`, a thrown exception, or any unrecognized/malformed
 * result proves nothing about eligibility — it means the check could not
 * be completed — and must never trigger cleanup of the just-rotated
 * family or be stored as `refresh_final_state_mismatch`, which would
 * misrepresent an infrastructure failure as a proven security event.
 */
const FINAL_ELIGIBILITY_MISMATCH_CODES = Object.freeze([
  'SUBJECT_MISSING',
  'SUBJECT_INACTIVE',
  'SUBJECT_STATE_INVALID',
  'TOKEN_VERSION_MISMATCH',
]);

/**
 * Canonical refresh-eligibility and post-rotation revalidation coordinator.
 * Composes the canonical primitives (`JwtSessionProvider`,
 * a plain `RefreshSession` read, `SessionSubjectStateProvider`,
 * `RefreshSessionRotationService`, and — only on the post-rotation
 * mismatch path — `SessionFamilyRevocationService`) without reimplementing
 * any of their algorithms. Authority:
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md
 * (§11, §14.4, §18).
 *
 * SEC-3D.2 is never imported or called from this file — this coordinator
 * performs no `tokenVersion`/`accountStatus`/`role`/password mutation of
 * any kind.
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * @param {object} config
 * @param {object} config.jwtSessionProvider — required, no safe default
 *   (carries signing secrets); must expose `verifyRefreshToken`,
 *   `issueRefreshToken`, `issueAccessToken`.
 * @param {object} [config.refreshSessionModel] — defaults to the real
 *   `RefreshSession` model.
 * @param {object} [config.subjectStateProvider] — defaults to a real
 *   `SessionSubjectStateProvider` instance.
 * @param {object} [config.rotationService] — defaults to a real
 *   `RefreshSessionRotationService` instance bound to `refreshSessionModel`.
 * @param {object} [config.familyRevocationService] — defaults to a real
 *   `SessionFamilyRevocationService` instance bound to `refreshSessionModel`;
 *   used only on the post-rotation-mismatch cleanup path.
 * @param {(token: string) => string} [config.hashToken] — defaults to
 *   `hashRefreshToken`.
 * @param {() => Date} [config.now] — clock injection.
 */
export function createRefreshEligibilityCoordinator({
  jwtSessionProvider,
  refreshSessionModel = RefreshSession,
  subjectStateProvider,
  rotationService,
  familyRevocationService,
  hashToken = hashRefreshToken,
  now = () => new Date(),
} = {}) {
  if (
    !jwtSessionProvider ||
    typeof jwtSessionProvider.verifyRefreshToken !== 'function' ||
    typeof jwtSessionProvider.issueRefreshToken !== 'function' ||
    typeof jwtSessionProvider.issueAccessToken !== 'function'
  ) {
    throw new TypeError(
      'A jwtSessionProvider exposing verifyRefreshToken, issueRefreshToken, and issueAccessToken is required'
    );
  }
  if (
    !refreshSessionModel ||
    typeof refreshSessionModel.findById !== 'function'
  ) {
    throw new TypeError('A RefreshSession model with findById is required');
  }
  const resolvedSubjectStateProvider =
    subjectStateProvider || createSessionSubjectStateProvider();
  if (
    !resolvedSubjectStateProvider ||
    typeof resolvedSubjectStateProvider.getSubjectState !== 'function'
  ) {
    throw new TypeError(
      'A subjectStateProvider exposing getSubjectState is required'
    );
  }
  const resolvedRotationService =
    rotationService ||
    createRefreshSessionRotationService({ model: refreshSessionModel });
  if (
    !resolvedRotationService ||
    typeof resolvedRotationService.rotate !== 'function'
  ) {
    throw new TypeError('A rotationService exposing rotate is required');
  }
  const resolvedFamilyRevocationService =
    familyRevocationService ||
    createSessionFamilyRevocationService({ refreshSessionModel });
  if (
    !resolvedFamilyRevocationService ||
    typeof resolvedFamilyRevocationService.revokeCurrentFamily !== 'function'
  ) {
    throw new TypeError(
      'A familyRevocationService exposing revokeCurrentFamily is required'
    );
  }
  if (typeof hashToken !== 'function') {
    throw new TypeError('A hashToken(token) function is required');
  }
  if (typeof now !== 'function') {
    throw new TypeError('A now() clock function is required');
  }

  /**
   * Best-effort, internal-only cleanup of the just-rotated family when the
   * mandatory post-rotation reread mismatches. Never throws; never changes
   * the caller-facing result, which is always `REFRESH_FINAL_STATE_MISMATCH`
   * regardless of this call's own outcome (§11.2).
   */
  async function cleanupRotatedFamily({ realm, subjectId, sessionFamilyId }) {
    let result;
    try {
      result = await resolvedFamilyRevocationService.revokeCurrentFamily({
        realm,
        subjectId,
        sessionFamilyId,
        reason: REFRESH_FINAL_STATE_MISMATCH_REVOKE_REASON,
      });
    } catch {
      return 'ROTATED_FAMILY_CLEANUP_FAILED';
    }
    if (
      result &&
      (result.code === 'REVOKED_CURRENT_FAMILY' ||
        result.code === 'SESSION_ALREADY_REVOKED')
    ) {
      return 'ROTATED_FAMILY_REVOKED';
    }
    return 'ROTATED_FAMILY_CLEANUP_FAILED';
  }

  /**
   * Attempt one refresh-eligibility-and-rotation cycle. Single external
   * input: the presented refresh token itself — every other value used
   * below (`realm`, `sub`, `sid`, `tokenVersion`) comes from that token's
   * own cryptographically-verified claims, never client-supplied
   * separately (§9's "never client input" principle, applied here).
   */
  async function attemptRefresh({ presentedRefreshToken } = {}) {
    // Step 1 — input validation.
    if (!isNonEmptyString(presentedRefreshToken)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    // Steps 2/3 (claims) — cryptographic verification and claim validation.
    let claims;
    try {
      claims = jwtSessionProvider.verifyRefreshToken(presentedRefreshToken);
    } catch {
      // Any verification/claim failure (bad signature, wrong type, invalid
      // issuer/audience, malformed claims) — RefreshSessionContractError or
      // otherwise — maps to the same single external code.
      return Object.freeze({ code: 'REFRESH_TOKEN_INVALID' });
    }

    const nowValue = now();
    if (!isValidDate(nowValue)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    // Step 3 — load and bind the RefreshSession family.
    let sessionDoc;
    try {
      sessionDoc = await refreshSessionModel.findById(claims.sid);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    if (!sessionDoc) {
      return Object.freeze({ code: 'SESSION_MISSING' });
    }
    if (
      sessionDoc.subjectType !== claims.realm ||
      String(sessionDoc.subjectId) !== String(claims.sub)
    ) {
      return Object.freeze({ code: 'SUBJECT_MISMATCH' });
    }

    // Step 4 — validate session state from the already-loaded document
    // (a cheap early rejection; step 7's CAS re-verifies the same
    // conditions atomically, closing the gap between this read and that
    // write).
    if (sessionDoc.revokedAt) {
      return Object.freeze({ code: 'SESSION_REVOKED' });
    }
    if (
      !isValidDate(sessionDoc.expiresAt) ||
      sessionDoc.expiresAt.getTime() <= nowValue.getTime()
    ) {
      return Object.freeze({ code: 'SESSION_EXPIRED' });
    }
    if (
      !Number.isInteger(sessionDoc.tokenVersionAtIssue) ||
      sessionDoc.tokenVersionAtIssue < 0
    ) {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    // Steps 5/6 — pre-rotation authoritative subject-state eligibility.
    const preRotationState = await resolvedSubjectStateProvider.getSubjectState(
      {
        realm: claims.realm,
        subjectId: claims.sub,
        expectedTokenVersion: claims.tokenVersion,
      }
    );
    if (preRotationState.code !== 'SUBJECT_ACTIVE') {
      return Object.freeze({ code: preRotationState.code });
    }

    // Step 7 — the single-family rotation CAS. SEC-3B's own replay/benign-
    // conflict classification is never duplicated here; its result is
    // passed through unchanged.
    let newRefreshToken;
    try {
      newRefreshToken = jwtSessionProvider.issueRefreshToken({
        sub: claims.sub,
        realm: claims.realm,
        sid: claims.sid,
        tokenVersion: claims.tokenVersion,
      }).token;
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    let presentedTokenHash;
    let newTokenHash;
    try {
      presentedTokenHash = hashToken(presentedRefreshToken);
      newTokenHash = hashToken(newRefreshToken);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    const rotationResult = await resolvedRotationService.rotate({
      sid: claims.sid,
      presentedTokenHash,
      newTokenHash,
      expectedTokenVersionAtIssue: sessionDoc.tokenVersionAtIssue,
    });
    if (rotationResult.code !== 'ROTATED') {
      return Object.freeze({ code: rotationResult.code });
    }

    // Step 9 (new, mandatory) — authoritative post-rotation reread, same
    // expectedTokenVersion observed at steps 5/6. No further I/O between
    // the CAS above and this read.
    let finalState;
    try {
      finalState = await resolvedSubjectStateProvider.getSubjectState({
        realm: claims.realm,
        subjectId: claims.sub,
        expectedTokenVersion: claims.tokenVersion,
      });
    } catch {
      // Indeterminate — the reread itself failed. Not a proven mismatch:
      // no cleanup, no token, fail closed on delivery only.
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }

    const finalCode = finalState && finalState.code;

    if (finalCode === 'SUBJECT_ACTIVE') {
      // Step 10 — deliver the successor pair only now.
      let newAccessToken;
      try {
        newAccessToken = jwtSessionProvider.issueAccessToken({
          sub: claims.sub,
          realm: claims.realm,
          sid: claims.sid,
          tokenVersion: claims.tokenVersion,
        }).token;
      } catch {
        return Object.freeze({ code: 'STORAGE_FAILURE' });
      }
      return Object.freeze({
        code: 'REFRESH_ROTATED',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    }

    if (FINAL_ELIGIBILITY_MISMATCH_CODES.includes(finalCode)) {
      // Step 9/11 — a proven mismatch: no token, ever, regardless of
      // cleanup outcome.
      await cleanupRotatedFamily({
        realm: claims.realm,
        subjectId: claims.sub,
        sessionFamilyId: claims.sid,
      });
      return Object.freeze({ code: 'REFRESH_FINAL_STATE_MISMATCH' });
    }

    // Indeterminate — STORAGE_FAILURE, an unrecognized code, or a
    // malformed/missing result object. Proves nothing about eligibility;
    // never triggers cleanup, never labeled as a proven mismatch.
    return Object.freeze({ code: 'STORAGE_FAILURE' });
  }

  return Object.freeze({ attemptRefresh });
}
