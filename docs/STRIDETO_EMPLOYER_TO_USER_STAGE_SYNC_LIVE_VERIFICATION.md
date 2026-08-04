# STRIDETO Employer→User Stage Sync Live Verification (PF-TRACK-C1)

## 1. Verdict

**EMPLOYER→USER STAGE SYNC DEFECT CONFIRMED**

The Employer-side pipeline transition code is correct and was exercised three times live (Interview → Accepted → Joined) for the real internal application described in the scenario (Job "Andoride Developer" — stored with a typo for "Android Developer" — candidate Dani). Every one of the three transitions correctly updated the Employer-facing `Application`, correctly selected the matching notification event type, and fired a notification to Dani. **None of the three transitions could reach the User's personal tracker, because no linked `OpportunityApplication` has ever existed for this application.** Read-only correlation confirms the root cause precisely: `dualWriteFromLegacyJobApplication` — the function that would have created that linked tracker record at apply time — starts with `if (!isApplicationDualWrite()) return null;`, and the live `api-a` container has `APPLICATION_DUAL_WRITE=0` set explicitly. With no linked `OpportunityApplication`, every subsequent Employer→User sync attempt correctly finds nothing to update, and every notification's link falls back from the (null) `opportunityApplicationId` to the `legacyApplicationId` — a value Dani's own `/applications/:id` route cannot resolve, since that route expects an `OpportunityApplication` id. This is confirmed by three independent, consistent notification records, not a single ambiguous data point.

## 2. Repository authority

- HEAD: `93e396a68349e723a0370c0b662d10651dc55350`, parent `caa9c09f5a37082010c6a33cb19780926dcb1793`
- Branch: `main...origin/main [ahead 73]`, tracked tree clean, staged: none
- Preserved untracked: both prior reports, present and unmodified
- `.env.staging`: ignored, untouched
- No source, test, Docker, environment, or database record was modified during this verification.

## 3. Runtime state

Confirmed via `docker ps` (full path used — `docker` was not on this session's `PATH`, resolved via `C:\Program Files\Docker\Docker\resources\bin\docker.exe`, no configuration changed):

| Service | Status |
|---|---|
| frontend | Up, healthy |
| api-a | Up, healthy |
| api-b | Up, healthy |
| mongodb | Up, healthy |
| redis | Up, healthy |
| mailpit | Up, healthy |
| caddy | Up |
| worker | **not listed — confirmed stopped** |

Additionally, read-only `printenv` on `api-a` confirmed the live feature-flag values directly relevant to this verification: `OPPORTUNITY_APPLICATION_ENABLED=1`, `EMPLOYER_INTELLIGENCE_ENABLED=1`, **`APPLICATION_DUAL_WRITE=0`**.

## 4. Live scenario

- Job: stored title **"Andoride Developer"** (typo; the Employer clearly intended "Android Developer" — confirmed the most recently created Job for this Employer, `applyType: internal`)
- Candidate: **Dani**
- Employer-facing `Application`: exists, one record
- **Current live stage has progressed beyond the "Interview" moment described in the task brief** — by the time this verification ran, the Employer had moved the candidate through Interview → Accepted → Joined (legacy `status` is now `hired`, the terminal legacy value both `accepted` and `joined` map to). This is reported factually rather than re-described as "Interview only," since the live data is the authority per this task's own instructions. All three transitions are independently examined below, and all three show the identical defect pattern, which strengthens rather than weakens the finding.

## 5. Employer stage-update route

Two active Employer stage-update paths exist; the scenario evidence ("Dani in the Interview pipeline column" of Hiring Intelligence) matches the canonical Hiring Intelligence path, which is the one traced in full:

- Route: `POST /employer/intelligence/candidates/:id/stage` (`server/src/routes/employerIntelligence.js:31`)
- Controller: `employerIntelligenceController.transitionPipeline` (`server/src/controllers/career/employerIntelligenceController.js:41`)
- Service: `EmployerIntelligenceService.transitionPipeline` (`server/src/services/career/EmployerIntelligenceService.js:413-475`)

A second, legacy path also exists and was **not** the one used in this scenario but shares the same downstream sync/notification machinery for the stages it supports: `PATCH /employer/applications/:id` → `employerController.updateApplicationStatus` (`server/src/routes/employer.js:156`) → `syncOpportunityApplicationFromLegacyStatus` (fire-and-forget, unlike the canonical path's awaited sync). Not further traced here per the task's scope (the live scenario used Hiring Intelligence, not the legacy Applications page).

## 6. Ownership boundary

`getOwnedLegacyApplication(employerId, legacyApplicationId)` (`EmployerIntelligenceService.js`) resolves the `Application`, populates `jobId`, and throws a 404 unless `application.jobId.employerId` matches the authenticated `req.employer.employerId` (from `...auth` middleware on the route, server-derived only — no client-supplied `employerId` is read anywhere in this path). Confirmed unchanged from every prior audit in this series; no ownership defect found.

## 7. Application linkage

- Linkage field: `OpportunityApplication.legacyApplicationId`
- Lookup: `OpportunityApplicationRepository.findByLegacyApplicationId(application._id)` (`server/src/repositories/career/OpportunityApplicationRepository.js:158-160`) — a plain `findOne({ legacyApplicationId })`
- **Confirmed live: this lookup returns nothing for the Android Developer application, because no `OpportunityApplication` document anywhere in the database has `legacyApplicationId` set to this (or any) Application's id.**
- Root cause traced to source: `ApplicationMigrationService.dualWriteFromLegacyJobApplication` (`server/src/services/career/migration/ApplicationMigrationService.js:193-209`) opens with `if (!isApplicationDualWrite()) return null;`. `isApplicationDualWrite()` (`server/src/config/careerFeatureFlags.js:27-31`) returns `false` whenever `process.env.APPLICATION_DUAL_WRITE === '0'` — confirmed set exactly that way on the live `api-a` container (§3). This means `applyToJob`'s dual-write step (already confirmed correct and awaited in the prior role-tracking audit) silently no-ops in this environment by design of the flag, not by any code defect in the apply controller itself.

## 8. Stage mapping

Traced `PIPELINE_TO_LEGACY_STATUS`/`LEGACY_STATUS_TO_PIPELINE` (`shared/employer/constants.js`) and `PIPELINE_STAGES`/`TERMINAL_PIPELINE_STAGES` (`shared/career/constants.js:130-149`):

| Canonical stage | Employer `Application.status` (legacy, 7-value enum) | OpportunityApplication `pipelineStage` | Direct mapping | Notification event (`eventForPipelineStage`) | Terminal |
|---|---|---|---|---|---|
| interested | not representable | yes | n/a (Employer side has no equivalent) | none | no |
| preparing | `submitted` | yes | compressed | none | no |
| applied | `applied` | yes | 1:1 | none | no |
| viewed | `viewed` | yes | 1:1 | none | no |
| screening | `shortlisted` | yes | compressed (shares `shortlisted` with assessment) | `CandidateShortlisted` | no |
| assessment | `shortlisted` | yes | compressed | none | no |
| **interview** | **`interview`** | **yes** | **1:1, exact string match both directions** | **`InterviewScheduled`** | no |
| offer | `interview` | yes | compressed (shares `interview` with negotiation) | `OfferSent` | no |
| negotiation | `interview` | yes | compressed | `OfferSent` | no |
| accepted | `hired` | yes | compressed (shares `hired` with joined) | `OfferAccepted` | no |
| joined | `hired` | yes | compressed | `CandidateHired` | **yes** |
| rejected | `rejected` | yes | compressed (shares `rejected` with withdrawn) | `CandidateRejected` | **yes** |
| withdrawn | `rejected` | yes | compressed | `CandidateRejected` | **yes** |

`interview → interview` is the cleanest mapping in the whole table — a direct, unambiguous, non-lossy string match in both directions. The mapping itself is not the source of any defect; the defect is entirely upstream, in the missing linkage (§7).

## 9. Synchronization contract

Confirmed directly from `EmployerIntelligenceService.transitionPipeline` (lines 413-475), for every one of the three real live transitions (interview, accepted, joined) applied to this application:

1. `application.status = legacyStatus; await application.save();` — **awaited**, always executes regardless of OA linkage.
2. `const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);` — **awaited**, returns `null` for this application every time (§7).
3. `if (oa) { ...push stage history... }` — **skipped entirely** every time, since `oa` is `null`. This is not a failure of the sync call; the code correctly and safely no-ops when there is nothing to sync.
4. `emitHiringEvent(hireEvent, { ..., opportunityApplicationId: oa?._id ? String(oa._id) : null, ... })` — fires regardless of linkage, with `opportunityApplicationId: null`.

No worker or queue is involved anywhere in this path: `emitCareerEvent` (`CareerEventBus.js:27-59`) invokes all subscribed handlers synchronously, in-process, in the same request. `careerNotificationBridge.js`'s handler (`notifyUser(...)`) is not awaited by the emitter (fire-and-forget from the emitter's perspective) but begins executing in the same tick — confirmed consistent with the notifications actually existing in the database within roughly a second of each transition.

## 10. User notification contract

`careerNotificationBridge.js:88-115` resolves the notification's link as:
```
applicationId = event.payload?.opportunityApplicationId || event.payload?.legacyApplicationId || event.aggregateId
link: applicationId ? `/applications/${applicationId}` : '/applications'
```
Since `opportunityApplicationId` is `null` for every transition on this application, the link falls back to `legacyApplicationId` — the Employer-facing `Application`'s own id, not anything Dani's own `/applications/:id` route (which expects an `OpportunityApplication` id) can resolve. Confirmed live, three times (§14).

## 11. Read-only Job correlation

| Field | Value |
|---|---|
| Masked Job ID | `…e70f66` |
| Title (as stored) | "Andoride Developer" |
| applyType | `internal` |
| Employer (masked) | `…1d69b7` |
| status | `active` |
| approvalStatus | `approved` |
| applicationsCount (stored counter) | `1` |

## 12. Read-only Employer Application correlation

| Field | Value |
|---|---|
| Masked Application ID | `…cfc8e2` |
| Masked Job ID | `…e70f66` (matches) |
| Masked User/candidate ID | `…e9eb` (name: **Dani**, confirmed via safe name-only lookup) |
| Current status | `hired` (has progressed past `interview`, see §4) |
| Last updated | `2026-08-04T20:43:26.538Z` |
| Created | `2026-08-04T20:20:11.284Z` |
| Ownership through Job | confirmed — Job `…e70f66.employerId` = `…1d69b7`, matching the Employer that owns the Hiring Intelligence view |
| Linked OpportunityApplication id present on this record | not applicable — `Application` has no such field by design (linkage is stored on the `OpportunityApplication` side only, via `legacyApplicationId`) |

## 13. Read-only OpportunityApplication correlation

**No `OpportunityApplication` document exists for this Job/candidate pair.** Confirmed exhaustively: Dani (`…e9eb`) has exactly 4 `OpportunityApplication` records total in the database, none titled "Andoride Developer"/"Android Developer" and none referencing Job `…e70f66`:

| Title | Stage | Source | legacyApplicationId |
|---|---|---|---|
| Video Editor | joined | external | null |
| Research Associate HEC | viewed | external | null |
| Graphic Designer | screening | external | null |
| Fron Dest Operator | assessment | external | null |

Every one of Dani's tracker records is `source: 'external'` with `legacyApplicationId: null` — consistent with every prior audit's finding that no internal-apply dual-write has ever successfully completed in this environment (now root-caused to `APPLICATION_DUAL_WRITE=0`, §7). Database-wide, all 9 `OpportunityApplication` documents have `legacyApplicationId: null` — zero linked records exist anywhere, not just for this one application.

## 14. Read-only notification correlation

All notifications for Dani (`…e9eb`) in the relevant window, safe fields only:

| Type | Category | Title | Link | Read | Created |
|---|---|---|---|---|---|
| `career.InterviewScheduled` | interview | "Interview scheduled" | `/applications/…cfc8e2` (legacy Application id) | unread | 20:29:14.968Z |
| `career.InterviewScheduled` | interview | "Interview scheduled" | `/applications/…cfc8e2` | unread | 20:29:18.891Z |
| `career.OfferAccepted` | application | "Offer accepted" | `/applications/…cfc8e2` | unread | 20:43:26.557Z |
| `career.CandidateHired` | application | "Congratulations — hired" | `/applications/…cfc8e2` | unread | 20:44:25.320Z |

No `application.submitted` notification exists for this application at all (the apply-time notification, from a separate `automationService.onJobApplication` call) — consistent with, but not conclusively proving, the same disabled-dual-write condition affecting related apply-time behavior; not further chased, out of this task's scope.

**Observation, not the primary finding:** the two `InterviewScheduled` notifications are near-duplicates, four seconds apart. No conclusive root cause was pursued (could be a UI double-submit; the notification-creation code itself has no visible double-fire path per source, §9) — flagged as a minor, secondary, inconclusive observation only.

Every link present (`/applications/…cfc8e2`) references the **Employer-facing Application id**, confirmed identical to the masked Application id in §12 — none references any `OpportunityApplication` id, because none exists to reference.

## 15. User→Employer isolation

**CORRECT AND ENFORCED.** Re-confirmed from source (unchanged since the original role-tracking audit — no commit in this series touched it): `OpportunityApplicationService.transitionStage` (the User's own tracker stage-change endpoint) writes exclusively to `OpportunityApplicationRepository`; no code path in that file or `opportunityApplicationController.js` ever writes to the `Application` model. A User moving their own private tracker card cannot overwrite an Employer's official stage, and — moot in this specific case, since no linked tracker exists for this application at all — there is nothing for Dani to move that would even reach the Employer side.

## 16. Source-wired versus live-confirmed matrix

| Item | Source-wired | Live-confirmed this session |
|---|---|---|
| Employer stage update → `Application.status` | Yes | **Yes** — 3/3 transitions correctly persisted |
| Ownership scoping | Yes | Not independently re-exercised (unchanged from prior audits, no new risk introduced) |
| `interview` → `interview` mapping | Yes | Not directly observable (no OA exists to show the value in), but the mapping table itself is proven correct by direct source read |
| Employer→User `OpportunityApplication` sync | Yes (correctly a safe no-op when `oa` is null) | **Yes — confirmed the no-op path is what actually executed, 3/3 times** |
| Notification creation | Yes | **Yes — 4 notifications confirmed created** |
| Notification link correctness | Designed to prefer `opportunityApplicationId` | **Confirmed defective in this live data — falls back to the wrong id every time, because the preferred value is always null here** |
| Dual-write (apply-time OA creation) | Yes, correctly gated behind `isApplicationDualWrite()` | **Confirmed disabled** — `APPLICATION_DUAL_WRITE=0` on `api-a` |
| User→Employer isolation | Yes | Correct by source; nothing live to move in this case |

## 17. Test inventory

No test directly exercises the specific combination this verification examined. Related existing coverage found by targeted search:
- `employerOaSyncFailure.test.js` — proves the legacy `syncOpportunityApplicationFromLegacyStatus` path degrades safely when the OA lookup fails; does not cover the canonical `transitionPipeline` path used here, nor the notification-link fallback.
- No test asserts `careerNotificationBridge.js`'s link-fallback behavior when `opportunityApplicationId` is null (the exact defect confirmed live in this report).
- No test asserts `transitionPipeline`'s behavior when `oa` is null across the `interview`/`accepted`/`joined` stage set specifically.

Smallest missing tests, for a future fix phase: (1) a focused test asserting `careerNotificationBridge` never links a User notification to a legacy `Application` id — either omit the link or explicitly signal "no tracker view available" — when `opportunityApplicationId` is absent; (2) a focused test/fixture proving `transitionPipeline` behaves identically (correct `Application` update, safe OA no-op, correct event type) whether or not `APPLICATION_DUAL_WRITE` is enabled. No test was added or modified in this verification, per its documentation-only scope.

## 18. Findings by priority

- **P0:** none. No cross-Employer or cross-User leakage found; ownership boundaries confirmed intact.
- **P1:**
  - Employer stage changes cannot reach the linked User tracker for this (and, database-wide, every) internal application, because no linkage has ever been established — root-caused to `APPLICATION_DUAL_WRITE=0` on the live `api-a` container, not a defect in the Employer-side sync code itself (Classification **A — LINKAGE MISSING**, with a confirmed environmental root cause).
  - Every resulting notification opens the wrong destination — the Employer-facing `Application` id, which Dani's own `/applications/:id` route cannot resolve — confirmed on 4/4 notifications observed (Classification **F — NOTIFICATION CREATED, LINK INCORRECT**).
- **P2:** two near-duplicate `InterviewScheduled` notifications four seconds apart — inconclusive root cause, flagged for awareness only, not confirmed as a systemic defect.
- **P3:** test coverage gaps named in §17.

## 19. Smallest next phase

Given the confirmed defect is layered — an environment/configuration condition (`APPLICATION_DUAL_WRITE=0`) sitting upstream of a genuine, always-present code gap (the notification link fallback) — the smallest evidence-based next phase should address the code gap, which is worth fixing regardless of the flag's intended long-term state: **PF-TRACK-C2 — make `careerNotificationBridge.js` never link a User notification to a legacy `Application` id.** When `opportunityApplicationId` is unavailable, the notification should either omit the deep link (fall back to `/applications`, which it already does when *no* id at all is available) or the emitting call sites should stop passing `legacyApplicationId` as a fallback candidate. Whether `APPLICATION_DUAL_WRITE` should be `1` in this environment is a separate, environment-configuration decision outside this report's or a documentation-only phase's authority to change.

## 20. Final recommendation

Do not claim the Employer→User synchronization pathway is fully connected end-to-end in this environment — it is correctly *coded* but not currently *linked*, and the resulting notifications are confirmed live to point at the wrong destination. Proceed with **PF-TRACK-C2** to close the confirmed notification-link defect, and separately confirm with the product/ops owner whether `APPLICATION_DUAL_WRITE=0` is intentional for this staging environment or should be re-enabled — no code change can substitute for that flag being on if internal-apply tracker linkage is expected to work here.
