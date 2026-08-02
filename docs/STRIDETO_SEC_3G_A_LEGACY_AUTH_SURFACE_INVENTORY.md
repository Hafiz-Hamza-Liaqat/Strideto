# STRIDETO SEC-3G-A Legacy Authentication Surface Inventory

## 1. Verdict

**READY FOR BOUNDED SEC-3G IMPLEMENTATION**

The secure authentication architecture is the canonical local implementation, and the SEC-3F isolated local-staging acceptance evidence is complete. Legacy authentication remains present behind the non-production `STRIDETO_SECURE_AUTH_ENABLED=0` branch, but every active caller has a repository-confirmed secure replacement. One active Admin media-upload path still constructs an Authorization header from `localStorage`; it has a direct replacement in the existing in-memory User/Admin access-token module.

There are no unresolved high-risk `REVIEW REQUIRED` surfaces. Production activation remains blocked and is not authorized by this inventory.

Classification counts below count classified surfaces (a file can contain both retained canonical code and a stale comment classified separately):

- REMOVE: 2
- REWRITE: 14
- RETAIN: 16
- TEST-ONLY LEGACY FIXTURE: 2
- DOCUMENTATION/CONFIG CLEANUP: 11
- REVIEW REQUIRED: 0
- Total classified surfaces: 45

## 2. Repository authority

The audit began from the required clean authority:

- HEAD: `eb137199138bad94a1041b5b8b54aef346373875`
- Parent: `609f14c73dde698f4bac5b14a74683497bc4bf66`
- Branch before this documentation checkpoint: `main...origin/main [ahead 44]`
- Tracked modifications: none
- Staged files: none
- Preserved untracked reports:
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Preserved ignored file: `.env.staging`

The authority documents establish that secure authentication is canonical locally, SEC-3F passed in isolated local staging, production activation is still blocked, and SEC-3G may remove local legacy application paths. Git history and the documented deployment rollback procedure remain the rollback mechanism; production deployment is not authorized.

The SEC-3E checkpoint `effd3bb85b9abc58bba16ccc732170f3817f448a` introduced the secure composition while deliberately retaining legacy branches. This inventory maps the remaining removal work; it does not modify it.

## 3. Canonical secure-auth architecture

### User realm

- Login: `POST /api/auth/login`, composed through `authController.login` and `userSecureAuthFlows.issueLoginSession`.
- Initial issuance: `initialSessionIssuance` creates the MongoDB refresh-session record and issues separate access and refresh credentials. The controller returns only the short-lived access token and writes the refresh token through `AuthCookiePolicy`.
- Refresh: `POST /api/auth/refresh-token`, trusted-origin middleware first, realm cookie only, atomic rotation through `RefreshEligibilityCoordinator` and `RefreshSessionRotationService`.
- Cookie: production `__Secure-strideto_user_rt`, host-only, HttpOnly, Secure, SameSite=Lax, path `/api/auth/refresh-token`.
- Logout current/all: `POST /api/auth/logout` and `/api/auth/logout-all`, using family revocation, tokenVersion mutation where required, and shared Redis access-token denylisting.
- Protected access: `requireAuth` delegates to `secureAccessAuthorization`, which verifies JWT authority, Redis denylist state, realm, subject state, and tokenVersion.
- Client: `axiosBase.js` holds the access token only in module memory, sends credentials for the cookie, performs one cookie-backed refresh flight, and never sends a refresh token in a body or header.
- Reload: `AuthContext` treats its local profile cache as non-authoritative; protected bootstrap recovers authentication through the in-memory client and cookie-backed refresh.
- Account-state invalidation: `AccountSecurityMutationService`, `SessionSubjectStateProvider`, `SessionFamilyRevocationService`, and `accessDenylist` enforce password, suspension, role, logout-all, and tokenVersion invalidation.

### Employer realm

- Login/register: `POST /api/auth/employer/login` and `/api/auth/employer/register`, composed through `employerAuthController` and `employerSecureAuthFlows.issueLoginSession`.
- Refresh: `POST /api/auth/employer/refresh-token`, trusted-origin middleware first and Employer cookie only.
- Cookie: production `__Secure-strideto_employer_rt`, host-only, HttpOnly, Secure, SameSite=Lax, path `/api/auth/employer/refresh-token`.
- Logout current/all and password change: the Employer routes use the same canonical family-revocation, access-denylist, tokenVersion, and account-security boundaries while remaining in the Employer realm.
- Protected access: `requireEmployerAuth` accepts only the canonical Employer principal.
- Client: `employerService.js` uses a separate in-memory access token, credentialed cookie refresh, and a bounded single-flight retry.
- Reload: `EmployerAuthContext` uses only non-authoritative profile UI cache and cookie-backed bootstrap.

### Admin and SuperAdmin realm

Admin and SuperAdmin identities are User-realm accounts, not a third token realm. They authenticate through `POST /api/auth/login`, use the User refresh cookie and `axiosBase.js`, then pass role and permission middleware on `server/src/routes/admin.js`. No duplicate Admin login, refresh, or logout route was found. Role and suspension changes already have canonical account-security primitives, but `adminResetPassword` still performs a legacy refresh-slot revocation and must be rewritten to the canonical global-invalidation boundary.

## 4. Search method

The audit used read-only `git grep` and `rg` searches across tracked server, client, test, environment-example, and documentation files. Searches covered browser storage, refresh-token request and response transport, manually built Authorization headers, legacy JWT helpers, legacy Redis refresh slots, access-token denial helpers, secure-auth feature branches, duplicate authentication routes, old lifetime variables, stale configuration comments, and legacy assertions.

Keyword matches were inspected in context. Canonical internal refresh-token values passed between secure services and the cookie writer were not misclassified as response transport. Protected requests using an in-memory short-lived access token in an Authorization header were retained. Profile, consent, theme, language, onboarding, and preference values in browser storage were not classified as authentication persistence.

No database, Redis, application test, browser harness, build, or external service was used.

## 5. Backend inventory

### Active mixed secure/legacy boundaries

- `server/src/controllers/authController.js`: User login, refresh, logout, password-reset, and password-change behavior branches on `secureAuthConfig.enabled`. The false branch signs access and refresh JWTs with the legacy helper, uses a single Redis refresh slot, accepts refresh tokens from `req.body.refreshToken` or `x-refresh-token`, and returns a refresh token in JSON. Rewrite to canonical-only behavior.
- `server/src/controllers/employerAuthController.js`: Employer register/login/refresh/logout has the same legacy issuance and transport fallback. Rewrite to canonical-only behavior.
- `server/src/middleware/auth.js`: `legacyRequireAuth`, the legacy optional-auth verifier, and the old hash-keyed denylist remain selected by the flag. Rewrite `requireAuth` and `optionalAuth` as canonical-only while preserving all downstream realm and role middleware contracts.
- `server/src/middleware/secureTrustedOrigin.js`: currently becomes a no-op in legacy mode. Remove that bypass so state-changing routes always enforce the canonical trusted-origin policy.
- `server/src/services/auth/secureAuthConfig.js`: explicitly accepts non-production flag value `0`, emits a legacy warning, and returns no secure providers. Rewrite to construct the mandatory canonical configuration only.
- `server/src/services/auth/userSecureAuthFlows.js`, `employerSecureAuthFlows.js`, and `secureAccessAuthorization.js`: their runtime singleton exports become `null` when the flag is false. Make the canonical singletons unconditional after the configuration rewrite.

### Confirmed obsolete helpers and fields

- `server/src/utils/jwt.js`: legacy access and refresh signing/verification uses the same `JWT_SECRET`, legacy claims, and legacy lifetimes. Its only runtime callers are legacy controller/middleware branches. Delete after those callers are removed.
- `server/src/utils/tokenStore.js`: legacy single-slot refresh storage, verification, revocation, and hash-keyed access denylisting are obsolete. The file cannot be deleted wholesale because `hashResetToken` is still a canonical password/email/invitation token hashing dependency. Rewrite it to retain only that narrow hash helper.
- `server/src/models/User.js`: `refreshToken` and `refreshTokenExpires` are legacy schema fields with no current runtime writer. Remove the schema declarations after removing their defensive selection/sanitization references.
- `server/src/controllers/profileController.js`, `server/src/controllers/admin/exportController.js`, and `server/src/controllers/admin/usersController.js`: remove only obsolete `refreshToken`/`refreshTokenExpires` exclusion or deletion references while preserving response privacy.

### Canonical backend retained

The canonical route topology, `RefreshSession` model, separate signing secrets and claims, realm cookie policy, trusted-origin policy, initial issuance, atomic rotation, replay-family revocation, subject-state lookup, tokenVersion mutation, Redis denylist, and safe result contracts remain required. Internal secure services may carry a refresh token only within the server until the controller writes the cookie; that is not legacy JSON/header/browser transport.

## 6. Client inventory

The normal User and Employer clients are canonical:

- `client/src/services/axiosBase.js` and `client/src/services/employerService.js` keep access tokens in private module variables, use `withCredentials`, send empty refresh bodies, and bound refresh retries with a single-flight promise.
- `client/src/services/authService.js` calls the canonical User routes with no refresh credential payload.
- `client/src/context/AuthContext.jsx` and `EmployerAuthContext.jsx` persist only non-authoritative profile/UI cache; they do not persist access or refresh credentials.
- `client/src/auth/authRealm.js` keeps User and Employer bootstrap isolated.

One active legacy client surface remains:

- `client/src/components/media/MediaLibraryParts.jsx` reads `localStorage.getItem('token')` and manually sets an Authorization header for the Admin media XHR upload. Because Admin uses the User realm, this must use the current in-memory User/Admin access token while preserving XHR progress and cancellation. It must not add token storage or a cookie-only protected upload shortcut.

No other browser-storage match was an authentication credential.

## 7. Admin/SuperAdmin inventory

- Login, refresh, logout, and protected access are the canonical User-realm paths. `client/src/pages/Auth/Login.jsx`, `client/src/services/adminContentApi.js`, and `server/src/routes/admin.js` are retained.
- `updateUser`, `assignRole`, `bulkAssignRole`, `updateEmployer`, and `bulkSuspendEmployers` contain legacy direct-write fallbacks when secure auth is disabled. Remove those fallbacks and retain the canonical account-security mutation and family-revocation behavior.
- `adminResetPassword` is an active high-risk legacy invalidation boundary: it directly saves the new temporary password and calls the obsolete single-slot `revokeRefreshToken`. Rewrite it to the existing atomic account-security/tokenVersion mutation and all-family revocation contract. Preserve authorization, audit, bounded public response, email outbox behavior, and the existing temporary-password workflow; do not expose session or token evidence.
- The Admin media upload is the only discovered Admin browser-token-storage consumer and belongs in the client removal phase.

## 8. Tests inventory

- `server/src/__tests__/secureAuthConfig.test.js` deliberately proves explicit flag `0` legacy mode and warning behavior. Those cases are test-only legacy fixtures; rewrite the suite around mandatory canonical configuration and retained production secret/Redis failures.
- `server/src/__tests__/secureTrustedOriginComposition.test.js` deliberately proves the flag-zero trusted-origin no-op. Remove that fixture and retain/extend trusted-origin-first ordering assertions.
- Canonical service suites, including cookie policy, JWT provider, initial issuance, rotation, refresh eligibility, access authorization, session revocation, account-security mutation, User flows, Employer flows, password security, realm isolation, replay, concurrency, and outage behavior, are retained.
- `client/src/__tests__/secureAuthClientContract.test.js` is canonical and must be extended to inspect the Admin media upload path so a storage-backed Authorization header cannot escape future static checks.
- Secure-service test doubles that carry a refresh token internally are valid canonical fixtures when they prove that failure results do not expose credentials. They are not legacy response assertions.

Removal tests can falsely pass if they inspect only `axiosBase.js` and `employerService.js`; the Admin XHR path must be included. Backend verification must search controller, middleware, singleton composition, and Admin mutation sources in addition to running service-level tests.

## 9. Configuration and documentation inventory

`STRIDETO_SECURE_AUTH_ENABLED` is now a legacy-selection flag. Once the false branch is removed, application behavior must be canonical without a runtime downgrade switch. `validateEnv.js` must continue to fail production startup when `JWT_SECRET`, `REFRESH_SECRET`, secret separation, or shared `REDIS_URL` requirements are not met.

The obsolete flag and legacy lifetime guidance occur in `.env.example`, `.env.template`, `.env.production.example`, `docker/.env.production.example`, `docker/.env.staging.example`, `DEPLOYMENT.md`, `docs/SETUP_AND_RUN.md`, `docs/PRODUCTION_ENVIRONMENT_REPORT.md`, `docs/RC2_SECURITY_REPORT.md`, and `docs/STRIDETO_SEC_3F_INFRASTRUCTURE_AUTHORITY_RESOLUTION.md`. Current operator documentation must describe canonical access/refresh configuration and Git/deployment rollback without advertising a legacy runtime switch.

Historical security audits and checkpoint reports must remain immutable historical evidence even where they accurately describe the earlier legacy state. Several now-live canonical service/model headers still say “dormant” or “not imported”; those comments should be corrected without changing behavior.

The ignored `.env.staging` is not part of the cleanup boundary and must remain untouched. Production configuration changes are not authorized.

## 10. Classification matrix

|   # | Exact file / surface                                                                                                                                                                                                                                                                                    | Realm               | Current purpose and evidence                                                              | Classification               | Dependency / phase                                               |
| --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
|   1 | `server/src/utils/jwt.js`                                                                                                                                                                                                                                                                               | User, Employer      | Legacy same-secret access/refresh signer and verifier; only legacy branches call it       | REMOVE                       | After controller and middleware rewrites, SEC-3G-B               |
|   2 | `server/src/models/User.js` - `refreshToken`, `refreshTokenExpires`                                                                                                                                                                                                                                     | User/Admin          | Unwritten legacy single-token schema fields                                               | REMOVE                       | After legacy store callers, SEC-3G-B                             |
|   3 | `server/src/controllers/authController.js`                                                                                                                                                                                                                                                              | User/Admin          | Mixed canonical and legacy issuance/refresh/logout/password branches                      | REWRITE                      | Preserve route/error contracts, SEC-3G-B                         |
|   4 | `server/src/controllers/employerAuthController.js`                                                                                                                                                                                                                                                      | Employer            | Mixed canonical and legacy register/login/refresh/logout/password branches                | REWRITE                      | Preserve route/error contracts, SEC-3G-B                         |
|   5 | `server/src/controllers/admin/usersController.js`                                                                                                                                                                                                                                                       | Admin/User/Employer | Secure mutations plus direct-write fallbacks; legacy admin reset revocation               | REWRITE                      | Canonical mutation before family sweep, SEC-3G-B                 |
|   6 | `server/src/middleware/auth.js`                                                                                                                                                                                                                                                                         | All                 | Canonical authorization plus legacy verifier/denylist branches                            | REWRITE                      | Preserve downstream principal shapes, SEC-3G-B                   |
|   7 | `server/src/middleware/secureTrustedOrigin.js`                                                                                                                                                                                                                                                          | All                 | Canonical enforcement with flag-zero no-op                                                | REWRITE                      | Must remain before handlers, SEC-3G-B                            |
|   8 | `server/src/services/auth/secureAuthConfig.js`                                                                                                                                                                                                                                                          | All                 | Secure composition plus explicit legacy-mode selection                                    | REWRITE                      | First backend composition change, SEC-3G-B                       |
|   9 | `server/src/services/auth/userSecureAuthFlows.js`                                                                                                                                                                                                                                                       | User/Admin          | Canonical flow factory; conditional runtime singleton                                     | REWRITE                      | Unconditional singleton after config, SEC-3G-B                   |
|  10 | `server/src/services/auth/employerSecureAuthFlows.js`                                                                                                                                                                                                                                                   | Employer            | Canonical flow factory; conditional runtime singleton                                     | REWRITE                      | Unconditional singleton after config, SEC-3G-B                   |
|  11 | `server/src/services/auth/secureAccessAuthorization.js`                                                                                                                                                                                                                                                 | All                 | Canonical access factory; conditional runtime singleton                                   | REWRITE                      | Unconditional singleton after config, SEC-3G-B                   |
|  12 | `server/src/config/validateEnv.js`                                                                                                                                                                                                                                                                      | All                 | Production secure flag gate plus required secret/Redis gates                              | REWRITE                      | Remove flag gate, retain hard failures, SEC-3G-B                 |
|  13 | `server/src/utils/tokenStore.js`                                                                                                                                                                                                                                                                        | User, Employer      | Legacy refresh/denylist functions plus still-used reset-token hash                        | REWRITE                      | Retain `hashResetToken`, SEC-3G-B                                |
|  14 | `server/src/controllers/profileController.js`                                                                                                                                                                                                                                                           | User                | Defensive deletion of obsolete legacy fields                                              | REWRITE                      | Narrow cleanup after schema removal, SEC-3G-B                    |
|  15 | `server/src/controllers/admin/exportController.js`                                                                                                                                                                                                                                                      | Admin               | Projection excludes obsolete legacy field                                                 | REWRITE                      | Preserve all privacy exclusions, SEC-3G-B                        |
|  16 | `client/src/components/media/MediaLibraryParts.jsx`                                                                                                                                                                                                                                                     | Admin               | Active XHR upload reads `localStorage` authentication token                               | REWRITE                      | Use in-memory User token; preserve progress/cancel, SEC-3G-C     |
|  17 | `server/src/routes/auth.js`                                                                                                                                                                                                                                                                             | User/Admin          | Canonical routes and trusted-origin-first state-changing composition                      | RETAIN                       | Regression verification, SEC-3G-B/D                              |
|  18 | `server/src/routes/employer.js`                                                                                                                                                                                                                                                                         | Employer            | Canonical Employer routes and middleware ordering                                         | RETAIN                       | Regression verification, SEC-3G-B/D                              |
|  19 | `server/src/routes/admin.js`                                                                                                                                                                                                                                                                            | Admin               | User-realm authentication plus role/permission authorization                              | RETAIN                       | No duplicate auth route, SEC-3G-B/D                              |
|  20 | `server/src/models/RefreshSession.js`                                                                                                                                                                                                                                                                   | User, Employer      | Canonical refresh-family persistence                                                      | RETAIN                       | No migration or model redesign                                   |
|  21 | `server/src/services/auth/{JwtSessionProvider,initialSessionIssuance,RefreshEligibilityCoordinator,RefreshSessionRotationService,SessionSubjectStateProvider,SessionFamilyRevocationService,AccountSecurityMutationService,AccessAuthorizationCoordinator,accessDenylist}.js` and contract/hash modules | All                 | Canonical signing, rotation, replay, state, revocation, mutation, and denylist boundaries | RETAIN                       | Never replace with controller-local logic                        |
|  22 | `client/src/services/axiosBase.js`                                                                                                                                                                                                                                                                      | User/Admin          | In-memory access token and cookie-backed single-flight refresh                            | RETAIN                       | Supplies Admin upload token in SEC-3G-C                          |
|  23 | `client/src/services/employerService.js`                                                                                                                                                                                                                                                                | Employer            | Separate in-memory token and cookie-backed refresh                                        | RETAIN                       | Realm isolation regression                                       |
|  24 | `client/src/services/authService.js`                                                                                                                                                                                                                                                                    | User/Admin          | Canonical empty-body refresh and auth endpoints                                           | RETAIN                       | No compatibility payload                                         |
|  25 | `client/src/context/AuthContext.jsx`                                                                                                                                                                                                                                                                    | User/Admin          | Non-authoritative profile cache and secure bootstrap                                      | RETAIN                       | Storage remains profile-only                                     |
|  26 | `client/src/context/EmployerAuthContext.jsx`                                                                                                                                                                                                                                                            | Employer            | Non-authoritative profile cache and secure bootstrap                                      | RETAIN                       | Storage remains profile-only                                     |
|  27 | `client/src/auth/authRealm.js`                                                                                                                                                                                                                                                                          | User, Employer      | Realm-isolated bootstrap state                                                            | RETAIN                       | Cross-realm regression                                           |
|  28 | `client/src/pages/Auth/Login.jsx`                                                                                                                                                                                                                                                                       | User/Admin          | Shared User-realm login and role-directed UI                                              | RETAIN                       | No Admin token realm invented                                    |
|  29 | `client/src/services/adminContentApi.js`                                                                                                                                                                                                                                                                | Admin               | Canonical `axiosBase` protected API client                                                | RETAIN                       | Media XHR should match its authority source                      |
|  30 | `server/src/services/auth/AuthCookiePolicy.js`                                                                                                                                                                                                                                                          | User, Employer      | Canonical separate host-only HttpOnly cookie names and paths                              | RETAIN                       | Cookie invariants unchanged                                      |
|  31 | Canonical auth suites under `server/src/__tests__/` and `client/src/__tests__/secureAuthClientContract.test.js`                                                                                                                                                                                         | All                 | Secure-cookie, rotation, replay, invalidation, realm, outage, and memory-only contracts   | RETAIN                       | Extend; do not delete                                            |
|  32 | `docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md`, `docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md`, `docs/STRIDETO_SEC_3E_ATOMIC_AUTHENTICATION_CUTOVER_IMPLEMENTATION_REPORT.md`                                                                                | All                 | Historical decision and checkpoint evidence                                               | RETAIN                       | Do not rewrite history                                           |
|  33 | `server/src/__tests__/secureAuthConfig.test.js` flag-zero cases                                                                                                                                                                                                                                         | All                 | Assertions deliberately preserving legacy-mode config                                     | TEST-ONLY LEGACY FIXTURE     | Rewrite with config in SEC-3G-B                                  |
|  34 | `server/src/__tests__/secureTrustedOriginComposition.test.js` legacy no-op case                                                                                                                                                                                                                         | All                 | Assertion deliberately preserving origin bypass                                           | TEST-ONLY LEGACY FIXTURE     | Rewrite with middleware in SEC-3G-B                              |
|  35 | `.env.example`                                                                                                                                                                                                                                                                                          | All                 | Obsolete secure flag and legacy lifetime comments                                         | DOCUMENTATION/CONFIG CLEANUP | SEC-3G-D                                                         |
|  36 | `.env.template`                                                                                                                                                                                                                                                                                         | All                 | Obsolete secure flag and legacy lifetime comments                                         | DOCUMENTATION/CONFIG CLEANUP | SEC-3G-D                                                         |
|  37 | `.env.production.example`                                                                                                                                                                                                                                                                               | All                 | Obsolete flag and legacy lifetime variables                                               | DOCUMENTATION/CONFIG CLEANUP | Example only, SEC-3G-D                                           |
|  38 | `docker/.env.production.example`                                                                                                                                                                                                                                                                        | All                 | Obsolete flag/comment                                                                     | DOCUMENTATION/CONFIG CLEANUP | Example only, SEC-3G-D                                           |
|  39 | `docker/.env.staging.example`                                                                                                                                                                                                                                                                           | All                 | Obsolete flag                                                                             | DOCUMENTATION/CONFIG CLEANUP | Example only, SEC-3G-D                                           |
|  40 | `DEPLOYMENT.md`                                                                                                                                                                                                                                                                                         | All                 | Legacy JWT/refresh lifetime operator guidance                                             | DOCUMENTATION/CONFIG CLEANUP | SEC-3G-D                                                         |
|  41 | `docs/SETUP_AND_RUN.md`                                                                                                                                                                                                                                                                                 | All                 | Legacy lifetime setup guidance                                                            | DOCUMENTATION/CONFIG CLEANUP | SEC-3G-D                                                         |
|  42 | `docs/PRODUCTION_ENVIRONMENT_REPORT.md`                                                                                                                                                                                                                                                                 | All                 | Legacy lifetime environment description                                                   | DOCUMENTATION/CONFIG CLEANUP | SEC-3G-D                                                         |
|  43 | `docs/RC2_SECURITY_REPORT.md`                                                                                                                                                                                                                                                                           | All                 | Legacy token-lifetime statement                                                           | DOCUMENTATION/CONFIG CLEANUP | SEC-3G-D                                                         |
|  44 | `docs/STRIDETO_SEC_3F_INFRASTRUCTURE_AUTHORITY_RESOLUTION.md`                                                                                                                                                                                                                                           | All                 | Current operator prerequisite still names the transitional flag                           | DOCUMENTATION/CONFIG CLEANUP | Preserve history elsewhere; update current authority in SEC-3G-D |
|  45 | Stale “dormant/not imported/legacy helper” headers in canonical auth services and `RefreshSession.js`                                                                                                                                                                                                   | All                 | Proven-live modules retain pre-cutover provenance comments                                | DOCUMENTATION/CONFIG CLEANUP | Comment-only correction in SEC-3G-D                              |

The table contains exactly 2 REMOVE, 14 REWRITE, 16 RETAIN, 2 TEST-ONLY LEGACY FIXTURE, 11 DOCUMENTATION/CONFIG CLEANUP, and 0 REVIEW REQUIRED rows.

## 11. Dependency and removal order

1. Make secure configuration and the three runtime singletons canonical and unconditional.
2. Rewrite User, Employer, Admin mutation, authorization, and trusted-origin boundaries while retaining public route and safe-error contracts.
3. Remove all calls to legacy JWT, refresh-slot, and old denylist functions. Keep `hashResetToken` available to auth, email verification, and Admin invitation callers.
4. Delete `utils/jwt.js`, narrow `tokenStore.js`, remove the two User schema fields, and remove only their obsolete projection/sanitizer references.
5. Run backend security and realm regression before changing the client.
6. Replace the Admin upload's storage lookup with the existing in-memory User/Admin access-token source and extend the client contract test.
7. Clean examples, current operator documentation, and stale source headers, then run the complete regression and local browser smoke.

Backend-first is safe because the normal User and Employer clients already use the canonical cookie contract. The Admin upload correction must follow promptly because its current storage token source is incompatible with memory-only authentication. No route rename or response compatibility shim is required.

## 12. Security invariants

Every implementation phase must preserve:

1. HttpOnly, Secure, SameSite=Lax, host-only refresh cookies.
2. Separate User and Employer cookie names and paths.
3. No refresh token in JSON, request/response headers, query strings, or browser storage.
4. Client access tokens in memory only.
5. Trusted-origin-first middleware on state-changing auth routes.
6. Atomic refresh rotation with one concurrent winner.
7. Previous-token replay revoking the whole family.
8. Cross-instance logout and shared Redis access denylisting.
9. tokenVersion and account-authority invalidation.
10. Password change/reset global session invalidation.
11. Suspension and role-change invalidation.
12. Redis and MongoDB fail-closed behavior.
13. User, Employer, and User-realm Admin/SuperAdmin isolation.
14. Mandatory canonical secure-auth configuration, separate secrets, and production Redis.
15. Existing authorization, permission, privacy, rate-limit, audit, and safe-error contracts.
16. Production activation remains blocked until separately authorized gates pass.

SEC-3G must not add a browser credential store, refresh-token payload compatibility, a legacy header, controller-local token rotation, a process-local production fallback, or a third Admin token realm.

## 13. Risks and stop conditions

### High-risk but resolved findings

- Mixed controller/middleware files are actively reachable, but every secure branch already has a tested replacement. Remove branches, not route contracts.
- `adminResetPassword` uses obsolete session invalidation even in secure mode. The existing atomic account-security mutation plus all-family revocation provides the bounded replacement.
- `tokenStore.js` cannot be deleted wholesale because `hashResetToken` remains used by password reset, email verification, and invitations.
- The Admin XHR upload bypasses the canonical Axios client and reads a browser-stored token. The exported in-memory User token source is the correct realm authority; progress/cancel behavior must remain.
- Static client tests currently inspect only the main User and Employer clients and could falsely pass while Admin upload remains legacy.
- Deleting the transitional flag removes soft runtime rollback. Rollback must use Git history and deployment rollback, consistent with the accepted authority.
- Legacy external clients that submit refresh tokens in JSON or headers will no longer work. SEC-3F proves the local client is canonical and production activation is blocked, so a compatibility window would preserve the vulnerability surface without an authorized consumer.

### Mandatory implementation stop conditions

Stop the implementation phase if any of the following appears:

- an active legacy helper caller without a secure replacement;
- an ambiguous refresh-token transport or a route that requires JSON/header compatibility;
- a cross-realm dependency that would share User and Employer cookies or principals;
- a production-only secret, datastore, or operator action is required to verify local source correctness;
- removal requires a data migration, index operation, or deletion of stored production fields;
- Admin reset cannot atomically advance account authority before reporting success;
- any route ordering would place origin validation after credential processing;
- any retained canonical replay, concurrency, outage, or invalidation regression fails;
- any file outside the phase's exact boundary is required.

No such stop condition was found during this inventory.

## 14. Proposed SEC-3G implementation phases

### SEC-3G-B - Backend legacy authentication removal

Make secure composition unconditional; remove legacy User/Employer issuance, refresh transport, verification, denylist, logout, and direct account-mutation fallbacks; correct Admin reset invalidation; remove obsolete User schema fields and helper callers; delete `utils/jwt.js`; retain only `hashResetToken` in `tokenStore.js`; rewrite the two legacy fixture suites and extend canonical backend coverage.

### SEC-3G-C - Client legacy authentication removal

Replace the Admin media XHR browser-storage token lookup with the canonical in-memory User/Admin access-token source. Preserve upload progress, cancellation, duplicate handling, errors, and all UI behavior. Extend the client static contract across the Admin upload path.

### SEC-3G-D - Documentation/config cleanup and complete regression

Remove the transitional flag and legacy lifetime guidance from examples and current operator docs; update stale “dormant” source headers without changing behavior; execute complete server/client lint, formatting, tests, build, security greps, realm checks, and isolated local browser authentication smoke. Do not deploy.

No additional implementation phase, compatibility phase, or migration phase is required.

## 15. Expected file boundaries per phase

### SEC-3G-B exact files

- `server/src/config/validateEnv.js`
- `server/src/models/User.js`
- `server/src/controllers/authController.js`
- `server/src/controllers/employerAuthController.js`
- `server/src/controllers/admin/usersController.js`
- `server/src/controllers/admin/exportController.js`
- `server/src/controllers/profileController.js`
- `server/src/middleware/auth.js`
- `server/src/middleware/secureTrustedOrigin.js`
- `server/src/services/auth/secureAuthConfig.js`
- `server/src/services/auth/userSecureAuthFlows.js`
- `server/src/services/auth/employerSecureAuthFlows.js`
- `server/src/services/auth/secureAccessAuthorization.js`
- `server/src/utils/jwt.js` (delete)
- `server/src/utils/tokenStore.js`
- `server/src/__tests__/auth.test.js`
- `server/src/__tests__/secureAuthConfig.test.js`
- `server/src/__tests__/secureTrustedOriginComposition.test.js`
- `server/src/__tests__/accountSecurityMutation.test.js`
- `server/src/__tests__/userSecureAuthFlows.test.js`
- `server/src/__tests__/employerSecureAuthFlows.test.js`
- `server/src/__tests__/employerPasswordSecurityFlows.test.js`
- `server/src/__tests__/secureAccessAuthorization.test.js`

### SEC-3G-C exact files

- `client/src/components/media/MediaLibraryParts.jsx`
- `client/src/__tests__/secureAuthClientContract.test.js`

### SEC-3G-D exact cleanup files

- `.env.example`
- `.env.template`
- `.env.production.example`
- `docker/.env.production.example`
- `docker/.env.staging.example`
- `DEPLOYMENT.md`
- `docs/SETUP_AND_RUN.md`
- `docs/PRODUCTION_ENVIRONMENT_REPORT.md`
- `docs/RC2_SECURITY_REPORT.md`
- `docs/STRIDETO_SEC_3F_INFRASTRUCTURE_AUTHORITY_RESOLUTION.md`
- `server/src/models/RefreshSession.js`
- `server/src/services/auth/AccessAuthorizationCoordinator.js`
- `server/src/services/auth/AccessAuthorizationContracts.js`
- `server/src/services/auth/AuthCookiePolicy.js`
- `server/src/services/auth/accessDenylist.js`
- `server/src/services/auth/AccountSecurityMutationService.js`
- `server/src/services/auth/AccountSecurityMutationContracts.js`
- `server/src/services/auth/AuthSessionPrimitiveContracts.js`
- `server/src/services/auth/JwtSessionProvider.js`
- `server/src/services/auth/RefreshEligibilityContracts.js`
- `server/src/services/auth/RefreshEligibilityCoordinator.js`
- `server/src/services/auth/RefreshSessionContracts.js`
- `server/src/services/auth/RefreshSessionRotationService.js`
- `server/src/services/auth/refreshTokenHash.js`
- `server/src/services/auth/SessionFamilyRevocationContracts.js`
- `server/src/services/auth/SessionFamilyRevocationService.js`
- `server/src/services/auth/SessionSubjectStateProvider.js`
- `server/src/services/auth/TrustedRequestOriginPolicy.js`

Files already rewritten in SEC-3G-B must have their stale legacy/dormant comments corrected in that phase, not reopened solely for comment cleanup in SEC-3G-D. All proposed paths above exist at this audit authority.

## 16. Required verification per phase

### SEC-3G-B

- Run focused secure configuration, origin composition, cookie, User/Employer flow, access authorization, account mutation, password security, realm isolation, refresh rotation/replay, concurrency, and Redis/Mongo fail-closed suites.
- Run all server tests and server lint/format checks.
- Prove no runtime import of `utils/jwt.js` remains before deleting it.
- Prove `tokenStore.js` exports only the required non-session hash function and all its callers remain valid.
- Prove no controller reads `req.body.refreshToken`, `x-refresh-token`, or returns a refresh token in JSON.
- Prove every auth runtime singleton is non-null without a legacy selector.
- Prove Admin reset, role, suspension, password change/reset, and logout-all invalidate tokenVersion/families as required.
- Prove no route, error, permission, audit, email-outbox, or response privacy contract regresses.

### SEC-3G-C

- Run the extended client secure-auth contract test, client tests, lint, format check, and no-write production build.
- Search the entire client for browser-stored authentication credentials and manually constructed Authorization headers.
- Prove Admin upload obtains only the current User-realm in-memory access token and retains progress/cancel behavior.
- Prove User and Employer refresh requests remain empty-body, cookie-backed, and realm-isolated.

### SEC-3G-D

- Search application, tests, examples, and current operator docs for the removed flag, old helper imports, refresh-token body/header compatibility, response JSON refresh tokens, and authentication credential storage.
- Run all server and client tests, lint, formatting, and client no-write production build.
- Re-run the isolated local browser User, Employer, and Admin authentication acceptance, concurrent refresh/replay, cross-instance logout, restart, datastore outage/recovery, and account-state invalidation checks.
- Run `git diff --check`, sensitive-value pattern scans without printing values, and exact file-boundary verification.
- Confirm preserved reports and `.env.staging` remain untouched and production remains unchanged.

## 17. Production and rollback constraints

- Production activation, deployment, DNS, Render, MongoDB, Redis, secrets, and environment mutation are outside SEC-3G.
- Production must continue to require strong distinct `JWT_SECRET` and `REFRESH_SECRET` values and shared Redis. Removing the selector does not make those dependencies optional.
- No database migration, index operation, production data migration, or compatibility window is required for the bounded local removal. Removing the two Mongoose schema declarations does not delete historical fields from stored documents; strict current code will ignore them. Any later physical production-data sanitation is a separate optional operator decision, not an SEC-3G prerequisite.
- Deployment-time environment cleanup and production gate verification require operator authority in a later authorized phase.
- With the legacy selector removed, rollback is by reverting to a previously accepted Git commit and following deployment rollback procedures. A flag-zero in-place downgrade is intentionally unavailable.
- Historical audit/checkpoint documents remain unchanged as evidence of the earlier architecture.

## 18. Final recommendation

Begin **SEC-3G-B - Backend Legacy Authentication Removal** using only its exact file boundary. Preserve canonical routes, secure cookies, origin ordering, atomic rotation, session-family replay response, shared Redis denylisting, tokenVersion authority, realm isolation, and safe error/privacy contracts. Stop if implementation discovers an unlisted active caller, a required compatibility transport, or any migration requirement.

Database migration required: **No**.

Compatibility window required: **No**.

Additional phase required: **No**.

Production activation authorized: **No**.
