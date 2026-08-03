# STRIDETO Job, Employer, Admin and User Notification Connection Audit

## 1. Verdict

**ONLY LIVE ACCEPTANCE REMAINS** for the Admin submission notification/email path specifically (source-wiring is complete and correct, per direct diff re-verification). **READY FOR TARGETED NOTIFICATION IMPLEMENTATION** for everything else audited: Employer pending-review acknowledgement (missing), Employer rejection notification (missing), Employer approval/rejection UI consumer (missing), and the internal-apply notification's incorrect link target (defective) all require real, scoped implementation work, not just a live-testing pass.

## 2. Repository authority

- HEAD: `ccb6e2a438a60ac5a24cc6037f2e01d3404611ff`, parent `5efc47c9061f0db8ec6ad9e5c02ef4c440583a05`
- Branch: `main...origin/main [ahead 55]`, tracked tree clean, staged: none
- Preserved untracked: `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- `.env.staging`: ignored, untouched
- **Deviation observed, not corrected during the audit itself:** the worker container (`edurozgaar-staging-worker-1`) was found running (`Up 24 minutes (unhealthy)`) rather than stopped, with logs showing a shutdown at 19:38 and a restart at 19:40 — consistent with the user restarting it for their own manual testing per the prior report's suggestion. Per this audit's read-only constraints (no MongoDB/Redis/SMTP connection), I did not query the database to check whether that produced fresh queue evidence; that determination is out of scope for a source-level audit. The container's healthcheck failures (`ExitCode 1`, no output, `FailingStreak: 49`) are a pre-existing characteristic of running a `WORKER_ONLY` process against a healthcheck presumably designed for the HTTP-serving image, unrelated to the PF-J-R1 change — not investigated further here per scope. The worker was returned to `stopped` at the end of this audit (see §23) to match the required post-state; no other Docker action was taken.

## 3. Manual observations reviewed

All eight observations in the task brief were checked against source. Findings below confirm 1–2, 6 (partially), and 7 exactly as observed; 3, 4, 5, and 8 are explained with root cause rather than merely restated.

## 4. Employer Job-submission lifecycle

Re-verified directly from `git show 5efc47c9061f0db8ec6ad9e5c02ef4c440583a05 -- server/src/controllers/employerController.js`: `createJob` validates input, computes a unique slug, calls `Job.create({ status: 'draft', approvalStatus: 'pending', ... })`, conditionally increments `totalJobsPosted`, then calls `onJobSubmitted({ jobId: job._id, jobTitle: job.title, companyName }).catch(() => {})` (fire-and-forget, after persistence, not awaited), then responds `res.status(201).json({ job, isFirstJobFree: isFirstJob })`.

- Durable creation: confirmed before any notification call (source order, `Job.create` precedes `onJobSubmitted`).
- Pending moderation: confirmed (`approvalStatus: 'pending'`).
- Employer success response: unchanged from pre-PF-J — the returned `job` object includes `approvalStatus`/`status`, no Admin/notification/email data.
- Employer pending-status display: **confirmed working**, independently of any queue/email. `client/src/pages/Employer/EmployerJobs.jsx:181-183` renders a badge (`t('employer:approval_pending', ...)`) whenever `j.approvalStatus !== 'approved'`. This is plain data rendering from the job list API, not dependent on notifications/worker — it works today regardless of the email/notification findings below.

## 5. Admin platform notification

`onJobSubmitted` → `notifyStaff({ category: 'job', type: 'job.submitted', title, body, link: '/admin/moderation', metadata: { jobId } })`.

1. Wired after durable Job creation: yes (§4).
2. Staff roles receiving it: all of `STAFF_ROLES` (`server/src/config/rbac.js`): Editor, Moderator, Admin, SuperAdmin.
3. Admin and SuperAdmin receive it: yes, both included in `STAFF_ROLES`.
4. Editor/Moderator also receive it: yes — `notifyStaff` does not distinguish among staff roles; all four get an identical `UserNotification`.
5. Type/category: `type: 'job.submitted'`, `category: 'job'`.
6. Entity metadata: `metadata: { jobId }` — confirmed present.
7. Internal action link: `/admin/moderation` — confirmed as the real mounted route (`ROUTES.ADMIN` + `moderation` child in `client/src/routes/index.jsx`, rendering `ModerationQueue.jsx`, the actual bulk-approve/reject page).
8. PF-N consumption: yes — Admin/staff users share the exact same `NotificationBell.jsx`/`NotificationsPage.jsx` components already fixed in PF-N to navigate via `n.link`; no separate Admin notification UI exists or is needed.
9. Unread count: yes — `getUnreadCount` (`notificationService.js`) has an explicit `recipientType === 'staff'` branch using the `userId` filter, matching how `notifyStaff` writes each recipient's row.
10. Duplicate protection: **none** on the notification itself. `notifyStaff` has no dedup parameter or logic; this was a deliberate, documented PF-J design choice matching the existing `onWebinarPublished` precedent (also undeduplicated). Manual evidence already confirms no duplicate occurred for a single normal submission — this says nothing about repeated/retried submissions, which were not tested.
11. Failure impact on Job creation: none — fire-and-forget, `.catch(() => {})`, after persistence.
12. Tests: `server/src/__tests__/jobSubmissionAdminNotification.test.js` — 19 static source-text assertions (no live Mongo/notification execution); this is the acknowledged limitation from PF-J (no mocking framework or test-Mongo harness exists in this repo for `automationService.js`).

**Classification: FULLY WIRED BUT LIVE DELIVERY UNVERIFIED beyond the one manual PASS already reported** (staff notification, unread count, and moderation-page click were manually confirmed PASS per the user's own PF-N/PF-J acceptance report; this audit only re-confirms the source matches that report, it does not re-run the manual test).

## 6. Admin review email

`onJobSubmitted` resolves `adminEmail = process.env.CONTACT_ADMIN_EMAIL || process.env.MAIL_FROM || process.env.MAIL_USER` and, if present, calls `queueEmail({ to: adminEmail, templateKey: 'jobSubmitted', vars: { jobTitle, companyName }, dedupKey: 'email:job:submitted:${jobId}' })`.

1. Enqueued: yes, when an admin email resolves from the fallback chain.
2. Recipient-resolution fallback chain: `CONTACT_ADMIN_EMAIL → MAIL_FROM → MAIL_USER` — reuses the exact convention already established by `sendContactAdminAlertEmail`, no new env var invented.
3. Template: `jobSubmitted` (`server/src/templates/emailTemplates.js`), en/ur variants.
4. Subject: `${BRAND} – Job pending review: ${jobTitle}` — clearly indicates pending review.
5. Moderation CTA route: `${SITE_URL}/admin/moderation` via the existing `btn()` helper — matches the real Admin moderation route.
6. Sensitive Employer data excluded: confirmed — only `jobTitle`/`companyName` are interpolated; no Employer email/credentials.
7. Queue deduplication: `dedupKey` is passed to `queueEmail` → `enqueueJob`, which checks for an existing `BackgroundJob` with the same `dedupKey` in `pending`/`processing`/`completed` status before creating a new one (native to `enqueueJob`, unchanged by PF-J or PF-J-R1).
8. Worker SMTP configuration after PF-J-R1: `docker-compose.sec3f-local.yml`'s `worker:` override now sets `MAIL_HOST: mailpit`, `MAIL_PORT: "1025"`, `MAIL_SECURE: "false"`, plus `MAIL_USER`/`MAIL_PASS`/`MAIL_FROM` — confirmed by direct diff re-read, byte-identical values to `api-a`/`api-b`'s existing block.
9. `{ sent: false }` now causes failure/retry: **confirmed by direct diff re-read** — `processEmailJob` (`jobQueueService.js`) now throws `EMAIL_NOT_DELIVERED` (`email_transport_not_configured` or `email_not_sent`) when `!result?.sent`, which `processQueue`'s existing `catch` block routes into the pre-existing retry/backoff/dead-letter logic (unchanged).
10. `{ sent: true }` required before completion: confirmed — the only path to `job.status = 'completed'` is the success branch after `executeJob` resolves without throwing, and `processEmailJob` now only resolves (doesn't throw) when `result.sent` is true.
11. Retry/dead-letter behavior: unchanged — attempts increment, backoff scheduling (`job.attempts * 60 * 1000` ms), `dead` status plus a `retry_email` requeue at `maxAttempts`, all present in the current source exactly as before PF-J-R1 (only the *trigger* for entering this path changed, not the path itself).
12. The 66 pre-existing `completed` email jobs: confirmed still present as historical false-completions (read-only count performed during PF-J-R1: 66 `completed`, 0 `pending`, 0 `dead` at that time) — not reset or replayed by this or any subsequent phase, per instruction.
13. **Fresh live SMTP delivery has not actually been proven.** The PF-J-R1 verification confirmed the worker's *configuration* (env values correct, Mongo connected, queue drained) but explicitly could not perform a fresh UI-driven submission (no browser/credentials in that session). The user's subsequent manual-acceptance messages report the Admin email as "PENDING — not visible in Mailpit" from *before* PF-J-R1, and no post-fix Mailpit confirmation has been reported since.
14. Tests: `workerEmailDeliveryCompletion.test.js` — 17 assertions, a mix of (a) one real, unmocked execution of the exported `sendEmail()`/`isSmtpConfigured()` functions (safe, no network I/O occurs because `getTransporter()` short-circuits when `MAIL_HOST` is unset) and (b) static source-text assertions proving the `processEmailJob` fix, the untouched retry/dedup logic, and the Compose values. **No real SMTP test exists or has been run.**

**Separate statuses, as required:**
- Enqueue wiring: FULLY WIRED (confirmed by diff).
- Worker processing correctness: FULLY WIRED (confirmed by diff + one real, unmocked function execution proving the pre-fix placeholder contract and the post-fix throw condition).
- SMTP configuration: FULLY WIRED (confirmed live during PF-J-R1 — real env values read from the running container).
- Live delivery evidence: **NONE — genuinely unverified.** No fresh Mailpit-visible email has been confirmed by anyone since the fix landed.

**Classification: FULLY WIRED BUT LIVE DELIVERY UNVERIFIED.** This is explicitly not the same as PASS.

## 7. Employer pending-review acknowledgement

Traced the complete `createJob` function (§4) — it calls exactly one automation hook, `onJobSubmitted`, which only ever targets staff (`notifyStaff`) and a configured admin email address. **No Employer-facing call of any kind exists in `createJob`.**

1. In-platform "Job submitted"/"Pending review" notification: **MISSING** — no `notifyUser`/`queueNotification` call targets the Employer anywhere in the submission path.
2. Email acknowledgement: **MISSING** — same reasoning.
3. Employer Jobs-page status: **IMPLEMENTED** (§4) — shows a "pending" badge, but this is a passive list-view read, not an active acknowledgement of the specific submission event.
4. Job-submission success response: unchanged, contains `job` + `isFirstJobFree` only — no acknowledgement content beyond the raw persisted object.
5. Link to `/employer/jobs`: not applicable — there is no notification to link from.
6. Duplicate protection: not applicable — nothing is created to duplicate.
7. Active Employer notification UI consumer: **none found** — confirmed again by targeted search; no component under `client/src/pages/Employer` or `client/src/components` renders a `queueNotification`-sourced feed.
8. Employer notification API endpoint/client: `queueNotification({ recipientType: 'employer', ... })` → `processNotificationJob` → `notifyEmployer` → `UserNotification` with `recipientType: 'employer'`; `getUnreadCount`/list endpoints do support `recipientType === 'employer'` server-side. The *data path* exists generically (used by `onJobApproved`); it is simply never invoked for submission, and nothing on the client renders it regardless.
9. Employer bell/inbox/notifications page: none exists.

**Classification: MISSING** (in-platform notification and email both), with the Jobs-page status badge as the one genuinely working, independent exception.

## 8. Employer approval flow

`onJobApproved({ jobId, employerId, jobTitle })`: `queueNotification({ dedupKey: 'job:approved:${jobId}', recipientType: 'employer', employerId, category: 'job', type: 'job.approved', title, body, link: '/employer/jobs', metadata: { jobId } })`, then if the Employer has an email, `queueEmail({ to: employer.email, templateKey: 'jobApproved', vars: { jobTitle }, dedupKey: 'email:job:approved:${jobId}' })`.

- Employer notification record creation: yes, via `queueNotification` (job-queue-backed, processed by `processNotificationJob` → `notifyEmployer` → `UserNotification`).
- Employer email enqueueing: yes, `queueEmail` with a stable dedupKey.
- Template: `jobApproved` (existing, pre-PF-J).
- CTA: `/employer/jobs` — a real, mounted Employer route.
- Recipient: `employer.email` (looked up fresh from `Employer.findById`).
- Deduplication: both channels have native `dedupKey`-based protection via `enqueueJob`.
- Active Employer UI consumer: **none** — same finding as §7; the notification record is created server-side, but nothing in the client renders an Employer-facing notification feed. The Employer would only ever see this via email, or indirectly via the Jobs-page status badge changing to "approved" (which is not itself the notification, just the resulting state).
- Live evidence status: **unverified** — same worker/SMTP dependency as §6; no fresh post-PF-J-R1 confirmation exists.

**Classification: BACKEND WIRED, CLIENT UI MISSING** for the in-platform channel; **FULLY WIRED BUT LIVE DELIVERY UNVERIFIED** for the email channel.

## 9. Employer rejection flow

Traced `bulkRejectJobs` (`server/src/controllers/admin/moderationController.js`) directly, re-confirmed line-by-line: sets `approvalStatus: 'rejected'` via `Job.updateMany`, writes an audit log entry (`logAudit`), and returns `{ rejected: result.modifiedCount }`. **No notification, email, or automation hook of any kind is called.** There is no `onJobRejected` function anywhere in `automationService.js`.

- Employer notification record creation: **MISSING**.
- Employer email: **MISSING**.
- Reason inclusion: not applicable — no rejection reason field is even collected in the request body (`bulkRejectJobs` takes only `ids`).
- CTA: not applicable.
- Deduplication: not applicable.
- Active UI consumer: not applicable (nothing to consume).

**Classification: MISSING.** This is a genuine, complete gap — not partially wired, not deferred, simply never implemented in any commit to date.

## 10. User application notifications

`applyToJob` (`server/src/controllers/applicationsController.js`) calls `onJobApplication({ applicationId, userId, jobId, userName, userEmail }).catch(() => {})` after `Application.create` and the dual-write. `onJobApplication` calls `queueNotification({ dedupKey: 'application:student:${applicationId}', recipientType: 'user', userId, category: 'application', type: 'application.submitted', title: 'Application submitted: ${job.title}', body, link: '/dashboard', metadata: { applicationId, jobId } })`.

- Event type: `application.submitted`.
- Active caller: `applicationsController.applyToJob`.
- Recipient: the applying User.
- Persistence: `UserNotification` (via `processNotificationJob` → `notifyUser`).
- Action link: **`/dashboard`, not `/applications/:id`.** This does not match the navigation contract PF-N established and does not point at the specific application (the tracker record created by the same request's dual-write, whose id is returned to the client as `opportunityApplicationId`/`trackerUrl` but never passed into this notification's `link`).
- PF-N navigation: technically works (the bell/page will navigate to `/dashboard`, a valid route) but lands on the wrong page — a generic dashboard, not the specific application.
- Marks read: standard `UserNotification` read/markRead behavior, unaffected.
- Email also expected: no separate email exists for this event; only the in-platform notification.
- Tests: none found specific to `onJobApplication`'s notification content.
- Manual evidence: not directly tested in the user's PF-N/PF-J acceptance passes (those covered job-submission/moderation, not the User-side apply flow).

**Classification: DEFECTIVE** — a real notification is created and does navigate somewhere, but not to the correct, specific destination. This is a distinct, narrower defect than the general navigation bug PF-N fixed (that one was "clicking does nothing"; this one is "clicking goes to the wrong specific page").

## 11. Personal tracker notifications

Traced `OpportunityApplicationService.create` (both the User's own "Track" action and manual creation): emits `ApplicationCreated` via `emitApplicationEvent`/`emitCareerEvent`. Checked `careerNotificationBridge.js`'s `NOTIFY_EVENTS` list directly: `['StageChanged', 'OfferAccepted', 'ApplicationWithdrawn', 'InterviewScheduled', 'ReminderCreated', 'CandidateShortlisted', 'InterviewCompleted', 'OfferSent', 'OfferRejected', 'CandidateRejected', 'CandidateHired']` — **`ApplicationCreated` is not in this list.** No other direct `notifyUser`/`queueNotification` call exists in `OpportunityApplicationService.js` or `opportunityApplicationController.js`.

**Tracking an opportunity (via the "Track" button on any of Job/Scholarship/Admission/Internship, or via manual creation) produces no in-platform notification at all.** This directly contradicts observation #6 in the task brief ("User receives in-platform notifications when: ... adding an opportunity to the personal tracker"). Either the manual observation was made against the *applying* flow (§10, which does notify, just to the wrong link) and mentally attributed to "tracking," or a notification the user saw was actually the `application.submitted` one from an internal apply action that also dual-writes a tracker record — these two are easy to conflate since one API call produces both a legacy `Application` and an `OpportunityApplication` simultaneously (§10 of the prior opportunity-tracking audit already established this dual-write relationship). Tracking alone (Track button, no apply), with no dual-write, produces nothing.

**Classification: MISSING** for pure tracking; the notification the user likely observed belongs to the internal-apply path (§10), which is a separate operation.

## 12. Stage/interview/reminder notifications

All of `StageChanged`, `InterviewScheduled`, `ReminderCreated`, `CandidateShortlisted`, `InterviewCompleted`, `OfferSent`, `OfferRejected`, `CandidateRejected`, `CandidateHired`, `OfferAccepted`, `ApplicationWithdrawn` are wired through `careerNotificationBridge.js` → `notifyUser` with `link: applicationId ? '/applications/${applicationId}' : '/applications'` — this **does** match the PF-N navigation contract exactly (unlike §10's `application.submitted`).

- Employer stage changes reach the User: yes, one-directionally, via `syncOpportunityApplicationFromLegacyStatus` (writes `pipelineStage` + a `stageHistory` entry tagged `byActorType: 'employer'`) which itself triggers a `StageChanged`-equivalent event through the same `emitApplicationEvent` path used by the User's own `transitionStage` — both surface as the same notification type to the User, distinguishable only by reading `stageHistory[].byActorType`, not by notification content (this matches the prior opportunity-tracking audit's finding, unchanged).
- User's own stage changes and Employer's stage changes both notify the User identically; there is no notification distinguishing "you moved this" from "the employer moved this."
- Tests: none found specific to `careerNotificationBridge.js`'s event-to-notification mapping.
- Manual evidence: not part of any acceptance report reviewed so far.

**Classification: FULLY WIRED, source-correct link contract, live delivery unverified** (no manual test has specifically exercised a stage-change notification's click-through since PF-N shipped).

## 13. Notification navigation

PF-N's fix (`isSafeInternalLink` + `handleActivate` in both `NotificationBell.jsx` and `NotificationsPage.jsx`) is generic — it navigates to whatever `n.link` the server supplied, for every recipient realm sharing the `UserNotification` model (`user`, `staff`, `employer` — since `recipientType` is just a field, not a separate model or separate client component). This means:

- Admin/staff notifications: correct link (`/admin/moderation`), PF-N navigates correctly — confirmed both by source and by the user's own manual PASS.
- Career-milestone User notifications (§12): correct link (`/applications/:id`), PF-N navigates correctly — confirmed by source, not yet by manual test.
- Internal-apply User notification (§10): PF-N navigates "correctly" in the sense of following the link faithfully, but the link itself is wrong (`/dashboard` instead of the specific application) — this is a data defect, not a PF-N navigation defect.
- Employer notifications (§8/§9): the link fields (`/employer/jobs`) are correct where they exist, but **there is no client consumer at all**, so PF-N's fix is moot for the Employer realm — there is nothing to click.

## 14. Worker and email-queue correctness

Covered in full in §6. Summary: enqueue wiring, worker processing correctness, and SMTP configuration are all confirmed correct by direct source re-inspection; only live delivery evidence is outstanding, and that absence is explicitly not evidence of a defect — it is just untested.

## 15. Platform-notification versus email matrix

| Event | Recipient | In-platform created | Active UI consumer | Action link | Email enqueued | Worker required | Dedup | Source-wired | Live-confirmed |
|---|---|---|---|---|---|---|---|---|---|
| A. Employer submits Job | Admin/staff | Yes | Yes (shared bell/page) | `/admin/moderation` | Yes | Yes | Notification: no; Email: yes | Yes | Notification: yes (manual PASS); Email: no |
| A. Employer submits Job | Employer | **No** | N/A | N/A | **No** | N/A | N/A | **No** | N/A |
| B. Admin approves Job | Employer | Yes | **No** | `/employer/jobs` | Yes | Yes | Yes (both) | Yes | No |
| C. Admin rejects Job | Employer | **No** | N/A | N/A | **No** | N/A | N/A | **No** | N/A |
| D. User applies internally | User | Yes | Yes | **`/dashboard` (wrong target)** | No | No | Yes | Yes (defective link) | Not tested |
| E. User tracks Job/opportunity | User | **No** | N/A | N/A | No | N/A | N/A | **No** | N/A |
| F. User changes tracker stage | User | Yes | Yes | `/applications/:id` | No | No | No | Yes | Not tested |
| G. Employer changes candidate stage | User | Yes (same event type as F) | Yes | `/applications/:id` | No | No | No | Yes | Not tested |
| H. Interview scheduled | User | Yes | Yes | `/applications/:id` | No | No | No | Yes | Not tested |
| I. Reminder created | User | Yes | Yes | `/applications/:id` | No | No | No | Yes | Not tested |
| J. Application accepted/hired | User | Yes | Yes | `/applications/:id` | No | No | No | Yes | Not tested |

## 16. Source-wired versus live-confirmed matrix

| Status | Items |
|---|---|
| Fully source-wired AND live-confirmed | Admin platform notification (job submission), Employer pending-status badge display |
| Fully source-wired, live-unverified | Admin review email, Employer approval email, Employer approval notification record, stage/interview/reminder User notifications |
| Backend-only (no client consumer) | Employer approval notification, (hypothetically) Employer rejection if it existed |
| Missing entirely | Employer pending-review notification+email, Employer rejection notification+email, tracker-creation User notification |
| Defective | Internal-apply User notification link (`/dashboard` instead of the specific application) |

## 17. Duplicate and idempotency analysis

- Email dedup: native and correct for every `queueEmail` call site (job submitted, job approved) via `enqueueJob`'s `dedupKey` check against `pending`/`processing`/`completed` `BackgroundJob`s.
- Admin/staff platform notification (job submission): **no dedup** — a deliberate, precedented (matches `onWebinarPublished`) but unproven-safe-under-retry design choice. A genuine client-side retry of the `createJob` request would create a second `Job` document (different `_id`) and thus a second, independently-correct notification — not a true duplicate. A hypothetical retry of *only* the notification call (not the whole request) is not a real code path today, since `onJobSubmitted` is called exactly once per `createJob` invocation with no surrounding retry loop.
- Dual-write duplication risk (§11 of the prior opportunity-tracking audit, re-confirmed unchanged here): applying internally and then also clicking "Track" on the same listing cannot create two tracker records, because both paths funnel through the same `findByTalentAndOpportunity` uniqueness check — but they *can* each trigger their own notification pathway if both were reachable for the same opportunity (in practice, once dual-write creates the tracker record, a subsequent Track attempt 409s before any notification-worthy state change happens, so this remains theoretical, not observed).

## 18. Active client-consumer inventory

- User-facing: `NotificationBell.jsx`, `NotificationsPage.jsx` — both PF-N-fixed, both consume `recipientType: 'user'` and `recipientType: 'staff'` UserNotification rows identically (same component, same query, differing only by which user is logged in).
- Admin/staff-facing: same two components (no separate Admin-only surface exists or is needed, since Admin/staff users are just Users with a staff role).
- Employer-facing: **none**. Confirmed absent by direct search of `client/src/pages/Employer` and `client/src/components` for any `queueNotification`/Employer-notification consumer, for the second time across two separate audits now.

## 19. Classification matrix

| Item | Classification | Files/symbols | User impact | Smallest correction | Tests required | Local acceptance required | Risk |
|---|---|---|---|---|---|---|---|
| Employer pending-review notification+email | G — MISSING | `employerController.createJob`, new `onJobSubmitted`-equivalent for the Employer realm in `automationService.js` | Employer has no acknowledgement beyond the raw API response and a passive status badge | Add a `queueNotification`(employer)+`queueEmail` call analogous to `onJobApproved`, fired from `createJob` alongside the existing `onJobSubmitted` call | New focused test mirroring `jobSubmissionAdminNotification.test.js` | Submit a job, confirm Employer notification/email | Low — same established pattern, no new architecture |
| Employer rejection notification+email+UI | G — MISSING | `moderationController.bulkRejectJobs`; no `onJobRejected` exists | Employer never learns a job was rejected except by noticing its status change | Add `onJobRejected` (mirrors `onJobApproved`) called from `bulkRejectJobs` | New focused test | Reject a job, confirm Employer notification/email | Low |
| Employer notification UI consumer | C — BACKEND WIRED, CLIENT UI MISSING | none — needs a new Employer-side bell/page analogous to `NotificationBell.jsx`/`NotificationsPage.jsx` but scoped to `recipientType: 'employer'` | Employer notifications (approval, and any future rejection/pending) are invisible in-app regardless of backend correctness | New Employer notification component(s) reusing the existing `inboxApi`-equivalent contract | New focused tests | Approve/reject a job as Admin, confirm Employer sees it in-app | Medium — new UI surface, though same data contract |
| Internal-apply notification link | H — DEFECTIVE | `automationService.onJobApplication`, `link: '/dashboard'` | Clicking "Application submitted" lands on the generic dashboard, not the specific application | Change `link` to `/applications/${opportunityApplicationId}` (the id already computed by the caller's dual-write, just not threaded through) | New focused test asserting the corrected link | Apply to a job, click the notification, confirm it opens the specific application | Low — one field, no architecture change |
| Tracker-creation notification | I — EXPECTED BY PRODUCT UX BUT NOT CURRENT CONTRACT | `careerNotificationBridge.NOTIFY_EVENTS` (missing `ApplicationCreated`) | Users get no confirmation when they track something manually (as opposed to applying) | Add `ApplicationCreated` to `NOTIFY_EVENTS` with an appropriate title/body — **requires a product decision** on whether tracking should notify at all, since it may be considered a low-value/noisy notification by design | New test if implemented | Track an opportunity, confirm notification | Low technically, but scope depends on product intent |
| Admin/Employer email live delivery | J — REVIEW REQUIRED (evidence gap, not a defect) | `jobQueueService.processEmailJob`, worker Compose config | Cannot yet claim delivery works end-to-end in this environment | None — this is a testing gap, not a code gap | N/A | Fresh job submission + approval with the worker running, checked in Mailpit | None (no code change indicated) |

## 20. Priority defects

- **P0:** none found.
- **P1:** Employer rejection flow has zero notification of any kind — a core Employer-facing workflow (learning your job was rejected) is entirely unimplemented, not merely undelivered.
- **P2:** Employer pending-review acknowledgement missing (notification+email); Employer notification UI consumer entirely absent (makes the already-correct approval notification backend invisible); internal-apply notification link defect (wrong destination).
- **P3:** Tracker-creation notification gap (product-scope-dependent); live SMTP delivery evidence still outstanding (testing gap only).

## 21. Test gaps

No test exists for: `onJobApplication`'s notification content/link; any Employer-realm notification (approval, or a rejection/pending path if implemented); the `careerNotificationBridge.js` event-to-notification mapping generally; live SMTP delivery of any queued email (by design, per this repo's lack of a test-Mongo/SMTP harness — every existing email/notification test in this codebase is a static source-text or safe-unmocked-function assertion, never a live send).

## 22. Recommended phases

**PF-J2 — Employer Job-submission pending-review acknowledgement**
- Goal: Employer receives an in-platform notification and email when their job enters pending review, mirroring the existing `onJobApproved` pattern for the opposite direction.
- Allowed files: `server/src/controllers/employerController.js` (call site), `server/src/services/automationService.js` (new function or extend `onJobSubmitted`), `server/src/templates/emailTemplates.js` (new template), one focused test.
- Focused tests: static-source assertions analogous to `jobSubmissionAdminNotification.test.js`.
- Live acceptance: submit a job, confirm Employer notification record exists (via the same read-only DB check pattern used in PF-J-R1) and a fresh email appears in Mailpit once the worker is deliberately started for the test.
- Commit message: `feat(notifications): acknowledge employer job submission`
- Stop conditions: any requirement to build the Employer notification UI in the same phase (route to PF-J3 instead) — keep this phase backend-only, matching how PF-J did the Admin side first.

**PF-J3 — Employer approval/rejection notification UI and rejection wiring**
- Goal: (a) implement `onJobRejected` (backend, mirrors `onJobApproved`); (b) build a minimal Employer-facing notification consumer (bell and/or page) reusing the existing `UserNotification`/`inboxApi` contract, scoped to `recipientType: 'employer'`.
- Allowed files: `server/src/controllers/admin/moderationController.js`, `server/src/services/automationService.js`, `server/src/templates/emailTemplates.js`; new `client/src/components/employer/EmployerNotificationBell.jsx` (or equivalent) and its wiring into the Employer layout; focused tests for both.
- Focused tests: backend static-source assertions for rejection wiring; client static-source assertions for the new component (same convention as every other client test in this repo).
- Live acceptance: reject a job, confirm Employer notification/email; approve a job, confirm the now-visible Employer notification appears in the new UI and navigates correctly (reusing PF-N's `isSafeInternalLink`/navigation logic, not a new implementation).
- Commit message: `feat(employer): notify on job rejection and expose employer notifications`
- Stop conditions: do not build a new notification data model or duplicate `NotificationBell.jsx`'s logic wholesale — reuse/extend the existing component if its structure permits, to avoid two divergent navigation implementations.

**PF-N2 — Internal-apply notification link correction**
- Goal: fix `onJobApplication`'s notification to link to the specific tracked application (`/applications/${opportunityApplicationId}`) instead of `/dashboard`.
- Allowed files: `server/src/controllers/applicationsController.js` (thread the dual-write id into the automation call), `server/src/services/automationService.js` (`onJobApplication`), one focused test.
- Focused tests: static-source assertion that the link uses the tracker id, not a hardcoded dashboard route.
- Live acceptance: apply to a job, click the resulting notification, confirm it opens the specific application detail page.
- Commit message: `fix(notifications): link job-application notification to its tracker record`
- Stop conditions: none expected — smallest possible change (one field).

**Not recommended:** PF-J-R2 (no source defect remains in the worker/email-completion logic — only live evidence is missing, which is not a code problem); PF-U as a dedicated phase (the "tracker creation should notify" question in §11/PF-U's likely scope is a product decision, not a confirmed defect — fold it into PF-J2/J3 planning only if the product owner confirms it's wanted, don't build it speculatively); PF-I is unaffected by this audit's findings and remains queued behind the phases above only if the user wants notification work prioritized first — otherwise it can proceed independently since it touches an unrelated area (Internship catalogue data).

## 23. Pre-push implications

None of the findings here are security or data-integrity defects. The Employer rejection gap (P1) is a real, complete, core-workflow absence and should be closed before push if Employer-facing rejection communication is considered part of the moderation feature's baseline. The Employer pending-acknowledgement and notification-UI gaps (P2) are known, scoped, non-blocking-but-real product gaps. The internal-apply link defect (P2) is a one-line fix with low risk once scheduled. Live SMTP delivery evidence remains outstanding but is a verification gap, not a shippability blocker on its own, provided the source-level correctness established in PF-J-R1 is trusted (it has been independently re-verified in this audit via direct diff inspection).

Per the audit's read-only constraints, the worker was returned to `stopped` at the end of this session:

```
docker compose --env-file .env.staging -f docker-compose.staging.yml -f docker-compose.sec3f-local.yml --profile sec3f-worker-disabled stop worker
```

## 24. Final recommendation

Proceed with **PF-N2** first (smallest, one-field, no architecture risk), then **PF-J2** (Employer pending acknowledgement, backend-only, same proven pattern as existing Admin/approval code), then **PF-J3** (rejection wiring + the new Employer notification UI, the largest of the three but still bounded and reusing existing components). Defer **PF-U**-style tracker-creation notifications pending an explicit product decision. Return to **PF-I** whenever convenient, since it is unaffected by any finding in this audit.
