# STRIDETO SEC-3D.4 — Dormant Access-Authorization Coordinator

**Status**: implemented, dormant, unwired. Not production-ready. Not live. No route, controller, or middleware imports this module. No database connection is made by this module or its tests.

**Authority**: `docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md`, §12, §14.5, §18.

## Purpose

A subject-state-only access-authorization coordinator. Composes `JwtSessionProvider` (access-token verification) and `SessionSubjectStateProvider` (already built, SEC-3C) only — no denylist, no Redis, no `RefreshSession` read, no SEC-3D.1 dependency, no SEC-3D.2 dependency, no mutation. The eventual composition of this coordinator with the hardened denylist inside `middleware/auth.js` remains SEC-3E's job, not built or activated here.

## Files

| File                                                          | Kind                |
| ------------------------------------------------------------- | ------------------- |
| `server/src/services/auth/AccessAuthorizationContracts.js`    | new                 |
| `server/src/services/auth/AccessAuthorizationCoordinator.js`  | new                 |
| `server/src/__tests__/accessAuthorizationCoordinator.test.js` | new — 43 assertions |

No route, controller, middleware, or startup file is touched.

## Public method

`authorize({presentedAccessToken})` — the single external input. `realm`, `sub`, `tokenVersion` all come from the token's own verified claims.

## Exact sequence

1. Validate input (non-empty string).
   2/3/4. Verify the access JWT and its claims, including realm (`JwtSessionProvider.verifyAccessToken`) — any failure maps to `ACCESS_TOKEN_INVALID`.
2. Exactly one authoritative `SessionSubjectStateProvider.getSubjectState` read, `expectedTokenVersion` bound to the claim's own value — no cache, no reuse of any prior decision, no process-local fallback.
   6/7/8. Subject existence, valid state, and active status are all required — `SUBJECT_MISSING`/`SUBJECT_INACTIVE`/`SUBJECT_STATE_INVALID` from the provider all collapse into the single external `ACCESS_SUBJECT_INACTIVE`, matching §14.5's own single-code definition and the anti-enumeration posture already established throughout this architecture (never let a caller distinguish "never existed" from "suspended" from "corrupted").
3. Exact `tokenVersion` equality — mismatch maps to `ACCESS_VERSION_MISMATCH`.
4. Authorize only after every prior check passes.

Storage failure and any unrecognized provider outcome both fail closed to `ACCESS_STORAGE_FAILURE` — never authorized by default.

## Result taxonomy

`ACCESS_AUTHORIZED`, `ACCESS_SUBJECT_INACTIVE`, `ACCESS_VERSION_MISMATCH`, `ACCESS_STORAGE_FAILURE`, `ACCESS_TOKEN_INVALID`, `INVALID_INPUT` — exactly six codes, every one unique, every result exactly `{code}`. `ACCESS_DENYLISTED` is deliberately **not** part of this module's own result set — confirmed by a dedicated test — since it is SEC-3E's own future composition concern, never producible by a subject-state-only coordinator.

## Realm isolation

Verified for both User and Employer realms independently: the coordinator never infers realm from whichever model happens to return a document — it uses only the token's own verified `realm` claim, passed through exactly to the authoritative read.

## Zero stale-positive posture

Verified explicitly: two successive calls with the same token but a changed underlying subject state (active → suspended, simulated between calls) produce different results — no cached allow, no reused prior decision. `tokenVersion === 0` is confirmed to authorize correctly, not mistaken for a missing/falsy claim value.

## Residual race

SEC-3D.4 makes an authoritative fail-closed authorization decision at the time of its subject-state read. An unavoidable interval remains between that read and a downstream protected action. SEC-3E owns the live composition and any stronger caller-level ordering or revalidation required for sensitive actions.

## Dependency boundary

Confirmed via source-level import inspection (not a broad text search, which would falsely flag doc-comment mentions): no import of `utils/tokenStore.js`, `config/redis.js`, `ioredis`, the `RefreshSession` model or any of its services, `AccountSecurityMutation*` (SEC-3D.2), or `SessionFamilyRevocation*` (SEC-3D.1).

## Sensitive-data protection

No result exposes an access token, JWT claim beyond what's already embedded in the caller's own presented token, `tokenVersion`, subject ID, realm, model document, or raw error.

## Verification evidence

- Focused suite: 43 assertions passed.
- `npm run lint` — clean.
- `npx prettier --check` — clean.
- `node --check` — clean.
- Dormancy: zero matches for `AccessAuthorization` outside `services/auth/`, `__tests__/`, and its own report; confirmed `middleware/auth.js` untouched.

## Non-claims

Not production-ready, not live, not wired into `middleware/auth.js` or any route. Does not compose with the denylist — that composition, and its own hardening contract (§12.1), remain entirely SEC-3E's responsibility.
