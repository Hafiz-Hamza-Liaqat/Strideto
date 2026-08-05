# PF-EMP-UX-B2 — Clean Live Entry Rerun

## 1. Verdict

**PF-EMP-UX-B2 LIVE ACCEPTANCE BLOCKED**

The described clean rerun did not reach the system. Zero `hiring.candidate_viewed` events — and zero database activity of any kind — were recorded between the previous verification's checkpoint (`2026-08-05T10:25:44.373Z`) and this one (`2026-08-05T10:37:39.186Z`). A single genuine candidate-detail page entry necessarily produces at least one such event; that mechanism is confirmed deployed and was observed firing three times earlier today under this exact, unchanged deployment. The absence of events therefore indicates the navigation did not occur, **not** a recording failure. Per the stated verdict rules this is BLOCKED ("the window or actions cannot be established reliably"), not DEFECT CONFIRMED (which requires more than one event) and not PASS (which requires exactly one).

## 2. Repository and runtime authority

- HEAD: `a383d522b6c25e5521587cc40df9623d6452704b`, branch `main...origin/main [ahead 81]`, tracked tree clean
- `api-a`, `api-b`, `frontend`: all healthy, **up 25 minutes — no restart since the previous verification**, so the deployment under test is byte-identical to the one already validated
- Worker: confirmed stopped
- No source, database, or environment change was made. No timeline event was read-modified, deleted, or altered.

## 3. Acceptance window

The brief's `Start:` and `End:` fields were submitted as unfilled placeholders (`[ENTER EXACT TIME]`), so the window could not be taken from the protocol. It was instead derived from data, which is sound here because the previous committed acceptance report established a hard, timestamped checkpoint of full system state:

- **Window start (derived):** `2026-08-05T10:25:44.373Z` — the exact server time of the previous verification's final read, after which every prior event was already accounted for
- **Window end:** `2026-08-05T10:37:39.186Z` — this verification's server time
- **Duration:** ~11 minutes 55 seconds

Any candidate-detail entry performed after the previous report was written falls strictly inside this window. The window itself is therefore reliable; what could not be established is that the protocol was executed within it.

## 4. Verification results

| # | Check | Result |
|---|---|---|
| 1 | `hiring.candidate_viewed` events for Usama121 inside the window | **0 events** |
| 2 | Count is exactly one | **NOT MET** — count is 0, not 1 |
| 3 | No tight duplicate pair | **Vacuously true** — no events at all, so no pair. Not evidence of correctness |
| 4 | No stage mutation in the window | **CONFIRMED** — legacy `Application.updatedAt` still `10:21:27.765Z`, unchanged from the prior session |
| 5 | No note/interview mutation in the window | **CONFIRMED** — OA `updatedAt` still `10:22:41.268Z`, note count still 1, both from the prior session |
| 6 | Job Analytics views unchanged | **CONFIRMED** — Job `views` still `3`, `updatedAt` still `2026-08-04T21:25:34.687Z` |
| 7 | Historical events untouched | **CONFIRMED** — all 7 pre-existing Usama121 `candidate_viewed` events retain identical masked IDs and timestamps (`…2aa504`, `…712570`, `…2aa897`, `…2aa8be`, `…3d0f2c`, `…3d0fd9`, `…bbe5d6`); total unchanged at 7 |
| 8 | API-A / API-B contain the deployed fix | **CONFIRMED** — `shouldRecordCandidateView` present in both running controllers; `recordView` present in 2 served client bundle assets |
| 9 | Worker stopped | **CONFIRMED** |

## 5. Corroborating evidence that no session occurred

The zero-event result is not isolated to this candidate or this event type. Across the entire window:

- `timelineEvents` created (all users, all verbs): **0**
- `usernotifications` created: **0**
- `Job.views` / `Job.updatedAt`: unchanged
- `OpportunityApplication.updatedAt`: unchanged
- legacy `Application.updatedAt`: unchanged

No document in any inspected collection was written during the window. This rules out the alternative explanation that a view was recorded but mis-attributed, mis-typed, or written elsewhere.

## 6. Why this is not a recording defect

It is important not to read "0 events" as "view recording is broken." The evidence contradicts that reading:

- The same containers, unrestarted, recorded three `hiring.candidate_viewed` events earlier today at `10:18:47.502`, `10:20:40.187`, and `10:20:40.300`.
- The server-side helper and the client-side parameter are both confirmed present in the running artifacts (check 8).
- The recording path is unconditional on a genuine entry: the client sends `recordView=true` on a fresh mount, and the server records unless the query string is exactly `'false'`.

A recording regression would require a code change; none occurred (no restart, no deploy, tracked tree clean at the same HEAD). The consistent explanation is simply that no candidate-detail page entry was made in the window.

## 7. Outstanding condition and how to close it

Contract A (exactly one `CandidateViewed` per genuine page entry) remains the single open item for PF-EMP-UX-B2. Everything else is already confirmed: mutation refreshes produce no view event (confirmed live in the previous acceptance), Job analytics isolation, historical-data integrity, ownership gating, and deployment.

To close it, execute the protocol as written and confirm it actually ran:

1. Note the current count: **7** `hiring.candidate_viewed` events for Usama121.
2. Close all Strideto tabs; open one new tab.
3. Navigate Employer → Applications → open Usama121's candidate detail with a single click.
4. Do not reload, do not use Back/Forward, do not open a second tab, perform no mutation.
5. Report back — the expected new total is **exactly 8**.

If the total reads 8, contract A passes and PF-EMP-UX-B2 is fully accepted. If it reads 9 or more, a residual duplicate is confirmed. If it still reads 7, the navigation is not reaching the API and that itself becomes the finding to investigate.

## 8. Final recommendation

Do not treat PF-EMP-UX-B2 as fully live-accepted yet, and do not treat this result as a defect in the correction. The committed fix remains sound, deployed, and partially confirmed in live data; no rollback or code change is indicated by anything observed here. The only blocker is that the clean entry described in the protocol produced no server-side trace, so contract A is still unproven. Re-run §7 and report the resulting count.
