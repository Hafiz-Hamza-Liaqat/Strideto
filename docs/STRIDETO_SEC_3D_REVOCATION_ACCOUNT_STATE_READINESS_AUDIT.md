# STRIDETO-SEC-3D-A — Revocation and Authoritative Account-State Readiness Audit

**SEC-3D-A.1 correction applied.** The original SEC-3D-A pass (below,
corrected in place) contained six unresolved contradictions: it treated
the legacy access-token denylist as if it already satisfied the target
architecture without proving every required property; it left the
current-session-logout/access-token-invalidation question resolved by
appeal to that same unverified mechanism; it proposed editing existing
live handlers and described that as "inert," blurring the dormant/live
phase boundary; it treated `tokenVersion` mutation and the related
subject-field mutation (password hash, `accountStatus`, `role`) as
independent operations on the same document; it did not define
retry/idempotency behavior precisely enough to rule out a stale retry
reversing an intervening legitimate change; and it did not close the
refresh-eligibility race between an authoritative invalidation event and
an in-flight rotation. §3, §4, §5.4 (renumbered from the original's
scattered treatment), §7, §8, §10, §11.1 (new), §12, §18, and §19 are
rewritten below to close each of these. §1, §5 (event matrix), §6, §13,
§15, §16, §17 are preserved from the original pass — they were not found
to contain a contradiction — with only the specific corrections noted in
line.

**SEC-3D-A.2 correction applied on top of the above.** The SEC-3D-A.1
pass, while correcting the six contradictions above, itself introduced or
left unresolved four further defects: (1) it claimed Mongoose's default
`__v` version key already provided full optimistic concurrency for
`.save()`-based mutations without confirming `optimisticConcurrency: true`
is actually enabled anywhere (it is not); (2) its event-idempotency
treatment was incomplete — it incorrectly concluded `logout-all` and any
future admin-revoke capability were safe to leave as unconditioned `$inc`
operations; (3) §11.2 claimed the post-rotation reread makes it
impossible for a stale successor credential to ever be returned, which is
not achievable by any finite number of rereads and overstates what a
non-transactional design can guarantee; (4) it left the denylist-hardening
requirement as a one-paragraph conclusion rather than a complete
production gate. §8.2 (password change/reset), §8.5 (retry/idempotency,
now with a complete event matrix), §11.2/§11.3 (refresh-race guarantee,
corrected to its achievable form), §12 (access authorization, now
including the full denylist production-hardening contract), §14
(taxonomy), §18 (slices), and §19 (verdicts) are further corrected below.
Nothing in §1–§7, §9, §10, §13, §15, §16, §17, or §20 was found to require
a further change beyond what SEC-3D-A.1 already established, and those
sections are carried forward as they stood at the end of that pass.

## 1. Repository baseline

Preflight before this audit: HEAD `707cd0676d54f154e5211830d9da5d632457c949`
(`feat: add dormant cookie origin and session state primitives`), branch
`main...origin/main [ahead 25]`, no tracked modification, no staged file,
untracked files exactly `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
and `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`.

**One deviation found and corrected before the original SEC-3D-A pass
began**: an uncommitted one-character stray edit existed in
`docs/STRIDETO_ADMIN_JOB_DUPLICATION_REGRESSION_CORRECTION_REPORT.md`
("consistent" → "consiste nt"), evidently accidental editor input unrelated
to any authorized phase. Flagged to the operator, who directed a revert;
`git checkout -- docs/STRIDETO_ADMIN_JOB_DUPLICATION_REGRESSION_CORRECTION_REPORT.md`
restored the file to its committed state. Preflight was re-run clean
before any further work, and matched the expected state exactly at the
start of this correction pass too (re-verified below, §15/§16).

Accepted checkpoints: SEC-3A `e19ad912754d1fde44ad0234f85be38e2c252d9f`,
SEC-3B `1fa16c3c58ec6a54bb954a3957ddfcdb46dac03a`, SEC-3C
`707cd0676d54f154e5211830d9da5d632457c949`.

## 2. Architecture authority

Read completely from
`docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md`
(current working-tree copy re-confirmed byte-identical to the checkpointed
SEC-3A commit — no drift). The requirements below are extracted with
section citations; anything not explicitly stated is marked as an
ambiguity rather than inferred.

### 2.1 Extracted requirements

- **Realms, claims, signing** (§18A, §19A): `sid` = `RefreshSession._id`,
  constant per family; `jti` fresh per token; access claims `sub, realm,
sid, jti, tokenVersion, iss, aud, exp`; refresh claims add `type:
'refresh'`. Before rotation: `RefreshSession.subjectType === realm` and
  `RefreshSession.subjectId === sub`, checked independently of and prior to
  CAS/replay logic.
- **RefreshSession model** (§21): one document per family (not per
  rotation). Revoking a family is a single-document update — never
  requires a transaction. "Logout all sessions" and
  suspension/password-change-driven mass revocation are explicitly named
  as **best-effort, eventually-consistent** `updateMany` operations, not
  transactional. The **authoritative, immediate revocation signal for
  access tokens is `tokenVersion`** (§24), not the bulk `RefreshSession`
  update — bulk update is defense-in-depth cleanup, not the primary
  enforcement path.
- **Rotation/replay** (§22): 9-step CAS contract. Step 5 (subject/session
  binding) requires, independently of the best-effort bulk cleanup: subject
  loaded fresh from MongoDB; `accountStatus` active; refresh token's
  `tokenVersion` claim equals subject's current `tokenVersion`;
  `RefreshSession.tokenVersionAtIssue` also equals current `tokenVersion`.
  Any mismatch fails closed, issues nothing, and **positively-identified**
  account-state mismatches (not-found/suspended/deleted) additionally
  revoke the session so repeated presentation doesn't repeatedly re-reach
  the check. `RefreshSessionRotationService.rotate()`'s CAS `$set` (SEC-3B,
  confirmed by direct re-inspection this pass) never advances
  `tokenVersionAtIssue` on an ordinary rotation — this is correct,
  intentional behavior, not a defect: under normal operation `tokenVersion`
  never changes, so the field never needs to move; it becomes stale **by
  design** the instant any invalidation event bumps `tokenVersion`, which
  is exactly the mechanism step 5 relies on.
- **Access-token invalidation** (§24): **Option A baseline, mandatory** —
  direct `User.findById(subjectId, { tokenVersion: 1, accountStatus: 1 })`
  (or `Employer` equivalent) on every authenticated request, no cache in
  the initial implementation, "**No process-local (in-memory) fallback,
  ever, in either option**." Reject 401 if subject not found,
  `accountStatus` suspended/deleted, or `tokenVersion` claim mismatch.
- **Single unified revocation primitive** (§24): "every
  account-state-changing admin action (suspend, delete, role change,
  password change, email change) bumps `tokenVersion` as part of the same
  operation." Normal (current-session) logout is **not** in this list.
- **Logout/invalidation contract, exact table** (§29):

  | Event                     | RefreshSession change                                        | Access-token implication                                                                             |
  | ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
  | Normal logout             | Revoke this one document (`revokeReason:'logout'`)           | "Denylist the presenting access token (existing mechanism)"                                          |
  | Logout-all                | Best-effort `updateMany`, not transactional                  | `tokenVersion` bump is the authoritative, immediate signal; refresh-side cleanup is defense-in-depth |
  | Password change           | Bump `tokenVersion`; best-effort revoke all sessions         | Immediate via `tokenVersion`                                                                         |
  | Password reset            | Bump `tokenVersion`; best-effort revoke all sessions         | Same                                                                                                 |
  | Email change              | Bump `tokenVersion`; best-effort revoke all sessions         | Same                                                                                                 |
  | Account suspension        | Bump `tokenVersion`; best-effort revoke all sessions         | Access closes on next request; refresh closes once its session is revoked                            |
  | Account deletion          | Bump `tokenVersion`; revoke all sessions; TTL-expire records | Same                                                                                                 |
  | Role change               | Bump `tokenVersion` **only**                                 | Closes "role change has zero effect"                                                                 |
  | Refresh replay            | Revoke this one document                                     | —                                                                                                    |
  | Refresh conflict (benign) | No revocation                                                | —                                                                                                    |

- **`REQUIRE_REDIS`/Redis-mandatory gate** (§30, §35): Redis is "strongly
  recommended... not strictly required for correctness" for production
  scale during SEC-3D/3E, and becomes **mandatory, hard-fail** only at the
  **final 10/10 acceptance gate** (§35): "Redis made mandatory (hard-fail,
  not merely warned) once tokenVersion-cache/rate-limiting depends on
  shared state across a genuinely multi-instance deployment." This gate is
  scoped in the architecture text to §24's Option B cache layer and to
  rate limiting — it does not explicitly name the pre-existing denylist —
  but is the only place in the whole document where "Redis becomes
  mandatory" is stated as a requirement at all, and is load-bearing for
  §3 below.
- **Phase definition for SEC-3D itself, exact text** (§33): "Ensure every
  active suspend/delete/password-change/password-reset/role-change/
  email-change path bumps `tokenVersion` correctly (§29); logout-current
  and logout-all services (§18A, §19 — bearer-authenticated, sid-based);
  best-effort `RefreshSession` cleanup (§21)." **Allowed files: admin
  suspend/role-change/delete handlers, password/email-change controllers,
  new logout-current/logout-all services, related tests.** API contract
  changes: none. Stop condition: "any attempt to wire a live route to the
  new cookie contract in this phase (that is SEC-3E's job, not this
  one's)."

  **This SEC-3D-A.1 correction pass revises how that "Allowed files" line
  is applied**, per explicit operator direction: editing an existing,
  currently-live handler function is live-behavior modification, not a
  dormant addition, regardless of whether the edit is inert today (nothing
  yet reads `tokenVersion`). §33's literal text does list existing
  handlers as allowed files for SEC-3D; this audit does not have authority
  to rewrite §33 itself (out of this report's authorized scope — only this
  file may be modified this pass), so this is stated explicitly as a
  **known divergence between §33's literal text and this audit's
  corrected recommendation**, not silently resolved: **this audit
  recommends the wiring of `tokenVersion` bumps into existing
  suspend/delete/role-change/password handlers be treated as SEC-3E-scope
  live integration, not SEC-3D-scope dormant work** — see §5.4/§18 below
  for the full reasoning and the corrected slice boundaries.

### 2.2 Ambiguities marked explicitly (not inferred)

- **A1 — §24 vs. §29's "denylist the presenting access token" row —
  corrected resolution, see §3.** The original SEC-3D-A pass resolved
  this by asserting the two mechanisms simply "coexist" without verifying
  every property required of the denylist to trust it as part of the
  final target architecture. §3 below re-derives this from first
  principles against the actual `tokenStore.js`/`config/redis.js`
  implementation and reaches a materially different, more conditional
  conclusion.
- **A2 — §21's revoke-reason list is illustrative, not exhaustive.**
  Unchanged from the original pass: the schema-comment table in §21 lists
  6 reasons; §22 step 5's prose separately introduces `'account_deleted'`
  (not in §21's list); SEC-3B's actually-implemented
  `REFRESH_SESSION_REVOKE_REASONS` enum already has 9, matching §29's full
  event table exactly. The 9-value implemented enum is authoritative;
  §21's 6-value comment is incomplete prose, not a narrower contract.
- **A3 — Maximum safe-integer bound on `tokenVersion`.** Not addressed by
  the architecture at all; addressed by this audit (§8) as a required
  pre-implementation addition.
- **A4 — Idempotency/operation-identity for `tokenVersion` bumps —
  corrected resolution, see §8.** The original pass concluded a stale
  retry double-increment was "purely availability-neutral." This pass
  found a concrete counter-example (§8) and corrects the design
  accordingly.
- **A5 — "Permission change" (`UserRoleAssignment`/`PermissionService`)
  vs. "role change" (`User.role`).** Unchanged from the original pass,
  re-confirmed by direct re-inspection of `middleware/rbac.js`: the
  primary `requirePermission` gate on every admin route reads only the
  static, JWT-claim-cached `req.user.role`, never `PermissionService`'s
  DB-fresh `UserRoleAssignment` lookup — the two mechanisms remain
  architecturally distinct, and `UserRoleAssignment` changes do not need
  `tokenVersion` treatment because the code paths that actually consult it
  are already DB-fresh per call.

### 2.3 Accepted dormant foundations — contract inventory (preserved from the original pass)

All read completely; contracts below are confirmed by direct inspection,
not assumed from prior reports. No contradiction was found in this
inventory during the SEC-3D-A.1 correction pass, so it is carried forward
unchanged.

| Contract                             | Location                                               | Status                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User.tokenVersion`                  | `models/User.js`                                       | `Number, default 0, min 0, required, Number.isInteger` — **no upper bound** (A3, closed in §8.1)                                                                 |
| `Employer.tokenVersion`              | `models/Employer.js`                                   | Identical shape                                                                                                                                                  |
| `RefreshSession.tokenVersionAtIssue` | `models/RefreshSession.js`                             | `Number, required, min 0, Number.isInteger`                                                                                                                      |
| `RefreshSession._id` / future `sid`  | `models/RefreshSession.js`                             | ObjectId, stable per family                                                                                                                                      |
| `subjectType` / `subjectId`          | `models/RefreshSession.js`                             | Immutable once set, enum-checked                                                                                                                                 |
| `revokedAt` / `revokeReason`         | `models/RefreshSession.js`                             | Paired by a `pre('validate')` hook — one implies the other                                                                                                       |
| `revokeReason` enum                  | `RefreshSessionContracts.js`                           | 9 values, exact §29 match (A2)                                                                                                                                   |
| Active-subject index                 | `models/RefreshSession.js`                             | `{subjectType:1, subjectId:1, revokedAt:1}`, named, schema-level only (`autoIndex:false`)                                                                        |
| Token-hash uniqueness                | `models/RefreshSession.js`                             | `{currentTokenHash:1}` unique, schema-level only                                                                                                                 |
| Rotation CAS                         | `RefreshSessionRotationService.js`                     | `createSession`/`rotate` only — **no revoke-single/revoke-all function exists yet**                                                                              |
| Replay-family revocation             | `RefreshSessionRotationService.js`                     | Implemented inside `rotate`'s miss-classification path only, guarded CAS, not independently callable                                                             |
| Subject-state projection             | `SessionSubjectStateProvider.js`                       | Exactly `{tokenVersion:1, accountStatus:1}`, one read, fail-closed, matches §24 exactly                                                                          |
| Active/inactive mapping              | `SessionSubjectStateProvider.js`                       | `suspended`→`SUBJECT_INACTIVE`; anything else non-`active`→`SUBJECT_STATE_INVALID`                                                                               |
| Safe result-code convention          | All SEC-3B/3C modules                                  | Frozen `{code}` objects, no raw token/hash/id ever included                                                                                                      |
| Dormancy                             | All SEC-3B/3C modules                                  | Re-confirmed by grep — zero live imports                                                                                                                         |
| Cookie/Origin primitives             | `AuthCookiePolicy.js`, `TrustedRequestOriginPolicy.js` | Complete, dormant, out of SEC-3D's scope directly                                                                                                                |
| JWT issue/verify                     | `JwtSessionProvider.js`                                | `sid`/`jti` separated; `tokenVersion` embedded and validated as non-negative integer on both issuance and verification; separate access/refresh secrets enforced |
| Refresh-token hashing                | `refreshTokenHash.js`                                  | SHA-256, deterministic, untrimmed                                                                                                                                |

**Satisfied vs. missing for SEC-3D specifically**: satisfied — the data
model, the subject-state read path, the JWT claim contract, the
cookie/Origin primitives. Missing — exactly what §9–§12 and §18's slices
build: single-family revocation, all-family revocation, the atomic
bounded `tokenVersion`/subject-mutation primitives (§8), a refresh-
eligibility coordinator implementing §22 step 5 plus the corrected
post-rotation revalidation (§11), and an access-authorization coordinator
(§12) — none of these compose the already-built SEC-3B/3C primitives into
one place yet.

### 2.4 Complete live call graph — user and employer realms (preserved from the original pass)

All routes/controllers/middleware read completely; re-confirmed
unmodified during this correction pass. No file in this section was
modified by either audit pass.

#### 2.4.1 User realm

| Action                                   | Route                                                | Controller                                 | Live tokenVersion effect today                                  | Live session/access-token effect today                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login                                    | `POST /api/auth/login`                               | `authController.login`                     | Not read, not written                                           | Issues access+refresh JSON (`utils/jwt.js`), stores refresh hash in `tokenStore.js` (Redis/Map, single slot)                                                                                                 |
| Refresh                                  | `POST /api/auth/refresh-token`                       | `authController.refreshToken`              | Not read                                                        | Validates against the single-slot store only; **no `accountStatus` check**                                                                                                                                   |
| Logout                                   | `POST /api/auth/logout`                              | `authController.logout`                    | Not touched                                                     | `revokeRefreshToken` (clears the single Redis/Map slot) **and** `revokeAccessToken` (denylists the presenting token's hash, TTL 1h) — confirmed live at `authController.js:195-216`                          |
| Password change (self, authenticated)    | `POST /api/auth/change-password`                     | `authController.changePassword`            | **Not bumped — field doesn't exist yet in any write path**      | `revokeRefreshToken` + `revokeAccessToken` for the presenting token only                                                                                                                                     |
| Password reset (unauthenticated)         | `POST /api/auth/reset-password`                      | `authController.resetPassword`             | **Not bumped**                                                  | `revokeRefreshToken` only — **no access-token denylist possible** (no bearer token available to hash on this unauthenticated path) — confirmed gap, `authController.js:310-335`                              |
| Forgot-password request                  | `POST /api/auth/forgot-password`                     | `authController.forgotPassword`            | N/A                                                             | —                                                                                                                                                                                                            |
| Account suspension/reactivation          | `PATCH /api/admin/users/:id` (`accountStatus` field) | `admin/usersController.updateUser`         | **Not bumped — confirmed live gap, `usersController.js:70-78`** | **No revocation call of any kind** — matches F-C3 exactly, live evidence                                                                                                                                     |
| Account deletion                         | `DELETE /api/admin/users/:id`                        | `admin/usersController.deleteUser`         | N/A (document removed)                                          | **No revocation call** — hard `findByIdAndDelete`, `usersController.js:99-125`; see §8.4 for why this needs no separate tokenVersion step                                                                    |
| Role change (single)                     | `PATCH /api/admin/users/:id/role`                    | `admin/usersController.assignRole`         | **Not bumped**, `usersController.js:346-378`                    | None                                                                                                                                                                                                         |
| Role change (bulk)                       | `POST /api/admin/users/bulk-role`                    | `admin/usersController.bulkAssignRole`     | **Not bumped**, `usersController.js:177-208`                    | None                                                                                                                                                                                                         |
| Admin reset-password                     | `POST /api/admin/users/:id/reset-password`           | `admin/usersController.adminResetPassword` | **Not bumped**                                                  | `revokeRefreshToken` only (comment `// RC-1: invalidate existing sessions after admin password reset`, `usersController.js:127-175`) — **cannot** denylist the specific access token (admin doesn't hold it) |
| Permission change (`UserRoleAssignment`) | `assignAdditionalRoles()`                            | `PermissionService.js:91-97`               | N/A — different mechanism entirely (A5)                         | N/A                                                                                                                                                                                                          |
| Email change                             | **Does not exist as a live feature**                 | —                                          | —                                                               | —                                                                                                                                                                                                            |

#### 2.4.2 Employer realm

| Action                           | Route                                                                     | Controller                                                   | Live tokenVersion effect today                           | Live session/access-token effect today                                                                         |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Login                            | `POST /api/auth/employer/login`                                           | `employerAuthController.employerLogin`                       | Not read                                                 | **No `accountStatus` check at all** — confirmed live, `employerAuthController.js:54-66` (matches F-H3 exactly) |
| Refresh                          | `POST /api/auth/employer/refresh-token`                                   | `employerAuthController.employerRefreshToken`                | Not read                                                 | No `accountStatus` check either                                                                                |
| Logout                           | `POST /api/auth/employer/logout`                                          | `employerAuthController.employerLogout`                      | Not touched                                              | Same pattern as user logout                                                                                    |
| Password change                  | **Does not exist as a live feature**                                      | —                                                            | —                                                        | —                                                                                                              |
| Password reset                   | **Does not exist as a live feature**                                      | —                                                            | —                                                        | —                                                                                                              |
| Suspension/reactivation (single) | `PATCH /api/admin/employers/:id` (`accountStatus` field)                  | `admin/usersController.updateEmployer`                       | **Not bumped**, `usersController.js:272-304`             | No revocation call                                                                                             |
| Suspension (bulk)                | `POST /api/admin/employers/bulk-suspend`                                  | `admin/usersController.bulkSuspendEmployers`                 | **Not bumped**, `usersController.js:331-344`             | `updateMany` only                                                                                              |
| Deletion                         | **No admin employer-delete endpoint exists**                              | —                                                            | —                                                        | —                                                                                                              |
| Verification level change        | `PATCH /api/admin/employers/:id`, `POST /api/admin/employers/bulk-verify` | `admin/usersController.updateEmployer`/`bulkVerifyEmployers` | N/A — not an authentication/authorization-relevant field | —                                                                                                              |

#### 2.4.3 Supporting mechanisms confirmed live

- **`server/src/utils/tokenStore.js`**: re-audited in full in §3 below.
- **`server/src/middleware/auth.js`**: `requireAuth` checks
  `isAccessTokenRevoked` (the denylist) then `verifyToken` (signature +
  expiry only, shared secret, no issuer/audience/algorithm allowlist —
  F-H1). It does **not** read `accountStatus` or any `tokenVersion` from
  MongoDB on any request today. `role` is trusted from the JWT claim for
  the token's full remaining lifetime — live evidence for F-M2.
- **`server/src/services/workflow/PermissionService.js`** /
  `UserRoleAssignment` model: a separate, pre-existing additional-roles
  mechanism, DB-fresh per call wherever it is actually consulted, but
  never consulted by the primary `requirePermission` gate — see A5.

## 3. Re-audit of the existing access-token denylist

Re-inspected completely this pass:
`server/src/utils/tokenStore.js`, `server/src/config/redis.js`,
`server/src/middleware/auth.js`, `server/src/controllers/authController.js`,
`server/src/controllers/employerAuthController.js`, `server/src/index.js`
(startup wiring), and the accepted SEC-3A architecture text (§24, §29,
§30, §35, §37).

**Storage model — confirmed, not assumed:**

- `revokeAccessToken(token)`/`isAccessTokenRevoked(token)`
  (`tokenStore.js:34-44`) write/read through `cacheSet`/`cacheGet`
  (`config/redis.js`).
- `config/redis.js` (`getRedisClient`, lines 9-27): if `process.env.REDIS_URL`
  is unset, returns `null` **immediately, without error** — no exception is
  thrown, no distinguishable failure state is surfaced to the caller. If
  `REDIS_URL` is set but the `ioredis` import or client construction
  itself throws, the `catch` block logs a `console.warn` and **also**
  returns `null` — again no error propagates.
- `cacheGet`/`cacheSet`/`cacheDel` (lines 29-53): whenever `getRedisClient()`
  resolves to `null`, every one of these functions **silently falls back**
  to a **module-level, process-local `Map`** (`inMemory`, declared at file
  scope, line 6) with equivalent read/write/expiry semantics reimplemented
  by hand.

**Determinations, against the task's exact checklist:**

- **Process-local**: Yes — whenever `REDIS_URL` is unset or the Redis
  client fails to construct, which the code treats as a normal, silent,
  permanent fallback path, not an error condition.
- **Redis-backed**: Only when `REDIS_URL` is set and `ioredis` loads
  successfully.
- **Optionally Redis-backed**: Yes — this is the precise characterization;
  neither "Redis-backed" nor "process-local" alone is accurate.
- **Shared across instances**: Only in the Redis-backed case. In the
  fallback case, each server process has its own independent `inMemory`
  `Map` — a token denylisted by one instance (e.g., the instance that
  handled a user's logout) is **not** recognized as revoked by any other
  instance, under horizontal scaling, the moment Redis is absent.
- **Durable for the access-token lifetime**: Only in the Redis-backed
  case (`revokeAccessToken`'s TTL is a **hardcoded** `60 * 60` seconds,
  `tokenStore.js:36` — not read from `JWT_EXPIRES_IN`, a latent
  drift risk if that env var is ever changed from its 1h default, noted
  here as a Low finding, not corrected in this pass since it is an
  existing-file edit out of this report's authorized scope). In the
  fallback case, the denylist entry is lost on process restart.
- **Fail-open or fail-closed on storage failure**: **Two different
  failure classes exist, with two different outcomes, both re-verified
  this pass.** (1) An **in-flight** error from an already-connected Redis
  client (e.g., connection drop mid-request) propagates as an uncaught
  rejection out of `cacheGet`, through `isAccessTokenRevoked`, to
  `requireAuth`'s `.catch(() => res.status(401)...)` (`middleware/auth.js:29-30`)
  — this specific case **is fail-closed**, confirmed by direct
  re-inspection. (2) The **absence** of Redis configuration entirely (no
  `REDIS_URL`, or a permanently-failed `ioredis` import) is **never
  treated as a failure at all** — it is a silent, permanent switch to a
  functioning-but-weaker store, with no fail-closed behavior to speak of,
  because nothing ever throws or returns an error signal in that path.
- **Part of the accepted future/target architecture**: **No, not as
  currently implemented.** §24 defines the entire access-token
  invalidation contract for the target architecture as either Option A
  (zero cache, zero process-local state, zero Redis) or Option B (Redis,
  under an exact delete-on-invalidate + 5–10s-backstop contract, MongoDB
  always the source of truth). The existing denylist matches **neither**
  shape: it is not backed by MongoDB at all (it IS its own source of
  truth for its own signal, with no authoritative durable backing store),
  and it silently degrades to the exact "process-local fallback" state
  §24 says must **never** occur "in either option." §29's one-line
  reference to it ("existing mechanism") is the **only** place in the
  entire architecture document where it is named in connection with the
  target design, and that reference does not itself claim the mechanism
  already meets §24's stricter bar.
- **Future role — legacy bridge, confirmed by direct textual evidence**:
  §37 (SEC-3G, "Legacy Removal and Final Authentication Audit") names,
  verbatim, "Remove `tokenStore.js`'s single-slot system" as required
  legacy-removal work before the final 10/10 sign-off — `revokeAccessToken`/
  `isAccessTokenRevoked` are functions inside exactly that file, targeted
  for removal. This is direct, unambiguous evidence that the denylist is
  architecturally intended as a **temporary bridge**, not a permanent
  target-architecture component.

**Conclusion, replacing the original pass's unverified claim**: the
existing denylist is real, live, and does provide _today's_ immediate
access-token invalidation on normal logout — but it does **not**, as
currently implemented, meet the same "no process-local fallback, ever"
bar the architecture holds §24's own tokenVersion path to, and it is
explicitly slated for removal at SEC-3G. It must not be described as
already satisfying the target architecture. §12 below defines the
corrected, conditional role it plays until it is either hardened or
retired.

## 4. Resolution — current-session logout, evaluated against all four options

**Option A — access authorization additionally checks session family
(`sid`+`subjectType`+`subjectId`+`revokedAt`) on every request.**
Rejected. §24's text specifies exactly one minimal indexed point lookup
(`User.findById(subjectId, {tokenVersion:1, accountStatus:1})`) as the
**entire** access-token invalidation contract; it never mentions
consulting `RefreshSession` on the access-token path (only on the
separate, already-distinct refresh-time path, §22 step 5). Adding a
second per-request MongoDB read (plus a new required index shape beyond
what §21 already defines, since `_id`-by-`sid` lookup is already covered
by the default index but a per-request family-state check would need to
additionally re-verify `subjectType`/`subjectId` binding and `revokedAt`
on every single access request, not just at refresh time) would double
the read cost of every authenticated request and is not authorized by any
passage in §24. Not selected.

**Option B — current-session logout increments `tokenVersion`.**
Rejected — direct, confirmed contradiction with the already-accepted
architecture. §18A/§21/§29 draw an explicit, repeated, load-bearing
distinction between "Normal logout" (revoke exactly one `RefreshSession`
document) and "Logout-all" (bump `tokenVersion`, invalidating every
family). Making normal logout bump `tokenVersion` would silently log out
every other device on every ordinary logout, collapsing a distinction the
architecture treats as intentional and necessary (§29's table lists them
as two separate rows with two separate `revokeReason` values,
`'logout'` vs. `'logout_all'`). Not selected.

**Option C — bounded access-token lifetime delay (no denylist at all;
accept that the already-issued access token remains valid until its own
natural, shortened 10–15 minute expiry).** Not selected in this pure
form: the task requires this be "acceptable only when the architecture
report explicitly authorizes the delay," and it does not — §29's table
names an **immediate** mechanism for normal logout ("Denylist the
presenting access token"), not an accepted-delay policy. Silently
dropping that named mechanism and substituting a bare delay would itself
be an uncorrected deviation from the accepted text.

**Option D — shared, durable denylist.** **Selected, with an explicit
interim condition, not adopted unconditionally.** This is the design
§29's text actually names. §3 established it does not yet meet the
"no process-local fallback, ever" bar. §35 already specifies, as part of
the architecture's own final 10/10 gate, that Redis must become mandatory
(hard-fail, not merely warned) "once tokenVersion-cache/rate-limiting
depends on shared state across a genuinely multi-instance deployment" —
the identical failure mode (silent multi-instance inconsistency from an
optional cache) that afflicts the denylist today. Applying that same
already-accepted hardening requirement to the denylist — making Redis a
hard startup requirement for it, removing the silent `inMemory` fallback
path entirely for this specific mechanism — closes exactly the gap §3
identified, using a mechanism the architecture text already commits to
building, rather than inventing a new one.

**Final selection: Option D, hardened, is the target-state answer for
current-session logout's access-token invalidation.** The report
distinguishes the three time periods precisely, as required:

- **Current legacy behavior (today, unchanged by anything in this
  engagement so far)**: normal logout calls `revokeRefreshToken` +
  `revokeAccessToken`. This works correctly in a single-instance
  deployment and works correctly whenever `REDIS_URL` is configured; it
  silently degrades to non-shared, non-durable behavior otherwise. This is
  the pre-existing F-H2 finding, not something SEC-3D introduces or
  worsens.
- **Dormant SEC-3D foundation**: builds the `tokenVersion`-based
  primitives (§7–§11) as pure, unwired additions. SEC-3D does **not**
  decide the denylist's fate, harden it, or wire anything to it — that
  decision belongs to SEC-3E (activation, where the hardening and the
  layered-check composition actually get wired live) and, for the
  Redis-mandatory hard-fail itself, is explicitly named in the
  architecture as part of the **final 10/10 gate** (§35), which may not
  even be exactly SEC-3E — this audit does not resolve that further
  sequencing question, since it is out of SEC-3D's scope entirely.
- **Final SEC-3E-and-beyond production behavior**: access-token
  invalidation on current-session logout is immediate via the (by then
  hardened, Redis-mandatory) denylist; every other event (suspend, delete,
  role change, password change/reset, logout-all) is immediate via
  `tokenVersion` (§24 Option A), which never depended on the denylist at
  all.

**No architecture correction to the upstream SEC-3A document is required
to reach this conclusion** — it is derivable from §3, §29, and §35 read
together, which this audit report had not previously stated in one place.

## 5. Security mutation event matrix

_(Preserved from the original pass — no contradiction found in the matrix
itself; corrections apply to the atomic-mutation mechanics in §5.4/§8, and
the exact ownership boundary between SEC-3D.1 and SEC-3D.2 is stated
explicitly below, consolidated from the SEC-3D.2-A2 through SEC-3D.2-A6.2
audit sequence: SEC-3D.2 never calls SEC-3D.1 at runtime for any event in
this table — this is a dormant-primitive boundary, not an event-by-event
exception. Where the "Revoke all/current families" column says "Yes," the
family sweep is provided by SEC-3D.1's `revokeCurrentFamily`/
`revokeAllFamilies` and is composed with SEC-3D.2's own subject-document
mutation only by **SEC-3E**, per §7's Strategy B ordering. Logout-all and
admin-revoke (all-family scope) additionally use two **distinct** SEC-3D.2
method contracts, not one shared primitive — see §8.5/§8.5.1.)_

| Event                                    | Revoke current family             | Revoke all families           | Increment `tokenVersion`            | Account-status mutation           | Role/claim invalidation                                   |
| ---------------------------------------- | --------------------------------- | ----------------------------- | ----------------------------------- | --------------------------------- | --------------------------------------------------------- |
| Current-session logout                   | Yes (`revokeReason:'logout'`)     | No                            | **No**                              | No                                | No (hardened denylist covers the one presented token, §4) |
| Logout-all                               | No                                | Yes, best-effort `updateMany` | **Yes** — sole authoritative signal | No                                | Implicitly closes any role-claim staleness too            |
| Password change (self)                   | No                                | Yes, best-effort              | Yes                                 | No                                | Yes, incidentally                                         |
| Password reset (unauthenticated)         | No                                | Yes, best-effort              | Yes                                 | No                                | Yes, incidentally                                         |
| Account suspension                       | No                                | Yes, best-effort              | Yes                                 | Yes (`accountStatus:'suspended'`) | Yes, incidentally                                         |
| Account reactivation                     | No                                | No (see §5.1)                 | Mode-dependent (see §5.1)           | Yes (`accountStatus:'active'`)    | No                                                        |
| Account deletion                         | No                                | Yes, optional (see §5.4/§8.4) | **Not applicable — see §5.4**       | Yes (document removed)            | Yes, incidentally                                         |
| Role change                              | No                                | No                            | **Yes, only**                       | No                                | Yes (the point of the bump)                               |
| Permission change (`UserRoleAssignment`) | No                                | No                            | **No — not required** (A5)          | No                                | Already immediate where consulted                         |
| Admin revoke (explicit)                  | Either, admin choice              | Either, admin choice          | Only if "revoke all" chosen         | No                                | Depends on scope chosen                                   |
| Refresh replay                           | Yes (already implemented, SEC-3B) | No                            | No                                  | No                                | No                                                        |

### 5.1 Account reactivation — two explicit modes

Not named anywhere in §29's event table (only suspension is named). This
is security-correct by direction of effect: reactivation restores access
to a legitimately-owned account; there is no session to protect against in
the ordinary case. **Corrected from the original pass's single implicit
behavior into two explicit, named modes**, selected by one caller-supplied
boolean input, `alsoInvalidateAccessTokens` (default `false`):

- **Mode A — `alsoInvalidateAccessTokens: false`** (the default, ordinary
  case: a suspension followed by a routine, non-compromise reactivation).
  `accountStatus` transitions to `'active'`; `tokenVersion` is **not**
  read, guarded, classified, or mutated at all — this mode's write and
  every one of its classification branches are entirely independent of
  `tokenVersion`.
- **Mode B — `alsoInvalidateAccessTokens: true`** (an admin-chosen flag
  for the case where a suspension followed a compromise rather than a
  policy violation, restoring access while still forcing every
  outstanding access token — including any issued before the compromise
  was discovered — to be re-authenticated). `accountStatus` transitions to
  `'active'` **and** `tokenVersion` increments, atomically, in the same
  conditional write as suspend's own shape (§8.3).

Neither mode calls SEC-3D.1 or mutates any `RefreshSession` document — any
accompanying session-family cleanup for Mode B remains SEC-3E composition
work, exactly like every other event in this table. This remains a
product/operational choice of which mode to invoke, not a
security-mandatory default; the default (Mode A) is deliberately the
narrower, non-invalidating behavior.

### 5.2 Role changes must invalidate existing access claims

Confirmed, §29: "Closes 'role change has zero effect on outstanding
tokens'."

### 5.3 Exact `revokeReason` per event

Unchanged from the original pass — the 9-value implemented enum maps
one-to-one to every event with no overlap and no gap (§6).

### 5.4 Correction — `tokenVersion` and the related subject-field mutation are never independent writes

The original pass's §8 implicitly treated "bump `tokenVersion`" as a
standalone operation, separate from "change `accountStatus`" or "change
`password`," describable as two calls against the same document. This is
corrected in full in §8 below: for every event in this matrix, the
`tokenVersion` increment and whatever other field the event changes on
the same subject document (`accountStatus`, `role`, `password`) are
defined as **one atomic write**, never two.

## 6. Revoke-reason coverage audit

_(Preserved from the original pass — no contradiction found.)_ The
implemented enum (`RefreshSessionContracts.js`,
`REFRESH_SESSION_REVOKE_REASONS`) already contains all 9 values needed:
`logout, logout_all, replay_detected, password_change, password_reset,
account_suspended, account_deleted, role_changed, admin_revoked`. Complete;
no new value required; no ambiguous overlap found; no enum change needed.

## 7. Ordering and atomicity model

_(Strategy selection preserved from the original pass — re-verified
correct; the mutation mechanics it depends on are corrected in §8.)_

**Strategy A (transaction-required)**: local/dev/CI Mongo topology is a
plain standalone `mongo:7` container with no `--replSet` flag
(`docker-compose.yml`, re-confirmed this pass) — cannot run a transaction
today. Production's `MONGO_URI` (`render.yaml`) is an operator secret,
not verifiable from the repository — the same category of
infrastructure-unknown fact as §11's DNS/TLS caveat, which the
architecture explicitly refuses to let block SEC-3B/3C/3D. **Not
selected.**

**Strategy B (`tokenVersion`-first invalidation, transaction-independent)
— selected, unchanged.** Atomically mutate the authoritative subject
document first (§8 defines exactly what "atomically" means per event,
corrected from the original pass); all old claims become invalid the
moment SEC-3E's Option A enforcement is active; revoke matching
`RefreshSession` documents afterward as best-effort cleanup exactly as
§21 mandates; cleanup failure does not restore validity, because the
subject-document mutation, not the cleanup, is authoritative.

**Strategy C (session-revoke-first)**: rejected, unchanged — revoking
`RefreshSession` documents has no effect on an already-issued access
token at all (access-token validity is governed entirely by
`tokenVersion`/`accountStatus`, §24), so this ordering leaves the exact
access-token exposure window the event was meant to close, wide open,
for events whose primary goal is closing access-token exposure
(suspension, role change, password change).

**Recommended model, restated**: Strategy B, `tokenVersion`-first,
transaction-independent — this matches the architecture's own stated
design; this audit's contribution is the exact atomic-write mechanics in
§8, which the original pass left underspecified.

## 8. tokenVersion mutation and atomic subject-security mutation design

### 8.1 Maximum bound (A3)

`User.tokenVersion`/`Employer.tokenVersion` currently have `min: 0` and an
integer validator but **no upper bound** — confirmed by direct
re-inspection this pass, unchanged since the original audit. **Required,
not optional**: both models must additionally enforce `tokenVersion <=
Number.MAX_SAFE_INTEGER`. This is additive validation (a `max` validator
alongside the existing `min`/integer validators) and may be included in a
dormant SEC-3D.2 slice, since it changes no currently-stored value and
gates only a boundary no write has ever approached.

**Schema invariant, stated precisely**: `tokenVersion` must be a safe,
non-negative integer no greater than `Number.MAX_SAFE_INTEGER`. The
additive model change carrying this at the schema-validation layer is:

```js
max: Number.MAX_SAFE_INTEGER
```

added to the existing `tokenVersion` definition in both
`server/src/models/User.js` and `server/src/models/Employer.js`, alongside
the existing `type: Number`, `default: 0`, `min: 0`, `required: true`, and
`Number.isInteger` validator — all five of which are preserved unchanged.
This schema bound governs only `.save()`/`runValidators:true`-validated
paths; it does **not** replace query-level protection for a raw `$inc` via
`findOneAndUpdate`, which never runs schema validators unless
`runValidators: true` is explicitly set.

**Increment guard, corrected (SEC-3D.2-A3/A4/A5 finding): a bare
`{tokenVersion: {$lt: Number.MAX_SAFE_INTEGER}}` filter clause is not a
sufficient guard.** MongoDB's query-predicate comparison semantics permit
this bare clause to match several malformed stored states it was intended
to reject — most notably a `null` stored value and a stored array
containing a matching element (query-operator array-reach-in behavior) —
and, independent of that, a `$mod`-based well-formedness check placed
unguarded inside an aggregation `$and` risks throwing on a non-numeric
operand rather than failing closed, since MongoDB's aggregation framework
does not guarantee short-circuit evaluation of `$and`'s array elements.
The corrected, selected guard closes both problems with one nested `$cond`
expression, evaluated inside `$expr`, so that the modulo check is reached
only after the value is already proven to be a genuine numeric BSON type
within bounds:

```js
const validTokenVersionExpr = {
  $cond: [
    { $isNumber: '$tokenVersion' },
    {
      $cond: [
        {
          $and: [
            { $gte: ['$tokenVersion', 0] },
            { $lt: ['$tokenVersion', Number.MAX_SAFE_INTEGER] },
          ],
        },
        { $eq: [{ $mod: ['$tokenVersion', 1] }, 0] },
        false,
      ],
    },
    false,
  ],
};
```

Confirmed properties of this expression:

- `$mod` is evaluated only inside the branch already gated by
  `$isNumber === true` and the range check `=== true` — no path reaches
  `$mod` with a non-numeric operand, so no expression error is possible.
- Missing, `null`, string, array, and object stored values are rejected at
  the outer `$isNumber` gate (an aggregation-expression type check, not a
  query-operator match — it does not "reach into" arrays the way ordinary
  query-operator predicates do).
- Negative, fractional, `NaN`, and both positive and negative infinite
  values fail closed — negative/fractional are excluded by the range or
  modulo check; `NaN`/`±Infinity` are excluded because `$mod` applied to
  either yields `NaN` under ordinary floating-point semantics, and `NaN`
  is never `$eq` to `0`, regardless of how the range check itself resolves
  for those values.
- The exact maximum (`tokenVersion === Number.MAX_SAFE_INTEGER`) does not
  match this expression (the strict `$lt` excludes it) — this filter miss
  alone does not distinguish "malformed" from "exhausted"; that
  distinction is made separately by the bounded classification read
  (§8.5.1), not by this guard.
- Values above the maximum do not match, for the same reason.
- Every well-formed safe non-negative integer strictly below the maximum
  matches.
- The expression is one filter clause (`$expr: validTokenVersionExpr`)
  combined with whatever other precondition clauses a given mutation
  requires — it never introduces a second write or a second round trip,
  and one atomic conditional `findOneAndUpdate` remains the mechanism for
  every mutation below.
- It is applied uniformly to every SEC-3D.2 write that increments
  `tokenVersion` — logout-all, admin-revoke, password change, password
  reset, suspend, reactivate (Mode B only), and role change — with no
  operation-specific exception.

### 8.2 Password change / password reset / admin-reset-password — corrected: `__v` is not full optimistic concurrency by default

Re-confirmed this pass: `User.js:77-81` hashes `password` in a
`pre('save')` hook, gated on `this.isModified('password')`
(`bcrypt.hash(this.password, 12)`) — this hook **only** fires on
document-middleware paths (`.save()`), never on query-middleware paths
(`findOneAndUpdate`/`updateOne`), and no `pre('findOneAndUpdate')`
counterpart exists.

**Correction to the SEC-3D-A.1 pass's concurrency claim.** That pass
asserted "`.save()` on a modified document is therefore already protected
against a silent lost-update" merely because the default `versionKey`
(`__v`) is not disabled. **This is not accurate.** Re-inspected this pass,
explicitly: neither `User.js` nor `Employer.js` sets
`optimisticConcurrency: true` (grep-confirmed, zero matches across
`server/src/models`). Mongoose's default `__v` field, without
`optimisticConcurrency: true` explicitly enabled, does **not** filter an
ordinary `.save()`'s underlying `updateOne` on the previously-loaded `__v`
value for a plain scalar-field change — that conditional-filter behavior
is exactly what the `optimisticConcurrency` schema option adds, and it is
opt-in, not default. Without it, two independently-loaded documents can
both `.save()` a conflicting scalar change (e.g., two concurrent
`tokenVersion` bumps computed as `doc.tokenVersion += 1` in application
code, then saved) and the second write can silently overwrite the first's
intended value with its own stale-based computation — a genuine lost
update, not a caught conflict. The distinction the task requires be made
explicit:

- **Atomicity of one MongoDB document write**: guaranteed regardless —
  any single `updateOne`/`.save()` either fully applies or does not.
  This alone says nothing about whether two _separate_ writes conflict.
- **Mongoose document-save versioning behavior (default)**: increments
  `__v` on save; does **not**, by itself, reject a concurrent conflicting
  save.
- **Explicit optimistic concurrency**: only active when
  `optimisticConcurrency: true` is set on the schema — not set here.
- **Expected-state compare-and-set filtering**: a query-level filter
  clause (e.g. `{accountStatus: expectedPriorStatus}`) — independent of
  Mongoose's versioning feature entirely, already the mechanism selected
  in §8.3, and MongoDB-native (works identically via `findOneAndUpdate`
  regardless of any Mongoose schema option).

**Selected design: Design B — pre-hashed conditional update, not Design
A.** Both options were evaluated:

- **Design A (explicit optimistic document save)** would require enabling
  `optimisticConcurrency: true` on `User`/`Employer` — but this is a
  schema-wide behavioral change, not a narrow additive validator: it
  would alter the concurrency semantics of **every** existing live
  `.save()` call site on these models (registration, login's
  `lastLoginAt` update, `verifyEmail`, the existing `changePassword`/
  `resetPassword` controllers, every admin `updateUser`/`updateEmployer`
  call, etc.) — all of which would newly become capable of throwing a
  `VersionError` they do not handle today. That is a materially wider
  blast radius than the single additive `max` validator §8.1 already
  authorizes as dormant-safe, and is exactly the kind of "changing
  existing event handlers is live behavior" concern the SEC-3D-A.1
  correction already established for handler edits — a schema-wide
  concurrency-semantics change reaches those same existing handlers
  without editing their source, which is no safer. **Rejected** for this
  reason, not because the mechanism itself is unsound.
- **Design B (pre-hashed conditional update)** touches no existing
  schema behavior and no existing call site at all: the new mutation
  service explicitly computes `bcrypt.hash(newPassword, 12)` — reusing
  the exact cost factor already hardcoded at `User.js:79`, stated here so
  a future drift between the two call sites is a known, checkable
  invariant, not a silent divergence — then issues one
  `findOneAndUpdate`:

  ```js
  User.findOneAndUpdate(
    {
      _id: subjectId,
      tokenVersion: { $eq: expectedTokenVersion },
      $expr: validTokenVersionExpr,
    },
    {
      $set: { password: newHash },
      $inc: { tokenVersion: 1 },
    },
    { new: false, projection: { _id: 1 } }
  );
  ```

  **Realm: User only** — no live Employer self-service password-change
  route exists anywhere in `server/src/routes/`, confirmed by direct
  inspection. `expectedTokenVersion` is the `tokenVersion` claim already
  present on the caller's own, already-verified access token that
  authenticated this very request (§12) — no new client-observed state is
  required. Required input validation, before any hashing call:
  `Number.isSafeInteger(expectedTokenVersion) && expectedTokenVersion >=
  0`. This does **not** bypass hashing — the password is still hashed
  with the same algorithm (`bcryptjs`) and cost factor (`12`) before being
  written, only via an explicit call instead of the model's hook, which is
  intentionally not fired since this write uses `findOneAndUpdate`
  (query-middleware), not `.save()`. Current-password re-verification and
  password-policy enforcement remain **outside this dormant primitive** —
  both are, and remain, the existing live controller's responsibility, to
  be composed with this primitive only in SEC-3E. A caller-supplied
  precomputed hash is never accepted; only plaintext `newPassword` is,
  hashed internally. The write projects only `{_id: 1}` on success — no
  password, hash, or other field is read back. **Selected.**

**Zero automatic retries (corrected, SEC-3D.2-A5/A6 finding).** Unlike the
tokenVersion-only operations below, password change never retries — a
concurrent, unrelated `tokenVersion` advancement never proves that *this*
password write occurred, so there is no safe basis for treating a CAS miss
as anything but a terminal result. On a filter-match failure, exactly one
bounded classification read (`{tokenVersion: 1}` projection) determines
the exact terminal code:

```text
subject missing                              → SUBJECT_MISSING
tokenVersion fails the well-formedness guard  → SUBJECT_STATE_MALFORMED
tokenVersion well-formed, exactly the maximum → VERSION_EXHAUSTED
tokenVersion well-formed, current > expected  → VERSION_CONFLICT
tokenVersion well-formed, current == expected → VERSION_CONFLICT
tokenVersion well-formed, current < expected  → VERSION_REGRESSION
```

No tokenVersion observation — including one that shows `current ==
expected` after the write missed — can prove that this specific password
mutation occurred; `VERSION_CONFLICT` is returned for both of those cases,
never `VERSION_ALREADY_ADVANCED` (that code is reserved for the
tokenVersion-only operations, §8.5.1). The caller decides whether to
resubmit as a wholly fresh request; the current-password re-verification
step (unchanged, already required by the existing controller, but outside
this primitive) independently gates any resubmission at the controller
layer. Maximum model calls for this operation: 2 (one write, one
classification read on miss).

**Password reset — one-write contract.** The existing
`authController.resetPassword` already reads
`User.findOne({passwordResetToken: hash(token), passwordResetExpires:
{$gt: now}})` and, on match, clears both fields in the same `.save()` as
the password write. The corrected, Design-B-consistent contract folds
every one of the task's required fields into a single `findOneAndUpdate`:

```js
User.findOneAndUpdate(
  {
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: now },
    $expr: validTokenVersionExpr,
  },
  {
    $set: { password: newHash, mustChangePassword: false },
    $unset: {
      passwordResetToken: '',
      passwordResetExpires: '',
      tempPasswordExpires: '',
    },
    $inc: { tokenVersion: 1 },
  },
  { new: false, projection: { _id: 1 } }
);
```

**Realm: User only.** `hashedToken` must be the canonical, already-hashed
form the existing, unmodified controller already produces
(`server/src/utils/tokenStore.js:7-9`, `hashResetToken` →
`crypto.createHash('sha256').update(token).digest('hex')`) — a lowercase
64-character hex SHA-256 digest, `/^[0-9a-f]{64}$/`. This primitive
receives the already-hashed token; it does not hash the raw token itself
and does not own that hashing algorithm choice. `newPassword` is
plaintext, hashed internally with `bcryptjs` at cost `12`, exactly as in
password change.

**Design 1 — frozen, no classification read, no retry (SEC-3D.2-A4/A5/A6
finding).** Primary writes: 1. Classification reads: 0, always. Retries:
0, always. Every filter miss — for any reason — returns
`RESET_TOKEN_INVALID`, uniformly. A "classification read" is mechanically
incoherent for this operation in any case: after a filter miss there is no
subject identifier to read by (token-only lookup, by construction), so
Design 2 (a distinguishing reread) was assessed and rejected — it would
require a second, subject-identifying lookup this primitive's accepted
inputs do not provide, and would create an enumeration risk this design
deliberately avoids.

**The one-time reset token is itself the natural idempotency boundary,
confirmed by repository evidence, not assumed**: the filter's
`passwordResetToken: hashedToken` clause only matches a document whose
reset token has **not yet** been cleared. Because the clear (`$unset`)
and the password/`tokenVersion` change commit in the **same** atomic
`findOneAndUpdate`, there is no intermediate state in which the token is
cleared but the password/version change has not yet applied (or vice
versa). A repeated submission of the same, now-already-consumed token
therefore finds no matching document at all — `findOneAndUpdate` returns
`null`, classified as `RESET_TOKEN_INVALID` (reusing the existing
controller's own generic "Invalid or expired reset link" framing) — and
**cannot** increment `tokenVersion` a second time, because the filter that
gates the `$inc` is the same filter that gates the token consumption. No
separate idempotency mechanism is required for this event.

**Malformed and exhausted `tokenVersion` are intentionally, permanently
not publicly distinguished for this operation** — both fold into the same
`RESET_TOKEN_INVALID` miss code, by design, for enumeration safety.
`SUBJECT_STATE_MALFORMED` and `VERSION_EXHAUSTED` are **not** reachable
from password reset. Maximum model calls for this operation: 1.

### 8.3 Account suspension / reactivation / role change — atomic, non-hashing mutations

These events touch no hashed field, so they do not need `.save()`'s
document round-trip at all — the safe, simpler, natively atomic contract
is a single `findOneAndUpdate` combining every changed field. **Corrected
(SEC-3D.2-A4/A5 finding): none of these three operations bind an
`expectedTokenVersion` equality clause.** An earlier draft of this
correction added one, reasoning by analogy with logout-all/admin-revoke —
but doing so would let a concurrent, unrelated, legitimate event (e.g. a
password reset advancing `tokenVersion` between this operation's own
preceding observation and its write) spuriously block a suspend/
reactivate/role-change write that should otherwise succeed, which
directly conflicts with this design's own required different-event
concurrency guarantee (§8.5). The only precondition these three operations
bind is the field they are actually changing
(`accountStatus`/`role`), plus the value-independent well-formedness
guard (§8.1) — never an exact expected `tokenVersion`.

**Suspend** — realm: User and Employer.

```js
User.findOneAndUpdate(
  {
    _id: subjectId,
    accountStatus: 'active',
    $expr: validTokenVersionExpr,
  },
  { $set: { accountStatus: 'suspended' }, $inc: { tokenVersion: 1 } },
  { new: false, projection: { _id: 1 } }
);
```

**Reactivation, Mode A — `alsoInvalidateAccessTokens: false`** (§5.1).
`tokenVersion` is not read, guarded, or mutated on this path at all:

```js
User.findOneAndUpdate(
  { _id: subjectId, accountStatus: 'suspended' },
  { $set: { accountStatus: 'active' } },
  { new: false, projection: { _id: 1 } }
);
```

**Reactivation, Mode B — `alsoInvalidateAccessTokens: true`** (§5.1),
identical shape to suspend, targeting `'active'`:

```js
User.findOneAndUpdate(
  {
    _id: subjectId,
    accountStatus: 'suspended',
    $expr: validTokenVersionExpr,
  },
  { $set: { accountStatus: 'active' }, $inc: { tokenVersion: 1 } },
  { new: false, projection: { _id: 1 } }
);
```

`alsoInvalidateAccessTokens` is a strict boolean input, default `false`;
any non-boolean value is `INVALID_INPUT`. It controls access-token
invalidation only — it never calls SEC-3D.1 and never mutates a
`RefreshSession` document (§5.1).

**Role change** — realm: **User only** (`Employer.js` has no `role` field
at all, confirmed by direct inspection — zero matches for `role` anywhere
in that schema).

```js
User.findOneAndUpdate(
  {
    _id: subjectId,
    role: expectedPriorRole,
    $expr: validTokenVersionExpr,
  },
  { $set: { role: newRole }, $inc: { tokenVersion: 1 } },
  { new: false, projection: { _id: 1 } }
);
```

`accountStatus`/`role` (whichever the event changes) and `tokenVersion`
(when the operation touches it at all) change together in one MongoDB
operation — there is no window in which one has committed and the other
has not, and no separate call is needed. The `expectedPriorStatus`/
`expectedPriorRole` filter clause is the state-conditioned CAS this audit
selects for idempotency (§8.5) — the same pattern already accepted and
shipped in `RefreshSessionRotationService`'s own CAS/replay-revoke
filters, reused here rather than inventing a new mechanism.

**Success result, corrected (SEC-3D.2-A6 finding): none of these four
writes returns `VERSION_INCREMENTED`.** That code is reserved for the
genuinely tokenVersion-focused operations (logout-all, admin-revoke,
password change, password reset); returning it for a no-tokenVersion-
change reactivation (Mode A) would be false on its face, and using it
inconsistently for the other three (which do also increment) would
misdescribe the operation's actual primary objective, which is the
`accountStatus`/`role` transition itself. All four use one unified,
tokenVersion-agnostic success code instead: `SUBJECT_STATE_UPDATED` — "the
requested `accountStatus`/`role` transition was performed; no claim is
made about whether `tokenVersion` also changed."

**State classification precedence, frozen (SEC-3D.2-A6/A6.1 finding).**
For suspend, reactivate Mode B, and role change, on a primary-write miss,
exactly one classification read decides the outcome, in this fixed order:

```text
1. Subject missing                              → SUBJECT_MISSING
2. tokenVersion fails the well-formedness guard  → SUBJECT_STATE_MALFORMED
3. tokenVersion well-formed, exactly the maximum → VERSION_EXHAUSTED
4. accountStatus/role outside its known enum     → SUBJECT_STATE_INVALID
5. target state already applied                  → SUBJECT_STATE_ALREADY_APPLIED
6. expected prior state remains                   → eligible for one bounded retry
7. a third, valid, different state                → SUBJECT_STATE_CONFLICT
```

Integrity checks (steps 2–4) always precede state-comparison checks
(steps 5–7) — an alert-worthy data-integrity anomaly must never be masked
by a coincidentally-matching state field. For reactivate Mode A (no
`tokenVersion` involvement at all), the same principle applies to the
smaller check set:

```text
1. Subject missing                    → SUBJECT_MISSING
2. accountStatus outside its enum     → SUBJECT_STATE_INVALID
3. already active                     → SUBJECT_STATE_ALREADY_APPLIED
4. still suspended (expected prior)   → eligible for one bounded retry
5. a third, valid, different status   → SUBJECT_STATE_CONFLICT
```

No `tokenVersion`-related code (`SUBJECT_STATE_MALFORMED`,
`VERSION_EXHAUSTED`, `VERSION_REGRESSION`) is ever reachable from Mode A —
`tokenVersion` is neither read nor mutated on that path.

**`SUBJECT_STATE_INVALID` — malformed `accountStatus`/`role` (SEC-3D.2-A6.1
finding): reuses an existing, checkpointed precedent rather than a new
term.** `server/src/services/auth/SessionSubjectStateProvider.js:117-120`
(SEC-3C, checkpointed) already returns this exact code for an
`accountStatus` outside `{'active','suspended'}` — "Unknown/malformed
status — never treated as active." SEC-3D.2 reuses the same name for the
same concept, extended to cover a `role` outside
`['User','Editor','Moderator','Admin','SuperAdmin']` as well.
`SUBJECT_STATE_MALFORMED` remains scoped **narrowly** to `tokenVersion`
numeric well-formedness only — it is never returned for a malformed
`accountStatus`/`role`, and `SUBJECT_STATE_INVALID` is never returned for
a malformed `tokenVersion`; the two names are kept deliberately distinct.

Because `accountStatus`'s enum has exactly two values, `SUBJECT_STATE_
CONFLICT` (step 7 / step 5) is **structurally unreachable today** for
suspend and either reactivation mode — any valid stored value is
necessarily either the expected-prior or the target, with no third valid
option — and is defined for schema-forward-compatibility only. For role
change, whose enum has five values, `SUBJECT_STATE_CONFLICT` **is**
reachable, and is distinguished explicitly from `SUBJECT_STATE_INVALID`: a
different, valid enum role is a legitimate concurrent conflict; a role
outside the enum entirely, of the wrong type, `null`, or missing is a
data-integrity anomaly.

Minimal classification projections: tokenVersion-only reads project
`{tokenVersion: 1}`; `accountStatus` reads with Mode B/suspend project
`{accountStatus: 1, tokenVersion: 1}`; `accountStatus` reads for Mode A
project `{accountStatus: 1}` only (no `tokenVersion` field); `role` reads
project `{role: 1, tokenVersion: 1}`. No classification read ever selects
`password`, `passwordResetToken`, or any other unrelated field.

### 8.4 Account deletion

Re-confirmed this pass, repository-wide: no soft-delete field exists on
`User`/`Employer` (no `isDeleted`/`deletedAt`/equivalent anywhere in
either schema, re-confirmed by direct inspection — not invented by this
audit). `admin/usersController.deleteUser` performs
`User.findByIdAndDelete(id)` — **physical, hard deletion**, the only
deletion contract this repository currently supports.

**Token invalidation is already atomic with deletion, by construction, and
needs no separate `tokenVersion` step**: once the document is physically
removed, every subsequent authoritative read — `SessionSubjectStateProvider.getSubjectState`
(access path, §24) and §22 step 5's subject lookup (refresh path) — both
already return "not found" and fail closed (confirmed live behavior of
both, re-inspected this pass). There is no window in which a stale
`tokenVersion` on a since-deleted document could be read, because there is
no document left to read at all. A pre-delete `tokenVersion` bump would
add no security value; this audit does not recommend one, correcting the
original pass's vaguer "moot, but defense-in-depth" language into a
precise conclusion: **not applicable**, not "moot but recommended anyway."
SEC-3D.1's `account_deleted` all-family revoke reason remains permitted,
for an operator who chooses to run a defense-in-depth session sweep
alongside a deletion (SEC-3E composition only) — it is **not** required by
SEC-3D.2, which performs no mutation of any kind for this event.

### 8.5 Retry and idempotency semantics — corrected in full, including the SEC-3D-A.2 event matrix

**Atomicity, idempotency, concurrency safety, and uncertain-outcome
handling are four different properties — conflated in the SEC-3D-A.1
pass, distinguished here**:

- **Atomic increment**: a mechanical fact about one MongoDB write. `$inc`
  is atomic per-document regardless of concurrent writers — this alone
  says nothing about whether _repeating_ the logical request that issued
  it is safe.
- **Idempotent logical event**: a property of the _filter_, not the
  operator. An `$inc`/`$set` becomes safe to resubmit only when its
  filter is conditioned on state that a prior successful application
  already changed, so a resubmission naturally fails to match rather than
  reapplying.
- **Concurrency safety**: whether two _different_, independently
  legitimate events (two admins, two devices) can both succeed without
  spuriously blocking each other. `$inc` alone already provides this for
  the version counter itself; it does not extend to whatever other field
  a state-conditioned filter also touches.
- **Uncertain network-outcome handling**: what a caller does when it
  cannot tell whether its own request committed before the connection was
  lost. This requires a reread-and-classify step, defined per event
  below — it is not solved by atomicity or by a CAS filter alone, both of
  which only determine what happens _if_ a resubmission is attempted, not
  whether one should be.

**Correction to the SEC-3D-A.1 pass: an unconditioned `$inc` is not safe
merely because there is "no other field to stomp on."** That pass
concluded logout-all's bare `tokenVersion`-only bump was safe to retry
without any precondition, reasoning that a second bump has nothing to
incorrectly overwrite. This reasoning has a gap: it considered only
_repeating the same request_, not the possibility of a **legitimate
intervening event** occurring between the original (successful, but
unacknowledged) attempt and the stale retry. Concrete counter-example,
structurally identical to the accountStatus case already closed in
§8.3/§8.5's prior pass: a self-service "logout everywhere" request
commits (`tokenVersion: 5→6`), the response is lost, the client
automatically retries; **before** the retry arrives, the same user
legitimately logs back in (a completely ordinary, expected action after a
logout-everywhere), receiving a fresh token stamped `tokenVersion: 6`. The
stale retry, applied as an **unconditioned** `$inc`, would bump to `7`,
**incorrectly invalidating the freshly-issued, entirely legitimate new
session** — the same class of harm as the reactivation-reversal example,
not merely an extra logout. The same reasoning applies identically to any
future admin-revoke capability (§5's "Admin revoke" row) initiated
against a third party. **This narrow "no other field" case is therefore
not exempt after all** — every `tokenVersion`-incrementing mutation,
without exception, requires a state-conditioned filter; for the ones
with no _other_ mutable field to condition on, the condition is the
version itself: `tokenVersion: expectedTokenVersion`.

**No new collection or event ledger is required even with this
correction.** `expectedTokenVersion` is either already available for free
(the caller's own currently-verified access-token claim, for logout-all)
or obtained by the service performing its own immediately-preceding read
before issuing the conditioned write (for admin-initiated events with no
natural caller-side observation, e.g. admin-revoke) — the same "read, then
condition the write on exactly what was read" pattern already used
throughout this design (§8.3, §11.2), not a new durable operation-identity
ledger. A ledger collection was considered and is not selected: it adds a
new authoritative collection and new required infrastructure for a risk
this narrower, already-established pattern already closes to the same
residual window every other non-transactional part of this design
accepts.

**Logout-all and admin-revoke are two distinct method contracts, not one
shared primitive (SEC-3D.2-A6 correction).** Both perform a guarded
tokenVersion-only `$inc`, but their `expectedTokenVersion` sources differ
structurally, and this changes their idempotency guarantees — collapsing
them into one function with an optional parameter would obscure that
difference from callers who need to know which guarantee they are
getting.

- **`incrementTokenVersionForLogoutAll({realm, subjectId,
  expectedTokenVersion})`** — `expectedTokenVersion` is **caller-supplied**,
  from the caller's own verified access-token claim, which does not change
  across repeated calls presenting the same token. This makes logout-all
  idempotent across **both concurrent and sequential** duplicate calls
  that present the same claim: the second call's `$eq` clause misses
  against the already-advanced value and classifies
  `VERSION_ALREADY_ADVANCED`.
- **`incrementTokenVersionForAdminRevoke({realm, subjectId})`** — no
  `expectedTokenVersion` is accepted from the caller at all; the service
  performs its own fresh preceding read (`{tokenVersion: 1}` projection)
  on **every single invocation**. Concurrent calls that happen to preread
  the identical stale baseline collapse the same way logout-all's do. But
  **sequential, separately-authorized invocations do not** — a second
  admin-revoke call beginning after the first has already completed
  performs its own fresh preread, which observes the already-current
  (already-advanced) value, and proceeds to increment again from that new
  baseline. Admin-revoke is therefore **invocation-based, not generally
  idempotent across sequential invocations**; only concurrent calls
  sharing an identical stale baseline collapse. This is not a discovered
  defect — extra increments beyond the minimum necessary one are harmless,
  since any single advancement already invalidates every token issued
  before it — it is a corrected, truthful characterization of what the
  already-accepted preread-then-guarded-`$inc` mechanism actually
  guarantees, replacing an earlier draft's overstated "same as logout-all"
  framing.

### 8.5.1 Event idempotency matrix

| Event                                   | Natural precondition                                                                                                                        | Atomic mutation                                                                          | Retry after known failure (CAS loss)                                                                                                              | Retry after uncertain outcome                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current-family logout                   | `sid` + `subjectType`/`subjectId` binding (§9)                                                                                              | Single-document revoke, `revokedAt: null` filter                                         | Filter no longer matches → classify `ALREADY_REVOKED`, treat as success                                                                           | Reread `revokedAt`; if set, `ALREADY_REVOKED`; if still `null`, retry once                                                                                                                       |
| Logout-all                              | `tokenVersion: expectedTokenVersion` (from the caller's own verified access claim)                                                          | Guarded `$inc` (§ below)                                                                 | Reread; `current > expected` → `VERSION_ALREADY_ADVANCED`, do **not** increment again, objective already satisfied by whatever advanced it        | Reread; `current == expected` (write never landed) → retry once with the same expected value; retry miss → `CLASSIFICATION_STALE` (§8.5.1 below)                                                  |
| Password change                         | Current-password proof (existing, outside this primitive) + `tokenVersion: expectedTokenVersion` (§8.2)                                    | Single `findOneAndUpdate`, password hash + `$inc` together                               | `VERSION_CONFLICT` — caller must re-authenticate/re-observe state before resubmitting; **zero automatic retries**, always                        | One classification read produces the terminal code directly (§8.2) — no retry is attempted for this operation under any outcome                                                                  |
| Password reset                          | Valid, unused reset token (§8.2)                                                                                                            | Single `findOneAndUpdate`, token-match filter gates password + cleanup + `$inc` together | Token already cleared → filter no longer matches → `RESET_TOKEN_INVALID`, generic, matches the existing controller's "invalid or expired" framing | Design 1: zero classification reads, zero retries, always (§8.2)                                                                                                                                   |
| Suspension                              | `accountStatus: 'active'` (§8.3)                                                                                                            | `findOneAndUpdate`, `$set` + `$inc` together                                             | Filter no longer matches → one classification read, fixed precedence (§8.3) → retry-eligible only if still `'active'`                             | Retry miss → `CLASSIFICATION_STALE` (§8.5.1 below)                                                                                                                                                 |
| Reactivation                            | `accountStatus: 'suspended'` — Mode B only binds the tokenVersion guard; Mode A never involves `tokenVersion` at all (§5.1/§8.3)            | Mode A: `$set` only. Mode B: same pattern as suspension                                  | Same as suspension (Mode B); Mode A: filter miss → one classification read, no tokenVersion branch reachable                                       | Same as suspension (Mode B); Mode A: retry miss → `CLASSIFICATION_STALE`                                                                                                                           |
| Role change                             | `role: expectedPriorRole` (§8.3)                                                                                                            | `findOneAndUpdate`, `$set` + `$inc` together                                             | Filter no longer matches → one classification read, fixed precedence (§8.3)                                                                       | Retry miss → `CLASSIFICATION_STALE` (§8.5.1 below)                                                                                                                                                 |
| Account deletion                        | Existing subject identity (trivial — `findByIdAndDelete` either matches or does not)                                                        | Physical deletion, no `tokenVersion` step (§8.4)                                         | N/A — deletion of an already-deleted subject is a no-op by construction                                                                           | Reread by ID; missing → already achieved, no retry needed                                                                                                                                        |
| Admin revoke                            | `tokenVersion: expectedTokenVersion`, obtained by the service's own immediately-preceding read (no external client-observed value accepted) | Guarded `$inc`, `incrementTokenVersionForAdminRevoke` (§8.5, distinct from logout-all)    | Reread; `current > expected` → `VERSION_ALREADY_ADVANCED` (concurrent-same-baseline case only — not general sequential idempotency, §8.5)          | Retry miss → `CLASSIFICATION_STALE` (§8.5.1 below)                                                                                                                                                 |
| Session cleanup (all-family sweep, §10) | `subjectType`/`subjectId` + `revokedAt: null`                                                                                               | `updateMany`                                                                             | Re-running matches fewer/zero documents — naturally idempotent, no special handling                                                               | Same — a full resubmission of the sweep is always safe                                                                                                                                           |

**Guarded `tokenVersion`-only increment, exact shape** (logout-all,
admin-revoke — same write shape, two distinct callers/method contracts
per §8.5):

```js
User.findOneAndUpdate(
  {
    _id: subjectId,
    tokenVersion: { $eq: expectedTokenVersion },
    $expr: validTokenVersionExpr,
  },
  { $inc: { tokenVersion: 1 } },
  { new: false, projection: { _id: 1 } }
);
```

No `accountStatus` precondition is needed for a pure version bump —
subject existence (the `_id` match itself) is the only other precondition
that matters, and a missing subject is already correctly classified as
`SUBJECT_MISSING` by the first classification read.

**TokenVersion-only classification precedence** (logout-all, admin-revoke,
and password change's own miss classification), on a primary-write miss:

```text
1. Subject missing                              → SUBJECT_MISSING
2. tokenVersion fails the well-formedness guard  → SUBJECT_STATE_MALFORMED
3. tokenVersion well-formed, exactly the maximum → VERSION_EXHAUSTED
4. current well-formed, > expected               → VERSION_ALREADY_ADVANCED (logout-all/admin-revoke) or VERSION_CONFLICT (password change)
5. current well-formed, === expected              → eligible for one bounded retry (not applicable to password change)
6. current well-formed, < expected                → VERSION_REGRESSION
```

`VERSION_REGRESSION` (SEC-3D.2-A6 addition): a **well-formed** stored
counter lower than a previously-authoritative observation violates this
design's own monotonicity invariant (every mutation only ever `$inc`s
`tokenVersion`, never decrements or resets it) — this is a distinct,
alert-worthy anomaly class from `SUBJECT_STATE_MALFORMED` (which is
reserved strictly for a value that fails the numeric guard itself, never
for a well-formed value that is merely lower than expected) and from
ordinary `VERSION_CONFLICT`/CAS-miss handling (an expected, routine
outcome of legitimate concurrent advancement). Not reachable from
suspend/reactivate/role-change, which bind no `expectedTokenVersion`
equality clause to regress against.

**Retry-miss policy — Policy B, frozen (SEC-3D.2-A6.2 correction).** A
retry-eligible operation (logout-all, admin-revoke, suspend, either
reactivation mode, role change) performs **at most one** bounded retry
using the same original precondition, after its one classification read
proves that precondition still holds. If that retry **also** misses, no
second classification read is performed — checkpointed text above already
establishes that "none requires more than one additional read to classify
and decide," which caps additional reads at exactly one; a second read
after the retry would exceed that cap. Instead, the operation returns:

```text
CLASSIFICATION_STALE
```

reusing the existing, checkpointed SEC-3D.1 code and concept
(`SessionFamilyRevocationService.js`'s `classifyMiss`, which already
returns this code when a classification read finds nothing wrong yet the
primary write still didn't match — "the state changed between the two
reads... never falls back to an unconditional write"). SEC-3D.2's
retry-miss case is the same underlying situation one step later in the
sequence: a read-then-act step proved stale relative to a subsequent
write attempt, and rather than chase it with another read, the operation
stops and reports honestly. `CLASSIFICATION_STALE` means precisely: **this
invocation performed no matching mutation; a concurrent invocation may
have mutated the subject; no claim is made about whether the target was
ultimately applied, conflicted, became malformed, disappeared, or was
otherwise changed.** It is terminal, not internally retryable, and safe
for the caller to handle by issuing a wholly fresh operation (which
performs its own fresh classification) rather than the primitive guessing
on the caller's behalf. Returning a precise-but-unproven code here
(`VERSION_CONFLICT`/`SUBJECT_STATE_CONFLICT`, as an earlier draft of this
correction did) is rejected: a bare retry-write `null` result cannot by
itself distinguish an ordinary conflict from a deleted subject, a
corrupted counter, a regressed counter, or an exhausted counter — all of
which remain equally possible causes, none of them observed.

**Exact per-operation call bounds, frozen:**

| Operation                     | Pre-read | Primary write | Classification read | Retry | Final read | Maximum calls |
| ------------------------------ | -------: | -------------: | -------------------: | ----: | ----------: | -------------: |
| Logout-all                    |        0 |              1 |                    1 |     1 |           0 |              3 |
| Admin revoke                  |        1 |              1 |                    1 |     1 |           0 |              4 |
| Password change               |        0 |              1 |                    1 |     0 |           0 |              2 |
| Password reset                |        0 |              1 |                    0 |     0 |           0 |              1 |
| Suspend                       |        0 |              1 |                    1 |     1 |           0 |              3 |
| Reactivate, Mode A            |        0 |              1 |                    1 |     1 |           0 |              3 |
| Reactivate, Mode B            |        0 |              1 |                    1 |     1 |           0 |              3 |
| Role change                   |        0 |              1 |                    1 |     1 |           0 |              3 |

Fallback writes: zero for every operation, structurally — no code path in
this design issues an unconditioned write under any outcome, and no
operation ever performs a third write or a second classification read.

**Per the task's exact required list**:

- **Idempotent by filter**: every event in the matrix above, without
  exception — no event is exempt. Admin-revoke's idempotency is
  correctly scoped to concurrent same-baseline duplicates only, not to
  general sequential invocation (§8.5).
- **May increment `tokenVersion` more than once across independently
  legitimate concurrent events**: yes, and correctly so — two different
  legitimate events (e.g., an admin suspend and a concurrent self-service
  logout-all) each advancing the version is the intended, safe outcome;
  what is prevented is a _single_ logical event's _stale retry_ silently
  reapplying itself after the version has already moved on for any
  reason.
- **Filter preventing duplicate application**: the `expectedTokenVersion`/
  prior-field-value clause per event, as tabulated above — never bound
  for suspend/reactivate/role-change, to preserve different-event
  concurrency (§8.3).
- **After a known CAS loss**: reread, classify via the fixed precedence
  above, and either recognize the security objective as already satisfied
  or surface a conflict — never a blind, unconditioned reapplication.
- **After an uncertain network outcome**: reread first, always; a retry
  is only issued when the reread shows the original expected precondition
  still holds; if that one bounded retry also misses,
  `CLASSIFICATION_STALE` is returned rather than a guessed precise code.
- **Is a reread sufficient?** Yes, for every event in this design — none
  requires more than one additional read to classify and decide,
  consistent with the "no transaction, bounded extra reads" posture
  established in §7/§11; this is also the exact textual basis for
  capping retry-miss handling at zero additional reads (Policy B above).
- **Is a durable operation ID required?** No — the state-conditioned
  filter (self-observed for self-service events, service-observed
  immediately before the write for admin-initiated events) is sufficient
  and reuses an already-accepted repository pattern; see the "no new
  ledger" conclusion above.
- **Is the security objective already satisfied when the version has
  advanced due to any concurrent, unrelated security event?** Yes, for
  the tokenVersion-only operations (logout-all, admin-revoke) — a higher
  observed `tokenVersion` than expected means _something_ already
  invalidated the relevant claims, regardless of which event did it;
  re-incrementing adds no additional security value and is explicitly
  skipped (`VERSION_ALREADY_ADVANCED`). **Not** for password change: an
  unrelated advance never proves that specific password mutation
  occurred, so password change's own unrelated-advancement case is
  `VERSION_CONFLICT`, never `VERSION_ALREADY_ADVANCED` (§8.2).

## 9. Single-family (current-session) revocation design

_(Preserved from the original pass — no contradiction found; re-verified
consistent with §4's corrected current-session-logout resolution, since
this section only ever concerned the `RefreshSession` side, not the
access-token side.)_

Safe binding fields: `sid` (caller-supplied, never trusted alone), `realm`
and `subjectId` from the authenticated bearer access token's own verified
claims (never client input). Filter: `{_id: sid, subjectType: realm,
subjectId: subjectId, revokedAt: null}`. Update:
`{$set: {revokedAt: now, revokeReason: 'logout'}}`. Idempotent by filter —
a second call on an already-revoked session simply doesn't match, safely
classified as `SESSION_ALREADY_REVOKED` rather than an error. No plaintext
token or refresh-token presence is required. Result codes (aligned to the
§14 taxonomy): `REVOKED_CURRENT_FAMILY` (this call performed the revoke),
`SESSION_ALREADY_REVOKED`, `SESSION_MISSING` (covers both "never existed"
and "belongs to a different subject," indistinguishable in the response
for the same anti-enumeration reason §22/§29 apply elsewhere),
`STORAGE_FAILURE`.

## 10. All-family (logout-all) revocation design

_(Preserved from the original pass, with one addition: explicit
cross-reference to §8's corrected ordering — the `tokenVersion` bump this
section's caller performs must complete, per §7's Strategy B, before this
`updateMany` runs, not concurrently with it or after it.)_

Filter: `{subjectType: realm, subjectId: subjectId, revokedAt: null}`.
`updateMany` is explicitly endorsed by §21 as the correct, non-transactional
primitive. Historical replay-revoked (or any other already-revoked)
sessions are preserved by construction — the `revokedAt: null` clause
never matches them, so `revokeReason` is never overwritten. Returned
counts are for internal observability only (§17), never in a public
response, for the same reason a public response never confirms whether a
given session existed at all. **Cleanup failure does not restore old-token
validity once the tokenVersion bump (§8) has committed** — restated here
explicitly per the task's requirement, and true precisely because §7's
Strategy B makes the bump, not this sweep, authoritative. Result codes
(aligned to the §14 taxonomy): `REVOKED_ALL_FAMILIES` (the sweep
completed, including the zero-matched case — zero active sessions to
revoke is a normal, successful outcome, not an error), `REVOCATION_PARTIAL`
(the `updateMany` itself failed after the authoritative `tokenVersion`
bump already committed — logged as an internal alert, never surfaced as a
failure of the overall event, per §8/§10's ordering).

## 11. Refresh eligibility design, corrected with mandatory post-rotation revalidation

**Steps 1–8, unchanged from the original pass** — pure composition of
already-accepted SEC-3B/3C primitives (`JwtSessionProvider.verifyRefreshToken`,
a plain `RefreshSession.findById`, `subjectType`/`subjectId` binding
checks, `SessionSubjectStateProvider.getSubjectState`, and
`RefreshSessionRotationService.rotate()`), composed as one new dormant
coordinator, still unwired.

### 11.1 The race, and why steps 1–8 alone do not close it

Concrete sequence: (1) refresh JWT and session both verify; (2) the
coordinator's subject-state read (step 6/7) observes `tokenVersion=5`,
matching; (3) **concurrently**, an admin action (§8) bumps the subject's
`tokenVersion` to 6; (4) the coordinator calls `rotate()` (step 8); its
CAS filter conditions on `RefreshSession`-side state (`currentTokenHash`,
`revokedAt`, `expiresAt`, and optionally `tokenVersionAtIssue` — all
session-document fields) — **none of which change when the subject
document's `tokenVersion` changes elsewhere** — so the CAS succeeds,
having been evaluated against the subject state observed at step 2, now
stale. The coordinator would, absent a further check, construct and
return a successor access+refresh pair stamped with the stale
`tokenVersion=5`.

**Severity, stated honestly**: this audit's own analysis (not present in
the original pass) finds the resulting stale-versioned successor pair is
self-limiting even without a fix — the very next use of either token
re-triggers a fresh, uncached read (§24 for access, §22 step 5 for
refresh) that would immediately reject the stale claim and, per §22 step
5's own text, revoke the session on that next attempt. The exposure is
bounded to at most one issued-but-effectively-unusable pair.

### 11.2 Selected mechanism — post-rotation authoritative revalidation

**Step 8 (new, mandatory)**: immediately after the rotation CAS (step 7)
returns `ROTATED`, and **before** constructing or returning any token to
the caller, perform one more `SessionSubjectStateProvider.getSubjectState`
read (same primitive as steps 5/6, no new dependency) with
`expectedTokenVersion` set to the value observed at step 5/6. Two
outcomes:

- **Match (`SUBJECT_ACTIVE`, same version)**: proceed to issue the
  successor pair (step 10) — the window between the CAS and this reread
  is a single in-process step with no further I/O in between, as tight as
  achievable without a cross-document transaction (§7, Strategy A
  rejected).
- **Mismatch (`TOKEN_VERSION_MISMATCH`, `SUBJECT_INACTIVE`, or
  `SUBJECT_MISSING`)**: the CAS already committed and cannot be undone
  without a transaction — the coordinator instead **conditionally revokes**
  the just-rotated family (step 9), reusing §9's single-family revoke
  primitive with a filter conditioned on the exact state the CAS just
  wrote (the same "condition the write on the exact state just observed"
  pattern already used by `RefreshSessionRotationService.classifyMiss`'s
  replay-revoke, so a second, genuinely-concurrent legitimate rotation
  racing against this cleanup is not itself clobbered). The internal
  cleanup outcome is classified separately from what is returned to the
  caller: `ROTATED_FAMILY_REVOKED` (the conditional revoke matched and
  committed) or `ROTATED_FAMILY_CLEANUP_FAILED` (the revoke's own filter
  no longer matched, or a storage error occurred — logged as an internal
  alert, never surfacing as a different externally-visible outcome, since
  the caller-facing result is identical either way). The caller-facing
  result code, in both cleanup sub-cases, is `REFRESH_FINAL_STATE_MISMATCH`
  — with **no token of any kind**, mapping externally to the same generic
  401 every other refresh-rejection path already uses.

**Rejected alternatives, per the task's explicit list**:

- **"Subject mutation updates session documents first"**: rejected,
  exactly per the task's own flagged concern — this would make the
  subject-side mutation's correctness depend on the best-effort,
  eventually-consistent multi-document `RefreshSession` sweep (§10)
  having already run, which §21 explicitly forbids treating as the
  primary enforcement path.
- **Transaction across subject and session**: assessed, not required —
  §7's Strategy A analysis applies identically here (no verified replica
  set, would import an infrastructure dependency the rest of SEC-3D
  deliberately avoids).

**Dependencies**: no new primitive beyond one additional call to
`SessionSubjectStateProvider` (already built, SEC-3C) and §9's revoke
primitive (SEC-3D.1). **Result codes**: adds `REFRESH_ELIGIBLE` (steps
1–6 passed, the internal state immediately before attempting rotation),
`REFRESH_ROTATED` (the coordinator's own external success code — the CAS
rotated **and** the step-8 reread confirmed the version is still current,
distinct from SEC-3B's internal `ROTATED`, which reflects only the CAS
write itself), `REFRESH_FINAL_STATE_MISMATCH`, `ROTATED_FAMILY_REVOKED`,
and `ROTATED_FAMILY_CLEANUP_FAILED` to the taxonomy (§14). **Can this
read be cached?** No — same "never uses Redis, always fresh" rule as
every other subject-state read in this architecture (§22's own text).

### 11.3 Residual race — corrected, achievable guarantee (replaces the SEC-3D-A.1 pass's absolute claim)

**Correction.** The SEC-3D-A.1 pass stated the task's "must never return
a stale successor credential" instruction "as absolute, not merely
'acceptable because it self-heals,'" and characterized §11.2's reread as
closing the race outright. **This overstated what a non-transactional
design can guarantee, and is corrected here.**

**The exact achievable model.** The full coordinator sequence is:

1. Cryptographically verify the refresh JWT.
2. Validate required claims (type, issuer, audience, realm, `sid`, `jti`,
   `tokenVersion` shape).
3. Load and bind the `RefreshSession` family (`subjectType`/`subjectId`
   match, §19A).
4. Validate session state (`revokedAt`, `expiresAt`) and
   `tokenVersionAtIssue`.
5. Authoritatively read subject state.
6. Require active state and matching `tokenVersion`.
7. Perform the single-family rotation CAS.
8. Authoritatively reread subject state before signing or returning
   tokens (§11.2's new step).
9. On a step-8 mismatch: return no token; conditionally revoke the
   rotated family where the revoke's own filter still matches; normalize
   any cleanup-write failure to an internal alert, never surfaced
   externally.
10. On step-8 success: issue tokens carrying the version validated at
    step 8.

**An authoritative invalidation event can still commit after step 8's
read and before, or during, delivery of the HTTP response carrying the
successor tokens.** No finite number of additional rereads closes that
interval — each additional reread merely moves the same irreducible
window one step later; only a mechanism that holds the subject and
session state locked for the entire remainder of the request (a
transaction, or an equivalent cross-document lock) removes it entirely,
and §7 already establishes that dependency is not available on this
repository's current topology and is not recommended. This is stated here
as a property of any non-transactional design, not a defect specific to
this coordinator.

**The distinction the task requires, made explicit**:

- **A stale credential's bytes may, in this narrow residual window, still
  be delivered to a client** — this cannot be reduced to zero without a
  stronger synchronization mechanism than this design uses.
- **A stale credential is never _accepted for use_ after the invalidating
  event is visible to the enforcement paths that check it** — because
  every subsequent access request re-reads authoritative `tokenVersion`/
  `accountStatus` fresh (§24, no cache, this design's access-authorization
  coordinator, §12), and every subsequent refresh attempt re-reads the
  same authoritative state fresh (§22 step 5, unchanged, already
  accepted). A successor pair delivered in the residual window is
  therefore, at most, a bundle of bytes that reaches the client but fails
  its very next authorization check — structurally the same bounded,
  self-limiting exposure already described for the pre-§11.2 race, now
  narrowed to a single response-delivery interval instead of the whole
  original window between steps 5/6 and 8.

**The enforceable target, restated precisely**: **zero stale-positive
authorization** — no superseded credential is ever _accepted_, at any
point after its invalidating event becomes visible to the read paths that
gate authorization and refresh. This is not the same claim as "no
superseded credential bytes can ever reach a client," which is not
achievable by this or any non-transactional design and is not what §24's
own text actually requires — §24 states the guarantee in terms of
**enforcement** delay ("Maximum invalidation delay... ~0, this request
onward"), which is the zero-stale-positive-authorization property, not a
claim about response-delivery timing. **This audit finds the accepted
architecture does not require the stronger, unachievable property**, and
therefore does not return `NOT READY` on this point — the corrected,
precisely-scoped guarantee above is what §11.2's mechanism actually
delivers, and it satisfies §24 as written.

## 12. Access authorization design, corrected

**Authoritative reads**: subject state only —
`SessionSubjectStateProvider.getSubjectState` with `expectedTokenVersion`
set to the access claim's value. Unchanged conclusion from the original
pass, re-justified: §24's text defines Option A purely in terms of
subject `tokenVersion`/`accountStatus`, with no mention of consulting
`RefreshSession` — adding that read would be unauthorized scope
expansion, identically to why Option A was rejected in §4.

**Session-family read**: **not** required per access request, for the
same reason.

**Denylist dependency — corrected.** The original pass's access-
authorization coordinator implicitly leaned on the denylist as an already-
adequate second layer without the qualification §3/§4 now require. The
corrected position: the dormant SEC-3D access-authorization coordinator
itself depends on **subject state only** and says nothing about the
denylist at all — composing the denylist check with the subject-state
check at the actual `requireAuth`-equivalent middleware layer is
explicitly **SEC-3E's live-wiring job** (§2.1's divergence note, §18),
not something a dormant SEC-3D coordinator decides or performs. This
report documents the target composition (§4's conclusion: both checks,
layered, denylist hardened per §4) as the intended **eventual** behavior,
without claiming SEC-3D itself builds or activates it.

- **Current-family logout**: per §4 — immediate, once the denylist is
  hardened (Redis-mandatory); today, best-effort/legacy-grade, matching
  already-disclosed F-H2, not a new gap.
- **Logout-all/password/suspension/role change**: immediate via
  `tokenVersion`, next request onward, once SEC-3E's Option A enforcement
  is live — never depended on the denylist.
- **Storage failure**: `SessionSubjectStateProvider` already returns
  `STORAGE_FAILURE` distinctly, fail-closed, unchanged.

**This section is now conditionally, not unconditionally, "resolved"**:
the _design_ is fully specified and requires no further architecture
correction, but its _completion_ (a fully hardened, always-available
denylist) is explicitly deferred beyond SEC-3D's own scope, and this
report no longer implies otherwise.

### 12.1 Mandatory denylist production-hardening contract (SEC-3D-A.2, new)

The SEC-3D-A.1 pass concluded Option D "hardened" was the target design
but stated the hardening only as a one-paragraph conclusion. The complete
gate, required before the denylist may be trusted as the current-session-
logout mechanism in production, is defined here in full — **this is a
SEC-3E/production-activation contract, not something any SEC-3D slice
builds or enforces**:

- **A shared, durable store (Redis, or another explicitly approved
  equivalent) is mandatory in production** — not optional, not
  "strongly recommended."
- **Server startup fails closed** when the store is missing or
  unreachable — the same hard-fail discipline `validateEnv.js` already
  applies to `JWT_SECRET`/`REFRESH_SECRET` (§18B), extended to this store.
- **No process-local `Map` fallback path may exist in the production
  code path at all** — not merely "discouraged," the fallback branch
  itself must not be reachable once this gate is active; this is stronger
  than today's `config/redis.js`, which silently and permanently falls
  back rather than failing.
- **Every application instance reads and writes the same store** — a
  direct consequence of the above, verified as part of SEC-3F's
  multi-instance acceptance testing (§30's existing "verified
  multi-instance deployment test" requirement already names this
  category of check).
- **Access middleware checks the denylist after cryptographic
  verification and before authorization success** — checking a revoked-
  but-cryptographically-valid token's denylist status only makes sense
  once the signature/claims are already known good; checking it first
  would waste a store round-trip on garbage tokens that fail verification
  anyway.
- **Storage failure fails closed** — an unreachable store on a live
  request must reject the request, not silently treat it as "not
  denylisted." This is already the _existing_ live behavior for an
  in-flight Redis error (§3, re-confirmed) and must be preserved, not
  weakened, once the store is made mandatory.
- **Key material is a safe token identifier — `jti` — never the raw
  access token or a hash derived from it.** This is a correction from the
  existing legacy implementation, which keys on `sha256(rawToken)`
  (`tokenStore.js`, `hashToken`). `jti` is already a claim embedded in
  every access token (§19A, SEC-3B, unchanged) — using it directly avoids
  re-hashing the whole token on every denylist write and read, and is a
  strictly narrower piece of information than the token itself.
- **No `jti` (or any other token-derived identifier) appears in logs or
  public error results** — consistent with every other safe-result
  convention already established across SEC-3B/3C/3D.
- **TTL is derived from the token's own verified remaining lifetime
  (`exp - now`), never a hardcoded constant.** Corrects the existing
  legacy implementation's hardcoded `60 * 60` (`tokenStore.js:36`, §3) —
  a real, if narrow, drift risk today if `JWT_EXPIRES_IN` is ever changed
  from its 1-hour default without a corresponding edit to that literal.
  Deriving the TTL from the already-verified token's own `exp` claim
  removes the duplicated-constant risk entirely and, as a side effect,
  means an already-near-expiry token consumes a correspondingly short-
  lived denylist entry rather than a full hour regardless of actual
  remaining lifetime.
- **An already-expired token requires no denylist entry at all** — it is
  already rejected by expiry-checking before the denylist is even
  relevant; writing one would be pure waste.
- **Repeated insertion of the same identifier is idempotent** — a second
  logout call (or a retried one) writing the same `jti` with the same or
  a shorter remaining TTL produces no different outcome than the first;
  no special-casing is needed since a key overwrite with an equal-or-
  shorter TTL is already safe by construction.
- **Current-session logout does not report success to the client until
  both** the session-family revoke (§9) has reached its defined terminal
  result **and** the denylist write has succeeded — a response claiming
  "logged out" while either half is still pending or has failed would be
  a false positive about the actual security state.
- **Partial failure (one half succeeds, the other fails) has an explicit
  fail-closed response and a distinct security-event classification** —
  logged and surfaced as a genuine anomaly, not silently downgraded to a
  generic success, and not silently downgraded to a generic failure that
  discards which half actually failed.
- **Redis eviction and persistence policy must be assessed before
  production** — a `maxmemory-policy` that evicts keys before their TTL
  under memory pressure (e.g., an `allkeys-lru`/`allkeys-lfu` policy
  shared with unrelated cache usage) would silently reintroduce exactly
  the "token no longer denylisted" failure mode this whole gate exists to
  close; this is an infrastructure/configuration review item, not a code
  change, and is named here as a required check, not performed by this
  audit.
- **Infrastructure acceptance belongs to SEC-3F/SEC-3G**, consistent with
  every other real-infrastructure verification named throughout this
  engagement (§16) — this audit defines the contract; it does not verify
  a live deployment against it.

**Explicitly clarified, restating §12's own conclusion for emphasis**:
the dormant SEC-3D access-authorization coordinator (§12, SEC-3D.4) does
**not** use the denylist in any form — it depends on subject state only.
SEC-3E is where the hardened denylist (once built) and the subject-state
coordinator are composed together into the live `requireAuth`-equivalent
check. The existing optional-Redis/`Map` implementation
(`tokenStore.js`/`config/redis.js`, §3) is legacy-only and, as it stands
today, **does not satisfy this gate** — every bullet above names a
specific, currently-unmet property.

### 12.2 Final access-request sequence (post-SEC-3E, for reference — not built by any SEC-3D slice)

1. Verify the access JWT cryptographically.
2. Validate algorithm allowlist, issuer, audience, token type, realm,
   `sub`, `sid`, `jti`, and `tokenVersion` shape (§19A, unchanged,
   already built in SEC-3B).
3. Check the mandatory shared denylist using `jti` (§12.1).
4. Fail closed on denylist storage failure.
5. Authoritatively load subject `accountStatus` and `tokenVersion`
   (`SessionSubjectStateProvider`, already built in SEC-3C, composed by
   the SEC-3D.4 coordinator).
6. Require an active account.
7. Require the current `tokenVersion` to equal the claim's `tokenVersion`.
8. Authorize only once every prior step has passed.

**Confirmed properties of this sequence**: no process-local correctness
fallback (once §12.1's gate is met); no stale-positive cache (§24, Option
A, unchanged); no `RefreshSession` family read on any access request
under the selected Option D design (§4, §12 — unchanged conclusion);
current-family logout relies on the hardened denylist (step 3);
logout-all/password-reset/suspension/role changes rely on `tokenVersion`
(steps 5–7), never on the denylist; account deletion is caught at step 5
returning `SUBJECT_MISSING`, since the document no longer exists (§8.4).

## 13. Authoritative account-state projection requirements

_(Preserved from the original pass — no contradiction found.)_
`SessionSubjectStateProvider`'s current exact projection
(`{tokenVersion:1, accountStatus:1}`) remains sufficient for both refresh
eligibility (§11) and access authorization (§12), including the new
post-rotation reread (§11.2), which reuses the identical projection. No
additional field (`role`, `permissions`, `mustChangePassword`,
`emailVerified`, employer verification state) is required or recommended;
none of them ever need to invalidate an already-issued token, only affect
behavior the next time a dedicated, already-existing live check runs.

## 14. Failure, idempotency and retry taxonomy — complete, SEC-3D-A.2

Every code below is internal to the dormant SEC-3D services this report
designs, unless marked otherwise. No safe result exposes an access token,
refresh token, token hash, `sid`, `jti`, subject ID, email, a
`tokenVersion` value in a public-facing failure, a raw MongoDB/Redis
error, or signing material — this repeats, and does not weaken, the
discipline already established across every SEC-3B/3C module.

### 14.1 Input and subject state

| Code                    | Meaning                                                                                                         | Retry-safe?                             | Future HTTP mapping              | Internal only?     | Cleanup/reconciliation?           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------- | ------------------ | --------------------------------- |
| `INVALID_INPUT`         | Caller-supplied shape failed validation before any model call                                                   | Yes, after correcting the input         | 400                              | No — caller-facing | No                                |
| `SUBJECT_MISSING`       | No subject document matches the given ID                                                                        | Yes (idempotent — reread confirms)      | 401 (generic, anti-enumeration)  | Yes                | No                                |
| `SUBJECT_INACTIVE`      | Subject exists, `accountStatus` is `'suspended'`                                                                | Yes                                     | 401 (generic)                    | Yes                | No                                |
| `SUBJECT_STATE_INVALID` | Subject exists, `accountStatus` is neither `'active'` nor `'suspended'` — fails closed, never treated as active | Yes                                     | 401 (generic)                    | Yes                | No                                |
| `STORAGE_FAILURE`       | The underlying read/write itself errored (not a business-logic rejection)                                       | Caller-dependent — see §8.5.1 per event | 503 or generic 401 per call site | Yes                | Depends on which operation failed |

### 14.2 Session-family revocation (§9, §10)

| Code                       | Meaning                                                                                                                                                                                         | Retry-safe?                                                     | Future HTTP mapping                                                                        | Internal only?       | Cleanup/reconciliation?                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------ |
| `REVOKED_CURRENT_FAMILY`   | Single-family revoke matched and committed                                                                                                                                                      | Yes (idempotent by filter)                                      | 200 (logout's own success shape)                                                           | No — caller-facing   | No                                                                                   |
| `SESSION_ALREADY_REVOKED`  | Filter found the family already revoked — a repeat logout, not an error                                                                                                                         | Yes                                                             | 200 (same success shape as above — never distinguished externally, §9)                     | No — caller-facing   | No                                                                                   |
| `SESSION_MISSING`          | No `RefreshSession` document matches `_id`+`subjectType`+`subjectId` — covers both "never existed" and "belongs to a different subject," indistinguishable by design (§22/§29 anti-enumeration) | Yes                                                             | 401 (generic) — or 200 for logout's own idempotent-success framing, depending on call site | Yes                  | No                                                                                   |
| `SESSION_EXPIRED`          | Family found, not revoked, but past `expiresAt`                                                                                                                                                 | Yes                                                             | 401 (generic)                                                                              | Yes                  | No — TTL index reaps it independently                                                |
| `SESSION_SUBJECT_MISMATCH` | Family found, but `subjectType`/`subjectId` does not match the authenticated caller's own claims (§11 binding step)                                                                             | No — this is a hard rejection, never retried                    | 401 (generic)                                                                              | Yes                  | No                                                                                   |
| `SESSION_VERSION_MISMATCH` | Family's `tokenVersionAtIssue` no longer matches the subject's current `tokenVersion` (§22 step 5-equivalent check reused here)                                                                 | No                                                              | 401 (generic)                                                                              | Yes                  | Positively-identified mismatches additionally revoke the session (§22)               |
| `REVOKED_ALL_FAMILIES`     | All-family sweep completed, including the zero-matched case                                                                                                                                     | Yes (idempotent — `updateMany` re-matches fewer/zero documents) | N/A — internal completion signal                                                           | Yes                  | No                                                                                   |
| `REVOCATION_PARTIAL`       | The all-family `updateMany` itself failed, **after** the authoritative `tokenVersion` bump already committed                                                                                    | Yes (safe to retry the sweep alone)                             | N/A — never surfaces as event failure (§7, §10)                                            | Yes (internal alert) | Yes — logged for reconciliation, does not block the primary event's reported success |

### 14.3 `tokenVersion` and subject-security mutation (§8) — final SEC-3D.2 result taxonomy, 15 codes

_(Replaces the original 6-code table in full — consolidated from the
SEC-3D.2-A2 through SEC-3D.2-A6.2 audit sequence. Every SEC-3D.2 public
result is exactly `{code}` — no `tokenVersion` value, subject ID, realm,
password, password hash, reset token, model document, raw error, stack,
filter, update, collection name, or SEC-3D.1-style `matchedCount`/
`modifiedCount`/`revokedCount` ever appears in any SEC-3D.2 result; every
SEC-3D.2 write is a single `findOneAndUpdate` — document-or-null — never
`updateMany`, so no count-bearing result concept applies here at all.)_

| Code | Meaning | Reachable operations | Mutation occurred | Retry-safe? | Terminal? |
| --- | --- | --- | --- | --- | --- |
| `VERSION_INCREMENTED` | A tokenVersion-focused conditional write succeeded | logout-all, admin-revoke, password change, password reset | Yes | N/A — success | Yes |
| `VERSION_ALREADY_ADVANCED` | Any advancement beyond the observed expected version already satisfies the token-invalidation objective; no second increment is performed | logout-all, admin-revoke **only** | No | Yes — idempotent success | Yes |
| `VERSION_CONFLICT` | The password-change objective cannot be proven after its conditional write miss, including the case where `current == expected` after the miss | password change **only** | No | No — caller must resubmit as a fresh request | Yes |
| `VERSION_REGRESSION` | A well-formed stored `tokenVersion` is lower than a previously-authoritative observation — a monotonicity-invariant violation, distinct from malformation | logout-all, admin-revoke, password change | No | No — alert-worthy anomaly | Yes |
| `SUBJECT_STATE_UPDATED` | The requested `accountStatus`/`role` transition occurred; no claim is made about whether `tokenVersion` also changed | suspend, reactivate (either mode), role change | Yes | N/A — success | Yes |
| `SUBJECT_STATE_ALREADY_APPLIED` | The requested target `accountStatus`/`role` was already present | suspend, reactivate, role change | No | Yes — idempotent success | Yes |
| `SUBJECT_STATE_CONFLICT` | A valid, authoritative state differs from both the caller's expected prior state and the requested target | role change (live path); suspend/reactivate defined for forward-compatibility, structurally unreachable under the current two-value `accountStatus` enum | No | No | Yes |
| `SUBJECT_STATE_INVALID` | Stored `accountStatus`/`role` lies outside its accepted schema enum or type — reuses the existing checkpointed SEC-3C code/concept (`SessionSubjectStateProvider.js`) | suspend, reactivate (either mode), role change | No | No — alert-worthy anomaly | Yes |
| `SUBJECT_STATE_MALFORMED` | Stored `tokenVersion` fails the numeric well-formedness guard (§8.1) — scoped **narrowly** to `tokenVersion` only; never returned for a malformed `accountStatus`/`role`, and does not represent a valid monotonicity regression | logout-all, admin-revoke, password change, suspend, reactivate Mode B, role change | No | No — alert-worthy anomaly | Yes |
| `VERSION_EXHAUSTED` | Stored `tokenVersion` is well-formed and exactly `Number.MAX_SAFE_INTEGER` | same set as `SUBJECT_STATE_MALFORMED` | No | No — alert-worthy anomaly | Yes |
| `RESET_TOKEN_INVALID` | The password-reset write did not match, for any reason — the public result deliberately does not distinguish invalid/expired/consumed token, malformed `tokenVersion`, exhausted `tokenVersion`, or missing subject | password reset **only** | No | Yes (caller may retry with a fresh token) | Yes |
| `SUBJECT_MISSING` | An `_id`-addressed subject cannot be found | every `_id`-addressed operation; not reachable from token-only password reset | No | Yes (idempotent — reread confirms) | Yes |
| `CLASSIFICATION_STALE` | The retrying operation exhausted its one-read/one-retry classification budget (§8.5.1, Policy B); the final post-retry state is intentionally unclaimed | logout-all, admin-revoke, suspend, reactivate (either mode), role change | No | No — caller may issue a wholly fresh operation | Yes |
| `INVALID_INPUT` | Caller-supplied input failed validation before any model or hashing access | every operation | No | Yes, after correcting the input | Yes |
| `STORAGE_FAILURE` | A model, hashing, or storage operation threw or rejected — does not expose whether an uncertain remote commit may have occurred | every operation | Unknown | No | Yes |


### 14.4 Refresh coordination (§11)

| Code                            | Meaning                                                                                                                                                               | Retry-safe?                                                               | Future HTTP mapping                  | Internal only?     | Cleanup/reconciliation?                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------- |
| `REFRESH_ELIGIBLE`              | Steps 1–6 passed — internal state immediately before attempting the rotation CAS, not typically returned to an external caller since the flow continues automatically | N/A — internal marker                                                     | N/A                                  | Yes                | No                                                                                    |
| `REFRESH_ROTATED`               | The coordinator's own external success code — CAS rotated **and** the step-8 reread confirmed the version is still current                                            | N/A — this is success                                                     | 200, new token pair issued           | No — caller-facing | No                                                                                    |
| `REFRESH_FINAL_STATE_MISMATCH`  | Step-8 reread found a version/status change since steps 5–6 — no token is returned even though the CAS itself already committed (§11.2/§11.3)                         | No — the caller must obtain a fresh refresh token via a new login/session | 401 (generic) — no token of any kind | Yes                | Triggers `ROTATED_FAMILY_REVOKED`/`ROTATED_FAMILY_CLEANUP_FAILED` internally          |
| `ROTATED_FAMILY_REVOKED`        | Internal sub-classification: the post-rotation conditional revoke (§11.2) matched and committed                                                                       | N/A — internal                                                            | N/A                                  | Yes                | No — this _is_ the cleanup                                                            |
| `ROTATED_FAMILY_CLEANUP_FAILED` | Internal sub-classification: the conditional revoke's own filter no longer matched, or errored                                                                        | N/A — internal alert                                                      | N/A                                  | Yes                | Yes — logged, does not change the caller-facing `REFRESH_FINAL_STATE_MISMATCH` result |
| `CLASSIFICATION_STALE`          | Existing (SEC-3B, `RefreshSessionRotationService`), reused unchanged — a guarded replay-revoke lost its own race against a legitimate concurrent rotation             | Yes                                                                       | 401 (generic)                        | Yes                | No                                                                                    |

### 14.5 Access authorization (§12)

| Code                      | Meaning                                                                                                                                   | Retry-safe?                                | Future HTTP mapping         | Internal only?                  | Cleanup/reconciliation? |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------- | ------------------------------- | ----------------------- |
| `ACCESS_AUTHORIZED`       | Every check in §12.2's sequence passed                                                                                                    | N/A — success                              | 200-class, request proceeds | No — caller-facing (as success) | No                      |
| `ACCESS_DENYLISTED`       | The mandatory shared denylist matched the presented `jti` (§12.1 — SEC-3E-composed, not built by the dormant SEC-3D.4 coordinator itself) | No                                         | 401 (generic)               | Yes                             | No                      |
| `ACCESS_SUBJECT_INACTIVE` | Authoritative `accountStatus` is not `'active'`                                                                                           | No                                         | 401 (generic)               | Yes                             | No                      |
| `ACCESS_VERSION_MISMATCH` | Authoritative `tokenVersion` does not equal the claim's `tokenVersion`                                                                    | No                                         | 401 (generic)               | Yes                             | No                      |
| `ACCESS_STORAGE_FAILURE`  | The authoritative subject-state read itself failed                                                                                        | No — fails closed, never defaults to allow | 503 or generic 401          | Yes                             | No                      |

**Idempotency summary, corrected and complete** (replacing the original
pass's blanket "double-increment is availability-only" claim, the
SEC-3D-A.1 pass's narrower "only the accountStatus/role cases need a
filter" claim, and an intermediate draft's overstated "logout-all and
admin-revoke are identically idempotent" claim): every `tokenVersion`-
incrementing mutation, without exception, is idempotent-by-filter (§8.5,
§8.5.1) — no operation in this design can silently reverse an intervening
legitimate change once its filter is applied. This does **not** mean
every operation is idempotent across *sequential, separately-authorized*
invocations in the same sense: logout-all is, because its
`expectedTokenVersion` is a caller-held, invocation-independent claim;
admin-revoke is not generally, because its `expectedTokenVersion` is a
fresh per-invocation preread (§8.5) — both are equally safe (extra
increments are harmless), but only logout-all's repeated-request behavior
collapses to a single effective increment. Suspend/reactivate/role-change
bind no `tokenVersion` equality clause at all, preserving different-event
concurrency (§8.3). Any retry that exhausts its one bounded attempt
without resolving returns `CLASSIFICATION_STALE` rather than a precise
but unproven result (§8.5.1).

## 15. Index and query readiness

_(Preserved from the original pass — no contradiction found.)_
`autoIndex: false`/`autoCreate: false` confirmed on `RefreshSession`;
every required query pattern (lookup by `sid`, active-sessions-by-subject,
TTL cleanup, replay-family lookup, hash uniqueness) already has a
corresponding schema-level index definition; no live index has ever been
created in this engagement; none is required before SEC-3D ships, only
before SEC-3E/3F activation.

## 16. Database topology and testing readiness

_(Preserved from the original pass — no contradiction found; the
topology finding is what drove §7/§11.2's rejection of a transaction-based
alternative.)_ Local/CI Mongo is standalone, no replica set; production's
topology is an unverifiable operator secret; the existing model-double
convention (used throughout SEC-3B/3C, and sufficient for every new
service this report designs, including the state-conditioned CAS filters
and the post-rotation reread) fully supports unit-level proof of every
design in this report without a live database connection.

## 17. Security event and observability requirements

_(Preserved from the original pass, with the full §14 result-code set
added to the "never included" discipline — access token, refresh token,
token hash, `sid`, `jti`, subject ID, email, a `tokenVersion` value, raw
database error, signing material never appear in any event's metadata,
including the events below.)_

| Event                                                                                                  | Safe metadata                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUBJECT_STATE_CONFLICT` / `VERSION_CONFLICT` (a state-conditioned mutation lost its CAS, §8.5, §14.3) | `realm`, event type, timestamp — informational, not necessarily a security event (most often a benign concurrent-admin race)                                                                                                                                   |
| `VERSION_ALREADY_ADVANCED`                                                                             | `realm`, event type, timestamp — informational; confirms the invalidation objective was already met by a concurrent event                                                                                                                                      |
| `VERSION_EXHAUSTED`                                                                                    | `realm`, event type, timestamp — genuine anomaly, alert severity (§8.1, §14.3)                                                                                                                                                                                 |
| `REFRESH_FINAL_STATE_MISMATCH`                                                                         | `realm`, event type, timestamp — should be logged at a higher severity than an ordinary refresh rejection, since it indicates a real (if narrow, self-limiting) race actually occurred in production (§11.2, §11.3)                                            |
| `ROTATED_FAMILY_CLEANUP_FAILED`                                                                        | `realm`, event type, timestamp — alert severity, reconciliation candidate                                                                                                                                                                                      |
| `REVOCATION_PARTIAL`                                                                                   | `realm`, event type, timestamp, affected-count (not which sessions) — alert severity, reconciliation candidate (§10)                                                                                                                                           |
| `ACCESS_DENYLISTED`                                                                                    | Not typically an individually-logged security event on its own (a routine, expected rejection once the denylist is live, §12.1) — high-volume, so left to the SEC-3E-composed middleware's own general request logging rather than a dedicated per-event entry |

The existing `logAudit`/`auditService.js` sink, already wired into every
admin mutation site inspected in §2.4 above, remains the
correct reuse target — SEC-3D's services should return enough safe
metadata for a future SEC-3E-wired caller to log through it; SEC-3D does
not build a new logging subsystem.

## 18. Proposed bounded implementation slices — corrected, fully dormant

**Correction applied per §2.1's divergence note and §5.4/§8**: every
slice below is new-files-only, matching the SEC-3B/3C pattern exactly.
**No slice edits an existing controller, route, or middleware file.** All
wiring of `tokenVersion` bumps into existing suspend/delete/role-change/
password handlers, all wiring of the new logout-current/logout-all
services into the live logout routes, all denylist-hardening work, and
all access-middleware/refresh-route changes are deferred to **SEC-3E**,
not any SEC-3D slice.

### SEC-3D.1 — Dormant single-family and all-family revocation services

- **Goal**: §9's single-family revoke primitive and §10's all-family
  sweep, as one new service (or an additive export in
  `RefreshSessionRotationService.js`), plus result-code contracts.
- **Allowed files**: one new service file, one new or additively-extended
  contracts file, new unit tests only.
- **Prohibited files**: anything under `controllers/`, `routes/`,
  `middleware/`, and every existing model/service file except the
  additive contracts export noted above.
- **Dependencies**: none (first slice).
- **Tests**: idempotent double-revoke, cross-subject/cross-realm
  rejection, missing-`sid` rejection, all-family filter never touching an
  already-revoked-for-a-different-reason document, safe result shape.
- **Database needed**: No — model double.
- **Stop conditions**: any change to an existing live route/controller/
  middleware.
- **Dormancy proof**: grep for the new service's name across
  `controllers/`, `routes/`, `middleware/`, `index.js`, `worker.js` —
  zero matches required.

### SEC-3D.2 — Dormant bounded tokenVersion and atomic subject-security mutation primitives

- **Goal**: the hardened `validTokenVersionExpr` nested-`$cond` guard
  (§8.1); two **distinct** tokenVersion-only method contracts,
  `incrementTokenVersionForLogoutAll`/`incrementTokenVersionForAdminRevoke`
  (§8.5); the **selected Design B** pre-hashed conditional-update contract
  for password change, User-only (§8.2); the Design-1 single-write
  reset-token-gated contract for password reset, User-only (§8.2); the
  state-conditioned `findOneAndUpdate` contracts for suspend (User and
  Employer), the two explicit reactivation modes (§5.1/§8.3), and role
  change (User-only, §8.3); the frozen classification-precedence order and
  the `CLASSIFICATION_STALE` retry-miss policy (§8.5.1); the 15-code
  result taxonomy (§14.3); and the deletion non-requirement documented
  (§8.4) as a design note only (deletion itself is not touched by this
  slice — `deleteUser` remains unmodified, per the dormancy rule).
- **Exact new files**:
  `server/src/services/auth/AccountSecurityMutationContracts.js`,
  `server/src/services/auth/AccountSecurityMutationService.js`,
  `server/src/__tests__/accountSecurityMutation.test.js`,
  `docs/STRIDETO_SEC_3D_2_DORMANT_ACCOUNT_SECURITY_MUTATION_REPORT.md` —
  filenames frozen, not left as "one or two files, for example."
- **Allowed existing-file changes**: `User.js`/`Employer.js` — **additive
  only**: the `max: Number.MAX_SAFE_INTEGER` validator (§8.1) and nothing
  else — **not** `optimisticConcurrency: true`, which §8.2 explicitly
  rejected as too wide a blast radius for a dormant phase.
- **Prohibited files**: `controllers/`, `routes/`, `middleware/`,
  `startup/`; any non-additive change to `User.js`/`Employer.js`;
  `RefreshSessionContracts.js`, `RefreshSessionRotationService.js`,
  `SessionSubjectStateProvider.js`, `SessionFamilyRevocationContracts.js`,
  `SessionFamilyRevocationService.js` (SEC-3B/3C/3D.1 files, unmodified);
  `utils/tokenStore.js`, `config/redis.js`; `client/`, `mobile/`; package
  manifests, lockfiles, environment files, deployment files.
- **Dependencies**: none required at runtime — confirmed, no SEC-3D.2
  production code imports `SessionFamilyRevocationService` — though
  SEC-3D.1's revoke primitive may be referenced by this slice's own tests
  for end-to-end scenario coverage.
- **Tests**: every malformed-`tokenVersion` value against
  `validTokenVersionExpr` (missing, `null`, string, array, object,
  negative, fractional, `NaN`, `±Infinity`, greater-than-maximum) proven
  rejected without throwing, plus exactly-maximum classified
  `VERSION_EXHAUSTED` and every safe non-negative integer below it
  accepted; the complete §8.5.1 event-idempotency matrix reproduced
  against doubles, event by event, including `VERSION_INCREMENTED`,
  `VERSION_ALREADY_ADVANCED` (logout-all/admin-revoke only),
  `VERSION_CONFLICT`, `VERSION_REGRESSION`, `SUBJECT_STATE_UPDATED`,
  `SUBJECT_STATE_ALREADY_APPLIED`, `SUBJECT_STATE_CONFLICT` (role change
  only, live), `SUBJECT_STATE_INVALID`, `SUBJECT_STATE_MALFORMED`,
  `CLASSIFICATION_STALE`; exact per-operation call-count assertions
  matching the §8.5.1 bounds table exactly (no third write, no second
  classification read, no unbounded retry); a classify-to-retry race,
  exercised via a model double capable of a deterministic state mutation
  between the classification read and the retry write, not merely between
  the primary write and the classification read; logout-all's
  concurrent-and-sequential duplicate collapse versus admin-revoke's
  concurrent-only collapse; both reactivation modes, including proof that
  Mode A never reads/guards/mutates `tokenVersion`; role-change's
  distinction between a valid-different-role conflict
  (`SUBJECT_STATE_CONFLICT`) and a malformed role
  (`SUBJECT_STATE_INVALID`); password-change/reset's hashing boundary
  (validation before hashing, cost 12, no plaintext/hash exposure, no
  `pre('save')` hook reliance, zero automatic retries for password
  change); explicit confirmation that no test in this slice depends on
  Mongoose `optimisticConcurrency`/`__v` behavior, since Design B does not
  use it; explicit confirmation every public result is exactly `{code}`.
- **Database needed**: No.
- **Stop conditions**: same as SEC-3D.1; additionally, any change to
  `User.js`/`Employer.js` beyond the single additive validator; any
  runtime import of SEC-3D.1.
- **Dormancy proof**: same grep pattern as SEC-3D.1; additionally confirm
  `User.js`/`Employer.js`'s diff contains only the one additive validator
  line per model.
- **Required regression suites**: `sessionFamilyRevocation.test.js`,
  `refreshSessionSchema.test.js`, `refreshTokenHash.test.js`,
  `jwtSessionProvider.test.js`, `refreshSessionRotation.test.js`,
  `authCookiePolicy.test.js`, `trustedRequestOriginPolicy.test.js`,
  `sessionSubjectStateProvider.test.js`, `auth.test.js`,
  `authRealm.test.js`, `employerAuthRealmIsolation.test.js`,
  `emailVerification.test.js`, `duplicateEmailUserIdIndexes.test.js`, plus
  the full safe test sweep, `npm run lint`, `npx prettier --check` on the
  new files, `git diff --check` — no database connection at any point.
- **Live-wiring owner**: SEC-3E exclusively — no route, controller,
  middleware, or startup file is touched by this slice.

### SEC-3D.3 — Dormant refresh-eligibility and post-rotation revalidation coordinator

- **Goal**: compose `JwtSessionProvider` + `RefreshSession` lookup +
  `SessionSubjectStateProvider` + `RefreshSessionRotationService` into
  one coordinator implementing §11's full 9-step ordering, **including
  the mandatory post-rotation reread (§11.2)** — this is the corrected
  scope; the original pass's 8-step version is superseded.
- **Allowed files**: one new coordinator service file, new unit tests
  only.
- **Prohibited files**: `controllers/`, `routes/`, `middleware/`,
  `authController.js`, `employerAuthController.js` — the live refresh
  routes are untouched by this slice.
- **Dependencies**: SEC-3D.1 (the post-rotation-mismatch path reuses its
  revoke primitive).
- **Tests**: every binding-mismatch case; every fail-closed case; the
  race scenario from §11.1 reproduced against doubles (a double whose
  subject-state read returns a different value on the second call than
  the first, simulating the concurrent bump) and confirmed to produce
  `REFRESH_FINAL_STATE_MISMATCH` with no token, plus both
  `ROTATED_FAMILY_REVOKED` and `ROTATED_FAMILY_CLEANUP_FAILED` sub-cases
  of the resulting cleanup attempt; pass-through of the rotation service's
  own outcomes (`ROTATED`, `CONFLICT_BENIGN`, `REPLAY_DETECTED`, etc.,
  unchanged from SEC-3B); an explicit test asserting the coordinator's own
  documentation/comments state the §11.3 residual-race property precisely
  (zero stale-positive _authorization_, not zero stale-credential
  _delivery_) rather than the overstated absolute claim corrected in this
  pass.
- **Database needed**: No.
- **Stop conditions**: any attempt to import this coordinator from
  `authController.refreshToken`/`employerAuthController.employerRefreshToken`.
- **Dormancy proof**: same grep pattern; additionally confirm no import
  from any route/controller file.

### SEC-3D.4 — Dormant access-authorization coordinator

- **Goal**: a coordinator implementing §12's subject-state-only contract.
  **Corrected scope: this slice builds only the dormant coordinator
  itself.** It does **not** touch the denylist, does not touch
  `middleware/auth.js`, and does not compose the two mechanisms live —
  that composition is documented as the target design (§4, §12) for
  SEC-3E to build, not performed here.
- **Allowed files**: one new coordinator service file, new unit tests
  only.
- **Prohibited files**: `controllers/`, `routes/`, `middleware/auth.js`,
  `utils/tokenStore.js`, `config/redis.js`.
- **Dependencies**: none beyond `SessionSubjectStateProvider` (already
  built, SEC-3C).
- **Tests**: the fail-closed matrix from §12/§14.5 (`ACCESS_AUTHORIZED` on
  a valid match, `ACCESS_SUBJECT_INACTIVE`, `ACCESS_VERSION_MISMATCH`,
  `ACCESS_STORAGE_FAILURE`, and confirmation that `ACCESS_DENYLISTED` is
  **not** a code this coordinator can ever produce, since it depends on
  subject state only — an explicit test asserting the coordinator has no
  dependency on `utils/tokenStore.js`/`config/redis.js` at all).
- **Database needed**: No.
- **Stop conditions**: any attempt to import this coordinator from
  `middleware/auth.js` or any route.
- **Dormancy proof**: same grep pattern; additionally confirm
  `middleware/auth.js` is byte-identical before and after this slice.

### SEC-3D.5 — Regression, concurrency, failure-injection and documentation acceptance

- **Goal**: full regression sweep (SEC-3B/3C/3D.1–4 together), the
  concurrent-double simulations named in SEC-3D.2/3D.3's own test
  requirements, failure-injection tests across every new service, and the
  SEC-3D acceptance report.
- **Allowed files**: test files only, plus one new report file.
- **Prohibited files**: everything else.
- **Dependencies**: SEC-3D.1–3D.4, all complete.
- **Tests**: the full matrix named across §8.5/§9/§10/§11/§12 for the
  SEC-3D-scoped portion only.
- **Database needed**: No.
- **Stop conditions**: any regression found in SEC-3B/3C's existing
  206+203 checkpointed assertions.
- **Dormancy proof**: a full-repository grep for every new SEC-3D module
  name, confirming matches only inside `services/auth/`,
  `__tests__/`, and this report — zero matches in `controllers/`,
  `routes/`, `middleware/`, `index.js`, `worker.js`, `client/`, `mobile/`.

### SEC-3E — live integration phase (not any SEC-3D slice)

**All of the following are explicitly SEC-3E scope**: live `login`;
`refresh` (wiring the SEC-3D.3 coordinator into
`authController.refreshToken`/`employerAuthController.employerRefreshToken`);
`logout` (wiring the new logout-current service into the live logout
routes); `logout-all` (wiring the new service, exposing it as a route for
the first time); wiring `tokenVersion` bumps into the existing
password-change/password-reset handlers
(`authController.changePassword`/`resetPassword`); wiring `tokenVersion`
bumps into the existing suspension/deletion/role-change admin handlers
(`admin/usersController.js`'s `updateUser`/`deleteUser`/`assignRole`/
`bulkAssignRole`/`updateEmployer`/`bulkSuspendEmployers`); access
middleware (composing the SEC-3D.4 coordinator with the hardened denylist
inside `middleware/auth.js`, per §12.2's 8-step sequence); the mandatory
shared denylist itself (§12.1's full hardening contract — Redis-mandatory,
`jti`-keyed, expiry-derived TTL, no process-local fallback); environment
validation (extending `validateEnv.js`'s existing boot-time hard-fail
pattern to the denylist store, mirroring how it already gates
`JWT_SECRET`/`REFRESH_SECRET`); startup hard-failure wiring for a missing
or unreachable denylist store; and the coordinated browser cutover (§32,
unchanged, already specified by the accepted architecture, out of this
audit's scope to redesign). None of this may begin under a SEC-3D
authorization.

## 19. Readiness verdicts — complete, SEC-3D-A.2

Each verdict below is given separately, per the task's requirement, and is
marked Ready only where its exact contract is fully defined in the
sections cited. No verdict is combined or hedged with "approximately."

- **Password-change mutation**: **READY FOR DORMANT IMPLEMENTATION.**
  Design B (pre-hashed conditional update, §8.2) is selected as the one
  exact design; password hashing is explicit (`bcrypt.hash(newPassword,
12)`, matching the existing model's cost factor); the password hash and
  `tokenVersion` increment commit in one `findOneAndUpdate`; concurrency
  is handled by an explicit `expectedTokenVersion` filter clause, not by
  an assumed Mongoose behavior; a repeated identical request is
  self-rejecting via the unchanged current-password check (§8.5.1); no
  automatic retry is ever silently reapplied.
- **Password-reset mutation**: **READY FOR DORMANT IMPLEMENTATION.** One
  atomic `findOneAndUpdate` (§8.2) covers valid-unused-token match, hash
  write, token/expiry cleanup, and the bounded `tokenVersion` increment;
  the token-match filter clause is itself the idempotency boundary — a
  repeated submission of a consumed token cannot match and therefore
  cannot increment `tokenVersion` a second time (§8.5.1).
- **Logout-all idempotency**: **READY FOR DORMANT IMPLEMENTATION.**
  Corrected in this pass (§8.5, §8.5.1): the guarded increment requires
  `tokenVersion: expectedTokenVersion` (the caller's own verified access
  claim); blind, unconditioned `$inc` is explicitly prohibited; an
  uncertain outcome requires a reread before any retry; when the reread
  shows the version already advanced beyond what was expected, the
  invalidation objective is already satisfied and no second increment is
  performed (`VERSION_ALREADY_ADVANCED`).
- **Admin-revoke idempotency**: **READY FOR DORMANT IMPLEMENTATION.**
  Same guarded-increment contract as logout-all, with
  `expectedTokenVersion` obtained by the service's own immediately-
  preceding read rather than a caller-supplied value (§8.5.1) — a
  durable operation-identity ledger was evaluated and is not selected, as
  this state-conditioned-read pattern already closes the risk to the same
  residual window accepted elsewhere in this design (§7, §11.3).
- **tokenVersion bounds**: **READY FOR DORMANT IMPLEMENTATION, WITH A
  REQUIRED SCHEMA BOUND.** Integer, non-negative (existing, unchanged),
  and a new additive `max: Number.MAX_SAFE_INTEGER` validator (§8.1) —
  not yet implemented, correctly scoped to SEC-3D.2 as the one narrow,
  additive schema change this design requires. Every increment filter
  additionally guards `{$lt: Number.MAX_SAFE_INTEGER}` at the query level,
  not solely relying on the schema validator (§8.1).
- **Single-family revocation**: **READY FOR DORMANT IMPLEMENTATION.**
  §9's filter-based contract is idempotent by construction
  (`SESSION_ALREADY_REVOKED` on a repeat), requires no plaintext token,
  and binds `subjectType`/`subjectId` to the authenticated caller's own
  verified claims — an attacker-controlled `sid` alone can never revoke
  another subject's session.
- **All-family cleanup**: **READY FOR DORMANT IMPLEMENTATION.** §10's
  `updateMany` contract is idempotent (re-matches fewer/zero documents on
  a repeat), preserves historical revocations by construction, and is
  explicitly ordered **after** the authoritative `tokenVersion` bump
  (§7's Strategy B) so its own failure (`REVOCATION_PARTIAL`) never
  restores old-token validity.
- **Refresh post-rotation revalidation**: **READY FOR DORMANT
  IMPLEMENTATION.** §11.2's mandatory step 8 reread is fully specified,
  including both cleanup sub-outcomes (`ROTATED_FAMILY_REVOKED`/
  `ROTATED_FAMILY_CLEANUP_FAILED`) and the caller-facing
  `REFRESH_FINAL_STATE_MISMATCH` result.
- **Residual refresh-race containment**: **READY FOR DORMANT
  IMPLEMENTATION, UNDER THE CORRECTED, ACHIEVABLE GUARANTEE.** §11.3
  states the exact, achievable model: the final authoritative reread
  detects any invalidation that occurred during the principal refresh
  sequence (steps 1–8); on a mismatch, no token is returned and cleanup is
  attempted; **an invalidation that commits after step 8, during response
  delivery, may still result in a superseded credential's bytes reaching
  the client** — this cannot be eliminated by any finite number of
  rereads without a transaction, which this design does not depend on
  (§7). That credential is never _accepted_ once the invalidating event
  is visible to the access-authorization and refresh-eligibility read
  paths that gate its use. This is the corrected replacement for the
  SEC-3D-A.1 pass's overstated "no stale successor can ever be returned"
  claim.
- **Existing denylist suitability**: **NOT SUITABLE FOR TARGET PRODUCTION
  CORRECTNESS.** Confirmed by direct re-inspection (§3): Redis is
  optional, not mandatory; a process-local `Map` fallback exists and
  activates silently; the denylist TTL is a hardcoded `60 * 60` constant,
  not derived from verified token expiry; server startup does not fail
  when the shared store is unavailable. Real, live, and functionally
  correct in a single-instance/Redis-configured deployment today — but
  does not meet the target architecture's bar as currently implemented.
- **Hardened denylist target design**: **ARCHITECTURE READY, NOT
  IMPLEMENTED.** §12.1 defines the exact production gate in full (Redis
  or an explicitly approved equivalent mandatory; startup hard-fail;
  no process-local fallback path reachable in production; every instance
  sharing the same store; `jti`-derived keys, never the raw token; TTL
  derived from the verified token's own `exp - now`; fail-closed storage
  errors; idempotent repeated insertion; explicit partial-failure
  handling; Redis eviction/persistence policy assessed before production;
  infrastructure acceptance at SEC-3F/SEC-3G). No implementation or
  infrastructure verification has been performed against this gate — that
  is SEC-3E-and-beyond work, not this audit's.
- **Access authorization design**: **READY FOR DORMANT FOUNDATION
  IMPLEMENTATION.** SEC-3D.4's coordinator covers validated access claims
  plus authoritative subject state only (§12, §12.2 steps 5–7); live
  denylist composition (§12.2 steps 3–4) is explicitly SEC-3E scope, not
  built or activated by any SEC-3D slice.
- **SEC-3D.1**: **READY FOR BOUNDED DORMANT IMPLEMENTATION** — exact
  scope, allowed/prohibited files, dependencies, tests, and dormancy proof
  all defined (§18).
- **SEC-3D.2**: **READY FOR BOUNDED DORMANT IMPLEMENTATION** — as above;
  contingent specifically on including the `max` bound (§8.1) and using
  Design B, not `optimisticConcurrency: true` (§8.2, §18).
- **SEC-3D.3**: **READY FOR BOUNDED DORMANT IMPLEMENTATION** — as above;
  scope corrected to the full 9-step sequence including the mandatory
  reread (§11, §18).
- **SEC-3D.4**: **READY FOR BOUNDED DORMANT IMPLEMENTATION** — as above;
  scope narrowed to exclude any denylist composition (§12, §18).
- **SEC-3D.5**: **READY FOR BOUNDED DORMANT IMPLEMENTATION** — regression,
  concurrency, idempotency, and failure-injection test scope fully defined
  against SEC-3D.1–3D.4's own stated test requirements (§18); dependent on
  those four slices being complete first.
- **Complete dormant SEC-3D**: **READY FOR PHASED DORMANT
  IMPLEMENTATION.** Every dormant contract across §7–§14 is now exact;
  every slice in §18 is new-files-only (with the single named additive
  schema exception, §8.1); all live integration — route/controller/
  middleware wiring, denylist hardening, environment validation, startup
  enforcement, browser cutover — is explicitly deferred to SEC-3E, not
  contained in any SEC-3D slice.
- **SEC-3E**: **NOT READY.** No live cutover has occurred; the mandatory
  denylist hardening (§12.1) is not implemented; no startup enforcement
  exists for it; no route, controller, or middleware has been wired to
  any SEC-3D primitive; no browser migration (§32) has been performed; no
  real-infrastructure acceptance (§16, replica-set/topology-dependent
  testing) has occurred.
- **Production deployment**: **NOT READY.** Gated on SEC-3E (not ready),
  SEC-3F, and SEC-3G in sequence, exactly as §33 specifies — unchanged
  conclusion from every prior pass.
- **10/10 security**: **NOT ACHIEVED.** The current live system remains
  exactly as under-enforced as §2.4's call graph describes; none of this
  audit's designs have been implemented, let alone activated.

## 20. Explicit non-claims

**This audit performed no implementation.** Every design in §7–§12 is a
specification for future work, not code — re-confirmed at the end of this
correction pass exactly as at the end of the original pass. **No dormant
or live primitive was activated, modified, or wired.** **This audit makes
no production-readiness claim** and **no 10/10 claim** — the current live
system remains exactly as under-enforced as this report's own §2.4 (live
call graph, preserved unchanged from the original pass) describes, until
SEC-3D is implemented per the corrected, fully-dormant slices above and
SEC-3E performs the live integration this correction pass removed from
SEC-3D's scope.
