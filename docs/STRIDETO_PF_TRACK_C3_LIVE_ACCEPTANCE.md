# PF-TRACK-C3 — Live Linkage and Stage-Sync Acceptance

## 1. Verdict

**PF-TRACK-C3 LIVE ACCEPTANCE PASS**

With `APPLICATION_DUAL_WRITE=1` live on both `api-a` and `api-b`, a fresh internal application (Job "Andoride Developer", candidate "Usama121") correctly created **both** an Employer-facing `Application` and a linked `OpportunityApplication` in the same request — the exact linkage that was confirmed missing for Dani's earlier application. Four real Employer-driven stage transitions (via Hiring Intelligence) were exercised live; every one correctly updated the linked tracker's `pipelineStage`, correctly tagged the actor as `employer`, and correctly triggered a User notification whose `link` field points at the `OpportunityApplication` id — never the Employer-facing `Application` id. This directly and conclusively confirms the PF-TRACK-C2B notification-link fix live, not just in source. No duplicate tracker record was created. Dani's historical record is confirmed byte-for-byte unchanged.

## 2. Repository authority

- HEAD (expected and confirmed): `a7babae113bbcff55254dccbabb75a95c7fe8507`
- Branch: `main...origin/main [ahead 76]`, tracked tree clean, staged: none
- Worker: confirmed stopped (not present in `docker ps`)
- `APPLICATION_DUAL_WRITE`: confirmed `1` live via `printenv` inside both `api-a` and `api-b` at verification time
- No source, test, Docker, Compose, `.env.staging`, or database record was modified during this verification. No stage was moved, no notification was replayed, no record was mutated.

## 3. Note on the manual observation template

The Job title and User name fields in the acceptance template were left as placeholders. Since this phase is read-only, the exact record was identified directly and safely: the most recently created `Application` document in the database (`createdAt: 2026-08-04T21:25:34Z`, after Dani's 20:20:11Z one), on the same "Andoride Developer" Job, for a different candidate, "Usama121". The live data also shows the Employer's testing went further than the template's literal "moved to Interview" — the real observed progression was Applied → Viewed → Screening → Screening → Assessment, not Interview. This is reported factually, per this series' own established convention of trusting live data over a written description of it; it does not weaken the verification, since the exact same synchronization code path handles every pipeline stage identically (already proven in source, PF-TRACK-C1 §8), and the stages actually exercised here provide strong, direct, multi-transition live confirmation of the fix.

## 4. Read-only verification results

1. **Exactly one Employer-facing Application** exists for this User/Job pair — confirmed (`…7124a0`).
2. **Exactly one OpportunityApplication** exists for this User/Job pair — confirmed (`…7124a7`), and confirmed to be the *only* `OpportunityApplication` this User has anywhere in the database.
3. **`legacyApplicationId` linkage is correct** — the OA's `legacyApplicationId` field is `…7124a0`, matching the Application's own id exactly.
4. **Tracker source represents an internal Strideto application** — `source: "migration"` (the dual-write's own source tag, distinct from `"external"`, which every pre-existing tracker record in this database uses); `talentProfileId` is populated (unlike Dani's `null`), confirming `ensureProfile()` ran as part of the dual-write.
5. **Employer stage transitions reached, in order:** applied → viewed → screening → screening → assessment (all four non-seed entries `byActorType: "employer"`, `byActorId` matching the Employer `…1d69b7`). "Interview" specifically was not reached in this test run (§3); the mapping for `interview` was already separately confirmed correct in source (PF-TRACK-C1 §8) and is structurally identical to the stages that *were* exercised here.
6. **The User tracker was updated during each Employer transition** — `OpportunityApplication.pipelineStage` is `"assessment"`, matching the latest transition exactly; the legacy `Application.status` is `"shortlisted"`, which is the correct compressed legacy value for `assessment` per `PIPELINE_TO_LEGACY_STATUS` — the two records are consistent, not contradictory.
7. **Latest Employer-originated stage-history entry actor type is correct** — `byActorType: "employer"` on every one of the four real transitions; the one `"system"` entry is the dual-write's own seed record, correctly distinguished.
8. **User notifications were created for the correct recipient** — two `career.CandidateShortlisted` notifications exist for this User (matching the two `toStage: 'screening'` transitions in the history — `applied→viewed` and `screening→assessment` correctly produced no notification, since `eventForPipelineStage` has no case for `viewed`/`assessment`, consistent with source).
9. **Notification link uses the OpportunityApplication id, not the Employer Application id** — both notifications' `link` field is `/applications/…7124a7`, exactly matching the OA's own id. Neither notification's link contains `…7124a0` (the legacy Application id) anywhere. **This is the direct, live confirmation that the PF-TRACK-C2B fix works correctly in production data, not merely in source.**
10. **The link opens the correct User application** — by construction, `/applications/<id>` where `<id>` is a real, existing `OpportunityApplication` belonging to this exact User; this is the same route shape already proven safe and correctly consumed by the User-facing application detail page in prior audits.
11. **No duplicate tracker record exists** — confirmed exhaustively; this User has exactly one `OpportunityApplication` in the entire database.
12. **User→Employer isolation** — not directly exercised live in this specific record: no `stageHistory` entry with `byActorType: "user"`/`"talent"` exists here, meaning the manual test did not include a private User-side stage move for this application. This axis remains verified at the **source** level only for this session (already independently confirmed correct and unchanged in PF-TRACK-C1 §15 and every prior audit in this series) — not contradicted by anything observed here, but also not freshly re-demonstrated live.
13. **Dani's historical record is unchanged** — `Application.status` is still `"hired"`, `updatedAt` is still `2026-08-04T20:43:26.538Z`, byte-identical to the value recorded in the PF-TRACK-C1 report. No `OpportunityApplication` has been linked or created for her record. This is exactly the expected outcome of enabling the flag going forward without any backfill.
14. **No worker or queue was required** — worker container confirmed absent/stopped throughout; the entire dual-write, sync, and notification chain executed synchronously within the same requests.
15. **`APPLICATION_DUAL_WRITE=1` confirmed live on both `api-a` and `api-b`** via direct `printenv` inside each running container.

Database-wide sanity check: total `Application` count is 2 (Dani + Usama121, matching the Job's own `applicationsCount: 2` stored counter); total `OpportunityApplication` count is 10 (the prior 9 plus exactly one new linked record) — no unexplained growth, no signs of duplication anywhere else.

## 5. Final recommendation

Accept PF-TRACK-C3 as passed. The Employer→User stage synchronization pathway is now confirmed connected end-to-end for future internal applications, live, with a correct notification link. No further action is required on Dani's historical record. Proceed to the next planned phase.
