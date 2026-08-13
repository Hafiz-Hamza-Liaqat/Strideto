# STRIDETO PHASE 17 PRE-CERTIFICATION REMEDIATION

This is an implementation record. It is **not** launch certification, deployment, or a push.

Starting HEAD: `800583a`  
Branch: `main`  
Mode: IMPLEMENTATION / FIX / VERIFY / FREEZE

## Baseline / safety

- Known WIP isolated with path-scoped stash `phase17-isolate-known-wip` (not `-u`):
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Protected untracked files were not committed, deleted, or reset:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Worker remained STOPPED. No live email, Stripe, payouts, AI, Telegram, WhatsApp, LinkedIn, scraping, or n8n activation.
- No Mongo/Redis/media deletion. No `down -v`.

## What was implemented

### Track A — Public launch projection

Deny-by-default launch eligibility in `shared/publicDiscovery/fixtureExclusion.js`:

- `launchEligible === true` is required for public launch projection.
- Unknown/unclassified records are **not** public.
- Fixture/demo/QA/`dataClass`/`environment` records are never public.
- Title-string matching is not used.
- Admin/moderation approval may set `launchEligible` only via `assignLaunchEligibleOnAuthorityPublish` (fixtures stay ineligible).

Applied to jobs, internships, scholarships, admissions (already gated), programs, canonical institutions, agents, marketplace posts, homepage dynamic content, search index/related content, sitemap.xml, and SEO listing queries.

**Existing data mutation performed? No.** No destructive Mongo backfill. Historical QA records remain in the database and disappear from public APIs because they lack `launchEligible: true`.

Runtime (api-a, production APP_ENV overlay):

- `GET /api/jobs?limit=50` → `total: 0` (no P13 / B5B titles)
- `GET /api/agents?limit=50` → `total: 0`
- `GET /api/education/programs?limit=20` → `total: 0`
- internships/scholarships empty
- `GET /api/search?q=P13` → `total: 0`
- sitemap.xml: no P13/B5B/Disposable leak

Empty public catalogs are technically acceptable. They are **not** launch-content-ready.

### Track B — Cache invalidation

`POST /api/dynamic-content/invalidate-cache` now requires `requireAuth` + `requireStaff` + `PERMISSIONS.CONTENT_SITE`.

Runtime anonymous result: **401** (never 200).

### Track C — Email / worker / health truth

Separated:

- `providerConfigured`
- `workerRunning` (Redis heartbeat, only when worker ticks)
- `deliveryEnabled` (`EMAIL_DELIVERY_ENABLED === '1'`)
- `queuePending`
- `effectiveState` / `mode`

Runtime `GET /api/health`:

```
smtp: configured
email.effectiveState: queued_worker_stopped
workerRunning: false
deliveryEnabled: false
queuePending: 80
note: SMTP is configured but the worker is stopped. Jobs remain queued and are not sent.
```

Live email sent? **NO**. Queue was not drained. Before any future email acceptance, operators must handle the stale QA queue (55 email + 25 notification jobs).

### Track D — Assessments deferred

Launch default is **disabled** (`ASSESSMENTS_ENABLED` / `VITE_ASSESSMENTS_ENABLED` must equal `'1'` to enable). Engine retained. Career Guidance and dashboard learning CTAs point at Tests & Prep. Direct `/assessments` still uses `featureDisabled`. APIs remain auth-gated and flag-gated.

AI-based interview: **NOT IMPLEMENTED**. Remained deferred.

### Track E — Institution forms / Dark theme

Realm-wide Institution form sweep: CountrySelect (ISO stored, names shown), PhoneInput/`tel`, placeholders (Fall 2027, e.g. 250, USD, example.edu URLs, registration-number help), Other org-type field, native `color-scheme` on `fieldClass` and shared controls. `FormField.jsx` WIP was not edited.

### Track F — International geography

Existing Country → region catalog (PK/US/DE/GB/CA/AU) plus truthful free-text fallback for unsupported countries. Country change clears region/city. Register/Claim/Verification no longer ask ordinary users to type ISO codes. No silent Pakistan default on the cascade.

### Track G — Branding / SEO

Global package/product description and default keywords are international. About intro is international. Pakistan SEO landings (FPSC/PPSC/government jobs) remain explicitly localized. Fixture records cannot enter SEO/sitemap queries. Global scholarship-in-country titles no longer say “for Pakistani Students”.

### Track H — Human sitemap

`/sitemap` redesigned into scannable cards: Find opportunities, Plan your studies, Get professional help, Organizations, Account, Help & safety. No Admin, Vault, GitHub, localhost, or license promotion. `sitemap.xml` architecture unchanged except launch exclusion.

### Track I — Consistency

- `/admin/agent-marketplace` wrapped in `AdminRouteGuard` (`WORKFLOW_REVIEW` / `WORKFLOW_APPROVE`).
- Agent onboarding: ACCOUNT is registration; professional wizard 5 steps, agency 6. Progress uses the visible flow.
- `correctionsRouter` remains **unmounted** (no launch UI depends on it).
- Agent country write path uses `coerceCountryCode` (ISO). Historical Mongo was not rewritten.

### Track J — Flicker / loading

Phase 15 same-realm auth-shell fix preserved. `PageFallback` is outlet-sized, theme-matching, no large pulse. Visual confirmation in Cursor browser: **NOT VISUALLY PROVEN** (local TLS `ERR_CERT_AUTHORITY_INVALID` on `:8443`).

## Runtime

| Service | Status |
| --- | --- |
| frontend | healthy |
| api-a | healthy |
| api-b | healthy |
| Mongo | healthy |
| Redis | healthy |
| Caddy | running |
| Mailpit | healthy |
| worker | STOPPED |
| `GET /api/health` | 200, truthful email state |
| `GET /api/health/ready` | 200 |
| unexpected 5xx | none observed on smoke |

## Tests

- `phase17PreCertificationRemediation.test.js` — 47 passed
- `phase17ServerContracts.test.js` — 34 passed
- Targeted: phase15 client/server, phase10 SEO/public shell, phase7 public discovery, agent/institution/admin/verification contracts
- Module graph: ok
- Client lint on touched files: warnings only (pre-existing refresh exports)
- Frontend production build: ok
- Runtime smoke: jobs/agents/programs empty of fixtures; anonymous cache 401; search P13 empty

## Technical content readiness vs launch content readiness

Technical: public projection is fail-closed and empty catalogs are truthful.

Launch content:

- Jobs: no launch-eligible public records in this staging DB
- Internships / Scholarships / Admissions / Programs / Agents: empty public projection

Do not confuse empty-but-safe with content-ready.

## Actual findings after Phase 17

- BLOCKER: none remaining from the Phase-16 fixture leak (runtime confirmed empty)
- P0: none remaining for launch projection opt-in
- P1: none remaining for cache-invalidate, assessments advertising, email-health lie, institution placeholders (source), geography contract (source)
- P2: Employer interview cancellation still absent; some About/FAQ/schools copy still Pakistan-framed; assessments anonymous callers see 401 before the disabled payload because auth middleware runs first
- MAJOR: none
- MINOR: Cursor visual/responsive/theme not proven; 80 stale queued jobs remain
- INFO: AI interview not implemented (deferred); Assessments engine retained but off

## Unresolved (real)

1. Launch **content** is sparse/empty. Technical projection is safe; editorial launch-safe inventory still required.
2. Visual/responsive/Light-Dark/flicker not proven in Cursor because of local TLS.
3. Stale QA notification/email queue (80 jobs) must be handled before any future delivery enablement.
4. Historical search documents are gated by `metadata.launchEligible` going forward; this staging search returned empty for P13. A production reindex is still the clean operational step after first launch-eligible publishes.
5. User final manual acceptance of the whole platform has not run.

## Phase 17 status

**COMPLETE** as pre-certification remediation (candidate for user manual acceptance).

Certification: **NOT RUN**  
Push: **NO**  
Deployment: **NO**

## Next

USER FINAL MANUAL ACCEPTANCE OF THE WHOLE PLATFORM

ONLY IF USER MANUAL ACCEPTANCE PASSES:

STRIDETO — PHASE 18 MISSION 27 FINAL LAUNCH RE-CERTIFICATION
