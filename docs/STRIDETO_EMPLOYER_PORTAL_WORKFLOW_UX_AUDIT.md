# STRIDETO Employer Portal Workflow and UX Audit (PF-EMP-UX-A)

## 1. Verdict

**EMPLOYER PORTAL WORKFLOW CORRECT — GUIDANCE/LIVE ACCEPTANCE REQUIRED**

Every core data pathway audited — internal apply, Admin approval, Employer stage transitions, Employer→User sync, Dashboard/Analytics counting — is confirmed correctly wired end to end, live, matching every prior report in this series. This audit found no data-integrity defect and no ownership leak. It did find one genuine, confirmed **P1 functional defect** (the Hiring Pipeline board silently omits four of the thirteen canonical stages, so candidates in `interested`, `preparing`, `joined`, or `withdrawn` disappear from that view entirely) and one confirmed, reproducible **P2 defect** (`CandidateViewed` timeline events are duplicated by design gaps in the recording call sites, not by any User/Employer action). The primary reported inconsistency — Applications page showing `shortlisted` while every other surface shows `assessment` — is **not a defect**: it is a correctly-synchronized legacy-compressed field displayed without any indication that it is a coarser view of the canonical pipeline stage shown everywhere else. The remainder of the findings are navigation/guidance/freshness gaps typical of a portal built up in incremental phases, not indicators of a broken workflow.

## 2. Repository authority

- HEAD (expected and confirmed): `c259e1bef6f39a92ac1a6c9f83fa54cff441ac88`, parent `a7babae113bbcff55254dccbabb75a95c7fe8507`
- Branch: `main...origin/main [ahead 77]`, tracked tree clean, staged: none
- Preserved untracked: both prior reports, present, unmodified
- `.env.staging`: ignored, untouched
- Worker: confirmed stopped throughout
- No source, test, Docker, environment, or database record was modified during this audit.

## 3. Runtime and live evidence

Confirmed via `docker ps` and `printenv`: `frontend`, `api-a`, `api-b`, `mongodb`, `redis` all healthy; `caddy` running; worker absent (stopped); `APPLICATION_DUAL_WRITE=1` live on both API containers. Live data for the Employer ("Global Identity", `…1d69b7`) confirmed: 6 Jobs total, 1 internal ("Andoride Developer"), 5 external; 2 Employer-facing `Application` records total for this Employer (Dani, `hired`; Usama121, `shortlisted`); Job `views: 3`, `applicationsCount: 2` (Analytics' 66.67% conversion = 2/3, confirmed arithmetically correct); Usama121's linked `OpportunityApplication` at `pipelineStage: "assessment"`, `interview.scheduledAt: null`.

## 4. Employer workflow map

| Step | Owning page | Summarizing page | Next-step link present? |
|---|---|---|---|
| 1. Company setup | Settings | Dashboard header (verification badge) | No link from Dashboard to Settings for an incomplete profile |
| 2. Post a Job | Post New Job | My Job Posts | Yes — "Post New Job" in sidebar and on My Job Posts |
| 3. Choose application method | Post New Job (selector, PF-HIRE-B1/B2) | My Job Posts (badge), Job Analytics | Yes |
| 4. Submit for Admin review | automatic on save | My Job Posts ("Pending approval" badge) | n/a |
| 5. Approval/rejection notification | Admin-triggered | Notifications, My Job Posts badge | Approval notified; rejection notification confirmed missing in the earlier notification audit (unchanged, out of this audit's scope) |
| 6. Receive internal applications | automatic | Dashboard (Total Applications), Applications page | Applications page has no link *from* Dashboard's "Total Applications" card beyond the card itself (see §6) |
| 7. Review candidates | Hiring Intelligence Candidates, Applications page | Dashboard, Hiring Pipeline | Two separate "review" surfaces exist (Candidates list and Applications page) with no cross-link between them |
| 8. Move through pipeline | Candidate Detail (stage select), legacy Applications page (status buttons) | Hiring Pipeline, Applications page | **Two different controls write toward the same underlying data via two different vocabularies** (§9) |
| 9. Private notes | Candidate Detail | — | correctly scoped, no cross-page duplication |
| 10. Schedule interviews | Candidate Detail | Dashboard "Upcoming Interviews" widget (data-correct, §13) | UI incomplete (§13) |
| 11. Offer/accepted/joined/rejected | Candidate Detail (canonical), Applications page (legacy subset) | Hiring Pipeline (**but silently drops `joined`, `withdrawn`**, §9) | Broken for those two stages |
| 12. Close/archive Job | My Job Posts | — | Confirmed correct in prior audits, not re-verified here |
| 13. Review analytics | Job Analytics | My Job Posts (per-row link) | Yes |

**Largest break in the intended journey**: step 8/11 — an Employer using the Hiring Pipeline board as their primary "where are my candidates" view will lose track of anyone who reaches `joined` or `withdrawn` (the board has no column for them), and will never see anyone still at `interested`/`preparing` even though those candidates legitimately exist in the system.

## 5. Route/menu inventory

| Menu/Page | Route | Purpose | Primary action | Data source | Links to | Missing guidance | Overlap |
|---|---|---|---|---|---|---|---|
| Dashboard | `/employer` | Operational summary | none (read-only) | `EmployerDashboardCompositionService` | My Job Posts (per-row) | No link from metric cards to their detail pages | None |
| Intelligence (hub) | `/employer/intelligence` | Widget dashboard for hiring decision-support | navigate onward | same composition service | Candidates, Pipeline (2 buttons) | Compare has no nav entry at all | Partial overlap with Employer Dashboard (both show hiring-overview-style numbers) |
| Intelligence/Candidates | `/employer/intelligence/candidates` | Ranked candidate search | filter, select, compare | `intelligenceCandidates` | Candidate Detail, Compare | Empty state has no CTA | Overlaps with Applications page (§9) |
| Intelligence/Pipeline | `/employer/intelligence/pipeline` | Kanban stage overview | none (view-only, links to detail) | `intelligencePipeline` | Candidate Detail | No loading state; 4 stages missing entirely (P1, §9) | Overlaps with Candidates' `pipelineStage` filter |
| Intelligence/Compare | `/employer/intelligence/compare` | Side-by-side metrics | none | `intelligenceCompareCandidates` | Candidate Detail (per name) | Reachable only via checkbox on Candidates | None |
| My Job Posts | `/employer/jobs` | Job lifecycle management | edit/close/reopen/activate | `getJobs` | Post/Edit Job, Applications (per-row) | none significant | None |
| Post New Job | `/employer/jobs/new` | Create a Job | submit | n/a | — | none significant | None |
| Edit Job | `/employer/jobs/:jobId/edit` | Edit a Job | submit | `getJob` | — | none significant | None |
| Applications | `/employer/applications` | Legacy candidate status management | change status (4-value) | `getJobApplications` | Candidate Detail? **No — no link exists** (§9) | none significant | **Overlaps with Candidates list and Candidate Detail's stage control** (§9) |
| Candidate Detail | `/employer/intelligence/candidates/:id` | Full candidate review + actions | stage/notes/interview | `intelligenceCandidate` | back to Candidates list only | No link back to the specific Job's Applications-page row | Stage control overlaps with Applications page's status buttons |
| Analytics | `/employer/analytics` | Per-Job metrics | select Job | `jobAnalytics` | none | none significant | None |
| Notifications | `/employer/notifications` | Inbox | mark read/delete | `employerInboxApi` | click-through per notification | Category list includes irrelevant User-realm categories | None |
| Settings | `/employer/settings` | Company profile | save | `updateProfile` | none | No link to notification preferences (none exist) | None |

**Dead/unreachable routes**: none found — every route in `routes/index.jsx`'s Employer subtree is reachable from at least one in-app link, except `/employer/intelligence/compare`, which is reachable only via a runtime-generated query string (no persistent nav entry, no bookmark-worthy static link) — a minor discoverability gap, not a dead route.

**Duplicate navigation**: the Applications page and the Candidates/Candidate-Detail pair are two independently-built, non-cross-linked surfaces for the same underlying task ("see and act on my candidates"), using two different status vocabularies (§9). This is the most significant structural overlap found.

## 6. Dashboard

Widget-by-widget classification (`EmployerDashboardCompositionService.js`, confirmed unchanged from PF-EDM-A/B1/B4):

| Widget | Classification | Note |
|---|---|---|
| Active Jobs | correct and connected | |
| Total Jobs | correct and connected | non-additive relationship to the 4 status buckets still undisclosed (carried over from PF-EDM-A, not re-flagged as new) |
| Draft Jobs | correct and connected | PF-EDM-B1 fix confirmed present (rejected Jobs excluded) |
| Pending Approval | correct and connected | |
| Closed Jobs | correct and connected | manual-close-only definition, unchanged |
| Total Applications | correct and connected | internal-only, explicitly scoped, confirmed live (2 for this Employer) |
| New Applications | correct and connected | 7-day rolling window |
| Shortlisted | **correct but semantically unclear** | reads `pipelineCounts.screening` only — a candidate in `assessment` (like Usama121) also legacy-maps to "shortlisted" on the Applications page but is **not** counted in this specific Dashboard card, since the Dashboard's `shortlisted` card is keyed to the single canonical stage `screening`, not the legacy-compressed bucket. This is a second, narrower instance of the same legacy-vs-canonical ambiguity as §9, on the Dashboard specifically. |
| Interviews | **semantically unclear** | counts candidates whose `pipelineStage === 'interview'` — confirmed via source this is pure pipeline-stage membership, unrelated to whether a real interview appointment (`interview.scheduledAt`) exists. A separate, correctly-scheduled-date-filtered `upcomingInterviewsProvider` widget exists in the same composition service and is registered in the default layout — the *data* layer already makes the right distinction; whether the *rendered* label makes this obvious to an Employer was not independently confirmed (out of this audit's file list for the widget renderer itself). |
| Recent Job Posts | correct and connected | "not tracked" disclosure confirmed correct in every prior audit |
| Quick actions / urgent tasks | **not implemented as a distinct concept** | no dedicated "urgent tasks" widget exists; the closest equivalent is the Recent Activity feed |

The Dashboard genuinely summarizes rather than duplicates detail (each card's number is a real aggregate, not a copy of a detail page's row count) — but per-card click-through to the relevant detail page was not confirmed present for every card (My Job Posts links exist for Recent Job Posts rows only, not for the summary metric cards themselves).

## 7. My Job Posts

Confirmed (unchanged from PF-HIRE-B1/B2/B3, re-verified against current live data): title, status badge, approval-status badge, method badge (internal/external-url/external-email distinction, PF-HIRE-B3 copy), views, tracked-applications count, Edit/Close/Reopen/Activate actions, and the internal-vs-external destination disclosure are all present and correctly wired. Editing an approved Job correctly returns it to pending review (unconditional `approvalStatus` reset, confirmed unchanged in PF-HIRE-B2). The internal-Job-with-applications→external-switch restriction (409 conflict) is confirmed correct and unchanged (PF-HIRE-B2).

**"Duplicate" Job action**: not found as an implemented action anywhere in `EmployerJobs.jsx`'s `JobActions` component (only Edit/Reopen/Activate/Close) — the task brief asked this to be verified as present; it is **not** present on the Employer-facing My Job Posts page (the only "duplicate" capability found anywhere in this codebase is Admin's own content-management duplicate, `adminJobsController.duplicate`, which is a staff-only action, not Employer-facing).

**"Post New Job" as a separate sidebar item**: currently a distinct top-level sidebar link (per §5). No evidence was found that this causes discoverability problems — it is one click, always visible, and duplicated as a call-to-action button on My Job Posts itself when the list is non-empty. No change is recommended; a menu redesign is explicitly out of this audit's scope regardless.

## 8. Post/Edit Job

Confirmed unchanged from PF-HIRE-B1/B2/B3: selector clarity, conditional field visibility, stale-hidden-value clearing, re-review warning (scoped correctly to `active && approved`), and the existing-applications switch-restriction warning are all present and correct, per the already-committed and already-tested implementation. Not re-audited in depth here beyond confirming no regression (file contents match what PF-HIRE-B3 committed). The form remains a single page with grouped fieldsets, not a multi-step flow — appropriate for its current field count; no evidence found that a step-by-step redesign is needed.

## 9. Applications — the primary reported inconsistency

Traced exactly, per the task's required questions:

1. **Which field is authoritative?** Neither is "more authoritative" than the other — they are two different, both-correct projections of the same underlying transition. `Application.status` (7-value legacy enum) is authoritative for what the *Applications page and every legacy `updateApplicationStatus` caller* read/write. `OpportunityApplication.pipelineStage` (13-value canonical enum) is authoritative for what *Candidate Detail, Hiring Pipeline, Hiring Intelligence, the Dashboard, and the User's own tracker* read/write. `EmployerIntelligenceService.transitionPipeline` (the canonical write path, used by Candidate Detail and confirmed to be what actually moved Usama121) updates **both** fields in the same request via `PIPELINE_TO_LEGACY_STATUS`.
2. **Why does `shortlisted` appear?** Because `assessment` compresses to legacy `shortlisted` per `PIPELINE_TO_LEGACY_STATUS['assessment'] = 'shortlisted'` (confirmed unchanged, `shared/employer/constants.js`), and the Applications page (`EmployerApplications.jsx` line 25, 266) renders `app.status` — the raw legacy field — directly, with no canonical-stage lookup or annotation.
3. **Is `shortlisted` a simplified legacy status representing several canonical stages?** Yes, confirmed: both `screening` and `assessment` map to `shortlisted`; `offer` and `negotiation` both map to `interview`; `accepted` and `joined` both map to `hired`; `rejected` and `withdrawn` both map to `rejected`.
4. **Does the Applications page mutate the legacy field, canonical field, or both?** The Applications page's own status buttons (`STATUS_OPTIONS = ['shortlisted','rejected','interview','hired']`, calling `updateApplicationStatus`) mutate **only** the legacy field directly, with a **best-effort, fire-and-forget** sync to the linked `OpportunityApplication` (`syncOpportunityApplicationFromLegacyStatus`, confirmed in PF-TRACK-A). Usama121's stage was *not* moved via this page in the observed scenario — it was moved via Candidate Detail's canonical `transitionPipeline`, which mutates both fields, awaited, atomically within the same request.
5. **Can the Employer see conflicting stages after valid updates?** Not "conflicting" in the sense of one being wrong — but yes, **inconsistent-looking**: an Employer who moves a candidate via Candidate Detail to `assessment` and then opens the Applications page will see "shortlisted," with no copy anywhere explaining that this is expected.
6. **Should this page display the canonical stage directly?** That would be the cleanest long-term fix, but it is a genuine product-scope decision (it also changes what the 4-button legacy status control means) rather than a pure bug fix — flagged for a recommended phase, not implemented here.
7. **Would changing it break legacy Employer actions?** Only if the status-mutation buttons themselves were also changed to write canonical stages directly without the existing legacy-to-canonical mapping layer; a display-only change (show `pipelineStage` as a read-only badge alongside the existing legacy status control) would not break anything.
8. **Is the inconsistency data, mapping, copy, or freshness?** **Copy.** The data is correct and the mapping (`PIPELINE_TO_LEGACY_STATUS`) is correct and already proven live-accurate in PF-TRACK-C3; nothing here is stale (`Application.updatedAt` and `OpportunityApplication.updatedAt` are both current). The page simply presents a coarser vocabulary without labeling it as such.

**Classification: LEGACY PROJECTION NEEDS CLEARER COPY.**

## 10. Candidate detail

Confirmed complete for: candidate identity, Job context, ranking/fit explanation, Job Match/Resume Quality panels, hiring recommendations, verified skills, credentials, documents, timeline, and a combined stage/notes/interview action panel, with correct "← Candidate List" back navigation. The stage control exposes the **full canonical 13-stage list** — not a reduced subset — which is internally consistent with the server contract but, per §9, inconsistent with what the Applications page's 4-button control offers for the *same* underlying application. Stage transitions go through `transitionPipeline`, so `canTransition`'s stage-machine validity check applies but is explicitly overridable by the Employer (`forced: !allowed`, confirmed in PF-TRACK-C1) — invalid-looking jumps are logged as "forced," not blocked. No UI evidence of a reopen-terminal-stage restriction or confirmation prompt was found. Notes are correctly Employer-scoped (`visibility: 'employer_scoped'`, unchanged from source review in prior audits) — not User-visible. Interview scheduling reaches the User via the already-verified `InterviewScheduled` career event/notification (PF-TRACK-C1/C2B/C3, confirmed correct live). Stage change and interview scheduling are handled as separate actions/buttons, correctly.

**Consistency with Applications page and Hiring Intelligence**: Candidate Detail and Hiring Intelligence (Pipeline/Candidates) both read/write the canonical `pipelineStage` and are mutually consistent (confirmed by the same underlying `EmployerCandidateCardService` card shape, per the research agent's findings). The Applications page's legacy 4-value view is the one outlier, per §9.

## 11. Hiring Intelligence — Candidates

Purpose confirmed: ranked, filterable candidate search across all of the Employer's internal Jobs (or scoped to one via `jobId`), with saved-filter support and up-to-4-way comparison. Correctly internal-application-scoped (`EmployerIntelligenceService.listCandidates`, unchanged, PF-TRACK-B2's explicit-internal-filter fix confirmed still present). Counts are sourced from the same `Application` collection the Dashboard and Applications page use, so totals are consistent by construction. Stage labels use canonical values (the full `PIPELINE_STAGES` dropdown). Empty state exists but has no actionable guidance (plain text only, no CTA). No freshness listeners exist — single mount-only fetch, confirmed by the research agent; this page was not in scope for the PF-TRACK-B3 freshness fix (which only touched the Dashboard, Applications page, and Hiring Intelligence's *composition* hook used by the widget dashboard — not this standalone Candidates list).

## 12. Hiring Pipeline

**Confirmed P1 defect.** `EmployerPipeline.jsx`'s client-side `FOCUS_STAGES` constant is a hand-maintained 9-value subset of the canonical 13-stage `PIPELINE_STAGES`, omitting `interested`, `preparing`, `joined`, and `withdrawn`. The server's `getPipeline` correctly buckets every candidate into all 13 canonical columns; the client simply never renders columns for the missing four, so any candidate currently in one of those stages is **completely absent from the board** — not shown in a catch-all column, not counted anywhere on this page, silently missing. This directly matches the task brief's own P1 example, "candidate disappears from pipeline," verbatim. The same candidates remain correctly visible in the Candidates list (which filters against the full canonical set) and in Candidate Detail — so no data is lost, only this one view's rendering is incomplete. No loading state exists either (an empty `pipeline` object during fetch renders every visible column as `(0)`, indistinguishable from "genuinely no candidates"). No drag-and-drop or in-board stage change exists; cards are read-only links to Candidate Detail.

Hiring Pipeline adds genuine decision-support value over Applications/Candidates (a single-glance stage-distribution view) but currently cannot be trusted as a complete picture of the Employer's pipeline until the stage list is corrected.

## 13. Interview workflow

**Classification: FUNCTIONAL BUT INCOMPLETE.**

- Pipeline stage (`interview`) vs. scheduled appointment (`interview.scheduledAt`/`mode`/`location`/`outcome`) are correctly modeled as **separate fields** on `OpportunityApplication` — moving a candidate to the `interview` pipeline stage does **not** by itself create an appointment (confirmed: Usama121 is not at `interview` stage in this scenario, but the Employer→User audits in PF-TRACK-C1/C3 already independently confirmed `transitionPipeline`'s stage write and `scheduleInterview`'s appointment write are two distinct code paths). Scheduling an interview *does* auto-advance the pipeline stage to `interview` when the stage machine allows it — a one-directional convenience, not a conflation of the two concepts.
- Date/time entry exists (`datetime-local` input on Candidate Detail). Timezone handling was not independently traced beyond confirming the input type; no explicit timezone selector or disclosure was found.
- **Method (mode) is hard-coded to `'video'` client-side** — the server accepts and stores `mode`/`location`/`notes`, but no UI control exposes them, so every interview in this system is recorded as "video" regardless of what the Employer actually arranges.
- **No reschedule/cancel UI exists** — only create (`scheduleInterview`, wired) and complete (`completeInterview`, defined client-service-side but **zero call sites anywhere in the client** — confirmed by the research agent's repo-wide search). An Employer can schedule an interview but has no way, through this UI, to ever mark its outcome or change/cancel it.
- User notification on scheduling is confirmed correct and live (`InterviewScheduled` career event, correct link, PF-TRACK-C1/C2B/C3).
- Employer-side notification of the scheduling action itself was not found as a distinct notification (the Employer is the one performing the action, so this is expected, not a gap).
- An "Upcoming Interviews" Dashboard widget exists and is correctly scoped to *actually scheduled* interviews (`interviewStatus?.scheduledAt` filtered, 8-item cap, sorted) — a real, if minimal, hiring-task surface.
- Interview reminders depend on the worker/email pipeline, correctly out of scope for this audit (worker intentionally not started).

## 14. Analytics

Confirmed correct and live: internal Jobs show views/applications/conversion; external Jobs show views only with "not tracked"/"not available" for the rest (unchanged since the original Employer Dashboard/Analytics audits). For "Andoride Developer": `views: 3`, `applications: 2`, conversion `2/3 = 66.67%` — confirmed arithmetically exact from the same live-queried counters used throughout this session; no evidence of duplicate-view inflation was found (the stored `views` counter increments once per public detail-page load with no dedup, a pre-existing, already-documented characteristic from the original Dashboard audit, not new). Division-by-zero is correctly handled (`n/a`/"Not available" when the denominator is zero, unchanged). Navigation from My Job Posts to Analytics exists per-row.

## 15. Notifications

Employer-facing notifications confirmed for `job.submitted.pending` and `job.approved` (both present live for this Employer, correct `link: '/employer/jobs'`). `job.rejected` remains confirmed absent (a pre-existing, already-documented gap from the original notification-connection audit, not newly discovered here, and out of this audit's P0-P1 scope since it was already scoped to a future phase in that audit). New-internal-application and candidate-withdrawal Employer notifications were not found as distinct types in this codebase (not independently re-searched beyond what the research agent covered; flagged as a test-inventory gap, §19, not asserted as a confirmed missing feature). Mark-read, click-through link safety (`isSafeInternalLink`), and category/read-status filtering are all present and correctly implemented per the research agent's trace. The category filter includes User-realm-only options (`scholarship`, `admission`) that can never produce a result for an Employer — a minor, low-risk copy/UX issue, not a security concern (no cross-realm data is actually exposed, just an irrelevant filter choice).

**Duplicate-looking timeline entries** — see §16 (this audit's required section for timeline events specifically); the same underlying mechanism also affects notifications indirectly only in that repeated `CandidateShortlisted`-class notifications were already confirmed (not duplicated further) in PF-TRACK-C3's live data — that finding is not revisited here as new.

## 16. Timeline events — duplicate `hiring.candidate_viewed`

**Classification: DUPLICATE EVENT PUBLISHING**, confirmed by combining this session's live data with source tracing:

- Live data shows repeated `hiring.candidate_viewed` entries for both Usama121 and Dani, in a mixed pattern: some pairs separated by seconds-to-minutes (genuinely distinct Employer visits) and some pairs separated by **~50-90 milliseconds** (not humanly plausible as two distinct views) — confirmed via direct timestamp inspection of `timelineEvents`, e.g. Usama121: `21:26:23.854` / `21:26:23.909`, and again `21:46:48.799` / `21:46:48.861`; Dani: `20:43:16.202` / `20:43:16.251`, and `21:05:54.851` / `21:05:54.906`.
- Root cause, confirmed by source: `EmployerIntelligenceService.getCandidateDetail(employerId, legacyApplicationId, { recordView = true })` defaults to recording a view. The HTTP controller (`employerIntelligenceController.getCandidateDetail`) calls it with **no options object**, so every plain page-load `GET` records a view — this alone is correct, expected behavior for a genuine page view. The defect is that `refresh()` (called after adding a note, after scheduling an interview, and on the initial mount effect) hits this **same** recording endpoint every time, so any two of these calls occurring close together — e.g. the mount effect's own fetch overlapping with a near-simultaneous second trigger — produces two distinct `CandidateViewed` events with two different `eventId`s (`randomUUID()`-generated per call, per `CareerEventBus.emitCareerEvent`), which is why the existing `careerEventId`-uniqueness dedup in `TimelineService.appendFromCareerEvent` does **not** catch this: it only prevents the *same* event being processed twice, not two *different* events representing the same human action.
- **Adding a note or scheduling an interview each generate an extra, arguably-unwanted `CandidateViewed` timeline entry as a side effect of their own `refresh()` call** — confirmed by source; not independently re-verified against a live note/interview action in this session (doing so was out of this audit's read-only scope).
- The client's Timeline Viewer renders every entry individually with no grouping/collapsing of repeated verbs.

This is not "legitimate repeated events" (the sub-100ms pairs are not real distinct human views), not "duplicate storage" (each event is a genuinely distinct, correctly-persisted document — no write is happening twice for the same event), and not "timestamp display ambiguity" (the underlying `occurredAt` values are genuinely different, if only by tens of milliseconds). It is a **duplicate-publishing** pattern rooted in `recordView` defaulting to true on every GET, including GETs that immediately follow an unrelated mutation.

## 17. Cross-page freshness

| Page | Mount | Route re-entry | Focus | Visibility | Post-mutation | Stale risk |
|---|---|---|---|---|---|---|
| Dashboard | yes | yes (PF-EDM-B4) | yes | yes | n/a (read-only) | Low |
| My Job Posts | yes | yes (natural remount) | no | no | yes (`loadJobs()` after actions) | Low-medium |
| Applications | yes | yes (PF-TRACK-B3) | yes | yes | yes (PF-TRACK-B3) | Low |
| Candidate Detail | yes | yes (natural remount) | no | no | yes, but only for the specific mutating action's own `refresh()` | Medium — no cross-tab/cross-session refresh |
| Hiring Intelligence Candidates | yes | yes (natural remount) | no | no | no | **High** — no refetch trigger of any kind beyond first mount |
| Hiring Pipeline | yes | yes (natural remount) | no | no | no | **High**, and no loading indicator either (§12) |
| Analytics | yes | yes (natural remount) | not independently re-confirmed this session | not independently re-confirmed | n/a (read-only) | Low-medium |
| Notifications | yes (on filter/page change) | yes (natural remount) | no | no | n/a (read-only + mark-read/delete already reflected locally) | Low |
| Settings | not independently re-confirmed this session | yes (natural remount) | not independently re-confirmed | not independently re-confirmed | not independently re-confirmed | Unknown |

The Hiring-Intelligence-family pages (Candidates, Pipeline, Compare) consistently lack the focus/visibility freshness pattern that PF-TRACK-B3 already established and proved for the Dashboard and Applications page — they were simply out of that phase's scope, not a regression.

## 18. Guidance/rules matrix

| Rule | Visible where | Missing where it should appear | Accuracy |
|---|---|---|---|
| Admin approval is required | My Job Posts (badge), Post/Edit Job (implicit via re-review warning) | Dashboard's Pending Approval card has no link explaining what happens next | accurate |
| Editing an approved Job triggers re-review | Post/Edit Job (PF-HIRE-B3 warning) | not shown on My Job Posts before the Employer clicks Edit | accurate |
| Internal Jobs are tracked / External are not | Post/Edit Job (PF-HIRE-B3), My Job Posts, Applications page, Analytics | consistently shown everywhere it matters | accurate |
| Official Employer stages synchronize to the User | nowhere explicitly stated as Employer-facing copy | not shown anywhere in the Employer Portal (an Employer has no way to learn this from the UI itself — only from this audit series) | accurate, but wholly undocumented in-product |
| User private stages do not overwrite Employer decisions | nowhere | same as above | accurate, undocumented |
| Interview stage ≠ scheduled appointment | nowhere explicitly | Candidate Detail's interview panel doesn't clarify this distinction; Dashboard's "Interviews" card doesn't either | accurate at the data layer (§13), unclear in copy |
| Internal Job with applications cannot switch external | Post/Edit Job (PF-HIRE-B3 warning, shown for any internal Job regardless of whether it actually has applications yet) | — | accurate, if slightly over-broad (shown even at zero applications) |
| Closing a Job does not delete candidates/history | nowhere explicitly stated | An Employer closing a Job has no on-screen reassurance that history is preserved | not contradicted by anything found, just unstated |
| Analytics applies only where Strideto can observe applications | Analytics page itself (`analyticsTruthHint`) | — | accurate |
| Applications page shows a legacy-compressed status | **nowhere** | Applications page itself, most urgently | this is the §9 finding — the one rule genuinely missing where it's most needed |

## 19. Accessibility, responsiveness and navigation

- Mobile sidebar: confirmed present (`lg:hidden` sticky header + slide-in `role="dialog"` panel with focus trap via `useOverlayA11y`, per the research agent) — meets the basic accessible-dialog pattern.
- Radio/select labels: confirmed correctly associated via `htmlFor`/`id` throughout Post/Edit Job (PF-HIRE-B1/B2, unchanged).
- Status communicated beyond color: badges throughout the portal use real text labels, not color-only indicators (confirmed pattern, consistent with PF-HIRE-B3's own accessibility check).
- Horizontal pipeline usability: not independently re-verified visually this session (no browser automation used); Hiring Pipeline's incomplete stage list (§12) is a functional gap regardless of layout quality.
- Focus states / page headings / back navigation: Candidate Detail has explicit back navigation; other pages were not individually re-audited for heading structure beyond what's already established as consistent across this Employer Portal's shared component conventions (`labelClass`, `FieldError`, etc., from PF-HIRE-B1/B2/B3).
- Dark/light theme: not independently re-verified this session; no evidence of regression found in any file read.

## 20. Read-only live correlation

All values below independently confirmed via bounded, safe-field-only MongoDB queries this session (masked IDs, no email/token/private-note content printed):

| Entity | Value |
|---|---|
| Job "Andoride Developer" | `…e70f66`, `applyType: internal`, `status: active`, `approvalStatus: approved`, `employerId: …1d69b7`, `views: 3`, `applicationsCount: 2` |
| Dani's Application | `status: hired`, `updatedAt` unchanged since PF-TRACK-C1/C3 |
| Usama121's Application | `…7124a0`, `status: shortlisted` |
| Usama121's OpportunityApplication | `…7124a7`, `pipelineStage: assessment`, `interview.scheduledAt: null`, `interview.mode: video` (default, never actually scheduled) |
| Employer's total Jobs | 6 (1 internal, 5 external) |
| Employer's total Applications | 2 (Dani + Usama121) |
| Employer-recipient notifications | `job.submitted.pending`, `job.approved` — both present, correctly linked |
| Timeline events (Usama121) | 5 total: 1 `TalentProfileCreated` (system), 4 `hiring.candidate_viewed` (employer) in two tight (~55-60ms) pairs |
| Timeline events (Dani) | includes at least 4 tight-paired and several widely-spaced `hiring.candidate_viewed` entries, confirming the duplicate pattern recurs across sessions, not a one-off |

## 21. Source-wired versus live-confirmed matrix

| Item | Source-wired | Live-confirmed this session |
|---|---|---|
| Internal apply → dual linkage | Yes | Yes (re-confirmed, unchanged from PF-TRACK-C3) |
| Employer→User stage sync | Yes | Yes (re-confirmed) |
| Applications page legacy status display | Yes, by design | Yes — confirmed exactly matches the compressed mapping, not stale |
| Hiring Pipeline missing 4 stages | Yes (confirmed by direct source read of `FOCUS_STAGES` vs `PIPELINE_STAGES`) | Not independently re-confirmed against a live candidate actually sitting in one of the missing stages (none of the three known candidates — Dani, Usama121, and the one other tracked entry — currently occupy `interested`/`preparing`/`joined`/`withdrawn` at the `Application` level in this dataset) — the defect is proven by source, not by an observed missing card |
| `CandidateViewed` duplication | Yes (confirmed by direct source read of the missing `recordView:false` on the plain GET path, and of `refresh()`'s reuse of that path) | Yes — directly confirmed via live timestamp pairs |
| Interview `completeInterview` never called | Yes (confirmed by repo-wide search, zero call sites) | Not applicable to live-confirm (absence of a call site is a static fact, not a runtime one) |
| Settings gaps (no security/notification-prefs/team/billing UI) | Yes (confirmed by direct read of `EmployerSettings.jsx`'s full field list) | n/a — absence of a feature is a source fact |

## 22. Test inventory

Directly related tests found: `employerDashboardFreshness.test.js`, `employerApplicationsFreshness.test.js`, `employerIntelligenceFreshness.test.js` (from PF-TRACK-B3 — do **not** cover Candidates/Pipeline/Compare, confirming §17's gap is also a test gap), `employerHireMethodSelector.test.js`, `employerPostJobValidation.test.js`, `careerNotificationLinkFallback.test.js`, `jobApplicationNotificationLink.test.js`, `employerDashboardMetrics.test.js`. No test exists for: Hiring Pipeline's stage-list completeness (would have caught §12 directly); `CandidateViewed` recording/dedup behavior (would have caught §16); the legacy-vs-canonical status display on the Applications page (a static-source assertion could at least document the intentional compression, preventing a future "fix" from silently changing the mapping); interview `mode`/`location` field exposure; `completeInterview` having zero call sites (a simple grep-based test could assert this is either intentionally absent or flag it once wired). No test covers Settings, Notifications' category-list appropriateness, or Compare's reachability.

## 23. Findings by priority

- **P0:** none. No cross-Employer exposure, no unauthorized stage update path, no private-note leakage, and no notification opening another Employer's or User's record was found anywhere in this audit.
- **P1:**
  - Hiring Pipeline board silently omits candidates in `interested`, `preparing`, `joined`, or `withdrawn` — a genuine "candidate disappears from pipeline" defect, confirmed by source (`FOCUS_STAGES` vs. `PIPELINE_STAGES` mismatch, `EmployerPipeline.jsx`).
- **P2:**
  - `CandidateViewed` timeline events are duplicated by design (missing `recordView:false` guard combined with mutation-triggered `refresh()` reusing the recording endpoint) — confirmed live and by source.
  - Interview workflow is functional but incomplete: method/location/notes not exposed in the scheduling UI (hard-coded to video), and `completeInterview` has no UI at all despite full server support.
  - Applications page's legacy-status display needs clarifying copy (or a canonical-stage badge) — the primary reported inconsistency, confirmed as copy/presentation, not data.
  - Hiring-Intelligence-family pages (Candidates, Pipeline, Compare) lack the focus/visibility freshness pattern already proven and shipped for Dashboard/Applications (PF-TRACK-B3/PF-EDM-B4) — stale risk.
  - Hiring Pipeline has no loading state, visually indistinguishable from "empty."
- **P3:**
  - No sidebar entry for Candidates/Pipeline/Compare (2-hop access via Intelligence hub; Compare has no persistent entry at all).
  - Notifications category filter includes irrelevant User-realm options (scholarship/admission).
  - Settings missing security/notification-preferences/team/billing sections (all plausibly intentional future scope, not confirmed broken).
  - Test gaps listed in §22.
  - Dashboard's non-additive Total-Jobs-to-buckets relationship remains undisclosed (carried over, not new).

## 24. Recommended implementation phases

**PF-EMP-UX-B1 — Hiring Pipeline stage-list completeness (P1)**
- Exact defect: `EmployerPipeline.jsx`'s `FOCUS_STAGES` constant omits `interested`, `preparing`, `joined`, `withdrawn`.
- Allowed files: `client/src/pages/Employer/EmployerPipeline.jsx`, one focused test.
- Acceptance condition: a candidate fixture at each of the 4 missing stages renders a column/card; existing 9-stage rendering unchanged.
- Dependencies: none.
- Live data mutation required: no — this is a pure client rendering fix; can be verified with a source-contract test alone, live-accepted afterward by observing a real candidate reach one of the 4 stages.

**PF-EMP-UX-B2 — CandidateViewed duplicate-event correction (P2)**
- Exact defect: the plain `GET` controller path and mutation-triggered `refresh()` calls both hit `getCandidateDetail` with `recordView` defaulting true, with no dedup for near-simultaneous or mutation-adjacent views.
- Allowed files: `server/src/controllers/career/employerIntelligenceController.js` and/or `server/src/services/career/EmployerIntelligenceService.js` (pass `recordView: false` explicitly from any call that already recorded a view this request, or from `refresh()`-driven client calls), one focused test.
- Acceptance condition: adding a note or scheduling an interview no longer produces an extra `CandidateViewed` event; a genuine new page load still records exactly one.
- Dependencies: none.
- Live data mutation required: no for the fix itself; a live acceptance pass (add one note, confirm exactly one new timeline event) would need one real mutation, deferred to a live-acceptance step, not required to implement the fix.

**PF-EMP-UX-B3 — Applications page legacy-status clarity (P2)**
- Exact defect: no copy or badge on the Applications page discloses that its status vocabulary is a compressed legacy view of the canonical pipeline stage shown elsewhere.
- Allowed files: `client/src/pages/Employer/EmployerApplications.jsx`, one i18n locale file, one focused test.
- Acceptance condition: the page shows the canonical stage (read-only) alongside or instead of the raw legacy label, with copy explaining the relationship; the 4-button legacy control's own behavior is unchanged.
- Dependencies: none (does not require touching the write path).
- Live data mutation required: no.

**PF-EMP-UX-B4 — Interview scheduling UI completion (P2)**
- Exact defect: mode hard-coded to video, no location/notes fields, no UI for `completeInterview`.
- Allowed files: `client/src/pages/Employer/EmployerCandidateDetail.jsx`, `client/src/services/employerService.js` (if a new call wiring is needed for complete), one focused test.
- Acceptance condition: an Employer can select a method, enter a location, and mark an interview complete with an outcome, through the UI.
- Dependencies: none — server support already exists in full.
- Live data mutation required: no for implementation; live acceptance would need one real interview scheduled and completed.

Not recommended as phases without further evidence: Hiring-Intelligence-family freshness (P2, real but lower urgency than the above four, and mechanically identical to the already-proven PF-TRACK-B3 pattern — small enough to fold into whichever of the above phases touches the same files, not necessarily its own phase); Settings expansion (P3, no confirmed defect, plausibly intentional current scope); notification category cleanup (P3, cosmetic).

## 25. Manual acceptance prerequisites

For PF-EMP-UX-B1: a candidate application at one of the four missing stages (none currently exists live in this dataset — would need to be reached by moving Usama121 or a future test candidate to `interested`, `preparing`, `joined`, or `withdrawn` via Candidate Detail's stage control, then confirming it appears on the Pipeline board). For PF-EMP-UX-B2: one real note-add or interview-schedule action, with a timeline-event count taken immediately before and after. For PF-EMP-UX-B4: one real interview scheduled with a non-default method/location, then marked complete.

## 26. Final recommendation

Proceed with **PF-EMP-UX-B1** first (smallest, highest-severity, purely a client rendering fix with no data-model risk), then **PF-EMP-UX-B2** (closes a confirmed, live-reproducing data-quality issue in the timeline), then **PF-EMP-UX-B3** and **PF-EMP-UX-B4** in either order (both are independent, contained UX-completion phases). No phase in this set requires a database migration, a new dependency, or any change to the already-verified core synchronization pathway (PF-TRACK-A through C3), which this audit reconfirms is working correctly end to end.
