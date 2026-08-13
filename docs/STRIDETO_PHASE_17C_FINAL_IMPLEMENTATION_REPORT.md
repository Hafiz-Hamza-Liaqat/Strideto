# STRIDETO PHASE 17C — FINAL IMPLEMENTATION REPORT

**Mode:** IMPLEMENTATION + FOCUSED VERIFICATION  
**Date:** 2026-08-13  
**Phase 18:** NOT STARTED  
**Certification:** NOT RUN  
**Push:** NO  
**Deployment:** NO  

This is not Phase 18 certification and not USER MANUAL ACCEPTANCE.

---

## Baseline

| Item | Value |
|---|---|
| Starting HEAD | `34df91f5267d1c1c30f44de5d6a78e7f6b3dbbf7` |
| Branch | `main` |
| Authoritative audit | `docs/STRIDETO_PHASE_17C_FINAL_PRE_CERTIFICATION_GAP_AUDIT.md` |
| Ending HEAD (before this docs commit) | `bf9a09a130b93357ed40d0a0979f12139f05dbfa` |

### WIP isolation

Path-scoped tracked stash `phase17c-isolate-known-wip` was used (never `git stash -u`).

Isolated then restored exactly:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Preserved older stash (untouched):

- `stash@{0}` after restore: `wip: AdminTableFilters values wiring (pre-phase-10)`

Protected/local-only files were never staged or rewritten:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

### Worker

`edurozgaar-staging-worker-1` remained **STOPPED** (`Exited (0) 9 days ago`) for the entire mission.

---

## 17C-1A Launch Authority

Commit: `001fff28395c00b021ca9de3f0ac1e4b0520dd9e`  
`fix(authority): close phase 17c launch-critical authority gaps`

### P0-1 Student password reset truth

**Root cause:** `resetPassword` returned success when a matching challenge existed, without requiring the authoritative password mutation result.

**Implementation:** Success requires the canonical `PASSWORD_RESET` / version-incremented result. Mutation failure returns a generic 400. Session-family revocation runs only after a genuine reset. Tokens remain hashed, expiring, single-use, and are not logged or returned.

**Tests:** `phase17cAuthority.test.js` + updated user secure-auth flow contracts.

**Result:** Closed. Source-proven and test-proven.

### P0-2 Employer Free Beta approval capacity

**Root cause:** Admin approve/bulk-approve could activate a sixth Free Beta job because capacity was not checked at the authoritative activation write.

**Implementation:** `assertActiveFreeApprovalAllowed` uses the same `loadEmployerPublishingUsage` authority as Employer Plans & Usage. Check happens before activation. Exhausted capacity returns controlled 409 with `ACTIVE_LIMIT_REACHED_AT_APPROVAL`. Drafts do not consume active capacity. `paidPublishingEnabled` OFF cannot be treated as paid. Bulk approval skips/rejects records that would exceed remaining slots.

**Tests:** 4 active + approve pass; 5 active + approve 409; bulk cannot exceed limit; usage source shared.

**Result:** Closed. Source-proven and test-proven. Concurrent last-slot race uses the existing quota assertion on the write path; no new distributed lock layer was invented.

### P0-3 Institution dual-gate

**Root cause:** `createProgram` required approved verification **and** approved canonical claim; update/submit and other official writes did not consistently require both.

**Implementation:** `assertOfficialInstitutionWrite` is applied to official Institution program mutation paths. Verification revoked/suspended/expired/rejected locks official writes even if the claim remains approved. Claim not approved locks writes even if verification is approved. Controlled reason codes are returned.

**Tests:** both approved → allowed; either missing → denied; create/update/submit share the rule.

**Result:** Closed. Source-proven and test-proven.

### P0-4 Student dashboard launch-safe recommendations

**Root cause:** `DashboardCompositionService` queried `Job.find({ status: 'active' })` (and similar) without launch projection.

**Implementation:** Recommendation sources use the same `withFixtureExclusion` / `launchEligible === true` projection as public `/jobs`. No fixture fallback. Queries remain capped.

**Tests:** fixture and `launchEligible=false` excluded; eligible included; empty catalog stays truthful.

**Result:** Closed. Source-proven and test-proven.

---

## 17C-1B Identity / Security

Commit: `f2b020c483416bd80093c0706d0dd5c622f6c008`  
`fix(identity): close phase 17c authentication and account-security gaps`

### Auth changes

- Four-realm registration returns a generic 201 payload. Known and unknown emails are not an existence oracle. Duplicate accounts are not created.
- Employer uses the canonical password validator (8–128, shared complexity). Shared `PasswordInput` on B2B register.
- Employer login denies `accountStatus === suspended` with controlled 403 and no refresh session.
- Forgot-password remains non-enumerating. User-facing copy follows `authDeliveryMode()` (`accepted` / `delivery_unavailable` / `queued_worker_stopped`). This environment is `queued_worker_stopped`; no live email was sent.

### B2B email verification

Reuses the Student hashed-link model (`realmEmailVerification.js`):

- server-generated token, hashed at rest, ~30-minute expiry, one-time use
- realm-scoped consume (Employer token cannot verify Agent, etc.)
- bounded resend + `verifyEmailLimiter`
- `B2B_EMAIL_VERIFY_ENFORCE_FROM` default `2026-08-13` (grandfather older accounts)
- register does **not** issue a session; login may issue a restricted session

### Restricted workspace

Server gates (UI is explanatory only):

- Employer: job submit/activate/checkout and paid/financial actions
- Agent: verification submit, marketplace publication/activation, commerce/payout
- Institution: org verification, canonical claim, official program/scholarship/requirement writes

Harmless profile drafts remain allowed.

### Turnstile

Ready but **NOT_CONFIGURED / disabled** here.

- Client loads the official Cloudflare widget only when enabled; site key only
- Server verifies when enabled; fail-closed if enabled and token missing
- Disabled path does not claim “human verified”
- Rate limits remain

### Recovery

Generic recovery payload for all four realms. Email queued only when delivery mode is `accepted`. Worker stopped → no send.

### Step-up

Process-local Map replaced with Redis/cache TTL grants scoped by realm, subject, purpose, expiry. No password/raw token/secrets stored. Existing `stepUpPurposes` reused. No OTP-on-login.

### Connected Accounts

All providers remain `NOT_CONFIGURED`. Employer Settings now has the same readiness panel. No Connect buttons when `canAuthenticate=false`. Connection status confers no Trust/verification/Admin.

### Residual from this track

`agentAuthController.createAgentRegisterHandler` still accepts an unused `issueSession` DI hook (eslint `no-unused-vars`). Session issuance on register was intentionally removed. Left in place to avoid a sixth implementation commit; tracked as P2 lint residual.

---

## 17C-2 Employer / Admin

Commit: `109cd5bb80347ffae4012b4e10ed4d1ca32a115b`  
`fix(employer): align admin review and employer entitlement authority`

### Entitlement model

Admin job list/detail attach `projectAdminEntitlementSnapshot` from the same server authority as Employer Plans & Usage:

- entitlement type, policyCode/version
- `paidPublishingEnabled`
- active free jobs / maximum / remaining
- rolling submission usage/remaining when policy exposes it
- blocker/reason
- payment state remains `not_configured` while Stripe is off

No client-authoritative `isPaid` / `quotaRemaining`.

### Approval capacity

Admin single and bulk approve use the 17C-1A cap. Publishing badge: **FREE BETA** while paid publishing is OFF. **PAID** only if authoritative paid publishing exists.

### Paid-state truth

Removed `planType !== 'free'` / null-as-paid draft logic. No “Pay and publish” while `paidPublishingEnabled` is OFF. Drafts remain drafts. Plans & Usage remains the Employer explanation.

### Workflow

- Employer Applications: status + date filters
- Employer Interviews: job / date / status filters
- Employer Jobs: server-derived quota chip
- Employer Team: member + pending invite counts; owner removed from generic role select; invite copy uses delivery truth
- AdminPayments labelled **Legacy Payments**; no `$` + `toFixed(2)` as live Commerce

---

## 17C-3 Role Workflows

Commit: `32e02599ee671d395b8f34951b9a4c16fd75ef6d`  
`fix(workflows): close phase 17c role-service and discovery gaps`

- Home international scholarship links use ISO country codes (`?country=TR` etc.)
- Intl Scholarships: `CountrySelect`, URL init/write-back, Apply/Reset; server matches ISO code or stored display name; zero results stay empty
- Institution admission UI filters destinations via `INSTITUTION_ADMISSION_TRANSITIONS`
- Institution dashboard: server-derived `intakeCount`
- Agent Services: ISO multi-select via `coerceCountryCode` (no CSV)
- Agent Leads: display name from User name projection (no raw `_id` as primary label; no populate)
- Student More/nav: Institution applications + Personalization; Documents widget → Vault; `/saved-jobs` → `/journey/saved`
- Employer/Agent Help cards + getting-started checklists derived from account/server state; Institution already had next-actions

Exam Prep remains Pakistan-focused and labelled as such. No fabricated inventory.

---

## 17C-4/5 UX / Stability / Cross-Role

Commit: `bf9a09a130b93357ed40d0a0979f12139f05dbfa`  
`fix(platform): finalize phase 17c ux stability and cross-role safety`

### Blink / shell

**Root causes (source):** lazy-route `PageFallback` is already a content-area skeleton; auth contexts already skip `setLoading(true)` when hydrated; CMS loading is initial-only.

**Changes:** `MainLayout` keeps the same realm shell mounted. Public navbar/footer/StudentPortalNav hide on admin and auth paths so those surfaces do not remount public chrome. Authenticated realm sidebars were already outlet-only.

**Not done:** pathname-keyed whole-shell remount, `setTimeout`, opacity hacks.

### Auth shell

Shared `AuthLayout` wraps Student/Employer/Agent/Institution auth routes with Terms, Privacy, and Back to Strideto. Admin is not treated as public registration.

### Admin chrome

Admin remains a child of `MainLayoutWrapper` (avoids a router rewrite). Public navbar/footer/feedback are hidden on `/admin`. Admin sidebar keeps Back to site and staff identity. Residual: Admin still inherits `SiteContentProvider` / `AdSlotsProvider` from MainLayout.

### Nav states

Public `.nav-item[aria-current="page"]` already has persistent selected styling (orange accent underline, not hover-only). Employer/Agent/Institution/Admin/Student navs use `aria-current="page"` plus selected classes.

### Date / search icons

Central `index.css`: `color-scheme` on date/search + dark-theme invert for calendar and search indicators. `FormField.jsx` was **not** edited.

### Password inputs

B2B login pages now use shared `PasswordInput` (masked, eye toggle, `currentColor`, accessible label). Register/settings already used it from 17C-1B.

### Notifications

In-app only, via `createUserNotificationOnce`:

- password changed
- logout-all completed

Dedupe key: `security:{realm}:{subject}:{type}:{UTC-day}`. No secrets/session ids. No live email.

### Vault expiry notifications

**Deferred.** `vaultExpiryService` computes state from `expiresAt` only. Automatic expiry/expiring notices would need worker scheduling. Worker stays STOPPED. Not falsely implemented.

### Error sanitization

`errorHandler` no longer returns `err.message` merely because `err.code` exists. Public codes are allowlisted. Internal Mongo/path/secret-looking messages become generic. Stack traces are logged server-side only, never returned in JSON.

### Scraper

API replicas start scraper cron only when `ENABLE_SCRAPER_CRON=1` and `DISABLE_SCRAPER_CRON` is not set. Runtime log on api-a:

`scraper_cron_skipped` / `ENABLE_SCRAPER_CRON not set — API replicas do not start scraping`

Historical scraper code retained. Scraping remains OFF.

### Metadata

Employer public JSON-LD `addressCountry` uses stored ISO `countryCode` or omits the field. Hardcoded `PK` removed.

### Rate limiter observability

Production Redis failure now logs `rate_limit_degraded` / `process_local_memory` once per process. No silent-only fallback. No full rate-limit redesign.

### Dependencies

| Package | Current | Action |
|---|---|---|
| `jspdf` | `^2.5.1` | **Deferred.** Fixes require major 2 → 4.x migration. |
| `xlsx` | `^0.18.5` | **Deferred.** npm registry is frozen at 0.18.5 (CVE-2023-30533 / CVE-2024-22363). Patch requires CDN/fork install, not a compatible npm minor. Used by admin import parser (`XLSX.readFile`). |

---

## Runtime evidence

Compose (no `down -v`, worker not rebuilt/started):

```
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  -f docker-compose.appenv-align.yml -f docker-compose.sec3f-local.yml \
  --env-file .env.staging up -d --no-deps --build api-a api-b frontend
```

| Service | Status |
|---|---|
| frontend | healthy |
| api-a | healthy |
| api-b | healthy |
| mongodb | healthy |
| redis | healthy |
| mailpit | healthy |
| Caddy | running |
| worker | STOPPED (`Exited (0) 9 days ago`) |

`GET /api/health` → 200

```json
{
  "status": "ok",
  "mongo": "up",
  "redis": "up",
  "email": {
    "deliveryEnabled": false,
    "workerRunning": false,
    "effectiveState": "queued_worker_stopped"
  }
}
```

`GET /api/health/ready` → 200 `{ "status": "ready", "mongo": "up", "redis": "up" }`  
Note: overlay sets `appEnv: "production"` on this local staging stack (pre-existing `docker-compose.appenv-align.yml`).

Public API smoke (no 5xx):

| Path | HTTP |
|---|---|
| `/api/jobs?limit=5` | 200 |
| `/api/scholarships?limit=5` | 200 |
| `/api/admissions?limit=5` | 200 |
| `/api/internships?limit=5` | 200 |
| `/api/institutions?limit=5` | 200 |
| `/api/intl-scholarships?limit=5` | 200 |
| `/` frontend | 200 |

No real email, payment, SMS, WhatsApp, scrape, or payout was triggered.

---

## Focused tests

Do not treat this as the historical full suite.

| File | Result |
|---|---|
| `phase17cAuthority.test.js` | 32 passed |
| `phase17cIdentity.test.js` | 58 passed |
| `phase17cIdentityClient.test.js` | 18 passed |
| `phase17cEmployerAdmin.test.js` | 19 passed |
| `phase17cWorkflows.test.js` | 15 passed |
| `phase17cPlatform.test.js` | 21 passed |
| `phase17cPlatformClient.test.js` | 24 passed |
| `phase15ServerContracts.test.js` | 14 passed (error-handler regression) |

**Total focused 17C assertions:** 187 passed.

Module graph: `scripts/verify-module-link-integrity.mjs` — 1732 modules, clean.

Touched client lint: warnings only (`react-refresh/only-export-components` on AuthLayout helpers).

Touched server lint: 1 pre-existing unused `issueSession` DI param in agent register (P2).

Frontend production build: **passed** (Vite 5.4.21, ~30s).

---

## Browser engineering smoke

**Not USER acceptance. Not certification.**

Cursor embedded browser navigation to `https://localhost:8443/` failed with `ERR_CERT_AUTHORITY_INVALID` (local Caddy TLS). No visual proof of dark-theme icons, nav current-state, or blink was obtained in this agent browser.

HTTP/runtime proof only: public HTML `/` returned 200 through Caddy.

Full visual/manual coverage remains **USER MANUAL ACCEPTANCE**.

---

## Provider truth

| Provider | State |
|---|---|
| Stripe | OFF |
| Real email | OFF (`queued_worker_stopped`) |
| SMS | OFF |
| WhatsApp | OFF |
| Turnstile | NOT_CONFIGURED |
| OAuth | NOT_CONFIGURED |
| AI | OFF |
| Payouts | OFF |
| Scraping | OFF |
| Assessments | OFF / deferred |

A disabled/not-configured provider is not scored as a defect when UI/API stay truthful.

---

## Security ratings

Scores are evidence-weighted. Below 10 includes the exact reason.

| Area | Score | Why not 10 |
|---|---|---|
| Security | 8.2 | xlsx 0.18.5 and jspdf 2.5.1 remain; Cursor TLS not visually proven; agent unused session hook lint residual |
| Privacy | 8.5 | Registration/recovery non-enumeration is test-proven, not independently timing-proven under load |
| Authentication | 8.6 | B2B email-link model is source/test-proven; restricted-session UX not browser-proven; no OTP (intentionally out of scope) |
| Authorization/RBAC | 8.4 | Dual-gate and Free Beta cap are test-proven; concurrent last-slot race uses existing write assertion, not a new CAS layer |
| Trust/Verification | 8.7 | Trust enums unchanged; B2B email verify ≠ org verification (correct); no live verification-queue browser proof |
| Student safety | 8.5 | Launch projection on dashboard recs is test-proven; recommendations not runtime-proven against staging catalog |
| Employer authority | 8.6 | Same usage authority for Admin and Plans & Usage; paid publishing OFF is source-truthful |
| Agent isolation | 8.3 | Realm-scoped verify tokens test-proven; lead display source-proven; marketplace restricted gates not runtime-exercised here |
| Institution authority | 8.5 | Dual-gate test-proven; official write lock not runtime-exercised against staging orgs |
| Admin/core-team authority | 8.4 | Entitlement snapshot source/test-proven; Admin still nested under MainLayout providers |
| Commerce authority | 8.8 | Stripe OFF; no client paid flag; legacy payments labelled; no live Commerce mutation |
| Feature functionality | 8.0 | Many workflows are source/test-proven only; browser smoke blocked by TLS |
| UX | 7.6 | Auth shell and nav contracts are source-proven; blink/icons/forms not visually proven this session |
| Accessibility | 7.8 | `aria-current`, PasswordInput, AuthLayout links are source-proven; no axe/keyboard pass |
| International readiness | 8.1 | ISO CountrySelect/Home contract test-proven; not all discovery pages rewritten |
| Stability | 8.0 | Production build + API smoke passed; no soak/load test |
| Scalability | 7.4 | Step-up and rate-limit now Redis-aware; production Redis-down path is logged fallback, not fail-closed |
| Operations | 8.2 | Health/ready proven; worker stopped by design; scraper skip logged; overlay `appEnv=production` remains a local-stack honesty residual |
| Cross-role workflow | 8.0 | Help/checklists/filters source-proven; not end-to-end role-walked in browser |
| Future AI readiness | 7.5 | Paid AI remains disabled with deterministic fallbacks; no new AI surface |
| Evidence confidence | 7.3 | Strong test/source/runtime API evidence; weak browser evidence this session |

### Evidence classes

- **runtime-proven:** health, ready, container health, public listing HTTP codes, scraper skip log, worker stopped, email `queued_worker_stopped`
- **browser-proven:** none this session (Cursor TLS)
- **test-proven:** 187 focused 17C assertions + module graph + production frontend build
- **source-proven:** AuthLayout, dual-gate, entitlement snapshot, Turnstile disabled path, JSON-LD country, error allowlist
- **deferred/unproven:** Vault expiry notifications, jspdf major, xlsx CDN/fork, visual UX, live provider enablement

---

## Actual findings

### BLOCKER

None observed that lets a client manufacture verification, Trust, payment paid-state, canonical authority, or Employer/Institution hiring truth.

### P0

None remaining from the 17C-A P0 set. All four were implemented and focused-tested.

### P1

1. **Cursor/local TLS** — agent browser cannot complete visual smoke (`ERR_CERT_AUTHORITY_INVALID`). USER must accept this during manual acceptance.
2. **xlsx 0.18.5** — known prototype-pollution / ReDoS on admin import parse; no compatible npm patch. Phase 18/security acceptance.
3. **jspdf 2.5.1** — known issues fixed only in 4.x. Major migration deferred.

### P2

1. Agent register unused `issueSession` DI parameter (eslint).
2. Admin still wrapped by MainLayout providers (chrome hidden; no router rewrite).
3. Rate-limit production Redis outage still falls back to process-local memory after one warning (observability added, not fail-closed).
4. Local staging overlay reports `appEnv: production`.
5. FormField reserved-error-space improvement skipped because `FormField.jsx` is protected WIP.
6. Vault expiry in-app notifications deferred (would require worker).
7. Intl Scholarships still accept stored display names in addition to ISO codes (compatibility, not a fake catalog).
8. AuthLayout `react-refresh/only-export-components` warnings.

### MAJOR

None beyond the P1 dependency residuals.

### MINOR

1. Frontend chunk-size warnings on production build (pre-existing vendor/pdf).
2. `caniuse-lite` browserslist age warning during build.

### INFO

1. Email queue pending (80) while worker stopped — expected, not sent.
2. Assessments remain default OFF.
3. Turnstile ready but not enabled.
4. Connected Accounts catalog remains NOT_CONFIGURED.

---

## Unresolved

- Visual/manual whole-platform acceptance (USER)
- Local Caddy certificate trust in Cursor browser
- xlsx / jspdf upgrades
- Vault scheduled expiry notifications
- FormField WIP absorption
- Production Redis fail-closed vs degraded-fallback product decision
- Full historical suite (intentionally not re-run)

---

## Deferred post-launch

- Email OTP unless later justified
- Phone OTP
- SMS / WhatsApp
- live OAuth
- Assessments
- AI interview system
- Platform Brain
- autonomous AI writes
- Stripe / payouts
- scraping

---

## Commits

1. `001fff2` fix(authority): close phase 17c launch-critical authority gaps
2. `f2b020c` fix(identity): close phase 17c authentication and account-security gaps
3. `109cd5b` fix(employer): align admin review and employer entitlement authority
4. `32e0259` fix(workflows): close phase 17c role-service and discovery gaps
5. `bf9a09a` fix(platform): finalize phase 17c ux stability and cross-role safety
6. `docs(release): record Strideto phase 17c final implementation` (this report + audit)

Known WIP and protected files were not included.

---

## Mandatory next

**USER MANUAL ACCEPTANCE OF THE WHOLE PLATFORM.**

Phase 18 certification may begin only after USER manual acceptance passes and USER explicitly instructs Phase 18 to start.
