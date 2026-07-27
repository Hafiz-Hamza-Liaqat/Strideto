# Phase E.1F-D — Employer Application Flow and Counters Report

**Date:** 2026-07-27  
**Scope:** Candidate → employer application visibility, external truthfulness, counters, status sync.  
**Preserved:** E.1F-A navbar, E.1F-B auth realm, E.1F-C post-job form (copy-only interactions via apply method already present).

---

## Application model map

| Concept | Authoritative store | Who creates | Employer sees? | User sees? |
|---------|---------------------|-------------|----------------|------------|
| **1. Submitted Strideto application** | `Application` (+ optional OA dual-write) | `POST /jobs/:id/apply` | Yes | Legacy list + OA tracker if dual-write |
| **2. External application click** | None | Browser navigation / mailto | No | No |
| **3. User-declared “I applied” externally** | `OpportunityApplication` (`source: external`) | Track CTA on JobDetail | **No** | Yes (personal tracker) |
| **4. Employer applicant status** | `Application.status` | Employer `PATCH /employer/applications/:id` | Yes | Via OA pipeline sync when dual-write exists |
| **5. Application count (employer)** | **Live** `Application.countDocuments` / aggregate per owned **internal** job | — | Shown; external = **Not tracked** | N/A |

**Job fields:** `applyType`, `applicationLink`, `applyEmail`, `applicationsCount` (denormalized; kept in sync on successful internal apply; UI prefers live count).

**Not merged:** External clicks and OA personal tracker entries never create employer-visible `Application` rows and never increment submitted counts.

---

## Internal flow

1. Employer creates job with no URL/email → `applyType: internal`.
2. Activate → admin approval → public active job.
3. User `POST /jobs/:id/apply` (auth) → `Application` unique `{userId,jobId}` → `$inc applicationsCount`.
4. Duplicate → 400 (pre-check + unique index 11000); **no** count increment.
5. Employer jobs list shows live `submittedApplicationsCount`.
6. Applications page lists applicants; status updates allowed statuses only.
7. Best-effort OA `pipelineStage` sync via `legacyApplicationId`.

---

## External flow

1. Job with URL/email → `applyType: external`.
2. JobDetail: outbound link and/or mailto; warning that apply leaves Strideto.
3. Optional “Mark as applied (personal tracker)” → OA `source: external` only.
4. `POST /jobs/:id/apply` remains 400 for external.
5. Employer UI: badge **External applications**, count **Not tracked**, no “View applications”; destination/email links instead.
6. Applications API returns empty + `applicationsTracked: false` + explanatory message.

---

## Counter design

| Surface | Source |
|---------|--------|
| `GET /employer/jobs` | Live aggregate for internal; `null` / not tracked for external |
| `GET /employer/dashboard` jobs[].applications | Live `$lookup` length for internal; `null` for external |
| `totalApplications` card | Still `Application.countDocuments` over employer jobs (internal-only by nature) |
| Analytics | Live count; external → `applications: null` |
| Stored `Job.applicationsCount` | Incremented only after successful `Application.create` |

**No production backfill** in this phase. Stale stored counts are overridden by live reads on employer job list.

---

## Status lifecycle

Allowed employer transitions: `shortlisted`, `rejected`, `interview`, `hired` (existing contract).  
Mapped to OA stages via `LEGACY_APPLICATION_STATUS_MAP`.  
Job `approvalStatus` is independent of candidate status.

---

## Authorization

- Applications listed only for jobs with matching `employerId`.
- Status update returns 404 if employer does not own the job.
- Horizontal access denied by ownership check (covered in authz unit tests).

---

## Files changed

| File | Change |
|------|--------|
| `server/src/services/employerApplicationCounts.js` | **New** live count enrichment |
| `server/src/controllers/employerController.js` | Enrich jobs; external apps response; OA status sync; analytics |
| `server/src/controllers/applicationsController.js` | Duplicate-key safe create before increment |
| `client/src/pages/Employer/EmployerJobs.jsx` | Internal/external UI, truthful counts |
| `client/src/pages/Employer/EmployerApplications.jsx` | Distinct empty states |
| `client/src/pages/Employer/EmployerDashboard.jsx` | External job stats copy |
| `client/src/pages/Jobs/JobDetail.jsx` | External warning, mailto, tracker source |
| `client/src/i18n/locales/en/employer.json` | New strings |
| `server/src/__tests__/employerApplication*.test.js` | Flow / authz / enrich tests |
| Docs | This report + audit update |

---

## Production / backfill implications

- Existing external jobs with `applicationsCount > 0` still show **Not tracked** in UI.
- Historical drift on internal `applicationsCount` is masked by live reads; optional future reconcile script (read-only report first) is out of scope.
- Do not run production mutations for this phase.

---

## Remaining gaps

- Full Mongo integration e2e (create employer/user/job/apply) not run against a live DB here — unit/contract tests cover rules.
- Notes UI / shortlist filters beyond existing status buttons.
- E.1F-E dashboard/settings polish.

---

## Final verdict

```
READY FOR EMPLOYER DASHBOARD COMPLETION
```

*No commit, push, deploy, or production data changes.*
