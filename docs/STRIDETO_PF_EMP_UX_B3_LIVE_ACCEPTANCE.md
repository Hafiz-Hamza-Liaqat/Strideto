# PF-EMP-UX-B3 — Employer Applications Hiring-Stage Clarity, Live Acceptance

## 1. Verdict

**PF-EMP-UX-B3 LIVE ACCEPTANCE BLOCKED**

The correction is committed, tested (32 assertions), and confirmed deployed on `api-a`, `api-b`, and the served client bundle. Every data-level invariant it depends on is verified correct. However, the submitted manual observations describe a candidate at canonical stage **Assessment** with legacy status **shortlisted**, and the live record has been at neither value at any point since PF-EMP-UX-B3 was deployed — the canonical stage was `interview` when the containers came up and was advanced to `offer` during the session. The stated UI observations therefore cannot be reconciled with the data, so the one thing this acceptance exists to confirm — what the Applications page actually rendered — is unverified. This is an evidence problem, not a defect: nothing observed suggests the fix is wrong, and §7 gives a decisive re-check that can be run immediately without changing any data.

## 2. Repository and runtime authority

- HEAD: `eabfd05613275ef9de7c51c5731556957e50fe89`, branch `main...origin/main [ahead 84]`, tracked tree clean
- Worker: confirmed stopped
- No source, database, or environment change was made during this verification. No stage was moved, no note or interview written, no notification replayed, no timeline event altered.

## 3. Deployment (check 17) — CONFIRMED

Containers rebuilt ~4 minutes before verification, and the PF-EMP-UX-B3 changes are present in all three:

| Target | Evidence |
|---|---|
| `api-a` | `hiringStage` present in `employerController.js`; `findStagesByLegacyApplicationIds` present in the repository |
| `api-b` | identical to `api-a` |
| `frontend` | `hiringStage` present in 2 served bundle assets; a dedicated `StageBadge-*.js` chunk is emitted and served |

## 4. Live data (read-only, masked)

| Item | Value |
|---|---|
| Job "Andoride Developer" | `…e70f66`, `applyType: internal`, `views: 3`, `applicationsCount: 2` |
| Usama121 legacy Application | `…7124a0`, **`status: interview`**, `updatedAt: 2026-08-05T10:21:27.765Z` |
| Usama121 linked OpportunityApplication | `…7124a7`, **`pipelineStage: offer`**, `updatedAt: 2026-08-05T11:18:34.184Z`, links to `…7124a0` |
| Linked OA count for Usama121 | **1** |
| Dani legacy Application | `…cfc8e2`, `status: hired`, `updatedAt: 2026-08-04T20:43:26.538Z` |
| Dani linked OA count | **0** |
| Applications for this Job | 2 |

### Stage history (source of the divergence)

```
2026-08-04 21:28:08  screening  → assessment  (employer)
2026-08-05 10:21:27  assessment → interview   (employer)
2026-08-05 11:18:34  interview  → offer       (employer)
```

The candidate left `assessment` at `10:21:27` — roughly seven hours before PF-EMP-UX-B3 existed in a deployed build. It has not been at `assessment` at any point while this feature was live.

## 5. Check-by-check results

| # | Check | Result |
|---|---|---|
| 1 | Usama121 has exactly one linked OpportunityApplication | **PASS** — count is 1 |
| 2 | `hiringStage` derived from canonical `pipelineStage` | **PASS** — verified in deployed source; the projection maps `legacyApplicationId → pipelineStage` and assigns nothing else |
| 3 | The canonical stage is `assessment` | **NOT MET** — it is `offer`. Not a defect; the employer advanced it (§4) |
| 4 | Legacy `Application.status` remains `shortlisted` | **NOT MET** — it is `interview`, which is the *correct* legacy compression of `offer` |
| 5 | API retains the legacy `status` field unchanged | **PASS** — the row spread preserves it; `hiringStage` is purely additive |
| 6 | API additionally projects the correct canonical stage | **PASS at code level** — deployed and unit-tested; not observable read-only without issuing an authenticated request, which is out of scope here |
| 7 | Employer ownership established before tracker projection | **PASS** — `Job.findOne({_id, employerId})` resolves first; projection runs strictly after |
| 8 | No other Employer's tracker can be projected | **PASS** — the `$in` is built only from ids of Applications already scoped to this Employer's Job |
| 9 | Dani remains unlinked and unchanged | **PASS** — 0 linked trackers; `updatedAt` byte-identical to every prior report |
| 10 | Dani receives no invented canonical stage | **PASS** — no OA exists, so `hiringStage` resolves to `null` and the client falls back to the legacy label |
| 11 | Application counts unchanged | **PASS** — 2 applications, `applicationsCount: 2`, `views: 3` |
| 12 | Dashboard / Analytics unchanged | **PASS** — Job `updatedAt` still `2026-08-04T21:25:34.687Z`; neither metrics service references `hiringStage` |
| 13 | Employer→User synchronization unchanged | **PASS** — the `interview → offer` transition correctly wrote a `byActorType: employer` history entry and emitted `career.OfferSent` |
| 14 | User→Employer isolation unchanged | **PASS** — every stage-history entry is employer- or system-originated; no user-originated write to the legacy model |
| 15 | CandidateViewed behavior unchanged | **PASS** — exactly one view event at `11:18:18.606`, isolated, no duplicate pair. PF-EMP-UX-B2 continues to hold under this build |
| 16 | No stage / notification / note / interview / timeline mutation occurred | **NOT MET** — a stage change (`interview → offer`), a `career.OfferSent` notification, and one `candidate_viewed` event all occurred at `11:18:18`–`11:18:34` |
| 17 | Deployment present | **PASS** (§3) |
| 18 | Worker stopped | **PASS** |

## 6. Why the observations could not be verified

Three stated observations are inconsistent with the record:

1. **"Applications page displayed: Hiring stage: Assessment"** — at container start the canonical stage was `interview`; it became `offer` at `11:18:34`. A correctly-working page would have shown *Interview*, then *Offer*. It could not have shown *Assessment*.
2. **"Candidate Detail displayed Assessment" / "Hiring Pipeline displayed Assessment"** — same reasoning; both read the same canonical field.
3. **Check 4's premise, legacy `shortlisted`** — the legacy value is `interview`.

The `assessment` + `shortlisted` pairing is exactly the example recorded in the original workflow audit (§9), captured before this phase existed. The observations appear to have been carried forward from that description rather than freshly read from the running UI.

One further detail confirms the underlying mechanics are behaving correctly: the legacy `Application.updatedAt` (`10:21:27`) is *older* than the OA `updatedAt` (`11:18:34`). Moving `interview → offer` compresses to the same legacy value `interview`, so the legacy document was never rewritten. That is precisely the compression behavior that makes the two surfaces diverge — and precisely why this fix is needed.

## 7. Decisive re-check available right now

The current state is a **stronger** test case than the one described, and requires no data change:

- canonical `pipelineStage` = **`offer`**
- legacy `Application.status` = **`interview`**

These differ, so the two behaviors are unambiguously distinguishable:

| Applications page shows | Meaning |
|---|---|
| **Hiring stage: Offer** | Fix confirmed working — canonical stage is primary |
| `interview` / `Status: interview` | Old behavior — legacy status still primary |

Steps, changing nothing:

1. Open Employer → Applications, select "Andoride Developer".
2. Read Usama121's row. Record the exact stage text shown.
3. Confirm Dani's row reads **Application status: hired** with the historical hint, and shows no hiring-stage badge.
4. Confirm the action buttons read *Shortlist / Move to interview / Reject / Mark hired*, with none styled as the current stage.
5. Report the exact strings — do not change any stage while checking.

## 8. Final recommendation

Do not treat PF-EMP-UX-B3 as live-accepted yet, and do not treat this as a defect. The committed correction is sound, deployed to all three services, and every data-level invariant it relies on is verified. The only gap is that the submitted UI observations describe a state the system has not been in since deployment, so the rendered output remains unconfirmed. Run §7 — it is a read-only check that resolves the question in one look. Every unrelated guarantee from earlier phases (PF-EMP-UX-B2 view-event correction, Employer→User sync, User→Employer isolation, Dani's historical record) is re-confirmed intact by this pass.
