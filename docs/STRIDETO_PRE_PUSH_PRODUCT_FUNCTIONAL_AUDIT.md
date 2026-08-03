# STRIDETO Pre-Push Product Functional Audit

## 1. Verdict

**READY FOR CONTROLLED PRODUCT FIXES**

Secure-authentication development is complete and separately signed off (`docs/STRIDETO_SEC_3G_FINAL_SIGN_OFF.md`). This audit covers five product-functionality areas the user flagged from manual localhost testing. None of the five areas is fully broken, and none requires a data migration or architectural rework, but each has at least one genuine user-facing gap: a defective click-through, an unwired notification path, an unbuilt pricing page, a placeholder view, or an ops step that was never run. The product is **not** ready to push as-is. It is ready to proceed through the bounded fix phases in §13 and re-reach a pre-push acceptance gate afterward.

## 2. Repository authority

- HEAD at audit start: `8dcc743ce0c687c75406c4f53658fc99d051b801`
- Branch: `main...origin/main [ahead 48]`
- Tracked tree: clean
- Staged: none
- Preserved untracked: `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- `.env.staging`: ignored, untouched

No file was edited, staged, or modified other than this report during the investigation. All findings below come from reading committed source, not from running the application or mutating any database.

## 3. Manual findings reviewed

The user reported five unresolved areas from manual localhost testing:

1. Employer dashboard and previously agreed pricing/pricing-guidance features.
2. Career Preferences shown in profile completion but clicking does nothing.
3. Application tracker functionality unverified.
4. Skill assessment functionality unverified; no assessments currently published.
5. Admin email/dashboard notification after an Employer posts a job unverified.

Each is addressed in turn below, based on direct reading of the relevant routes, controllers, services, models, and client components (not inferred from naming or documentation alone).

## 4. Employer dashboard / pricing

**Dashboard itself is real, not mocked.** Client routes under `/employer/dashboard` (`client/src/routes/index.jsx:156-178`) mount genuine pages — `EmployerDashboard.jsx`, `EmployerJobs.jsx`, `EmployerPostJob.jsx`, `EmployerApplications.jsx`, `EmployerAnalytics.jsx`, `EmployerSettings.jsx`, `EmployerIntelligence.jsx` — all under `client/src/pages/Employer/`, all calling live backend endpoints via `client/src/services/employerService.js` against `server/src/routes/employer.js`. No hardcoded/mock data or "coming soon" stubs were found in these pages.

**Pricing is a checkout mechanism, not a pricing page.** `GET /employer/plans` exists server-side (`employerController.js` `getPlans`) and is consumed only *inside* the job-posting flow (`EmployerPostJob.jsx` fetches plans as a "choose a plan" step before Stripe checkout via `paymentsController.js`/`paymentService.js`). There is no dedicated pricing/plans marketing or account page, and `EmployerLayout.jsx:13-21`'s sidebar menu (Dashboard, Intelligence, My Jobs, Post New Job, Applications, Analytics, Settings) has no pricing/billing/support entry at all — not a dead link, simply absent.

This exact gap was already identified in a prior audit: `docs/EMPLOYER_PUBLISHING_RULES_QUOTAS_MODERATION_BILLING_AND_SLUG_AUDIT.md` (line ~291) states there is "a backend catalog endpoint at `GET /employer/plans`, but no functional employer page/route/sidebar item," and names the intended fix "Plans & Usage" page (section E.1F-H4). That plan was never implemented.

- **Classification:** Dashboard core = **B (implemented, untested on the client side)**; Pricing/plans page = **E (backend only / not connected)**.
- **Pricing page:** Absent.
- **Pricing guidance:** Absent as a page; exists only as an in-flow plan-selection step during job posting.
- **Missing/disconnected:** `/employer/plans` client page, its route registration, and its sidebar nav entry.

## 5. Career Preferences

**Root cause is not a dead link — it is an empty destination.** The profile-completion checklist item (`shared/profile/profileCompletionWeights.js:80-84`, `key: 'careerPreferences'`) resolves to a real, mounted route (`/profile`, `client/src/pages/Profile/Profile.jsx`, registered at `client/src/routes/index.jsx:236-243`), and the checklist row uses a genuine `react-router-dom` `<Link>` (`ProfileCompletionCard.jsx:67-73`) — the navigation itself works. But `Profile.jsx` contains **no Career Preferences section at all** (verified: zero references to "career" anywhere in the file). The only place that actually reads and writes these fields is the one-time onboarding modal, `client/src/onboarding/ProfilingWizard.jsx`, via `OnboardingProvider.jsx` → `authApi.updateProfile()` → `server/src/controllers/profileController.js`, which does persist to `User.careerPreferences` server-side. So from the user's perspective, clicking the checklist item "does nothing" because it lands on a page with nothing relevant on it, even though the link and the underlying persistence both work.

- **Classification:** **G (defective)** — navigation succeeds, but the target page has no corresponding UI, so the user-visible behavior is indistinguishable from a broken control.
- **Data model:** `User.careerPreferences` (Mixed field, `server/src/models/User.js:84`); a separate, unrelated `CareerPreference` schema exists on the `TalentProfile` model (`server/src/models/career/CareerPreference.js`) and is not involved in this checklist item.
- **Route/page:** `/profile` (mounted, loads fine, but has no Career Preferences content).
- **Click behavior cause:** Missing UI section on the linked page; the wizard that owns this data has no reopening entry point outside first-run onboarding.
- **Required correction:** Either (a) point the checklist item at reopening `ProfilingWizard` (smallest fix — reuses existing working persistence), or (b) add a genuine Career Preferences section to `Profile.jsx` that edits the same fields via `authApi.updateProfile`.

## 6. Application tracker

The tracker (`OpportunityApplication` model, `server/src/routes/opportunityApplications.js`, `client/src/pages/Applications/*`) is substantially real and MongoDB-backed — not a placeholder shell.

**Working (DB-backed, ownership-scoped via `getOwnedApplication`/`findByIdForUser`, auth-gated):**
- Create manual application, track-from-listing for Jobs/Scholarships/Admissions, archive, stage transitions (dropdown-based, not drag-and-drop), search/sort/filter (all client-side, in-memory), List/Kanban/Table views, and all five stat metrics (active/interview/offer counts, response rate, completion rate — computed server-side by `ApplicationMetricsService`, not hardcoded).
- Reload/login persistence: real, fetches from backend on every mount.

**Gaps:**
- **Track from Internships: absent.** `InternshipDetail.jsx` has no track button/API call, unlike the Job/Scholarship/Admission detail pages.
- **Edit application: partial.** Backend `PATCH /applications/:id` is fully implemented, but no client form calls it — there is no edit UI.
- **Calendar view: UI placeholder only.** `MyApplications.jsx:207-211` renders a dashed box with placeholder text; selecting it does not show a calendar.
- **Tests: absent.** No client or server test exercises the tracker's CRUD, stage machine, or metrics directly.

- **Classification:** **B (implemented, untested)** for the working set; **D (UI placeholder)** for Calendar view; **F (missing)** for Internship tracking; **E (backend only / not connected)** for edit.
- **Working functions:** create, track (3 of 4 opportunity types), archive, stage transitions, search/sort/filter, list/kanban/table views, metrics, persistence, ownership.
- **Placeholder/broken functions:** Calendar view (placeholder), Internship tracking (missing), Edit (backend-only).
- **Persistence:** Real, MongoDB (`opportunityApplications` collection).
- **Tests:** None found for this feature specifically.

## 7. Skill assessments

**This is a missing ops/seed-data gap, not a missing-implementation gap.** The engine — categories, questions/choices, attempts, server-side scoring, credential issuance, and career-readiness score integration — is code-complete and internally consistent:

- 24 categories always appear because `AssessmentCategoryRepository.ensureDefaults()` upserts them on every `GET /assessments/categories` call — self-healing, no seeding required.
- Actual assessments (question sets) are only created by the separate `seedAssessments()` routine (`server/src/seed/assessments.js`), run explicitly via `npm run seed:assessments`. `docs/PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md` shows this pipeline previously producing 11 published assessments elsewhere — proving the mechanism works; it simply has not been run in the environment the user tested.
- Scoring is server-side only; `publicQuestions()` strips `correctIndex` before sending questions to the client, so answers are not exposed and scores cannot be tampered with client-side.
- Passing an assessment issues a `Credential` and triggers a career-readiness score recompute via an event subscription (`careerScoringBridge.js`).

**Genuine gaps found alongside the seed-data issue:**
- No Admin UI exists to create or publish assessments — the `POST /assessments` and `POST /assessments/:id/publish` endpoints exist server-side but are only reachable via direct API calls, not through the Admin panel.
- No unpublish endpoint exists anywhere.
- Retake limiting is attempt-count only (default 3); there is no cooldown/time-based retake rule.
- Result review after completion shows only pass/fail, not a per-question breakdown, despite the data existing server-side.

- **Classification:** Core engine = **B (implemented, untested in this pass — test coverage for the assessment engine itself was not independently confirmed and should be checked before closing PF-C)**; publishing = **E (backend only / not connected, no Admin UI)**; unpublish = **F (missing)**; retake cooldown = **F (missing)**; result review = **C (partially implemented)**.
- **Admin create:** Backend yes, UI no.
- **Publish:** Backend yes, UI no; unpublish endpoint does not exist.
- **User attempts:** Working.
- **Scoring:** Working, server-side only.
- **Skill/readiness integration:** Working (credential issuance + readiness score recompute on pass).
- **Reason no assessments appear:** The seed/publish ops step (`npm run seed:assessments`) has not been run in this environment — not a code defect.

## 8. Job-post Admin notification / email

Traced `createJob` (`server/src/controllers/employerController.js`, `POST /employer/jobs`) line by line. Its only side effects are: validate input, compute a unique slug, `Job.create(...)` with `status: 'draft'` and `approvalStatus: 'pending'`, and conditionally increment `employer.totalJobsPosted`. **There is no call to `notifyStaff`, no email call, and no audit-log write anywhere in this function or anything it calls.**

Independently confirmed: `notifyStaff()` (`server/src/services/notificationService.js`) — the actual mechanism that fans a `UserNotification` out to every `STAFF_ROLES` user — is called from exactly five places in the codebase (`contactController.js`, `feedbackController.js`, `supportController.js`, `formNotificationService.js`, `automationService.js`'s webinar-published hook). None of these five is on the job-creation path. The Admin-facing bell (`NotificationBell.jsx`) is mounted in the public site Navbar, not in any Admin layout, and the Admin sidebar's bell icon is only a static nav link to the manual broadcast-composer page — it has no unread-count wiring to job submissions.

Email: `emailService.js` has templates for `jobApproved` and `employerVerification` only. There is no "job submitted/pending review" template, and no call site sends one.

Notably, the **reverse** direction already works: when an admin approves a job (`moderationController.js` → `automationService.js`'s `onJobApproved`), the *employer* is notified and emailed. Nothing comparable exists for the *submission* event notifying admins.

- **Classification:** **F (missing)** for both admin dashboard notification and admin email on job submission.
- **Admin dashboard notification:** Not wired.
- **Admin email:** Not wired.
- **Moderation queue:** Exists (`approvalStatus: 'pending'` gates visibility until admin action), but entering it triggers nothing.
- **Existing trigger:** None on submission. The adjacent `onJobApproved` trigger (submission → approval, not submission → admin alert) is the closest working analog and the pattern to reuse.
- **Missing wiring:** A `notifyStaff(...)` call plus a new `jobSubmitted`-style email template, invoked from inside `createJob` after the `Job.create` write succeeds (mirroring the existing fail-open, fire-and-forget pattern used by `onJobApproved`).

## 9. Classification matrix

| # | Feature | Classification | Exact file(s) | Evidence | User impact | Required correction | Required tests | Risk |
|---|---|---|---|---|---|---|---|---|
| 1 | Employer dashboard core (jobs/applications/analytics/settings) | B | `client/src/pages/Employer/*.jsx` | Real API calls via `employerService.js`, no mocks found | Works today, but no regression safety net | Add client test coverage | `client/src/__tests__/employer*.test.jsx` | Low |
| 2 | Employer pricing/plans page | E | `EmployerLayout.jsx:13-21`, `routes/index.jsx`, `employerController.js getPlans` | No page/route/nav entry exists; API only used inside job-post checkout | User cannot view plans/pricing outside the post-job flow | Build `/employer/plans` page + nav entry (already scoped in `docs/EMPLOYER_PUBLISHING_RULES_QUOTAS_MODERATION_BILLING_AND_SLUG_AUDIT.md`) | New page + API tests | Medium |
| 3 | Career Preferences checklist item | G | `shared/profile/profileCompletionWeights.js:80-84`, `client/src/pages/Profile/Profile.jsx` | Link navigates correctly; target page has zero career-preferences content | Reads as "clicking does nothing" | Reopen `ProfilingWizard` from the checklist, or add a section to `Profile.jsx` | New test asserting checklist item opens working UI | Low |
| 4 | Application tracker core (create/track/archive/stage/search/sort/filter/views/metrics) | B | `client/src/pages/Applications/*`, `server/src/services/career/*` | DB-backed, ownership-scoped, real metrics | Functional but unverified by tests | Add test coverage | `server/src/__tests__/opportunityApplication*.test.js`, `client/src/__tests__/applications*.test.jsx` | Low |
| 5 | Application tracker — Internship tracking | F | `client/src/pages/Internships/InternshipDetail.jsx` | No track button/API call found | Users cannot track internships from listings | Add track button mirroring `JobDetail.jsx` | New test | Low |
| 6 | Application tracker — Edit | E | `server/src/controllers/opportunityApplicationController.js` (PATCH exists), `ApplicationDetail.jsx` (no form) | Backend endpoint unused by any client component | Users cannot correct a logged application | Add edit form calling `applicationsApi.update` | New test | Low |
| 7 | Application tracker — Calendar view | D | `client/src/pages/Applications/MyApplications.jsx:207-211` | Renders placeholder text only | Selecting Calendar view shows nothing useful | Implement or explicitly remove the control | New test | Medium |
| 8 | Skill assessment engine (attempts/scoring/credentials/readiness) | B | `server/src/services/career/AssessmentService.js` | Code-complete, proven working via `PRODUCTION_CONTENT_COVERAGE_SNAPSHOT.md` elsewhere | Works once assessments are published | Run `npm run seed:assessments` in this environment | Confirm/add engine tests | Low |
| 9 | Skill assessment — Admin authoring UI | E | `client/src/pages/Admin/` (absent), `assessmentsApi.js` | No create/publish UI; API-only | Admins cannot manage assessments without direct API calls | Build Admin assessment management page | New tests | Medium |
| 10 | Skill assessment — Unpublish | F | `server/src/routes/assessments.js` | No unpublish route/handler exists | Cannot retract a published assessment | Add unpublish endpoint + UI control | New test | Low |
| 11 | Skill assessment — Result review | C | `client/src/pages/Assessments/AssessmentTake.jsx:90-108` | Shows score/pass-fail only; no per-question breakdown | Users can't learn from mistakes | Surface graded/explanation data already computed server-side | New test | Low |
| 12 | Job-post → Admin dashboard notification | F | `server/src/controllers/employerController.js` (createJob, no `notifyStaff` call) | Confirmed by direct read + grep for all `notifyStaff` call sites | Admins unaware of new submissions except by manually checking the queue | Call `notifyStaff(...)` after `Job.create` succeeds | New integration test | Medium |
| 13 | Job-post → Admin email | F | `server/src/services/emailService.js` (no job-submitted template) | No template, no call site | Same as above, via email channel | Add `jobSubmitted` template + send call | New integration test | Medium |

## 10. User-facing defects

- Career Preferences checklist item leads to a page with no corresponding content (§5, item 3 above) — the clearest "defect" in the strict sense, since the control appears functional but produces no visible effect.
- Application tracker Calendar view renders but shows nothing (§6, item 7).
- Employer sidebar has no pricing/billing entry, so employers cannot find pricing without going through the post-a-job flow first.

## 11. Backend/frontend gaps

- Backend-ahead-of-frontend: Employer plans catalog API, application edit endpoint, assessment create/publish endpoints — all have working backend support with no corresponding client UI (classification **E** throughout).
- Frontend-only placeholder: Application tracker Calendar view (classification **D**).
- Fully absent both sides: Job-post → Admin notification/email, assessment unpublish, application tracker Internship-track button, retake cooldown (classification **F**).

## 12. Test coverage gaps

- No client tests exist for any Employer page.
- No test exists for the application tracker's CRUD, stage machine, or metrics (client or server).
- No test independently confirms assessment-engine behavior in this audit pass (engine tests were not explicitly enumerated; recommend a follow-up check before closing PF-C).
- No test exists for job-creation → notification/email, because the wiring itself does not exist yet.

## 13. Recommended implementation phases

**PF-A — Career Preferences route/section and profile-completion fix**
- Allowed files: `shared/profile/profileCompletionWeights.js`, `client/src/components/profile/ProfileCompletionCard.jsx`, `client/src/onboarding/ProfilingWizard.jsx` (reopen support), or `client/src/pages/Profile/Profile.jsx` (new section) — pick one approach, not both.
- Goal: clicking the checklist item leads to a working UI that edits the same fields the completion calculation reads, using the existing `authApi.updateProfile` persistence path.
- Tests: new assertion that the checklist link opens functional UI and that saved values move the completion percentage.
- Manual acceptance: click item from a logged-in profile with incomplete career preferences; confirm a real form/modal opens, save updates completion %.
- Commit message: `fix(profile): wire Career Preferences checklist item to working UI`
- Stop conditions: any change required to `User.careerPreferences` shape or to unrelated `TalentProfile.CareerPreference`.

**PF-B — Application tracker completion and acceptance**
- Allowed files: `client/src/pages/Internships/InternshipDetail.jsx`, `client/src/pages/Applications/ApplicationDetail.jsx`, `client/src/pages/Applications/MyApplications.jsx`, new test files under `client/src/__tests__/` and `server/src/__tests__/`.
- Goal: add Internship tracking, add an edit form wired to the existing PATCH endpoint, resolve the Calendar view (implement or explicitly descope with honest UI copy).
- Tests: tracker CRUD, stage transitions, ownership scoping.
- Manual acceptance: track an internship, edit a logged application, confirm Calendar view no longer renders a dead placeholder.
- Commit message: `feat(applications): close tracker gaps (internship tracking, edit, calendar)`
- Stop conditions: any required change to `OpportunityApplication` schema or stage-machine rules.

**PF-C — Skill assessment publishing and end-to-end flow**
- Allowed files: none required for the minimum fix (`npm run seed:assessments` is an ops action, not a code change). For the fuller fix: new `client/src/pages/Admin/AssessmentManagement.jsx`, `client/src/services/assessmentsApi.js`, `server/src/routes/assessments.js` (add unpublish), `server/src/services/career/AssessmentService.js` (unpublish + retake cooldown), assessment review UI.
- Goal: assessments visible to users (ops step) and, if scoped in, an Admin authoring/publishing UI plus retake cooldown and result review.
- Tests: confirm engine test coverage exists or add it; new tests for unpublish and review.
- Manual acceptance: after running the seed script, assessments appear and are completable end-to-end with correct scoring.
- Commit message: `feat(assessments): publish MVP assessments and close admin authoring gaps`
- Stop conditions: any change to scoring logic or credential-issuance thresholds.

**PF-D — Employer dashboard, pricing guidance and navigation**
- Allowed files: new `client/src/pages/Employer/EmployerPlans.jsx`, `client/src/routes/index.jsx`, `client/src/pages/Employer/EmployerLayout.jsx`, `client/src/services/employerService.js`, `server/src/controllers/employerController.js` (extend `getPlans` per `docs/EMPLOYER_PUBLISHING_RULES_QUOTAS_MODERATION_BILLING_AND_SLUG_AUDIT.md`), i18n locale files, new tests.
- Goal: build the "Plans & Usage" page already scoped in the prior employer audit and link it from the sidebar.
- Tests: new page tests, API tests.
- Manual acceptance: employer can view plans/usage from the dashboard nav without going through job posting.
- Commit message: `feat(employer): add Plans & Usage page and nav entry`
- Stop conditions: any requirement to integrate a new payment provider or change Stripe checkout behavior.

**PF-E — Employer job-post Admin notification/email integration**
- Allowed files: `server/src/controllers/employerController.js` (createJob), `server/src/services/notificationService.js`, `server/src/services/emailService.js` (new template), `server/src/services/automationService.js` (optional `onJobSubmitted` hook mirroring `onJobApproved`), new tests.
- Goal: after `Job.create` succeeds, fire `notifyStaff(...)` and a `jobSubmitted` email using the same fail-open, fire-and-forget pattern already used for job approval.
- Tests: new integration test asserting a job submission produces a `UserNotification` for staff and (mocked) email send, without blocking the API response on either.
- Manual acceptance: post a job as an employer locally with Mailpit running; confirm an admin notification appears and a Mailpit email is captured.
- Commit message: `feat(notifications): notify admins on employer job submission`
- Stop conditions: any requirement to change job moderation/approval state semantics.

**PF-F — Full product regression and pre-push acceptance**
- Allowed files: none (verification only).
- Goal: run full server/client test suites, lint, build; manually re-walk all five areas above; confirm no regression in secure-auth behavior.
- Tests: complete existing suite plus everything added in PF-A through PF-E.
- Manual acceptance: all five originally reported areas function end-to-end.
- Commit message: n/a (verification phase, not a code change).
- Stop conditions: any regression in authentication, authorization, or realm isolation.

## 14. Exact file boundaries

See the "Allowed files" line under each phase in §13. No phase may touch files outside its own listed boundary; cross-phase changes (e.g., a PF-B fix touching assessment code) should stop and be re-scoped.

## 15. Pre-push acceptance criteria

Pre-push acceptance requires, at minimum:
1. PF-A through PF-E functionally complete and manually verified.
2. New tests added in each phase passing.
3. Full existing server and client suites still passing (no regression).
4. This report's five originally reported areas re-walked manually and confirmed working.
5. No change to secure-auth runtime behavior (per `docs/STRIDETO_SEC_3G_FINAL_SIGN_OFF.md`) introduced incidentally during product fixes.

## 16. Production implications

None of the gaps found here are security defects — they are product-completeness gaps (missing pages, missing UI wiring, missing ops step, one placeholder view). None require a database migration or schema change. Production activation remains separately blocked on secure-auth infrastructure grounds (production Redis, per the SEC-3G sign-off) regardless of this audit's outcome; this audit does not change that blocker, and closing PF-A–PF-F does not by itself authorize production activation.

## 17. Final recommendation

Proceed with **PF-A** first (smallest, most user-visible fix, no schema risk), then **PF-B**, **PF-C** (ops-only minimum viable step), **PF-D**, **PF-E**, in that order, finishing with **PF-F** as a full regression gate before any push is reconsidered. Do not push before PF-F passes.
