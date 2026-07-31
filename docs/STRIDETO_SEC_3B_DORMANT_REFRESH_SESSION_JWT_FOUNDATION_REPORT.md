# STRIDETO-SEC-3B — Dormant RefreshSession and JWT Foundation

**Revision note (SEC-3B.1 correction pass):** this document supersedes the
original SEC-3B report in place. The original implementation was reviewed
by an independent read-only acceptance audit
(STRIDETO-SEC-3B-A) which found one Critical and two High findings, all
confirmed by direct empirical reproduction rather than assumption. This
revision documents the corrected implementation and corrects several
factual inaccuracies in the original report itself (test-file count,
new-file count, and an overstated "guarantees verified" claim about
replay-revocation safety). See §5 for the full list of what changed and
why.

## 1. Repository baseline

Preflight before this phase: HEAD `e19ad912754d1fde44ad0234f85be38e2c252d9f`
(`docs: define authentication session security architecture`), branch
`main...origin/main [ahead 23]`, no tracked modification, no staged file,
untracked files exactly `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
and `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`. Confirmed
matching before the original SEC-3B work and reconfirmed unchanged before
this SEC-3B.1 correction pass.

Implementation authority:
`docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md`,
specifically §19A (JWT claims/signing-key contract), §21 (refresh-session
persistence model), §22 (rotation and replay contract), §23 (concurrency
timing hierarchy), §33 (SEC-3B phase definition).

## 2. Exact files changed

**New files (10):** 5 modules, 4 tests, 1 report — this report itself is
the 10th new file. The original report undercounted this as "9" (omitting
itself from its own count).

- `server/src/models/RefreshSession.js`
- `server/src/services/auth/RefreshSessionContracts.js`
- `server/src/services/auth/refreshTokenHash.js`
- `server/src/services/auth/JwtSessionProvider.js`
- `server/src/services/auth/RefreshSessionRotationService.js`
- `server/src/__tests__/refreshSessionSchema.test.js`
- `server/src/__tests__/refreshTokenHash.test.js`
- `server/src/__tests__/jwtSessionProvider.test.js`
- `server/src/__tests__/refreshSessionRotation.test.js`
- `docs/STRIDETO_SEC_3B_DORMANT_REFRESH_SESSION_JWT_FOUNDATION_REPORT.md`
  (this file)

**Modified files (2), additive only:**

- `server/src/models/User.js` — added `tokenVersion` field, now including
  an explicit `Number.isInteger` validator (added in SEC-3B.1; absent in
  the original SEC-3B pass — see §5).
- `server/src/models/Employer.js` — same field and correction.

**No other file was created, modified, or deleted.**

## 3. Current live auth path — preserved, unchanged, verified

Unchanged from the original pass: `server/src/utils/jwt.js`,
`server/src/utils/tokenStore.js`, `server/src/middleware/auth.js`, and
`server/src/controllers/authController.js` were not touched by either the
original SEC-3B implementation or this SEC-3B.1 correction. Every new
module lives in `services/auth/` or `models/RefreshSession.js`, with zero
imports from or into the live path. Reverified in §9.

## 4. New dormant modules

### 4.1 `RefreshSessionContracts.js`

Pure constants and one error class, no Mongoose, no I/O. Unchanged from
the original pass except two additions to `REFRESH_ROTATION_RESULT_CODES`
(§5.3): `INVALID_INPUT` and `CLASSIFICATION_STALE`.

- `REFRESH_SESSION_SUBJECT_TYPES = ['user', 'employer']`
- `REFRESH_SESSION_REVOKE_REASONS` — the exact nine reasons required.
- `REFRESH_SESSION_CONCURRENCY_WINDOW_MS = 15000`.
- `REFRESH_SESSION_DEFAULT_TTL_MS` — 7 days.
- `REFRESH_ROTATION_RESULT_CODES` — now eleven outcome codes (nine
  original + `INVALID_INPUT` + `CLASSIFICATION_STALE`).
- `RefreshSessionContractError`.

### 4.2 `RefreshSession` model (§21)

Unchanged field set and indexes from the original pass, with one
correction: `lastUsedAt` now has `default: Date.now` (§5.5) — the original
had no schema-level default, requiring every caller to supply it
explicitly. The rotation service still always supplies it explicitly on
every creation and rotation; the default is a safety net for any future
caller that omits it, not the primary path.

**Indexes**, unchanged: `refresh_session_ttl` (`expiresAt`,
`expireAfterSeconds: 0`), `refresh_session_active_by_subject`
(`subjectType + subjectId + revokedAt`),
`refresh_session_current_token_hash_unique` (unique, defense-in-depth, not
load-bearing for CAS correctness), `refresh_session_previous_token_hash`
(sparse, non-unique — correctly avoids a null-collision design flaw since
many not-yet-rotated sessions share `previousTokenHash: null`).

**Index-rollout requirement, stated explicitly (was missing from the
original report)**: `autoIndex: false` and `autoCreate: false` remain in
place — model construction and import still perform no database
connection, no index build, and no collection creation. This means the
four indexes above exist only in the schema definition today; they are
**not yet present in any real MongoDB collection**. Before this model is
ever activated against a live database, a later, explicitly reviewed phase
must run an index-creation step (e.g. `RefreshSession.syncIndexes()` or an
equivalent reviewed migration) as a deliberate, separate action — this
does not happen automatically, and this phase did not run any such
command or connect to any database to verify it.

**Fields deliberately absent**, unchanged: no `ip`/`ipHash`/`userAgent`/
`deviceLabel`, no plaintext token field, no `familyId`/`replacedByTokenId`.

### 4.3 `refreshTokenHash.js`

`hashRefreshToken(token)` — SHA-256, lowercase hex, one-way, separate from
`utils/tokenStore.js`'s internal hash helper.

**Corrected in SEC-3B.1**: whitespace-only strings (e.g. `"   "`, tabs,
newlines) are now explicitly rejected — the original implementation
silently accepted and hashed them as if they were meaningful token
material. A valid, non-whitespace-only token is still hashed using its
**exact supplied bytes**; the function never trims a valid token before
hashing (verified by test: a padded token and its trimmed form hash to
different, correct values).

### 4.4 `JwtSessionProvider.js` (§19A)

Unchanged: separate-key enforcement (mirroring `validateEnv.js`'s exact
weak-secret policy), `HS256`-only algorithm pinning, issuer/audience/type
validation, stable caller-supplied `sid`, fresh internally-generated `jti`
per issuance.

**Corrected in SEC-3B.1**: `tokenVersion` is now validated as a
non-negative integer (`assertNonNegativeIntegerClaim`, shared between
issuance and verification) at **issuance time**, not only at verification
time. The original implementation's issuance path only checked
`typeof tokenVersion === 'number'`, so `issueAccessToken({..., tokenVersion:
1.5})` would previously succeed and embed a fractional value in a signed
token (verification would have caught it downstream, since verification's
check was already correct — but issuance itself did not fail closed).
Empirically reproduced before the fix and reverified fixed after:
`0.5`, `1.5`, `-1`, `Infinity`, `-Infinity`, `NaN`, non-numbers, and
`undefined` are all now rejected at issuance for both access and refresh
tokens; `0` and positive integers remain accepted.

**Reserved-claim override protection — independently, empirically
verified, not merely asserted by code reading**: a malicious input object
containing every reserved claim name (`type`, `jti`, `iss`, `aud`, `exp`,
`algorithm`) was passed to `issueAccessToken`; every one of those values
was ignored in the resulting signed token, which still carried the
provider-controlled `HS256` algorithm, `access` type, internally-generated
`jti`, configured issuer/audience, and provider-controlled expiry. This is
now a permanent, locked-in regression test (§6), not just a one-time
manual check.

### 4.5 `RefreshSessionRotationService.js` (§22)

**This module received the substantive SEC-3B.1 corrections.**

**Call-time input validation, added in SEC-3B.1** (absent originally):
`rotate()` now rejects, before any model call, with a new
`INVALID_INPUT` result: missing/empty `sid`, empty `presentedTokenHash`,
empty `newTokenHash`, `presentedTokenHash === newTokenHash` (a degenerate
no-op rotation — the original implementation silently accepted this and
reported `ROTATED`, leaving `currentTokenHash === previousTokenHash` on
the document), a non-integer or negative `expectedTokenVersionAtIssue`
when supplied, and an invalid (`NaN`/non-`Date`) clock output.
`createSession()` received the equivalent input validation. The
constructor's `concurrencyWindowMs` validation was tightened from
"non-negative finite number" to "positive finite integer."

**Benign-conflict elapsed-time classification, corrected in SEC-3B.1**:
the original comparison `elapsed <= concurrencyWindowMs` had no lower
bound, so a **negative** elapsed value — `previousTokenRotatedAt` after
`now`, from clock skew or a malformed timestamp — satisfied `<=` and was
misclassified as `CONFLICT_BENIGN`. Empirically reproduced (a
60-second-future `previousTokenRotatedAt` was classified benign) before
the fix, and reverified to now classify as `REPLAY_DETECTED` after it. The
new `isBenignElapsed` helper requires `Number.isFinite(elapsedMs) &&
elapsedMs >= 0 && elapsedMs <= concurrencyWindowMs` — a malformed
(`NaN`-valued) `previousTokenRotatedAt` is also now never benign. Boundary
behavior is exact and tested: 0ms and 15000ms are both benign
(inclusive), 15001ms is replay.

**Replay-revocation race — the Critical finding, corrected in SEC-3B.1**:
the original implementation classified a document as replay from a
`findById` snapshot, then revoked it with an **unconditional**
`{ _id, revokedAt: null }` filter — a stale-read/unconditional-write race.
If a legitimate concurrent rotation completed between the classifying
read and the revoke write, the family would be revoked anyway, destroying
a session that had just rotated correctly. This was empirically
reproduced (a simulated intervening legitimate rotation caused the
original code to revoke the now-current, legitimately-rotated family) and
is now fixed:

The revoke write is a **conditional CAS** whose filter includes `_id`,
`revokedAt: null`, and the exact `currentTokenHash`, `previousTokenHash`,
`previousTokenRotatedAt`, and `tokenVersionAtIssue` values observed at
classification time. If the document has changed since that read (the
signature of an intervening legitimate rotation), this filter simply does
not match — the family is **not** revoked. On that loss, the service
performs exactly one bounded re-read (never a retry loop, never an
unconditional fallback) to check for a clear, safe terminal state
(`SESSION_MISSING`, `SESSION_REVOKED`, `SESSION_EXPIRED`); if none
applies, it returns the new `CLASSIFICATION_STALE` code rather than
guessing. Re-reproduced with the exact same simulated race used to
originally find the bug: the family now remains unrevoked, the
legitimately-installed successor hash is untouched, no successor is
issued by the stale replay request, and the result is
`CLASSIFICATION_STALE` (verified by test — see §6).

**Every returned result, on every branch including the two new codes, is
still `Object.freeze({ code })` only.**

## 5. What changed from the original SEC-3B report, and why

This section exists because the original report presented the
implementation as complete and its "guarantees verified" section (§5 of
the original) did not flag the replay-revocation race at all — an
omission corrected here per the acceptance audit's finding.

1. **Critical — replay-revocation race** (§4.5): fixed with a
   state-conditioned CAS; the family-revocation guarantee is now actually
   safe under concurrent legitimate rotation, not merely convenient in the
   common case.
2. **High — `User`/`Employer.tokenVersion` accepted fractional and
   infinite values** (`min: 0` alone is insufficient): fixed with an
   explicit `Number.isInteger` validator, empirically reverified against
   `0.5`, `1.5`, `Infinity`, `-Infinity`, `-1`, `0`, and positive
   integers.
3. **High — JWT issuance did not validate `tokenVersion` as an integer**:
   fixed; issuance and verification now share one validator.
4. **Medium — identical current/successor hash silently accepted**: now
   rejected as `INVALID_INPUT`.
5. **Medium — negative elapsed time misclassified as benign**: fixed, see
   §4.5.
6. **Medium — no call-time input validation on `rotate()`/
   `createSession()`**: added, see §4.5.
7. **Low — whitespace-only hash input silently accepted**: now rejected,
   see §4.3.
8. **Low — `lastUsedAt` had no schema-level default**: added
   `default: Date.now` as a safety net, see §4.2.
9. **Low — index-rollout requirement undocumented**: documented, see §4.2.
10. **Low — test-file count reported as 45; actual is 46**: corrected
    throughout this report (46 discovered, 45 execute normal assertions,
    1 self-skips without a live database — see §7).
11. **Low — Prettier count reported as "9/9 new files"**: corrected to 10
    new files (the report itself is the 10th); the actual new-code-file
    Prettier scope was always 9 (5 modules + 4 tests), which did pass —
    only the file-count label was wrong, not the Prettier result itself.

## 6. Tests and assertion counts

All four test files remain plain `node:assert/strict` scripts, matching
the repository's existing convention — no test framework was added.

| File                             | Assertions (original → corrected) | New coverage added in SEC-3B.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refreshSessionSchema.test.js`   | 38 → 63                           | Real behavioral proof (not just validator-presence checks) that `User`/`Employer.tokenVersion` and `RefreshSession.tokenVersionAtIssue` reject `0.5`, `1.5`, `Infinity`, `-Infinity`, negative values, and accept `0`/positive integers; `lastUsedAt` default-value behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `refreshTokenHash.test.js`       | 10 → 15                           | Whitespace-only rejection (space, multiple spaces, tabs/newlines); exact-bytes hashing (padded vs. trimmed token hash differently)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `jwtSessionProvider.test.js`     | 35 → 66                           | Fractional/infinite/negative/non-number `tokenVersion` rejected at issuance for both token types; verification independently re-checked against a directly-signed fractional-`tokenVersion` token; explicit locked-in reserved-claim-override regression test (`type`, `jti`, `iss`, `aud`, `exp`, `algorithm` all attempted and confirmed ignored, including an end-to-end check that a maliciously-labeled `type:'refresh'` access token still fails refresh verification)                                                                                                                                                                                                                                                                                                                                              |
| `refreshSessionRotation.test.js` | 34 → 59                           | Constructor validation (window must be a positive finite integer); full `rotate()`/`createSession()` input-validation matrix; exact 0ms/15000ms benign boundaries and 15001ms replay boundary; negative-elapsed and malformed-timestamp non-benign cases; a stable (non-racing) replay case proving the guarded revoke CAS succeeds when state is unchanged; **the critical race scenario** (classification snapshot vs. an intervening legitimate rotation, proving the family remains unrevoked and `CLASSIFICATION_STALE` is returned); a regression canary proving no under-guarded fallback filter is ever used; an isolated storage-failure-during-replay-revoke case (distinct from the initial-CAS storage-failure case); the pre-existing genuine `Promise.all` one-winner concurrency test, preserved unchanged |

**Total: 203 assertions, all passing** (up from 117 in the original pass).

Existing, unrelated tests re-run: `auth.test.js`, `authRealm.test.js`,
`employerAuthRealmIsolation.test.js`, `emailVerification.test.js`,
`duplicateEmailUserIdIndexes.test.js` — all pass unchanged, confirming the
strengthened `tokenVersion` validator introduces no regression.

## 7. Verification commands and results

```text
npx prettier --check <every changed/new file>      → 9 of 11 files pass (the 5 modules + 4 tests,
                                                        all newly authored this session); User.js and
                                                        Employer.js fail a full-file --check — this is
                                                        honestly reported, not hidden: it reflects
                                                        pre-existing style debt in those two files
                                                        (present before this phase touched them, and
                                                        present in every prior phase of this
                                                        engagement), not anything introduced by the
                                                        7-line targeted addition. Running --write on
                                                        those two files would reformat many unrelated
                                                        pre-existing lines; the minimal, targeted diff
                                                        was kept instead (git diff --check on both
                                                        files is clean — no whitespace errors).
npx eslint <every new/changed file>                 → clean, zero errors/warnings
npm run lint  (full server/src scope)               → clean, zero errors/warnings
node <each of the 4 SEC-3B test files>              → 203/203 assertions passed
node <5 existing auth/JWT/model-adjacent tests>      → all pass, unchanged
git diff --check                                    → clean (only benign CRLF-normalization warnings)
```

**Test-file discovery and execution, stated exactly**: 46 files exist
under `server/src/__tests__/*.test.js`. All 46 processes were run
individually via `node <file>` and all 46 exited successfully (status 0).
Of those 46: **45 execute and pass their normal assertions**; **1**
(`employerPortalIntegration.test.js`) is a genuine live-MongoDB
integration test gated behind the `EMPLOYER_INTEGRATION_TEST=1`
environment variable — with that variable unset (the default, and the
state throughout this entire phase), it prints a skip notice and exits 0
without connecting to anything. It was not weakened, modified, deleted, or
run against any database, and its self-skip is not presented here as
database-backed proof of anything — it is simply excluded from the
"45 execute normal assertions" figure and named as the one exception.

No client build was run — statically confirmed no file under `client/` or
`mobile/` changed.

## 8. Dormancy proof

Re-run after the SEC-3B.1 corrections, with identical results to the
original pass: no file under `server/src/controllers/`,
`server/src/routes/`, `server/src/middleware/`, `server/src/index.js`,
`server/src/worker.js`, or `server/src/config/validateEnv.js` references
any new SEC-3B module. `RefreshSession` (the model) is imported only by
`RefreshSessionRotationService.js` and its own test. No file under
`client/src/` or `mobile/` references any new module. `tokenVersion` is
not read, compared, or incremented anywhere outside the model files
themselves and the new SEC-3B modules/tests — reconfirmed by a fresh
repository-wide grep excluding `__tests__` and `services/auth/`, zero
matches.

**Current live authentication behavior is unchanged and was reverified**:
the five pre-existing auth-adjacent tests re-run in §6 confirm this. This
is not a claim that current behavior is secure — the known gaps documented
in the accepted architecture report remain fully present and are
scheduled for the later revocation foundation (SEC-3D) and atomic cutover
(SEC-3E), not addressed by this phase.

## 9. Prohibited changes — confirmed absent

No change to: the live JWT helper, the live token store, any auth
controller, any auth route, `requireAuth`/`requireEmployerAuth`
middleware, CORS configuration, cookie handling, Origin/Referer
validation, `validateEnv.js`/startup wiring, any login/register/refresh/
logout API response shape, `AuthContext.jsx`, `EmployerAuthContext.jsx`,
axios interceptors, `localStorage` behavior, mobile code, OAuth code,
`package.json`/lockfiles/`.env*`/deployment config, either pre-existing
untracked report, or any publishing/B3-E code. No dependency was added.
No database migration, transaction, background job, or
production-activation flag was added. No database connection was made at
any point during either the original SEC-3B implementation or this
SEC-3B.1 correction pass.

## 10. Remaining work for SEC-3C

Unchanged from the original report: per §33 of the accepted architecture,
SEC-3C builds the dormant cookie set/clear helpers, the trusted-Origin/
Referer validation middleware, and the authoritative account-state/
tokenVersion validation helper — also fully dormant. SEC-3D, SEC-3E,
SEC-3F, and SEC-3G remain entirely unstarted. Before any future phase
activates the `RefreshSession` model against a real database, the explicit
index-creation step named in §4.2 must be performed and reviewed as its
own action.

## 11. Explicit non-claims

**This phase makes no production-readiness claim.** The modules built
here are inert — unreferenced by any live path — and their correctness is
demonstrated only against an injected, in-memory test double engineered to
faithfully model MongoDB's real per-document atomicity and BSON
value-equality semantics (not a simplified algorithm that diverges from
production filter/update behavior), not against a real MongoDB instance
under real concurrent load — that verification is explicitly SEC-3F's job.
**This phase makes no 10/10 claim.** The current, live authentication
system remains exactly as insecure as documented in the accepted
architecture report's findings until SEC-3E activates the replacement.
The self-skipped `employerPortalIntegration.test.js` is not, and is not
presented as, database-backed proof of any SEC-3B/SEC-3B.1 guarantee.
