# STRIDETO Role Tracking Connection Audit (PF-TRACK-A)

## 1. Verdict

**ROLE TRACKING WIRING CORRECT — SEMANTICS/LIVE DATA ACCEPTANCE REQUIRED**

Every observed zero is fully explained by source and confirmed by bounded read-only data correlation, not merely "plausible." All four Jobs owned by the Employer account visible in the screenshots (`AI Engineer`, `Ads Generator`, `Video Editor`, `Graphic Designer`) are stored with `applyType: 'external'`. The internal `applyToJob` controller unconditionally rejects apply attempts on any Job with `applyType === 'external'` (`server/src/controllers/applicationsController.js:53-55`), so the Employer-facing `Application` model — and therefore every dashboard/Hiring-Intelligence counter derived from it — can never receive a document for these Jobs. The legacy `Application` collection is empty across the entire database (0 documents), and all 8 existing `OpportunityApplication` (personal tracker) records are `source: 'external'` with no `legacyApplicationId`, including the exact three the User observed (Graphic Designer → `applied`, Video Editor → `joined`, Research Associate HEC → `applied`, the last belonging to a different Employer entirely). This is **Classification E — EXTERNAL/NOT TRACKED BY DESIGN**, not a defect: the User self-tracked external applications in their private tracker, and the Employer-facing system correctly and transparently declines to represent them (`getJobApplications` returns an explicit disclosure message, not a silent zero). No internal apply→dual-write path has ever been exercised in this environment, so the "Total Applications moves off zero once an internal application exists" acceptance step from the prior Dashboard audit (`PF-EDM-C`) remains outstanding — that is a live-data gap, not a wiring gap. One non-blocking architectural inconsistency was found (§17, §20) and one already-known freshness gap was reconfirmed (§21); neither is a defect requiring a code fix under this audit's own classification rules.

## 2. Repository authority

- HEAD: `5609421021865723f3457f6473986c80d60a59c6`
- Parent: `d6fd79e8588e942762ffb60911ddc57efb0800dd`
- Branch: `main...origin/main [ahead 63]`
- Tracked tree: clean; staged: none
- Preserved untracked (present, unmodified): `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- `.env.staging`: ignored, untouched
- Worker: confirmed stopped (not present in `docker ps` output) at both start and end of this audit
- Preflight matched the required values exactly; no stop condition triggered.

## 3. Observations reviewed

All observations in the task brief were checked against source and, where source alone was insufficient, against bounded read-only data (§23). Every one of them is explained below with a root cause, not merely restated.

## 4. Role-system inventory

### ADMIN
1. Job submission moderation — `server/src/controllers/admin/moderationController.js` (`bulkApproveJobs`/`bulkRejectJobs`), scoped by `STAFF_ROLES`.
2. Job approval — sets `approvalStatus: 'approved'`; triggers `automationService.onJobApproved` (Employer notification/email).
3. Job rejection — sets `approvalStatus: 'rejected'` via `Job.updateMany`; audit-logged (`logAudit`).
4. Application visibility — **none**. Direct search of `moderationController.js` for `Application`/`OpportunityApplication` returned zero matches.
5. Candidate-stage administration — **none**, same evidence.
6. Dashboard/reporting related to applications — **none** found in the moderation controller; Admin has no application-count reporting surface in the files inspected.
7. Notifications relevant to moderation — Admin/staff receive a `job.submitted` notification (`onJobSubmitted` → `notifyStaff`); Employer receives `job.approved`/`job.rejected`-class notifications per the prior notification audit (rejection notification itself was found **missing** in that audit — unrelated to tracking, not re-litigated here).

### USER
1. Internal Job application — `applyToJob` (`server/src/controllers/applicationsController.js:14-114`), gated on `job.applyType !== 'external'`.
2. External Job application — no internal record of the external act itself; the User applies off-platform and optionally self-reports via Track.
3. Manual Track — `OpportunityApplicationService.create` (Track button on `JobDetail.jsx` and equivalents), creates only an `OpportunityApplication`.
4. Mark as applied — a `transitionStage` call to `applied` on an existing tracker record; self-reported, same model.
5. `OpportunityApplication` creation — either via Track, via manual create (`CreateApplication.jsx`), or via the dual-write side effect of `applyToJob`/internship apply.
6. Personal stage movement — `OpportunityApplicationService.transitionStage` (`server/src/services/career/OpportunityApplicationService.js:186-230`), writes only to `OpportunityApplication`.
7. Application history — `stageHistory[]` on the `OpportunityApplication` document, each entry tagged `byActorType`.
8. Withdraw/archive — supported stage-machine transitions (`withdrawn`) plus an `archivedAt` field observed on the model.
9. Interview/reminder/offer/joined stages — all live on the `OpportunityApplication`'s `pipelineStage`/`stageHistory`, validated by `shared/career/applicationStageMachine.js`.
10. Notifications — career-milestone notifications route through `careerNotificationBridge.js` → `notifyUser`, confirmed correct in the prior opportunity-tracking audit; not re-verified here (out of this audit's targeted scope per the "do not reopen notification implementation" instruction).

### EMPLOYER
1. Job creation — `employerController.createJob`; `Job.create({ status:'draft', approvalStatus:'pending', applyType, ... })`.
2. Internal vs. external configuration — `Job.applyType` (`enum: ['external','internal']`, **default `'external'`** — `server/src/models/Job.js:68`), or inferred via `resolveJobApplyType()` (`server/src/services/employerApplicationCounts.js:9-13`) from `applicationLink`/`applyEmail` when `applyType` itself is unset.
3. Employer-facing `Application` records — legacy `Application` model (`server/src/models/Application.js`), unique per `{userId, jobId}`.
4. Applications page — `client/src/pages/Employer/EmployerApplications.jsx` → `employerController.getJobApplications`.
5. Candidate filters — `EmployerIntelligenceService.listCandidates` (`server/src/services/career/EmployerIntelligenceService.js:271-312`).
6. Hiring Intelligence — `client/src/pages/Employer/EmployerIntelligence.jsx` → `useEmployerDashboardComposition` → `GET` intelligence-dashboard composition → `EmployerDashboardCompositionService.js`.
7. Pipeline stage counts — `pipelineMetricsProvider`/`hiringOverviewProvider` in `EmployerDashboardCompositionService.js:80-107`.
8. Shortlist / 9. Interview / 10. Offer / 11. Hired/joined — all via `employerController.updateApplicationStatus` (legacy path, `status` enum) or `EmployerIntelligenceService.transitionPipeline` (canonical pipeline-stage path); both write the same `Application.status` field and best-effort-sync the linked `OpportunityApplication`.
12. Dashboard metrics — `employerController.getDashboard` → `computeEmployerDashboardMetrics` (`server/src/services/employerDashboardMetrics.js`).
13. Per-Job application counts — `enrichEmployerJobsWithApplicationCounts` (`server/src/services/employerApplicationCounts.js:49-70`), used by the Jobs list and duplicated inline in the Dashboard's Recent Job Posts.
14. Notifications — Employer receives `job.approved` (implemented), `job.rejected` (missing per prior audit), candidate-side notifications are User-only; no Employer notification UI consumer exists (prior audit finding, unaffected by tracking).

For ownership/ID/status-field detail per system, see §22.

## 5. Job application method contract

`resolveJobApplyType(job)`:
```
if job.applyType is 'internal' or 'external' → return it
else if applicationLink or applyEmail is set → 'external'
else → 'internal'
```
(`server/src/services/employerApplicationCounts.js:9-13`)

Independently, `applyToJob` gates purely on `job.applyType === 'external'` (`applicationsController.js:53-55`) — it does **not** call `resolveJobApplyType`. These two checks agree in every case actually observed in this database (every inspected Job has `applyType` explicitly set, so the fallback-inference branch of `resolveJobApplyType` was never exercised here). They would only diverge for a Job with `applyType` left unset/`'internal'` but `applicationLink`/`applyEmail` populated — `applyToJob` would permit an internal apply (creating a real `Application`) while `resolveJobApplyType` would still classify the Job as external everywhere else (Dashboard, Hiring Intelligence, per-Job counts, "not tracked" label), causing a genuine, real Employer-facing application to be excluded from every Employer-facing count. **No Job in the current database is in this state** (confirmed by direct query, §23), so this is a **latent inconsistency, not an active defect** — flagged in §20/§26 as P3, not claimed as the cause of the observed zeros.

## 6. Internal application lifecycle

Traced `applyToJob` end to end (`applicationsController.js:14-114`):

1. Resolve resume source → load `Job` → `assertJobAcceptingApplications` (vacancy/deadline check) → **hard reject if `job.applyType === 'external'`** (line 53) → reject duplicate (`Application.findOne`) → `Application.create({status:'submitted', ...})` (durable, line 62) → `Job.findByIdAndUpdate($inc applicationsCount)` (line 78) → **awaited** `ApplicationMigrationService.dualWriteFromLegacyJobApplication(application, job)` (line 81, comment: "await dual-write so Apply → Tracker redirect can use OA id") → badge awards → `onJobApplication(...).catch(() => {})` (fire-and-forget notification) → `res.status(201).json({ id, opportunityApplicationId, trackerUrl })`.

Answers:
1. Internal-Job condition: `job.applyType !== 'external'` (checked at line 53).
2. External Jobs cannot reach this flow — hard 400 before any write.
3. `Application.create` is mandatory — it happens before the dual-write and is not wrapped in a try/catch that swallows failure; an exception here aborts the whole request (500).
4. `OpportunityApplication` dual-write is **awaited, not best-effort** — its failure would throw and abort the response (no surrounding try/catch around line 81-84). This is stronger than "best-effort"; it is a synchronous requirement for a 201 response.
5. `Application` (legacy) is created first, `OpportunityApplication` second.
6. The only genuinely swallowed failure is the notification (`onJobApplication(...).catch(() => {})`, line 105) — data persistence failures are not swallowed.
7. Linking IDs: `Application.userId`/`Application.jobId` (direct refs); `OpportunityApplication.legacyApplicationId` (points back to the `Application`); Employer ownership is derived transitively via `Job.employerId`, never stored directly on `Application`.
8. `Application` has **no `employerId` field** (`models/Application.js`) — Employer ownership is always derived through `Job.employerId` (confirmed in `getJobApplications`, `updateApplicationStatus`, `EmployerIntelligenceService.getOwnedLegacyApplication`, all of which populate/join `jobId` and compare `job.employerId`).
9. One `Application` per `{userId, jobId}` — enforced by a unique compound index (`applicationSchema.index({userId:1, jobId:1}, {unique:true})`).
10. Dashboard and Hiring Intelligence both read the same `Application` model — confirmed: `employerDashboardMetrics.js` and `EmployerDashboardCompositionService.js` both `import { Application } from '../models/Application.js'` (or `../../models/Application.js`) and query it directly.
11. An internal application should appear immediately for the owning Employer — no queue/worker/async processing sits between `Application.create` and any Employer-facing query; the write is synchronous and awaited.
12. Cache/refetch **can** delay visibility on the client: the Employer Dashboard refetches on route re-entry (fixed by the commit at HEAD, §21), but Hiring Intelligence and the Applications page do not (§21).
13. The apply route does **not** return success when only the private tracker exists but Employer-facing creation failed — `Application.create` happens first and un-guarded; if it fails, the whole request 500s before any tracker write is attempted.
14. Notification success is fully independent of data persistence (fire-and-forget, `.catch(() => {})`).

**Classification: FULL DUAL-WRITE** (stronger than "best-effort" — the tracker write is awaited and un-caught, meaning a tracker failure currently fails the whole apply request rather than silently degrading to Employer-Application-only; this is a design characteristic worth naming, not a defect).

## 7. Manual Track lifecycle

Traced Track (`OpportunityApplicationService.create`, invoked from `JobDetail.jsx`'s `handleTrackApplication` and equivalents for other opportunity types):

1. Creates a legacy `Application`? **No** — confirmed no `Application`-model import/write exists in `OpportunityApplicationService.js` or `opportunityApplicationController.js`.
2. Employer notified? **No** — no notification call in this path targets `recipientType: 'employer'`.
3. Employer Dashboard totals change? **No** — Dashboard reads `Application` exclusively (§9 of prior Dashboard audit, re-confirmed here).
4. Hiring Intelligence changes? **No** — same reason (§17 below).
5. Visible in Employer Applications page? **No** — `getJobApplications` also reads `Application` exclusively.
6. Job application method matters for whether Track is the *only* option: yes — for `applyType:'external'` Jobs, Track is the only way any record enters the system at all (apply is hard-blocked).
7. External Jobs remain private: **yes, and this is the entire explanation for the observed zeros** (§20).
8. User can set Applied/Joined without Employer confirmation: **yes** — `transitionStage` enforces only the stage-machine's own validity rules (`applicationStageMachine.js`), not any Employer-originated event.
9. Self-reported: yes, explicitly — `byActorType` on each `stageHistory` entry defaults to the User's own actor context for any transition the User initiates.
10. Private "Joined" vs. Employer-confirmed hired/joined: **not distinguished at the summary level**, only inside `stageHistory[].byActorType` (matches the finding already documented in the prior opportunity-tracking audit; not re-litigated as a new finding here).

**Stated per instruction:** A personal tracker entry (Track/self-report) is not, and is not presented as, an Employer-visible application unless the internal-apply dual-write path created both records. Confirmed true by source and by the fact that all 8 live `OpportunityApplication` records in this database have `source: 'external'` and no `legacyApplicationId`.

## 8. OpportunityApplication personal tracker

Confirmed shared across Job/Scholarship/Admission/Internship (unchanged from the prior opportunity-tracking audit; re-confirmed here only for the Job type via the schema fields actually read from the live database, §23: `pipelineStage`, `source`, `status`, `title`, `companyName`, `externalUrl`, `legacyApplicationId`, `stageHistory`, `appliedAt`). This audit did not re-inspect the Scholarship/Admission/Internship-specific code paths (out of scope per the task brief's instruction to document only whether they reuse the tracker, not re-audit them) — they do, per the prior audit's already-established finding.

## 9. Employer-facing Application

- Model: `server/src/models/Application.js` — `userId`, `jobId`, `status` (`submitted|applied|viewed|shortlisted|rejected|interview|hired`), `appliedDate`, no `employerId` field.
- Controllers: `applicationsController.applyToJob` (create, User-authenticated), `employerController.getJobApplications`/`updateApplicationStatus` (read/update, Employer-authenticated, ownership via `Job.employerId`), `EmployerIntelligenceService.transitionPipeline`/`getCandidateDetail` (canonical pipeline path, same model, same ownership check pattern via `getOwnedLegacyApplication`).
- Source of truth for "did this User submit an internal application to this Job": this model, exclusively.
- Can another role modify it: Employer (status/pipeline transitions), the User implicitly via `applyToJob`/`assertJobAcceptingApplications`-gated withdrawal paths (not traced further, out of scope); Admin — **no**, confirmed (§4 ADMIN #4).

## 10. Admin moderation role

1. Admin only moderates Jobs — **confirmed**, no `Application`/`OpportunityApplication` reference anywhere in `moderationController.js`.
2. Admin sees individual candidate applications — **no**.
3. Admin can change candidate stages — **no**.
4. Admin Job approval affects Application visibility — **indirectly only**: approval does not touch `Application` at all; it only changes whether a Job is public/servable, which is a precondition for future applications to exist, not a retroactive visibility toggle on existing ones.
5. Rejected Jobs' existing applications remain visible — **not applicable in this environment** (no rejected Job in this database currently has any `Application`), but by source: `bulkRejectJobs` only touches `Job.approvalStatus`/`status`, never `Application`, so any pre-existing `Application` documents would remain fully intact and Employer-visible after rejection. This is an inference from source, not a live-confirmed case (no rejected Job with applications exists to test against).
6. Admin approval changes a Job from external to internal — **no**, `bulkApproveJobs`/`bulkRejectJobs` do not touch `applyType`/`applicationLink`/`applyEmail` (confirmed by the same grep that found zero `Application` references — the function's only write targets are `approvalStatus`/`status`).
7. Moderation status can prevent an application from appearing — only indirectly, via the pre-existing `approvalStatus`/`status` gates on whether the Job (and therefore its apply route) is reachable at all; not a direct visibility filter on `Application` records.
8. Admin metrics duplicate Employer metrics — **no**, Admin has no application-count reporting surface in the files inspected.
9. Admin has no synchronization obligation between User and Employer tracking — **confirmed correct**, no such code path exists, and none is implied by the current contract.

No Admin candidate-tracking responsibility is invented here, per instruction.

## 11. User stage lifecycle

Stages observed in `shared/career/applicationStageMachine.js`'s `job_default` template (per the prior opportunity-tracking audit, re-confirmed applicable here since `transitionStage` calls the same `ApplicationStageMachineService`): interested → preparing → applied → viewed → screening → assessment → interview → offer → negotiation → accepted → joined, plus rejected/withdrawn as terminal/side transitions.

1. Stages existing only in the personal tracker: none of the above are Employer-model stages by name — the Employer side uses a **different enum entirely** (`Application.status`: `submitted|applied|viewed|shortlisted|rejected|interview|hired`), mapped via `LEGACY_STATUS_TO_PIPELINE`/`PIPELINE_TO_LEGACY_STATUS` (`shared/employer/constants.js`, referenced from `EmployerIntelligenceService.js:17-20`).
2. Employer `Application` does not use the same raw enum — it uses a mapping table, not identity.
3. User stage changes do not update `Application` — confirmed, `transitionStage` (§6 of the prior audit, re-confirmed at `OpportunityApplicationService.js:186-230`) only writes `OpportunityApplication`.
4. Should they update Hiring Intelligence — not per the current, explicitly-documented product boundary (§14).
5. Should they update Dashboard Shortlisted/Interviews/Offers/Hired — same answer, no.
6. User can self-report Joined without Employer confirmation — **yes** (§7.8-7.9).
7. Self-reported stages are not labeled as such anywhere except `stageHistory[].byActorType` — unchanged finding from the prior audit.
8. User notifications for these transitions only confirm the private change (career-milestone notifications, out of this audit's scope to re-verify content, already confirmed correct in the prior notification audit).

**Confirmed, exactly as previously documented:** Employer stage update → User tracker sync: implemented/best-effort (§12). User tracker stage update → Employer pipeline sync: not implemented, and this is the correct boundary, not a gap (per the task brief's own instruction not to invent this as a defect).

## 12. Employer candidate-stage lifecycle

Two Employer-side write paths exist for the same underlying `Application.status` field:

**Legacy path** — `employerController.updateApplicationStatus` (`employerController.js:289-319`): validates `status ∈ {shortlisted, rejected, interview, hired}`, writes `Application.status`, then `void syncOpportunityApplicationFromLegacyStatus(...)` (fire-and-forget, not awaited — genuinely best-effort here, unlike §6's apply-time dual-write), then `onApplicationStatusChange(...).catch(() => {})`.

**Canonical pipeline path** — `EmployerIntelligenceService.transitionPipeline` (`EmployerIntelligenceService.js:401-473`): validates `toStage ∈ PIPELINE_STAGES`, maps to a legacy status via `PIPELINE_TO_LEGACY_STATUS`, writes `Application.status`, then **directly and synchronously** pushes a `stageHistory` entry onto the linked `OpportunityApplication` (awaited `OpportunityApplicationRepository.pushStageHistory`, not fire-and-forget) tagged `byActorType: 'employer'`, forcing the transition (`oaSync = allowed ? 'synced' : 'forced'`) even if the User's own stage-machine template would have blocked it — an explicit design comment states "Employer owns hiring stage projection."

Both paths funnel through `getOwnedLegacyApplication`/`Application.findById(...).jobId.employerId` ownership checks — no client-supplied `employerId` is trusted in either.

1. Employer filters use `Application.status` (legacy) directly, or `pipelineStage` (derived, canonical) — both exist and are consistent via the shared mapping table.
2. Hiring Intelligence uses the canonical `pipelineStage` values (via `PIPELINE_STAGES`, `LEGACY_STATUS_TO_PIPELINE`).
3. Dashboard "Shortlisted" uses `ctx.pipelineCounts.screening` (`EmployerDashboardCompositionService.js:85`) — same canonical mapping, same source data.
4. Open-position counts use the **stored `Job.applicationsCount` field**, not a live `Application` count (§17 — flagged as a separate, distinct data-source inconsistency from the pipeline counts on the same page).
5. Per-Job totals use the same `Job.employerId`-derived ownership relationship throughout.
6. Status casing/hyphenation: no mismatch found — both status vocabularies are internally consistent and bridged by one shared mapping table, not by ad hoc string comparison.
7. Client options send values the server accepts — not independently re-verified client-side in this pass (out of the audit's targeted file list); no contradicting evidence found in the two controller/service files inspected.
8. Employer updates sync to the correct `OpportunityApplication` via `legacyApplicationId` lookup (`OpportunityApplicationRepository.findByLegacyApplicationId`), scoped correctly.
9. A missing tracker record does not prevent an Employer update — both `updateApplicationStatus` and `transitionPipeline` proceed and save `Application.status` regardless of whether `oa` resolves to a document (`if (oa) { ... }` guards, not required).
10. Employer changes are reflected after refetch or only after reload: the Applications page and Hiring Intelligence do not auto-refresh (§21); the Dashboard now does (route re-entry, fixed at HEAD).

## 13. Employer-to-User synchronization

One-directional, confirmed both via source (this audit, §12) and via the prior opportunity-tracking audit: `syncOpportunityApplicationFromLegacyStatus` (legacy path, fire-and-forget) and `transitionPipeline`'s inline `pushStageHistory` (canonical path, awaited) both push into the User's own `OpportunityApplication`, tagged `byActorType: 'employer'`. The canonical path is stronger (awaited, forces the transition even past the User's own stage-machine constraints) than the legacy path (best-effort, silently drops on failure). Both ultimately land in the same place (`stageHistory` on the same document type), so the User experiences one consistent effect regardless of which Employer-side action triggered it.

## 14. User-to-Employer synchronization

**Not implemented**, confirmed by the absence of any `Application`-model write anywhere in `OpportunityApplicationService.js`/`opportunityApplicationController.js` (§11.3). This is the correct, intentional boundary per the task brief's own framing ("A User should not be able to change an Employer-controlled candidate pipeline merely by moving a private tracker card") — no fix is proposed for this in §18.

## 15. Dashboard application metrics

Re-confirmed unchanged from the prior Dashboard audit at this HEAD: `Total Applications`/`New Applications`/`Shortlisted`/`Conversion Rate` all query `Application` scoped to `internalJobIds` (`resolveJobApplyType(j) === 'internal'` filter applied explicitly — `employerDashboardMetrics.js`). Draft-Jobs/rejected-overlap fix (`PF-EDM-B1`) is present (`draftJobsFilter` excludes `approvalStatus: 'rejected'`, confirmed by direct read, §23 shows commit `d6fd79e` as HEAD's parent). Route re-entry refetch fix (`PF-EDM-B4`) is present in `EmployerDashboard.jsx` as of HEAD (commit `5609421`, the current HEAD itself).

## 16. Employer Applications page

`client/src/pages/Employer/EmployerApplications.jsx`: fetches the Employer's Job list once on mount (`useEffect`, line 25), and separately fetches applications for a `selectedJobId` on selection (`useEffect`, line 40) via `getJobApplications`. For the 4 Jobs owned by this Employer, all `applyType:'external'`, this endpoint returns `{ data: [], applicationsTracked: false, submittedApplicationsCount: null, message: 'Applications for this job are handled outside Strideto and are not visible in your applicant dashboard.' }` (`employerController.js:251-259`) — an explicit, disclosed empty state, not a silent/ambiguous zero.

## 17. Hiring Intelligence

Composition: `useEmployerDashboardComposition` (`client/src/employerIntelligence/useEmployerDashboardComposition.js`) → `employerApi.intelligenceDashboard()` → `EmployerDashboardCompositionService.js`'s `loadSharedContext` + widget providers.

**Genuine inconsistency found (non-blocking, §5/§26):** `loadSharedContext` (`EmployerDashboardCompositionService.js:40-78`) queries `Job.find({ employerId })` with **no `applyType` filter**, then `Application.find({ jobId: {$in: jobIds} })` against **all** of the Employer's Jobs, internal or external — unlike `employerDashboardMetrics.js`, which explicitly restricts to `internalJobIds` via `resolveJobApplyType`. In the current data this produces an identical (zero) result to the filtered Dashboard query only because it is structurally impossible for an `Application` to exist for an external Job in the first place (`applyToJob`'s own gate, §5/§6) — the two implementations agree by invariant, not by explicit, defensive filtering. If that invariant were ever broken (e.g., a future admin tool, data migration, or a Job whose `applyType` is changed after applications already exist), `EmployerDashboardCompositionService.js`'s aggregates (`hiringOverviewProvider.totalApplications`, `pipelineMetricsProvider`) would silently include external-Job applications that the Dashboard's equivalent counters would exclude — a real, if currently dormant, cross-page semantic mismatch. **Classification: K — product-semantic decision required only if the invariant is ever intentionally relaxed; not an active defect today.**

`openPositionsProvider` (line 91-102) reads the **stored** `Job.applicationsCount` field (0 for all four Jobs, confirmed live, §23), not a live `Application.countDocuments` — consistent with §12 item 4.

## 18. Open-position counts

Confirmed via §17: sourced from `Job.applicationsCount`, a field only ever incremented inside `applyToJob` (`$inc`, line 78) — never independently recomputed, never decremented on any application-removal path (none was found in the files inspected). For all four of this Employer's Jobs, `applicationsCount` is `0` in the live database (§23), fully explaining "Open Positions: 0 candidates" for every listed Job.

## 19. Per-Job application counts

`enrichEmployerJobsWithApplicationCounts` (`employerApplicationCounts.js:49-70`) computes a **live** `countApplicationsByJobIds` aggregate for internal Jobs only, and returns `applicationsTracked: false, submittedApplicationsCount: null` for external Jobs — this is the function that ultimately drives the "Applications: not tracked" string wherever it's used for the Jobs list. The Dashboard's Recent Job Posts section reimplements the identical `resolveJobApplyType`/`Application.countDocuments` pattern inline rather than calling this shared helper (a minor duplication, already flagged as low-severity in the prior Dashboard audit; not re-flagged as new here).

## 20. "Applications: not tracked" analysis

The exact condition (confirmed at three independent call sites — `enrichEmployerJobsWithApplicationCounts`, the Dashboard's inline Recent-Job-Posts logic, and `getJobApplications`'s explicit branch) is:

```
resolveJobApplyType(job) !== 'internal'
```

For the four Jobs in the screenshots this means `job.applyType === 'external'` specifically (confirmed live, not inferred, §23) — **not** a null/omitted field, not a client mapping failure, not an unsupported query, and not an ownership mismatch. Per-title live findings (masked IDs, safe fields only):

| Title | Job ID (masked) | Owner (masked) | applyType | approvalStatus | `Application` count | `OpportunityApplication` count | User stage |
|---|---|---|---|---|---|---|---|
| AI Engineer | `…4a81bf` | `…1d69b7` ("Global Identity") | external | approved | 0 | 0 (not tracked by User) | n/a |
| Ads Generator | `…b075a8` | `…1d69b7` | external | approved | 0 | 1 | preparing |
| Video Editor | `…b2606c` | `…1d69b7` | external | approved | 0 | 1 | **joined** |
| Graphic Designer | `…7bb561` | `…1d69b7` | external | approved | 0 | 1 | **applied** |
| Research Associate HEC | `…762fce` | `…efined` (different Employer) | external | approved | 0 | 1 | applied |

All four of `…1d69b7`'s Jobs share the exact employer id and company name ("Global Identity"), and are exactly the four titles shown in the Employer's own Hiring Intelligence "Open Positions" list and match `Active Jobs: 4`/`Total Jobs: 4` — strong circumstantial correlation that this is the authenticated Employer account in the screenshots, though the session/authentication itself was not and could not be inspected read-only (see limitation, §23). Research Associate HEC belongs to a **different** Employer entirely — its presence in the User's tracker is correctly irrelevant to this Employer's dashboard, and the User did not apply to "another Employer's job thinking it was this one"; it is simply a separate, unrelated tracked opportunity with a coincidentally similar naming pattern to the others.

## 21. Refresh/cache analysis

| Page | Initial load | Route re-entry refresh | Refetch after User apply | Refetch after Employer stage update | Refetch after Admin approve/reject | Stale until reload |
|---|---|---|---|---|---|---|
| Employer Dashboard | mount `useEffect` | **Yes** (fixed at HEAD, commit `5609421`) | N/A (own action) | No | No | No (route re-entry only) |
| Employer Applications page | mount `useEffect` (Jobs) + on-select (Applications) | **No** | N/A | No | No | Yes |
| Hiring Intelligence | mount `useEffect` inside `useEmployerDashboardComposition` | **No** | N/A | No | No | Yes |
| Open Positions (part of Hiring Intelligence composition) | same as Hiring Intelligence | No | N/A | No | No | Yes |
| User Applications tracker | not re-inspected this pass (out of scope; prior audits found it live/correct) | — | — | — | — | — |
| Admin moderation | not re-inspected this pass (unaffected by tracking) | — | — | — | — | — |

Confirms and narrows the prior Dashboard audit's own caution: **PF-EDM-B4 refreshed only the Employer Dashboard.** Hiring Intelligence and the Employer Applications page did **not** gain the same freshness behavior — reconfirmed directly against the live source at this HEAD, not merely carried forward as an assumption.

## 22. Ownership and identity

USER: `Application` scoped by `userId` (`applyToJob`, `getMyApplications`); `OpportunityApplication` scoped by `userId`/`talentProfileId` throughout `OpportunityApplicationService.js`. No cross-User leakage path was found in any file inspected.

EMPLOYER: every Employer-facing query in `employerController.js` and `EmployerIntelligenceService.js` derives ownership from `req.employer.employerId` (server-authenticated) joined against `Job.employerId` — no client-supplied `employerId` is ever trusted (grep-confirmed: no `req.body.employerId`/`req.query.employerId` read in any inspected file). `Application` has no `employerId` field of its own, so ownership is always transitive through `Job`, consistently, in every code path inspected (`getOwnedLegacyApplication`, `updateApplicationStatus`, `getJobApplications`, `loadSharedContext`).

ADMIN: moderation scoped by `STAFF_ROLES`; no Employer impersonation or User private-tracker access was found anywhere in `moderationController.js`.

Specific checks:
- Client-supplied `employerId`: none found, anywhere.
- Job ID vs. Application ID confusion: none found — every route parameter name (`req.params.id` for Jobs, `req.params.id`/`legacyApplicationId` for Applications) is used consistently within its own controller.
- Legacy Application ID vs. OpportunityApplication ID confusion: none found — every cross-reference goes through the explicit `legacyApplicationId` field, never an implicit shared ID space.
- Company ID vs. employerId mismatch: not applicable — `Application` has no company reference at all; only `Job.employerId` is used.
- Duplicate Job titles causing incorrect correlation: **confirmed present but harmless** — "Research Associate HEC" and the four `Global Identity` titles are all distinct Jobs with distinct `_id`s; the live query correlated by `_id`, not by title, so no cross-Job bleed occurred. The *audit's own* correlation table (§20) used title only for human readability, cross-checked against `_id` and `employerId` — this distinction is worth preserving in any future automated tooling to avoid title-based mis-joins.
- Cross-Employer application leakage: none found; the disposable-DB integration test cited in the prior Dashboard audit (`employerPortalIntegration.test.js`) already proves this directly for the `Application` model.

**P0 defects: none found.**

## 23. Read-only local-data correlation

Performed via `docker exec edurozgaar-staging-mongodb-1 mongosh edurozgaar`, read-only `find`/`countDocuments`/`aggregate` calls only, projecting safe fields only (`title`, `applyType`, `applicationLink`/`applyEmail` presence booleans, `employerId` suffix, `status`, `approvalStatus`, `pipelineStage`, `source`, `legacyApplicationId` presence boolean, `companyName`, `applicationsCount`, `views`). No document was printed in full; no email, resume, cover-letter, or credential field was ever selected or printed. No write operation of any kind was issued.

- Jobs inspected: 5 (`AI Engineer`, `Ads Generator`, `Video Editor`, `Graphic Designer`, `Research Associate HEC`).
- Internal Jobs found: **0**.
- External Jobs found: **5 of 5** (all had `applyType: 'external'` explicitly stored — not inferred).
- Employer-facing `Application` documents in the entire database: **0**.
- Personal tracker (`OpportunityApplication`) records in the entire database: **8**, all `source: 'external'`, all with no `legacyApplicationId`.
- Ownership matches: 4 of the 5 Jobs (`AI Engineer`, `Ads Generator`, `Video Editor`, `Graphic Designer`) share one Employer (`…1d69b7`, "Global Identity"); `Research Associate HEC` belongs to a distinct Employer (`…efined`).
- Stored `Job.applicationsCount` for all four `…1d69b7` Jobs: `0`; `views` sum: `2+4+2+3 = 11`, matching the observed Dashboard "Total Views: 11" exactly.

**Limitation, stated per instruction rather than guessed around:** the currently-authenticated Employer session itself could not be resolved read-only (no session/JWT store was queried, and doing so was out of the permitted read set). The correlation that `…1d69b7` is the Employer account shown in the screenshots rests on the Job count (4), the Job titles (exact match to the Hiring Intelligence "Open Positions" list), and the Total Views sum (exact match, 11) — three independent exact matches — which is strong circumstantial evidence but not a cryptographic proof of session identity.

## 24. Status and sync matrix

| Row | Initiating role | Source model changed | Secondary model changed | Employer-visible | User-visible | Admin-visible | Notification | Sync direction | Dashboard impact | Hiring Intelligence impact | Refresh needed | Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A. User internally applies | User | `Application` | `OpportunityApplication` (dual-write, awaited) | Yes | Yes | No | User (submitted) | one write, two models | Yes (on refetch) | Yes (on reload) | Yes (Intel/Apps pages) | A |
| B. User manually tracks a Job | User | `OpportunityApplication` | none | No | Yes | No | none | n/a | No | No | n/a | C |
| C. User marks a Job as applied | User | `OpportunityApplication` | none | No | Yes | No | User (stage-changed) | n/a | No | No | n/a | C |
| D. User changes private stage | User | `OpportunityApplication` | none | No | Yes | No | User (stage-changed) | n/a | No | No | n/a | C |
| E. Employer changes candidate stage (legacy) | Employer | `Application` | `OpportunityApplication` (best-effort, fire-and-forget) | Yes | Yes (best-effort) | No | User (stage-changed) | Employer→User | Yes | Yes | Yes | B |
| F. Employer shortlists | Employer | `Application` (status/pipelineStage) | `OpportunityApplication` (best-effort or forced, per path) | Yes | Yes | No | User | Employer→User | Yes | Yes | Yes | B |
| G. Employer schedules interview | Employer | `Application` (legacy path) / `OpportunityApplication.interview` (canonical) | the other, per path | Yes | Yes | No | User | Employer→User | Yes | Yes | Yes | B |
| H. Employer makes offer | Employer | `Application` | `OpportunityApplication` | Yes | Yes | No | User | Employer→User | Yes | Yes | Yes | B |
| I. Employer marks hired/joined | Employer | `Application` | `OpportunityApplication` | Yes | Yes | No | User | Employer→User | Yes | Yes | Yes | B |
| J. User self-reports accepted/joined | User | `OpportunityApplication` | none | No | Yes | No | User | n/a | No | No | n/a | C |
| K. User withdraws | User | `OpportunityApplication` | none | No | Yes | No | User (per prior audit) | n/a | No | No | n/a | C |
| L. Employer rejects candidate | Employer | `Application` | `OpportunityApplication` (best-effort/forced) | Yes | Yes | No | User | Employer→User | Yes | Yes | Yes | B |
| M. Admin approves Job | Admin | `Job` (`approvalStatus`) | none | Yes (status badge + notification) | No | Yes | Employer | Admin→Employer (Job state only) | No (no counter reacts) | No | n/a | E (by design — Job state, not application state) |
| N. Admin rejects Job | Admin | `Job` (`approvalStatus`) | none | Yes (status badge; notification missing per prior audit) | No | Yes | none (gap, prior audit) | Admin→Employer (Job state only) | No | No | n/a | E, with a pre-existing notification gap noted, not new |

## 25. Role connection matrix

| Capability | Admin | User | Employer | Shared model | Connected | Missing/defective |
|---|---|---|---|---|---|---|
| Job moderation | Owns | No | Read-only (status badge) | `Job` | Yes | — |
| Internal apply | No | Owns (gated) | Read-only result | `Application` + `OpportunityApplication` | Yes | — |
| External apply | No | Off-platform act | No visibility (by design) | none | By design | — |
| Manual tracking | No | Owns | No visibility (by design) | `OpportunityApplication` | Yes (private-only) | — |
| Personal stage | No | Owns | No | `OpportunityApplication` | Yes (private-only) | — |
| Employer candidate stage | No | Read-only (best-effort sync) | Owns | `Application` (+ synced `OpportunityApplication`) | Yes, one-directional | — |
| Shortlist / Interview / Offer / Hired | No | Read-only (synced) | Owns | `Application` | Yes, one-directional | — |
| Withdraw | No | Owns | No | `OpportunityApplication` | Yes (private-only) | — |
| Application notifications | Job-submission only | Yes (career milestones) | Approval only (rejection missing, prior audit) | `UserNotification` | Partially | Employer rejection notification (pre-existing gap, not this audit's scope) |
| Dashboard totals | No | No | Owns | `Application` (internal-filtered) | Yes | — |
| Hiring Intelligence | No | No | Owns | `Application` (unfiltered by applyType, §17) | Yes, functionally | Latent filter inconsistency (§17), not active |
| Open-position counts | No | No | Owns | `Job.applicationsCount` (stored, not live) | Yes, functionally | Potential drift risk if count is ever decremented elsewhere (unverified, no such path exists today) |
| Per-Job counts | No | No | Owns | `Application` (internal-filtered) | Yes | — |
| Status synchronization | No | One-directional out only (private) | Owns, one-directional in (best-effort/forced) | both models | Employer→User only, by design | User→Employer intentionally absent |

## 26. Source-wired versus live-confirmed matrix

| Item | Source-wired | Live-confirmed this session |
|---|---|---|
| Internal apply → dual-write | Yes | **No** — no internal `Application` has ever been created in this environment; cannot be live-confirmed without submitting one (out of scope: "do not create applications") |
| External-apply gating (`applyToJob` 400) | Yes | Not directly exercised (would require attempting the blocked call); inferred safe from the unconditional `if` at line 53 |
| "Not tracked" disclosure condition | Yes | **Yes** — confirmed for all 4 of the Employer's real Jobs |
| Dashboard zero counters correctness | Yes | **Yes** — confirmed via `Application` count = 0, `applicationsCount` = 0, `views` sum = 11 exact match |
| Hiring Intelligence zero counters correctness | Yes | **Yes** — same underlying data, confirmed |
| Employer→User best-effort sync | Yes (prior audit + this audit's re-read) | Not live-tested (no Employer stage-change event exists in this data to observe) |
| User→Employer sync absence | Yes | **Yes** — trivially confirmed by absence of any code path, no live test needed |
| Employer Dashboard route re-entry refresh | Yes (HEAD commit) | Not independently browser-tested this session (source-confirmed only) |
| Hiring Intelligence / Applications page staleness | Yes | **Yes** — confirmed by absence of any re-entry/location-dependent effect in the source |

## 27. Test inventory

| Test file | Executable/DB-backed | Covers | Missing |
|---|---|---|---|
| `employerApplicationFlow.test.js` | Yes | Internal apply flow, ownership | — |
| `employerOaSyncFailure.test.js` | Yes | Employer→User sync failure handling | User→Employer sync (correctly absent, nothing to test) |
| `employerApplicationCountsEnrich.test.js` | Yes | `resolveJobApplyType`/`enrichEmployerJobsWithApplicationCounts` | — |
| `employerDashboardMetrics.test.js` | Yes (unmocked unit test) | `computeConversionRate`, `resolveJobApplyType` | Job-status bucket aggregation (carried over from prior audit) |
| `employerDashboardFreshness.test.js` | Yes | Dashboard route re-entry refetch | Hiring Intelligence / Applications page refetch (none exists — confirms §21's finding is untested, not just unimplemented) |
| `employerPortalIntegration.test.js` | Yes (disposable DB, opt-in) | Cross-Employer non-leakage, `totalInternalApplications` correctness | — |
| `jobApplicationNotificationLink.test.js` | Yes (source-text) | Notification link content (out of this audit's scope) | — |

**Missing entirely:** any test for `EmployerIntelligenceService.listCandidates`/`loadSharedContext`'s application aggregation (the §17 inconsistency would not be caught by any existing test); any test asserting Hiring Intelligence or Applications-page data freshness on route re-entry (unlike the Dashboard, which now has one); any test proving the `applyToJob`-gate vs. `resolveJobApplyType` agreement invariant described in §5 (currently true only by coincidence of every Job having `applyType` explicitly set).

No test was modified or run beyond what this audit itself directly executed (read-only Mongo queries); no existing test suite was run.

## 28. Priority findings

- **P0:** none.
- **P1:** none. No internal application is missing from the Employer despite a successful apply — no internal apply has ever occurred in this environment, and the gating/dual-write logic that would handle one is confirmed correct by source.
- **P2:** Hiring Intelligence and the Employer Applications page do not refresh on route re-entry, unlike the Dashboard (§21, confirmed still true at this HEAD — carried forward from the prior Dashboard audit's own caution, now independently re-verified rather than assumed).
- **P3:** `EmployerDashboardCompositionService.js`'s application aggregation relies on an implicit invariant (no `Application` can exist for a non-internal Job) rather than the explicit `resolveJobApplyType` filter the Dashboard uses (§17) — dormant, not currently producing any wrong number, but architecturally inconsistent between the two pages. `applyToJob`'s external-gate check and `resolveJobApplyType`'s classification are two independent implementations of "is this Job internal" that happen to agree today only because every Job in this database has `applyType` explicitly set (§5). Open-position counts use a stored, non-live counter with no verified decrement path (§18). No test exists for the Hiring Intelligence aggregation or its cross-page consistency with the Dashboard.

## 29. Recommended phases

**PF-TRACK-B3 — Hiring Intelligence and Applications-page freshness on route re-entry**
- Goal: apply the same route re-entry refetch pattern already shipped for the Employer Dashboard (`EmployerDashboard.jsx`, HEAD) to `EmployerIntelligence.jsx`'s `useEmployerDashboardComposition` hook and `EmployerApplications.jsx`.
- Allowed files: `client/src/employerIntelligence/useEmployerDashboardComposition.js`, `client/src/pages/Employer/EmployerApplications.jsx`, one focused test per file (mirroring `employerDashboardFreshness.test.js`'s pattern).
- Focused tests: static-source assertions that both effects re-run on route re-entry (same convention as the existing Dashboard freshness test).
- Live acceptance: change an Application's status as Employer in one tab, navigate away and back to Hiring Intelligence / Applications in another tab, confirm the update appears without a hard reload.
- Commit message: `fix(employer): refresh hiring intelligence and applications on route re-entry`
- Stop conditions: do not add polling or websocket infrastructure, matching the existing Dashboard fix's own stated constraint.

**PF-TRACK-B2 — Align Hiring Intelligence's application aggregation with the Dashboard's internal-only filter**
- Goal: make `EmployerDashboardCompositionService.js`'s `loadSharedContext` explicitly filter `jobIds` to `resolveJobApplyType(j) === 'internal'` before querying `Application`, matching `employerDashboardMetrics.js`'s existing pattern, so the two pages are consistent by explicit code rather than by a currently-true but unenforced invariant.
- Allowed files: `server/src/services/career/EmployerDashboardCompositionService.js`, one focused test.
- Focused tests: a test asserting an `Application` document belonging to an external-`applyType` Job is excluded from `hiringOverviewProvider.totalApplications`/`pipelineMetricsProvider` — this scenario cannot occur via any real code path today, so the test would need to insert the `Application` directly (documented as a defense-in-depth test, not a live-bug repro).
- Live acceptance: none required beyond the test — no observable live value changes today.
- Commit message: `fix(employer): scope hiring intelligence applications to internal jobs explicitly`
- Stop conditions: do not change the Dashboard's own filter or the `Application` schema.

**PF-TRACK-C — Combined live cross-role acceptance**
- Goal: with a real internal `applyToJob` submission to one of this Employer's own Jobs (requires the Employer to first switch at least one Job's `applyType` to `internal`, or test against a different, already-internal Job elsewhere in the catalogue), confirm: `Application` + `OpportunityApplication` both created; Dashboard/Hiring Intelligence/Applications page all reflect it (after PF-TRACK-B3 lands, without reload); an Employer stage change propagates to the User's tracker; a User self-reported stage change does *not* propagate to the Employer.
- Allowed files: none (acceptance only, no code).
- Manual acceptance: full walk-through as described above.

**Not recommended:** any change to the internal/external apply gating logic itself (§5's two independent checks agree in every real case today — hardening them into one shared function is a legitimate future simplification but is not required by any observed defect, and the task brief's "do not implement fixes" / smallest-change discipline argues against bundling a non-required refactor into this phase set). No `PF-TRACK-B1` ("repair internal-application dual-write") is recommended — nothing about the dual-write is broken; it is simply unexercised in this environment.

## 30. PF-EDM-C implications

`PF-EDM-C` (the prior Dashboard audit's recommended live-acceptance phase — "submit a real internal application, confirm counters move off zero") **cannot resume yet**, and for a slightly more specific reason than "no data exists": every one of this Employer's four Jobs is configured `applyType: 'external'`, so `applyToJob` will hard-reject any attempt to create the internal `Application` `PF-EDM-C` needs, on any of this Employer's current Jobs. The prerequisite is not merely "submit an application" but specifically: either (a) this Employer creates or reconfigures at least one Job with `applyType: 'internal'` first, or (b) `PF-EDM-C` is run against a different Employer's Job that is already internal (none was found with a nonzero `Application` count in this database either — the entire `Application` collection is empty).

## 31. Pre-push implications

None of the findings here are security or data-integrity defects — this audit found **zero P0/P1 issues**. The observed all-zero Employer metrics are correct, disclosed, and now empirically confirmed rather than merely plausible. The Hiring Intelligence/Applications-page staleness (P2) and the dormant aggregation-filter inconsistency (P3) are both real but low-severity and do not block push; neither loses or corrupts data, and neither currently produces a wrong number for any Employer. The already-known, pre-existing Employer-rejection-notification gap (from the prior notification audit) is unrelated to tracking connections and is not re-scoped here.

## 32. Final recommendation

No urgent fix is required. If prioritizing polish: proceed with **PF-TRACK-B3** first (smallest, mirrors an already-shipped pattern, directly closes the freshness gap most likely to confuse an Employer testing live), then **PF-TRACK-B2** (defense-in-depth consistency fix, no live behavior change), then **PF-TRACK-C** once at least one of this Employer's Jobs (or a suitable substitute) is configured for internal applications, to finally close out the still-outstanding `PF-EDM-C` live-acceptance step from the prior Dashboard audit.
