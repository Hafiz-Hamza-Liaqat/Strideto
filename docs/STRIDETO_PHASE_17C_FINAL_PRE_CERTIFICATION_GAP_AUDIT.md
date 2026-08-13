# STRIDETO PHASE 17C-A — FINAL PRE-CERTIFICATION GAP AUDIT

**Mode:** AUDIT / READ-ONLY / REPORT ONLY  
**Date:** 2026-08-13  
**HEAD:** `34df91f5267d1c1c30f44de5d6a78e7f6b3dbbf7`  
**Branch:** `main`  
**Phase 18:** NOT STARTED  
**Implementation:** NOT STARTED  

This document is the single Phase 17C-A audit. It is not certification, not a 10/10 claim, and not an implementation plan to execute now.

---

## 0. Baseline (unchanged)

Recorded at audit start. Working tree was **not** altered except creation of this report.

```
 M client/src/components/admin/AdminDataTable.jsx
 M client/src/components/admin/AdminTableFilters.jsx
 M client/src/components/common/FormField.jsx
?? docker-compose.appenv-align.yml
?? docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md
?? docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md
main
34df91f5267d1c1c30f44de5d6a78e7f6b3dbbf7
```

Recent commits (newest first):

- `34df91f` docs(release): record Strideto Phase 17B remediation
- `29b78b8` fix(platform): finalize account navigation and trust UX consistency
- `8487891` fix(identity): harden sessions recovery and account security
- `5294bf6` fix(runtime): close discovery and shared form stability gaps
- `a15f84f` docs(release): record phase 17 pre-certification remediation

Known WIP and protected/local-only files were **not** stashed, reset, checked out, staged, or committed.

Worker: expected STOPPED (this audit did not start it).  
This-session Docker/`/api/health` probe did not succeed from the audit shell (`JWT_SECRET` interpolation when invoking compose; no containers were started). Runtime claims below are therefore **source-primary**, with Phase 17B health evidence treated as historical, not re-proven here.

---

## A. EXECUTIVE VERDICT

**READY FOR 17C IMPLEMENTATION**

Phase 17 / 17B closed the `/jobs` crash, launch-gated public job lists, shared password-change contract, Terms/Privacy server metadata, and Institution verification-vs-claim copy. The candidate is **not** ready for Phase 18 and **not** ready to skip remediation.

What remains is a bounded set of launch-blocking correctness and honesty gaps:

1. Student password reset can report success without confirming the mutation.
2. Admin can approve more Free Beta jobs than the server policy allows.
3. Institution program submit/update can proceed without approved organization verification.
4. Student dashboard recommendations still query `status: 'active'` without `launchEligible`.
5. Identity is uneven: only the User realm has email-link verification; Employer password policy is weaker; register 409 enumerates accounts; Turnstile/OAuth/SMS are stubs.
6. Several discovery and Employer entitlement UIs are still misleading (paid-draft, Home → Intl Scholarships, Admin Payments `$` ledger).

Trust rules (CLAIMED ≠ EVIDENCE ≠ VERIFIED; Student cannot write Employer/Institution stages; no self-verification; no fake Stripe) remain intact and must not be weakened.

**Phase 18 must remain NOT STARTED.**

---

## B. FINDINGS BY SEVERITY

### BLOCKER

None. No path was found that lets a client manufacture verification, Trust, payment confirmation, canonical authority, or employer/institution hiring states.

### P0

#### P0-1 — Student password reset reports success without checking mutation

| | |
|---|---|
| Route / module | `POST /api/auth/reset-password`; `authController.resetPassword`; `userSecureAuthFlows.resetPassword` |
| Role | Student / User (staff share this realm) |
| Observed | Controller pre-looks up a valid hashed token, then always returns HTTP 200 “Password reset successfully” and ignores `result.code`. The flow always returns `RESET_ATTEMPTED` / 200 even when `VERSION_INCREMENTED` did not occur. |
| Expected | Success only after the authoritative password write; otherwise a generic failure. Sessions revoked only after a real reset. |
| Evidence | `server/src/controllers/authController.js` 386–413; `server/src/services/auth/userSecureAuthFlows.js` 346–380 |
| Impact | User may believe the password changed when it did not; old password remains; sessions may not revoke. |
| Remediation | Check mutation result. Return 200 success only on `VERSION_INCREMENTED`. Keep invalid-token responses generic. Do not log tokens. |

#### P0-2 — Admin job approve ignores Free Beta active-slot cap

| | |
|---|---|
| Route / module | `POST` admin job approve / bulk approve; `FREE_BETA_PUBLISHING_POLICY.activeFreeJobCapacity.enforcedAt = 'approval'` |
| Role | Admin; Employer publishing |
| Observed | Policy: `maximumActiveFreeJobs: 5`, enforced at **approval**. `approveJob` sets `status: 'active'` with no capacity check. Employer submit *does* charge quota. |
| Expected | Admin cannot publish a 6th free active job. Review screen shows remaining slots from the same `loadEmployerPublishingUsage` authority as Plans & Usage. |
| Evidence | `server/src/config/freeBetaPublishingPolicy.js` 115–148; `server/src/controllers/admin/adminJobsController.js` 328–342 |
| Impact | Server entitlement is bypassed by the staff path that the policy names as the enforcement point. |
| Remediation | Before approve/bulk-approve, load usage and refuse with a controlled 409 when active free capacity is exhausted. Attach the full snapshot to `GET /admin/jobs/:id` (not type-only). |

#### P0-3 — Institution program submit/update skip organization verification

| | |
|---|---|
| Route / module | `updateProgram`, `submitProgram` in `institutionPortalController.js` |
| Role | Institution |
| Observed | `createProgram` asserts **claim + verification**. `updateProgram` / `submitProgram` assert **claim only**. Client `InstitutionPublishingGate` still requires both. |
| Expected | Dual gate on every official write: approved org verification **and** approved canonical claim. Revoked verification must lock submit. |
| Evidence | `server/src/controllers/institutionPortalController.js` 240–317 vs 323–332 |
| Impact | After verification revoke, an approved claim can still submit/update programs. Weakens the frozen dual-gate contract. |
| Remediation | Call `assertApprovedVerification` on update/submit (and any other official mutate that currently skips it). Do not let claim grant legitimacy. |

#### P0-4 — Student dashboard recommendations ignore launch projection

| | |
|---|---|
| Route / module | Student `/dashboard` composition |
| Role | Student / Public consistency |
| Observed | `DashboardCompositionService` does `Job.find({ status: 'active' })` (and the same for scholarships/admissions) with **no** `withFixtureExclusion` / `launchEligible`. Phase 17B fixed `/api/jobs` recommendations, not this dashboard query. |
| Expected | Home, `/jobs`, Saved, and dashboard recs share the same launch-eligible truth. Fixtures never appear as normal opportunities. |
| Evidence | `server/src/services/career/DashboardCompositionService.js` 152–156 |
| Impact | Students can be shown inventory that public `/jobs` hides. |
| Remediation | Apply the same launch projection used by public jobs/recs. Cap results. Never fall back to fixtures. |

### P1

#### P1-1 — Register email enumeration on all four public realms

- **Routes:** Student/Employer/Agent/Institution register.
- **Observed:** `409` with distinct “already registered” strings (`authController.js` 107; `employerAuthController.js` 99; agent/institution equivalents).
- **Expected:** Generic response (same as forgot-password).
- **Impact:** Account oracle.
- **Remediation:** Same generic 201/200-shaped response; create only when absent; do not reveal existence.

#### P1-2 — Employer register password is not server-validated

- **Observed:** `employerRegister` requires only `companyName`, `email`, `password`. No `validatePassword`. Client `minLength={6}`. No eye toggle.
- **Expected:** Same 8–128 + complexity policy as Student/Agent/Institution.
- **Evidence:** `employerAuthController.js` 83–90; `EmployerRegister.jsx`.
- **Remediation:** Reuse shared password validator + `PasswordInput`.

#### P1-3 — Email verification is User-only; B2B issues a session immediately

- **Observed:** Student: hashed 30-minute link, login blocked via `isEmailVerificationRequired` (`server/src/utils/emailVerification.js`). Employer/Agent/Institution: no verify flow; register calls `issueSecure*Session`. Agent/Institution `emailVerified` fields exist but are unused.
- **Expected:** Org accounts that can post jobs / claim institutions must prove channel control, or remain restricted until verified.
- **Remediation:** Reuse the existing **link** challenge (not a new OTP product) for B2B; do not issue a full session until verified **or** issue a restricted session that cannot publish/verify/claim.

#### P1-4 — Employer UI treats non-`free` `planType` as paid

- **Observed:** `createJob` sets `planType: 'free'` only on the first job; later drafts get `null`. `isPaidDraft` is `planType !== 'free'`. Checkout is 503 `not_configured` because `paidPublishingEnabled === false`.
- **Evidence:** `employerController.js` 283; `EmployerJobs.jsx` 13–16; `paymentsController.js`.
- **Remediation:** Derive paid vs free from `loadEmployerPublishingUsage` / `paidPublishingEnabled`, never from null `planType`. Hide “Pay and publish” while paid is off.

#### P1-5 — Admin job review entitlement is type-only

- **Observed:** `GET /admin/jobs/:id` attaches `{ type, policyCode, policyVersion, paidPublishingEnabled }` and discards quota/payment. List/moderation queues show no Free/Paid column. No `promotional` entitlement type exists.
- **Expected:** Same snapshot as Employer Plans & Usage: quota used/remaining, blockers, payment `not_configured` or provider fields.
- **Remediation:** Return full `usage` on get-one; add a list column; never infer from employer UI.

#### P1-6 — Home country chips to Intl Scholarships do nothing

- **Observed:** `Home.jsx` links `?country=Turkey|Germany|China|Hungary|UK|Canada`. `IntlScholarships.jsx` never reads `location.search`. Dropdown is `UK, USA, Australia, Germany, Canada, Singapore` (Turkey/China/Hungary absent).
- **Remediation:** Initialize filters from URL; write URL on Apply; use ISO/`CountrySelect`; drop fake country lists.

#### P1-7 — Employer login does not check `suspended`

- **Observed:** User/Agent/Institution login check `accountStatus === 'suspended'`. `employerLogin` does not.
- **Remediation:** Same 403 suspend gate.

#### P1-8 — Hardcoded Pakistan on Employer public JSON-LD

- **Observed:** `EmployerPublicProfile.jsx` line 31: `addressCountry: 'PK'` whenever a location exists.
- **Remediation:** Use stored ISO `countryCode` or omit country. Never default PK.

#### P1-9 — Turnstile is a non-functional stub

- **Observed:** `TurnstileField` renders an empty `div` with `data-sitekey` and **no** Cloudflare script / token. Server skips when `not_configured`. Enabling `TURNSTILE_ENABLED=1` would fail-closed on User register/forgot. B2B routes have the field but **no** `requireTurnstileWhenEnabled`.
- **Remediation:** Keep default `not_configured`. Before enabling: load widget, post token, verify hostname/action, keep rate limits. Do not fake “human verified”.

#### P1-10 — Forgot-password copy is untruthful when SMTP is off

- **Observed:** Forgot always returns “you will receive a link”. Register *does* surface `emailMode: 'unavailable'` when SMTP is missing. Auth verify/reset emails can send in-process and ignore worker/`EMAIL_DELIVERY_ENABLED`.
- **Remediation:** Generic existence response **plus** environment-truthful delivery state (`unavailable` / `queued_worker_stopped`) without enumerating accounts.

#### P1-11 — `GET/POST /auth/verify-email` has no rate limiter

- **Evidence:** `server/src/routes/auth.js` (register/forgot limited; verify-email not).
- **Remediation:** Add a tight limiter. Token entropy is high; still bound attempts.

#### P1-12 — Step-up store is unused and process-local

- **Observed:** `stepUpAuth.js` in-memory `Map`; no controller consumes it except tests. Password change uses current password only. No email/phone change APIs.
- **Remediation:** Wire step-up for password/email/phone/team-owner; persist grants in Redis/Mongo before multi-instance use. Do not add OTP-on-every-login.

### P2

- Scholarships/Admissions/Schools/Foreign Studies/Marketplace still use immediate filters and/or hardcoded country lists / free-text province (Jobs/Internships/Program Explorer are further along).
- Jobs/Internships read URL query but do not write it back.
- Employer Applications/Interviews lack status/date filters; Team role `<select>` includes `owner`; no member/invite counters.
- Institution Applications `<select>` lists all states (server 409s illegal ones); intakes are add-only; Help/Onboarding are redirects.
- Agent Services countries are CSV; Leads titled with raw `_id`.
- Employer/Agent Help pages are thin link lists (Guidelines are the real handbook).
- Connected Accounts panel missing on Employer Settings (catalog is `not_configured` everywhere — do not add live OAuth).
- Student nav omits Personalization, Institution applications, Resume Builder; dual Saved (`/saved-jobs` vs `/journey/saved`); Dashboard Documents widget does not point at Vault.
- Auth shells are not shared: Institution auth has no footer legal column; Employer/Agent auth sit inside `MainLayout` (double chrome). Auth → Terms blink is lazy + CMS `LoadingShell`, not a layout `key={pathname}`.
- Admin lives inside public `MainLayout` (public navbar + footer + sidebar).
- Realm nav has `aria-current` but not the public orange underline.
- `FormField.jsx` WIP has no reserved error height — **do not commit**.
- Remaining Province-only admin/public fields; Exam Prep is Pakistan-exam-scoped (acceptable if labeled).
- Legacy `AdminPayments` uses `$` + `toFixed(2)` parallel to Commerce minor-units.
- Vault grant download is owner-only (grants cannot download) — disclose or implement later.
- `xlsx` / `jspdf` known CVEs; errorHandler returns `err.message` when `err.code` is set; Redis rate-limit memory fallback after boot; API process may still start scraper cron unless `WORKER_ONLY=1`.
- Security in-app notifications (password change, logout-all) and vault-expiry notifications are missing.
- Admin seed skips legal acceptance metadata.

### MAJOR

None beyond the P0 dual-gate and entitlement-enforcement holes. Frozen Trust / Student-authority contracts were not found weakened.

### MINOR

- Admin seed users lack Terms timestamps.
- Same email can exist independently across User/Employer/Agent/Institution (realm isolation — disclose, do not silently merge).
- Google `SocialAuthButton` is `comingSoon`.
- Authenticated resend-verification reveals “already verified”.
- Phase 6 Institution billing “Not configured” string mismatch (pre-existing; 17B deferred).
- Calendar icon dark-theme: source `color-scheme` + invert exist; Chrome/Edge visual proof still not claimed.

### INFO

- Public catalogs may be empty by launch-fixture policy — truthful empty states are intended.
- Stripe / SMS / WhatsApp / paid AI / payouts / scraping: OFF / `not_configured`.
- Assessments default OFF.
- Worker STOPPED; queued email ≠ delivered.
- Connected accounts: all `NOT_CONFIGURED`; `canAuthenticate: false`; confer no Trust.
- Copilot: deterministic / `provider_not_configured`.
- Impersonation: **absent**. Do not add.

---

## C. ROLE SCORECARD

Scores are /10. None is 10: live provider, long-idle browser, and visual responsive proof were not re-run in this audit.

| Role | Security | Functionality | UX | Workflow | International | Scalability | Evidence confidence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Public | 8.2 | 7.4 | 7.6 | 7.2 | 7.3 | 7.5 | 7.8 |
| Student | 8.0 | 7.8 | 7.5 | 7.4 | 7.6 | 7.4 | 7.8 |
| Employer | 7.2 | 7.6 | 7.0 | 7.0 | 7.0 | 7.4 | 8.0 |
| Agent | 7.6 | 8.0 | 7.2 | 7.8 | 7.6 | 7.4 | 7.8 |
| Institution | 7.4 | 8.0 | 7.4 | 7.6 | 7.6 | 7.4 | 8.0 |
| Admin | 8.0 | 7.6 | 7.0 | 7.2 | 6.8 | 7.2 | 7.6 |
| Cross-role | 8.4 | 8.0 | 7.4 | 7.8 | 7.4 | 7.4 | 8.0 |
| Operations | 7.6 | 7.4 | 7.0 | 7.0 | 7.0 | 7.0 | 6.8 |
| Future AI | 8.5* | 6.0 | 6.5 | 2.5 | 7.0 | 6.0 | 8.0 |

\*AI security is high **because writes are forbidden** and paid providers are off — not because an agent control plane exists.

**Why not 10 (by role):**

- **Public:** Home → Intl Scholarships broken; mixed filter contracts; some PK-named SEO landings remain as routes.
- **Student:** Dashboard recs leak; eligibility/NBA not on dashboard/nav; dual Saved/Documents; reset false-success.
- **Employer:** Weak password; no email verify; paid-draft lie; Help thin; no Connected Accounts panel; approve-cap is Admin-side but breaks Employer quota truth.
- **Agent:** Register enumeration; no email verify; Services CSV; Leads raw id; Help thin.
- **Institution:** Dual-gate hole on submit/update; admission select not transition-filtered; Help is a redirect.
- **Admin:** Thin entitlement; approve bypass; Payments `$` ledger; public chrome wrap; Province-only CMS filters.
- **Cross-role:** Authority model is strong; notification/email truth and invite delivery are not.
- **Operations:** Worker stopped; scraper cron risk; Redis fallback; no this-session health proof.
- **Future AI:** Read/suggest only; no tool registry or human-write gate.

---

## D. AUTHENTICATION MATRIX

| | Student | Employer | Agent | Institution | Admin |
|---|---|---|---|---|---|
| registration | PARTIAL | PARTIAL | PARTIAL | PARTIAL | NOT_REQUIRED |
| human challenge | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED | NOT_REQUIRED |
| email verification | READY (link) | MISSING | MISSING | MISSING | NOT_REQUIRED |
| EMAIL OTP | MISSING | MISSING | MISSING | MISSING | MISSING |
| phone capture | MISSING (schema only) | PARTIAL (free-text) | PARTIAL (post-register) | PARTIAL (post-register) | NOT_REQUIRED |
| SMS OTP | MISSING | MISSING | MISSING | MISSING | MISSING |
| WhatsApp OTP | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED |
| login | READY | PARTIAL (no suspend) | READY | READY | READY (User login) |
| forgot password | PARTIAL (untruthful if SMTP off) | PARTIAL | PARTIAL | PARTIAL | NOT_REQUIRED |
| reset | PARTIAL (false-success) | READY | READY | READY | N/A |
| step-up | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED | NOT_CONFIGURED |
| refresh | READY | READY | READY | READY | via User |
| logout | READY | READY | READY | READY | via User |
| logout-all | READY | READY | READY | READY | via User |
| connected accounts | NOT_CONFIGURED | MISSING (no panel) | NOT_CONFIGURED | NOT_CONFIGURED | MISSING |
| consent | READY | READY | READY | READY | MISSING on seed |
| status | PARTIAL | PARTIAL | PARTIAL | PARTIAL | READY (invite/seed) |

Cookies (names + flags only — **no values**):

| Realm | Prod name | Flags |
|---|---|---|
| user | `__Secure-strideto_user_rt` | HttpOnly, Secure (prod), SameSite=Lax, path `/api/auth/refresh-token` |
| employer | `__Secure-strideto_employer_rt` | same, path `/api/auth/employer/refresh-token` |
| agent | `__Secure-strideto_agent_rt` | path `/api/auth/agent/refresh-token` |
| institution | `__Secure-strideto_institution_rt` | path `/api/auth/institution/refresh-token` |

Access tokens: 15 minutes, **in-memory only**. Refresh: 7-day HttpOnly, rotated. No localStorage refresh token.

---

## E. FEATURE / SERVICE GAP MATRIX

Classification key: **MUST FIX** = before certification; **SHOULD ADD** = before public beta; **POST-LAUNCH**; **DO NOT ADD**.

### Public

| Existing | Partial | Missing | Before launch | Post-launch |
|---|---|---|---|---|
| Jobs/Internships/Programs catalogs with launch gate | Scholarships/Admissions/Schools/Foreign/Intl filters | Unified Apply/Reset on every catalog | Home→Intl URL; launch-safe empty states already present | Paid promo placements |
| Legal/Help/Sitemap/Footer | SEO PK job landings still routed | Search types for internship/program/agent | CountrySelect on remaining lists | Full i18n coverage |
| Agent directory + marketplace | Marketplace destination free-text | — | Honest empty catalogs | — |

### Student

| Existing | Partial | Missing | Before launch | Post-launch |
|---|---|---|---|---|
| Applications tracker (withdraw/notes only) | Dashboard recs (wrong inventory) | Dashboard NBA / eligibility | Launch-safe recs; reset honesty | Nav badges (pending apps, deadlines) |
| Journey next action + calendar | Dual Saved | Unified saved inventory | Point Documents widget at Vault or drop it | Merge saved stores |
| Vault, Consultations, Cases, Budget, Copilot fallback | Profile completeness | Email OTP | Link verify already exists | Phone OTP |
| Password change + consent + connected panel | Personalization not in nav | In-app security notifications | Surface eligibility or link it | Resume/AI scoring |

**Do not add:** Student write of employer/institution stages; fake matches; paid Copilot default.

### Employer

| Existing | Partial | Missing | Before launch | Post-launch |
|---|---|---|---|---|
| Dashboard counters (jobs, apps last 7d, interviews, quota remaining, verification) | Applications (job picker only) | Unread-app concept (does not exist — do not invent) | Full Admin entitlement snapshot + approve cap | Paid products |
| Guidelines handbook (18 topics) | Help (5 links) | Connected Accounts panel | Hide paid-draft UX; password policy; email verify or restricted session | Help prose (Guidelines suffice) |
| Team roles + last-owner + 7d invite | Invite email `not_configured` | Team counters on dashboard | Truthful invite copy | Persist expired invites |
| Plans & Usage (full snapshot) | Billing truthful empty | Promotional entitlement | Same authority on Admin review | Stripe |

**Useful counters already present (do not duplicate):** active/draft/pending/closed jobs, daily quota remaining, verification, unread notifications, interviews, last-7-day apps.

**Should add (actionable):** application status filter; interview job/date filter; pending team invites; quota chip on jobs list.

### Agent

| Existing | Partial | Missing | Before launch | Post-launch |
|---|---|---|---|---|
| Dashboard counts (leads, consults, cases, marketplace, messages, KYC) | Services country CSV | Lead display name | Replace CSV + raw lead id | Team invite counters |
| Marketplace pickers (service/program/country) | Help thin | Email verify | Register generic errors + password eye | Live OAuth |
| Availability IANA timezone | Commerce `not_configured` | SMS OTP | — | Payouts/KYC |

### Institution

| Existing | Partial | Missing | Before launch | Post-launch |
|---|---|---|---|---|
| Dual-gate **UI** + create asserts both | Submit/update skip verification | Intake count on dashboard | Close dual-gate hole | Intake edit/delete |
| Real admission pipeline + consented snapshot | UI offers illegal next states | — | Filter select to legal transitions | — |
| DQ, claim, team, usage, billing honesty | Help/Onboarding redirects | — | Keep redirects or one handbook | — |

### Admin

| Existing | Partial | Missing | Before launch | Post-launch |
|---|---|---|---|---|
| SC overview counters; verification/claims/trust/DQ/commerce/support/privacy | Job queues without Free/Paid column | Sidebar live badges | Entitlement snapshot + approve cap; relabel Admin Payments | Live queue badges |
| Announcements (scheduled publish disclosed) | Moderation vs editorial review split | Impersonation (**absent — keep**) | Do not add impersonation | — |

---

## F. END-TO-END PIPELINE MATRIX

### Employer

| Step | Status | Notes |
|---|---|---|
| register | PARTIAL | Consent yes; weak password; 409 enum; instant session |
| verify org | PASS | Server-authoritative; cannot self-approve |
| quota/entitlement | PASS (employer) / PARTIAL (admin view) | Same `loadEmployerPublishingUsage` |
| draft job | PASS | Drafts unlimited; do not consume quota |
| submit | PASS | Charges Free Beta; pending review |
| Admin sees Free/Paid snapshot | PARTIAL | Type badge only; no quota/payment |
| approve | BROKEN vs policy | No active-slot enforcement |
| public listing | PASS | `launchEligible` assigned on authority publish |
| Student applies | PASS | Internal tracked; external explicitly not |
| Employer pipeline | PASS | Intelligence/candidate detail; student cannot write stages |
| interview | PASS | List exists; filters thin |
| outcome | PASS | Authoritative employer states |
| paid / promotional | NOT_CONFIGURED | `paidPublishingEnabled: false`; no promotional entitlement type |

### Institution

| Step | Status | Notes |
|---|---|---|
| register | PARTIAL | Consent; no email verify; instant session |
| verify org | PASS | Dossier; cannot self-approve |
| canonical claim | PASS | Independent of verification |
| program create | PASS | Dual gate |
| program submit | PARTIAL | Claim only — **P0-3** |
| intake | PARTIAL | Add-only; requirements textarea |
| public discovery | PASS | Launch projection on public catalogs |
| Student application | PASS | Consented snapshot; not Vault |
| admission pipeline | PASS (server) / PARTIAL (UI states) | Illegal transitions 409 |

### Agent

| Step | Status | Notes |
|---|---|---|
| register | PARTIAL | Country select; no phone; 409 enum |
| profile | PASS | Country/Location/Phone pickers |
| verify | PASS | Cannot self-approve |
| service | PARTIAL | CSV countries |
| marketplace | PASS | Pickers; admin moderate |
| availability | PASS | IANA required |
| consultation | PASS | |
| case | PASS | |
| Vault grant/revoke | PASS | Client-granted; download owner-only |
| review | PASS | |
| commerce/payout | NOT_CONFIGURED | |

### Student

| Step | Status | Notes |
|---|---|---|
| register | PARTIAL | Consent + Turnstile stub; 409 enum; no phone |
| email verify | PASS (link) | Hashed, 30m, one-time, resend 5/hour; **no EMAIL OTP** |
| profile | PASS | Country/region/city cascade |
| save | PARTIAL | Unavailable stub for non-launch; dual saved pages |
| apply | PASS | |
| tracking | PASS | Withdraw/notes only |
| notification | PARTIAL | In-app yes; email queued ≠ delivered |
| Vault/consultation | PASS | |

---

## 2. PLATFORM ROUTE / SERVICE INVENTORY (condensed)

Status: **C** complete · **P** partial · **B** broken · **M** misleading · **R** redundant · **X** missing

### Public (MainLayout)

| Route | Purpose | API / authority | R/W | Status |
|---|---|---|---|---|
| `/` | Home / discovery | listings, CMS, search | R | P (Intl chips) |
| `/jobs`, `/jobs/:slug` | Job catalog/detail | `jobsController` + launch projection | R | C (17B) |
| `/internships` | Internship catalog | internships + launch | R | P (URL write) |
| `/scholarships`, `/admissions` | Catalogs | listings | R | P (filters/PK lists) |
| `/schools-and-colleges`, `/foreign-studies` | Institution/abroad | listings | R | P (province/country text) |
| `/international-scholarships` | Intl scholarships | listings | R | B vs Home query |
| `/programs` (Program Explorer) | Programs | explorer + Apply/Reset | R | C (17B) |
| `/tests`, `/exam-prep` | Tests / PK exams | content | R | P (PK-scoped) |
| `/agents`, `/marketplace` | Agent discovery | public agent APIs | R | P |
| `/search` | Global search | search (launch-gated) | R | P (type set) |
| `/blog`, legal, help, sitemap, support, contact | IA | CMS / static | R | C |
| `/auth/login|register|forgot|reset|verify-email` | Student auth | `authController` | W | P |
| `/employer/login|register|…` | Employer auth | employer auth | W | P |
| `/agent/login|register|…` | Agent auth | agent auth | W | P |
| `/jobs-in-*`, `/fpsc-jobs`, etc. | SEO landings | jobs | R | P (PK-named URLs remain) |

Empty/loading/error: Jobs/Programs/Scholarships/Admissions/Internships have launch-safe empty + retry after 17B. Intl/Schools/Foreign are thinner. Dark/light: shared tokens; date icons source-fixed, not visually re-proven. Nav: public `aria-current` + orange underline.

### Student (ProtectedRoute + MainLayout)

| Route | Purpose | Authority | R/W | Status |
|---|---|---|---|---|
| `/dashboard` | Career OS | DashboardComposition | R | P / M (recs) |
| `/profile` | Account/geo/password/connected | User profile | R/W | C |
| `/talent-profile` | Canonical talent | TalentProfile | R/W | C |
| `/applications` | Opportunity tracker | OpportunityApplication (student withdraw/notes) | R/W | C |
| `/applications/institution` | Institution apps | institutionAdmission (student withdraw / needs-info) | R/W | C (orphaned from nav) |
| `/journey/*` | NBA, tasks, calendar, saved | Journey services | R/W | C |
| `/vault` | Documents | VaultDocument (owner) | R/W | C |
| `/saved-jobs` | Saved jobs | saved + launch stub | R/W | P |
| `/notifications`, `/announcements` | Inbox | UserNotification | R | C |
| `/budget/*` | Cost planner | budget (no affordability claim) | R/W | C |
| `/copilot` | Guidance | Copilot `not_configured` | R | C |
| `/consultations`, `/cases`, `/trust-center` | Services | consultation/case | R/W | C |
| `/personalization` | Eligibility | scoring/eligibility | R | P (not in nav) |
| `/assessments` | Assessments | flag default OFF | R | NOT_CONFIGURED |
| `/resume-builder`, `/resume-analyzer` | Resume | mixed public/auth | R/W | P |
| `/privacy`, `/help/student`, `/messages` | Account/help | — | R | C |

### Employer (`/employer/*`, ProtectedEmployerRoute)

Dashboard, intelligence, jobs, post/edit, applications, pipeline, interviews, analytics, notifications, verification, plans, billing, team, settings, guidelines, help — all routed. See §5 and scorecard. **Settings: no Connected Accounts.** Help: thin.

### Agent (`/agent/*`)

Dashboard, onboarding (separate route), profile, services, marketplace CRUD, consultations, cases, trust, commerce, availability, verification, team, leads, clients, messages, notifications, usage-billing, guidelines, help, settings. Marketplace authoring uses pickers; Services/Leads do not.

### Institution (`/institution/*`)

Dashboard, onboarding→verification, profile, verification, claim, programs CRUD, intakes, applications, test-acceptance, scholarships, data-quality, team, notifications, usage, billing, settings, guidelines, help→guidelines. Dual-gate UI complete; submit/update server hole is P0-3.

### Admin (`/admin/*`, requireStaff + permissions)

Executive, moderation, review, audit, verification-queue, agent-marketplace, growth, AI job generator (templates), analytics, alerts, CMS content (jobs/scholarships/admissions/blogs/internships/universities/intl/foreign/career/companies/employers), notifications, announcements, ads, exam-prep, users, invitations, **payments (legacy $)**, import, search, site-cms, page-builder, media, forms, contact, institutions, webinars, platform-ops, newsletter, support, monitoring, SC overview/orgs/claims/trust/commerce/DQ/ai-ops/system, inbox, privacy-requests.

Moderator cannot approve orgs or open Commerce/DQ/Support/Privacy/Announcements — correct least privilege.

---

## 3–4. AUTH / OTP / SHELL (answers)

### Email OTP vs link

| Question | Answer |
|---|---|
| Is email OTP implemented? | **No.** Repo has no auth OTP/code challenge. |
| Is only a verification-link model implemented? | **Yes, User realm only.** SHA-256 at rest, 30 min, one-time, resend 5/hour, login gate for non-staff post-2026-07-26. |
| Challenges hashed? | Yes |
| Expiry / one-time / resend / resend RL? | Yes / Yes / Yes / Yes (resend). Verify endpoints themselves are **not** rate-limited. |
| Attempt count bounded on verify? | No |
| Replay? | Cleared on success |
| Cross-realm code? | N/A — token is User-only |
| Enumeration via register? | Yes (409) |
| Survive refresh? | Verify page is token-in-URL; session not required |
| `email_verified` server-authoritative? | Yes on User |
| Worker/email OFF? | Register truthful if SMTP missing. Auth mail can still send in-process. Forgot always claims a link will arrive. |
| UI truthful when delivery unavailable? | Register: yes. Forgot: no. |

**Classification:** EMAIL OTP is **not launch-required**. **Link-based verification is acceptable for launch** on Student. **B2B link verification (or restricted session) is launch-required** because those accounts can affect public jobs and official institution data.

OTP would reduce token-in-URL leakage (history/referrer) but does not fix SMTP-off lies or missing B2B verify. Do not add OTP friction until delivery is real.

### Phone OTP

Architecture exists only as `phoneCountry` / `phoneE164` / `phoneVerified` on User (never written) and `PhoneInput` on some post-register forms. Shared `phone.js` states SMS/WhatsApp verification is **not built**. Providers: **NOT_CONFIGURED**.

**Recommendation (least friction):**

- Registration: **do not require** phone or phone OTP.
- Capture E.164 optionally after register (Agent/Institution already closer).
- Require phone OTP later only for payouts/KYC/high-risk — when a provider is accepted.
- Never mark `phoneVerified` because a number was typed.

### Human / bot (Turnstile)

Default `not_configured`; secret backend-only; skip + rate limits remain. Widget does not actually run. B2B server middleware missing. No fake human-verified state.

### Login

Email + password only. No OTP on every login (correct). Silent refresh + rotation + realm cookies exist. Wrong-realm is collection-isolated. Logout / logout-all exist.

### Password recovery

Hashed 1-hour single-use link; session family revoke on success (when mutation reports increment). **Student success path is P0-1.** OTP would not materially improve launch security versus fixing the false-success and delivery honesty.

**Recommendation:** keep reset **link**; optional OTP later; do not require both.

### Step-up

Foundation only. Current password is the live factor for password change. Wire before email/phone/owner/payout changes. Do not duplicate per realm.

### Auth shell / blink

No shared `AuthLayout`. Student/Employer/Agent auth use `MainLayout` (full navbar/footer). Institution auth is **outside** MainLayout (logo only). Crossing `/institution/login` → `/terms` remounts public chrome.

Same-realm blink cause (source, not live render):

1. Per-route `lazy` + `Suspense` `PageFallback`
2. CMS `LoadingShell` on Terms/Privacy
3. First-paint AuthContext `loading`
4. Footer pulse until SiteContent resolves
5. Institution ↔ public layout remount

Navbar/sidebar are **not** keyed by pathname (good). Do **not** add `setTimeout` concealment.

---

## 5. EMPLOYER WORKFLOW (mandatory Free/Paid)

**Admin must not infer Free vs Paid from employer UI.** Current code does **not** read employer UI. It calls `loadEmployerPublishingUsage` — **same function** as Plans & Usage — then **throws away** quota/payment and keeps a type badge.

| Entitlement type | When | Launch |
|---|---|---|
| `free_quota` | Policy code set and paid off | Always, if load succeeds |
| `paid_product` | `paidPublishingEnabled` | Never (false) |
| `not_configured` | No employerId or load throw | Edge |
| `promotional` | **Does not exist** | Featured/sponsored are job flags, not entitlement |

**Employer Free/Paid Admin visibility:** PARTIAL — type/policy only; **not** quota remaining, rolling usage, payment amount/currency/provider/refund.

Guidelines: **COMPLETE**. Help: **THIN**. Team: server-authoritative roles; last owner protected; invite 7d; email `not_configured` (API truthful; confirm UI does not say “email sent”).

---

## 10. CONNECTED ACCOUNTS

| Provider | Class | Launch state |
|---|---|---|
| Google | LAUNCH AUTH PROVIDER (future) | NOT_CONFIGURED |
| Apple | LAUNCH AUTH PROVIDER (future) | NOT_CONFIGURED |
| Microsoft | LAUNCH AUTH PROVIDER (future) | NOT_CONFIGURED |
| GitHub | USEFUL PROFILE CONNECTION | NOT_CONFIGURED |
| LinkedIn | USEFUL PROFILE CONNECTION | NOT_CONFIGURED |
| Discord / Telegram | POST-LAUNCH community | NOT_CONFIGURED |
| Facebook / X | NOT RECOMMENDED until a concrete use case | NOT_CONFIGURED |

Panel on Student / Agent / Institution. **Employer Settings: MISSING panel.** No Connect buttons for unconfigured providers. Connection must never grant verification, canonical authority, Skill Trust, or Admin.

Do **not** integrate seven social platforms before certification.

---

## 11–14. DISCOVERY / FORMS / NAV / ONBOARDING

**Discovery:** Program Explorer Apply/Reset is the model. Jobs/Internships apply immediately (acceptable if documented; URL write-back missing). Intl Scholarships Home links are broken. No hidden PK default on Jobs/Profile cascade. Hardcoded PK remains on Employer JSON-LD and some SEO paths.

**Forms:** Shared date `color-scheme` + invert in `index.css`. Password eye on Student `PasswordInput` and `ChangePasswordForm`; Employer/Agent/Institution **register** still lack eye. `FormField.jsx` WIP will shake — leave uncommitted. Many admin fields still Province-only.

**Onboarding:** Agent/Institution stages are server-derived. Student `onboardingCompleted` is client-writable; Employer welcome is localStorage. Checklists should resume from server and stay dismissible without a modal storm.

---

## 15. NOTIFICATIONS / ANNOUNCEMENTS

In-app coverage is strong for verification, claims, jobs, applications, interviews, consultations, cases, commerce (rarely fires), announcements (dedupe keys).

Gaps: vault expiry, employer team invite in-app, password/security events. Email is queued; worker STOPPED ⇒ **not delivered**. Do not claim E2E email.

---

## 16. COMMERCE / ENTITLEMENT

Minor units + ISO currency on Commerce surfaces. Stripe OFF. No student wallet UI. Employer/Agent/Institution billing pages are truthful `not_configured`.

**Misleading:** `AdminPayments` `$` + `toFixed(2)` legacy `Payment` model. Relabel/hide before certification if staff might treat it as live revenue.

---

## 17. TRUST / PRIVACY / SECURITY (representative)

| Control | Verdict |
|---|---|
| Refresh / cookies / logout-all | READY (source) |
| RBAC / realm isolation | READY |
| Student vs Employer/Institution stages | READY |
| Vault owner + MIME/size | READY; grant download incomplete |
| XSS / URL sanitize | READY on audited HTML paths |
| NoSQL sanitize | READY |
| Mass assignment (commerce/auth) | READY |
| CSRF origin + CORS allowlist | READY (prod depends on env) |
| Rate limits | READY with Redis; memory fallback if Redis dies after boot |
| Secrets in client | Turnstile secret not bundled |
| Trust / claim / KYC independence | READY in product copy; P0-3 is the write-path hole |
| Financial authority | Client cannot mark paid |

No secrets printed. Cookie values not recorded.

---

## 18 / H. FUTURE PLATFORM BRAIN READINESS

**Do not build the agent now. Autopilot is forbidden.**

| Access | Score | What must exist first |
|---|---|---|
| READ | 7.5 | Already: session identity, launch projections, role-scoped reads, Copilot evidence packet, no Vault in copilot. Need: retrieval permission matrix + PII redaction. |
| SUGGESTION | 6.0 | Tool registry, role-scoped **read** tools, provenance, cost/rate cap, evaluation harness, injection defense (partial filters exist). |
| HUMAN-APPROVED WRITE | 2.5 | Write tools with human gate, action audit, idempotency, rollback, receipts, kill switch. **None of this is a product today.** |
| AUTOPILOT | 1.0 | All of the above plus policy engine, tenant/memory scope, confidence thresholds, override. **Not this release. Not 1–2 months unless control plane is built first.** |

AI must never verify orgs, approve claims/jobs, settle payments, change hiring states, grant Vault, or issue Trust.

**Future AI readiness score: 4.8 / 10** (architecture-aware, implementation-absent). Paid AI remains behind flags, default OFF (`docs/AI_BUDGET_POLICY.md`).

---

## 19–21. INTERNATIONAL / A11Y / SCALE

International: Profile/Jobs cascade and `coerceCountryCode` are the canon. Remaining PK assumptions: Employer JSON-LD, SEO job landings, Exam Prep naming, some scholarship country lists, chatbot “province” copy. Dates/timezones/currency contracts are not PKR/Karachi-defaulted in shared modules.

Accessibility/responsive: **not visually PASSed this audit** (no browser render). Source has focus-visible, `aria-current`, reserved min-height on new password/consent fields. 320–1440 / 200% zoom / dark date icons: **deferred visual**.

Scalability: list limits 50–100; indexes present; recs capped in 17B public path; dashboard recs still unbounded-by-projection (limit 20 active, not launch-filtered). Redis mandatory in prod for denylist. `KEYS` invalidation remains. No load test run.

---

## G. AUTH / OTP RECOMMENDATION (launch design)

**Minimum-friction secure launch:**

1. **Keep email+password login.** No OTP on every login.
2. **Keep hashed email verification link** for Student. Fix verify rate limit + delivery honesty.
3. **Do not implement EMAIL OTP for launch** unless link delivery is proven unreliable. Link is already hashed, single-use, 30 minutes.
4. **Add the same link verification (or restricted session) to Employer/Agent/Institution** before public beta — this is the high-value identity gap, not OTP theater.
5. **Phone OTP: post-launch.** Optional E.164 capture now; SMS vs WhatsApp only when a provider is accepted; fail closed; never fabricate “code sent”.
6. **Turnstile:** remain `not_configured` locally; implement a real widget **before** enabling the flag; attach server middleware to B2B register/forgot; keep rate limits.
7. **MFA/step-up:** current password for password change (done). Persist step-up grants; require them for email/phone/owner/payout later. Not for normal navigation.
8. **Recovery:** keep reset link; fix Student false-success; generic forgot; truthful not_configured/unavailable; revoke sessions on real reset.
9. **Consent:** already server-written on public register — keep; do not re-prompt every login.

---

## I. FINAL “10/10 GAP”

| Category | Current | Max after 17C (if tracks close) | What still prevents 10/10 |
|---|---:|---:|---|
| Security | 7.8 | 8.8 | Live Turnstile/email/SMS not proven; step-up in-memory; dependency CVEs; Redis fallback |
| Privacy | 8.2 | 8.6 | Vault grant download; invite tokens in API; no security-event inbox |
| Functionality | 7.6 | 8.6 | Empty launch catalogs; paid/promo off; B2B verify |
| UX | 7.3 | 8.4 | Visual a11y/responsive not proven; Help thin; filter inconsistency |
| Workflow | 7.3 | 8.5 | Approve cap + dual-gate + Admin snapshot |
| Accessibility | 7.2 | 8.2 | No this-session keyboard/zoom render |
| International | 7.3 | 8.4 | PK JSON-LD + SEO landings + leftover province fields |
| Stability | 7.6 | 8.4 | Auth→legal blink; Admin-in-MainLayout; no 5-route browser proof |
| Scalability | 7.0 | 7.8 | No load test; KEYS; memory fallback |
| Operations | 6.8 | 7.8 | Worker stopped; this-session health not re-proven |
| Trust | 8.4 | 9.0 | P0-3 submit hole; otherwise frozen model is sound |
| Commerce | 7.4 | 8.2 | Stripe off; Admin Payments legacy; paid publishing off (honest) |
| Evidence confidence | 7.4 | 8.2 | Source-heavy audit; Docker health not re-run here |

**Do not award 10/10.** Even a perfect 17C cannot 10.0 Operations or Commerce without live providers and production evidence.

---

## J. IMPLEMENTATION PLAN (DO NOT EXECUTE)

### 17C-1 Identity / security

- Student reset result handling; register generic errors; Employer `validatePassword` + suspend check; B2B email-link verify or restricted session; verify-email limiter; forgot delivery honesty; Turnstile widget (still default off); Employer Connected Accounts **panel only**; persist step-up store.
- Likely files: `authController.js`, `userSecureAuthFlows.js`, `employerAuthController.js`, `agentAuthController.js`, `institutionAuthController.js`, `auth.js`, `TurnstileField.jsx`, `EmployerRegister.jsx`, `EmployerSettings.jsx`, `stepUpAuth.js`, `emailVerification.js`.
- Tests: reset success/failure without token values; register non-enumeration; employer password policy; B2B verify gate; Turnstile skip vs enabled fail-closed.
- Runtime: no real email; disposable adapter only.
- Risk: **High** (auth).

### 17C-2 Employer / core-team workflows

- Full entitlement snapshot on Admin get-one + list column; approve/bulk-approve capacity; stop paid-draft UX; relabel Admin Payments.
- Files: `adminJobsController.js`, `AdminContentJobs.jsx`, `ModerationQueue.jsx`, `EmployerJobs.jsx`, `EmployerPostJob.jsx`, `employerPublishingQuota.js`, `AdminPayments.jsx`.
- Tests: approve 6th free job 409; snapshot fields; `isPaidDraft` vs `paidPublishingEnabled`.
- Risk: **High** (entitlement authority).

### 17C-3 Role dashboards / service gaps

- DashboardComposition launch projection; Home/Intl URL + CountrySelect; Institution `assertApprovedVerification` on submit/update; admission legal transitions; Agent services MultiSelect + lead labels; student nav links (personalization / institution apps) or dashboard NBA; Documents→Vault.
- Files: `DashboardCompositionService.js`, `Home.jsx`, `IntlScholarships.jsx`, `institutionPortalController.js`, `InstitutionApplications.jsx`, `AgentServices.jsx`, `AgentLeads.jsx`, `studentNavConfig.js`.
- Tests: recs never include `launchEligible !== true`; Home query applied; dual-gate 403 after revoke.
- Risk: **Medium**.

### 17C-4 UX / forms / navigation

- Shared auth shell/footer legal; Institution auth legal links; password eye on B2B register; filter URL write-back where Jobs/Internships already read; realm `aria-current` accent; do **not** commit FormField/Admin table WIP unless separately accepted.
- Files: auth pages, `MainLayout`, `index.css`, listing pages.
- Runtime: Chrome/Edge dark date icons; 320/375/768; Auth→Terms without timeout hacks.
- Risk: **Medium** (flicker regressions).

### 17C-5 Cross-role acceptance closure

- Invite copy vs `emailDelivery: 'not_configured'`; security/vault notifications (in-app only); scraper cron vs worker STOPPED; errorHandler `err.code` leak; PK JSON-LD.
- Tests: focused contracts + one health/jobs smoke after rebuild.
- Risk: **Low–medium**.

**Dependencies:** 17C-1 and 17C-2 can proceed in parallel. 17C-3 depends on launch projection helpers from 17B. 17C-5 last. No Phase 18 pack.

---

## Safety recap

- WIP files untouched by this audit (still locally modified).
- Protected/local-only files untouched.
- No commits, push, deploy, seed, delete, worker start, or live providers.
- No `docker compose down -v`.

---

## NEXT

Await user review and approval of this audit before any implementation.

**Phase 18: NOT STARTED.**
