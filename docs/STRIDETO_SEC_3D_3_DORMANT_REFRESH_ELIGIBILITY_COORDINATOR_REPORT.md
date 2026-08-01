# STRIDETO SEC-3D.3 — Dormant Refresh-Eligibility and Post-Rotation Revalidation Coordinator

**Status**: implemented, dormant, unwired. Not production-ready. Not live. No route, controller, or middleware imports this module. No database connection is made by this module or its tests.

**Authority**: `docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md`, §11, §14.4, §18.

## Purpose

Composes four already-checkpointed dormant primitives — `JwtSessionProvider`, a plain `RefreshSession` read, `SessionSubjectStateProvider`, and `RefreshSessionRotationService` — into one coordinator implementing the full mandatory sequence, including the post-rotation authoritative revalidation (§11.2) that the original architecture pass omitted. Reimplements none of their algorithms.

## Files

| File                                                         | Kind                 |
| ------------------------------------------------------------ | -------------------- |
| `server/src/services/auth/RefreshEligibilityContracts.js`    | new                  |
| `server/src/services/auth/RefreshEligibilityCoordinator.js`  | new                  |
| `server/src/__tests__/refreshEligibilityCoordinator.test.js` | new — 172 assertions |

No route, controller, middleware, or startup file is touched.

## Dependencies

`JwtSessionProvider` (required, no safe default — carries signing secrets), `RefreshSession` model (defaults to the real model), `SessionSubjectStateProvider` (defaults to a real instance), `RefreshSessionRotationService` (defaults to a real instance), and `SessionFamilyRevocationService` (defaults to a real instance) — used **only** on the post-rotation-mismatch cleanup path, never before rotation, never for ordinary ineligibility, never for a benign conflict, never for replay (SEC-3B's own exclusive path, never duplicated here).

SEC-3D.2 is never imported.

## Public method

`attemptRefresh({presentedRefreshToken})` — the single external input. Every other value (`realm`, `sub`, `sid`, `tokenVersion`) comes from the token's own verified claims, never a separate caller-supplied argument.

## Exact sequence

1. Validate input (non-empty string).
   2/3. Verify the refresh JWT and its claims (`JwtSessionProvider.verifyRefreshToken`) — any failure maps to `REFRESH_TOKEN_INVALID`.
2. Load the `RefreshSession` family by `sid`; bind `subjectType`/`subjectId` against the verified claims — `SESSION_MISSING` / `SUBJECT_MISMATCH`.
3. Validate session state from the already-loaded document (`revokedAt`, `expiresAt`, `tokenVersionAtIssue`) — a cheap early rejection; the rotation CAS re-verifies the same conditions atomically.
   5/6. Authoritative pre-rotation subject-state read via `SessionSubjectStateProvider`, `expectedTokenVersion` bound to the claim's own value — any non-`SUBJECT_ACTIVE` outcome is returned unchanged.
4. Issue a new refresh token, hash both the presented and new tokens, delegate to `RefreshSessionRotationService.rotate()` — every non-`ROTATED` outcome (`CONFLICT_BENIGN`, `REPLAY_DETECTED`, `SESSION_MISSING`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `VERSION_MISMATCH`, `STORAGE_FAILURE`, `CLASSIFICATION_STALE`, `INVALID_INPUT`) is passed through **unchanged** — no reclassification, no duplication of SEC-3B's own replay logic.
   8/9. Mandatory authoritative post-rotation reread, same `expectedTokenVersion` as steps 5/6, no further I/O in between.
5. On match (`SUBJECT_ACTIVE`): issue the new access token and deliver `{code: 'REFRESH_ROTATED', accessToken, refreshToken}`.
6. On a **proven** eligibility mismatch — exactly `SUBJECT_MISSING`, `SUBJECT_INACTIVE`, `SUBJECT_STATE_INVALID`, or `TOKEN_VERSION_MISMATCH` — conditionally call `revokeCurrentFamily({realm, subjectId, sessionFamilyId, reason: 'refresh_final_state_mismatch'})` — the exact narrowly-scoped reason added as part of this phase's authority correction. Every cleanup outcome (`REVOKED_CURRENT_FAMILY`, `SESSION_ALREADY_REVOKED`, or a genuine cleanup failure — thrown, `STORAGE_FAILURE`, or any other non-success code — internal only) maps to the identical external `REFRESH_FINAL_STATE_MISMATCH`, no token, no cleanup detail exposed.
7. On an **indeterminate** final reread — `STORAGE_FAILURE`, a thrown exception, a missing/`null`/`undefined`/non-object result, or any unrecognized code — the coordinator does **not** call cleanup and does **not** label the outcome as a proven mismatch. A storage or read failure proves only that eligibility could not be confirmed; it does not prove the subject became ineligible, and revoking the just-rotated family on that basis would both destroy a legitimate session over a transient infrastructure fault and store a `revokeReason` that misrepresents what actually happened. This path returns `{code: 'STORAGE_FAILURE'}` only — no token, no cleanup, no relabeling.

**Correction (SEC-3D.2-A/3D.3-A finding, applied in this pass)**: the initial implementation treated _any_ non-`SUBJECT_ACTIVE` final-reread outcome — including `STORAGE_FAILURE` and unrecognized results — as a proven mismatch, which caused it to revoke a legitimately-rotated family on a mere read failure and store a false `refresh_final_state_mismatch` reason. The coordinator now classifies the final reread into exactly three categories (match / proven mismatch / indeterminate) using an explicit, finite `FINAL_ELIGIBILITY_MISMATCH_CODES` allowlist, and only the second category ever triggers cleanup.

No successor token is ever constructed or returned before step 9 completes, on any path.

## Call bounds (no retry, no loop, exactly bounded)

| Path                                                                     | `findById` | `getSubjectState` | `rotate` | `revokeCurrentFamily` |
| ------------------------------------------------------------------------ | ---------: | ----------------: | -------: | --------------------: |
| Pre-rotation failure                                                     |          1 |                 1 |        0 |                     0 |
| Rotation-not-ROTATED                                                     |          1 |                 1 |        1 |                     0 |
| Success                                                                  |          1 |                 2 |        1 |                     0 |
| Post-rotation proven mismatch                                            |          1 |                 2 |        1 |                     1 |
| Post-rotation indeterminate (`STORAGE_FAILURE`/thrown/unknown/malformed) |          1 |                 2 |        1 |                 **0** |

Verified by exact call-count assertions in the focused test for every row above, including the indeterminate row (six sub-cases: `STORAGE_FAILURE`, an unrecognized code, `null`, `undefined`, `{}`, and a string result, plus a separately-tested thrown-exception case), plus an explicit exact-call-order assertion for the success path.

## Result taxonomy

`REFRESH_ROTATED` (success, carries `accessToken`/`refreshToken`), `REFRESH_FINAL_STATE_MISMATCH` (a _proven_ mismatch, `{code}` only), plus the reused pass-through codes: `INVALID_INPUT`, `REFRESH_TOKEN_INVALID`, `SESSION_MISSING`, `SUBJECT_MISMATCH`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `VERSION_MISMATCH`, `CONFLICT_BENIGN`, `REPLAY_DETECTED`, `CLASSIFICATION_STALE`, `SUBJECT_MISSING`, `SUBJECT_INACTIVE`, `SUBJECT_STATE_INVALID`, `TOKEN_VERSION_MISMATCH`, `STORAGE_FAILURE`. Every failure result is exactly `{code}`; only success carries the two token fields, which is the operation's own intended deliverable, not a leak.

`STORAGE_FAILURE` is reachable from three genuinely distinct causes, all correctly collapsed to the same honest code: a pre-rotation read failure, a rotation-service storage failure (passed through from SEC-3B unchanged), and — as of this correction — an indeterminate final reread. This is not a false claim of one meaning for three causes; all three share the identical truthful semantic ("this call could not confirm the outcome"), and none of them ever implies a proven security event the way `REFRESH_FINAL_STATE_MISMATCH` does.

## Residual race

Documented explicitly, per §11.3: an authoritative invalidation event can still commit after step 9's read and before/during delivery of the HTTP response carrying the successor tokens — no finite number of rereads closes this without a transaction, which this repository's topology does not support. The enforceable, achieved guarantee is **zero stale-positive authorization**, not zero stale-credential-bytes delivery: any credential delivered in this narrow window fails its very next authorization check (SEC-3D.4) or refresh attempt (this coordinator's own step 5/6), since both always read fresh, authoritative state.

## Sensitive-data protection

No result exposes a token hash, `jti`, subject ID, realm, or raw error. Confirmed via exact `Object.keys` assertions on every failure result.

## Verification evidence

- Focused suite: 172 assertions passed.
- `npm run lint` — clean.
- `npx prettier --check` — clean.
- `node --check` — clean.
- Dormancy: zero matches for `RefreshEligibility` outside `services/auth/`, `__tests__/`, and its own report; confirmed no import from any route/controller file.

## Non-claims

Not production-ready, not live, not wired into `authController.refreshToken`/`employerAuthController.employerRefreshToken`. Does not eliminate the residual delivery-window race (architecturally unachievable without a transaction this repository doesn't support) — only the authorization-time guarantee is claimed, matching §11.3 exactly.
