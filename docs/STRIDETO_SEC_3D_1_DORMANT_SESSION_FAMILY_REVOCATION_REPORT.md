# STRIDETO-SEC-3D.1 — Dormant Session-Family Revocation Services

**SEC-3D.1.1 correction applied.** The SEC-3D.1 final acceptance audit
found the implementation sound but incomplete in two respects: (1)
`revokeAllFamilies`'s driver-result validation used `Number.isInteger`
rather than `Number.isSafeInteger`, permitting precision-lost values
beyond `Number.MAX_SAFE_INTEGER`; (2) a genuine, same-call partial
cleanup (`matchedCount > modifiedCount > 0`) was silently folded into an
undifferentiated success rather than being reported distinctly, even
though `REVOCATION_PARTIAL` already existed in the exported taxonomy.
Six specific test-coverage gaps were also identified (compound
mismatch+revoked-and-expired cases, malformed stored `expiresAt`/
`revokedAt`, the `expiresAt === now` equality boundary, uppercase-hex
`ObjectId` acceptance, and exact concurrency call-count assertions) —
all confirmed, at audit time, to reflect already-correct production
behavior, now closed with explicit tests. §5, §8, §9, and §10 below are
corrected in place; §1–§4, §6, §7 (aside from the new coverage noted in
§10), §11–§15 are unchanged from the original SEC-3D.1 pass, re-verified
still accurate.

## 1. Repository baseline

Preflight before this phase: HEAD `37ecc39cf386c2f934722ead3f01249624597bd1`
(`docs: define revocation and account-state implementation readiness`),
branch `main...origin/main [ahead 26]`, no tracked modification, no staged
file, untracked files exactly
`docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` and
`docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`. Confirmed
matching before any edit and reconfirmed unchanged at the end (§13).
Re-confirmed identical at the start of the SEC-3D.1.1 correction pass:
four authorized SEC-3D.1 files (`SessionFamilyRevocationContracts.js`,
`SessionFamilyRevocationService.js`, `sessionFamilyRevocation.test.js`,
this report) plus the same two preserved unrelated reports — six
untracked files total, no existing tracked file ever modified.

## 2. Architecture authority

`docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md` §9
(single-family revocation design), §10 (all-family revocation design),
§14.2 (session-family revocation result taxonomy), §18 (SEC-3D.1's exact
slice scope). This phase implements exactly, and only, what §9/§10/§18
specify as SEC-3D.1's dormant foundation — no `tokenVersion` mutation
(§8, SEC-3D.2's job), no refresh-eligibility coordination (§11,
SEC-3D.3), no access authorization (§12, SEC-3D.4), no live wiring of any
kind (§18's "Live integration phase," SEC-3E's job).

## 3. Exact files created

- `server/src/services/auth/SessionFamilyRevocationContracts.js`
- `server/src/services/auth/SessionFamilyRevocationService.js`
- `server/src/__tests__/sessionFamilyRevocation.test.js`
- `docs/STRIDETO_SEC_3D_1_DORMANT_SESSION_FAMILY_REVOCATION_REPORT.md`
  (this file)

**No existing file was modified.** This phase is purely additive, reusing
`RefreshSessionContracts.js`'s realm enum and revoke-reason enum by
import rather than redeclaring them, exactly matching the convention
already established by `AuthSessionPrimitiveContracts.js` (SEC-3C).

## 4. RefreshSession identifier type, confirmed by direct inspection

`RefreshSession._id` (the session-family identifier, doubling as the
future JWT `sid` claim) and `RefreshSession.subjectId` are both Mongo
`ObjectId` (`models/RefreshSession.js:7,25-28`). This service validates
both as 24-character hex strings
(`OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/`), reusing exactly the pattern
`SessionSubjectStateProvider.js` already established for `subjectId`
validation (SEC-3C) — not a new convention. `subjectType` (the realm
field) is confirmed `enum: REFRESH_SESSION_SUBJECT_TYPES` (`'user'` |
`'employer'`), immutable. `revokedAt`/`revokeReason` are confirmed paired
by a `pre('validate')` hook — one implies the other — and the
already-implemented `revokeReason` enum has all 9 values this phase's
allowed-reason subsets draw from.

## 5. Result taxonomy

`SessionFamilyRevocationContracts.js` exports 10 result codes: `INVALID_INPUT`,
`REVOKED_CURRENT_FAMILY`, `SESSION_ALREADY_REVOKED`, `SESSION_MISSING`,
`SESSION_EXPIRED`, `SESSION_SUBJECT_MISMATCH`, `REVOKED_ALL_FAMILIES`,
`REVOCATION_PARTIAL`, `CLASSIFICATION_STALE`, `STORAGE_FAILURE` — an
`Object.freeze`d array, unique strings (test-verified), no HTTP mapping,
no raw errors.

**`SESSION_REVOKED` vs. `REVOKED_CURRENT_FAMILY`**: the accepted readiness
audit's task text names both as equivalent single-family-success
alternatives ("SESSION_REVOKED; or REVOKED_CURRENT_FAMILY"). This report
uses `REVOKED_CURRENT_FAMILY` as the one canonical code, matching the
readiness audit's own §14.2/§19 naming exactly, rather than exporting two
literal strings for one concept.

**`REVOCATION_PARTIAL` — corrected in SEC-3D.1.1, now reachable.** The
original pass exported this code but never returned it, describing it as
reserved solely for a future SEC-3D.2 coordinator. The acceptance audit
found this incomplete: a genuine, same-call partial cleanup is directly
observable from a single `updateMany` result's own counts
(`matchedCount > modifiedCount > 0`), with no dependency on any future
coordinator or cross-operation composition. **`revokeAllFamilies` now
returns `REVOCATION_PARTIAL` deterministically for exactly this
condition** — see §8 for the exact classification table. This is
independent of, and does not replace, the separate cross-operation
question a future SEC-3D.2 coordinator will still face when composing
this service's `STORAGE_FAILURE` outcome with a preceding, already-
committed `tokenVersion` mutation.

## 6. Allowed reason sets

- **Single-family** (`SINGLE_FAMILY_REVOKE_REASONS`): exactly `['logout',
'admin_revoked']`. Excludes `'replay_detected'` — that is SEC-3B's own
  exclusive, already-implemented replay-revocation path
  (`RefreshSessionRotationService.rotate()`'s guarded revoke CAS); this
  service creates no second, competing replay path (verified by test:
  `isSingleFamilyRevokeReason('replay_detected')` is `false`, and
  `revokeCurrentFamily` with `reason: 'replay_detected'` returns
  `INVALID_INPUT`). Excludes every bulk-oriented reason.
- **All-family** (`ALL_FAMILY_REVOKE_REASONS`): exactly `['logout_all',
'password_change', 'password_reset', 'account_suspended',
'account_deleted', 'role_changed', 'admin_revoked']` — matching the
  accepted event matrix (readiness audit §5) exactly: every event whose
  access-token implication is "immediate via tokenVersion, best-effort
  revoke all sessions." Excludes `'logout'` (single-family only) and
  `'replay_detected'` (SEC-3B-exclusive).
- `'admin_revoked'` appears in **both** sets, matching the accepted event
  matrix's "Admin revoke (explicit) | Either, admin choice" row.
- A module-load-time defensive check confirms every configured reason in
  both sets is a real, already-accepted `REFRESH_SESSION_REVOKE_REASONS`
  value — this module can never introduce a reason string the SEC-3B
  schema doesn't already recognize.
- Unsupported reasons fail closed: any reason not in the relevant allowed
  set returns `INVALID_INPUT` with zero model calls (verified by test for
  `'replay_detected'`, `'logout_all'` on the single-family path, `'logout'`
  and `'replay_detected'` on the all-family path, and an arbitrary unknown
  string on both).

## 7. Single-family revocation (`revokeCurrentFamily`)

### Validation, before any model call

`realm` (exactly `'user'`/`'employer'`), `subjectId` (24-hex `ObjectId`
string), `sessionFamilyId` (24-hex `ObjectId` string), `reason` (in
`SINGLE_FAMILY_REVOKE_REASONS`), and the injected clock's output (a valid
`Date`) are all validated before any model call. Any failure returns
exactly `{code: 'INVALID_INPUT'}` with zero reads and zero writes
(verified by test: `model._callCounts.findOneAndUpdate === 0` and
`model._callCounts.findById === 0` across six distinct invalid-input
cases plus an invalid-clock case).

### Primary conditional update — exact filter

```js
refreshSessionModel.findOneAndUpdate(
  {
    _id: sessionFamilyId,
    subjectType: realm,
    subjectId,
    revokedAt: null,
    expiresAt: { $gt: nowValue },
  },
  { $set: { revokedAt: nowValue, revokeReason: reason } }
);
```

Binds the exact family identifier, `subjectType`/realm, `subjectId`,
`revokedAt: null`, and — deliberately, unlike the all-family sweep (§8) —
an unexpired-state precondition, so an expired family falls through to
classification and is reported as `SESSION_EXPIRED` rather than silently
succeeding. The `$set` touches only `revokedAt`/`revokeReason` — verified
by test that the update object's keys are exactly `['revokedAt',
'revokeReason']`, and that `subjectType`, `subjectId`, `currentTokenHash`,
`tokenVersionAtIssue`, and `expiresAt` are all confirmed unchanged on the
stored document after a successful call. **A family can never be revoked
using the identifier alone** — `subjectType`/`subjectId` are always bound
in the same filter (verified by the exact-filter-keys test and by the
dedicated subject-mismatch tests below).

### Success

Exactly one modified family returns `Object.freeze({code:
'REVOKED_CURRENT_FAMILY'})` — no family ID, subject ID, or document
field. Verified for both `user` and `employer` realms, and verified
robust to a truthy-but-field-empty driver return value (the service never
reads any field off the driver's result, only checks truthiness).

### Conditional-update miss — exactly one bounded classification read

On zero documents modified, `findById(sessionFamilyId, {subjectType:1,
subjectId:1, revokedAt:1, expiresAt:1})` is called **at most once**
(verified by test), using the minimum projection needed to classify.

**Classification ordering, exact, test-verified**: subject/realm binding
is checked **first**, before `revokedAt` or `expiresAt` are ever
consulted — a family belonging to a different subject or realm always
resolves to `SESSION_SUBJECT_MISMATCH`, even when that family is _also_
already revoked or _also_ expired (both scenarios explicitly tested and
confirmed to still return `SESSION_SUBJECT_MISMATCH`, never leaking the
target's actual state). After subject binding passes: `revokedAt` set →
`SESSION_ALREADY_REVOKED`; not revoked but `expiresAt` in the past or
malformed → `SESSION_EXPIRED`; not revoked, not expired, subject
matches → `CLASSIFICATION_STALE` (the primary filter should have matched
this exact state; it didn't, so a genuine concurrent state change
occurred between the two reads — reported honestly rather than guessed
at, matching the same pattern `RefreshSessionRotationService.classifyMiss`
already established for replay classification). A missing document (no
match at all) → `SESSION_MISSING`.

**No unconditional fallback write exists anywhere in this path** —
confirmed by the `CLASSIFICATION_STALE` test, which forces every
`findOneAndUpdate` call to miss and then verifies the family remains
unrevoked (`revokedAt === null`) after the call, and by direct code
inspection (`classifyMiss` never calls `findOneAndUpdate`).

### Concurrency

Two concurrent, otherwise-identical `revokeCurrentFamily` calls against
the same family (differing only in `reason`) are proven, via a real
`Promise.all` test against the atomic in-memory fake model, to produce
exactly one `REVOKED_CURRENT_FAMILY` and one `SESSION_ALREADY_REVOKED` —
never two successes. The stored `revokeReason` is confirmed to be the
winning call's reason, and a separate, dedicated test confirms a
**sequential** repeat call with a _different_ reason cannot overwrite the
first call's already-stored `revokeReason`.

### Storage failure

A thrown error from either the primary write or the classification read
is normalized to exactly `{code: 'STORAGE_FAILURE'}` — no raw error, no
stack, no query data. No automatic retry occurs on any path (confirmed by
call-count assertions throughout).

## 8. All-family revocation (`revokeAllFamilies`)

### Validation

`realm`, `subjectId`, `reason` (in `ALL_FAMILY_REVOKE_REASONS`), and the
clock output are validated before any model call; invalid input performs
zero `updateMany` calls (verified by test).

### Exact filter and update

```js
refreshSessionModel.updateMany(
  { subjectType: realm, subjectId, revokedAt: null },
  { $set: { revokedAt: nowValue, revokeReason: reason } }
);
```

One timestamp (`nowValue`, read once per call) is used for the entire
operation. The `$set` touches only `revokedAt`/`revokeReason` (verified by
test). Historical already-revoked families (any prior reason, including
`'replay_detected'`) are **never** touched — the `revokedAt: null` clause
excludes them by construction, and a dedicated test confirms an
already-revoked family's original `revokeReason` survives an all-family
sweep unchanged.

### Chosen expired-session policy — stated exactly, per the task's

requirement

**Every currently-unrevoked family is included in the sweep, regardless
of `expiresAt`.** No expiry precondition is added to the `updateMany`
filter. This is the simpler of the two policies the accepted readiness
audit left unmandated (§10: "Either choice is correct; this audit does
not mandate one") — chosen because it keeps the filter to a single
condition, matches §21's "revoke everything for this subject" framing
most directly, and because marking an already-expired-but-unrevoked
family as revoked is harmless (it was already unusable) while keeping
`revokeReason` audit-accurate. Verified by a dedicated test: a seeded
expired-but-unrevoked family is confirmed included in `revokedCount`.

### Result and driver-result validation — corrected in SEC-3D.1.1

`updateMany`'s `matchedCount` and `modifiedCount` are now both
**mandatory** (not optional) and validated with
`Number.isSafeInteger(value) && value >= 0` — replacing the original
pass's `Number.isInteger`-only check, which accepted values beyond
`Number.MAX_SAFE_INTEGER` that have already silently lost floating-point
precision. `NaN`, `Infinity`, `-Infinity`, negative counts, fractional
counts, unsafe integers, and a missing/malformed `acknowledged` field all
map to `STORAGE_FAILURE`. `matchedCount` was made mandatory because
Mongoose 8.23.0 (the installed version, confirmed against the repository
lockfile) always includes it in a real `updateMany` result — treating it
as optional was more permissive than the actual installed-version
contract requires.

**Exact classification, deterministic, applied in this order** once both
counts pass safe-integer validation and `modifiedCount <= matchedCount`
is confirmed:

| Condition                                  | Result                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `modifiedCount === 0` (any `matchedCount`) | `REVOKED_ALL_FAMILIES`, `revokedCount: 0` — idempotent success, unchanged from the original pass                      |
| `modifiedCount === matchedCount > 0`       | `REVOKED_ALL_FAMILIES`, `revokedCount: modifiedCount` — full success                                                  |
| `matchedCount > modifiedCount > 0`         | `REVOCATION_PARTIAL`, `revokedCount: modifiedCount` — a genuine same-call partial cleanup, distinct from full success |
| `modifiedCount > matchedCount`             | `STORAGE_FAILURE` — an impossible relationship, never a transition of any kind                                        |

The `matchedCount === 0, modifiedCount === 0` and `matchedCount > 0,
modifiedCount === 0` cases are deliberately **both** classified as the
same idempotent success (`revokedCount: 0`) — the exact classification
this correction was directed to implement — rather than the latter being
treated as a distinct partial/failure case; `revokedCount: 0` already
tells the caller honestly that nothing was modified, regardless of how
many documents matched.

`REVOCATION_PARTIAL`'s result carries only `code` and `revokedCount` —
no `matchedCount`, no subject ID, no filter, no reason — verified by an
exact-key-set test. No reconciliation read, no second mutation, no
retry, and no broadened filter occurs on this path; historical
`revokeReason` values remain untouched exactly as in the full-success
and zero-modified cases.

Driver-result shape is validated defensively before classification:
`acknowledged !== true` maps to `STORAGE_FAILURE`. Verified by a
parameterized test covering 19 distinct malformed-result shapes (`null`,
`undefined`, `{}`, `acknowledged:false`, missing required count fields,
negative/fractional counts, literal `NaN`/`Infinity`/`-Infinity` on
either count field, and two unsafe-integer shapes at and beyond
`Number.MAX_SAFE_INTEGER + 1`), plus a dedicated four-case matrix proving
the exact classification table above (full success, both zero-modified
variants, genuine partial, and the impossible-relationship failure).

### Storage failure

A thrown `updateMany` error normalizes to `STORAGE_FAILURE` with no raw
error text; confirmed called exactly once (no automatic retry).

## 9. Safe result shapes

Verified by exact-key-set assertions throughout the focused tests: every
failure result is `['code']` only; the single-family success result is
`['code']` only (no identifier of any kind); the all-family success and
`REVOCATION_PARTIAL` results are both exactly `['code', 'revokedCount']`
— no `matchedCount`, no subject ID, no filter, no reason. No result, on
any tested branch, ever contains an access token, refresh token, token
hash, `sid`, `jti`, subject ID, database document, raw error, or
query/filter — verified directly by `JSON.stringify`-based exposure
checks against every operation's success and partial results.

## 10. Tests and assertion count

`server/src/__tests__/sessionFamilyRevocation.test.js`: **210 assertions,
all passing** (up from 151 in the original SEC-3D.1 pass — 59 net new
assertions added by the SEC-3D.1.1 correction, itemized below). Covers,
against a deterministic in-memory model double (no live MongoDB
connection, confirmed by `mongoose.connection.readyState ===
0` at the top of the file): contract-shape checks (uniqueness,
immutability, exact allowed-reason sets, fail-closed unsupported
reasons), construction validation (missing model, each individually
missing required method, invalid clock, no `process.env` dependency
verified via a static source-text check), both realms for both
operations, exact filter/update field sets, the full single-family
classification matrix (missing, subject-mismatch-before-disclosure ×4 —
mismatch+active, mismatch+revoked, mismatch+expired, realm mismatch —
**plus, added in SEC-3D.1.1, the two compound cases mismatch+revoked-and-
expired-simultaneously for both subject and realm mismatch, and a
same-subject revoked-and-expired-simultaneously case confirming
already-revoked takes priority over expired**, expired, already-revoked,
classification-stale-via-simulated-race, storage failure on both the
write and the classification read, a malformed-but-truthy driver
result), **added in SEC-3D.1.1: malformed/missing stored `expiresAt`
(three shapes: missing, invalid `Date`, non-Date string) all confirmed
failing closed to `SESSION_EXPIRED`; the exact `expiresAt === now`
equality boundary confirmed expired, matching the primary filter's `$gt:
now`; malformed stored `revokedAt` (two shapes) confirmed failing closed
to `SESSION_ALREADY_REVOKED`, never treated as active; a canonical
uppercase-hex `ObjectId` confirmed accepted**, concurrency (real
`Promise.all`, **extended in SEC-3D.1.1 with exact call-count assertions
— exactly two `findOneAndUpdate` attempts, at most one `findById` by the
loser, exactly one successful transition, and the final stored
`revokeReason` confirmed to belong to whichever operation actually
won**), non-overwrite-on-repeat, the full all-family matrix (zero-count
success including the `matchedCount > 0, modifiedCount === 0` case,
positive-count success, **the deterministic four-branch classification
table added in SEC-3D.1.1: full success, both zero-modified variants,
genuine same-call `REVOCATION_PARTIAL`, and the impossible-relationship
failure**, expired-inclusion policy, historical-revocation preservation,
all 7 supported reasons individually, 19 malformed driver-result shapes
— **up from 9, now including missing required count fields, literal
`NaN`/`Infinity`/`-Infinity`, and unsafe integers beyond
`Number.MAX_SAFE_INTEGER`** — thrown storage error, no retry), and
input-immutability (frozen caller-supplied objects passed through both
operations without error).

## 11. Regression results

SEC-3B (unaffected, re-run to confirm): `refreshSessionSchema.test.js`
(63), `refreshTokenHash.test.js` (15), `jwtSessionProvider.test.js` (66),
`refreshSessionRotation.test.js` (59) — 203 assertions, unchanged.

SEC-3C (unaffected, re-run to confirm): `authCookiePolicy.test.js` (115),
`trustedRequestOriginPolicy.test.js` (30), `sessionSubjectStateProvider.test.js`
(61) — 206 assertions, unchanged.

Five existing auth/model-adjacent tests (`auth.test.js`,
`authRealm.test.js`, `employerAuthRealmIsolation.test.js`,
`emailVerification.test.js`, `duplicateEmailUserIdIndexes.test.js`) — all
pass unchanged.

## 12. Complete safe test-sweep breakdown

`server/src/__tests__/*.test.js` now contains **50 files** (49 existing +
1 new). All 50 were executed individually via `node <file>` and all 50
exited successfully. Of those 50: **49 execute and pass their normal
assertions**; **1** (`employerPortalIntegration.test.js`) is the
pre-existing, genuinely live-MongoDB integration test, gated behind
`EMPLOYER_INTEGRATION_TEST=1` (unset throughout this phase) — it
self-skips and is not presented as database-backed proof of anything in
this report.

## 13. Lint / Prettier / whitespace results

```text
npm run lint (full server/src scope)       → clean, zero errors/warnings
npx prettier --check <4 authorized files>  → 4/4 pass (2 files needed
                                               --write, both newly
                                               authored this session —
                                               safe to format directly,
                                               re-verified passing and
                                               re-tested after formatting)
git diff --check                           → clean; no tracked file
                                               modified
```

## 14. Dormancy proof

```text
grep -rln "SessionFamilyRevocationContracts|SessionFamilyRevocationService|createSessionFamilyRevocationService" .
→ exactly 3 matches: the new service, its contracts module, and the
  new focused test file. No route, controller, middleware, startup path,
  worker, existing auth service, logout/refresh code, access-authorization
  code, tokenStore.js, client, mobile, OAuth, or publishing/B3-E code
  references any symbol from this phase.
```

**Confirmed unchanged**: current logout behavior (`authController.logout`/
`employerAuthController.employerLogout`) is untouched; current refresh
behavior is untouched; the current access-token denylist
(`tokenStore.js`/`config/redis.js`) is untouched; no `tokenVersion`
consumer was added (this phase performs no `tokenVersion` read or write
of any kind); no environment variable requirement was added; no live
revocation path exists anywhere in the running server.

## 15. Explicit non-claims

**This phase implements no `tokenVersion` mutation** — that is SEC-3D.2's
scope, not started. **This phase does not begin SEC-3D.3 or SEC-3D.4** —
no refresh-eligibility coordination, no access-authorization coordinator.
**This phase does not begin SEC-3E** — no route, controller, or
middleware was wired; the two new services remain completely unreachable
from any live request path. **This phase does not change the access-token
denylist** in any way — §12.1's hardening contract from the readiness
audit remains entirely unaddressed, as designed. **This phase makes no
production-readiness claim and no 10/10 claim** — the current live system
remains exactly as under-enforced as the accepted readiness audit's §2.4
live call graph describes.
