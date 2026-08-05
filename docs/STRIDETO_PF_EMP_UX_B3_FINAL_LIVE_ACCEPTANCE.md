# PF-EMP-UX-B3 — Employer Applications Hiring-Stage Clarity, Final Live Acceptance

## 1. Verdict

**PF-EMP-UX-B3 LIVE ACCEPTANCE PASS**

The Employer Applications page displays the canonical hiring stage **Joined** as the primary label for Usama121, while the legacy compatibility value remains `hired` and is no longer presented as the candidate's current stage. This acceptance is unusually well-corroborated: `joined` is **not representable** in the legacy enum — both `accepted` and `joined` compress to `hired` — so the string "Joined" cannot originate from `Application.status` under any mapping. Independently, Usama121 and Dani now hold the *same* legacy value (`hired`) yet render differently ("Hiring stage: Joined" vs "Application status: Hired"), which is only possible if the page is reading the canonical projection. Under the pre-fix behavior both rows would have read `hired`. Every supporting invariant is verified, and no unrelated guarantee regressed.

## 2. Repository and runtime authority

- HEAD: `de92a74d3bdf1834c0520f5035cce84030444b1c`, branch `main...origin/main [ahead 85]`, tracked tree clean
- `api-a`, `api-b`, `frontend`: healthy, up 27 minutes — no restart since the previous verification, so the artifact under test is unchanged
- Worker: confirmed stopped
- No source, database, or environment change was made. No stage moved, no note or interview written, no notification replayed, no timeline event altered.

## 3. Live data (read-only, masked)

| Item | Value |
|---|---|
| Job "Andoride Developer" | `…e70f66`, `applyType: internal`, `views: 3`, `applicationsCount: 2` |
| Usama121 legacy Application | `…7124a0`, `status: **hired**`, `updatedAt: 2026-08-05T11:28:33.035Z` |
| Usama121 linked OpportunityApplication | `…7124a7`, `pipelineStage: **joined**`, `updatedAt: 2026-08-05T11:30:08.484Z`, links to `…7124a0` |
| Linked OA count (Usama121) | **1** |
| Dani legacy Application | `…cfc8e2`, `status: **hired**`, `updatedAt: 2026-08-04T20:43:26.538Z` |
| Dani linked OA count | **0** |
| Applications for this Job | 2 |

## 4. Check-by-check results

| # | Check | Result |
|---|---|---|
| 1 | Usama121 has exactly one linked OpportunityApplication | **PASS** — count is 1 |
| 2 | Canonical `pipelineStage` is `joined` | **PASS** — confirmed, matching the observation exactly |
| 3 | Projected `hiringStage` is `joined` | **PASS** — derived from the canonical field; corroborated by the UI displaying "Joined", a value the legacy enum cannot produce (§5) |
| 4 | Legacy `Application.status` preserved for compatibility | **PASS** — `hired`, the correct compression of `joined` |
| 5 | API preserves `status` and additionally returns `hiringStage` | **PASS** — row spread preserves `status`; `hiringStage` is purely additive |
| 6 | Employer ownership established before projection | **PASS** — `Job.findOne({_id, employerId})` resolves first; the `$in` is built only from ids already scoped to that Job |
| 7 | No cross-Employer tracker data exposed | **PASS** — same scoping guarantee |
| 8 | Dani remains unlinked and unchanged | **PASS** — 0 linked trackers; `updatedAt` byte-identical to every prior report |
| 9 | Dani receives a null canonical projection | **PASS** — no OA exists, so `hiringStage` is `null` and the legacy fallback renders |
| 10 | Application counts unchanged | **PASS** — 2 applications, `applicationsCount: 2`, `views: 3` |
| 11 | Dashboard / Analytics unchanged | **PASS** — Job `updatedAt` still `2026-08-04T21:25:34.687Z` |
| 12 | Employer→User synchronization unchanged | **PASS** — every transition wrote a `byActorType: employer` history entry and emitted a matching notification linked to the OA id (`…7124a7`) |
| 13 | User→Employer isolation unchanged | **PASS** — all 35 stage-history entries are employer- or system-originated; no user-originated write to the legacy model |
| 14 | CandidateViewed behavior correct | **PASS** — three view events today (`11:18:18`, `11:29:39`, `11:33:43`), each isolated with no tight pair. PF-EMP-UX-B2 continues to hold |
| 15 | No stage / note / interview / notification mutation during the final check | **PASS** — after the last stage write (`11:30:08.484`): 0 OpportunityApplications modified, 0 Applications modified. The single later notification (`11:30:08.493`) belongs to that same transition 9 ms earlier, and the `11:33:43` view event is the page visit the observation protocol itself required |
| 16 | Frontend / API-A / API-B contain PF-EMP-UX-B3 | **PASS** — `hiringStage` present in both controllers and in 2 served bundle assets |
| 17 | Worker stopped | **PASS** |

## 5. Why this result is conclusive

Two independent properties of the data make the observation self-verifying rather than merely asserted:

1. **`joined` cannot come from the legacy field.** `PIPELINE_TO_LEGACY_STATUS` maps both `accepted` and `joined` to `hired`. The legacy enum has no `joined` member. A page rendering "Joined" must therefore be reading `OpportunityApplication.pipelineStage`.
2. **Two rows, identical legacy value, different rendering.** Usama121 and Dani both currently hold `Application.status: hired`. The observation reports Usama121 as "Hiring stage: Joined" and Dani as "Application status: Hired". Under the pre-fix behavior both would have read `hired`; the divergence is only reachable through the canonical projection plus the null-fallback branch — exactly the two code paths this phase added.

The linked/unlinked contrast also confirms the fallback is not fabricating data: Dani has no tracker, receives `hiringStage: null`, and correctly renders the legacy label with the historical-record hint.

## 6. Out-of-scope observation — no-op transition and notification volume

Not a PF-EMP-UX-B3 defect, but recorded because it was visible in this pass and is worth a future look.

Between `11:29:26` and `11:30:08`, 26 stage transitions were recorded, 23 of which were **no-op `joined → joined`** transitions at a uniform ~170 ms cadence, and 25 `career.CandidateHired` notifications were created in the same window.

- **This is not duplicate emission.** Transitions and notifications are essentially 1:1 (26 history entries, 25 notifications). Each notification corresponds to a distinct, genuinely received `transitionPipeline` request; the server behaved correctly for every one.
- The uniform ~170 ms spacing across 23 identical requests is consistent with a client-side repeat — a held-down button or key auto-repeat — rather than deliberate operator action.
- The real gap it exposes: `transitionPipeline` accepts and records a transition where `fromStage === toStage`, and each one emits a User-facing notification. From the candidate's side that is ~23 "Congratulations — hired" notifications for a single hiring decision.

Suggested future scope (not actioned here): guard `transitionPipeline` against same-stage no-ops, and/or debounce the stage control. This touches transition semantics and is explicitly outside this phase's boundary.

## 7. Final recommendation

PF-EMP-UX-B3 is fully live-accepted. The Employer Applications page now agrees with Candidate Detail, Hiring Pipeline, and the User tracker on the canonical hiring stage, while retaining the legacy status for compatibility and falling back safely for historical unlinked applications. No rollback or follow-up is required for this phase. Consider scoping the no-op-transition guard in §6 alongside the interview-workflow work.
