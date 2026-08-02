import { createSessionSubjectStateProvider } from './SessionSubjectStateProvider.js';

/**
 * Canonical subject-state-only access-authorization coordinator. Composes
 * `SessionSubjectStateProvider`; denylist composition remains at the live
 * middleware layer. This coordinator performs no Redis or `RefreshSession`
 * read and no mutation of any kind. Authority:
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md
 * (§12, §14.5, §18).
 *
 * Zero stale-positive posture: every call performs its own fresh
 * authoritative read — no cache, no reused prior decision, no
 * process-local fallback. Storage failure, missing subject, inactive
 * subject, and malformed subject state are all treated as not authorized
 * (fail closed), never as authorized.
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * @param {object} config
 * @param {object} config.jwtSessionProvider — required, no safe default
 *   (carries signing secrets); must expose `verifyAccessToken`.
 * @param {object} [config.subjectStateProvider] — defaults to a real
 *   `SessionSubjectStateProvider` instance.
 */
export function createAccessAuthorizationCoordinator({
  jwtSessionProvider,
  subjectStateProvider,
} = {}) {
  if (
    !jwtSessionProvider ||
    typeof jwtSessionProvider.verifyAccessToken !== 'function'
  ) {
    throw new TypeError(
      'A jwtSessionProvider exposing verifyAccessToken is required'
    );
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

  /**
   * Authorize one presented access token. Single external input, exactly
   * like SEC-3D.3 — every other value (`realm`, `sub`, `tokenVersion`)
   * comes from the token's own cryptographically-verified claims.
   */
  async function authorize({ presentedAccessToken } = {}) {
    // Step 1 — input validation.
    if (!isNonEmptyString(presentedAccessToken)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    // Steps 2/3/4 — cryptographic verification, claim shape, realm.
    let claims;
    try {
      claims = jwtSessionProvider.verifyAccessToken(presentedAccessToken);
    } catch {
      return Object.freeze({ code: 'ACCESS_TOKEN_INVALID' });
    }

    // Step 5 — exactly one authoritative subject-state read. No cache, no
    // reuse of any prior decision, no process-local fallback.
    const state = await resolvedSubjectStateProvider.getSubjectState({
      realm: claims.realm,
      subjectId: claims.sub,
      expectedTokenVersion: claims.tokenVersion,
    });

    // Steps 6/7/8 — subject existence, valid state, active status. All
    // three provider outcomes collapse into the same external code
    // (§14.5, anti-enumeration — never let a caller distinguish "missing"
    // from "suspended" from "corrupted").
    if (
      state.code === 'SUBJECT_MISSING' ||
      state.code === 'SUBJECT_INACTIVE' ||
      state.code === 'SUBJECT_STATE_INVALID'
    ) {
      return Object.freeze({ code: 'ACCESS_SUBJECT_INACTIVE' });
    }

    // Step 9 — exact tokenVersion equality.
    if (state.code === 'TOKEN_VERSION_MISMATCH') {
      return Object.freeze({ code: 'ACCESS_VERSION_MISMATCH' });
    }

    if (state.code === 'STORAGE_FAILURE') {
      return Object.freeze({ code: 'ACCESS_STORAGE_FAILURE' });
    }

    if (state.code !== 'SUBJECT_ACTIVE') {
      // Any unrecognized provider outcome fails closed — never authorized
      // by default.
      return Object.freeze({ code: 'ACCESS_STORAGE_FAILURE' });
    }

    // Step 10 — authorize only now, after every prior check has passed.
    return Object.freeze({ code: 'ACCESS_AUTHORIZED' });
  }

  return Object.freeze({ authorize });
}
