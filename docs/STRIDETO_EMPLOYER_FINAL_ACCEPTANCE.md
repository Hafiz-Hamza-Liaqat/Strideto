# Strideto — Employer Portal Final Acceptance

> **Mode:** FINAL_RELEASE_ACCEPTANCE
> **Scope:** One concise final Employer Portal acceptance of the current
> Mission 0 build. Read-only inspection preferred; no mutation performed.
> **Parent HEAD:** `e0343f3` (`docs(product): complete Strideto mission 0`)
> **Verdict:** **PASS — EMPLOYER RELEASE BASELINE**

## 0. Authority & baseline

- **B1–B5B:** previously accepted (PF-EMP UX/INT live-acceptance series) — not
  re-audited here.
- **Mission 0:** deployed (`c3af4d2` source, `e0343f3` report). This acceptance
  covers the current Mission 0 build only.
- Master frozen docs present:
  [product spec](STRIDETO_MASTER_PRODUCT_SPEC.md),
  [execution roadmap](STRIDETO_MASTER_EXECUTION_ROADMAP.md),
  [guardrails](STRIDETO_ENGINEERING_GUARDRAILS.md),
  [trust policy](STRIDETO_TRUST_VERIFICATION_POLICY.md).
- Usama121 / Andoride Developer B1–B5B acceptance evidence: read-only, untouched.

### Runtime observed (read-only)

| Service | State |
|---|---|
| frontend | healthy — serves the Strideto SPA shell (`<!DOCTYPE html>` + Strideto meta) |
| api-a / api-b | healthy — `/api/health` → `200` |
| mongodb | healthy — single `edurozgaar` DB, 54 employers |
| redis | healthy |
| caddy | running — `https://localhost` → `api-a/api-b` + `frontend` |
| worker | **stopped** (absent from `docker ps`) — remained stopped throughout |

No worker started. No email sent. No queue cleaned. No push. No deploy. No
`.env` read.

## 1. Section results

### A. Dashboard — PASS
- Frontend SPA serves; dashboard route is part of the served shell.
- Recent Job Posts count now reports the **rendered** list:
  `employer:recentJobsCount` with `count: data.jobs.length`
  ([EmployerDashboard.jsx:133](../client/src/pages/Employer/EmployerDashboard.jsx#L133)) —
  the old mismatch against `recentActivity` is gone. i18n key present.

### B. Jobs — PASS
- Nav active state uses the **longest (most specific)** matching path
  (`menu.reduce` on `path.length`,
  [EmployerLayout.jsx:29-34](../client/src/pages/Employer/EmployerLayout.jsx#L29)),
  so `/employer/jobs/new` highlights **only** "Post New Job"; "My Job Posts" is
  not simultaneously active.
- Paid-draft activation no longer dead-ends on `planId is required`:
  `handleActivate` sends **free** drafts straight to `activate`, and **paid**
  drafts into a plan picker that loads priced plans (`price > 0`) and routes the
  chosen plan through the existing Stripe checkout
  (`createCheckout(job._id, { planId })`,
  [EmployerJobs.jsx:105-143](../client/src/pages/Employer/EmployerJobs.jsx#L105)).
  The UI reaches the existing plan/checkout boundary correctly.
- **No real payment performed** — verification stopped at the checkout boundary.

### C. Applications + Analytics selectors — PASS
- Both pages consume the scalable selector:
  `employerApi.getJobOptions()` → `GET /employer/jobs/selector`
  ([EmployerApplications.jsx:43](../client/src/pages/Employer/EmployerApplications.jsx#L43),
  [EmployerAnalytics.jsx:28](../client/src/pages/Employer/EmployerAnalytics.jsx#L28),
  [employerService.js:116](../client/src/services/employerService.js#L116)).
- `getJobSelectorOptions` is `employerId`-scoped, bounded at **500** (not the old
  10-per-page cap), minimal projection, returns `total` + `truncated`
  ([employerController.js:80](../server/src/controllers/employerController.js#L80)).
- Route registered **before** `/employer/jobs/:id` so the literal path is not
  captured ([employer.js:101](../server/src/routes/employer.js#L101)).
- Live: `GET /api/employer/jobs/selector` without auth → **401** (tenant/auth
  boundary intact; no cross-tenant options possible — filter is `{ employerId }`).

### D. Application stage UX — PASS
- Canonical stages rendered via `StageBadge` / `stageLabel(t, stage)`; the legacy
  status label is only a fallback for historical rows.
- No raw `screening` / `negotiation` / `joined` slugs surfaced where Mission 0
  changed UI.
- Misleading "Mark Hired" copy replaced: `actionMarkHired` = **"Mark offer
  accepted"** ([en/employer.json:76](../client/src/i18n/locales/en/employer.json#L76));
  the `hired` quick action maps to the canonical **accepted** stage
  ([shared/employer/constants.js:25](../shared/employer/constants.js#L25)) —
  accepted/joined kept distinct.
- Same-status **server no-op** present: `isSameStatusNoOp` short-circuits and
  returns `{ unchanged: true }` **before** any write / tracker sync /
  notification / automation
  ([employerController.js:455](../server/src/controllers/employerController.js#L455)).

### E. Hiring Intelligence — PASS
- Intelligence / Candidates / Pipeline / Candidate Detail served by the SPA
  shell.
- `stageLabel(t, …)` used in Candidates (filter + rows), Pipeline (column
  headings), Candidate Detail (stage selector). No raw enum slug leaks in JSX.
- Accepted Interview workflow (B-series) source untouched — not rescheduled or
  modified.

### F. Settings + Public Profile — PASS (one deferred observation)
- Settings renders company fields; **truthful** "View public profile" link only
  when `employer.slug` exists **and** `isPublicProfile !== false`, otherwise a
  hidden hint ([EmployerSettings.jsx:255-265](../client/src/pages/Employer/EmployerSettings.jsx#L255)).
- Public job truthfulness: `getEmployerProfile` filters listed active jobs **and**
  the public `activeJobs` stat by admin approval
  (`approvalStatus: 'approved'`, legacy `$exists:false` allowance), gated by
  `isPublicProfile: { $ne: false }`
  ([publicProfileController.js:43-88](../server/src/controllers/publicProfileController.js#L43)).
  Pending/rejected/unapproved active jobs cannot appear as public open roles.
- "Hiring history" wording gone: server returns truthful `pastPositions`
  (closed roles), `hiringHistory` retained only as a back-compat alias.
- Public-profile endpoint live: `GET /api/employers/profile/<bogus>` → **404**
  (contract reachable); `GET /api/companies` → **200**.
- **Deferred observation (P3, not a regression):** all 54 existing employers
  predate the slug feature and currently have **no** slug, so none is reachable
  by slug until the operator-approved backfill runs (§I). This is the intended
  pre-backfill state — the deployed query/filter contract was verified in lieu of
  a slugged fixture; no employer was manufactured to test it.

### G. Account Security — PASS
- Change-password form (current/new/confirm, min-length + match validation,
  busy/error/success states) → existing `POST /auth/employer/change-password`
  ([employerService.js:106](../client/src/services/employerService.js#L106)).
- "Sign out of all sessions" — confirm dialog, busy/error states, uses the
  context `logoutAll` ([EmployerSettings.jsx:77-85](../client/src/pages/Employer/EmployerSettings.jsx#L77)).
- Reuses the existing audited SEC-3D endpoints; no new auth architecture.
- **Operator password not changed. No sessions logged out.** Wiring verified only.

### H. Notifications — PASS
- Empty state uses the i18n contract `employer:notificationsEmptyDescription`
  (no hardcoded Mission-0 English string)
  ([EmployerNotifications.jsx:17](../client/src/pages/Employer/EmployerNotifications.jsx#L17));
  key present.

### I. Public profile / slug backfill readiness — PASS
- New-employer registration generates a unique slug via
  `ensureUniqueEmployerSlug` with reserved-slug avoidance and numbered collision
  candidates (`-2`, `-3`, …)
  ([employerSlug.js](../server/src/utils/employerSlug.js));
  unique+sparse index is the authority, with a one-shot retry on the create-time
  `E11000` slug race ([employerAuthController.js:104-118](../server/src/controllers/employerAuthController.js#L104)).
- Backfill script is **dry-run by default**, `--commit` to apply, refuses
  production without `--allow-production`, fills only missing/empty slugs
  (idempotent) ([backfillEmployerSlugs.js](../server/src/scripts/backfillEmployerSlugs.js)).
- **Backfill NOT executed:** 0 of 54 employers hold a slug — direct live proof
  no mass backfill has run.

### J. Queue + email readiness — PASS
- `inspectQueueHygiene.js` **inspects by default**; deletion requires `--delete`,
  is targeted (terminal statuses older than `--older-than-days`, default 30),
  bounded (`--limit` default 200, hard max 1000), refuses production without
  `--allow-production`, audit-logs each run, and never dispatches jobs
  ([inspectQueueHygiene.js](../server/src/scripts/inspectQueueHygiene.js)).
- **No cleanup executed;** historical `BackgroundJob` rows untouched.
- Email path remains queue-based (`queueEmail` gates on `isSmtpConfigured()` and
  enqueues to `BackgroundJob`; delivery only when the worker runs). **Worker
  stopped; no email delivered.**

### K. Auth / ownership smoke — PASS
- Every touched employer route carries `requireAuth` + `requireEmployerAuth`
  ([employer.js](../server/src/routes/employer.js)); controllers scope by
  `employerId` (jobs, applications, selector). Application-status updates verify
  `application.jobId.employerId === employerId` before any change.
- Live: unauthenticated selector request → **401**.

## 2. Evidence classification

**Live-observed (runtime, read-only):**
frontend SPA shell served; API health 200; selector 401 without auth; public
profile endpoint 404 for bogus slug; `/companies` 200; 0/54 employers hold a
slug (backfill not run); worker stopped.

**Source/runtime contract verified without mutation:**
all A–K source contracts above; new i18n keys present across en/ur/ar; selector
route ordering; script safety guards; idempotency short-circuit ordering; auth
guards and `employerId` scoping.

## 3. Constraints honored

- Queue and email intentionally disabled — worker stayed stopped throughout.
- No real payment (verification stopped at the plan/checkout boundary).
- No live mutation; no account created; no password changed; no sessions revoked.
- No backfill; no queue cleanup; historical jobs and B1–B5B evidence untouched.
- No push; no deployment; no `.env` read.

## 4. Verdict

**EMPLOYER FINAL ACCEPTANCE: PASS.** No P0/P1 regression. One P3 deferred
observation (§F/§I): existing employers have no public-profile slug until the
operator-approved backfill window — expected pre-backfill state, does not
invalidate any completed Mission 0 requirement.

## 5. Deferred

- **Slug backfill (operational):** run `backfillEmployerSlugs.js` dry-run →
  `--commit` in an operator-approved non-production window, then verify existing
  employers' public profiles resolve. (Mission 0 intentionally left this
  unexecuted.)
- Live end-to-end acceptances still pending a controlled window (per Mission 0
  §7): paid activation with Stripe test mode; email delivery with worker + SMTP;
  bounded queue `--delete`; live change-password / logout-all session
  invalidation.

---

**Employer Engine: RELEASE BASELINE.**
Push: No · Deployment: No.
Next: **Mission 1 — International Platform Foundation.**
