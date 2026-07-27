# Employer Dashboard, Analytics, Settings and Responsive Completion (E.1F-E)

**Date:** 2026-07-27  
**Phase:** E.1F-E (focused implementation)  
**Verdict:** **READY FOR SOCIAL LINKS IMPLEMENTATION**

---

## 1. Employer route matrix

| Route | Classification | Notes |
|-------|----------------|-------|
| `/employer` | Complete and functional | Dashboard at index; API `GET /employer/dashboard` |
| `/employer/jobs` | Complete and functional | Live counts, filters, close/reopen/edit/activate |
| `/employer/jobs/new` | Complete and functional | E.1F-C form + plan activation |
| `/employer/jobs/:jobId/edit` | Complete and functional | Reuses post form; `PATCH /employer/jobs/:id` |
| `/employer/applications` | Complete and functional | E.1F-D internal/external truth |
| `/employer/analytics` | Functional; needs polish | Per-job views/apps/conversion only (no trend charts) |
| `/employer/settings` | Complete and functional | Editable profile via `PATCH /employer/profile` |
| `/employer/intelligence` | Feature-flagged | `VITE_EMPLOYER_INTELLIGENCE_ENABLED`; disabled message when off |
| `/employer/intelligence/candidates` | Feature-flagged | Real API when enabled; empty/error states |
| `/employer/intelligence/candidates/:id` | Feature-flagged | Talent/scores when enabled; gated when off |
| `/employer/intelligence/compare` | Feature-flagged | Compare API; disabled when flag off |
| `/employer/intelligence/pipeline` | Feature-flagged | Pipeline columns from API when enabled |
| `/employer/login`, `/employer/register` | Complete | Public auth |
| `/employer/:slug` | Complete | Public employer profile gate |
| `/employer/dashboard` | **Not registered** | Intentionally omitted (dashboard is `/employer`) |

### Job actions

| Action | Status |
|--------|--------|
| Create draft | Yes — `POST /employer/jobs` |
| Submit / activate | Yes — `POST /employer/jobs/:id/activate` |
| Edit | Yes — `/employer/jobs/:id/edit`, `PATCH /employer/jobs/:id` |
| Close | Yes — `POST /employer/jobs/:id/close` |
| Reopen | Yes — `POST /employer/jobs/:id/reopen` (returns to draft) |
| View public listing | Yes — `/jobs/:slug` from jobs list |
| Archive/delete | **Intentionally unavailable** | No employer delete endpoint |
| Duplicate job | **Intentionally unavailable** | No API; no UI link |

---

## 2. Dashboard metric contracts

**Endpoint:** `GET /employer/dashboard`  
**Implementation:** `server/src/services/employerDashboardMetrics.js` → `computeEmployerDashboardMetrics`

| Metric | Source | Filter / rule |
|--------|--------|----------------|
| `totalJobs` | `Job.countDocuments` | `employerId` |
| `activeJobs` | `Job.countDocuments` | `status: active`, `approvalStatus: approved` (pending **not** active) |
| `draftJobs` | `Job.countDocuments` | `status: draft` |
| `pendingApprovalJobs` | `Job.countDocuments` | `approvalStatus: pending` |
| `closedJobs` | `Job.countDocuments` | `status: closed` |
| `totalApplications` / `totalInternalApplications` | `Application.countDocuments` | `jobId ∈ internal jobs only` |
| `newApplications` | `Application.countDocuments` | Internal jobs, `appliedDate ≥ now-7d` |
| `shortlistedCandidates` | Aggregation on `Application.status` | Internal jobs, status `shortlisted` |
| `interviews`, `hired`, `rejected` | Status buckets | Internal jobs only |
| `totalViews` | Sum `Job.views` | All owned jobs |
| `internalViews` | Sum views | Internal jobs only |
| `conversionRate` | Calculated | `internalApplications / internalViews` (null if views = 0) |
| `recentActivity` | Latest applications | Internal jobs, populated job/user |
| Per-job row in `jobs[]` | Live `Application.countDocuments` | External → `applications: null`, `applicationsTracked: false` |

**Reconciliation:** Same `resolveJobApplyType` + live counts as `enrichEmployerJobsWithApplicationCounts` on Jobs page.

---

## 3. Analytics formulas

**Endpoint:** `GET /employer/analytics/:jobId`

| Field | Rule |
|-------|------|
| `views` | `Job.views` |
| `applications` | `Application.countDocuments` if internal; else `null` |
| `applicationsTracked` | `false` for external |
| `conversionRate` | `(applications / views) * 100` if internal and views > 0; else `n/a` |

**Not implemented (labeled unavailable in UI):** date ranges, trend charts, funnel, referrer/source, outbound click tracking.

---

## 4. External jobs

- Dashboard application totals exclude external jobs.
- Analytics shows views; applications and conversion show **Not tracked**.
- Jobs/Applications pages unchanged from E.1F-D.

---

## 5. Hiring Intelligence truth

| Item | Behavior |
|------|----------|
| Feature flag | Client `VITE_EMPLOYER_INTELLIGENCE_ENABLED !== '0'`; server returns 503 when disabled |
| Nav link | Hidden in employer sidebar when flag off |
| Overview / candidates / detail / compare / pipeline | Real endpoints under `/employer/intelligence/*` when enabled |
| Scores / rankings | Shown only from API payloads (may be empty); no fabricated chart data |
| Paid plan | Enforced server-side where configured; not expanded in this phase |

---

## 6. Settings capabilities

**Endpoint:** `PATCH /employer/profile`  
**Editable:** company name, phone, website, description, industry, size, location, city, province, `logoUrl` (HTTPS URL only), `isPublicProfile`  
**Read-only:** email, verification fields, password (no employer password change UI)  
**Logo upload:** **Not enabled** — URL-only; document blocker for binary upload without persistent media flow.

---

## 7. Application → OpportunityApplication sync

- `Application.status` remains authoritative for employer updates.
- `syncOpportunityApplicationFromLegacyStatus` logs safe warnings on failure; does not fail PATCH.
- Test: `server/src/__tests__/employerOaSyncFailure.test.js`

---

## 8. Integration test (disposable Mongo)

```text
EMPLOYER_INTEGRATION_TEST=1 node server/src/__tests__/employerPortalIntegration.test.js
```

**Result (local):** Passed on `edurozgaar_employer_e1fe_integration` (database dropped after run).

Covers: internal/external enrichment, dashboard count = 1, duplicate application rejected, foreign employer isolation check.

---

## 9. Responsive / browser matrix

**Method:** Layout audit + production build; employer shell uses mobile drawer (`EmployerLayout`), `min-w-0`, `min-h-[44px]` controls, single-column settings on small screens, analytics cards stack at `sm`.

**Playwright at all listed viewports:** Not run in this session (no automated employer Playwright suite in repo). Manual smoke recommended for: sidebar drawer, jobs table scroll, analytics select width.

---

## 10. Console / network (design)

- E.1F-B preserved: no user `/auth/me` bootstrap on employer routes.
- Employer APIs use `employerAxios` with employer refresh only.
- No new polling on dashboard/analytics.

---

## 11. Tests run

| Test | Result |
|------|--------|
| `employerDashboardMetrics.test.js` | Pass |
| `employerProfileValidation.test.js` | Pass |
| `employerOaSyncFailure.test.js` | Pass |
| `employerPortalIntegration.test.js` (opt-in local Mongo) | Pass |
| `employerApplicationFlow.test.js` | Pass |
| `authRealm.test.js` | Pass |
| `employerPostJobValidation.test.js` | Pass |
| `navbarHierarchy.test.js` | Pass |
| Server `npm run lint` | Pass |
| Client `npm run lint` | Pass (warnings only) |
| Client `npm run build` | Pass |
| `git diff --check` | Pass |

---

## 12. Files changed (E.1F-E)

**Server:** `employerController.js`, `employer.js` routes, `employerDashboardMetrics.js`, `employerOpportunityApplicationSync.js`, `employerProfileValidation.js`, tests  
**Client:** `EmployerDashboard.jsx`, `EmployerAnalytics.jsx`, `EmployerSettings.jsx`, `EmployerJobs.jsx`, `EmployerPostJob.jsx`, `EmployerLayout.jsx`, `EmployerCandidateCompare.jsx`, `EmployerAuthContext.jsx`, `employerService.js`, `employerPostJobValidation.js`, `routes/index.jsx`, `constants/index.js`, `en/employer.json`

---

## 13. Intentionally incomplete

- Job duplicate and hard delete
- Analytics trends, funnels, date filters, outbound click metrics
- Employer logo file upload (URL only)
- Full cross-viewport Playwright matrix
- Production counter backfill for legacy `applicationsCount` on jobs

---

## 14. Production migration implications

- No production Mongo mutations in this phase.
- Dashboard `activeJobs` now excludes pending-approval actives (may lower displayed active count vs. before).
- Approved active jobs edited by employer return to `approvalStatus: pending`.
