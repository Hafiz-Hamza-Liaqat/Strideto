import jwt from 'jsonwebtoken';
import { User } from '../../models/User.js';
import { createAccessAuthorizationCoordinator } from './AccessAuthorizationCoordinator.js';
import {
  mapAccessResultToHttpStatus,
  SAFE_BODIES,
} from './secureAuthResultMapping.js';
import { createAccessDenylistService } from './accessDenylist.js';
import { secureAuthConfig } from './secureAuthConfig.js';

/**
 * Disclosed, deliberate deviation (documented in the SEC-3E implementation
 * report): `JwtSessionProvider`'s access-token claims are exactly
 * `{sub, realm, sid, jti, tokenVersion}` (architecture report §19A,
 * unchanged, must not be weakened) — `role` was never part of the frozen
 * claim shape, and `SessionSubjectStateProvider`'s projection is exactly
 * `{tokenVersion:1, accountStatus:1}` (SEC-3C, unchanged). Neither
 * checkpointed module can supply `role` without being modified, which is
 * out of this phase's authority. User realm only; Employer accounts have
 * no `role` field (confirmed, `AccountSecurityMutationContracts.js`) — the
 * employer principal's `role` is the fixed realm marker `'employer'`,
 * matching the legacy `requireEmployerAuth` convention.
 *
 * **SEC-3E.1 correction.** The original query was `findById(subjectId,
 * {role:1})` — `_id` only, with no `tokenVersion` binding. Because
 * `AccountSecurityMutationService.changeRole` always mutates `role` and
 * `tokenVersion` together in one atomic `$set`/`$inc` write, an `_id`-only
 * role read performed *after* the coordinator's own tokenVersion-gated
 * authorization could observe a role promotion that committed strictly
 * between the coordinator's read and this one — attaching the *new* role
 * to a request already authorized against the *old* tokenVersion. This was
 * reproduced against the live composition (see the SEC-3E report's
 * correction record) and is closed here by binding this query to the
 * exact verified `tokenVersion`, not `_id` alone: because role and
 * tokenVersion only ever change together, a query matching both proves the
 * returned role is the same role that was in effect at the tokenVersion
 * the coordinator already authorized — if a promotion (or demotion)
 * committed in between, `tokenVersion` no longer matches and this query
 * returns no document, failing closed to a version-mismatch result rather
 * than ever attaching a role that raced ahead of (or behind) the
 * authorized version snapshot.
 */
async function loadVersionBoundUserRole(userModel, subjectId, tokenVersion) {
  let doc;
  try {
    doc = await userModel.findOne(
      { _id: subjectId, tokenVersion },
      { role: 1 }
    );
  } catch {
    return Object.freeze({ code: 'STORAGE_FAILURE' });
  }
  if (!doc || typeof doc.role !== 'string' || !doc.role) {
    // No document matches both the exact subject and the exact
    // already-authorized tokenVersion — either the subject vanished, or
    // (far more plausibly) a role/tokenVersion mutation committed between
    // the coordinator's authorization read and this one. Either way this
    // is not a proven role, and must never be treated as one.
    return Object.freeze({ code: 'VERSION_MISMATCH' });
  }
  return Object.freeze({ code: 'OK', role: doc.role });
}

/**
 * SEC-3E — the composed secure `requireAuth` replacement, implementing the
 * exact ordered sequence frozen in
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md §12.2:
 *
 *   1. Verify the access JWT cryptographically.
 *   2-4. Algorithm/issuer/audience/type/realm/sub/sid/jti/tokenVersion
 *        shape — all already enforced inside `JwtSessionProvider.verifyAccessToken`
 *        (SEC-3B, unchanged).
 *   3. Check the mandatory shared denylist using `jti` (§12.1).
 *   4. Fail closed on denylist storage failure.
 *   5-7. Authoritative subject-state + tokenVersion check — the canonical
 *        `AccessAuthorizationCoordinator` (SEC-3D.4, unchanged).
 *   8. Authorize only once every prior step has passed.
 *
 * An unverified decode is used only to select which realm's provider to
 * attempt cryptographic verification with — never trusted for
 * authorization. A token whose true realm does not match a provider it is
 * checked against fails that provider's own audience check and is never
 * granted access by falling through to the other realm's provider with a
 * different outcome; each provider is tried strictly for verification, and
 * only a token that verifies is ever authorized.
 */

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  if (!authorizationHeader.startsWith('Bearer ')) return null;
  const token = authorizationHeader.slice('Bearer '.length);
  return token.length > 0 ? token : null;
}

function decodeRealmHint(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && (decoded.realm === 'user' || decoded.realm === 'employer')) {
      return decoded.realm;
    }
  } catch {
    // fall through — no usable hint
  }
  return null;
}

/**
 * `exp` is not part of `JwtSessionProvider.verifyClaims`'s returned claim
 * subset (`{sub, realm, sid, jti, tokenVersion}`) — decoded separately,
 * only after cryptographic verification has already succeeded, purely to
 * hand the caller (logout) the token's own real remaining lifetime for the
 * denylist TTL (§12.1). Not a new trust decision — the token is already
 * known-good by this point.
 */
function decodeExpClaim(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded && typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} config
 * @param {object} config.userJwtProvider — required.
 * @param {object} config.employerJwtProvider — required.
 * @param {object} config.denylistService — required, exposes `isJtiDenylisted`.
 * @param {object} [config.userAccessCoordinator] — defaults to a real
 *   `AccessAuthorizationCoordinator` bound to `userJwtProvider`.
 * @param {object} [config.employerAccessCoordinator] — defaults to a real
 *   `AccessAuthorizationCoordinator` bound to `employerJwtProvider`.
 */
export function createSecureAccessAuthorization({
  userJwtProvider,
  employerJwtProvider,
  denylistService,
  userAccessCoordinator,
  employerAccessCoordinator,
  userModel = User,
} = {}) {
  if (
    !userJwtProvider ||
    typeof userJwtProvider.verifyAccessToken !== 'function'
  ) {
    throw new TypeError(
      'userJwtProvider exposing verifyAccessToken is required'
    );
  }
  if (
    !employerJwtProvider ||
    typeof employerJwtProvider.verifyAccessToken !== 'function'
  ) {
    throw new TypeError(
      'employerJwtProvider exposing verifyAccessToken is required'
    );
  }
  if (
    !denylistService ||
    typeof denylistService.isJtiDenylisted !== 'function'
  ) {
    throw new TypeError('denylistService exposing isJtiDenylisted is required');
  }

  const resolvedUserCoordinator =
    userAccessCoordinator ||
    createAccessAuthorizationCoordinator({
      jwtSessionProvider: userJwtProvider,
    });
  const resolvedEmployerCoordinator =
    employerAccessCoordinator ||
    createAccessAuthorizationCoordinator({
      jwtSessionProvider: employerJwtProvider,
    });

  function providerFor(realm) {
    return realm === 'employer' ? employerJwtProvider : userJwtProvider;
  }

  function coordinatorFor(realm) {
    return realm === 'employer'
      ? resolvedEmployerCoordinator
      : resolvedUserCoordinator;
  }

  /**
   * Authorize one incoming request's `Authorization` header. Returns a
   * framework-agnostic result — the middleware layer translates this into
   * an Express response / `req.user`/`req.employer` attachment.
   */
  async function authorizeRequest({ authorizationHeader }) {
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      return Object.freeze({
        code: 'ACCESS_TOKEN_MISSING',
        httpStatus: 401,
        body: SAFE_BODIES.AUTHENTICATION_REQUIRED,
      });
    }

    const hint = decodeRealmHint(token);
    const attemptOrder = hint ? [hint] : ['user', 'employer'];

    let claims = null;
    let verifiedRealm = null;
    for (const realm of attemptOrder) {
      try {
        claims = providerFor(realm).verifyAccessToken(token);
        verifiedRealm = realm;
        break;
      } catch {
        claims = null;
      }
    }

    if (!claims) {
      return Object.freeze({
        code: 'ACCESS_TOKEN_INVALID',
        httpStatus: 401,
        body: SAFE_BODIES.ACCESS_UNAUTHORIZED,
      });
    }

    // Denylist check — after cryptographic verification, before
    // authorization success (§12.1).
    const denylistResult = await denylistService.isJtiDenylisted(claims.jti);
    if (denylistResult.code === 'STORAGE_FAILURE') {
      return Object.freeze({
        code: 'ACCESS_STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
      });
    }
    if (denylistResult.code !== 'CHECKED') {
      return Object.freeze({
        code: 'ACCESS_STORAGE_FAILURE',
        httpStatus: 503,
        body: SAFE_BODIES.SERVICE_UNAVAILABLE,
      });
    }
    if (denylistResult.denylisted) {
      return Object.freeze({
        code: 'ACCESS_DENYLISTED',
        httpStatus: 401,
        body: SAFE_BODIES.ACCESS_UNAUTHORIZED,
      });
    }

    const authResult = await coordinatorFor(verifiedRealm).authorize({
      presentedAccessToken: token,
    });

    if (authResult.code !== 'ACCESS_AUTHORIZED') {
      return Object.freeze({
        code: authResult.code,
        httpStatus: mapAccessResultToHttpStatus(authResult.code),
        body:
          mapAccessResultToHttpStatus(authResult.code) === 503
            ? SAFE_BODIES.SERVICE_UNAVAILABLE
            : SAFE_BODIES.ACCESS_UNAUTHORIZED,
      });
    }

    let role = 'employer';
    if (verifiedRealm === 'user') {
      const roleResult = await loadVersionBoundUserRole(
        userModel,
        claims.sub,
        claims.tokenVersion
      );
      if (roleResult.code === 'STORAGE_FAILURE') {
        return Object.freeze({
          code: 'ACCESS_STORAGE_FAILURE',
          httpStatus: 503,
          body: SAFE_BODIES.SERVICE_UNAVAILABLE,
        });
      }
      if (roleResult.code !== 'OK') {
        // VERSION_MISMATCH — a race, deletion, or authoritative-state
        // change occurred between the coordinator's authorization read and
        // this role read. Fail closed exactly like a stale-tokenVersion
        // access attempt: no principal, no downstream middleware.
        return Object.freeze({
          code: 'ACCESS_VERSION_MISMATCH',
          httpStatus: 401,
          body: SAFE_BODIES.ACCESS_UNAUTHORIZED,
        });
      }
      role = roleResult.role;
    }

    // Minimal verified principal only — no raw token, no session document,
    // no provider internals.
    return Object.freeze({
      code: 'ACCESS_AUTHORIZED',
      httpStatus: 200,
      principal: Object.freeze({
        realm: verifiedRealm,
        subjectId: claims.sub,
        sid: claims.sid,
        jti: claims.jti,
        tokenVersion: claims.tokenVersion,
        role,
        exp: decodeExpClaim(token),
      }),
    });
  }

  return Object.freeze({ authorizeRequest });
}

/** Canonical runtime singleton. */
export const secureAccessAuthorization = createSecureAccessAuthorization({
  userJwtProvider: secureAuthConfig.userJwtProvider,
  employerJwtProvider: secureAuthConfig.employerJwtProvider,
  denylistService: createAccessDenylistService({
    requireSharedStore: secureAuthConfig.requireSharedDenylistStore,
  }),
});
