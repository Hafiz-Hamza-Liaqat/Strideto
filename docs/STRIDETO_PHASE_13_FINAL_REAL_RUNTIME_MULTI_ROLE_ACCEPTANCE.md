# Strideto Phase 13 — Final Real-Runtime Multi-Role Acceptance

> **Status:** FROZEN  
> **Date:** 2026-08-12  
> **Baseline HEAD before this freeze:** `8e9fd27` (Phase 12)  
> **Runtime:** `https://localhost:8443` (SEC-3F local Caddy + staging compose)  
> **Authority:** Phases 0–12 remain FROZEN. This phase does not add features, redesign portals, activate live providers, deploy, push, or issue a GO/NO-GO launch verdict.

## Scope

Phase 13 owns final real-runtime acceptance: public/guest, all role journeys, cross-role chains, commerce simulation, notifications, privacy/authority, sessions, responsive/theme/international spots, persistence, system readiness, evidence consolidation, and release-blocker classification.

It does **not** own new navigation, pricing, live Stripe/email/SMS/push, scraping, n8n, new AI, or Mission 27 certification (Phase 14).

## Safety

No push. No deployment. Worker remained STOPPED. Protected volumes were not deleted, pruned, or reseeded:

- `edurozgaar-staging_mongodb_data`
- `edurozgaar-staging_redis_data`
- `edurozgaar-staging_media_uploads`

Protected/local-only untracked files were not touched. Pre-existing AdminTableFilters WIP was path-stash isolated (`stash@{0}: wip: AdminTableFilters values wiring (pre-phase-13)`) and restored unstaged after freeze. No `-u`. No `.env` values printed.

Disposable accounts used `example.com` addresses. Preserved Student (`p11.ui.*`) was used for safe browser read checks only.

---

## 1. Runtime source match

Expected committed HEAD at start: `8e9fd27` on `main` (Phase 12 freeze docs). App images were Phase 12 `9fa57ca` plus that docs-only HEAD.

One source defect required a rebuild of **api-a** and **api-b only** (no `down`, Mongo/Redis/media/Mailpit/Caddy preserved, worker not started). Frontend image unchanged.

Final containers:

| Service | Status |
|---|---|
| frontend | healthy |
| api-a | healthy (rebuilt for claim-approve fix) |
| api-b | healthy (rebuilt for claim-approve fix) |
| Mongo | healthy |
| Redis | healthy |
| Mailpit | healthy |
| Caddy | serving `https://localhost:8443` |
| worker | absent / stopped |

`GET /api/health` → `ok`, mongo `up`, redis `up`. `GET /api/health/ready` → 200. Worker queue showed pending notification/email jobs with processing 0 (worker stopped; truthful). SMTP reported configured/live while worker is stopped — emails queue, they are not sent.

---

## 2. Public / guest

Browser + live HTTPS (no mocked UI):

| Route | Result |
|---|---|
| Home | 200, eight FINAL_NAV_LABELS in Open menu, no `#student-workspace-nav`, no `localhost:8080` |
| Jobs | listing present, overflowX 0 at 320 |
| Job Detail (`/jobs/fron-dest-operator-lahore`) | openings **Not specified** (legacy), external apply, personal tracker label, source/authority Employer-posted, overflowX 0 |
| Internships | 200, empty-state truthful, no guarantee wording |
| Scholarships | 200, h1 Scholarships, overflowX 0 |
| Admissions | 200, official Institution intakes, date-only deadline `2026-06-30` |
| Program Explorer | 200, source-backed copy |
| Tests & Prep (`/exam-prep`) | 200 |
| Services | 200, real discovery services only |
| Agents | 200, **only approved** orgs; Unicode name `پروفیشنل`; P13 Chain Agent appeared after Admin approval |
| Help | canonical `/help-center` 200 (bare `/help` is client NotFound — footer uses Help Center) |
| Sitemap | 200, public vs portal-entry distinction |
| Legal | `/privacy`, `/terms` 200 HTML, no 8080 |
| 404 | `/this-route-does-not-exist-p13` client **Page not found** (SPA HTML 200) |
| `/robots.txt` `/sitemap.xml` | 200, no 8080 |

Logged-in public Home still hides Student workspace nav; Account + Dashboard shortcut remain (Phase 11 public shell).

---

## 3. Student

Preserved P11 Student browser: login persisted across reload, Dashboard **Student portal** nav (Dashboard, Talent Profile, My Applications, Journey, Vault, Notifications), Workspace overflow, Account menu with Appearance System/Light/Dark, Language EN/UR (AR disabled), Student Help, **Logout**. Unicode display name rendered. overflowX 0 at 320 and 1440. Dark class consistent.

Disposable P13 Student (API):

- `PATCH /api/auth/profile` name+province persist; `GET /api/auth/me` 200
- Applications: internal apply 201; OpportunityApplication external tracker 201 (`applicationChannel` / personal tracker)
- Employer stage PATCH as Student → **401** `Employer authentication required`
- Copilot `GET /api/copilot/status` 200, provider `not_configured`
- Budget plans 200; timeline/saved 200; vault create/list 200
- Inbox 200, mark-read / mark-all-read 200
- Privacy overview 200; export 201; deletion without confirm **422**; with `confirm:true` **201** `requested`
- Logout then `/api/auth/me` **401**

---

## 4. Employer

- Login/reload cookies: `__Secure-strideto_employer_rt` HttpOnly + Secure + SameSite=Lax
- Dashboard/me/team/usage/billing 200
- Draft job: `applyType=internal`, `openingsCount=2`, `quotaConsumed=false`
- Activate before verification/profile completeness → 403 (eligibility fail-closed)
- After Admin org verification + profile fields: activate **quotaConsumed=true**
- Admin job approve → Student apply 201 → Employer applications count 1 → shortlist/interview 200
- Foreign employer applications for that job → **404** Job not found
- Billing provider surface present; paid checkout → **503** `Payment gateway not configured` (truthful, not a fake paid)
- Browser leftover P4 employer session: Dashboard metrics sourced, conversion `n/a`, verification `draft`, overflowX 0 at 375, dark shell
- Logout → `/api/employer/me` **401**

---

## 5. Agent / Agency

- Login 200; professional `agentType` (not agency)
- Dashboard/profile/verification/services/leads/clients/cases/messages/team/usage-billing 200
- `GET /api/agent/reviews|reports|disputes` 200 (Trust Center APIs)
- Self-approve Admin verification as Agent → **401** Authentication required (fail closed, no self-approval)
- Submit → Admin needs_information → respond → approve **approved**
- Public `/agents` then listed P13 Chain Agent (projection after approval)
- Maps are not verification authority (existing Mission 2; Google Maps evidence supporting-only)
- Free service + availability timezone **Asia/Karachi** (explicit IANA, not a silent fallback)
- Consultation create `paymentState=free`, confirm 200
- Commerce readiness 200; simulation connect `liveProviderCalled: false`
- Logout → `/api/auth/agent/me` **401**

---

## 6. Institution

- Login 200; dashboard/profile patch 200
- Verification submit → Admin approve **approved** (independent of claim)
- Claim start draft → submit → Admin begin_review → approve **approved**
- Programs list after claim; program create 201
- Intake date-only `YYYY-MM-DD` (open/deadline/start)
- Internal intake `applicationMode=internal` → Student apply 201 `received` → Institution inbox count 1 → `under_review` 200
- Student PATCH institution application status → **401** Institution authentication required (cannot self-admit)
- Student GET institution applications → **401**
- Institution vault/students → **403** no Student Vault / private Student access
- Copilot as Institution → **401**
- Test-acceptance / scholarships / data-conflicts / team / usage-billing 200
- Billing remains launch Free / not live paid
- Logout → `/api/auth/institution/me` **401**

---

## 7. Admin / Staff

Disposable SuperAdmin (emailVerified + role via additive mongosh, not a reseed):

- Overview, organizations, verification queue, trust/reports, AI status, system/readiness, privacy-requests, contact-messages, audit-logs, inbox 200
- No raw i18n keys observed on Insufficient-permissions public shell
- Student hitting `/api/admin/overview` → **403** Staff access required
- Browser `/admin` as non-staff → **Insufficient permissions** (fail closed, not an auth-loop)
- Readiness components present (`generatedAt`, `components`, `queues`, `ai`); worker not claimed running
- Financial secrets absent from JSON keys sampled

---

## 8–13. Cross-role chains

| Chain | Result |
|---|---|
| Hiring | Draft no quota → verify → activate quota=true → Student apply → Employer sees row → shortlist/interview → Student cannot set Employer state |
| Employer verification | submit → queue → begin-review → needs_information → respond → approve; hiring eligibility overlay after approved |
| Agent verification | submit → needs_information → respond → approve; no self-approval; public directory updates |
| Professional service | free consultation (IANA tz) → complete → case propose → Student accept `active` → private agent note not in Student notes → document request → exact Vault grant → Agent `access: granted` → revoke → **403** → Agent direct `/vault/documents/:id` **401**. Case relationship alone was **404** before share |
| Institution admission | verified + claimed program + internal intake + consent → received → under_review; Student cannot self-admit; Vault/Copilot denied |
| Canonical claim | claim independent of org verification; approve now creates CanonicalInstitution with explicit `officialName` + `institutionType` (fix below); competing approved claim still 409 in source |
| Account privacy request | export 201; deletion confirm 201 `requested`; Admin privacy list 200 |

---

## 14. Commerce (simulated only)

- Configuration: `state: not_configured`, `simulation.available: true`, `liveProvider: false`
- Client mass-assign `{paid:true}` → **400** `Client cannot set payment authority fields`
- Free consultation → no order (`paymentState=free`)
- Fixed-price service order 201 `paid: false` / `pending_payment`
- Simulated success 200 `liveProviderCalled: false`; replay 200 (duplicate ignored by simulation/idempotency)
- Simulated failure 200 on second order
- Employer paid checkout 503 not_configured (no live Stripe)
- Agent KYC/payout: simulation connect 201 `liveProviderCalled: false`; readiness truthful, not fabricated paid-out

---

## 15. Notifications

Inbox `/api/inbox/notifications` (realm-agnostic `requireAuth`) 200 for Student, Employer, Agent, Institution, Admin. Unread-count, mark-read, mark-all-read 200. Worker stopped — notifications persist as records; email/push not sent. Deep-link destinations still re-authorize (wrong realm 401/403). No reviewer private notes or secrets in sampled payloads.

---

## 16. Privacy / authority

| Attempt | Result |
|---|---|
| Student → Admin | 403 Staff access required |
| Employer → Vault | 403 Employer account cannot access this resource |
| Agent → Vault documents | 401 Authentication required |
| Institution → Vault/students | 403 membership does not grant Student Vault |
| Institution → Copilot | 401 |
| Employer → Agent dashboard | 401 Agent authentication required |
| Employer A → Employer B job applications | 404 |
| Student → Institution application status | 401 |
| Browser `/admin` as non-staff | Insufficient permissions |

Wrong realm fail-closed. No universal Admin Student/Vault/Copilot/Budget browse in sampled Admin APIs.

---

## 17. Sessions / security

Student, Employer, Agent, Institution, Admin: login 200 → protected 200 → logout → protected 401. Refresh cookies HttpOnly+Secure+SameSite=Lax; names `__Secure-strideto_{user,employer,agent,institution}_rt`. Cookie values not printed. No localStorage refresh token introduced by this phase. Rate-limit: 401×5 then **429** Retry-After 60 on failed login (limiter not weakened).

---

## 18. Failure UX

Sampled 401/403/404/409/422/429/503 render as JSON errors or safe pages (Insufficient permissions, Page not found, deletion confirmation required). No blank error-boundary catastrophe on sampled routes. 503 checkout is provider-not-configured, not an unhandled crash.

---

## 19–21. Responsive / theme / international

| Viewport | Sample | overflowX |
|---|---|---|
| 320 | Home menu, Jobs, Job Detail, Dashboard | 0 |
| 375 | Employer Dashboard | 0 |
| 768 | Student Dashboard | 0 |
| 1024 @ 200% | Admin insufficient-permissions | 0 |
| 1440 | Student Dashboard | 0 |

Navigation usable; Logout reachable in Account menu at 320. Known dense-grid internal scrolling acceptable.

Theme: `html.dark` on public, Student, Employer samples; Account Appearance Dark pressed; Light/System present. No mixed-theme severe defects on sampled Phase-11 pages.

International: Unicode Student/Agent names render; Urdu control present; Arabic disabled; Money PKR explicit on Job Detail; intake dates date-only; consultation timezone `Asia/Karachi` explicit; no implicit FX.

---

## 22–24. Trust, persistence, readiness

Public job source/authority labels truthful. Agent directory only after approval. Institution intakes labeled Official Institution source. Persistence: Student name/province, Employer profile/job, Agent service/availability, Institution profile/program survive logout/login via re-login reads. System Readiness Admin 200; worker stopped; payment not_configured; no production-provider claim.

---

## Defect found and fixed (P0)

**Canonical claim Admin approve crashed api-b.** `CanonicalInstitution.create({ ...claim.proposedCanonical })` spread a Mongoose subdocument, so `officialName` and required `institutionType` were missing. Unhandled `ValidationError` killed the replica (cascading Caddy **502**s).

Fix in `server/src/routes/institutionPortal.js`:

- Map `officialName` / `institutionType` (taxonomy fallback `university`) explicitly
- Wrap Admin institution claim/conflict handlers in `asyncHandler` so validation cannot take down a replica

Rebuilt api-a/api-b only. Re-ran claim approve → **200 approved**, then program create 201. Zero unexpected 5xx on the rerun.

---

## Actual findings

| Sev | Item | Disposition |
|---|---|---|
| P0 | Claim approve replica crash | **Fixed** |
| MINOR | Employer activate 403 message always says verification required even when the blocker is incomplete profile | Recorded; eligibility still fail-closed |
| MINOR | `/help` SPA 404; canonical Help Center is `/help-center` | Recorded; footer is correct |
| INFO | Employer paid checkout 503 not_configured | Truthful failure |
| INFO | Phase 12 deferred: frontend HTML CSP P2, browserslist, chunk size, npm audit, external monitoring not_configured | Not release-blocking in this runtime |
| INFO | Competing second canonical claim not newly raced this session; 409 path remains in source | Phase 6 frozen |

---

## Phase 14 operational items (not this freeze)

- Mission 27 launch certification / GO/NO-GO
- Production provider wiring (Stripe live, real email worker, monitoring)
- Frontend HTML CSP deployment limitation
- npm audit / browserslist churn
- Production backup/restore drill on real hosts

---

## Tests

- `node server/src/__tests__/phase13FinalRuntimeAcceptance.test.js` — focused source contracts for the claim-approve fix, eligibility overlay, inbox realm gate, payment mass-assignment rejection
- Live evidence: `agent-tools/phase13-runtime.mjs`, `phase13-chains.mjs`, `phase13-chains2.mjs`, `phase13-chains3.mjs`, `phase13-chains4.mjs`, admission/case/vault scripts against `https://localhost:8443`
- Frozen suites were **not** re-run in full
- Frontend production build not re-run (frontend source unchanged)

---

## Freeze gate

Public, Student, Employer, Agent, Institution, Admin, cross-role hiring/verification/service/admission/canonical, commerce simulation, notifications, privacy, sessions, responsive spots, persistence, and operations all have real-runtime evidence. Unresolved BLOCKER/P0/P1: **none**. Unresolved security/privacy/financial MAJOR: **none**. Unresolved frozen-contract MAJOR: **none**.

**Phase 13 status: FROZEN**
