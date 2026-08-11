# Strideto Phase 4 — Employer Final Portal

> **Status:** FROZEN (Modification Phase 4)  
> **Baseline after Phase 3 freeze:** `891b8b6`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0:** FROZEN · **Phase 1:** FROZEN · **Phase 2:** FROZEN · **Phase 3:** FROZEN  
> **This freeze owns:** Employer / hiring portal  
> **Later phases** may integrate Agent, Institution, Public Job Detail, and Commerce through these contracts. They may not redesign Employer.

Runtime accepted at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy, worker **stopped**).

Phases 0–3 were not redesigned. Student portal, Admin portal, Agent/Institution, public `/jobs` cards, Job Detail, global navbar labels, sitemap, License, live Stripe, live email, and AI/n8n job fetching are out of scope.

---

## Final Employer navigation

Capability-filtered sidebar (`client/src/config/employerNavConfig.js`). Empty capabilities fail-open on first paint so the menu is not blank before `/employer/me`.

| Area | Route | Decision |
|---|---|---|
| Dashboard | `/employer` | Existing dashboard, server-derived cards |
| Hiring Intelligence | `/employer/intelligence` | Existing Intelligence surface; hidden if flag off |
| My Job Posts | `/employer/jobs` | Filters: all / draft / pending / active / closed |
| Post New Job | `/employer/jobs/new` | Authoring; edit at `/employer/jobs/:id/edit` |
| Applications | `/employer/applications` | Internal applications only |
| Candidate Pipeline | `/employer/intelligence/pipeline` | **Deep link** — not a second pipeline |
| Interviews | `/employer/interviews` | List + deep link into candidate scheduler |
| Analytics | `/employer/analytics` | Per-job truthful metrics |
| Notifications | `/employer/notifications` | Phase 1 inbox (`recipientType=employer`) |
| Verification | `/employer/verification` | Org evidence + Admin queue |
| Plans & Usage | `/employer/plans` | Free-policy snapshot |
| Billing / Payments | `/employer/billing` | Existing Commerce read model |
| Hiring Guidelines | `/employer/guidelines` | Everyday usage, not Terms |
| Organization / Team | `/employer/team` | Membership + invitations |
| Settings / Security | `/employer/settings` | Profile, password, logout-all |
| Help | `/employer/help` | Short pointers into Guidelines |

**Pipeline / Interviews:** both already existed under Intelligence / candidate detail. Phase 4 added top-level nav that deep-links; no duplicate state machine.

Public `/employer/post-job` is **not** the Employer authoring route (legacy public submit). Employer Post Job is `/employer/jobs/new`.

Invitation accept is public-auth: `/employer/accept-invitation`.

---

## Organization / team

Employer realm remains email/password. `requireEmployerAuth` lazily ensures an `Organization` + Owner `EmployerMembership`. Hiring queries use `hiringOwnerId` (`Organization.legacyEmployerId`).

| Role | Authority |
|---|---|
| Owner | Org, team, verification submit, jobs, applications, billing/usage |
| Admin | Org ops, jobs, candidates, team except ownership-sensitive actions, verification submit |
| Recruiter | Jobs, applications, pipeline, interviews. No billing / verification / team |
| Viewer | Read-only hiring visibility |

Server-derived capabilities (`shared/employer/team.js`). No client-supplied role/org authority.

Invites: hashed token, 7-day TTL, pending unique per org+email, roles admin/recruiter/viewer only. Email delivery is `not_configured` (worker stopped, no real email). Duplicate invite → `409 DUPLICATE_INVITE`. Expired → `410`. Revoked → `409`. Last owner cannot leave/demote → `409 LAST_OWNER_PROTECTED`. Cross-org join while owning hiring data → `409 CROSS_ORGANIZATION_DENIED`.

Runtime: invite 201, duplicate 409, accept recruiter, recruiter billing 403, recruiter jobs 200 (shared hiring owner), last owner 409, foreign job 404, foreign verification 403.

---

## Verification

Integrates Mission 2 / Phase 2 Admin queue. Employer cannot self-approve: submit always goes `verification_pending`. `draft` is marked `email_verified` first (login email, not SMTP proof) so `draft → pending` is not used.

Dossier fields: legal/display name, org type, country, registered address/city/region, website/domain, official email/phone, registration authority/number, license where applicable, representative name/role/authority, supporting evidence refs. Google Maps is supporting evidence only.

Object `authorizedRepresentative` is coerced to the canonical string profile field (schema is string). Ordinary User/Student tokens cannot read another org’s dossier (staff roles only for support bypass).

Admin outcomes (`approved` / `rejected` / `suspended` / `revoked` / `expired`) mirror onto `Employer.verified` + `verificationLevel` for free-job eligibility. Quota overlay also reads OrganizationVerification status so eligibility is org-authoritative.

Runtime: incomplete 422; submit with `status:approved` still `verification_pending`; evidence 201; Admin begin-review → needs_information → respond → approve `approved`. Activate before approve `403 EMPLOYER_NOT_ELIGIBLE`. Activate after approve consumes quota.

---

## Dashboard

Existing card design preserved. Metrics from `computeEmployerDashboardMetrics` plus:

- `verificationState`
- `unreadNotifications`
- `planSummary` (daily/rolling/active-free remaining, drafts)

Conversion is `n/a` when views are 0 (no fake denominator). External jobs never inflate internal application counts. Cards deep-link.

---

## Jobs / openings / drafts / quota

Canonical `openingsCount`: integer 1–10,000, required on new Employer jobs. UI label **Number of openings**. Legacy missing → “Not specified”; no auto-mutation of `totalSeats`.

Private drafts do **not** consume quota (`quotaConsumed: false`; `onJobSubmitted` moved to activate). Activate/submit is authoritative. Client cannot set approved/published/paid/verified/quota override.

Free Beta policy preserved:

- unlimited private drafts
- verified organization: 1 free submission / 24h
- max 5 active free jobs
- max 10 free submissions / rolling 30 days
- approved free job visible up to 30 days
- major edit/reopen/repost may consume quota again per accepted policy

Runtime: draft openings 2 → edit 3; usage `drafts=1 dailyUsed=0`; after activate `dailyUsed=1 remaining=0` with `nextReset`. Openings 0 / float / 10001 → 400.

**Internal vs external:** `applyType` explicit. External applications `applicationsTracked=false`, `submittedApplicationsCount=null`. Student personal tracker is not Employer pipeline state.

---

## Applications / pipeline / Skill Trust

Employer-authoritative internal states (legacy): `shortlisted`, `rejected`, `interview`, `hired` (plus Intelligence 13-stage machine). Student cannot write these (`STUDENT_CANNOT_SET_EMPLOYER_STATE`). Applicant snapshot immutable. Skill Trust: **CLAIMED ≠ EVIDENCE_BACKED ≠ VERIFIED**. Employer cannot verify, score, or badge. Evidence URLs only via accepted safe projection.

Pipeline: existing Intelligence transition (`POST .../candidates/:id/stage`), concurrency no-op on same stage, Student notification on change, audit via stage history. Invalid stage 400. Foreign candidate 404.

Runtime: disposable Student applied to activated internal job; Employer screening 200; Student `hired` denied; Skill Trust panel preserved.

---

## Interviews

Existing Intelligence scheduler. List at `/employer/interviews`. IANA `timeZone` required when stated (no silent Karachi fallback). Ownership isolated. Recruiter notes on complete/cancel are not Student-visible unless candidate-facing fields are set.

Runtime: schedule `Europe/Berlin`, reschedule, complete `outcome=cancelled`. Student in-app notifications unread=4 (worker stopped; no real email).

---

## Analytics

Tracked: views, internal applications, pipeline distribution where data exists. External: `applicationsTracked=false`, conversion `n/a`. Cross-job/org isolation via hiring owner.

---

## Hiring Intelligence

Existing deterministic surface. No AI applicant verification, no protected-trait inference, no autonomous hire. Insights must remain labelled as platform metric / system recommendation / AI insight (AI remains budget-gated OFF).

---

## Plans & Usage / Billing

`GET /employer/plans/usage` — policy, verification requirement, drafts (unlimited, cost 0), active free, daily/rolling remaining, next reset, pending review, blockers, `consumesQuotaOn` explanation.

`GET /employer/billing` — Commerce orders/transactions/refunds. Runtime `provider.state=not_configured`. No PAN/CVV/secrets. No homemade escrow. Pricing not invented. Phase 9 owns live Commerce finalization.

---

## Guidelines / settings / privacy

Guidelines cover verification, free/draft/quota rules, openings, internal vs external, pipeline authority, interviews, payments/refunds, prohibited listings, applicant privacy, Skill Trust. Settings: org profile, team/verification/billing links, password, logout-all. No raw tokens. Phase 1 security (HttpOnly refresh, in-memory access token).

Search/filter/sort/pagination bounded (`q` 200 chars, escaped regex, `INVALID_SORT` 400, page ≥ 1). Isolation: no foreign jobs/candidates, no Vault, no Agent notes, no Student Budget/Copilot, no payment secrets, no Admin reviewer internals on Employer GET.

---

## Responsive / accessibility

Phase 1 semantic tokens (`bg-bg-main`, `dark:`). High-risk pages checked at 320 / 375 / 768 / 1024 / 1440: **0 horizontal overflow**, mobile menu present at 320/375, `min-h-[44px]` controls, labels/errors, status text, loading/empty. Light/dark classes on layout and settings. 200% zoom: authenticated 320–1440 already fit; a later CSS-zoom pass hit login because of 15m token expiry + `429` auth limiter (INFO). No WCAG certification claim.

---

## Executable evidence

`server/src/__tests__/phase4EmployerPortal.test.js`: **127 checks passed**.

Regressions (touched dependencies only):

| Suite | Result |
|---|---|
| Phase 1 foundation | 53 |
| Phase 2 Admin | 100 |
| Phase 3 Student | 62 |
| organizationVerificationFoundation | 17 |
| employerSubmissionEligibility | passed |
| employerPostJobValidation | passed |
| employerDashboardMetrics | 20 |
| employerHireMethodSelector | 63 |
| applicantSkillClaimVerification | 39/39 |
| skillTrustNotificationsQA | 34 |
| employerInterviewTimezoneIdentity | 83 |
| employerInterviewWriteIntegrity | 109 |
| candidateInterviewOwnership | 33 |
| employerPipelineTransitionNotification | 41 |
| employerApplicationAuthz | passed |
| commerceFoundationMission16 | 41 |
| mission23PlatformSecurityAbuseAudit | 37 |
| authRealm | passed |

Module-graph import of `shared/employer/*` + quota: ok. Focused eslint: server clean; client remaining `EmployerAuthContext` react-refresh warning (pre-existing). Vite build: ok (~27s).

---

## Real Docker evidence

Worker not running. Unexpected HTTP 5xx on disposable journey: **0** (invalid membership id now 404, not CastError 500).

Journey: register Employer → me owner+org → reload persist → profile → dashboard → verification submit pending (self-approve ignored) → draft job quota 0 → openings edit → activate blocked unverified → external tracked=false → team invite/accept/recruiter isolation → Admin queue needs_information/resubmit/approve → activate quota consumed → Student apply → candidate/Skill Trust → pipeline → interview IANA → analytics n/a when untracked → billing not_configured → logout/login jobs persist.

Browser: register → dashboard (conversion n/a, verification draft, deep-link cards) → all IA routes rendered with headings → 320–1440 overflow 0.

---

## Deferred (later phases)

- Phase 5 Agent / Agency portal
- Phase 6 Institution
- Phase 7 Public Job cards / Job Detail
- Phase 9 live Stripe / paid activation UX
- Real email/SMS/push (worker remains stopped)
- AI/n8n job fetching (budget policy OFF)

---

## Freeze gate

All Employer freeze-gate items in the Phase 4 brief passed with zero unresolved BLOCKER / P0 / P1 / Employer auth-privacy-financial-trust MAJOR.

**EMPLOYER is FROZEN.**
