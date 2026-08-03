# STRIDETO Employer Dashboard Metrics Connection Audit (PF-EDM-A)

## 1. Verdict

**DASHBOARD METRICS WIRING CORRECT — DATA/SEMANTICS ACCEPTANCE REQUIRED**

Every displayed counter is genuinely wired to a real query scoped to the authenticated Employer — there is no client-side hardcoding, no fake zero, and no ownership leak. The observed all-zero application/shortlist/conversion values are consistent with "no Employer-facing `Application` document exists yet for this Employer's internal jobs," which is the most likely explanation given the User-side testing in prior phases exercised the *personal tracker* (`OpportunityApplication`), not necessarily an internal apply to *this* Employer's job. One genuine semantic defect was found and is not data-dependent: **a rejected Job's `status` field is never updated away from `'draft'`, so rejected Jobs are permanently counted under "Draft Jobs" with no separate visibility anywhere on the dashboard.** This is real and fixable independent of live data.

## 2. Repository authority

- HEAD: `c7f42715200b3fa023c4cf70502e0244d9bafeb6`, parent `34398fa898a232dc44ed55df598c513312529c13`
- Branch: `main...origin/main [ahead 60]`, tracked tree clean, staged: none
- Preserved untracked: both prior reports, untouched
- `.env.staging`: ignored, untouched; worker: stopped, untouched
- No application/test/Docker/environment file was modified during this audit.

## 3. Manual observations reviewed

Active Jobs 3 / Total Applications 0 / Total Views 8 / Shortlisted 0 / Draft 0 / Pending 0 / Closed 0 / New Applications 0 / Conversion Rate n/a / Total Jobs 3, with helper text as given. All traced against source below.

## 4. Active Dashboard data path

1. Component: `client/src/pages/Employer/EmployerDashboard.jsx`
2. API client: `employerApi.dashboard()` (`client/src/services/employerService.js`)
3. `GET /employer/dashboard`
4. Route file: `server/src/routes/employer.js`
5. Controller: `employerController.getDashboard` → `computeEmployerDashboardMetrics(employerId)` (`server/src/services/employerDashboardMetrics.js`)
6. Auth realm: Employer (`requireAuth` + `requireEmployerAuth`, confirmed same pattern audited in PF-J3-B)
7. Employer identity: `const employerId = req.employer.employerId;` — server-authenticated context only; the service function takes this id as its sole parameter and never reads anything from the request body/query
8. Response schema: flat object — `totalJobs, activeJobs, draftJobs, pendingApprovalJobs, closedJobs, totalApplications, totalInternalApplications, newApplications, shortlistedCandidates, interviews, hired, rejected, totalViews, internalViews, conversionRate, conversionRateLabel, recentActivity, jobs[]`
9. Client mapping: direct property reads with `??` fallbacks (`data?.activeJobs ?? 0`, etc.) — no renaming/transformation
10. Refetch/cache: **none** — a single `useEffect(() => { employerApi.dashboard()... }, [])` runs once on mount; there is no refetch on route re-entry, no polling, no invalidation after any mutation (Job submit/approve/reject, application status change, view)
11. Loading: skeleton cards; Error: falls back to an all-zero `data` object plus a visible `dashboardLoadFailed` message — **a load failure is visually indistinguishable from genuinely-zero data except for that one banner line**
12. No counters are calculated client-side; `conversionDisplay` only chooses between `conversionRateLabel` and a derived `${conversionRate}%` string, it does not compute the rate itself

## 5. Response contract

Confirmed by direct read of `computeEmployerDashboardMetrics`'s return statement (§4.8). Every field the client reads has a corresponding server field with the same name — no mapping mismatch found anywhere in this component.

## 6. Job status model

Relevant `Job` fields: `status` (`draft|active|closed`, legacy field — no `pending`/`rejected` value in this field's enum), `approvalStatus` (`pending|approved|rejected`), `applyType`/`applicationLink`/`applyEmail` (drive `resolveJobApplyType`), `employerId` (ownership). The separate "canonical" `publicationState` system (documented in earlier audits) is not touched by any dashboard query.

## 7. Application/tracker model boundaries

Confirmed unchanged from the prior opportunity-tracking audit and re-verified here directly against `employerDashboardMetrics.js`: the dashboard's application/shortlist/new-application/conversion numerator all query the **legacy `Application` model exclusively** (`import { Application } from '../models/Application.js'`), never `OpportunityApplication`. This means:
- An internal `applyToJob` call creates the `Application` document this dashboard counts.
- A "Track" action (personal tracker only, no dual-write target being this specific Application) never touches this model — confirmed no `Application`-model write exists anywhere in `OpportunityApplicationService.js`/`opportunityApplicationController.js`.
- `applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true })` makes duplicate Employer-facing applications from the same user to the same job structurally impossible at the DB level.
- The existing integration test (`employerPortalIntegration.test.js`, disposable-DB, skipped unless `EMPLOYER_INTEGRATION_TEST=1`) directly proves cross-employer non-leakage: it creates a second "Other Co" Employer and asserts the first Employer's application's job does not belong to it.

## 8. Active Jobs

Query: `Job.countDocuments({ employerId, status: 'active', approvalStatus: 'approved' })`. Matches its own helper text ("Active and admin-approved only") exactly. **Classification: A — correctly wired, observed value plausible.**

## 9. Total Applications

Query: `Application.countDocuments({ jobId: { $in: internalJobIds } })` where `internalJobIds` is pre-filtered to `resolveJobApplyType(j) === 'internal'`. Matches helper text ("Strideto applications on internal jobs only") exactly — external-apply jobs are correctly excluded, and the exclusion is disclosed to the Employer, not hidden. Zero is the expected value whenever no internal `Application` document exists yet for this Employer's jobs — this is fully consistent with the User-side testing having exercised the personal tracker rather than an internal apply to this specific Employer's job (per the manual-observations caution). **Classification: B — correctly wired, live data required.**

## 10. Total Views

Single source: the stored `Job.views` integer field, incremented exactly once per public detail-page load (`jobsController.getJobByIdOrSlug`, `$inc: { views: 1 }`), with **no session/bot/duplicate-view filtering and no Employer self-view exclusion** — every page load counts, including repeated reloads and the Employer's own preview visits. Views can only ever accrue on `status:'active'` jobs matched by `approvalStatus:'approved'` (or legacy documents with no `approvalStatus` field), because that is the only filter the public detail route serves. Dashboard `totalViews` (sum across all owned jobs) and `internalViews` (sum restricted to internal-apply jobs) and each Recent-Job-Post row's `views` all read this same single field — no double-counting between a field and a separate analytics-event collection, because no such second collection is used here. **Classification: A — correctly wired, observed value (8) plausible for 3 active jobs.**

## 11. Shortlisted

Source: `Application.status === 'shortlisted'`, aggregated via `$group` over the same internal-job-scoped Application set. This is the exact same enum value (`Application` schema: `['submitted','applied','viewed','shortlisted','rejected','interview','hired']`) that `employerController.updateApplicationStatus` writes when an Employer shortlists a candidate (`allowed = ['shortlisted','rejected','interview','hired']`) — no case mismatch, no alternate field. A User's private tracker stage change never touches this field (confirmed in §7); only genuine Employer action on a genuine internal `Application` can move this counter. **Classification: B — correctly wired, live data required.**

## 12. Draft Jobs

Query: `Job.countDocuments({ employerId, status: 'draft' })`. **Confirmed defect, not data-dependent:** every newly-submitted Job is created with `status:'draft', approvalStatus:'pending'` simultaneously (`employerController.createJob`), so a freshly-submitted Job counts under both "Draft Jobs" and "Pending Approval" at once until an Admin acts. Worse: `moderationController.bulkRejectJobs` sets only `approvalStatus:'rejected'` and **never updates `status`** — so a rejected Job's `status` remains `'draft'` permanently. A rejected Job is therefore counted as a "Draft Job" forever, with no separate "Rejected" bucket anywhere on the dashboard to distinguish it from a Job the Employer simply hasn't submitted for review. **Classification: D — backend aggregation semantic defect** (secondary: H — the "Draft Jobs" label doesn't disclose that it can include rejected jobs).

## 13. Pending Approval

Query: `Job.countDocuments({ employerId, approvalStatus: 'pending' })`. Correctly uses `approvalStatus`, not `status`. Rejected Jobs are correctly excluded here (rejection clears `approvalStatus` away from `'pending'`) — the defect in §12 is specific to the Draft bucket, not this one. **Classification: A — correctly wired.**

## 14. Closed Jobs

Query: `Job.countDocuments({ employerId, status: 'closed' })`, set only by the dedicated `closeJob` action (`employerController.js`), which the Employer must trigger explicitly — nothing in the source sets `status:'closed'` automatically on deadline expiry (no expiry-driven status transition was found in the files inspected for this audit; a full expiry-cron audit was out of this phase's scope). Rejected Jobs are never "closed" by this definition — they stay miscounted as Draft per §12. **Classification: A — correctly wired for its narrow, manual-close-only definition; C — narrow but intentional semantics regarding expiry (not investigated further, out of scope).**

## 15. New Applications

Query: same internal-job scope, `Application.countDocuments({ jobId: {$in}, appliedDate: { $gte: cutoff } })` where `cutoff = now - 7 days` computed via plain JS `Date.setDate`, i.e., a rolling 7×24-hour window (not a calendar-day boundary), evaluated in the server process's local/UTC time depending on host configuration — not investigated further as no timezone-sensitive discrepancy is evident from a single snapshot. Matches "Last 7 days" helper text. Strict subset of Total Applications by construction (same base query plus a date filter). **Classification: B — correctly wired, live data required.**

## 16. Conversion Rate

Formula: `computeConversionRate(totalInternalApplications, internalViews)` → `if (!internalViews || internalViews <= 0) return null; return Number(((apps/views)*100).toFixed(2));`. This is a real, executable unit test (`employerDashboardMetrics.test.js`, run directly, not merely source-asserted) proving: `(2,100)→2`, `(0,0)→null`, `(1,0)→null`, `(1,3)→33.33`. The `n/a` display specifically means **zero denominator** (`internalViews <= 0`), not zero numerator — a zero numerator with a positive denominator correctly yields `0`, not `null`/`n/a`, confirmed by the code path itself (only the denominator is checked). The observed `n/a` alongside `Total Views: 8` is fully consistent with this Employer's views having accrued entirely on external-apply jobs (excluded from `internalViews`) or on internal jobs that individually have zero views — either is plausible without live data. **Classification: B — correctly wired (formula proven by executable test), live data required for the specific observed n/a.**

## 17. Total Jobs

Query: `Job.countDocuments(employerFilter)` — no status/approval filter at all, includes every state (draft, pending, active, rejected, closed). The UI label is a bare "Total Jobs" with no qualifying sub-text — technically accurate but does not warn the reader that the four visible status buckets (Active/Draft/Pending/Closed) are not guaranteed to sum to this total, both because of the draft/pending overlap (§12) and because there is no dedicated "Rejected" bucket to make the arithmetic reconcile. In the observed snapshot (3 = 3 active + 0 + 0 + 0) the arithmetic happens to hold, which is expected precisely because there are currently no draft-pending-overlap or rejected jobs in this data. **Classification: A — correctly wired; H — label doesn't disclose the non-additive relationship to the visible buckets.**

## 18. Recent Job Posts

Same `jobRows` array as the summary counters (`Job.find(employerFilter).select(...).sort({updatedAt:-1}).lean()`), sliced to the first 10, so it uses **the same ownership scope and the same `views` field** as the summary card — no inconsistency. Per-row `applications`/`shortlisted` are computed inline with the identical `resolveJobApplyType`/`Application.countDocuments` pattern already proven consistent with the shared `enrichEmployerJobsWithApplicationCounts` helper used by the Employer Jobs list page (same logic, independently reimplemented — a minor duplication, not a correctness defect). "Applications: not tracked" renders specifically when `applyType !== 'internal'` — this is the intentional, disclosed external-job exclusion (§9), not missing data, not a client bug, not a null-response artifact. **Classification: A — correctly wired.**

## 19. Backend aggregation analysis

Summary: every aggregation is correctly employer-scoped, uses `Promise.all` for parallel independent queries (no N+1 across the summary cards), and the one genuine defect (§12) is a status-lifecycle gap in `bulkRejectJobs`, not in `employerDashboardMetrics.js` itself — the aggregation logic faithfully reflects whatever `status`/`approvalStatus` values actually exist on the Job documents; the bug is that rejection never sets a distinguishing status.

## 20. Client field mapping

No mismatch found. Every `data?.<field> ?? 0` in `EmployerDashboard.jsx` has a same-named counterpart in the server response. `conversionRateLabel` takes priority over a client-derived `${conversionRate}%` fallback, and both agree with each other by construction.

## 21. Cache and refetch behavior

**Confirmed stale-until-reload for the entire dashboard.** The single mount-only `useEffect` means: after an Admin approves/rejects a Job while the Employer has the dashboard open in another tab, after an Employer submits a new Job and navigates back, after a candidate is shortlisted, or after a Job accrues new views — none of these refresh the dashboard without a full page reload or remount. This is the same "stale between mutation and reload" characteristic already noted for other Employer pages in earlier phases, not a new architecture problem, but worth naming explicitly here since it directly affects how a tester should interpret "the counter still shows the old value." **Classification: F — stale cache/refetch defect (client-side only; no data corruption).**

## 22. Ownership and security

No Employer ID is ever accepted from query parameters, request body, or headers anywhere in `getDashboard`/`computeEmployerDashboardMetrics` — the sole identity source is `req.employer.employerId`, populated exclusively by the already-audited secure-auth middleware. Every Mongo query in the aggregation includes `employerId: eid` (or is scoped to a `jobIds` list already derived from an employer-owned `Job.find`). The disposable-DB integration test explicitly proves a second Employer's application is not attributable to the first. **No ownership or cross-Employer leakage found. P0: none.**

## 23. Source-wired versus data-dependent matrix

| Metric | Source-wired | Data-dependent (live value) |
|---|---|---|
| Active Jobs | Yes | No — plausible as shown |
| Total Applications | Yes | Yes — zero plausible, unconfirmed without live data |
| Total Views | Yes | No — plausible as shown |
| Shortlisted | Yes | Yes |
| Draft Jobs | Yes, but semantically defective (§12) | N/A — defect is structural, not data-dependent |
| Pending Approval | Yes | No — plausible as shown |
| Closed Jobs | Yes (narrow, manual-only definition) | No |
| New Applications | Yes | Yes |
| Conversion Rate | Yes (formula proven by executable test) | Yes |
| Total Jobs | Yes | No — plausible as shown |
| Recent Job Posts | Yes | Yes (rows), No (structure/labels) |

## 24. Metric classification matrix

| Metric | Primary classification | Secondary | Files/symbols |
|---|---|---|---|
| Active Jobs | A | — | `employerDashboardMetrics.js` |
| Total Applications | B | — | same, + `models/Application.js` |
| Total Views | A | — | same, + `jobsController.getJobByIdOrSlug` |
| Shortlisted | B | — | same |
| Draft Jobs | D | H | same, + `moderationController.bulkRejectJobs` |
| Pending Approval | A | — | same |
| Closed Jobs | A | C (expiry not investigated) | `employerController.closeJob` |
| New Applications | B | — | `employerDashboardMetrics.js` |
| Conversion Rate | B | — | same, proven by `employerDashboardMetrics.test.js` |
| Total Jobs | A | H | same |
| Recent Job Posts | A | — | same |
| Dashboard refetch | F | — | `EmployerDashboard.jsx` |
| Ownership/security | (none — clean) | — | `employerController.getDashboard` |

## 25. Test inventory

- `employerDashboardMetrics.test.js`: real, executable, no-DB unit test of `computeConversionRate` and `resolveJobApplyType` — genuinely proves the conversion formula and internal/external classification logic, not just source-text matched.
- `employerPortalIntegration.test.js`: real, disposable-DB integration test (skipped by default, requires `EMPLOYER_INTEGRATION_TEST=1`) proving `totalInternalApplications` counts correctly, duplicate-application rejection, `applicationsTracked`/`submittedApplicationsCount` correctness for external jobs, and cross-Employer non-attribution. This was read, not executed, per this audit's no-Mongo constraint.
- **Missing:** no test covers the Job-status bucket queries (`activeJobs`/`draftJobs`/`pendingApprovalJobs`/`closedJobs`) directly, so the §12 draft/rejected overlap defect was found by direct source reading, not caught by any existing test. No test covers `totalViews`/`internalViews` summation. No test proves the dashboard endpoint's response shape end-to-end (route → controller → service → JSON).

## 26. Priority findings

- **P0:** none.
- **P1:** none — no counter is materially wrong or disconnected; the one confirmed defect (§12) is a status-lifecycle gap that produces a misleading bucket, not a wrong or missing number in the sense of lost/corrupted data.
- **P2:** Draft Jobs permanently includes rejected Jobs with no separate visibility (§12); dashboard never refetches after any relevant mutation (§21); Total Jobs' non-additive relationship to the four visible buckets isn't disclosed (§17).
- **P3:** no test covers Job-status bucket aggregation or views summation directly; Recent Job Posts' per-row application/shortlist logic duplicates (rather than reuses) `enrichEmployerJobsWithApplicationCounts`.

## 27. Recommended implementation phases

**PF-EDM-B1 — Correct Job-status bucket aggregation**
- Goal: `bulkRejectJobs` sets a status that keeps rejected Jobs out of the "Draft Jobs" count (either introduce a dedicated rejected-status handling in the dashboard query, e.g. `status:'draft', approvalStatus:{$ne:'rejected'}`, or set a distinct `status` value on rejection) — smallest correct fix is adding the `approvalStatus` exclusion to the existing Draft Jobs query in `employerDashboardMetrics.js`, since it requires no change to the moderation controller or Job schema.
- Allowed files: `server/src/services/employerDashboardMetrics.js`, one focused test.
- Focused tests: a new unit/contract test proving a rejected Job (`status:'draft', approvalStatus:'rejected'`) is excluded from `draftJobs` count.
- Manual acceptance: reject a Job, confirm it disappears from "Draft Jobs" without appearing elsewhere unexpectedly.
- Commit message: `fix(employer): exclude rejected jobs from the draft jobs count`
- Stop conditions: do not touch `bulkApproveJobs`/`bulkRejectJobs` themselves unless the smallest fix proves insufficient — prefer a query-side fix over a status-lifecycle redesign.

**PF-EDM-B4 — Dashboard refetch after mutation**
- Goal: refresh dashboard data on route re-entry (at minimum) rather than only on first mount.
- Allowed files: `client/src/pages/Employer/EmployerDashboard.jsx`.
- Focused tests: static-source assertion that the effect dependency/trigger covers re-navigation.
- Manual acceptance: submit/approve/reject a Job in one tab, confirm the dashboard reflects it after navigating back to it (without a hard reload) in another.
- Commit message: `fix(employer): refresh dashboard metrics on route re-entry`
- Stop conditions: do not add polling or websocket infrastructure — simple re-fetch-on-mount-of-route is sufficient and matches the existing architecture's complexity level.

**PF-EDM-C — Combined live Employer Dashboard acceptance**
- Goal: with real data (an actual internal application submitted to this Employer's own job), confirm Total Applications/New Applications/Shortlisted/Conversion Rate move away from zero/n/a as expected, and confirm the PF-EDM-B1 fix live.
- Allowed files: none (acceptance only).
- Manual acceptance: full walk-through — submit an internal application to one of this Employer's internal jobs, shortlist it, confirm all affected counters update (after a reload, until PF-EDM-B4 lands).

Not recommended: a "PF-EDM-B2/B3" phase for application/shortlist/views aggregation specifically — no defect was found in that logic; the zeros observed are the expected, disclosed behavior of a correct query against currently-absent data, not a wiring problem.

## 28. Manual acceptance requirements

To move Total Applications/New Applications/Shortlisted/Conversion Rate off their current placeholder-looking zero/n/a values, an internal (not external, not merely "tracked") application must be submitted to a Job owned by the specific Employer account being tested, and the dashboard must be reloaded (until PF-EDM-B4) to see it.

## 29. Pre-push implications

None of the findings here are security defects. The Draft/Rejected overlap (§12) is a real but low-severity semantic gap — it does not lose data (the Job's actual `approvalStatus:'rejected'` is correct and readable elsewhere, e.g. in the Employer Jobs list page's status badge), it only mislabels the dashboard's summary bucket. The stale-refetch behavior (§21) is a known, pre-existing pattern class already present elsewhere in this codebase, not a new regression. Neither blocks push on its own.

## 30. Final recommendation

Proceed with **PF-EDM-B1** first (smallest, single-file, no live-data dependency, directly fixes a confirmed defect), then **PF-EDM-B4** (client-only refetch fix), then **PF-EDM-C** as a live acceptance pass once real internal-application data exists for the Employer account under test.
