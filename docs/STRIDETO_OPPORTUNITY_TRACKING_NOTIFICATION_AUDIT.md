# STRIDETO Opportunity Tracking, Tracker and Notification Wiring Audit (PF-B.1)

## 1. Verdict

**READY FOR TARGETED WIRING FIXES**

The core architecture (a single `OpportunityApplication` tracker model shared across Job/Scholarship/Admission/Internship, with a one-directional best-effort sync from the Employer-facing legacy `Application` model) is real, connected, and more complete than the manual findings assumed. One concrete, fully-root-caused client defect was found: application-stage notifications carry a correct `link` field end-to-end from the server, but neither client notification surface (`NotificationBell.jsx`, `NotificationsPage.jsx`) ever reads it. Job submission still creates no Admin notification/email (unchanged since the prior audit). The Employer↔candidate relationship is knowable from source and is documented in full below — it is not an unknown, but it does contain a real reconciliation gap (self-reported vs. Employer-confirmed placement are not distinguished at the metrics layer). The PF-B Edit UI's live save/cancel behavior was left as an unfilled template in the manual findings and was not independently browser-tested in this pass; its source wiring is confirmed correct (verified by direct read and by the passing static test added in PF-B), so it is classified as **REVIEW REQUIRED (source confirmed, live confirmation pending)**, not PASS.

## 2. Repository authority

- HEAD: `74ac7f9a73842170bbe5b9cadfd15946d0b6b700`
- Branch: `main...origin/main [ahead 51]`
- Tracked tree: clean, staged: none
- Preserved untracked: `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- `.env.staging`: ignored, untouched

No file was modified during this audit; all findings come from reading committed source.

## 3. Manual evidence reviewed

Create → dashboard metrics update → Interested→Preparing→Applied stage transitions → stage history with timestamps → List/Kanban/Table/Calendar all confirmed working live. Internship catalogue empty (no live Track test possible yet). Application-stage notifications received but do not navigate on click. Edit action visually present beneath the title; its live prefill/save/cancel result was left as an unfilled placeholder in the report rather than a stated PASS/FAIL — treated here as **not yet confirmed live**.

## 4. Job lifecycle

Traced `POST /employer/jobs` → `employerController.createJob` (server/src/controllers/employerController.js). Effects: slug computation, `Job.create({ status: 'draft', approvalStatus: 'pending', ... })`, conditional `totalJobsPosted` increment, JSON response. No other call.

1. Admin dashboard notification: **not created** — `notifyStaff` (the only mechanism that fans out to `STAFF_ROLES` users) has exactly five call sites in the codebase (contact, feedback, support, form-notification, webinar-published); `createJob` is not one of them. Unchanged since the prior audit; this file was not touched by PF-A or PF-B.
2. Admin notification counter: not applicable — no notification is created.
3. Admin email: not created — `emailService.js` has no "job submitted" template and no call site sends one.
4. Moderation queue entry: yes — `approvalStatus: 'pending'` gates visibility until an Admin acts (`moderationController.js` bulk-approve/reject).
5. Activity/audit log: none found in `createJob`.
6. Employer confirmation: none in `createJob` itself.
7. Duplicate-safe behavior: not applicable to creation (no duplicate-job guard was in scope of this audit; slug collision is handled by appending a timestamp).

On approval, `automationService.onJobApproved` (called from `moderationController.js`) **does** notify: `queueNotification({ recipientType: 'employer', link: '/employer/jobs', dedupKey: 'job:approved:${jobId}' })` plus `queueEmail({ templateKey: 'jobApproved' })` — both target the Employer, not Admin, and both existed before this phase. No Employer-facing client component consuming `queueNotification`-sourced Employer notifications was found under `client/src/pages/Employer` or `client/src/components` — Employer notifications on approval appear to reach email only; no in-app Employer bell/inbox consumer was located. Classify this sub-finding as **REVIEW REQUIRED** — a full trace of the Employer-facing notification store was out of this audit's targeted scope.

## 5. Candidate application versus tracker

Traced `applyToJob` (server/src/controllers/applicationsController.js) end to end.

1. **Does applying inside Strideto automatically create a tracker record? Yes.** `applyToJob` creates the legacy `Application` document, then calls `ApplicationMigrationService.dualWriteFromLegacyJobApplication(application, job)` (awaited, not fire-and-forget) which creates a real `OpportunityApplication` and returns its id as `opportunityApplicationId` / `trackerUrl` in the API response. Internships have the identical mechanism (`dualWriteFromLegacyInternshipApplication`, called from `internshipsController.js`). Scholarships and Admissions have **no** internal apply route at all (no `.apply` handler in `server/src/routes/scholarships.js` / `admissions.js`) — for those two types, Track/manual-create is the *only* way a record enters the tracker, which matches the audit's caution not to conflate tracking with an official application for those types.
2. **Does Track create an application or only a private tracker record?** Only a private `OpportunityApplication` record (`OpportunityApplicationService.create`, source `platform`/`external`/`manual`). It never creates or touches the legacy `Application` model, so the Employer never sees a Track-only entry.
3. **Can external applications be represented?** Yes — `oaApi.create({ source: 'external', externalUrl, ... })`, used by every "Track" button and by `CreateApplication.jsx`'s external mode.
4. **Does an Employer see a candidate merely because the User tracked the job?** No. Employer-facing views (`getJobApplications` in `employerController.js`, `EmployerCandidateCardService.js`) read from the legacy `Application` collection, not `OpportunityApplication`. A Track-only entry is invisible to the Employer.
5. **Does Employer stage movement update the User tracker?** Yes, one-directionally. `updateApplicationStatus` (Employer action: shortlist/reject/interview/hired) calls `syncOpportunityApplicationFromLegacyStatus` (server/src/services/employerOpportunityApplicationSync.js), which maps the legacy status to a `pipelineStage` and updates the linked `OpportunityApplication` by `legacyApplicationId`, appending a stage-history entry tagged `byActorType: 'employer'`. This is explicitly "best-effort" (fire-and-forget, logged on failure, never blocks the Employer's own update).
6. **Does User stage movement update the Employer pipeline?** No. `OpportunityApplicationService.transitionStage` (the User's own tracker stage control) only ever writes to `OpportunityApplication`; it has no code path back to the legacy `Application.status`. The sync is one-directional (Employer → User tracker only).
7. **Is Accepted/Hired self-reported or Employer-confirmed?** Both paths exist and are **not reconciled**. Employer-confirmed: `updateApplicationStatus` accepts `status: 'hired'`, which syncs `pipelineStage` forward with `byActorType: 'employer'`. Self-reported: the User's own `transitionStage` endpoint enforces only stage-machine validity (`shared/career/applicationStageMachine.js`'s `job_default` template allows `offer→negotiation→accepted→joined`), with no server-side check requiring an Employer-originated event — a User can self-transition their own tracker to `accepted`/`joined` with `byActorType` defaulting to their own actor context, independent of anything the Employer has actually done.
8. **Are the Employer application record and User tracker record the same model?** No — `Application` (legacy, Employer-facing, authoritative per the sync comment) and `OpportunityApplication` (User tracker) are two distinct Mongoose models, linked only by `OpportunityApplication.legacyApplicationId`.
9. **What indicates the candidate actually got the job?** Only the per-transition `stageHistory[].byActorType` field (visible via `StageTimeline`) distinguishes an Employer-originated stage change from a User-originated one. There is no dedicated "verified placement" flag.
10. **What is missing for verified placement confirmation?** A summary-level indicator (not just a buried history-entry actor field) distinguishing "Employer confirmed hired" from "I marked myself hired," and — as a consequence — `ApplicationMetricsService`'s `offersReceived`/`completionRate` counts a self-reported `accepted`/`joined` stage identically to an Employer-confirmed one, so tracker metrics can currently be inflated by unconfirmed self-reports for platform-linked applications. This is a real design gap, not a bug in what exists.

## 6. Employer candidate pipeline connection

See §5, items 4–8. Summary: Employer pipeline (`Application`) and User tracker (`OpportunityApplication`) are two models connected by one field (`legacyApplicationId`) and one one-directional best-effort sync function. There is no bidirectional real-time sync, and no shared "source of truth" stage — `Application.status` is authoritative for what the Employer sees; `OpportunityApplication.pipelineStage` is authoritative for what the User sees, and they can drift for platform-linked Jobs/Internships (User can move ahead of what the Employer has actually done) or run completely independently for Track-only/Scholarship/Admission entries (no Employer side exists at all).

## 7. Jobs tracking

- Public listing/detail: `JobDetail.jsx`. Track: `handleTrackApplication` → `oaApi.create({ opportunityType: 'job' })`, 409-duplicate → navigate to existing. Manual-create: supported via `CreateApplication.jsx`. Resolver: `OpportunityResolverService.js` `job` resolver. Duplicate protection: unique partial index on `{talentProfileId, opportunityType, opportunityId, status:'active'}`. Filters/search/metrics: shared, type-agnostic. Tests: server has `employerApplicationFlow.test.js`, `employerOaSyncFailure.test.js`; no test directly exercises `JobDetail.handleTrackApplication` client-side.
- **Classification: A (fully connected)** for the tracker mechanics; **B (connected but client-side untested)** for the client action itself.

## 8. Scholarships tracking

- `ScholarshipDetail.jsx`: `handleTrackApplication` → `applicationsApi.create({ opportunityType: 'scholarship' })`, same 409/`existingId` duplicate handling as Jobs. No internal "apply" route exists server-side (`server/src/routes/scholarships.js` has no `.apply`), so Track is the only tracker entry point — correctly, tracking here does **not** imply an official submitted application.
- **Classification: A (fully connected)** for tracking; official-application concept does not exist for this type, by design.

## 9. Admissions tracking

- `AdmissionDetail.jsx`: identical pattern to Scholarships (`opportunityType: 'admission'`, same duplicate handling). No internal apply route.
- **Classification: A (fully connected)** for tracking; same by-design caveat as Scholarships.

## 10. Internships tracking

- Public listing/detail: `InternshipDetail.jsx`. Two entry points now exist: (a) `handleApply` → `internshipsApi.apply()` for `applyInPlatform` internships, which **also** dual-writes into the tracker server-side (`internshipsController.js`, mirroring the Job apply flow) — this pre-dated PF-B; (b) the new PF-B "Track application" button → `oaApi.create({ opportunityType: 'internship' })`, used for internships without in-platform apply. Both paths hit the same duplicate-protection index, so using both on the same listing safely resolves to one record, never a duplicate.
- Why the catalogue is currently empty: not an implementation gap. `client/src/pages/Admin/AdminContentInternships.jsx` exists — Admin **can** already author and publish Internship listings through the Admin panel. No dedicated internship seed script was found under `server/src/seed`, so the catalogue is empty purely for lack of authored data, not missing code.
- Smallest safe method to create one local test listing: use the existing `AdminContentInternships.jsx` Admin panel to publish one listing (no script/data was created during this audit, per its read-only constraint).
- **Classification: B (connected but untested against a live listing)** — the Track button's wiring was verified statically in PF-B (27/27 assertions) and by direct source read here, but has not been exercised against a real published Internship because none exists yet in this environment.

## 11. Application tracker actions

Create, Track-from-listing (all 4 types), open detail, Edit (new in PF-B), stage update, notes, archive, reminders, interview scheduling, search/sort/type-filter/stage-filter (client-side), List/Kanban/Table/Calendar (new in PF-B), dashboard metrics, and reload/login persistence are all wired to real backend endpoints — confirmed both by this audit's direct reads and by the manual test evidence (items 1–5, 7–8 in §3). No placeholder remains except the previously-flagged gaps already closed in PF-B.

## 12. Application Edit UI

1. Exact component: `client/src/components/applications/ApplicationEditPanel.jsx`, rendered unconditionally inside `ApplicationDetail.jsx`'s header, directly under the title/company block (matches the manual observation).
2. Visible button text: "Edit" (collapsed state); "Save" / "Cancel" (expanded form).
3. Location: inside the `<header>` block, above the stage/appliedAt/source `<dl>`.
4. Permissions/status hiding: no explicit visibility gate in the panel itself.
5. Archived records: the *page* itself 410s before rendering for archived applications (`getOwnedApplication` throws for `status: 'archived'`, used by both `getById` and `update`) — this is pre-existing behavior, unrelated to PF-B, so archived records never reach a state where the Edit panel could render.
6. Import: confirmed present — `ApplicationDetail.jsx` imports `ApplicationEditPanel` and wires `onSave` to `afterMutation(applicationsApi.update(id, body))`.
7. Clicking opens the panel: by source (`editing` state toggle), yes; **not independently browser-verified in this pass** — the manual-findings template for this exact question was left unfilled rather than marked PASS.
8. Exact editable fields: `title`, `companyName`, `externalUrl` only — deliberately matches what `OpportunityApplicationService.update` actually persists (verified by direct read in PF-B and re-confirmed here); stage/dates/notes are intentionally excluded because they have their own dedicated endpoints/UI.
9. Successful updates reload persisted data: yes — `onSave` is wrapped in the page's existing `afterMutation`, which calls `load()` afterward.
10. Client tests are static source assertions only: yes — confirmed; this repository has no jsdom/DOM runner (`client/src/__tests__/*.test.js` are plain Node `assert`+`readFileSync` source-contract checks), so "clicking" has never been exercised by an automated test, only by direct human interaction or source trace.

**Classification: source wiring is COMPLETE AND STATICALLY TESTED; live browser behavior is REVIEW REQUIRED** (not claimed PASS, per the audit's own instruction not to claim fully working when live behavior is unverified).

## 13. Notification creation matrix

| Event | Recipient | Service | Link field | Dedup |
|---|---|---|---|---|
| `StageChanged` | Candidate (User) | `careerNotificationBridge.js` → `notifyUser` | `/applications/{applicationId}` | none observed at this call site |
| `InterviewScheduled` | Candidate | same | `/applications/{applicationId}` | none observed |
| `ReminderCreated` | Candidate | same | `/applications/{applicationId}` | none observed |
| `CandidateShortlisted` / `OfferSent` / `CandidateHired` / `OfferRejected` / `CandidateRejected` | Candidate | same | `/applications/{applicationId}` | none observed |
| Job approved | Employer | `automationService.onJobApproved` → `queueNotification` + `queueEmail` | `/employer/jobs` | `dedupKey: job:approved:{jobId}` |
| Job submitted | Admin | **none** | n/a | n/a |

All career-milestone notifications route through the same `notifyUser` call with a correctly-populated `link` field (verified: `UserNotification` schema has a `link: String` field; `listUserNotifications` uses `.lean()` with no field-stripping projection, so `link` reaches the client API response intact).

## 14. Notification click-navigation matrix

| Notification | Classification | Evidence |
|---|---|---|
| Application/tracker (`StageChanged`, interview, reminder, offer, hired, etc.) | **C — route present but click handler defective** | `NotificationBell.jsx` item `onClick={() => { if (!n.read) markRead(n._id); setOpen(false); }}` and `NotificationsPage.jsx`'s `<li>` item both never read `n.link`; no `navigate()`/`<Link>` call exists in either file for the notification body itself |
| Job approval/rejection (Employer) | **H — review required** | Notification/email are queued correctly server-side (`link: '/employer/jobs'`); no Employer-facing bell/inbox consumer component was found in `client/src/pages/Employer` or `client/src/components` to confirm client-side rendering/click behavior — out of this audit's targeted read set |
| Job moderation (Admin) | **G — not implemented** | No notification is created on submission (§4); nothing to navigate |

**Root cause of non-navigation:** confirmed, isolated, client-side only. `notification.link` is correctly computed and persisted server-side and reaches the client API response unmodified; `NotificationBell.jsx` and `NotificationsPage.jsx` simply never consume that field — both render `title`/`body` and wire only "mark read" / "delete" actions.

Additional answers:
1. Should mark-read happen before navigation? Current partial behavior already marks read on click in the bell; extending to navigate should preserve that order (mark-read best-effort, navigate regardless — see next point).
2. Should navigation occur if mark-read fails? Yes — mark-read is a secondary side effect; the existing pattern elsewhere in this codebase (e.g. Employer notification sync) is fire-and-forget/best-effort and does not block the primary action, so navigation should not be gated on markRead's success.
3. Keyboard activation: both current items are real `<button type="button">` elements, so keyboard activation already works for what they currently do (mark read); adding navigation to the same handler preserves this.
4. Do notification items without a `link` field appear clickable? Yes — every item renders as an identical `<button>`/`<li>` regardless of whether `link` is present, so a purely informational notification (if one existed) would look identically actionable. `link` always falls back to `/applications` in `careerNotificationBridge.js` when no application id is resolvable, so this is currently moot for career notifications specifically, but is a general latent risk for any other notification-producing service that omits `link` entirely.
5. Safe fallback for invalid/deleted entities: not verified — `ApplicationDetail.jsx` already handles a 404/error state generically (`error || !application`), which would catch a stale `applicationId` gracefully if navigation were added; this was not exercised live.
6. External URLs: not applicable — all career notification links observed are internal app routes (`/applications/...`, `/employer/jobs`); no external URL was found in any `link` value in the traced call sites.
7. Focused tests required: a new static-source test (matching this repo's convention) asserting `NotificationBell.jsx`/`NotificationsPage.jsx` navigate using `n.link` once fixed.

## 15. Dashboard metrics

Confirmed working per manual finding #2, and confirmed by source in PF-B/this audit: `ApplicationMetricsService.getForUser` aggregates directly from live `OpportunityApplication` documents (not cached/hardcoded). Caveat carried over from §5.10: `offersReceived`/`completionRate` do not currently distinguish Employer-confirmed stage changes from User self-reported ones.

## 16. Classification matrix

| Area | Classification | Evidence | Impact | Smallest correction |
|---|---|---|---|---|
| Job submission → Admin notification/email | F (missing) | `createJob` has no `notifyStaff`/email call | Admins unaware of new submissions except by polling the queue | Already scoped as PF-J candidate |
| Job approval → Employer notification | B (implemented, client consumer unverified) | `onJobApproved` queues correctly; no Employer bell component located | Employer may only learn via email | Locate/confirm Employer notification consumer (REVIEW REQUIRED) |
| Apply→tracker dual-write (Job, Internship) | A (complete) | `dualWriteFromLegacyJobApplication`/`...Internship...`, awaited, tested via `employerOaSyncFailure.test.js` | None — working as designed | none |
| Employer→User stage sync | A (complete, one-directional by design) | `syncOpportunityApplicationFromLegacyStatus` | None — documented one-directional behavior | none required; consider documenting in-product |
| User→Employer stage sync | F (missing, arguably by design) | `transitionStage` has no legacy write-back | Employer never sees User's private stage moves (correct, since tracker is private) | none — this is the correct boundary |
| Self-reported vs. Employer-confirmed hire | H (review required) | `byActorType` exists per-history-entry only; metrics don't distinguish | Tracker metrics can reflect unconfirmed self-reported placements | Add a verified-placement indicator; exclude self-reported `accepted`/`joined` from `offersReceived`/`completionRate`, or label separately |
| Jobs/Scholarships/Admissions tracking | A/B | Confirmed working, client-side actions untested by automated tests | Low | Add client static tests |
| Internship tracking | B | Wiring confirmed (PF-B); no live listing exists to exercise it | Cannot be accepted end-to-end yet | Publish one listing via `AdminContentInternships.jsx` |
| Application Edit UI | Source: A (complete, statically tested); Live: H (review required) | Import/wiring confirmed; live click-through not confirmed (manual template left blank) | Cannot claim full user-facing acceptance yet | Manual browser confirmation only — no code change indicated |
| Notification click-navigation | G (defective) | Root-caused to `NotificationBell.jsx`/`NotificationsPage.jsx` ignoring `n.link` | Users cannot jump to the related application from a notification | Add `navigate(n.link)` (or `<Link>`) to both components |

## 17. Priority defects

- **P0:** none found.
- **P1:** Notification click-navigation defect (§14) — core workflow (act on a notification) is broken for every career-milestone notification type.
- **P2:** Job submission → Admin notification/email still missing (carried over, unchanged); self-reported vs. Employer-confirmed placement not distinguished at the metrics layer.
- **P3:** Internship catalogue has no published listing to complete live acceptance; Application Edit UI live click-through still needs a human/browser confirmation; Employer-side notification consumer component unverified (REVIEW REQUIRED, not confirmed broken).

## 18. Test gaps

No automated test exercises: notification click-navigation (any realm), the Employer→User stage sync success/failure paths beyond what `employerOaSyncFailure.test.js` already covers, or the Internship Track button against a live listing (impossible without seed data). Client-side Job/Scholarship/Admission/Internship track handlers have no dedicated static test beyond what PF-B added for Internship.

## 19. Recommended phases

**PF-N — Notification action routing and navigation**
- Goal: `NotificationBell.jsx` and `NotificationsPage.jsx` navigate to `n.link` on click (falling back to no-op only when `link` is absent), preserving existing mark-read behavior as a non-blocking side effect.
- Allowed files: `client/src/components/notifications/NotificationBell.jsx`, `client/src/pages/Notifications/NotificationsPage.jsx`, one new focused test file.
- Focused tests: static source assertions confirming both files call `navigate`/render a `Link` using `n.link`, and that mark-read failure does not prevent navigation.
- Manual acceptance: click a `StageChanged` notification in both the bell and the full page; confirm it lands on `/applications/:id`.
- Commit message: `fix(notifications): navigate to the linked application on click`
- Stop conditions: any requirement to change the `UserNotification` schema or the server-side link-generation logic (none expected).

**PF-J — Employer Job submission → Admin notification/email**
- Goal: call `notifyStaff(...)` and a new `jobSubmitted` email template from inside `createJob` after `Job.create` succeeds, mirroring the existing `onJobApproved` fire-and-forget pattern.
- Allowed files: `server/src/controllers/employerController.js`, `server/src/services/emailService.js` (new template), one focused server test.
- Manual acceptance: submit a job locally with Mailpit running; confirm a `UserNotification` for staff and a captured email.
- Commit message: `feat(notifications): notify admins on employer job submission`
- Stop conditions: any change to job moderation/approval state semantics.

**PF-I — Internship acceptance (data-only, no code)**
- Goal: publish one real Internship listing via the existing `AdminContentInternships.jsx` Admin panel so the PF-B Track button and filters can be accepted end-to-end.
- Allowed files: none (data action, not a code change).
- Manual acceptance: repeat local-acceptance steps 1–7 from PF-B against the new listing.
- Commit message: not applicable (no commit — pure content action, or a follow-up doc note if desired).
- Stop conditions: none; purely an ops step.

**PF-CONNECT — Verified placement confirmation (optional, scope pending product decision)**
- Goal: distinguish Employer-confirmed `accepted`/`joined` stage transitions from self-reported ones at the metrics/summary level.
- Allowed files: `server/src/services/career/ApplicationMetricsService.js`, possibly a small UI indicator in `ApplicationDetail.jsx`/`StageBadge.jsx`.
- Focused tests: metrics unit test asserting self-reported vs. employer-confirmed placements are counted/labeled distinctly.
- Manual acceptance: confirm a self-moved "joined" tracker entry is visually distinguished from an Employer-hired one.
- Commit message: `feat(applications): distinguish employer-confirmed placement from self-reported stage`
- Stop conditions: this changes what dashboard metrics mean; requires explicit product sign-off before implementation, not just an engineering judgment call — recommend confirming intent before starting.

**PF-C — Skill assessment publishing and acceptance** remains the next planned phase from the original pre-push audit and is unaffected by this audit's findings.

Not recommended at this time: a broader Edit UI rebuild (source is already correct; only live confirmation is pending) and any Employer notification consumer rebuild (status is REVIEW REQUIRED, not confirmed broken — investigate before proposing a fix).

## 20. Pre-push implications

None of the findings here are security or data-integrity defects. The notification navigation defect (P1) is a real, confirmed core-workflow break and should be fixed before push. The Job-submission notification gap (P2, carried over) remains a known, previously-accepted gap pending PF-J. The self-reported/Employer-confirmed placement gap is a product-scope question, not a blocking defect, and should not block push on its own. Internship live acceptance and Edit-UI live confirmation are acceptance-process gaps (need a human or browser-driving pass), not code defects.

## 21. Final recommendation

Proceed with **PF-N** next (smallest, highest-impact, fully root-caused, client-only fix), then **PF-J**, then the data-only **PF-I** acceptance step, deferring **PF-CONNECT** pending product sign-off on what "verified placement" should mean, before returning to **PF-C**.
