# Phase E.1E — Employer Portal, Public Navbar, Auth Context and Social Links Audit

**Mode:** Audit only (no implementation, commit, push, deploy, production data changes, or seed).

**Production URLs reviewed:** https://www.strideto.com, `/employer/`, `/employer/jobs`, `/employer/jobs/new`, `/employer/applications`

**Audit date:** 2026-07-27

---

## Executive summary

| Area | Finding |
|------|---------|
| Navbar overflow | **Fixed in E.1F-A** — see `docs/PUBLIC_NAVBAR_RESPONSIVENESS_REPORT.md` |
| Zero employer applications | **Addressed in E.1F-D** for external apply truthfulness; internal flow uses live `Application` counts |
| Post New Job labels | **Fixed in E.1F-C** — see `docs/EMPLOYER_POST_JOB_FORM_REPORT.md` |
| Employer 401s in console | Stale **user** session bootstrap on pages using `MainLayout` / shared widgets; employer token is separate |
| Job edit | **No** `/employer/jobs/:id/edit` route in router |
| Settings | Read-only profile display; no password/logo flows |
| Social links | Scattered fallbacks and CMS overrides; several placeholders/inert share UI |

**Final verdict (end of document):** `READY FOR EMPLOYER PORTAL IMPLEMENTATION`

---

## Part 1 — Public navbar audit

### Component trace

| Piece | File | Notes |
|-------|------|--------|
| Navbar shell | `client/src/components/layout/Navbar.jsx` | `lg:` breakpoint shows full nav; below `lg`, hamburger |
| Main nav links | Same | Wrapped in `hidden lg:flex` |
| Tour anchors | `client/src/onboarding/TourAnchors.jsx` | `max-w-[42vw] overflow-x-auto` on `< lg`; extra links when user/employer authenticated |
| Notification bell | `client/src/components/notifications/NotificationBell.jsx` | User inbox; polls unread count |
| Account menu | `client/src/components/layout/UserAccountMenu.jsx` | `useAuth`; talent summary fetch |
| Employer link in header | `TourAnchors` when `useEmployerAuth().isAuthenticated` | Does not replace user menu |
| Layout mask | `client/src/components/layout/MainLayout.jsx` | `overflow-x-hidden` on main wrapper |

**Authenticated vs guest:** Guest sees Resume/Career links in tour row + login/signup. Authenticated user adds Dashboard link (hidden `max-sm`). Employer session adds “Employer” link to dashboard (hidden `max-sm`) while **user** auth may still be active in parallel.

### Breakpoint analysis (code + layout inference)

| Width | Expected behavior | Overflow risk |
|-------|-------------------|---------------|
| 1920 | Full `lg` nav + tour row + bell + account | Low unless many long i18n strings |
| 1440–1366 | Same | Medium if tour row + employer + dashboard links |
| 1280 | At `lg` threshold (1024 Tailwind `lg`) full nav visible | **High:** primary nav + tour `42vw` cap + icons compete in one flex row |
| 1024 | `lg` nav on; tour anchors uncapped `sm:max-w-none` | **High:** horizontal pressure on right cluster |
| 768–1023 | Hamburger; tour row still visible in header | **High:** `max-w-[42vw] overflow-x-auto` scrolls tour links; account icon may sit at viewport edge |
| 430–360 | Hamburger; Career hidden `max-[360px]` | Account icon clipping if flex children do not shrink |

**Breakpoint where overflow starts (estimated):** **~1280px and below** when both primary `lg` navigation and `TourAnchors` are visible; **768–1023** when hamburger mode still renders tour scroll + bell + account without reserved min-width for icons.

**Element exceeding viewport:** Combined flex row in `Navbar` right section: `TourAnchors` (`shrink-0`, scrollable subregion) + `NotificationBell` + `UserAccountMenu` + mobile menu button — not a single fixed-width offender.

| Check | Result |
|-------|--------|
| Nav text wraps | Primary nav uses `whitespace-nowrap` patterns in tour links; main nav typically nowrap |
| User icon clipped | **Likely yes** at mid widths when parent uses `overflow-x-hidden` |
| Horizontal scrolling | Page-level scroll often **no** (hidden); tour subregion **yes** (`overflow-x-auto`) |
| Dropdowns outside viewport | Account menu positioning not viewport-clamped in audit (verify in E.1F-A) |
| Zoom 125%/150% | Effective viewport shrinks → same failures earlier |

### Screenshot / visual findings

- **Employer login/register** uses `MainLayout` → **public Navbar** on `/employer/login` (not `EmployerLayout`). Overflow and user-only API calls reproduce on employer auth pages.
- **Post-login employer routes** use `EmployerLayout` **without** public Navbar — production issue #1 is most visible on public/employer-auth shell, not inside employer sidebar app.

### Recommended information hierarchy (E.1F-A)

1. **Wide desktop:** Primary destinations in main nav; Resume/Career/Dashboard moved behind “More” or account menu before squeezing icons.
2. **Reserve fixed slot** for notification + account (e.g. `flex-shrink-0 min-w-[...]`).
3. **Remove reliance on `overflow-x-hidden`** to hide navbar bleed; fix flex/min-width at source.
4. **Mobile:** Hamburger drawer for all secondary links; tour anchors only inside drawer on `< lg`.
5. **Employer session on public shell:** Optional employer-specific account chip vs loading full user talent pipeline.

---

## Part 2 — Employer route inventory

### Confirmed route truth (E.1F-B)

| Question | Answer |
|----------|--------|
| Employer dashboard URL | **`/employer`** (`ROUTES.EMPLOYER_DASHBOARD`) — index route under `EmployerLayout` |
| Does `/employer/dashboard` exist? | **No** — not registered in `client/src/routes/index.jsx` |
| Redirect from `/employer/dashboard`? | **No** — would 404 or fall through to public `employer/:slug` profile route if added incorrectly |
| API dashboard endpoint | `GET /employer/dashboard` (employer axios) — separate from the URL path |

**Router:** `client/src/routes/index.jsx` — `ProtectedEmployerRoute` + `EmployerLayout`.

| Route | Component | Guard | API (typical) | Production readiness |
|-------|-----------|-------|---------------|----------------------|
| `/employer` | Redirect / landing | Employer | — | OK |
| `/employer/login` | Employer login | Public + MainLayout | `POST /employer/auth/login` | OK; navbar/auth noise |
| `/employer/register` | Register | Public + MainLayout | employer register | OK |
| `/employer/dashboard` | `EmployerDashboard` | Protected | `GET /employer/dashboard` or stats endpoints | Verify counters vs DB |
| `/employer/intelligence` | `EmployerIntelligence` | Protected + flags | intelligence APIs | **Placeholder/partial** if flags off |
| `/employer/jobs` | `EmployerJobs` | Protected | `GET /employer/jobs` | OK; edit link missing |
| `/employer/jobs/new` | `EmployerPostJob` | Protected | `POST /employer/jobs` | **A11y/contrast bug** |
| `/employer/applications` | `EmployerApplications` | Protected | `GET /employer/jobs/:id/applications` | **Empty if external apply** |
| `/employer/analytics` | `EmployerAnalytics` | Protected | analytics endpoints | Verify real metrics |
| `/employer/settings` | `EmployerSettings` | Protected | context only | **Read-only** |
| `/employer/intelligence/candidates` | `EmployerCandidates` | Protected | intelligence APIs | Nav may hide; verify links |
| `/employer/intelligence/compare` | `EmployerCandidateCompare` | Protected | compare APIs | Reachable only via intelligence UX |
| `/employer/intelligence/candidates/:id` | `EmployerCandidateDetail` | Protected | candidate detail | Same |
| `/employer/intelligence/pipeline` | `EmployerPipeline` | Protected | pipeline APIs | Same |
| `/employer/:slug` (public) | `EmployerPublicGate` | Public | public employer profile | Not employer app shell |

**Not found in router:** `/employer/jobs/:id/edit`, job detail, close/delete dedicated routes (actions may live on list only — confirm in `EmployerJobs.jsx`).

**Hidden/duplicate:** No `/employer/dashboard` path segment — dashboard is `/employer` index. Intelligence sub-routes exist but may be absent from sidebar. Plan/checkout is step inside `EmployerPostJob` (`employerApi.createCheckout`), not a standalone route.

**Per-route states:** Loading/error/empty patterns vary by page; applications page has job selector + empty list state when zero `Application` rows.

---

## Part 3 — Job approval vs candidate application flow

### Pipelines (separate)

1. **Admin job approval** — `Job.approvalStatus` (and related publish/active flags); employer sees “active” after approval.
2. **Candidate apply (internal)** — `POST` apply → `Application` model + `applicationsCount` increment on `Job`.
3. **Admin application moderation** — if present, separate from job approval (confirm admin UI; not blocking employer list).
4. **Employer applicants** — `GET /employer/jobs/:jobId/applications` → **`Application`** collection filtered by employer ownership.

### Candidate flow (internal)

```
JobDetail (applyType === 'internal')
  → apply form / API (applicationsController.applyToJob)
  → Application document (jobId, userId, status, …)
  → Job.applicationsCount++
  → Employer jobs list counter
  → Employer applications UI
```

### Candidate flow (external)

```
EmployerPostJob sets applyType 'external' when link/email present
  → JobDetail: external CTA (link/mailto)
  → applyToJob rejects external jobs (400)
  → No Application row
  → Employer applications: **zero** (expected)
  → Optional: OpportunityApplication / tracker “I applied” may exist for user only
```

**Code anchors:**

- `client/src/pages/Jobs/JobDetail.jsx` — `job.applyType !== 'internal'` gates in-app apply.
- `server/src/controllers/applicationsController.js` — external job rejection.
- `server/src/controllers/employerController.js` — lists applications for owned jobs.

### Root cause conclusion (issue #3)

**Not** “approved job confused with approved application.”

**Most likely:** **`applyType: 'external'` / product split** — candidates never write to employer `Application` model. Secondary possibilities if internal apply was used: wrong `jobId` format, employer filter, status filter, stale `applicationsCount` — require local integration test to distinguish.

### Controlled local/integration test (required; do not run on production)

1. Employer creates job **without** external-only apply (internal apply).
2. Admin approves job.
3. Normal user applies via JobDetail internal flow.
4. Assert `applicationsCount === 1` on employer job list.
5. Employer applications page shows candidate.
6. Employer updates status; user tracker reflects change.

**Automated coverage today:** No dedicated employer application e2e test file found (`employer*test*` empty on client; add in E.1F-D).

**Classification for production symptom:** **Model / product-path mismatch (external vs internal)** unless proven otherwise by test.

---

## Part 4 — Employer authentication and 401 audit

### Dual auth

| Context | Storage key (typical) | Provider |
|---------|----------------------|----------|
| User | `edurozgaar-token` (+ refresh) | `AuthContext` |
| Employer | `edurozgaar-employer-token` | `EmployerAuthContext` |

Both wrap app in `client/src/main.jsx`.

### Observed 401 endpoints (production console)

| Endpoint | Initiator | Should run on employer app shell? | Verdict |
|----------|-----------|-----------------------------------|---------|
| `/api/auth/me` | `AuthProvider` bootstrap, `UserAccountMenu` | **No** on pure employer layout; **Yes** on MainLayout pages | **Expected noise** if stale user token on employer login; **bug** if fired inside `EmployerLayout` |
| `/api/config/feature-flags` | Onboarding/feature bootstrap | Public or user-scoped contract | **Unexpected 401** if endpoint requires user auth; verify deployed route vs repo |
| `/api/notifications/unread-count` | User report | Codebase uses **`/api/inbox/notifications/unread-count`** (`NotificationBell`) | Path mismatch or proxy alias — confirm in Network tab |
| `/api/talent/me/summary` | `UserAccountMenu` | **No** for employer-only session | **Bug/noise** on public navbar with employer logged in |
| `/api/auth/refresh-token` | User axios interceptor | **No** when only employer session | **Bug risk:** failed refresh clears user state; must not wipe employer token |

**Direction:**

- Gate user bootstrap queries when route prefix is `/employer` and only employer token present.
- Do not call `/talent/me/*` from navbar when `!userAuth && employerAuth`.
- Notifications: disable bell or employer-specific endpoint.
- Feature flags: public GET or skip until authenticated with correct role.
- Separate interceptors or mark requests with auth realm.

`FeedbackWidget` uses `axiosInstance` (user) on employer pages — may contribute to 401 if widget opens on submit only (lower volume than navbar).

---

## Part 5 — Post New Job form audit

**Status (E.1F-C):** **Implemented** — contrast, `htmlFor`/`id`, helpers, client validation, apply-mode clarity.  
Report: `docs/EMPLOYER_POST_JOB_FORM_REPORT.md`. Application storage/counters remain for **E.1F-D**.

### Global UI defect (historical)

- **Labels** formerly used `text-[#0F172A]` on dark employer chrome → unreadable. Replaced with theme-aware gray/white tokens + form card surface.

### Field audit (`EmployerPostJob.jsx`)

| Form field | API payload key | Label contrast issue | Notes |
|------------|-----------------|----------------------|-------|
| Job title | `jobTitle` → `title` | **Yes** (`text-[#0F172A]` on dark layout) | Required for submit |
| Company | `companyName` | **Yes** | Often prefilled from employer |
| Location | `location` | **Yes** | |
| Government/private | `jobType` (`Private` default) | **Yes** | Select |
| Employment type | `type` (`full-time` default) | **Yes** | Select |
| Salary | `salaryRange` | **Yes** | Optional text |
| Skills | `skillsRequired` (comma-separated) | **Yes** | Split to array on submit |
| Description | `jobDescription` | **Yes** | Textarea |
| Deadline | `applicationDeadline` | **Yes** | Date input |
| Apply URL | `applyLink` | **Yes** | Sets **external** apply when present |
| Apply email | `applyEmail` | **Yes** | Contributes to external apply |

**Accessibility:** Labels are present in markup but **fail visually** on dark employer chrome; verify `htmlFor`/`name` pairing in E.1F-C. Plan step uses light cards (`bg-white`) — readable.

| Concern | Audit action |
|---------|----------------|
| Required marker | Not consistently shown in UI |
| Placeholder-only labeling | Mostly labeled; placeholders secondary |
| API ↔ model mapping | `employerApi.createJob` / `Job` schema |
| applyLink/email → `applyType: 'external'` | **Drives zero in-portal applications** |

### Workflow states

| State | Status |
|-------|--------|
| Save draft | Verify API + UI |
| Submit for approval | Present |
| Admin approval → active | Backend job workflow |
| Close/expire | Employer jobs actions — verify |
| Duplicate submit prevention | Check loading/disabled on submit |

---

## Part 6 — Employer dashboard functional matrix

| Feature | Data real? | Empty/error | Mobile | Notes |
|---------|------------|-------------|--------|-------|
| Dashboard counters | API-driven | Partial | Sidebar layout | Reconcile with applications model |
| Job filters All/Draft/Active/Closed | Yes | OK | Table scroll | No edit route |
| View applications | Yes | Empty external jobs | OK | **Zero apps expected** |
| Application status transitions | API | Verify | Touch targets | E.1F-D |
| Hiring Intelligence | **Often gated/placeholder** | Flag-dependent | — | E.1F-E |
| Analytics charts | API | Zero-data UX | Chart responsive | E.1F-E |
| Settings company/logo/password | **Incomplete** | N/A | OK | Read-only + future message |
| Logout | Employer context | OK | — | Clear employer token only |

---

## Part 7 — Responsive and accessibility audit

**Method:** Code review + Tailwind breakpoints; full matrix testing deferred to E.1F-A/E implementation QA.

| Viewport | Employer sidebar | Forms | Tables | Risk |
|----------|------------------|-------|--------|------|
| 1920×1080 | Expanded | OK width | OK | Low |
| 1024×768 | Collapse? | OK | Horizontal scroll | Medium |
| 768×1024 | Drawer | Stacked | Scroll | Medium |
| 360×800 | Drawer required | Labels broken (contrast) | cramped | **High** |

- **Zoom 200%:** Navbar and form labels fail first.
- **Focus/keyboard:** Employer layout generally usable; Post Job labels harm SR when visually missing.
- **Do not treat desktop-only as sufficient.**

---

## Part 8 — Console, network and server health

| Class | Examples |
|-------|----------|
| Expected 401 | Invalid/expired **user** token on `/auth/me` while browsing as guest or employer-only |
| Unexpected 401 | `/talent/me/summary` with employer-only session; feature-flags if should be public |
| 403 | Wrong role on admin endpoints |
| Frontend | React hydration — not primary in this audit |
| Token refresh loops | User refresh failing repeatedly on employer login page |

**Production-safe checks:** Read-only GET to public job APIs OK. **No** Render log dump in this audit (no credentials). Classify employer/auth 401s in staging after E.1F-B.

---

## Part 9 — Social links inventory

**Do not invent URLs.** Centralize in E.1F-F.

| Location | Platforms observed | URL status |
|----------|-------------------|------------|
| Footer | Twitter/X, LinkedIn, Telegram (fallback constants) | Mix CMS + hardcoded fallbacks |
| Contact | Telegram hardcoded | Confirm production URL |
| About | Limited/none | — |
| Navbar/account | Typically none | — |
| Employer portal | None expected | — |
| JobDetail share | Buttons may be inert | No real share URLs |
| Email templates | Audit in E.1F-F | — |
| OG/schema | Site-wide defaults | — |
| Admin CMS | Footer social overrides | Source of truth candidate |

### URL request table (user must supply exact URLs)

| Platform | Current in repo (fallback) | Confirmed production URL needed? |
|----------|---------------------------|----------------------------------|
| Twitter/X | Footer fallback constant | **Yes — user to provide** |
| LinkedIn | Footer fallback constant | **Yes — user to provide** |
| Telegram | Contact + footer | **Yes — user to provide** |
| Facebook | If referenced | **Yes if used** |
| Instagram | If referenced | **Yes if used** |
| YouTube | If referenced | **Yes if used** |

**Security:** Ensure `rel="noopener noreferrer"` on external `target="_blank"` (employer website link in settings already has it).

---

## Part 10 — Implementation plan (E.1F slices)

### E.1F-A — Navbar responsiveness and account-menu containment

- **Status:** **IMPLEMENTED** (2026-07-27) — `docs/PUBLIC_NAVBAR_RESPONSIVENESS_REPORT.md`
- **Files:** `Navbar.jsx`, `DrawerMenu.jsx`, `TourAnchors.jsx`, `MainLayout.jsx`, `UserAccountMenu.jsx`, `navConfig.js`
- **API/models:** None
- **Tests:** `server/src/__tests__/navbarHierarchy.test.js`
- **Notes:** TourAnchors no longer consume header width; `overflow-x-hidden` removed from MainLayout; E.1F-B gating preserved

### E.1F-B — Employer auth-context isolation and 401 cleanup

- **Files:** `AuthContext`, `EmployerAuthContext`, `axiosBase` interceptors, `main.jsx`, route-aware query gates
- **API:** Feature-flags contract; notification path alignment
- **Tests:** Unit: no `/auth/me` on employer-only layout mount
- **Risk:** Low if tokens not cleared cross-realm
- **Stop if:** refresh loop persists

### E.1F-C — Post New Job labels, validation, a11y

- **Status:** **IMPLEMENTED** (2026-07-27) — `docs/EMPLOYER_POST_JOB_FORM_REPORT.md`
- **Files:** `EmployerPostJob.jsx`, `employerPostJobValidation.js`, employer i18n
- **API/models:** Unchanged (applyType rule explained in UI only)
- **Tests:** `server/src/__tests__/employerPostJobValidation.test.js`
- **Not done here:** application visibility / counters (**E.1F-D**)

### E.1F-D — Application visibility and counters

- **Status:** **IMPLEMENTED** (2026-07-27) — `docs/EMPLOYER_APPLICATION_FLOW_AND_COUNTERS_REPORT.md`
- **Source of truth:** Internal submitted apps = `Application`; external clicks not counted; OA external track = user-only
- **Files:** `employerApplicationCounts.js`, `employerController.js`, `applicationsController.js`, `EmployerJobs.jsx`, `EmployerApplications.jsx`, `JobDetail.jsx`
- **Tests:** `employerApplicationFlow.test.js`, `employerApplicationAuthz.test.js`, `employerApplicationCountsEnrich.test.js`
- **Not done:** production counter backfill; full live-DB e2e harness

### E.1F-E — Dashboard, analytics, settings, responsiveness

- **Status:** **IMPLEMENTED** (2026-07-27) — `docs/EMPLOYER_DASHBOARD_COMPLETION_REPORT.md`
- **Files:** `employerDashboardMetrics.js`, `employerController.js`, `EmployerDashboard`, `EmployerAnalytics`, `EmployerSettings`, `EmployerJobs`, `EmployerPostJob` (edit route), `EmployerLayout` (intelligence nav gate)
- **API:** `PATCH /employer/profile`, `GET /employer/jobs/:id`, `POST close/reopen`, dashboard metrics reconciliation
- **Tests:** `employerDashboardMetrics.test.js`, `employerProfileValidation.test.js`, `employerOaSyncFailure.test.js`, `employerPortalIntegration.test.js` (local opt-in)
- **Not done:** duplicate job, delete job, analytics charts, logo binary upload, full Playwright viewport matrix

### E.1F-F — Social link centralization

- **Status:** **PARTIALLY IMPLEMENTED** (2026-07-27) — `docs/SOCIAL_LINKS_IMPLEMENTATION_REPORT.md`
- **Confirmed:** LinkedIn Company Page — `https://www.linkedin.com/company/strideto/`
- **Deferred:** Facebook, Instagram, X, YouTube, TikTok, Telegram, WhatsApp, GitHub (hidden; no placeholder icons)
- **Files:** `shared/social/officialSocialLinks.js`, `SocialLinksRow.jsx`, `Footer.jsx`, `Contact.jsx`, `schemas.js`
- **Tests:** `server/src/__tests__/officialSocialLinks.test.js`
- **CMS:** Public render filters CMS social rows; unconfirmed LinkedIn CMS values cannot replace official URL

---

## Risks and blockers

| Risk | Severity |
|------|----------|
| External apply jobs never populate employer applications | Addressed in E.1F-D (truthful UI) |
| Dual auth 401 noise erodes trust in employer session | Addressed in E.1F-B |
| No job edit route | Addressed in E.1F-E (`/employer/jobs/:jobId/edit`) |
| Live API vs local Mongo mismatch (E.1C) | **Ops** — environment-specific |
| Remaining social platforms without official URLs | Deferred in E.1F-F (LinkedIn only) |

---

## Final verdict (E.1E audit — historical)

```
READY FOR EMPLOYER PORTAL IMPLEMENTATION
```

Subsequent E.1F slices (A–E, partial F) implemented employer portal, navbar, applications, dashboard, and confirmed LinkedIn. See per-phase reports under `docs/`.

---

*E.1E audit was read-only. Later phases applied code changes documented in respective reports.*
