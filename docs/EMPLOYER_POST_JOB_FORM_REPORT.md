# Phase E.1F-C — Employer Post Job Form Report

**Date:** 2026-07-27  
**Scope:** Post New Job UI readability, field validation, accessibility, and responsive layout only.

---

## Field contract

Aligned with `POST /employer/jobs` (`server/src/controllers/employerController.js` `createJob`).  
**Not in UI (not invented):** work mode, category, experience level.

| Visible label | `name` | `id` | API property | Model property | Type | Required | Placeholder / helper | Validation |
|---------------|--------|------|--------------|----------------|------|----------|----------------------|------------|
| Job title | `jobTitle` | `employer-post-job-title` | `jobTitle` | `Job.title` | text | **Yes** | e.g. React Developer | non-empty, ≤200 |
| Company / organization | `companyName` | `employer-post-company` | `companyName` | `Job.company` / `organization` | text | **Yes** | e.g. Strideto; prefills from employer profile | non-empty, ≤200 |
| Location | `location` | `employer-post-location` | `location` | `Job.location` | text | Optional | e.g. Lahore, Pakistan | ≤200 |
| Job classification | `jobType` | `employer-post-job-type` | `jobType` | `Job.jobType` | select | **Yes** (default Private) | Private / Government / Internship | enum |
| Employment type | `type` | `employer-post-employment-type` | `type` | `Job.type` | select | **Yes** (default full-time) | full-time / part-time / contract / internship | enum |
| Salary range | `salaryRange` | `employer-post-salary` | `salaryRange` | `Job.salaryRange` | text | Optional | PKR example + optional help | ≤120 |
| Required skills | `skillsRequired` | `employer-post-skills` | `skillsRequired` (array) | `Job.skillsRequired` | text → array | Optional | comma-separated help | ≤40 skills, ≤80 chars each |
| Job description | `jobDescription` | `employer-post-description` | `jobDescription` | `Job.description` | textarea | **Yes** | responsibilities placeholder | ≥20, ≤20000; HTML stripped server-side |
| Application deadline | `applicationDeadline` | `employer-post-deadline` | `applicationDeadline` | `Job.deadline` | date | Optional | today or future | not past |
| Application URL | `applyLink` | `employer-post-apply-link` | `applyLink` | `Job.applicationLink` | url | Optional | https careers URL | http(s) if set |
| Application email | `applyEmail` | `employer-post-apply-email` | `applyEmail` | `Job.applyEmail` | email | Optional | careers@… | valid email if set |
| Plan / publish | — | — | activate / checkout | plan step after draft | UI step | After save | First free / paid plans | existing API |

Defaults: `jobType=Private`, `type=full-time`, other strings empty.

---

## Contrast fix

- Removed hardcoded `text-[#0F172A]` labels/headings that matched dark layout background.
- Labels: `text-gray-900 dark:text-gray-100`
- Helper: `text-gray-600 dark:text-gray-400`
- Errors: `text-red-600 dark:text-red-400`
- Form surface: `bg-white dark:bg-gray-800` card (same pattern as settings) without changing `EmployerLayout` chrome.
- Inputs: light/dark readable text; `min-h-[44px]`; visible focus rings.

---

## Label associations

Every control has unique `id`, matching `htmlFor`, correct `name`, `aria-invalid`, `aria-describedby` (help + error), `aria-required` on required fields, and sr-only “required” text. Classification and application method use `fieldset`/`legend`.

---

## Validation behavior

Client module: `employerPostJobValidation.js` (mirrors backend required title/company and applyType rule).

- Blocks submit on client errors; focuses first invalid field.
- Past deadlines rejected; invalid URL/email rejected.
- Description minimum 20 characters (frontend; backend only strips HTML).
- Server error message still shown; common title/company messages mapped to fields.
- Entered values retained on API failure.

---

## Application-method behavior

Backend rule (unchanged): `applyType = (applyLink || applyEmail) ? 'external' : 'internal'`.  
Both URL and email are sent when present (neither discarded).

| Inputs | Mode |
|--------|------|
| Neither | **Internal** — candidates can apply on Strideto |
| URL only | **External** |
| Email only | **External** |
| Both | **External** (both stored) |

UI shows live status + helper: external applies **will not** appear in Strideto’s applicant dashboard. No storage/counter changes in this phase.

---

## Workflow states

| State | Behavior |
|-------|----------|
| Initial load | Empty form; plans fetched |
| Prefill | `companyName` from `useEmployerAuth().employer.companyName` once |
| Save draft | `POST /employer/jobs` → status draft → plan step (real API) |
| Submit for approval | Via plan activate / checkout (existing) |
| Loading | Submit/plan buttons `disabled` while `submitting` |
| Duplicate click | Prevented by disabled state |
| Validation failure | Field errors; values kept |
| API failure | Banner + values kept |
| Plan step | Free + paid plans; back to edit draft details |
| Unsaved changes | Not implemented (no prior prompt) |

---

## Responsive verification

Layout: `max-w-2xl w-full min-w-0`, one column by default, `sm:grid-cols-2` collapses, submit `w-full` on narrow screens, `pb-16` on mobile so FeedbackWidget does not cover submit.

**Code/layout review (manual browser pass recommended after deploy):** 1920–360 widths and 125%/150%/200% zoom — no fixed desktop-only widths introduced.

---

## Tests

```bash
node server/src/__tests__/employerPostJobValidation.test.js
```

Covers: field id contract, required fields, past deadline, invalid URL/email, apply modes (none/url/email/both), payload keeps both apply fields, short description, skills normalize.

---

## Files changed

| File | Change |
|------|--------|
| `client/src/pages/Employer/EmployerPostJob.jsx` | A11y, contrast, helpers, validation wire-up, apply-mode UI |
| `client/src/pages/Employer/employerPostJobValidation.js` | **New** pure validation |
| `client/src/i18n/locales/en/employer.json` | Labels, helpers, validation messages |
| `client/src/i18n/locales/ur/employer.json` | Same keys |
| `client/src/i18n/locales/ar/employer.json` | Same keys |
| `server/src/__tests__/employerPostJobValidation.test.js` | **New** |
| `docs/EMPLOYER_POST_JOB_FORM_REPORT.md` | This report |
| `docs/EMPLOYER_PORTAL_NAVBAR_AND_SOCIAL_AUDIT.md` | E.1F-C marked implemented |

---

## Remaining application-tracking limitations (E.1F-D)

- External jobs still produce **zero** Strideto `Application` rows.
- No employer-side tracking of external applies.
- Counters / applications list behavior unchanged.

---

## Final verdict

```
READY FOR NAVBAR RESPONSIVENESS IMPLEMENTATION
```

*No commit, push, deploy, or production data changes.*
