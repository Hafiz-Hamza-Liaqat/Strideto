# PF-EMP-UX-B2 — Final Clean Entry Live Acceptance

## 1. Verdict

**PF-EMP-UX-B2 LIVE ACCEPTANCE PASS**

A single clean candidate-detail page entry produced **exactly one** `hiring.candidate_viewed` event. The total for Usama121 moved from the previously confirmed 7 to exactly 8, the new event is isolated (no tight pair), and no other write of any kind occurred anywhere in the database during the window. Combined with the previously confirmed result that in-page mutation refreshes produce zero view events, every contract for PF-EMP-UX-B2 is now satisfied against live data. The correction is fully accepted.

## 2. Repository and runtime authority

- HEAD: `53268c95eeaeea03be3558e78516b646d56dbe2d`, branch `main...origin/main [ahead 82]`, tracked tree clean
- `api-a` / `api-b`: healthy, up 36 minutes; `frontend`: healthy, up 35 minutes — **no restart during the window**, so the artifact under test is byte-identical to the one validated in both prior acceptance passes
- Worker: confirmed stopped
- No source, database, or environment change was made. No timeline event was altered or deleted; no previous acceptance report was modified.

## 3. Acceptance window

The brief's `Start:` / `End:` fields were submitted as unfilled placeholders (`[PASTE START UTC]` / `[PASTE END UTC]`). The window was therefore derived from data, which is reliable here because the immediately preceding committed report established a hard, timestamped checkpoint together with a confirmed total:

- **Window start (derived):** `2026-08-05T10:37:39.186Z` — the previous verification's final read, at which the confirmed total was exactly 7
- **Window end:** `2026-08-05T10:48:01.812Z` — this verification's server time
- **Duration:** ~10 minutes 23 seconds

Because the prior report pinned both the timestamp and the count, any event after that instant is unambiguously attributable to this rerun. The window is fully verifiable without the operator-supplied times.

## 4. Result

| # | Check | Result |
|---|---|---|
| 1 | `hiring.candidate_viewed` events for Usama121 inside the window | **1** — `…bbe8c7` at `2026-08-05T10:46:24.706Z`, `actorType: employer` |
| 2 | New count is exactly one | **PASS** |
| 3 | Total changed from 7 to exactly 8 | **PASS** — confirmed 8 |
| 4 | No tight duplicate pair | **PASS** — the new event is isolated; the nearest preceding event (`…bbe5d6`, `10:20:40.300`) is **25 min 44 s** earlier |
| 5 | No stage / note / interview / notification / other candidate mutation in the window | **PASS** — exactly one write occurred database-wide in the window, and it is the view event itself (details in §5) |
| 6 | Job Analytics views unchanged | **PASS** — `views` still `3`, `applicationsCount` still `2`, `updatedAt` still `2026-08-04T21:25:34.687Z` |
| 7 | Historical events unchanged | **PASS** — all 7 pre-existing events retain identical masked IDs and timestamps (`…2aa504`, `…712570`, `…2aa897`, `…2aa8be`, `…3d0f2c`, `…3d0fd9`, `…bbe5d6`) |
| 8 | API-A / API-B / client still contain the deployed fix | **PASS** — `shouldRecordCandidateView` present in both running controllers; `recordView` present in 2 served client bundle assets |
| 9 | Worker stopped | **PASS** |

## 5. Isolation evidence

Across the entire window, exactly **one** document was written anywhere in the inspected collections — the view event under test:

- `timelineEvents` created (all users, all verbs): **1** (the `hiring.candidate_viewed` above)
- `usernotifications` created: **0**
- `OpportunityApplication.updatedAt`: still `2026-08-05T10:22:41.268Z` (unchanged from the earlier session) — no stage, note, or interview mutation
- `interview.scheduledAt`: still `null`
- legacy `Application.updatedAt`: still `2026-08-05T10:21:27.765Z` (unchanged) — no status mutation
- `Job.updatedAt`: still `2026-08-04T21:25:34.687Z` — CandidateViewed did not touch the Job view counter

This confirms the observed event is attributable solely to the page entry, with no confounding activity.

## 6. Contract status — complete

| Contract | Status | Evidence |
|---|---|---|
| A — genuine entry records exactly one event | **CONFIRMED** | This report: 7 → 8, single isolated event |
| B — same-mount duplicate suppressed | **CONFIRMED** | This report: one entry, one event, no pair — the pre-fix behavior produced tight pairs (four such pairs remain visible in the historical data) |
| C — post-mutation refresh records no event | **CONFIRMED** | Prior acceptance: a stage transition and a note save each produced zero view events |
| D — later genuine re-entry may record again | **CONFIRMED** | This report: a new entry ~25 min after the previous one correctly recorded a fresh event |
| E — unauthorized / missing candidate records nothing | Structurally guaranteed | Ownership resolves and `!card` throws before emission (source-verified in the recovery review) |

The behavioral contrast is decisive: under the pre-fix code, single sessions reproducibly generated tight pairs ~50–115 ms apart (four such pairs are preserved in the historical data). Under the fix, one entry produced one event, and two separate mutations produced none.

## 7. Historical data

The four pre-fix duplicate pairs remain intentionally untouched, as designed — this phase corrected forward behavior only and performed no history rewrite. The three events from `10:18:47`–`10:20:40` (recorded during the first, protocol-divergent acceptance attempt) likewise remain in place and are not re-interpreted here; they were inconclusive at the time and are now superseded by this clean, isolated result.

## 8. Final recommendation

PF-EMP-UX-B2 is fully live-accepted. No follow-up, rollback, or code change is indicated. Proceed to PF-EMP-UX-B3 — clarify legacy `Application.status` versus the canonical pipeline stage on the Employer Applications page.
