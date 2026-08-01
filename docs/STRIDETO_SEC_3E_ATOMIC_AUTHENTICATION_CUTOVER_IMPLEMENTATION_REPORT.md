# STRIDETO SEC-3E — Atomic Server-and-Browser Authentication Cutover Implementation Report

**Status**: implemented, boot-time flag-gated, **not yet activated in any deployed environment**. This report describes the actual implementation only. No production-readiness, deployment, or real-infrastructure-acceptance claim is made anywhere in this document — those are SEC-3F's and SEC-3G's jobs, both entirely unstarted.

**Authority**: `docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md` (as corrected by SEC-3A.3, commit `b83c5aa`), `docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md`, and the SEC-3B/3C/3D.1–3D.4 dormant module reports.

**Revision note (SEC-3E.1 correction pass).** The consolidated final acceptance audit of the original SEC-3E pass found three real defects, all confirmed against live code (one by direct reproduction) rather than assumed, plus test-coverage and report-accuracy gaps:

1. **Role-authority promotion race (critical, confirmed by live reproduction).** The original supplementary User role read (`secureAccessAuthorization.js`) queried by `_id` alone, after the authoritative `AccessAuthorizationCoordinator` tokenVersion check had already passed. Because `AccountSecurityMutationService.changeRole` always mutates `role` and `tokenVersion` together in one atomic write, an `_id`-only read performed strictly after that check could observe a role promotion that committed in the narrow window between the coordinator's read and this one — attaching the _new_ role to a request already authorized against the _old_, about-to-be-invalidated tokenVersion. Reproduced against the live composition during the audit, then corrected here: the role read is now bound to both the exact subject ID _and_ the exact already-verified `tokenVersion`, in the same query (§10). Demotion was already, and remains, safe.
2. **Trusted-origin route ordering and coverage.** The original pass called `TrustedRequestOriginPolicy` by hand inside individual controller functions — in `login` and `employerRegister`/`employerLogin`, this happened _after_ a real database write/read (a `lastLoginAt` update, an `Employer.create`) had already occurred; `change-password` had no origin check at all, and the report incorrectly claimed one existed "upstream via the access middleware," which never inspects `Origin`/`Referer`. Corrected by introducing `middleware/secureTrustedOrigin.js` as the single authoritative, route-level composition point, applied as the first handler on every required route, strictly before any database access, password comparison, account creation, token issuance, or mutation (§7, §9 of the audit's own required list).
3. **Silent secure-client / legacy-server default mismatch.** The rewritten client is secure-mode-only (no legacy `localStorage`/JSON-refresh-token fallback remains anywhere in it), but the original flag contract silently defaulted an unset `STRIDETO_SECURE_AUTH_ENABLED` to legacy mode outside production, with no warning — a pre-existing local `server/.env` predating this phase would silently pair a legacy-mode server with a client that can never successfully refresh against it. Corrected: the flag is now mandatory in every environment, with no silent default anywhere (§3).

No role claim was added to `JwtSessionProvider`. No legacy browser fallback (`localStorage`, JSON refresh token, body/header refresh token) was restored anywhere. No checkpointed dormant SEC-3B/3C/3D module was modified. One new middleware file (`middleware/secureTrustedOrigin.js`) and one new focused test file (`__tests__/secureTrustedOriginComposition.test.js`) were added; `secureAccessAuthorization.test.js` and `secureAuthConfig.test.js` were extended with deterministic race/configuration tests; `userSecureAuthFlows.test.js`/`employerSecureAuthFlows.test.js` required one mechanical, non-behavioral change (switching a static import to a flag-setting dynamic import) as a direct, unavoidable consequence of item 3 above, since both transitively trigger `secureAuthConfig.js`'s module-load-time singleton.

## 1. Repository baseline

Preflight before this phase: HEAD `b83c5aacc2e12339c7d9e747eac6540b0ff6a77f`, parent `99dada7c3bcd291fed527b762a92d7856b838088`, branch `main...origin/main [ahead 30]`, clean tracked tree, no staged file, untracked files exactly the two preserved reports. Confirmed matching before any edit.

## 2. Exact file boundary

### Server — new files (all under `server/src/services/auth/`)

| File                           | Purpose                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secureAuthConfig.js`          | Boot-time flag resolution, per-realm `JwtSessionProvider` construction, `AuthCookiePolicy`/`TrustedRequestOriginPolicy` construction — computed exactly once, at module load |
| `initialSessionIssuance.js`    | Login-time `RefreshSession` creation with a locally preallocated `sid`                                                                                                       |
| `accessDenylist.js`            | `jti`-keyed access-token denylist, fail-closed in required-shared-store (production) mode                                                                                    |
| `secureAuthResultMapping.js`   | The one finite refresh/access result-to-HTTP mapping layer                                                                                                                   |
| `secureAccessAuthorization.js` | The composed secure `requireAuth` replacement                                                                                                                                |
| `userSecureAuthFlows.js`       | User-realm orchestration (login/refresh/logout/logout-all/change-password/reset-password/suspend/reactivate/role-change)                                                     |
| `employerSecureAuthFlows.js`   | Employer-realm orchestration (login/refresh/logout/logout-all/suspend/reactivate)                                                                                            |

**SEC-3E.1 addition**: `server/src/middleware/secureTrustedOrigin.js` — the single authoritative route-level trusted-origin composition point (§7).

### Server — modified files

`server/src/config/validateEnv.js`, `server/src/controllers/authController.js`, `server/src/controllers/employerAuthController.js`, `server/src/middleware/auth.js`, `server/src/routes/auth.js`, `server/src/routes/employer.js`, `server/src/controllers/admin/usersController.js`.

**SEC-3E.1 addition**: `server/src/services/auth/secureAccessAuthorization.js` (role-authority correction, §10).

### Server — new tests (`server/src/__tests__/`)

`secureAuthConfig.test.js` (37), `initialSessionIssuance.test.js` (27), `accessDenylist.test.js` (17), `secureAuthResultMapping.test.js` (25), `secureAccessAuthorization.test.js` (42), `userSecureAuthFlows.test.js` (35), `employerSecureAuthFlows.test.js` (17), `secureTrustedOriginComposition.test.js` (60) — **8 files, 260 assertions**, all against injected doubles or actual (not merely searched) middleware/route-stack invocation, no live MongoDB/Redis connection.

**SEC-3E.1 test-evidence addition.** `secureAuthConfig.test.js` gained one further isolated test block proving the _actual exported runtime singleton_ (`secureAuthConfig`, not merely the pure `buildSecureAuthConfig` function) is immune to a `process.env` mutation occurring after module evaluation: the block dynamically imports `secureAuthConfig.js` under a cache-busting query string, captures the resulting singleton, asserts `enabled === true`, mutates `process.env.STRIDETO_SECURE_AUTH_ENABLED` to `'0'`, then re-reads the same module export and asserts both that `enabled` remains `true` and that the re-read value is the identical object reference — proving no recomputation occurred. All environment values touched by this block are captured before mutation and restored in a `finally` block. This closes the gap the final narrow re-audit identified: the prior "Boot-time-only" block only proved `buildSecureAuthConfig` was a deterministic pure function across two separate calls, not that the real singleton resists a later environment change. The guarantee proven is narrow and exact: the already-created exported configuration object is not recomputed after a later `process.env` mutation — no claim is made that `process.env` itself is frozen or that any other module's env-derived state behaves the same way.

**SEC-3E.1 note on `userSecureAuthFlows.test.js`/`employerSecureAuthFlows.test.js`**: each required one mechanical change — a static import of the module under test was replaced with a flag-setting dynamic import — because both files transitively trigger `secureAuthConfig.js`'s module-load-time singleton, which now requires the flag to be set explicitly (§3). No test logic, assertion, or behavior changed; both files' assertion counts are unchanged from the original pass.

### Client — modified files

`client/src/services/axiosBase.js`, `client/src/services/employerService.js`, `client/src/context/AuthContext.jsx`, `client/src/context/EmployerAuthContext.jsx`, `client/src/services/authService.js`.

### Client — new tests

`client/src/__tests__/secureAuthClientContract.test.js` (39 assertions) — static source-text verification (no browser/jsdom exists in this repository; see §12).

### Environment examples (6, all consistently updated)

`.env.example`, `.env.template`, `.env.production.example`, `.env.staging`, `docker/.env.production.example`, `docker/.env.staging.example` — each gained `REFRESH_SECRET` and `STRIDETO_SECURE_AUTH_ENABLED=1`; `docker/.env.production.example` also had its previously-commented `REDIS_URL` uncommented (now a hard production requirement).

### Documentation

This report. No architecture document was modified — no new implementation-blocking contradiction was found once the SEC-3A.3 audience correction was already checkpointed.

### Unauthorized files

None. Every touched file is in the list above; the two files added in the SEC-3E.1 correction pass (`middleware/secureTrustedOrigin.js`, `__tests__/secureTrustedOriginComposition.test.js`) were both explicitly authorized by that correction's own task scope.

## 3. Secure runtime flag

**SEC-3E.1 correction: no silent default in any environment.** `STRIDETO_SECURE_AUTH_ENABLED` is now mandatory everywhere — production, development, and test alike. Accepted values are exactly `'1'` or `'0'`; **unset is a thrown configuration error**, not a silent legacy default (the original pass treated unset as `'0'` outside production, which is exactly the defect this correction closes — see the revision note above). Read exactly once at module load (`secureAuthConfig.js`'s top-level `export const secureAuthConfig = buildSecureAuthConfig(process.env)` — ES module caching guarantees single evaluation per process); no per-request re-evaluation exists anywhere.

- `'1'` — secure mode, compatible with the current (secure-only) browser client.
- `'0'` — explicit legacy-server-only regression mode, selectable only outside production; emits exactly one clear, secret-free startup warning (`console.warn`) stating that the current client is secure-only and this mode must not be used for full-stack browser testing.
- unset — throws `STRIDETO_SECURE_AUTH_ENABLED is required and must be set explicitly to "1" or "0" — no environment (production, development, or test) may silently default to legacy authentication mode`.
- any other value — throws a distinct malformed-value error.

In production, the flag must additionally equal `'1'` specifically — `validateEnv.js` hard-fails the process (`process.exit(1)`) if it is missing or `'0'`, extending the exact `JWT_SECRET` hard-fail pattern already established. Full-stack local development requires `STRIDETO_SECURE_AUTH_ENABLED=1`; all six environment example files already set this value (unchanged from the original pass — they were already correct). `'0'` remains available only as a deliberate, self-documenting, non-production regression mode for exercising legacy server behavior in isolation — never browser-client compatible, and never selected by omission.

## 4. JWT configuration

Exactly the checkpointed SEC-3A.3 matrix, unchanged: issuer `strideto-api`; audiences `strideto-user-access`/`strideto-user-refresh`/`strideto-employer-access`/`strideto-employer-refresh` (frozen application constants, not environment-configured); access secret `JWT_SECRET`; refresh secret `REFRESH_SECRET`; both required, both must differ. One `JwtSessionProvider` instance per realm — never shared. `JwtSessionProvider.js` itself was not modified. The legacy `utils/jwt.js` signer is never called from any secure-mode branch (verified by direct search, §11).

## 5. Initial `RefreshSession` issuance

`initialSessionIssuance.js` generates the `RefreshSession` `_id` locally (`new mongoose.Types.ObjectId()`, injectable for tests) **before** either token is signed, uses it as the stable `sid` embedded in both tokens, hashes the refresh token, and only then performs the single `create()` write. No cookie is written and no token is returned to any caller on a write failure — confirmed by test (`initialSessionIssuance.test.js`, storage-failure and issuance-failure cases). Only the SHA-256 hash is persisted; the raw refresh token never touches the database or a log line.

## 6. Cookie contract

`AuthCookiePolicy` used exactly as checkpointed, unmodified. User: `__Secure-strideto_user_rt` (prod) / `strideto_dev_rt` (dev), `Path=/api/auth/refresh-token`. Employer: `__Secure-strideto_employer_rt` (prod) / `strideto_dev_employer_rt` (dev), `Path=/api/auth/employer/refresh-token`. `HttpOnly: true`, `SameSite: Lax`, `Domain` unset, `Secure` true in production / false in development, `Max-Age` = the accepted 7-day `REFRESH_SESSION_DEFAULT_TTL_MS`. Set and clear always go through the same `cookiePolicy` instance, so attributes can never drift between the two calls. No `cookie-parser` dependency was added — `AuthCookiePolicy`'s own dependency-free header parser (SEC-3C) is used unchanged, confirmed sufficient.

## 7. Trusted-origin coverage

**SEC-3E.1 correction — route-level composition, not hand-called controller checks.** The original pass called `TrustedRequestOriginPolicy` by hand inside individual controller functions; this was verified, during the consolidated acceptance audit, to be incorrectly ordered on two routes (a real `lastLoginAt` write in `login`, a real `Employer.create` in `employerRegister`, both occurred _before_ the check) and entirely absent on a third (`change-password`, whose report text incorrectly claimed the access middleware performed this check — it does not; `middleware/auth.js` never inspects `Origin`/`Referer`).

`server/src/middleware/secureTrustedOrigin.js` is now the single authoritative composition point, delegating entirely to the already-checkpointed, unmodified `TrustedRequestOriginPolicy` via `secureAuthConfig.originPolicy` — no origin-matching algorithm is duplicated. It is registered as the **first route-specific handler** — before `requireAuth` on authenticated routes, before any validation/controller code on unauthenticated routes — on exactly these routes:

| Route                                   | Ordering                                                             |
| --------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/auth/login`                  | secureTrustedOrigin → authLimiter\* → controller                     |
| `POST /api/auth/refresh-token`          | refreshLimiter\* → secureTrustedOrigin → controller                  |
| `POST /api/auth/logout`                 | secureTrustedOrigin → requireAuth → requireUserAuth → controller     |
| `POST /api/auth/logout-all`             | secureTrustedOrigin → requireAuth → requireUserAuth → controller     |
| `POST /api/auth/change-password`        | secureTrustedOrigin → requireAuth → requireUserAuth → controller     |
| `POST /api/auth/reset-password`         | authLimiter\* → secureTrustedOrigin → controller                     |
| `POST /api/auth/employer/register`      | employerAuthLimiter\* → secureTrustedOrigin → controller             |
| `POST /api/auth/employer/login`         | employerAuthLimiter\* → secureTrustedOrigin → controller             |
| `POST /api/auth/employer/refresh-token` | refreshLimiter\* → secureTrustedOrigin → controller                  |
| `POST /api/auth/employer/logout`        | secureTrustedOrigin → requireAuth → requireEmployerAuth → controller |
| `POST /api/auth/employer/logout-all`    | secureTrustedOrigin → requireAuth → requireEmployerAuth → controller |

\* Rate limiters are volumetric-abuse protection, orthogonal to origin validation, and are kept first by design — they are not in the audit's list of side effects the origin check must precede (database reads, password comparison, account creation, `lastLoginAt` writes, audit logging, token issuance, rotation, revocation, password mutation, cookie writes/clears), and running them first protects the server from abuse before doing _any_ per-request work, including the cheap origin check itself.

The redundant, now-superseded hand-called checks were **removed** from `authController.js` and `employerAuthController.js` (not retained as misleading "defense-in-depth" that could never have protected the side effects that already preceded them in the same function) — confirmed by direct search, zero remaining references to the old per-controller `isOriginTrusted` helper in either file. `userSecureAuthFlows.refresh()`/`logoutCurrent()`/`logoutAll()` retain their own internal origin checks: these were already correctly ordered (first action in their respective functions, before any mutation within that function) and are kept as genuine defense-in-depth, not removed.

A missing/malformed/`null`/untrusted origin returns `403 {"error":"origin_validation_failed"}` — matching the architecture's exact §19 point 8 error shape — with no raw `Origin`/`Referer` echoed and no configured trusted-origin list ever leaked (confirmed by test). User registration still has no origin check anywhere (it does not authenticate on this platform and issues no token/cookie; not identified as requiring correction by the audit).

## 8. Refresh flow

Both realms: extract the refresh token from the realm's own cookie only (`AuthCookiePolicy.extractRefreshToken`); `req.body`/`x-refresh-token` are never read in the secure branch (confirmed, §11). Delegates to `RefreshEligibilityCoordinator.attemptRefresh` unmodified. `REFRESH_ROTATED` → 200, new cookie written, access token only in the JSON body. `CONFLICT_BENIGN` → 409 with `Retry-After: 1`, cookie untouched. Every other terminal code clears the cookie (`shouldClearRefreshCookie`); `STORAGE_FAILURE`/`CLASSIFICATION_STALE` never clear it (transient-failure ≠ proven-bad-credential).

## 9. User login / Employer login

Existing credential validation, `accountStatus`/temp-password/email-verification checks, and safe error semantics are all preserved unchanged — only the token-issuance tail of `login`/`employerLogin`/`employerRegister` branches on `secureAuthConfig.enabled`. User `register` does not authenticate today (confirmed unchanged in this phase, live-code-verified) and was not given a secure branch, per the task's explicit instruction not to invent automatic login where none exists. Employer `register` does authenticate (issues a session immediately) and received the identical secure branch as `employerLogin`. No refresh token appears in secure-mode JSON for any of these (confirmed, §11); no legacy Redis refresh-slot write occurs in secure mode; no legacy signer call occurs in secure mode.

## 10. Access middleware

`middleware/auth.js`'s `requireAuth`/`optionalAuth` now branch on `secureAuthConfig.enabled` at the top; every downstream consumer (`requireUserAuth`, `requireEmployerAuth`, `requireRole`, `requireAdmin`, `requireUser`, and every non-auth controller reading `req.user.userId`/`req.employer.employerId`) needed **zero changes**, because `secureAccessAuthorization`'s principal is mapped onto the exact legacy `req.user`/`req.employer` shape (`userId`/`employerId`, `role`) before `next()` is called.

Composed sequence, matching readiness-audit §12.2 exactly: Bearer extraction → unverified realm-hint decode (routing only, never trusted for authorization — a token whose true realm doesn't match a provider simply fails that provider's own audience check) → cryptographic verification via the matching realm's `JwtSessionProvider` → mandatory `jti` denylist check (`accessDenylist.js`) → `AccessAuthorizationCoordinator.authorize` (SEC-3D.4, unmodified) → authorize only on `ACCESS_AUTHORIZED`.

**Role sourcing — corrected, SEC-3E.1.** `JwtSessionProvider`'s access-token claims are exactly `{sub, realm, sid, jti, tokenVersion}` (architecture §19A) and `SessionSubjectStateProvider`'s projection is exactly `{tokenVersion:1, accountStatus:1}` (SEC-3C) — neither checkpointed, must-not-weaken module carries `role`, and no role claim was added to `JwtSessionProvider` in this correction either. `secureAccessAuthorization.js` performs exactly one additional User-realm database read, but it is now a **`tokenVersion`-bound query, not an `_id`-only one**:

```js
User.findOne(
  { _id: claims.sub, tokenVersion: claims.tokenVersion },
  { role: 1 }
);
```

**The original defect, corrected.** The prior pass queried by `_id` alone, executed strictly _after_ `AccessAuthorizationCoordinator` had already confirmed the presented token's `tokenVersion` matched the authoritative value at the moment of _that_ read. Because `AccountSecurityMutationService.changeRole` always mutates `role` and `tokenVersion` together in one atomic `$set`/`$inc` write, a role change occurring in the narrow window between the coordinator's read and the original `_id`-only role read could be observed by the latter without the former's authorization having accounted for it — attaching a newly promoted role to a request already authorized against the old tokenVersion. This was reproduced against the live composition during the consolidated acceptance audit (an old tokenVersion=0 token was authorized with an attached `role: 'Admin'` that had only just been granted, one request before that same token would fail on tokenVersion mismatch) and is now closed structurally: because role and tokenVersion are only ever changed together, a query that requires both to match proves the returned role is the exact role that was already in effect at the already-authorized tokenVersion snapshot. If a role/tokenVersion mutation committed in between the two reads, the version-bound query matches no document — the request fails closed to `ACCESS_VERSION_MISMATCH` (401), with no principal attached and no downstream middleware ever reached, exactly like an ordinary stale-tokenVersion access attempt. A `findOne` throw maps to `ACCESS_STORAGE_FAILURE` (503), also with no principal attached. Demotion was already safe under the original code (the coordinator's own tokenVersion check rejects a demoted old token before the role read is ever reached) and remains so, now additionally covered by a dedicated test proving the role query is never even called in that case.

Employer principals continue to get the fixed realm marker `'employer'` (no DB read — Employer documents have no `role` field at all, matching the legacy `requireEmployerAuth` convention).

## 11. Denylist

`accessDenylist.js` is entirely new and independent of `utils/tokenStore.js`, which is **completely untouched** by this phase (confirmed by empty `git diff`). Key material is the token's own `jti` claim (never the raw token or a hash of it). TTL is derived from the presented access token's own `exp` claim at the call site (`remainingTtlSeconds` in each flow module) — never a hardcoded constant. In production (`secureAuthConfig.requireSharedDenylistStore === true`), a missing/unreachable Redis client fails every check and every write closed (`STORAGE_FAILURE`) — confirmed by test — and never falls back to an in-memory `Map`; `validateEnv.js` additionally hard-fails server startup if `REDIS_URL` is absent in production, so the fallback branch is not merely discouraged but unreachable by construction in that mode. Outside production, an in-memory fallback keeps the module usable in local development. `tokenStore.js`'s disposition is unchanged from the accepted architecture: it remains present, unmodified, legacy-only, and its deletion remains SEC-3G's job.

## 12. Logout-current / logout-all

**Logout-current**: `revokeCurrentFamily(realm, subjectId, sid, reason:'logout')` + denylist the presenting token's `jti` for its exact remaining lifetime; the client only sees `LOGGED_OUT` once both operations are known-good — any partial failure returns a distinct `LOGOUT_PARTIAL_FAILURE` (503), never a false-positive success, matching §12.1's explicit partial-failure requirement.

**Logout-all**: `AccountSecurityMutationService.incrementTokenVersionForLogoutAll` (caller-held `expectedTokenVersion` from the verified principal) runs **first** and is the sole authority for the client-visible result; `SessionFamilyRevocationService.revokeAllFamilies(reason:'logout_all')` and the current-token denylist write run only after, as best-effort, defense-in-depth cleanup whose own outcome is never surfaced or allowed to override the already-authoritative version bump. New routes: `POST /auth/logout-all` (User), `POST /auth/employer/logout-all` (Employer) — following the existing `/auth/logout`/`/auth/employer/logout` naming convention exactly, since no route shape was previously frozen for this operation.

## 13. Password change / reset

**Change** (authenticated): `AccountSecurityMutationService.changePassword` with the verified principal's `expectedTokenVersion` is the sole password/version write; on `VERSION_INCREMENTED`, an all-family sweep (`reason:'password_change'`) and current-token denylisting follow, then the cookie is cleared, forcing reauthentication. No second password write exists anywhere in the controller.

**Reset** (unauthenticated): the narrowest safe pre-read (`{_id:1}` only, matching the exact filter the existing legacy code already used) captures the subject id purely for the post-success cleanup sweep; `AccountSecurityMutationService.resetPassword`'s own single atomic write (Design 1: one write, zero reads, zero retries) remains the sole authority. Every code path — success or failure, subject found or not — returns the identical generic response; confirmed by test that a failing reset and a successful reset produce byte-identical `{code:'RESET_ATTEMPTED', httpStatus:200}` results at the flow layer.

## 14. Suspension / reactivation / role change

`server/src/controllers/admin/usersController.js`'s `updateUser`, `assignRole`, `bulkAssignRole` (User), `updateEmployer`, `bulkSuspendEmployers` (Employer) now route their `accountStatus`/`role` field through the SEC-3D.2 primitives when `secureAuthConfig.enabled` — every other field on these documents (`name`, `province`, `emailVerified`, `verified`, `verificationLevel`, `companyName`) is untouched, still written via the existing `.save()` path, exactly as before. Suspension additionally sweeps all refresh families (`reason:'account_suspended'`) after a successful primitive write. Reactivation uses **Mode A** (`alsoInvalidateAccessTokens: false`) uniformly — no existing admin API exposes a caller-controlled flag for the stronger mode, and the task explicitly forbids inferring one; this is the correct default per the readiness audit (suspension already bumped `tokenVersion`, so Mode A's zero-tokenVersion-touch is not a gap). Bulk paths use bounded per-subject calls (no retry loop) and report `failed` counts rather than silently skipping.

`updateEmployer`'s previously-unvalidated `accountStatus` field now allowlists to `['active','suspended']` — a narrow, in-scope hardening required because the SEC-3D.2 primitives only support that exact transition; legacy mode is unaffected.

**Admin force-revoke**: no exact public route contract existed for this before SEC-3E (confirmed by direct search — the only pre-existing session-invalidation call anywhere in the admin controller was `adminResetPassword`'s `revokeRefreshToken`). Per the task's own instruction, no new public route was invented to expose `incrementTokenVersionForAdminRevoke`/`revokeCurrentFamily`'s `admin_revoked` reason. This capability remains available in the dormant primitives, unexposed, for a future phase with an explicit route contract.

### 14A. Reactivation and legacy-suspended records (SEC-3E.1 documentation addition)

Legacy access tokens cannot survive the secure cutover because they lack the `issuer` and `audience` claims `JwtSessionProvider.verifyAccessToken` requires — a legacy token verifies against neither the secure User nor Employer provider, regardless of `tokenVersion`, regardless of whether the same `JWT_SECRET` value happens to be reused for the access secret. This was confirmed by direct comparison of `utils/jwt.js`'s `signAccessToken` payload shape (no `iss`/`aud` claims at all) against `JwtSessionProvider`'s mandatory verification options.

Therefore, reactivating a record that was suspended under legacy mode (or via the legacy `else` branch of `updateUser`/`updateEmployer`, whose `tokenVersion` was never touched by that suspension) does not revive any legacy-issued token under the secure access middleware — there is no legacy token that could ever verify there in the first place. Mode A (`alsoInvalidateAccessTokens: false`) remains safe for the currently reviewed route set specifically because every secure-mode suspension path (`updateUser`, `updateEmployer`, `bulkSuspendEmployers`) increments `tokenVersion` atomically via `AccountSecurityMutationService.suspend`, and no secure-mode direct-write bypass of that primitive exists anywhere in the repository (confirmed by a repository-wide search for every `accountStatus`/`role` write site).

Any future `accountStatus`-mutation surface added outside this reviewed SEC-3D.2 integration must preserve the same invalidation invariant — routing every transition through the primitive, never writing the field directly in secure mode — or this reasoning no longer holds for that surface. No migration of pre-existing suspended records was performed or is required by this reasoning; it is a structural property of the token-verification claim shape, not a data-state remediation.

## 15. Client — memory-token flow, bootstrap, interceptors, realm isolation

Both `axiosBase.js` and `employerService.js`: the access token lives in a private, module-level variable only (`getAccessToken`/`setAccessToken`/`clearAccessToken` and their Employer equivalents) — never `localStorage`/`sessionStorage`/`IndexedDB` (confirmed by the static-contract test, §16). `withCredentials: true` on both axios instances. The refresh call sends an empty body — no `refreshToken` field, no `x-refresh-token` header. The existing single-flight `refreshPromise` pattern and the `original._retry` bounded-retry guard are both preserved unchanged.

`AuthContext.jsx`/`EmployerAuthContext.jsx`: page load starts unauthenticated in memory by construction (nothing survives a reload); the bootstrap effect attempts a silent cookie-based refresh first, and only hydrates `/auth/me` (User) or re-fetches the profile (Employer) on success. `edurozgaar-user`/`edurozgaar-employer` remain in `localStorage` as a non-authoritative UI cache only (avoids a name/avatar flash) — `isAuthenticated` is derived from `!!user && !!getAccessToken()`, never from the cached profile alone.

**Realm isolation**: `AuthContext`'s bootstrap is already gated by the existing `shouldSkipUserAuthBootstrap` on employer routes; `EmployerAuthContext`'s bootstrap gained a new, reciprocal gate — `isEmployerRoutePrefix(pathname)` — so it no longer fires an employer refresh-cookie attempt on every single page load site-wide (the original localStorage-token-existence check implicitly limited this before; the memory-only design needed an explicit route gate to preserve the same behavior and avoid an unnecessary network call, and rate-limiter pressure, on every non-employer page).

## 16. Legacy paths — secure-mode reachability

Confirmed by direct source search: in every secure-mode branch, `req.body.refreshToken`/`x-refresh-token` are never read; no `refreshToken` field is ever placed in a secure-mode JSON response; no client file writes an access/refresh token to any browser storage; `utils/jwt.js`'s signer and `utils/tokenStore.js`'s Redis refresh-slot functions are never called from a secure-mode branch. Legacy code remains reachable **only** when `secureAuthConfig.enabled` is false, which `validateEnv.js` now makes impossible in production.

## 17. Focused verification

| Module                                      | Assertions                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `secureAuthConfig.test.js`                  | 37 (was 27 — extended with the mandatory-flag/warning tests, then the singleton-immutability-after-mutation test, both SEC-3E.1) |
| `initialSessionIssuance.test.js`            | 27                                                                                                                               |
| `accessDenylist.test.js`                    | 17                                                                                                                               |
| `secureAuthResultMapping.test.js`           | 25                                                                                                                               |
| `secureAccessAuthorization.test.js`         | 42 (was 22 — extended with the four deterministic role-race tests, SEC-3E.1)                                                     |
| `userSecureAuthFlows.test.js`               | 35 (unchanged; import mechanism only, no assertion change)                                                                       |
| `employerSecureAuthFlows.test.js`           | 17 (unchanged; import mechanism only, no assertion change)                                                                       |
| `secureTrustedOriginComposition.test.js`    | 60 (new, SEC-3E.1)                                                                                                               |
| `secureAuthClientContract.test.js` (client) | 39 (unchanged — no client source change in this correction pass)                                                                 |

260 server assertions (was 170, then 256 after the SEC-3E.1 correction pass) + 39 client assertions. Against injected doubles, actual middleware invocation, and actual Express router-stack inspection (the origin-composition test) — zero MongoDB/Redis connections.

## 18. Regression verification

`refreshSessionSchema` (76), `refreshTokenHash` (15), `jwtSessionProvider` (66), `refreshSessionRotation` (59), `authCookiePolicy` (115), `trustedRequestOriginPolicy` (30), `sessionSubjectStateProvider` (61), `sessionFamilyRevocation` (219), `accountSecurityMutation` (245), `refreshEligibilityCoordinator` (172), `accessAuthorizationCoordinator` (43), `auth`, `authRealm`, `employerAuthRealmIsolation`, `emailVerification` — **all pass unchanged**. No test file exists that references `admin/usersController.js` (confirmed by search — no supertest-style route harness exists anywhere in this repository, before or after this phase).

## 19. Complete safe sweep

**SEC-3E.1: 61 files** discovered under `server/src/__tests__/*.test.js` (60 at the end of the original SEC-3E pass + 1 new, `secureTrustedOriginComposition.test.js`). All 61 executed individually via `node <file>` and all 61 exited with status 0. Of those 61: **60 execute and pass their normal assertions**; **1** (`employerPortalIntegration.test.js`) is the same pre-existing, genuinely live-MongoDB integration test, gated behind `EMPLOYER_INTEGRATION_TEST=1` (unset throughout this phase) — confirmed self-skipping, not presented as database-backed proof of anything. No MongoDB or Redis environment variable was set at any point during this phase; no database or cache connection was made.

## 20. Static verification

`npm run lint` (server, full `src` scope) — clean, zero errors/warnings. `npx eslint` (client, all modified files) — zero errors, two pre-existing warnings (`react-refresh/only-export-components`, present before this phase, unrelated to the cutover). `npx vite build` (client) — succeeds cleanly. `node --check` — clean on every new/modified server file. `npx prettier --check`/`--write` — run only on files entirely authored or fully rewritten by this phase (14 new server files + `secureAuthClientContract.test.js` + `axiosBase.js`/`AuthContext.jsx`/`EmployerAuthContext.jsx`, all three fully rewritten with zero pre-existing content retained); partially-edited pre-existing files (`authController.js`, `employerAuthController.js`, `middleware/auth.js`, `usersController.js`, `validateEnv.js`, `routes/auth.js`, `routes/employer.js`, `employerService.js`, `authService.js`) were left as-is to avoid reformatting unrelated inherited lines, per this repository's own established precedent (SEC-3B report §7) — `git diff --check` is clean across the entire change set (only benign CRLF-normalization warnings, no real whitespace errors). All affected tests re-run and re-confirmed passing after formatting.

## 21. Dormant modules now live-composed

Confirmed by direct import search: `JwtSessionProvider.js`, `AuthCookiePolicy.js`, `TrustedRequestOriginPolicy.js`, `RefreshSessionContracts.js`, `refreshTokenHash.js` (SEC-3B/3C), `RefreshEligibilityCoordinator.js` (SEC-3D.3, itself composing `RefreshSessionRotationService.js` and `SessionSubjectStateProvider.js` by default), `AccessAuthorizationCoordinator.js` (SEC-3D.4, composing `SessionSubjectStateProvider.js`), `SessionFamilyRevocationService.js` (SEC-3D.1), and `AccountSecurityMutationService.js` (SEC-3D.2) are all now reachable from the live composition layer when `secureAuthConfig.enabled` is true — effectively the entire SEC-3B–3D.4 foundation. None of these dormant modules' own source files were modified.

## 22. Phase boundaries

```text
SEC-3E: implemented, flag-gated, not activated in any deployed environment
SEC-3F: not started
SEC-3G: not started
B3-E:   not resumed
Deployment: not performed
Push:   not performed
```

No claim is made of: real cookie-wire acceptance, real multi-instance denylist-store acceptance, production DNS/TLS validation, production Redis/MongoDB outage acceptance, SEC-3F completion, SEC-3G legacy deletion, or deployment readiness.

## 23. Residual risks and SEC-3F acceptance requirements

- **Real cookie-wire behavior** (name/Path/`Secure`/`SameSite` as actually observed over HTTPS, including the `api.strideto.com` same-site-topology precondition named in architecture §11) is unverified by this phase — code-level only.
- **Concurrent-refresh behavior under real network latency** (the 15-second benign-conflict window, Web Locks/`BroadcastChannel`/`localStorage`-lease client coordination) was not built or touched in this phase — the existing client-side cross-tab coordination described in architecture §23 remains a future, separate client enhancement; this cutover relied solely on the server-side CAS/409 contract, which is already correct and tested at the coordinator level (SEC-3B/3D.3).
- **Redis multi-instance denylist sharing** is asserted by code structure (fail-closed when absent) but not verified against a real multi-instance deployment.
- **`api.strideto.com` DNS/TLS liveness** — named as a SEC-3F precondition in the architecture report — is unrelated to and unaffected by this phase.
- **The role-authority promotion race identified in the consolidated acceptance audit is corrected** (§10), verified by a live reproduction both before and after the fix, and covered by four dedicated deterministic tests. It is not a residual risk carried forward.
- **Cookie-serialization-throw-after-session-creation** (noted by the acceptance audit as a pre-existing property of the unmodified `AuthCookiePolicy` module, not introduced by SEC-3E) remains theoretically possible and out of this phase's authority to change — named here for completeness, not newly discovered.

## 24. SEC-3G deletion requirements (deferred, not performed)

`utils/jwt.js`'s legacy signer, `utils/tokenStore.js`'s Redis refresh-slot and hash-keyed denylist functions, the legacy JSON-refresh-token response shape and its controller branches, and the client's now-fully-removed `localStorage` token code paths (already absent — this phase did not leave a legacy client branch to delete) are all named here as SEC-3G's future scope. None were deleted in this phase, consistent with "legacy code may remain for non-production pre-activation regression only" and "SEC-3G owns final deletion."

## 25. No production-readiness or deployment claim

This phase makes no such claim, anywhere in this document. The current live (legacy) authentication behavior is completely unchanged for every deployment that does not set `STRIDETO_SECURE_AUTH_ENABLED=1` — which, per `validateEnv.js`, is every deployment today, since no production environment has yet had this flag activated.
