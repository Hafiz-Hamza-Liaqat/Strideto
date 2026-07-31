# STRIDETO-SEC-3A / 3A.1 / 3A.2 — Authentication and Session Security Architecture Audit

**Revision note (SEC-3A.1 correction pass):** this document supersedes the
original SEC-3A report in place. The original conflated _cross-origin_ with
_cross-site_ when justifying `SameSite=None`, used an imprecise "5–10s grace
window" replay model, proposed a multi-document-per-family session model
whose bulk-revocation path was not actually transaction-safe while still
claiming replica-set independence, treated a bare SHA-256 IP hash as
adequate anonymization, asserted `tokenVersion` "invalidates" access tokens
without defining enforcement, recommended a production dual-emit window, and
required net-new OAuth/mobile implementation to close active-scope findings.
Every one of those defects is corrected with repository evidence.

**Revision note (SEC-3A.2 correction pass, in two parts, P1+P2):** the
SEC-3A.1 CSRF-cookie design was itself not executable (a host-only,
narrow-Path cookie set by `api.strideto.com` is not readable by JavaScript
on `strideto.com`) — replaced with mandatory Origin/Referer validation,
`SameSite=Lax` defense-in-depth, and bearer-authenticated logout (§19).
Realm cookie isolation, JWT `sid`/`jti` separation and access/refresh key
separation, refresh-time account/tokenVersion enforcement, and
access-token invalidation authority were all corrected (§18A, §19A, §22,
§24 — P1). Cross-tab refresh concurrency, local-development cookie
behavior, phase ordering (account-state enforcement now precedes, not
follows, the live cutover), rollback strategy, and the final 10/10 gate
were corrected in P2 (§18B, §23, §33, §34, §35). No other file was
modified to produce any part of this revision (see §37).

## 1. Executive verdict

**AUTHENTICATION SESSION REDESIGN READY FOR PHASED IMPLEMENTATION.** The
current system is fully mapped end to end (server, browser, mobile) with
concrete file:line evidence. It has one central, well-understood defect
(browser-readable, long-lived refresh tokens) plus a cluster of secondary
gaps (no replay detection, no token family, single-slot-per-user sessions,
suspension doesn't revoke live tokens, employer login skips a status check,
in-memory-only rate limiting/revocation state). None of these require a
product decision to resolve — they require an ordered implementation
(SEC-3B–3G, §33). Production topology is resolved by four independent,
mutually consistent repository sources as **same-site, cross-origin**
(§11) — this drives a `SameSite=Lax` cookie design, not `SameSite=None`.
One narrow infrastructure fact (whether `api.strideto.com` is currently
DNS-live) cannot be verified from the repository; it is verified as part of
SEC-3F's infrastructure acceptance and gates production deployment, which
does not occur until SEC-3G completes (§11, §33, §35) — it does not block
SEC-3B/3C/3D, all of which are dormant and domain-agnostic. OAuth and mobile authentication remain inactive,
unreachable, and out of the required implementation sequence (§26, §27);
their target architectures are documented for a future phase but are not
part of this gate (§36).

## 2. Repository authority

Preflight before this correction pass: HEAD
`87c44e2c432230681517bc0da78671ed906335b7`, branch `main...origin/main
[ahead 22]`, no tracked modification, no staged file, untracked files
exactly `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`,
`docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`, and this
report. This correction pass is entirely read-only against application
code: no application, test, package-manifest, lockfile, or environment file
was created or modified. Only this report file was rewritten. Verified
again at the end (§36).

## 3. Current authentication architecture

Two fully independent, structurally parallel auth realms — **user** and
**employer** — sharing no code path, no storage keys, no middleware
instance, but an identical design pattern: bearer JWT access + bearer JWT
refresh, single Redis/in-memory-Map slot per subject, both tokens returned
in the login/refresh JSON response body, both stored in browser
`localStorage`. A third, much smaller **staff-invitation** flow exists
(admin-issued Editor/Moderator/Admin invites) using its own random-token
mechanism, unrelated to sessions. **Mobile has no authentication
implementation at all** — a 6-screen read-only Expo scaffold whose
`setAuthToken`/`getAuthToken` pair is dead code. **OAuth/Google login does
not exist server-side or client-side** — only a disabled "coming soon"
button on the web login page. No cookie-parsing middleware is installed
anywhere in the server; the entire platform, for every client, is
bearer-token-only today.

## 4. Server route call graph

| Route                                       | Method   | Middleware                                                                                                    | Controller                                    | Tokens issued?                           | Rate limit                | Test coverage                            |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------- | ---------------------------------------- |
| `/api/auth/register`                        | POST     | `authLimiter`                                                                                                 | `authController.register`                     | No (verification-gated)                  | 5/min prod (failed only)  | Policy-function tests only, no HTTP test |
| `/api/auth/login`                           | POST     | `authLimiter`                                                                                                 | `authController.login`                        | Yes — access+refresh in JSON             | 5/min prod (failed only)  | None (no HTTP-level test)                |
| `/api/auth/logout`                          | POST     | `requireAuth, requireUserAuth`                                                                                | `authController.logout`                       | Revokes                                  | —                         | None                                     |
| `/api/auth/refresh-token`                   | POST     | `refreshLimiter`                                                                                              | `authController.refreshToken`                 | Yes — rotated pair in JSON               | 30/min prod (failed only) | None                                     |
| `/api/auth/me`                              | GET      | `requireAuth, requireUserAuth`                                                                                | `authController.me`                           | —                                        | —                         | None                                     |
| `/api/auth/forgot-password`                 | POST     | `forgotPasswordLimiter`                                                                                       | `authController.forgotPassword`               | No                                       | 5/hour                    | Policy-function tests only               |
| `/api/auth/reset-password`                  | POST     | `authLimiter`                                                                                                 | `authController.resetPassword`                | No (revokes refresh)                     | 5/min prod                | Policy-function tests only               |
| `/api/auth/verify-email`                    | GET+POST | **none**                                                                                                      | `authController.verifyEmail`                  | No                                       | **none**                  | Policy-function tests only               |
| `/api/auth/resend-verification`             | POST     | `resendVerificationLimiter, optionalAuth`                                                                     | `authController.resendVerification`           | No                                       | 5/hour                    | Policy-function tests only               |
| `/api/auth/change-password`                 | POST     | `requireAuth, requireUserAuth`                                                                                | `authController.changePassword`               | Revokes both tokens                      | —                         | None                                     |
| `/api/auth/accept-invitation`               | GET+POST | **none**                                                                                                      | `invitationsController.*`                     | No                                       | **none**                  | None                                     |
| `/api/auth/employer/register`               | POST     | `employerAuthLimiter`                                                                                         | `employerAuthController.employerRegister`     | Yes — immediately, no email verification | 5/min prod                | None                                     |
| `/api/auth/employer/login`                  | POST     | `employerAuthLimiter`                                                                                         | `employerAuthController.employerLogin`        | Yes — **no suspended-account check**     | 5/min prod                | None                                     |
| `/api/auth/employer/refresh-token`          | POST     | `refreshLimiter`                                                                                              | `employerAuthController.employerRefreshToken` | Yes — rotated pair in JSON               | 30/min prod               | None                                     |
| `/api/auth/employer/logout`                 | POST     | `requireAuth, requireEmployerAuth`                                                                            | `employerAuthController.employerLogout`       | Revokes                                  | —                         | None                                     |
| Google/OAuth (any)                          | —        | —                                                                                                             | **does not exist**                            | —                                        | —                         | —                                        |
| Admin/privilege elevation                   | —        | Uses the same `/auth/login` + `requireStaff`/`requirePermission` (role-based, no separate elevation endpoint) | —                                             | —                                        | —                         | —                                        |
| Mobile login                                | —        | **does not exist**                                                                                            | —                                             | —                                        | —                         | —                                        |
| Session/device listing, logout-all-sessions | —        | **does not exist anywhere, server or client**                                                                 | —                                             | —                                        | —                         | —                                        |

No test in `server/src/__tests__` exercises an actual HTTP request against
any of these routes (no supertest/integration harness for auth). Existing
`auth.test.js`/`emailVerification.test.js` test pure policy functions
(regex validators, TTL constants, hash equality); `authRealm.test.js` and
`employerAuthRealmIsolation.test.js` test **client-side** helpers and a
**mocked `localStorage`** object respectively — neither touches server code.

## 5. Browser token-storage map

Two independent contexts, identical shape:

|                 | User (`AuthContext.jsx`)                                                                                         | Employer (`EmployerAuthContext.jsx`)                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Access key      | `edurozgaar-token`                                                                                               | `edurozgaar-employer-token`                                             |
| Refresh key     | `edurozgaar-refresh-token`                                                                                       | `edurozgaar-employer-refresh-token`                                     |
| User-object key | `edurozgaar-user`                                                                                                | `edurozgaar-employer`                                                   |
| Writers         | `AuthContext.jsx:36-37`, `:31`; `axiosBase.js:85-87` (2nd independent writer inside the refresh interceptor)     | `EmployerAuthContext.jsx:40-45`, `:34-38`; `employerService.js:72-74`   |
| Readers         | `axiosBase.js:36,71`; `AuthContext.jsx:16,92,111`; `i18n/index.js:43` (reads `edurozgaar-user` only, for locale) | `employerService.js:32,58`; `EmployerAuthContext.jsx:15,81`             |
| Clearers        | `AuthContext.jsx:40-47`; `axiosBase.js:64-66,73-74,100-102`                                                      | `EmployerAuthContext.jsx:22-27`; `employerService.js:51-53,60-61,87-89` |

**Genuinely good existing pattern to preserve**: both `axiosBase.js` and
`employerService.js` already implement a **real single-flight refresh** — a
module-level shared `refreshPromise` variable that concurrent 401s `await`
instead of each triggering their own refresh call (`axiosBase.js:28,80-93`).
This is not naive and should be carried forward into the cookie-based
design, not rebuilt.

**Confirmed absent**: cross-tab sync (no `storage`/`BroadcastChannel`
listener anywhere), client-side JWT decoding/expiry checking, `withCredentials`/
`credentials:'include'` anywhere in either axios instance (confirms zero
cookie infrastructure exists client-side to build on — this is
greenfield). Token leakage scan found no console logging (zero `console.*`
calls exist in `client/src` at all), no third-party analytics/tracking SDK
present, and no token ever appearing in a URL. The dominant risk remains
exactly what it is structurally: `localStorage` is readable by any
successful XSS.

## 6. Mobile token-storage map

**No storage exists because no authentication exists.** `mobile/App.js` is
explicitly commented "Phase-8 scaffold"; none of its 6 screens contains a
login form or a call to `setAuthToken`/`getAuthToken`
(`mobile/api/client.js:16-17`, dead code — zero call sites anywhere).
`expo-secure-store`, `@react-native-async-storage/async-storage`, and
`react-native-keychain` are **all absent** from `mobile/package.json`.
Because no token is ever attached, 3 of the 10 API methods
`mobile/api/client.js` exposes (`recommendations`, `bookmarks`,
`notifications`) already 401 today against the live `requireAuth`-gated
`v1Router` routes. This is an **inactive surface**: unreachable by any
shipped mobile flow, not advertised as operational, carrying no stale
insecure implementation — it is secure by absence (§27), not a gap this
gate must close.

## 7. OAuth flow (current state)

**Does not exist.** One forward-looking comment
(`server/src/models/User.js:57`, no field actually defined), one disabled
client button (`client/src/pages/Auth/Login.jsx:71-73`, sets a "coming
soon" message). No `passport` dependency, no `/auth/google` route, no
callback handler, no `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, no client
SDK. Like mobile, this is an **inactive surface**: unreachable, not
advertised as operational, no stale implementation to carry forward
insecurely — secure by absence (§26).

## 8. Token inventory

| Token              | Format                   | Signing    | Secret                                                               | Claims                                             | Lifetime                  | Storage (server)                                             | Storage (client)                                  |
| ------------------ | ------------------------ | ---------- | -------------------------------------------------------------------- | -------------------------------------------------- | ------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Access (user)      | JWT, HS256 (unpinned)    | `jwt.sign` | `JWT_SECRET`                                                         | `userId, role, jti`                                | 1h (`JWT_EXPIRES_IN`)     | Stateless + denylist-by-hash on revoke                       | `localStorage: edurozgaar-token`                  |
| Refresh (user)     | JWT, HS256 (unpinned)    | `jwt.sign` | **Same `JWT_SECRET`**, differentiated only by `type:'refresh'` claim | `userId, type:'refresh', jti`                      | 7d (`REFRESH_EXPIRES_IN`) | SHA-256 hash, single Redis/Map slot keyed `refresh:<userId>` | `localStorage: edurozgaar-refresh-token`          |
| Access (employer)  | JWT, HS256               | `jwt.sign` | Same `JWT_SECRET`                                                    | `employerId, role:'employer', jti`                 | 1h                        | Same denylist mechanism                                      | `localStorage: edurozgaar-employer-token`         |
| Refresh (employer) | JWT, HS256               | `jwt.sign` | Same `JWT_SECRET`                                                    | `employerId, role:'employer', type:'refresh', jti` | 7d                        | Single slot keyed `refresh:employer:<id>`                    | `localStorage: edurozgaar-employer-refresh-token` |
| Email verification | Raw 32-byte hex          | —          | N/A (SHA-256 hashed, DB-compared)                                    | N/A                                                | 30 min                    | `User.emailVerificationToken` (hash)                         | URL query param (one-time)                        |
| Password reset     | Raw 32-byte hex          | —          | N/A                                                                  | N/A                                                | 1h                        | `User.passwordResetToken` (hash)                             | URL query param (one-time)                        |
| Staff invitation   | Raw random               | —          | N/A                                                                  | N/A                                                | Configurable              | `StaffInvitation.tokenHash`                                  | URL query param (one-time)                        |
| OAuth material     | **N/A — does not exist** | —          | —                                                                    | —                                                  | —                         | —                                                            | —                                                 |
| Mobile credentials | **N/A — does not exist** | —          | —                                                                    | —                                                  | —                         | —                                                            | —                                                 |
| FCM push token     | Opaque, provider-issued  | —          | —                                                                    | —                                                  | —                         | `User.fcmToken`                                              | Not currently sent by any client                  |

`REFRESH_SECRET` is referenced only in `validateEnv.js`'s warning check —
never actually read by `jwt.js`. No `issuer`/`audience`/`algorithms`
allowlist/`clockTolerance` is passed to `jwt.sign`/`jwt.verify` anywhere.
The insecure fallback secret (`'change-me-in-production'`) is neutralized
in production by `validateEnv.js`'s boot-time check.

## 9. Current refresh behavior

Single-slot-per-subject, hashed at rest, rotated on every use, **no
persisted DB record, no replay detection, no token-family concept, no
multi-device support**. `storeRefreshToken` overwrites the one Redis/Map
key on every login/refresh. No dedicated `Session`/`RefreshToken`/`Device`
Mongoose model exists. Redis is optional: absent `REDIS_URL` falls back
silently to an in-process `Map`, not gated by `REQUIRE_REDIS` at the
token-store layer.

## 10. Current logout and invalidation

| Event                                 | Refresh revoked? | Access token revoked?                    | DB status re-checked on future requests?                                                                                       |
| ------------------------------------- | ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| User logout                           | Yes              | Yes (denylisted by hash, TTL 1h)         | —                                                                                                                              |
| Employer logout                       | Yes              | Yes                                      | —                                                                                                                              |
| User password change (authenticated)  | Yes              | Yes                                      | —                                                                                                                              |
| User password reset (unauthenticated) | Yes              | No (no bearer token exists to blacklist) | —                                                                                                                              |
| Admin suspends a user                 | **No**           | **No**                                   | **No** — `requireAuth` never re-reads `accountStatus`; `/auth/refresh-token` checks email-verification but not `accountStatus` |
| Admin suspends an employer            | **No**           | **No**                                   | **No** — and `employerLogin` doesn't check `accountStatus` at login either                                                     |
| Role/permission change                | **No**           | **No**                                   | **No** — `requireAuth`/`rbac.js` trust the JWT's `role` claim for the token's full remaining lifetime                          |

## 11. Production site topology resolution

**This is the section that required correction.** The original report
justified `SameSite=None` by treating the existence of separate
`SITE_URL`/`FRONTEND_URL`/`APP_URL` variables and the `*.vercel.app`
preview allowance as evidence of a "genuinely cross-origin" deployment,
then implicitly equated that with _cross-site_. That is wrong: cross-origin
means a different scheme+host+port triple; cross-site means a different
registrable domain (eTLD+1). Two hosts can be cross-origin and still
same-site, which changes the correct `SameSite` policy materially.

**Repository evidence, four independent sources, all mutually consistent:**

| Source                               | Evidence                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.yaml`                        | `SITE_URL: https://strideto.com`, `FRONTEND_URL: https://strideto.com` on the `strideto-api` Render service                                                                                                                                                   |
| `.env.production.example`            | `SITE_URL=https://strideto.com`, `FRONTEND_URL=https://strideto.com`, `CLIENT_URL=https://strideto.com`, `APP_URL=https://strideto.com`, `API_URL=https://api.strideto.com`, `VITE_APP_URL=https://strideto.com`, `VITE_API_URL=https://api.strideto.com/api` |
| `docs/VERCEL_CONFIGURATION.md`       | `VITE_API_URL: https://api.strideto.com/api`, `VITE_APP_URL: https://strideto.com`; "Domains — Production: `strideto.com`, `www.strideto.com`; Preview: Vercel preview URLs for PRs"                                                                          |
| `docs/RENDER_CONFIGURATION.md:35,52` | Explicit DNS instruction: `api.strideto.com` → Render service → enable TLS; expected health check target `https://api.strideto.com/api/health`                                                                                                                |

All four independently specify the same intended topology: frontend at
`strideto.com`/`www.strideto.com` (Vercel), API at `api.strideto.com`
(Render, custom domain). Both hosts share the registrable domain
`strideto.com` — **same-site, cross-origin**, not cross-site.

**One contrary data point exists and is resolved, not ignored:**
`docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md:38` shows the
last-verified-live health check was run against
`https://strideto.onrender.com/api/health` — Render's automatically
assigned default subdomain, not the custom `api.strideto.com` domain. This
does not override the four consistent sources above: `RENDER_CONFIGURATION.md`
itself documents custom-domain DNS/TLS provisioning as a distinct manual
step from the base Render deploy, and Render always serves a working
default `*.onrender.com` host immediately while a custom domain is
provisioned — a single acceptance check against the guaranteed-available
default host during that window is expected operational behavior, not
evidence of a different intended architecture. Preview deployments
(`*.vercel.app`) are a separate, already-understood case: they are
genuinely cross-site relative to `api.strideto.com` and are handled
independently (§25 — refresh/login on preview origins is out of the
`SameSite=Lax` cookie's reach by design; preview environments do not carry
production session cookies).

**Resolution:** the _designed_ topology is proven same-site by repository
evidence — this is an **architecture decision grounded in repository fact**,
not a guess. Cookie `SameSite` policy is designed for the same-site case
(§18: `SameSite=Lax`, no `Domain` broadening).

**What remains genuinely unresolvable from the repository** (an
**infrastructure verification fact**, not a design ambiguity): whether
`api.strideto.com` is _currently_ DNS-live and TLS-provisioned in
production at the moment of cutover. This cannot be checked by reading
code. It is verified as part of SEC-3F's real-infrastructure acceptance
(§33, §35) — it does not block SEC-3B, SEC-3C, or SEC-3D, all of which are
dormant and domain-agnostic. If, at that verification point,
`api.strideto.com` is not yet live and the backend is still reachable only
via `*.onrender.com`, the cutover must stop and be re-evaluated as a
genuine cross-site case before
any cookie is shipped to production — this is the exact "unresolved
infrastructure decision" scenario the task anticipates, scoped precisely to
the one fact that actually requires it, not the whole redesign.

## 12. CORS/cookie/proxy state

`server/src/config/cors.js`: real per-origin allowlist
(`SITE_URL`/`FRONTEND_URL`/`APP_URL`/`CORS_ORIGINS`, plus non-production
localhost, plus production `*.vercel.app` previews unless disabled),
`credentials: true` set, origin never echoed as a bare wildcard — this
configuration already supports credentialed cross-origin (same-site)
cookie requests and needs no change for a cookie-based design to work.
`trust proxy` is set to `1` only in production, correctly ordered before
rate limiters. **Correction from the original report**: the multiple
`SITE_URL`/`FRONTEND_URL`/`APP_URL` variables and the `*.vercel.app`
preview allowance are evidence of **cross-origin**, multi-environment
configuration — they are not, by themselves, evidence of cross-site
production traffic (§11 resolves that separately, and correctly). No
`cookie-parser` package is installed; no code path reads or writes cookies
anywhere in `server/src` today.

## 13. Current CSRF posture

**None exists, and none is currently needed**, because the platform is
bearer-token-only: an `Authorization: Bearer` header must be explicitly
attached by JavaScript reading `localStorage`, which a cross-origin
attacker page cannot do without XSS. **This changes the moment any
endpoint authenticates via an automatically-attached cookie** — from that
point on, refresh/logout/login become CSRF-relevant and require an
explicit contract (§19), independent of whether the deployment is
same-site or cross-site: `SameSite=Lax` narrows the CSRF-relevant surface
(blocks cross-site POST) but does not eliminate it (same-site attacks, and
Lax's top-level-navigation carve-out, remain live concerns) — `SameSite`
is defense-in-depth here, not the sole control (§19).

## 14. Critical findings

- **F-C1**: Refresh (and access) tokens are stored in `localStorage`,
  readable by any successful XSS, with a 7-day refresh-token blast radius.
- **F-C2**: No refresh-token replay detection or family revocation exists.
- **F-C3**: Account suspension has zero effect on already-issued access or
  refresh tokens until natural expiry (up to 1h access / 7d refresh); the
  refresh endpoint doesn't check `accountStatus` either.

## 15. High findings

- **F-H1**: Access and refresh tokens share one signing secret,
  differentiated only by a `type` claim, no `issuer`/`audience`/
  `algorithms` allowlist pinned on verification.
- **F-H2**: Refresh-token state and the access-token denylist live in an
  in-process `Map` whenever Redis is absent — silently unsafe under
  horizontal scaling or after any restart.
- **F-H3**: `employerLogin` has no `accountStatus==='suspended'` check at
  all (asymmetric with `login`).
- **F-H4**: Single-slot-per-subject refresh storage silently invalidates
  other devices' sessions on new login.
- **F-H5**: Rate limiters are all in-memory (`MemoryStore`).

## 16. Medium findings

- **F-M1**: `/auth/verify-email` and `/auth/accept-invitation` have no
  rate limiter.
- **F-M2**: No `tokenVersion`/`sessionVersion` primitive exists — no
  mechanism for cheap, near-real-time bulk invalidation.
- **F-M3**: Registration enables account enumeration (unchanged, out of
  this phase's scope).
- **F-M4**: No cross-tab logout/login propagation.
- **F-M5**: No client-side JWT expiry check.

## 17. Recommended target architecture (active scope)

**Web — Candidate A: access token in JavaScript memory only; refresh
token in a `Secure` + `HttpOnly` cookie.** Rejected Candidate B (both
tokens in `HttpOnly` cookies) because mobile cannot use cookies reliably
(§6) even in a future phase, so the API must retain a bearer-header access
path regardless; an in-memory access token is inherently immune to CSRF,
narrowing the CSRF-relevant surface to cookie-authenticated routes only;
the existing single-flight refresh interceptor pattern (§5) adapts
directly. **Mobile and OAuth target architectures are documented (§26,
§27) but are explicitly deferred, future-scope items — not part of the
required implementation sequence or the active 10/10 gate (§35), because
both are currently inactive, unreachable surfaces (§6, §7) and expanding
them is not required to close active web-authentication findings.**

## 18. Cookie contract

Same-site topology (§11) resolves the correct policy: `SameSite=Lax`, not
`SameSite=None`. **Correction (SEC-3A.2)**: the SEC-3A.1 `Path=/api/auth`
/ `Path=/api/auth/employer` values are withdrawn. Cookie `Path` matching
is a **path-segment prefix match**, so `Path=/api/auth` would also match
every route under `/api/auth/employer/*` — the exact overlap the realm
must not have. Paths are narrowed below to the single route each cookie
actually needs to reach.

| Attribute | User refresh cookie                                                                                                                                                                                                         | Employer refresh cookie            | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name      | `__Secure-strideto_user_rt`                                                                                                                                                                                                 | `__Secure-strideto_employer_rt`    | `__Secure-` (not `__Host-`) chosen specifically because `__Host-` mandates `Path=/` and forbids `Domain`; `__Secure-` permits the narrow `Path` below while still mandating `Secure`. Distinct names are a first, independent layer of realm isolation on top of the path scoping (§18A)                                                                                                                                                                                                                                                    |
| HttpOnly  | Yes                                                                                                                                                                                                                         | Yes                                | Never JS-readable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Secure    | Yes, always in production                                                                                                                                                                                                   |                                    | Boot-time hard-fail in `validateEnv.js` if `NODE_ENV==='production'` and the cookie-secure flag would resolve non-Secure                                                                                                                                                                                                                                                                                                                                                                                                                    |
| SameSite  | `Lax`                                                                                                                                                                                                                       | `Lax`                              | Same-site topology (§11) — see §19 for why `Lax` is defense-in-depth, not the sole CSRF control                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Path      | `/api/auth/refresh-token`                                                                                                                                                                                                   | `/api/auth/employer/refresh-token` | **Narrowed to the exact refresh endpoint only** — non-overlapping by construction (`/api/auth/refresh-token` is not a prefix of `/api/auth/employer/refresh-token` and vice versa). Login does not need the cookie attached (it sets it fresh via `Set-Cookie`, which does not require Path to match the _setting_ request). Logout does not need the cookie attached either — logout authenticates via bearer access token, not the ambient cookie (§19, §18A) — so no shared/broader realm prefix is needed just to make logout reachable |
| Domain    | Not set (omitted)                                                                                                                                                                                                           | Not set                            | Both realms are served from the single host `api.strideto.com` — no cross-subdomain sharing needed                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Max-Age   | Matches `REFRESH_EXPIRES_IN` (7d default)                                                                                                                                                                                   | Same                               | Continuity with current behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Priority  | `High`                                                                                                                                                                                                                      | `High`                             | Reduces eviction risk under storage pressure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Clearing  | `res.clearCookie(name, {path, ...matching attributes})`, issued from the logout controller (bearer-authenticated, §18A) using the exact stored Path even though the incoming logout request did not itself carry the cookie | Same                               | `clearCookie` only requires the _response_ to declare matching attributes — it does not require the cookie to have been present on the request being answered                                                                                                                                                                                                                                                                                                                                                                               |

No CSRF cookie is issued. The SEC-3A.1 "companion non-HttpOnly CSRF
cookie" is withdrawn in full — see §19.

## 18A. Realm isolation contract

**New section (SEC-3A.2)**, answering exactly what SEC-3A.1 left
ambiguous: which cookie is readable/attachable where, and which
controller is authoritative for each realm.

|                              | User realm                                                                                              | Employer realm                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Refresh cookie name          | `__Secure-strideto_user_rt`                                                                             | `__Secure-strideto_employer_rt`                                                        |
| Refresh cookie Path          | `/api/auth/refresh-token`                                                                               | `/api/auth/employer/refresh-token`                                                     |
| Refresh endpoint             | `POST /api/auth/refresh-token`                                                                          | `POST /api/auth/employer/refresh-token`                                                |
| Logout endpoint              | `POST /api/auth/logout`                                                                                 | `POST /api/auth/employer/logout`                                                       |
| Logout authentication        | Bearer access token (`Authorization` header), **not** the refresh cookie                                | Same                                                                                   |
| Session claim read at logout | `sid` from the verified access token (§19A) → looked up directly by `_id` in `RefreshSession`           | Same, realm-checked                                                                    |
| Issuer                       | `strideto-api`                                                                                          | `strideto-api` (shared issuer, realm is a claim — §19A)                                |
| Audience                     | `strideto-user`                                                                                         | `strideto-employer`                                                                    |
| Reading controller           | `authController.refreshToken` (reads the cookie); `authController.logout` (reads the bearer token only) | `employerAuthController.employerRefreshToken`; `employerAuthController.employerLogout` |
| Setting controller           | `authController.login`, `authController.refreshToken`                                                   | `employerAuthController.employerLogin`, `employerAuthController.employerRefreshToken`  |

**Cross-realm attachment result, explicitly verified against the Path
values above**: the user cookie's `Path=/api/auth/refresh-token` does not
prefix-match `/api/auth/employer/refresh-token` (they diverge at the
segment immediately after `/api/auth/`), so the browser never attaches
the user refresh cookie to an employer request, and never attaches the
employer refresh cookie to a user request. Distinct cookie names are a
second, independent guarantee: even if a future route ever introduced
Path overlap by mistake, the two realms still could not be confused for
one another, since `requireAuth`/`requireEmployerAuth` only ever read
their own cookie name. **No cookie-name ambiguity exists**: the two names
share no substring collision risk in `cookie-parser`'s parsed object.

## 18B. Local-development cookie contract

**New section (SEC-3A.2-P2)**. Repository evidence: `client/vite.config.js:72`
sets the dev server port to `5173`; `.env.example:91-92` documents the
paired local API origin as `http://localhost:5000`. These two origins
differ by port only — different origins, but treated as **same-site** by
every major browser (`localhost` has no public-suffix entry and is
special-cased for `SameSite` purposes), so `SameSite=Lax` behaves
identically in local development to production.

`__Secure-`/`__Host-`-prefixed cookies are **browser-enforced** to require
`Secure` — a prefixed cookie set without `Secure` is silently dropped, not
merely discouraged. Local development runs over plain HTTP, so production
cookie names cannot be reused locally; a separate, non-prefixed
development contract is required.

| Attribute   | User (dev)                                                                             | Employer (dev)                     |
| ----------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| Cookie name | `strideto_dev_rt`                                                                      | `strideto_dev_employer_rt`         |
| HttpOnly    | `true`                                                                                 | `true`                             |
| Secure      | `false`                                                                                | `false`                            |
| SameSite    | `Lax`                                                                                  | `Lax`                              |
| Domain      | Not set                                                                                | Not set                            |
| Path        | `/api/auth/refresh-token` (same exact route as production, §18)                        | `/api/auth/employer/refresh-token` |
| Max-Age     | Same policy as production (`REFRESH_EXPIRES_IN`) unless a test explicitly overrides it | Same                               |

**Local origins**: frontend `http://localhost:5173`; API
`http://localhost:5000`. CORS must explicitly allow
`http://localhost:5173` (already true today, non-production branch of
`config/cors.js`) with `credentials: true` — never a wildcard origin
combined with credentials, which browsers reject outright when a request
carries credentials. The frontend's dev HTTP client must set
`withCredentials`/`credentials: 'include'` for this to have any effect.

**Production hard-fail** (`validateEnv.js`, extending the existing
`JWT_SECRET` boot-check pattern): production startup must hard-fail if any
of the following is true —

- the resolved cookie names are the development names above;
- the resolved `Secure` flag would be `false`;
- `NODE_ENV`/an equivalent app-env flag resolves ambiguously (neither
  clearly production nor clearly development);
- the production API/frontend host configuration (§11) is missing;
- `JWT_SECRET`/`REFRESH_SECRET` (§19A) are missing or identical;
- the trusted-origin allowlist (§19) is empty or missing in production.

Cookie clearing (either environment) must use the exact same name, `Path`,
`SameSite`, and `Secure` mode that were used when the cookie was set —
`res.clearCookie` does not clear a cookie whose attributes don't match.

## 19. CSRF/origin contract

**Corrected in full (SEC-3A.2).** The SEC-3A.1 design was not
executable and is withdrawn: it required JavaScript running on
`strideto.com` to read a `csrf` cookie set host-only by `api.strideto.com`
with `Path=/api/auth`. That cannot work, for three independent reasons,
each stated explicitly because the task requires it:

1. A cookie with no `Domain` attribute is **host-only** — it is visible
   (via `document.cookie`) only to script running on the exact host that
   set it. `document.cookie` on `strideto.com` never includes a cookie
   set by `api.strideto.com`, regardless of `SameSite`, regardless of
   `credentials: true`, and regardless of same-site status (§11)
   — same-site controls whether a cookie is _sent_ on a cross-host
   request; it has no effect on cross-host `document.cookie`
   _readability_, which is governed by `Domain`/host-only scoping alone.
2. Even ignoring (1), a cookie scoped to `Path=/api/auth` is not present
   in `document.cookie` for a document loaded at `/`, `/dashboard`,
   `/jobs`, or any other ordinary frontend route — `document.cookie`'s
   Path visibility follows the same prefix-match rule as request
   attachment (§18). The SPA's top-level pages are not served under
   `/api/auth`, so the cookie would never appear there to be read.
3. `SameSite` is a request-attachment control, not a JavaScript-visibility
   control — it never grants cross-host readability regardless of its
   value.

**Replacement design — no browser-readable API-host cookie is used at
all.** The refresh cookie remains fully `HttpOnly` (§18); nothing about
it is ever exposed to JavaScript on either host.

1. **Strict trusted-Origin validation is the mandatory, primary control**
   — not defense-in-depth, not a fallback — on `/auth/login`,
   `/auth/register`, `/auth/refresh-token`, and the `/auth/employer/*`
   equivalents. Reuses the exact existing CORS allowlist
   (`config/cors.js`) as the single source of truth, checked
   independently of CORS's own preflight behavior (a simple cross-site
   POST does not always trigger a preflight).
2. **Production rejects missing, null, or untrusted `Origin`** on these
   routes outright — never silently allowed. `Referer` is accepted only
   as a narrowly-validated fallback (parsed to its origin, checked
   against the same allowlist) when `Origin` is genuinely absent, which
   itself is treated as suspicious in production.
3. **`SameSite=Lax` is retained as defense-in-depth**, not the sole
   control: it independently blocks the refresh cookie from being
   attached on genuinely cross-site subresource requests at all (a
   different, stronger guarantee than Origin-checking, which only
   _rejects_ the request after it already arrived). It does **not**
   protect against a same-site-but-different-origin actor (e.g. a
   compromised sibling subdomain of `strideto.com`), which is exactly why
   step 1 is mandatory rather than optional.
4. **Forced-preflight header, as an additional independent layer**: the
   client sends a fixed, non-secret header (e.g. `X-Strideto-Client:
web`) on refresh/login/logout calls. This is a non-simple header, so
   it forces a CORS preflight even on same-site cross-origin requests;
   the browser will not send the actual request at all unless the
   server's existing CORS allowlist (`config/cors.js`) approves the
   calling origin at the preflight `OPTIONS` step. This does not replace
   step 1 — it is stated explicitly as a secondary, non-authenticating
   hardening layer, not the primary control, per the task's own
   instruction.
5. **No double-submit cookie, HMAC-bound or otherwise, is used.** A
   session-bound synchronizer token _could_ be built instead (returned in
   the login/refresh response body and held only in JS memory, never a
   cookie), but is **not selected** for this design: steps 1–4 above are
   sufficient without it — Origin validation is mandatory (not merely
   defense-in-depth) precisely to substitute for the double-submit
   pattern's job, `SameSite=Lax` independently blocks true cross-site
   delivery, and the forced-preflight header adds a third, independent
   check reusing the existing CORS allowlist with zero new state, zero
   new secret, and zero new rotation logic. Introducing a synchronizer
   token on top would add a fourth mechanism without closing any gap the
   first three leave open, which is not justified.
6. **Login and register carry no pre-existing session** — Origin
   validation alone (steps 1–2) is sufficient there: a forged cross-site
   login POST only logs the attacker's own victim browser into the
   attacker's account (classic login-CSRF), fully addressed by Origin
   validation; there is no session to hijack yet.
7. **Logout and logout-all are bearer-authenticated, not
   cookie-authenticated** (§18A): the client sends its in-memory access
   token as a normal `Authorization: Bearer` header, exactly like any
   other authenticated API call. Because the access token is never
   ambiently attached (Candidate A, §17), logout is immune to CSRF by
   construction — no Origin check, cookie, or synchronizer token is
   needed for it at all. The server extracts `sid` from the verified
   access token (§19A) and revokes the matching `RefreshSession`
   directly. **No cookie-authenticated logout fallback is defined**: if
   the client holds no valid access token (e.g. it expired while the tab
   was idle), the client performs a normal silent refresh first — itself
   protected by steps 1–4 above — obtains a fresh access token, and then
   calls logout with it. If that refresh also fails, there is no live
   session left server-side to meaningfully log out of; the client simply
   clears its local in-memory state.
8. **Public error shape**: HTTP 403, generic body
   `{ "error": "origin_validation_failed" }` on the login/register/
   refresh routes above; the standard generic 401 shape for logout's
   normal bearer-auth failure path.
9. Mobile/bearer-token requests are exempt from this contract entirely —
   not ambiently attached, not CSRF-exploitable by construction.

**Login/register response contract, restated precisely**: successful
login/register sets the `HttpOnly` refresh cookie and returns the access
token only in the JSON body — never a refresh token. Successful refresh
returns the access token only.

## 19A. JWT claims and signing-key contract

**New section (SEC-3A.2)**, correcting F-H1 (§15) precisely rather than
only narrating it, and correcting SEC-3A.1's implicit reuse of one
constant identifier as both the session identity and every individual
token's identity.

**Separate signing material, not a shared secret with a type claim**:
access tokens are signed/verified with `JWT_SECRET` (renamed in intent,
not necessarily in env-var name, to "the access-token key"); refresh
tokens are signed/verified with `REFRESH_SECRET` — a distinct secret,
made **live** for the first time (today it is defined but never actually
read by `jwt.js`, §8). Verifying a refresh token with the access key (or
vice versa) fails at the signature-verification step, before any claim is
even inspected — strictly stronger than today's shared-secret-plus-
`type`-claim differentiation. `validateEnv.js` hard-fails at boot in
production if `REFRESH_SECRET` is unset or identical to `JWT_SECRET`
(upgraded from today's mere warning, since the check becomes load-bearing
once `REFRESH_SECRET` is actually used).

**`sid` vs `jti`, kept strictly separate** — the task's explicit
correction: `sid` (session/family identity) must never be reused as every
individual token's `jti` (per-token identity).

- `sid` = the `RefreshSession` document's `_id` — constant for the life
  of the session/family (§21).
- `jti` = a fresh, unique value (e.g. `crypto.randomUUID()`) generated at
  signing time for **this one token only** — a new `jti` on every single
  access token issuance and every single refresh token issuance,
  including every rotation. Two tokens never share a `jti`, even within
  the same session.

**Access token claims**: `sub` (subjectId), `realm` (`'user'` |
`'employer'`), `sid`, `jti`, `tokenVersion` (snapshot at issuance), `iss`
(`strideto-api`), `aud` (`strideto-user` | `strideto-employer`), `exp`.

**Refresh token claims**: `sub`, `realm`, `sid`, `jti`, `type: 'refresh'`,
`tokenVersion`, `iss`, `aud`, `exp`.

**Verification, both token types**: explicit `algorithms` allowlist
(`['HS256']`), `issuer`, `audience` (realm-specific — an employer token
presented against a user-audience check fails outright), and, for refresh
tokens, `type === 'refresh'`.

**Before rotation (§22), verify, in addition to signature/issuer/
audience/type**: the loaded `RefreshSession.subjectType` equals the
token's `realm` claim, and `RefreshSession.subjectId` equals the token's
`sub` claim — a token that verifies cryptographically but names a
different subject/realm than the session it claims via `sid` is rejected,
independent of and prior to the CAS/replay logic (§22).

## 20. Session metadata privacy contract

**Correction from the original report**: a bare SHA-256 hash of an IP
address is not adequate anonymization — IPv4's address space (2^32) is
trivially brute-forced/rainbow-tabled back to the original address, and
IPv6 addresses are frequently guessable within a known-narrow prefix.
`ipHash` is removed from the default session model entirely, not weakened
to a "better hash."

- **IP address**: not persisted in `RefreshSession` at all. There is
  currently no active product requirement driving IP collection (no
  session-listing UI exists anywhere in the codebase — confirmed absent in
  §5/§6 research — and no fraud/abuse team workflow was found that
  consumes it). If a genuine abuse-detection requirement emerges later, it
  should be a separate, purpose-built, short-retention security log
  (not bundled into the long-lived session record), using an
  HMAC-peppered derivative (not a bare hash) with a documented rotation
  and retention policy — deferred until that requirement is real, per the
  task's own instruction not to collect metadata beyond an active
  requirement.
- **`deviceLabel`** (coarse User-Agent parse, never the raw UA string):
  **optional, deferred**, not part of the MVP `RefreshSession` schema.
  Not required for the core security mechanism — rotation, replay
  detection, and revocation (§22) are keyed entirely by `tokenHash`/
  `familyId`, not device identity. Add it only if/when a session-listing
  UI becomes an active product requirement; if added, it must be
  truncated/normalized (never raw `User-Agent`) and system-generated
  (never user-editable).

This is a genuine simplification from the original design, not just a
privacy patch: removing `ipHash` and deferring `deviceLabel` shrinks the
`RefreshSession` schema to exactly the fields the rotation/replay/
revocation mechanism actually needs (§21).

## 21. Refresh-session persistence model

**Corrected model: one document per family** (not one document per
rotation generation, as the original report specified). This is a
substantive correction, not a naming change — it changes which operations
are provably atomic without a transaction (§22).

```text
_id                 ObjectId   — also serves as familyId; constant for the
                                 life of the session
subjectType         'user' | 'employer'
subjectId           ObjectId   — ref User or Employer
currentTokenHash    String     — SHA-256 of the currently valid refresh token
previousTokenHash   String | null  — SHA-256 of the immediately-prior token,
                                 set only during the concurrency window (§22)
previousTokenRotatedAt Date | null
tokenVersionAtIssue Number     — snapshot of subject tokenVersion at
                                 creation/last validation (§24)
createdAt           Date
lastUsedAt          Date
expiresAt           Date       — TTL-indexed, matches REFRESH_EXPIRES_IN (7d)
revokedAt           Date | null
revokeReason        'logout' | 'logout_all' | 'replay_detected' |
                     'password_change' | 'account_suspended' |
                     'admin_revoked' | null
```

`deviceLabel`/`ipHash` are deliberately absent (§20).

**Why one document per family, and what it proves**: because the whole
family is a single document, revoking a family is a single-document
update — rotation, replay-response, and single-session revocation
**never** require a multi-document transaction, and therefore never
require a replica set for correctness. This is a genuine improvement over
the original per-generation model, whose "revoke every document sharing
this familyId" step was an unprotected `updateMany` — not atomic across
documents, and not covered by any transaction — while still (incorrectly)
being described as not needing one. That was the exact defect the task's
own instruction flagged ("do not claim replica-set independence when
family revocation requires an unprotected multi-document transition").

**Operations that remain genuinely multi-document, stated honestly**:
"logout all sessions for a subject" and suspension/password-change-driven
mass revocation touch every `RefreshSession` document for a `subjectId`
(`updateMany`, not a transaction) — this is a **best-effort, eventually
consistent bulk operation**, not an atomic all-or-nothing guarantee. This
is acceptable because the **authoritative, immediate revocation signal for
access tokens is `tokenVersion`** (§24), not the bulk `RefreshSession`
update — the bulk update is defense-in-depth cleanup of refresh capability,
not the primary enforcement path. A strict, all-or-nothing session cap
(e.g., "max N concurrent sessions per subject") would need a transaction
if implemented; it is not part of this gate's required scope.

## 22. Rotation and replay contract

**Corrected from "grace window returns the same pair again" to an exact
one-successor-only CAS contract with a bounded conflict response** — the
original design's grace window could, under the wrong reading, imply a
second valid token pair being handed out; this version guarantees exactly
one response body ever contains a new token pair per rotation event.
Presented as flat, labeled steps (not a nested Markdown list) for
rendering stability.

**Step 1 — Token presentation.** Client presents a refresh token (cookie
for web; a future mobile phase would use a body field, §27).

**Step 2 — Cryptographic validation.** Verify JWT signature (with
`REFRESH_SECRET`, §19A), expiry, issuer, audience, algorithm allowlist,
and `type==='refresh'` (stateless, cheap rejection of garbage).

**Step 3 — Session lookup.** Look up `RefreshSession` by `_id` (== the
token's `sid` claim, §19A — **not** `jti`, which is per-token-unique and
not used for session lookup).

**Step 4 — Missing-session behavior.** Not found → reject generically
(401).

**Step 5 — Token, session and subject binding.** Before any
revocation/expiry/CAS logic runs, verify all of the following. None of
these checks is nested under another — each is an independent, top-level
condition evaluated as part of this one step:

- `RefreshSession.subjectType` equals the token's `realm` claim, and
  `RefreshSession.subjectId` equals the token's `sub` claim (§19A) —
  mismatch → reject generically (401), no further checks.
- Load the subject (`User`/`Employer`) by `subjectId`. Not found, or
  `accountStatus` is suspended/deleted → **fail closed**: issue no access
  token, issue no refresh successor, and — because this is a
  positively-identified account-state mismatch, not an ambiguous lookup
  failure — revoke this `RefreshSession` document (`revokeReason:
'account_suspended'` or `'account_deleted'`) so a second presentation
  of the same token doesn't repeatedly reach this check. Return a generic 401.
- The refresh token's own `tokenVersion` claim must equal the subject's
  **current** `tokenVersion`, read directly from MongoDB in this same
  lookup (always fresh — never cached, unlike the access-token path in
  §24) — mismatch → same fail-closed treatment as above (`revokeReason:
'password_change'`/`'admin_revoked'`, chosen by whatever action last
  bumped `tokenVersion`).
- `RefreshSession.tokenVersionAtIssue` must also equal the subject's
  current `tokenVersion` — this catches the case where the _session_
  itself predates a version bump even if the presented token's own claim
  were somehow stale-but-matching; same fail-closed treatment.
- **This check is mandatory and independent of §21's best-effort
  `updateMany` bulk cleanup.** Bulk revocation (logout-all, mass
  suspension cleanup) is stated there as eventually-consistent by
  construction; it must never be the _only_ enforcement path. Because
  this step re-reads the subject directly from MongoDB on every single
  refresh attempt, it is authoritative and immediately consistent
  regardless of whether the bulk cleanup for a given event has run yet.

**Step 6 — Revoked-session behavior.** Found, subject/version checks
pass, `revokedAt` already set (terminal — not the same as "just rotated")
→ reject generically (401); if `revokeReason` was anything other than
`'rotated'` this is definitionally not a same-rotation race, so no
further check applies.

**Step 7 — Expired-session behavior.** Found, not revoked, `expiresAt`
passed → reject as expired (no replay signal — natural expiry is not an
attack).

**Step 8 — Atomic CAS rotation.** Found, not revoked, not expired — an
atomic CAS rotation runs via a single aggregation-pipeline
`findOneAndUpdate`:

```js
const now = new Date();
const won = await RefreshSession.findOneAndUpdate(
  { _id: familyId, currentTokenHash: presentedHash, revokedAt: null },
  [
    {
      $set: {
        previousTokenHash: '$currentTokenHash',
        previousTokenRotatedAt: now,
        currentTokenHash: newTokenHash,
        lastUsedAt: now,
      },
    },
  ],
  { new: true }
);
```

**CAS winner.** If `won` is returned (this request matched and updated
the document): this request — and only this request — issues the new
token pair, sets the new refresh cookie, and returns 200. Exactly one
successor is minted per rotation, by construction of the CAS filter.

**CAS loser.** If `won` is `null` (another request already rotated this
document first), re-fetch the document by `_id` and classify it as one of
the two cases below.

**Benign concurrent presentation.** `previousTokenHash === presentedHash`
**and** `now - previousTokenRotatedAt <= CONCURRENCY_WINDOW_MS` (**15000ms
— corrected from 5000ms/3000ms, SEC-3A.2-P2.1**; see §23 for the full
timing hierarchy and the client-side coordination that makes this window
rarely the deciding factor for legitimate traffic) → benign race (e.g.
two tabs refreshing near-simultaneously). No second token pair is issued
to this request; the session is **not** revoked. Return **HTTP 409** with
exactly **one** authoritative retry instruction — the `Retry-After: 1`
header (seconds, per HTTP semantics; the client treats this as a
_minimum_ delay, not the actual wait — §23) — and a generic,
non-identifying body carrying no second, conflicting timing value:
`{ "error": "refresh_conflict" }`. Log `auth.refresh_conflict`
(informational, not a security event).

**Replay presentation.** Otherwise (token doesn't match
`currentTokenHash` or `previousTokenHash`, or it matches
`previousTokenHash` but outside the concurrency window) → replay
detected: revoke this single document (`revokedAt = now, revokeReason =
'replay_detected'`), log a security event, return a generic 401. Because
the model is one-document-per-family (§21), this revocation is a
single-document atomic write — no transaction needed. Crucially,
exceeding the 15-second window never mints a second successor from the
old token either way — it only changes how the rejection is classified
(safe 409 conflict vs. replay revocation).

**Step 9 — Client retry behavior.** See §23 for the full browser-side
contract (per-tab single-flight, cross-tab lock/lease coordination, exact
retry ordering, and handling of response-ordering/slow-network edge
cases) — the short version is that the loser retries **at most once**,
using the cookie jar's current state, only after observing the winning
tab's lock/lease release or completion signal and respecting the
`Retry-After` minimum, never immediately and never in an unbounded loop.

**No raw token, hash, or `familyId` is ever exposed in a public error
body** — every rejection path above returns a generic, undifferentiated
message.

**Step 5's subject/tokenVersion check never uses Redis** — it always reads
MongoDB directly on every refresh attempt (Step 5 above), so it carries no
cache-staleness risk regardless of whatever caching strategy §24 chooses
for the separate access-token path. **Database outage behavior**: if
MongoDB is unavailable, refresh/rotation fails closed — no session can be
validated or issued.

## 23. Concurrency contract

**Corrected in full (SEC-3A.2-P2, normalized in P2.1)**: SEC-3A.1's "409 →
retry once immediately" was underspecified, and SEC-3A.2-P2's first
correction introduced an internal contradiction (`Retry-After: 1` header
alongside a `retryAfterMs: 300` body field — two different timing
instructions for the same wait) and an unaligned timing hierarchy (a
4000ms fallback lease sitting inside a 5000ms server window, with no
margin against realistic HTTP round-trip time). Both defects are corrected
below with one coherent timing hierarchy and an exact fallback-mutex
design.

### Timing hierarchy (authoritative, all other values in this report defer to this table)

| Value                             | Duration     | Enforced by                         |
| --------------------------------- | ------------ | ----------------------------------- |
| Client refresh HTTP timeout       | 10000ms      | Browser HTTP client (axios timeout) |
| Fallback `localStorage` lease TTL | 12000ms      | Client-side lease-staleness check   |
| Server benign concurrency window  | 15000ms      | `CONCURRENCY_WINDOW_MS`, §22 step 8 |
| Server `409` `Retry-After`        | `1` (second) | HTTP header, §22 step 8             |
| Maximum retries after a `409`     | 1            | Client retry logic (§ below)        |

**Required invariant, satisfied by construction**: `client timeout (10000ms)
< lease TTL (12000ms) < benign concurrency window (15000ms)`. This
guarantees: a lease does not normally expire while its owning request is
still active; a legitimate, merely-delayed concurrent request still lands
inside the benign window; a genuine concurrent loser gets a safe `409`
rather than triggering family revocation; an abandoned lease still expires
in bounded time; and a previous token presented after the full
15-second policy window is classified as replay, not conflict. **SEC-3F
must empirically validate these three values under production-like
latency before activation** (§33) and may adjust them only through another
reviewed security contract, not silently.

### Per-tab behavior

Preserve the existing `refreshPromise`-based single-flight pattern (§5),
one instance **per realm** (`refreshPromise` for user, a separate one for
employer). Multiple 401s arriving in the same tab all `await` the same
in-flight promise: exactly one refresh request leaves the tab, each
original failed request is retried at most once against its result, and
no request loops.

### Cross-tab mutual exclusion — primary: Web Locks API

Where `navigator.locks` is supported (Chrome 69+, Firefox 96+, Safari
15.4+), acquire a realm-specific named lock before initiating any refresh
call: `strideto-user-refresh-lock` / `strideto-employer-refresh-lock`.
Only the lock holder sends a refresh request. Other tabs queue behind
`navigator.locks.request(...)` (built-in FIFO, no polling) rather than
firing a request at all. Once a waiting tab acquires the lock (after the
current holder completes), it performs its **own** silent refresh using
the browser's current cookie state — serialized, so this is an ordinary
rotation (§22 step 8), not a conflict. Web Locks release automatically
when the holding tab closes or navigates away — no manual cleanup, no
orphaned lock. No token is passed between tabs at any point.

### Cross-tab fallback, exact hierarchy

**`BroadcastChannel` — notification-only, never a mutex by itself.**
Where Web Locks is unsupported but `BroadcastChannel` is, it broadcasts
one of `refresh_started` / `refresh_completed` / `refresh_failed` /
`session_epoch`, each carrying only a realm identifier and a non-secret
`ownerNonce` — it is explicitly **not** an atomic lock or leader-election
primitive on its own (two tabs can both observe "no claim yet" before
either posts, exactly the race a real mutex must prevent). Mutual
exclusion in this fallback path is provided by the `localStorage` lease
below; `BroadcastChannel` only announces state transitions faster than
polling `localStorage` would.

**`localStorage` lease — the actual fallback mutex.** A realm-specific key
(`strideto_user_refresh_lease` / `strideto_employer_refresh_lease`) holds:

```text
ownerNonce   String  — random per acquisition attempt
acquiredAt   Number  — epoch ms
expiresAt    Number  — acquiredAt + 12000ms (lease TTL, table above)
sessionEpoch Number  — the realm's current session epoch (§ below)
realm        'user' | 'employer'
```

**Never** a token, hash, JWT, `sid`, `jti`, user/employer identifier, or
CSRF credential. Acquisition is write-then-verify, closing the
write-write race a naive check-then-write lease would have: a contender
(a) confirms no existing lease is present and unexpired (or claims an
expired one), (b) writes its own `{ownerNonce, acquiredAt, expiresAt,
sessionEpoch, realm}`, (c) **reads the key back** and verifies its own
`ownerNonce` is still the value stored — only then does it consider
itself the owner and send a refresh request. A tab whose nonce does not
survive the read-back lost the race and must **not** refresh; it instead
waits (see retry ordering below) for the verified owner's completion
signal or the lease's `expiresAt`. A lease is treated as abandoned once
`Date.now() > expiresAt` (bounded by the 12000ms TTL — covers a
crashed/killed tab, since `localStorage` has no automatic
release-on-close unlike Web Locks) and may then be claimed by another
tab via the same write-then-verify sequence.

**When `localStorage` itself is unavailable** (private-browsing storage
restrictions, quota exhaustion, or explicitly disabled), `BroadcastChannel`
may still provide best-effort notifications, but no client-side mutual
exclusion exists in that degraded case — the server-side CAS/`409`
contract (§22) is the sole correctness boundary for it, exactly as it
already is for any genuinely uncoordinated request.

**No lease or channel message, on any tier, ever contains** an access
token, refresh token, token hash, JWT, `sid`, `jti`, user identifier,
employer identifier, or CSRF credential — verified by the exact field
lists above.

### Cross-tab logout signal

Unchanged in mechanism: `BroadcastChannel('strideto-auth')` (or
`storage`-event fallback) broadcasts a numeric **session epoch** and a
`logout` event type only. Other tabs clear in-memory state and redirect.

### Server conflict retention (unchanged mechanism, corrected timing, §22)

One-successor CAS is retained without change: one current refresh token
mints at most one successor; a concurrent loser never receives a second
successor and the server never stores or hands out a plaintext successor
merely to satisfy a loser. Within the 15000ms concurrency window,
presenting the just-superseded token returns `409` with exactly one
authoritative retry instruction — the `Retry-After: 1` header — and the
generic body `{ "error": "refresh_conflict" }` (no second, conflicting
`retryAfterMs` value, corrected from SEC-3A.2-P2); issues no access token,
issues no refresh token, and does **not** revoke the session (§22).

### Retry ordering, exact

For a tab receiving `409`:

1. Do **not** retry immediately.
2. Continue waiting for the current Web Lock holder, or the verified
   `localStorage` lease owner, to finish.
3. Observe `refresh_completed`/`refresh_failed` via `BroadcastChannel`
   where available, as a faster-than-polling signal of the same thing.
4. Once the lock/lease is released, attempt to acquire ownership itself
   (Web Locks queue position, or the lease write-then-verify sequence).
5. Respect `Retry-After` as a **minimum** delay — the client must not
   retry sooner than the header instructs, even if a completion signal
   arrives earlier; it may still need to wait longer if ownership
   acquisition (step 4) itself takes longer.
6. Retry **exactly once**, using the browser's current cookie jar state
   (always fresh — never client-cached).
7. On another `409`, a `401`, a request timeout, or any terminal refresh
   failure: release its own lock/lease if it holds one; clear in-memory
   authentication state; increment the realm's session epoch; require
   reauthentication. No unbounded loop.

**Exact scenario handling, as required:**

- **Losing response arrives before the winning response**: harmless by
  construction — the losing tab's retry is gated on lock/lease
  ownership and the completion signal (steps 2–4), not on raw response
  arrival order.
- **Winning request fails before rotation** (network error, 5xx, or
  timeout prior to the CAS write completing): the `RefreshSession`
  document remains on its original `currentTokenHash` — nothing was ever
  written. The next lock/lease holder retries using the **unchanged**
  cookie; this is an ordinary, non-concurrent rotation attempt and must
  **not** be classified as replay, since the token being presented is
  still genuinely current.
- **Winner rotates successfully but closes/disconnects before broadcasting
  completion**: the CAS write already succeeded server-side (new
  `currentTokenHash`, new cookie already set via that response's
  `Set-Cookie` if it reached the browser, or lost with the connection if
  it did not — either way the _server_ state has already moved to the new
  hash). Web Locks releases automatically on tab close; the fallback
  lease expires within its 12000ms TTL regardless of whether a
  `refresh_completed` broadcast ever fired. The next owner performs a
  fresh refresh against whatever cookie state the browser actually holds.
  No second successor is ever issued from the original old token — the
  CAS filter (§22 step 8) already guarantees that regardless of how this
  scenario resolves.
- **`localStorage` unavailable**: falls to `BroadcastChannel`
  notification-only mode with the server's CAS/`409` contract as the sole
  correctness boundary, as stated above.
- **Web Locks unsupported**: falls to the `BroadcastChannel` +
  `localStorage`-lease fallback tier in full.
- **Network delay causing a legitimate request to land outside the
  15-second window**: mitigated three ways, stated honestly rather than
  dismissed: (1) Web Locks serialization means legitimate multi-tab
  traffic in a capable browser rarely produces genuinely concurrent
  server-side requests at all; (2) the invariant above (client timeout
  10000ms < lease TTL 12000ms < window 15000ms) leaves real margin under
  realistic conditions, not a razor-thin timer; (3) SEC-3F's
  real-infrastructure/adversarial acceptance is required to include a
  genuine concurrent-refresh integration test under realistic network
  conditions before production activation (§33), and every value in the
  timing hierarchy must be revisited, via a reviewed security contract,
  if that testing shows it insufficient. A previous-token presentation
  outside the 15-second window is classified as replay and revokes only
  the affected session (one document, §21) — it never revokes any other
  family, and it never mints a second successor either way (§22).

### Logout during an in-flight refresh

Unchanged in mechanism: logout increments a local, monotonically
increasing **epoch** counter and clears state immediately. Any in-flight
refresh promise, upon resolving, checks whether its captured epoch still
matches the current epoch before applying its result; if the epoch has
advanced, the stale result is discarded unapplied. The same epoch check
covers any slow, now-obsolete refresh response landing after a newer one,
independent of the lock/lease coordination above.

## 24. Access-token invalidation enforcement contract

**Corrected in full (SEC-3A.2)**: the SEC-3A.1 design's 30–60s
Redis-cache TTL is withdrawn as the baseline — the task's own instruction
is direct: the final gate must not silently permit a suspended or deleted
account to retain access merely because a stale cache entry exists for up
to a minute. This section replaces that design with one exact, chosen
contract and states every outage/staleness case precisely, as required.

**Chosen baseline design: Option A — direct MongoDB projection on every
authenticated request, no cache in the initial secure implementation.**
On every authenticated request, after JWT signature/expiry/issuer/
audience/algorithm verification (`JWT_SECRET`, §19A), `requireAuth`/
`requireEmployerAuth` perform a minimal, indexed point lookup —
`User.findById(subjectId, { tokenVersion: 1, accountStatus: 1 })` (or the
`Employer` equivalent) — keyed on `_id`, the collection's primary index,
so this is an O(1) indexed read, not a scan, and the same pattern already
paid on every refresh (§22 §4). Reject 401 if: the subject is not found;
`accountStatus` is suspended/deleted; or `tokenVersion` does not equal the
token's `tokenVersion` claim. This has **zero staleness by construction**
— there is no cache to be stale, so no suspended/deleted account can ever
retain access beyond the request in which its status actually changed.

**Rejected alternatives, stated explicitly:**

- **Rejected (as the required baseline): a 30–60s Redis-cache TTL layer**
  — this is exactly the design the task rules out: a real, deliberate
  window in which a suspended account retains access purely because of
  cache staleness. Not acceptable for the 10/10 gate (§35).
- **Rejected: check on selected "sensitive" routes only** — does not
  close F-C3 on every non-flagged route.

**Option B — a later, optional, write-through Redis layer — is
permitted, but only under an exact contract, and only as a performance
optimization layered on top of Option A, never as a replacement for its
correctness guarantee:**

- MongoDB remains the source of truth; a cache entry is never written
  before the corresponding MongoDB write is confirmed committed (DB write
  always precedes and gates any cache mutation — this ordering rule
  alone prevents "cache succeeds, database fails" from ever occurring, so
  that specific case needs no separate handling).
- Every `tokenVersion`/`accountStatus` write **deletes** (not updates)
  the corresponding cache key immediately after the MongoDB commit —
  delete-on-invalidate, not refresh-on-invalidate, because a failed
  _delete_ just means the next read pays a MongoDB round trip (safe by
  construction), whereas a failed _update_ could leave a stale positive
  value cached indefinitely.
- If the post-commit cache delete itself fails: retry it a small bounded
  number of times; if still failing, log an urgent alert (the MongoDB
  write already succeeded and is authoritative, so the operation itself
  still reports success) and rely on a **short backstop TTL** — 5–10s, not
  60s — as the final safety net for exactly this failure mode, so even a
  permanently-failed delete self-heals within single-digit seconds rather
  than up to a minute.
- A cache **hit** is trusted only as a fast path; it is still subject to
  the backstop TTL above. A cache **miss** always falls through to the
  direct MongoDB read (identical to Option A) and repopulates the cache.
- **Residual race window, stated honestly, not overclaimed as zero**: a
  request racing in the narrow interval between the MongoDB commit and
  the cache delete taking effect could still observe a stale cache hit —
  bounded by the time between two writes (single-digit milliseconds under
  normal operation), fundamentally different from and far smaller than a
  60s TTL-based window, but not literally instantaneous. This is stated
  explicitly rather than claimed away.
- **No process-local (in-memory) fallback, ever, in either option** —
  unlike the current `tokenStore.js` `Map` fallback (F-H2).

**Exact behavior, every case the task requires:**
| Condition | Behavior |
|---|---|
| Redis unavailable (Option A) | N/A — Option A never consults Redis |
| Redis unavailable (Option B) | Fall back to direct MongoDB read, identical to Option A |
| Redis returns a stale value (Option B) | Bounded by delete-on-invalidate + the 5–10s backstop TTL, not a 60s window |
| MongoDB unavailable (either option) | **Fail closed** — reject the request; never default to allow |
| DB update succeeds, cache delete fails (Option B) | Retry, then alert; MongoDB remains authoritative; backstop TTL bounds exposure to 5–10s |
| Cache update succeeds, DB update fails | Prevented by construction — cache is only ever touched after the DB write is confirmed committed |

**Maximum invalidation delay, stated precisely**: **~0 (this request
onward)** under the required Option A baseline. If Option B is later
adopted, bounded by the smaller of the two-write race window or the 5–10s
backstop TTL — never 60s.

**Single unified revocation primitive, unchanged from SEC-3A.1**: every
account-state-changing admin action (suspend, delete, role change,
password change, email change) bumps `tokenVersion` as part of the same
operation — one shared check catches all of these cases. Enforced by a
dedicated test requirement (§30): every such admin action must be
asserted to bump `tokenVersion`, and the access-token middleware check
itself must be asserted to reject a stale-claim token via a real
middleware-level test.

## 25. CORS/CSRF at preview environments

Vercel preview URLs (`*.vercel.app`) are genuinely cross-site relative to
`api.strideto.com`. They are handled by the existing CORS preview
allowance (unchanged) but **do not receive the production `SameSite=Lax`
cookie** by design — a preview deployment authenticating against the
production API is not a scenario this design needs to support with cookie
auth; if preview environments need authenticated testing, that is a
separate, already-existing bearer-token-compatible path, not a reason to
weaken the production cookie's `SameSite` policy.

## 26. Deferred scope: OAuth

OAuth remains **disabled and unimplemented** (§7). It is explicitly **not
required** to close any active-scope finding in this gate (§35) — the
existing UI stub already reads "coming soon" and is genuinely
non-functional; there is no live OAuth flow to secure or leave insecure.
The task's own instruction applies directly here: do not expand attack
surface solely to satisfy an audit checklist. The following target
architecture is documented for **whenever OAuth is actually greenlit as a
product decision** (a future, separate, product-gated phase — not part of
SEC-3B–3G):

Server-side authorization-code exchange (never implicit flow), PKCE even
though the exchange is server-side, a `state` parameter bound to a
short-lived server value for CSRF/session-binding on the callback, a
`nonce` in the ID token, a strict redirect-URI allowlist (exact match, no
wildcard), and the callback must never place a token in a URL query string
or fragment — it issues a session through the exact same primitives as
password login (§18, §21): a new `RefreshSession` document (never reusing
a pre-existing unauthenticated identifier — closes session fixation by
construction) and an `HttpOnly` refresh cookie. Account linking matches by
verified email; does not silently auto-link to an existing unverified-email
account (prevents account-takeover-via-OAuth).

## 27. Deferred scope: Mobile

Mobile remains **absent** (§6) — no login screens, no token storage, no
device identity primitive, `expo-secure-store` not installed. It is
explicitly **not required** for this gate for the same reason as OAuth:
there is no live insecure mobile auth implementation to fix, only an
inactive scaffold. The following target architecture is documented for
**whenever mobile authentication is actually greenlit** (future,
product-gated, not part of SEC-3B–3G):

`expo-secure-store` (confirmed SDK-compatible, `~50.0.0` managed workflow)
for both access and refresh tokens — never `AsyncStorage`, never a plain
file — because the current Expo/React-Native/axios stack has no reliable
cross-platform `HttpOnly` cookie-jar persistence, and the server has no
cookie-reading code regardless (§6). Mobile would use a **body-token
transport** variant of the refresh endpoint (bearer tokens in the response
body, never a cookie) — this is a legitimate, architecturally-necessary
difference from web's cookie transport, not the "browser-readable
JSON refresh token" anti-pattern §29 prohibits: it is scoped to a client
that has no cookie mechanism at all, stored in OS-backed secure storage,
never `localStorage`/`AsyncStorage`.

## 28. Browser migration

`AuthContext.jsx`/`EmployerAuthContext.jsx`: stop calling
`localStorage.setItem` for any token; hold the access token in a React
ref/state variable only. Startup session restore changes from
"is a token present in storage" to "attempt a silent refresh via the
`HttpOnly` cookie." `axiosBase.js`/`employerService.js`: request
interceptor reads the in-memory access token; 401 interceptor calls the
refresh endpoint with `credentials:'include'` and the fixed
`X-Strideto-Client` forced-preflight header (§19) — no CSRF token is read
from or written to any cookie, since no browser-readable CSRF cookie
exists (§19). Logout calls use the in-memory access token as a normal
`Authorization: Bearer` header (§18A, §19), not the cookie. Add the
realm-specific Web Locks/`BroadcastChannel`/`localStorage`-lease
coordination (§23) and the `BroadcastChannel` cross-tab logout signal
(§23). `ProtectedRoute.jsx`/`ProtectedEmployerRoute.jsx` require no
structural change. **Access-token lifetime should be shortened from 1h to
roughly 10–15 minutes** — safe specifically because refresh becomes
silent, automatic, and cookie-driven, and this sharply reduces the window
before `tokenVersion` enforcement (§24) catches an invalidation.

## 29. Logout/invalidation contract

| Event                                      | RefreshSession change                                                                            | Cookie/storage                 | Access-token implication                                                                                       | Audit event                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Normal logout                              | Revoke this one document (`revokeReason:'logout'`)                                               | Clear refresh+CSRF cookies     | Denylist the presenting access token (existing mechanism)                                                      | `auth.logout`                             |
| Logout-all-sessions (**new**)              | Best-effort `updateMany` across every `RefreshSession` for `subjectId` (§21 — not transactional) | Clear current client's cookies | `tokenVersion` bump is the authoritative, immediate signal (§24); refresh-side cleanup is defense-in-depth     | `auth.logout_all` (new)                   |
| Password change                            | Bump `tokenVersion`; best-effort revoke all sessions                                             | Clear current client's cookies | Immediate via `tokenVersion` (§24, ≤60s)                                                                       | Existing `auth.change_password`, extended |
| Password reset (unauthenticated)           | Bump `tokenVersion`; best-effort revoke all sessions                                             | N/A                            | Same                                                                                                           | Existing pattern, extended                |
| Email change                               | Bump `tokenVersion`; best-effort revoke all sessions                                             | —                              | Same                                                                                                           | New event                                 |
| Account suspension (**new — closes F-C3**) | Bump `tokenVersion`; best-effort revoke all sessions                                             | —                              | Access closes within ≤60s instead of up to 1h; refresh closes immediately once its session document is revoked | New event                                 |
| Account deletion                           | Bump `tokenVersion`; revoke all sessions; TTL-expire records                                     | —                              | Same                                                                                                           | Existing deletion audit, extended         |
| Role change                                | Bump `tokenVersion` only                                                                         | —                              | Closes "role change has zero effect on outstanding tokens"                                                     | New event                                 |
| Refresh-token replay detected              | Revoke this one document (§22)                                                                   | —                              | —                                                                                                              | New security event                        |
| Refresh conflict (benign race, §22)        | No revocation                                                                                    | —                              | —                                                                                                              | `auth.refresh_conflict` (informational)   |

All rejection responses use one generic message/status regardless of the
precise internal reason — no response ever reveals whether a session
existed and was revoked vs. never existed.

## 30. Infrastructure requirements

```text
Required for implementation (no new infra needed):
- SEC-3B/3C/3D (new model + dormant cookie/CSRF/account-state primitives) —
  pure MongoDB single-document operations plus stateless middleware, works
  against the existing standalone mongo:7 topology.

Required for production activation (SEC-3E cutover, verified in SEC-3F,
gated overall on SEC-3G, §33):
- HTTPS terminated correctly with trust-proxy forwarding the real scheme
  (already configured for HSTS).
- api.strideto.com confirmed DNS-live and TLS-provisioned against the
  Render backend at the moment of cutover (§11 — cannot be verified from
  the repository; a named, required, manual pre-activation check, folded
  into SEC-3F's infrastructure acceptance).
- Redis strongly recommended (not strictly required for correctness, per
  §22/§24's MongoDB-fallback design) to avoid a direct DB read on every
  request at scale.
- Background TTL cleanup for expired RefreshSession documents — a MongoDB
  TTL index on expiresAt is sufficient.

Required for final 10/10 acceptance (active scope, §35):
- Redis made mandatory (hard-fail, not merely warned) once tokenVersion-
  cache/rate-limiting depends on shared state across a genuinely
  multi-instance deployment.
- Monitoring/alerting on replay_detected security events.
- Verified multi-instance deployment test confirming session/rate-limit
  state is correctly shared.

Not required for this gate (unchanged, independent recommendation from
STRIDETO-AUDIT-01): MongoDB replica-set topology. Every operation in this
design (§21, §22) is proven single-document; a replica set remains
valuable for the platform's broader transaction-safety posture but is not
a blocker for this mechanism's correctness.
```

## 31. Test matrix (active scope)

**Server**: login sets the correct refresh cookie with exact attributes
(§18, SameSite=Lax); refresh token absent from the web JSON response;
refresh token stored hashed, never plaintext; cookie clearing exactly
matches set attributes; rotation via CAS issues exactly one new session
per winning request (§22); a second concurrent presentation of the
previous token within the concurrency window returns HTTP 409 and does
**not** mint a second token pair; presentation outside the window (or of
an even-older token) revokes the session and is logged as
`replay_detected`; logout-current vs. logout-all behave distinctly;
`tokenVersion` bump is asserted for every admin action listed in §29
(regression test: temporarily remove a bump, confirm the invalidation
test fails, restore it); the tokenVersion check itself is asserted to
reject a stale-claim token via a real middleware-level test, not just
source inspection; issuer/audience/algorithm-allowlist/type-claim rejects
mismatching or cross-realm tokens (§19A); realm/subject/session-document
match rejected on mismatch (§22 step 5); refresh rejects a suspended/
deleted subject and a stale `tokenVersion`/`tokenVersionAtIssue` before
CAS runs, fails closed, issues nothing (§22 step 5); CSRF/origin failure
rejected on all cookie-authenticated routes with the exact generic error
shape (§19); a trusted-origin request with no CSRF cookie involved
succeeds (§19 — the double-submit-cookie design is withdrawn); an
untrusted/missing Origin in production is rejected even when `Referer` is
absent too; logout succeeds via bearer access token alone, with no cookie
attached to the request; no secret or token value appears in any log
output.

**Concurrency (SEC-3A.2-P2, normalized in P2.1, §23)**: Web Locks permits
only one active refresh request while one holder is active; a
`BroadcastChannel`-alone scenario is never treated as a mutex in the
test's own assertions (it must only ever gate on the verified
`localStorage` lease or the Web Locks queue); simultaneous `localStorage`
lease-acquisition attempts produce exactly one verified owner (the
write-then-verify sequence, §23); an abandoned lease expires safely at its
12000ms TTL; the lease TTL is asserted to exceed the client HTTP timeout
(12000ms > 10000ms) and the server benign window is asserted to exceed the
lease TTL (15000ms > 12000ms) — the full timing invariant (§23), not just
its individual values; a losing `409` response arriving before the winning
response does not cause a false replay classification; a winning response
arriving without a completion broadcast still resolves correctly via lease
expiry; a winning tab closing (with and without completing rotation) is
handled per §23's exact scenario table, including the "winner fails before
rotation → next holder retries on the unchanged cookie, not classified as
replay" case; the `409` response carries exactly one authoritative retry
instruction (`Retry-After` header only, no conflicting body field); retry
occurs at most once; no cross-tab lease or channel message (Web Locks,
`BroadcastChannel`, or `localStorage`) ever contains a credential (the
exact field lists in §23); legitimate delayed concurrency within 15
seconds does not revoke the session; a previous-token presentation outside
15 seconds triggers replay handling; one old token still creates at most
one successor in every scenario tested above.

**Browser**: no refresh token ever written to `localStorage`; no access
token persisted to any storage (verified by inspecting storage directly);
no token in `sessionStorage` or IndexedDB; no token ever appears in a URL;
startup session restore succeeds via silent refresh; cross-tab logout
signal received and acted on, carrying no token value; a refresh response
resolving after a logout epoch change is discarded, not applied; refresh
failure clears state and redirects; local-development cookies (§18B) set
and cleared correctly against `http://localhost:5173`/`http://localhost:5000`.

**Integration** (real infrastructure, run only in an authorized isolated
environment, not in any read-only/unit-only phase): a real cookie jar
across multiple simulated requests; CORS credentials mode end to end;
Origin/Referer validation against real same-site and cross-site requests;
proxy/HTTPS-forwarded-scheme behavior; production cookie flags actually
observed on the wire; database-backed rotation under **genuine** (not
simulated) concurrency, asserting exactly one 200 and one 409 and no false
replay under real network jitter (§23); Redis-outage degradation;
database-outage fail-closed behavior (both the refresh-time check, §22,
and the access-token check, §24); live DNS/TLS check of `api.strideto.com`
(§11, §33); this category's completion is required before SEC-3G, and
production deployment does not occur until SEC-3G is accepted (§33, §35).

## 32. Migration risks and cutover discipline

**Corrected from a production dual-emit design to a fully local,
atomic-cutover design.** The original report proposed shipping a
coordinated release where the server emits both the new cookie _and_
continues to also emit the refresh token in JSON "for one release" as a
rollback safety net. This is removed entirely, per the task's explicit
instruction: no production release may return both a cookie refresh token
and a browser-readable JSON refresh token, and no temporary compatibility
toggle may exist even locally across a push/deploy boundary.

**Verified: no external consumer requires the JSON-embedded refresh
token.** Server research found no API consumer of the login/refresh JSON
response besides the web client itself (no public API-key/service-token
surface shares this auth middleware). A future mobile phase (§27) would
use the body-token transport for its own architectural reason (no cookie
jar), which is a distinct, justified design — not a legacy-compatibility
shim for the web client's removed behavior, and not part of this gate's
scope.

**Cutover sequencing, corrected (SEC-3A.2-P2, §33)**: SEC-3B (dormant
model), SEC-3C (dormant cookie/Origin primitives), and SEC-3D (revocation/
account-state foundation) are all independently committable with zero
production behavior change — none of them wires into a live route. SEC-3E
is the **single atomic, coordinated local cutover**, and it is the first
phase in the sequence with live-behavior risk: server (wire SEC-3B/3C/3D
into live login/refresh/logout, start issuing/consuming the cookie,
enforce Origin validation, **activate account-state/tokenVersion
enforcement at the same time**, not as a follow-up) and client (stop all
`localStorage` refresh/access-token reads and writes, move to memory-only
access token, `credentials:'include'`) change together, in the same local
commit or tightly sequenced local commits, completing full removal of
browser-readable refresh tokens **before any push or deployment of that
state**. No intermediate state where the server emits a cookie while the
client still reads a JSON refresh token — and no intermediate state where
account-state enforcement lags behind the live cutover — is ever pushed or
deployed. `authRealm.test.js`/`employerAuthRealmIsolation.test.js`
(currently assert `localStorage`-key behavior) must be rewritten, not
merely updated, as part of this same cutover.

## 33. Implementation phases

**Corrected in full (SEC-3A.2-P2)**: the SEC-3A.1 ordering allowed
production activation directly after the cutover phase while account-state
enforcement was deferred to a later phase — meaning a deployable
intermediate state could exist where cookie-based sessions were live but
suspension/tokenVersion enforcement was not yet wired in. That ordering is
replaced below: account-state/revocation enforcement (SEC-3D) is now built
_before_ the live cutover (SEC-3E), and the cutover activates it in the
same coordinated change, so no deployable state ever has live sessions
without live enforcement.

```text
SEC-3B — Dormant RefreshSession and JWT Foundation
Goal: One-document-per-family RefreshSession model (§21); separate
  access/refresh signing material (§19A); sid/jti claims; tokenVersion
  fields on User/Employer; CAS rotation service (§22) — as new, dormant
  code alongside the existing tokenStore.js system. No live route
  integration.
Allowed files: new model(s), new service(s), new unit tests only.
Migrations/models: RefreshSession collection (new), tokenVersion field
  added to User/Employer (additive, no destructive migration).
API contract changes: none (dormant).
Tests: full unit coverage of §22's CAS/conflict/replay logic and §19A's
  signing/claim verification against a mocked or in-memory Mongo double.
Stop conditions: any change to an existing live route or middleware.
Deployment: prohibited. Dormant code may be checkpointed locally.

SEC-3C — Dormant Cookie, Origin and Session-State Primitives
Goal: Production and development (§18B) cookie set/clear helpers matching
  §18's exact attributes; trusted-Origin/Referer validation middleware
  (§19); the authoritative account-state/tokenVersion validation helper
  (§24, Option A baseline); refresh-time subject/version enforcement
  helper (§22 step 5) — built and unit-tested in isolation, still NOT
  wired into any live route or requireAuth call.
Allowed files: new cookie/Origin/account-state-check utility modules, new
  unit tests only.
Migrations/models: none beyond SEC-3B's.
API contract changes: none (dormant).
Tests: cookie attribute correctness (prod and dev); Origin/Referer
  validation; account-state/tokenVersion helper correctness including the
  exact outage table in §24 — all against unwired functions.
Stop conditions: any change to a live route, controller, or requireAuth.
Deployment: prohibited. Dormant code may be checkpointed locally.

SEC-3D — Revocation and Account-State Foundation
Goal: Ensure every active suspend/delete/password-change/password-reset/
  role-change/email-change path bumps tokenVersion correctly (§29);
  logout-current and logout-all services (§18A, §19 — bearer-authenticated,
  sid-based); best-effort RefreshSession cleanup (§21). Built and tested
  against the dormant SEC-3B/3C primitives; still no browser-token
  cutover — no live route yet depends on the new cookie/memory-only
  contract.
Allowed files: admin suspend/role-change/delete handlers, password/
  email-change controllers, new logout-current/logout-all services,
  related tests. No change to the currently-live cookie-free
  login/refresh/logout routes themselves.
Migrations/models: none beyond SEC-3B's tokenVersion field.
API contract changes: none — this phase makes tokenVersion bumping
  correct and builds the logout services, but does not yet wire live
  authentication routes to consume them.
Tests: `tokenVersion` bump asserted for every admin action in §29
  (regression test: temporarily remove a bump, confirm the test fails,
  restore it).
Stop conditions: any admin action found to change account state without a
  corresponding tokenVersion bump; any attempt to wire a live route to the
  new cookie contract in this phase (that is SEC-3E's job, not this one's).
Deployment: prohibited. No active route may depend on a partially
  completed new browser contract.

SEC-3E — Atomic Server-and-Browser Authentication Cutover
Goal: The single coordinated cutover (§32): integrate both realms' login,
  refresh and logout routes against SEC-3B/3C/3D together; issue HttpOnly
  refresh cookies (§18); return access token only, remove refresh token
  from JSON; memory-only browser access token; remove every token
  localStorage/sessionStorage/IndexedDB writer and reader; enable
  `credentials: 'include'`; implement realm-specific refresh coordination
  (§23); **activate account-state/tokenVersion enforcement (SEC-3D) and
  refresh-time version checking (§22 step 5) as part of this same
  change** — not deferred to a later phase. Server and client change
  together.
Allowed files: server auth controllers/routes/middleware; requireAuth/
  requireEmployerAuth; AuthContext.jsx, EmployerAuthContext.jsx,
  axiosBase.js, employerService.js; related server and client tests
  (including rewriting authRealm.test.js/employerAuthRealmIsolation.test.js).
Migrations/models: none beyond SEC-3B's.
API contract changes: refresh cookie now set on login/refresh; refresh
  token permanently absent from the web JSON response (no transition
  window); account-state/tokenVersion enforcement now live.
Tests: full server+browser test matrix (§31), including concurrency (§23).
Stop conditions: any attempt to push or deploy a partial state (server
  wired without client, or account-state enforcement not active alongside
  the cookie cutover, or vice versa).
Backward compatibility: intentionally broken for the removed JSON field —
  this phase is the cutover, not a transition.
Deployment: not permitted directly after this phase — proceeds only after
  SEC-3F acceptance passes and SEC-3G completes (below). Local commits of
  this phase's result are permitted.

SEC-3F — Real Infrastructure and Adversarial Acceptance
Goal: End-to-end acceptance against real, authorized, isolated
  infrastructure — real MongoDB; shared Redis/multi-instance checks where
  the design depends on them; a real cookie jar; production-like CORS and
  Origin behavior; genuine (not simulated) simultaneous refresh (§23);
  replay testing; suspension/password-reset invalidation; Redis-outage and
  MongoDB-outage behavior; live `api.strideto.com` DNS/TLS verification
  (§11); production cookie flags observed on the wire; replay-monitoring
  verified.
Allowed files: test files only, plus narrow fixes to files already
  authorized in SEC-3B–3E if a genuine defect is found.
Migrations/models: none unless a defect requires a field correction.
Tests: the full integration category from §31, executed for the first
  time against real infrastructure.
Stop conditions: any finding requiring infrastructure not yet authorized.
Deployment: remains prohibited until this phase passes.

SEC-3G — Legacy Removal and Final Authentication Audit
Goal: Remove tokenStore.js's single-slot system and old browser
  JSON-refresh compatibility; remove old localStorage token keys and
  compatibility helpers; remove dead `User.refreshToken`/
  `refreshTokenExpires` schema fields (verified zero consumers first);
  confirm inactive OAuth/mobile remain unreachable (§26, §27); run the
  complete authentication security regression; produce the final
  authentication sign-off against §35's 10/10 gate.
Allowed files: server auth code (deletions), User/Employer schema (field
  removal), new final audit report.
Migrations/models: destructive field removal, gated on a verified-safe
  window (confirm no in-flight sessions depend on the old fields).
Tests: full regression across every prior phase's test suite.
Stop conditions: any discovery that a consumer still depends on removed
  behavior.

Earliest production deployment: only after SEC-3G is complete and
accepted — not after SEC-3E alone, and not merely after SEC-3F. Legacy
browser-readable-refresh-token code must not remain present in the
deployed artifact at all, so its removal (SEC-3G) is a deployment
precondition, not a follow-up cleanup task.
```

OAuth (§26) and Mobile (§27) are explicitly **not** part of this sequence.
If either is greenlit as a future product decision, it becomes its own
separate, later phase built against the SEC-3B–3G foundation, gated on its
own external dependencies (Google OAuth credentials; a mobile app-store
release cycle) — not a prerequisite for SEC-3G or the 10/10 gate below.

## 34. Rollback strategy

**Corrected in full (SEC-3A.2-P2)**: the SEC-3A.1 rollback plan implicitly
allowed reverting the cutover commit back to "old tokenStore.js +
localStorage" as a production rollback target. That is withdrawn — the
task's instruction is explicit and is adopted without exception: **the
known-critical browser-readable-refresh-token architecture is never an
allowed production rollback target**, once secure production activation
(post-SEC-3G) has occurred. Availability degradation is preferable to
restoring that weakness.

**Before production deployment** (all of SEC-3B–3F, and any local SEC-3E
cutover commits that have not yet passed SEC-3F/SEC-3G): dormant and local
cutover commits may be reverted normally with `git revert` — no production
traffic is affected, since nothing has deployed yet (§33).

**After secure production activation** (i.e. after SEC-3G's completion and
the first production deploy), a bad release's permitted responses are
restricted to:

- **Roll forward** with a narrow, targeted correction — preferred whenever
  the defect is fixable without disabling authentication.
- **Revert only to a previously secure cookie-based release** — i.e. an
  earlier point in the SEC-3B–3G-and-beyond history that itself never
  exposed a refresh token to JavaScript, never wrote a token to
  `localStorage`/`sessionStorage`/IndexedDB, and never shared the access/
  refresh signing key. Reverting further back than that, to the pre-SEC-3G
  legacy architecture, is not permitted.
- **Temporarily disable login/refresh** while preserving already-issued,
  still-valid sessions, if the defect is isolated to the login/refresh
  path specifically.
- **Enter maintenance/read-only mode** for the affected realm.
- **Revoke all sessions and require reauthentication** (a global
  `tokenVersion`/family-revocation sweep) — the safe, blunt option when
  the defect's blast radius is unclear.
- **Disable only the affected realm** (user or employer) when the two
  realms' isolation (§18A) makes that technically possible, leaving the
  unaffected realm operating normally.

No option above ever restores JSON-embedded refresh tokens, restores
localStorage/sessionStorage/IndexedDB token storage, restores the
process-local single-slot `tokenStore.js`, restores a shared access/
refresh signing secret, or restores a state where account-status checks
are absent from authentication. No long-lived runtime feature-flag toggle
is used as the rollback mechanism.

## 35. Final 10/10 authentication acceptance criteria (active scope)

**Corrected and expanded in full (SEC-3A.2-P2)**. Scoped to the currently
active web (user + employer) authentication surface only. OAuth and
mobile are explicitly excluded from this gate (§26, §27) and may remain
outside it only while they stay unreachable, not advertised as
operational, not receiving or storing credentials, and free of an active
insecure implementation.

```text
Browser storage
  Refresh token absent from localStorage:      Required (HttpOnly cookie only, no JSON transition window)
  Access token absent from localStorage:       Required (memory-only, Candidate A)
  No token in sessionStorage:                  Required
  No token in IndexedDB:                       Required
  No refresh token in JSON (any response):     Required
  No token in any URL:                         Required
  No credential in BroadcastChannel/storage-
    event/Web Locks coordination metadata:     Required — only epoch numbers, ownerNonce, and timestamps may cross tabs (§23)

JWT contract
  Separate access/refresh signing keys:        Required (§19A) — JWT_SECRET vs REFRESH_SECRET, boot hard-fail if equal/unset
  Stable sid, unique per-token jti:             Required (§19A) — sid never reused as jti
  Issuer validation:                            Required
  Audience validation (realm-specific):         Required
  Algorithm allowlist:                          Required
  Token-type validation (refresh tokens):       Required
  Realm/subject/session-document match:         Required, checked before CAS (§22 step 5)

Session security
  Refresh token hashed at rest, never plain:    Required (unchanged)
  One-successor CAS:                            Required, verified by a real concurrent-request test (§23, §31)
  Safe concurrent-refresh conflict handling:    Required — 409, Retry-After, no token minted to the loser, no revocation (§22, §23)
  Replay detection + family revocation:         Required, verified by test
  Account status checked before refresh:        Required, fails closed (§22 step 5)
  tokenVersion checked before refresh:          Required, fails closed (§22 step 5)
  Account status/tokenVersion checked on
    every authenticated access:                 Required — Option A baseline, direct MongoDB, zero staleness (§24)
  No stale-positive cache authorization:        Required — no 30–60s window permitted; Option B, if ever adopted, bounded to single-digit ms plus a 5–10s backstop only (§24)
  Logout-current:                               Required, bearer-authenticated, sid-based (§18A, §19)
  Logout-all:                                   Required, best-effort and documented as such (§21, §29)
  Password-change/reset invalidation:           Required, tokenVersion bump + best-effort session revoke
  Suspension/deletion invalidation:             Required, same mechanism
  Role-change invalidation:                     Required, same mechanism

Cookie and request security
  Production __Secure- cookie wire-verified:    Required, on the wire, not just code review (§18)
  Development non-prefixed cookie verified:     Required (§18B)
  Realm-isolated cookie names and exact Paths:  Required, no overlap (§18, §18A)
  No cross-realm cookie attachment:             Required, verified by test (§18A)
  Strict trusted-Origin/Referer validation:     Required, mandatory not optional (§19)
  SameSite=Lax:                                 Required, as defense-in-depth alongside Origin validation (§19)
  No JavaScript-readable API-host cookie:       Required — the SEC-3A.1 design is withdrawn (§19)
  Exact cookie clearing (name/Path/SameSite/
    Secure all matching):                       Required, verified by test

Infrastructure and operations
  api.strideto.com DNS/TLS live:                Required, verified in SEC-3F before deployment (§11, §33)
  Production proxy/HTTPS verified:              Required
  Shared multi-instance state verified:         Required
  No process-local correctness fallback:        Required, in both the refresh path (§22) and the access-token path (§24)
  Redis requirement enforced where depended on: Required, hard-fail not merely warned, only where the final design actually uses it (§24 Option B, rate limiting)
  MongoDB outage fails closed:                  Required, both refresh (§22) and access-token (§24) paths
  Replay events monitored:                      Required
  Secure rollback only:                         Required — no rollback to browser-readable refresh tokens (§34)
  No deployment before SEC-3G acceptance:        Required (§33)

Inactive surfaces
  OAuth/mobile may remain out of this gate
    only while unreachable, not advertised as
    operational, not receiving/storing
    credentials, free of insecure legacy code:  Required condition for exclusion (§26, §27)
```

Replica-set topology remains an independent, existing STRIDETO-AUDIT-01
recommendation for the platform's broader transaction-safety posture — it
is not required by, and not part of, this specific gate (§21, §30).

## 36. Evidence classification summary

| Determination                                                                                                                               | Category                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-site production topology (strideto.com / api.strideto.com share eTLD+1)                                                                | Repository-proven fact (§11, four independent sources)                                                                                                              |
| `SameSite=Lax`, no `Domain` attribute, `__Secure-` prefix                                                                                   | Architecture decision, grounded in the fact above                                                                                                                   |
| Whether `api.strideto.com` is currently DNS-live/TLS-provisioned                                                                            | **Unresolved infrastructure decision** — not verifiable from the repository; verified in SEC-3F, gates deployment which does not occur until SEC-3G (§11, §33, §35) |
| One-document-per-family session model; CAS rotation requires no replica set                                                                 | Repository/design-proven fact, verified by construction (§21, §22)                                                                                                  |
| Logout-all / bulk revocation is best-effort, not transactional                                                                              | Repository-proven fact about MongoDB `updateMany` semantics (§21, §29)                                                                                              |
| Access-token invalidation: Option A (direct MongoDB, zero staleness) required baseline; Option B (write-through Redis) optional later layer | Architecture decision (§24)                                                                                                                                         |
| No JavaScript-readable CSRF cookie; Origin/Referer validation + SameSite=Lax + bearer-authenticated logout                                  | Architecture decision, replacing a design proven non-executable by cookie host/Path scoping rules (§19)                                                             |
| Separate access/refresh signing keys; sid/jti separation                                                                                    | Architecture decision, correcting F-H1 precisely (§19A)                                                                                                             |
| Account-state enforcement (SEC-3D) built and required before the live cutover (SEC-3E)                                                      | Architecture decision, closing the "deployable state with live sessions but no enforcement" gap (§33)                                                               |
| Production deployment does not occur until SEC-3G completes                                                                                 | Architecture decision, per explicit task instruction (§33, §35)                                                                                                     |
| OAuth and mobile remain out of required scope                                                                                               | Product-scope decision, consistent with the task's own instruction not to expand attack surface for inactive surfaces (§26, §27)                                    |
| Whether OAuth/mobile are ever built                                                                                                         | **Future, unresolved product decision** — explicitly out of this gate                                                                                               |

## 37. Preservation statement

This correction pass made no application-code, test, package-manifest,
lockfile, or environment-file changes. Only
`docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md` was
modified (in place, superseding its own prior content). No database
connection was made; all evidence gathering was static file reads, greps,
and `git`/`ls` commands. No production data was read or written. Final
verification, run immediately before this report was finalized:

```text
git status --short   → this report file (modified, not new); the two
                        pre-existing untracked reports unchanged
git rev-parse HEAD   → 87c44e2c432230681517bc0da78671ed906335b7 (unchanged)
```

No commit, stage, push, or deployment occurred. SEC-3B through SEC-3G
remain unstarted and were not referenced or resumed by any part of this
correction pass.

## 38. Final verdict

**AUTHENTICATION SESSION REDESIGN READY FOR PHASED IMPLEMENTATION.**
Production topology is resolved same-site by four independent repository
sources (§11), driving a `SameSite=Lax` cookie design (§18), not `None`.
The SEC-3A.1 CSRF-cookie design is withdrawn as non-executable (a
host-only, narrow-Path cookie is not readable by JavaScript on a different
host or an unmatching document path) and replaced with mandatory Origin/
Referer validation, `SameSite=Lax` defense-in-depth, and
bearer-authenticated logout (§19). Realm cookie isolation uses distinct
names and non-overlapping, route-exact Paths (§18A). Access and refresh
tokens use separate signing keys, with `sid` (session identity) and `jti`
(per-token identity) kept strictly distinct (§19A). Refresh rotation
verifies subject existence, realm, account status, and `tokenVersion`
before CAS runs, failing closed (§22 step 5) — independent of the
best-effort bulk cleanup used for logout-all. Access-token invalidation
uses a direct, zero-staleness MongoDB check as the required baseline, not
a 30–60s cache window (§24). Concurrency is resolved primarily by
client-side Web Locks serialization, with a documented `BroadcastChannel`/
`localStorage`-lease fallback and an exact, tested-before-activation
409-conflict/retry contract carrying no credential across tabs (§23).
Session metadata collection is minimized, with IP-hash removed entirely
(§20). No production dual-emit window exists anywhere in the plan — SEC-3E
is a single, fully local, atomic cutover that activates account-state
enforcement (built in SEC-3D) at the same time it activates cookie-based
sessions, so no deployable intermediate state has live sessions without
live enforcement (§32, §33). Production deployment does not occur until
SEC-3G completes, not after SEC-3E or SEC-3F alone (§33). Rollback after
secure activation is restricted to forward fixes, maintenance mode, secure
cookie-based reverts, or forced reauthentication — never a return to
browser-readable refresh tokens (§34). OAuth and mobile remain correctly
out of scope as inactive, unreachable surfaces (§26, §27). The one fact
this report cannot resolve from the repository — whether
`api.strideto.com` is currently DNS-live — is verified in SEC-3F and gates
deployment, not a blocker to starting SEC-3B/3C/3D (§11, §33, §35). No
product or infrastructure decision blocks starting SEC-3B.
