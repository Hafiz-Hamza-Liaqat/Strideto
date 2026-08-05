# PF-EMP-UX-B2 — Candidate View Event Correction, Live Acceptance

## 1. Verdict

**PF-EMP-UX-B2 LIVE ACCEPTANCE BLOCKED**

The correction is confirmed deployed on both API instances and in the served client bundle, and the **primary defect it targeted is demonstrably fixed in live data**: the two in-page mutations performed during this session (a stage transition and a private note save) produced **zero** `hiring.candidate_viewed` events, where the pre-fix code would have produced one per refresh. However, this acceptance cannot be marked PASS, because the recorded data materially contradicts the stated manual actions in three ways (§4), which makes the bounded acceptance window unestablishable as specified, and leaves one observation — a 113 ms pair of view events — that cannot be attributed to either a genuine re-entry or a residual duplicate on the evidence available. A clean re-run is required to close contracts A and B.

## 2. Repository and runtime authority

- HEAD: `1ef0e9b3b4f744663cfa52b20f574d1f71be4c50`, branch `main...origin/main [ahead 80]`, tracked tree clean
- `api-a`, `api-b`, `frontend`, `mongodb`: all healthy (APIs and frontend restarted ~12 min before verification)
- Worker: confirmed stopped
- **Fix deployment confirmed, not assumed**: `shouldRecordCandidateView` present in the running controller on both `api-a` and `api-b`; `recordView` present in the served client bundle (`EmployerCandidateDetail-*.js` and `index-*.js` under the frontend's asset root). Both halves of the correction are live.
- No source, database, or environment change was made during this verification. No timeline event was deleted or modified.

## 3. Observed live sequence (Usama121 / "Andoride Developer")

All timestamps UTC, masked IDs, verified read-only. Server clock at verification: `2026-08-05T10:25:44Z`.

| # | Time | Event | Notes |
|---|---|---|---|
| 1 | `10:18:47.502` | `hiring.candidate_viewed` (`…3d0f2c`) | isolated |
| 2 | `10:20:40.187` | `hiring.candidate_viewed` (`…3d0fd9`) | — |
| 3 | `10:20:40.300` | `hiring.candidate_viewed` (`…bbe5d6`) | **113 ms after #2** |
| 4 | `10:21:27.787` | pipeline stage `assessment` → `interview`, `byActorType: employer` | **no view event produced** |
| 5 | `10:22:41.267` | private note added, `visibility: employer_scoped` | **no view event produced** |

Three view events total today, all for this candidate; no `hiring.candidate_viewed` was created for any other user today.

## 4. Discrepancies between stated actions and recorded data

The acceptance brief stated four manual actions. Three do not match what the database records:

1. **"Navigated to the candidate-detail page once"** — three `hiring.candidate_viewed` events were recorded (§3, rows 1-3), not one.
2. **"Added the private Employer note: `PF-EMP-UX-B2 live acceptance`"** — a note *was* stored at `10:22:41.267`, correctly `employer_scoped`, but its body (34 characters) **does not contain the string `PF-EMP-UX-B2 live acceptance`**. The stored note is therefore not the one described. Its content is not reproduced here, per the read-only privacy constraint.
3. **"Did not change the candidate stage"** — a stage change **did** occur at `10:21:27.787`: `assessment` → `interview`, actor type `employer`, with the linked legacy `Application.status` correspondingly updated to `interview` at `10:21:27.765`.

Only the fourth stated action ("did not reload the page or reopen the route") is consistent with a single-mount interpretation — and it is precisely the claim that the 113 ms pair calls into question.

Because the described session did not occur as described, the "latest matching timeline/note timestamps" cannot be used to bound a trustworthy acceptance window for contracts A and B.

## 5. Verification results against the ten required checks

| # | Check | Result |
|---|---|---|
| 1 | Exactly one new `CandidateViewed` for the page entry | **NOT CONFIRMED** — three were created; the described single navigation did not occur |
| 2 | No second `CandidateViewed` from the note-save refresh | **CONFIRMED PASS** — the note save at `10:22:41.267` produced no view event; the last view event precedes it by over two minutes |
| 3 | Private note stored successfully | **CONFIRMED** — one note persisted at `10:22:41.267` (though not the note described, §4.2) |
| 4 | Note remains Employer-scoped/private | **CONFIRMED PASS** — `visibility: employer_scoped` |
| 5 | No pipeline stage changed | **FAILED AS STATED** — stage changed `assessment` → `interview` (§4.3). Not a defect in the fix; a deviation from the stated test protocol |
| 6 | No OpportunityApplication synchronization changed | **CHANGED, correctly** — the OA moved to `interview` with an `employer` stage-history entry, consistent with the stage change in #5 and with the already-accepted PF-TRACK-C3 sync behavior |
| 7 | No Job Analytics view counter changed by `CandidateViewed` | **CONFIRMED PASS** — Job `views` remains `3`, `updatedAt` still `2026-08-04T21:25:34.687Z`, untouched today |
| 8 | Historical duplicate `CandidateViewed` events unchanged | **CONFIRMED PASS** — all four historical Usama121 events (`…2aa504`, `…712570`, `…2aa897`, `…2aa8be`) retain identical IDs and timestamps; Dani's historical count remains 9, matching the pre-fix audit exactly |
| 9 | API-A / API-B healthy | **CONFIRMED PASS** |
| 10 | Worker remains stopped | **CONFIRMED PASS** |

## 6. What this session does and does not prove

**Proved working (the core of PF-EMP-UX-B2):** in-page mutation refreshes no longer record a view. Two separate mutations — a stage transition and a note save — each completed with data reconciled on screen, and neither produced a `hiring.candidate_viewed` event. Under the pre-fix code the note-save `refresh()` reliably produced one (this was the documented root cause in the workflow audit). Contract C is confirmed live. Contract E is unexercised but structurally guaranteed (ownership resolves before emission). Contracts covering Job analytics isolation and historical-data integrity are confirmed.

**Not proved:** contract A (exactly one event per genuine entry) and contract B (same-mount duplicate suppression). The 113 ms pair at `10:20:40` has two mutually exclusive explanations that this data cannot distinguish:

- *Benign*: two genuine component mounts (a browser reload or a route re-entry) 113 ms apart, each correctly recording once — which is the intended behavior under contract D, and would mean the fix is fully working. This requires the stated "did not reload the page or reopen the route" to be inaccurate, which is plausible given §4 already establishes the stated actions are unreliable.
- *Residual defect*: a duplicate still being emitted within one mount despite the guard.

The isolated event at `10:18:47` followed ~2 minutes later by a pair is not a pattern a single uninterrupted page entry produces under either the old or the new code, so no confident inference is available. Declaring PASS on this evidence would assert a guarantee the data does not support.

## 7. Required re-run to close acceptance

A clean, minimal sequence, with nothing else touched between steps:

1. Note the current `hiring.candidate_viewed` count for the candidate.
2. Open the candidate-detail page exactly once. Do not reload, do not navigate away and back, do not open a second tab.
3. Re-check the count — expect **exactly +1**.
4. Add a private note containing a distinctive marker string. Change nothing else; in particular **do not change the stage**.
5. Re-check the count — expect **+0** (still the value from step 3).

Steps 3 and 5 together close contracts A/B and re-confirm C. Step 5's behavior is already confirmed by this session; step 3 is the outstanding gap.

## 8. Final recommendation

Do not treat PF-EMP-UX-B2 as live-accepted yet. The committed correction is sound, deployed, and its principal effect is confirmed in production data — no rollback or code change is indicated by anything in this session. The blocker is purely evidentiary: the executed session diverged from the stated protocol, so the one remaining contract (single-event page entry) needs the clean re-run in §7. Historical duplicate events remain intentionally untouched, as designed.
