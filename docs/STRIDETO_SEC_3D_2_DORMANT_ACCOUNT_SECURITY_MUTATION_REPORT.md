# STRIDETO SEC-3D.2 — Dormant Bounded TokenVersion and Atomic Subject-Security Mutation Primitives

**Status**: implemented, dormant, unwired. Not production-ready. Not live. No route, controller, or middleware imports this module. No database connection is made by this module or its tests.

**Authority**: `docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md`, §8, §14.3, §18 (checkpointed at commit `d44c362`).

## Purpose

Provides the atomic `tokenVersion` and subject-security-field (`accountStatus`, `role`, `password`) mutation primitives that later live phases (SEC-3E) will wire into the existing authentication handlers. This module never calls SEC-3D.1 and never touches `RefreshSession` documents — session-family cleanup remains a separate, later composition step owned by SEC-3E.

## Files

| File | Kind |
| --- | --- |
| `server/src/models/User.js` | modified, additive only — `max: Number.MAX_SAFE_INTEGER` added to the existing `tokenVersion` field definition |
| `server/src/models/Employer.js` | modified, additive only — same single change |
| `server/src/services/auth/AccountSecurityMutationContracts.js` | new — result codes, realm/role/status enums, the hardened guard expression, validators, error class |
| `server/src/services/auth/AccountSecurityMutationService.js` | new — the dependency-injected service implementing all eight operations |
| `server/src/__tests__/accountSecurityMutation.test.js` | new — 245 assertions against in-memory model doubles |

No other file is touched.

## Public operations

Seven exported functions covering eight conceptual operations (reactivation is one function selecting between two modes via a boolean, matching the checkpointed §5.1 design):

- `incrementTokenVersionForLogoutAll({realm, subjectId, expectedTokenVersion})` — caller-held expected version; concurrent and sequential duplicate calls presenting the same claim collapse to one real increment.
- `incrementTokenVersionForAdminRevoke({realm, subjectId})` — service performs its own fresh preread every invocation; concurrent same-baseline calls collapse, but sequential separately-authorized invocations each increment independently. This is a distinct method contract from logout-all, not a shared primitive with an optional parameter.
- `changePassword({subjectId, expectedTokenVersion, newPassword})` — User realm only. Zero automatic retries, ever.
- `resetPassword({hashedToken, newPassword})` — User realm only. One write, zero classification reads, zero retries (Design 1); every filter miss returns `RESET_TOKEN_INVALID` uniformly.
- `suspend({realm, subjectId})` — both realms.
- `reactivate({realm, subjectId, alsoInvalidateAccessTokens = false})` — both realms. Mode A (`false`, default) never reads, guards, classifies, or mutates `tokenVersion` at all. Mode B (`true`) is shape-identical to `suspend`.
- `changeRole({subjectId, expectedPriorRole, newRole})` — User realm only (`Employer` has no `role` field).

## Hardened `tokenVersion` guard

`VALID_TOKEN_VERSION_EXPR` is the exact checkpointed nested `$cond` expression, deep-frozen (not merely `Object.freeze`d at the outer level — every nested array and object is individually frozen, verified by a dedicated test that a mutation attempt on any nested branch has no effect and that extending a nested array throws). `$mod` is reached only after `$isNumber` and the range check both pass, so no malformed stored value can trigger a runtime expression error. Applied identically to every write that increments `tokenVersion`.

## Result taxonomy

Exactly 15 unique codes (`VERSION_INCREMENTED`, `VERSION_ALREADY_ADVANCED`, `VERSION_CONFLICT`, `VERSION_REGRESSION`, `SUBJECT_STATE_UPDATED`, `SUBJECT_STATE_ALREADY_APPLIED`, `SUBJECT_STATE_CONFLICT`, `SUBJECT_STATE_INVALID`, `SUBJECT_STATE_MALFORMED`, `VERSION_EXHAUSTED`, `RESET_TOKEN_INVALID`, `SUBJECT_MISSING`, `CLASSIFICATION_STALE`, `INVALID_INPUT`, `STORAGE_FAILURE`). Every public result is exactly `{code}` — proven throughout the test suite via `deepStrictEqual` against the exact expected object, which fails on any extra key.

## Call order and exact bounds

| Operation | Pre-read | Primary write | Classification read | Retry | Maximum calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| Logout-all | 0 | 1 | 1 | 1 | 3 |
| Admin revoke | 1 | 1 | 1 | 1 | 4 |
| Password change | 0 | 1 | 1 | 0 | 2 |
| Password reset | 0 | 1 | 0 | 0 | 1 |
| Suspend | 0 | 1 | 1 | 1 | 3 |
| Reactivate (either mode) | 0 | 1 | 1 | 1 | 3 |
| Role change | 0 | 1 | 1 | 1 | 3 |

Every bound is structurally guaranteed by the code (no loops, no recursion, a fixed sequential path) and independently verified by exact call-count assertions in the focused test for every operation, including dedicated classify-to-retry interleaving tests for logout-all, admin-revoke, suspend, reactivate Mode B, and role change — each using a model double that mutates state specifically between the classification read and the retry write (not a hardcoded return value), and each asserting one exact deterministic result and exact call counts. Retry-miss always returns `CLASSIFICATION_STALE`; no operation ever attempts a third write or a second classification read.

## Password boundary

`bcryptjs` at cost 12, matching the existing model hooks exactly. Input validation occurs before any hashing call. A synchronous hashing throw and a rejected hashing promise both map to `STORAGE_FAILURE` with zero write attempted. The default hasher is proven against real `bcryptjs` output (`/^\$2[aby]\$12\$/`) in one dedicated test; all other tests inject a fast deterministic hasher. No plaintext or hash ever appears in a result.

## State-operation boundary

`accountStatus`/`role` classification follows one fixed, integrity-before-state-comparison precedence: subject missing → `tokenVersion` malformed (where relevant) → `tokenVersion` exhausted (where relevant) → field outside its enum (`SUBJECT_STATE_INVALID`, reusing the checkpointed SEC-3C `SessionSubjectStateProvider.js` naming precedent) → already at target → retry-eligible → conflict. No state operation binds a caller-held `expectedTokenVersion` equality clause, preserving legitimate different-event concurrency.

## Sensitive-data protection

No result, thrown error, or log line contains a password, password hash, reset token, `tokenVersion` value, subject ID, realm, filter, update, model document, raw driver error, or stack trace — confirmed by the exact `{code}`-only assertions throughout.

## Verification evidence

- Focused suite: `node src/__tests__/accountSecurityMutation.test.js` — 245 assertions passed.
- `npm run lint` — clean.
- `npx prettier --check` on all three new files — clean.
- `node --check` on all three new files — clean.
- `git diff --check` — clean.
- Regression suite (13 named files) — all pass unchanged, confirming the additive model change introduces no regression.
- Dormancy: zero matches for `AccountSecurityMutation` under `controllers/`, `routes/`, `middleware/`, `index.js`, `worker.js`, `config/`, `client/`, `mobile/`.
- No SEC-3D.1 runtime import: confirmed by direct source inspection and a dedicated regex-based test.

## Non-claims

This module is not production-ready, not live, not wired into any route or handler, and makes no claim about SEC-3E's eventual composition correctness. It does not implement SEC-3D.3 or SEC-3D.4. Macro Phase 1B is not complete.
