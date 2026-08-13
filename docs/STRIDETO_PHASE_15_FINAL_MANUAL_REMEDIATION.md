# Strideto — Phase 15 Final Manual Remediation

**Status:** COMPLETE (source + focused engineering smoke)  
**Certification:** NOT RUN  
**Push / deployment:** No  
**Worker:** remains STOPPED  
**Live providers:** remain OFF  

This document records the Phase 15 implementation. It is **not** launch certification. USER will manually accept the whole platform before Phase 16.

## Baseline

| Item | Value |
|------|--------|
| Starting HEAD | `2854e0d` (`docs(release): record final pre-launch remediation implementation`) |
| Branch | `main` |
| WIP isolation | Path-scoped stash `stash@{0}: phase15-isolate-known-wip` (`AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx`) |
| Protected / local-only | `docker-compose.appenv-align.yml`, `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` — untouched, not committed |
| Worker | Stopped (`edurozgaar-staging-worker-1` Exited) |

Git is the authority. Phase 14 certification remains historical for its previous candidate.

## Actual findings (pre-implementation)

| Severity | Finding |
|----------|---------|
| P0 | SPA flicker: User/Employer/Agent auth bootstrap re-ran on every `pathname` and called `setLoading(true)`, unmounting role shells. |
| P0 | Consultation “Request failed”: production `errorHandler` sanitized most 4xx messages. |
| P1 | Navbar current/hover/focus insufficient; Help Center still in Services mega. |
| P1 | Footer IA did not match USER mental model (Study & Prepare missing; Help under Services). |
| P1 | Home hero used Pakistan province + Government Jobs shortcut. |
| P1 | Jobs copy/filters still Pakistan-oriented; internships used hard-coded PK geography. |
| P1 | Program Explorer country selector was record-backed facets, not a global catalog. |
| P1 | Public projection had no explicit fixture classification (title matching is forbidden). |
| P1 | Admin `needs_information → needs_information` invalid transition. |
| P1 | Revoked organizations could not start a new verification attempt. |
| P2 | Notification popover overflowed on mobile. |
| P2 | Saved opportunities omitted Jobs/Internships. |
| P2 | Admin Alerts still Pakistan/Telegram-first. |
| P2 | Job Description Generator presented deterministic output as if AI were live. |
| P2 | Page Builder History native selects were unreadable in Dark theme. |
| INFO | Blog route already existed; Home still linked Career Blog. Restored in footer/sitemap, not a second CMS. |
| INFO | Assessments remain post-launch. Tests & Prep = Test Hub + Exam Prep. |

## Root causes

1. **Flicker:** realm auth effects depended on `pathname` instead of realm-boundary flags, and Protected*Route rendered a loading shell whenever `loading` was true even if already authenticated.
2. **Consultation errors:** generic production sanitization hid 422/409 contract messages unless allowlisted.
3. **International search:** listing filters used native/PK-oriented selects instead of a shared Country → Region → City cascade.
4. **Fixtures:** public list filters did not consult explicit `isFixture` / `dataClass` / `launchEligible` flags.
5. **Verification UX:** Admin attempted a same-state machine transition; revoked had no legal path to a new attempt.

## Implementations

### Navigation / Shell
- Auth bootstrap is realm-boundary (`userRealmActive`, `employerRouteActive`, `agentRouteActive`).
- Skip `setLoading(true)` when already hydrated.
- Protected routes only show loading UI when `loading && !isAuthenticated`.
- No `key={pathname}` remount of the router tree.
- Browser Back/Forward still uses the accepted ScrollManager (PUSH top, POP restore).

### Navbar
Frozen IA: Home, Jobs, Scholarships & Funding, Admissions & Intakes, Internships, Study & Institutions, Tests & Prep, Services.
- Study mega: Program Explorer, Schools & Colleges, Foreign Studies, International Scholarships.
- Tests mega: Test Hub, Exam Prep. **No Assessments engine.**
- Services mega: Agents & Agencies, Professional Marketplace, Career Guidance, Resume Builder. **Help Center removed.**
- `aria-current="page"`; parent current when a child matches; hover/focus-visible/open states; Escape + outside click; bounded mega.

### Footer
Discover / Study & Prepare / Services / For Organizations / Resources & Support / Legal. Newsletter separate. No Admin, License, GitHub, localhost, or private ops pages.

### Hero
Opportunity Type + Keyword + international Country. Pakistan province selector removed. Government Jobs removed as a global shortcut. Copy is worldwide.

### International location
Shared `LocationCascadeFilter` + `shared/international/regions.js`. Country change clears region+city. Region change clears city. Catalogs for PK/US/DE/GB/CA/AU; other countries show a truthful empty region state (no fabricated geography).

### Jobs / Internships / Programs
- Jobs: cascade + work mode; worldwide subtitle; Similar / Recommended cards without fabricated scores.
- Internships: international filters; local QA seed is fixture-classified and refuses staging/production.
- Programs: global CountrySelect; truthful empty state; save/share on detail where action engine supports it.

### Fixture projection
`shared/publicDiscovery/fixtureExclusion.js` — explicit flags only. Production / `PUBLIC_LAUNCH_PROJECTION=1` excludes fixtures. Local/QA may include them.

### Institution apply
Trust sidebar (summary, what you share, what happens next). No ads. International country + phone. Consent/privacy authority unchanged.

### Student
- Consultation: 422/409/`err.code` pass through; coded slot conflicts.
- Applications: Employer/Institution stages remain read-only; withdrawal dedicated; personal tracker labelled **My tracking status**.
- Saved: unifies Jobs/Internships (listing save API) with Programs/Scholarships (action engine).
- Notifications: viewport-safe popover (`fixed inset-x-2` on mobile); titles wrap.
- Welcome: student banner + existing SweetAlert registration welcome. Milestones are one-shot, server-backed, reduced-motion safe.

### Portals
Employer/Agent/Institution: welcome + one-shot verification/claim congratulations. Institution profile uses location cascade and tel validation. Usage pipeline visualization already present. Billing remains Free / not_configured.

### Admin
- `needs_information` already set → “Waiting for organization response” + history update, no invalid transition.
- Revoked → new `verification_pending` attempt (immutable old attempt).
- Alerts: audience + geography + channel truth (in-app available; email/Telegram/WhatsApp/LinkedIn not configured).
- Announcements wiring not regressed.
- AdminConfirmDialog remains `open = false`.
- Job Description Generator: template-assisted, structured sections, never auto-publish, AI provider OFF.
- Page Builder History dark native controls retained.

## Authority decisions

- STRIDETO is international. No hidden Pakistan defaults.
- Employer/Institution own application stages. Student reads truth and may withdraw when allowed.
- External personal tracking is labelled personal and is never Employer/Institution truth.
- Skill Trust invariant unchanged: CLAIMED ≠ EVIDENCE_SUBMITTED ≠ EVIDENCE_BACKED ≠ VERIFIED.
- Maps/Google Business remain supporting evidence only.
- No scraping, fake jobs, fake payments, fake email, fake traffic, AI-as-authority, or self-verification.
- Assessments are **post-launch**. Do not implement the engine now.

## Provider states

| Provider | State |
|----------|--------|
| Email | OFF (Mailpit local capture only) |
| Stripe / payouts | OFF / not_configured |
| AI | OFF — template-assisted generator only |
| Telegram | NOT CONFIGURED |
| WhatsApp | NOT CONFIGURED |
| LinkedIn automation | FUTURE / NOT CONFIGURED |
| Worker | STOPPED |
| Scraping | OFF |

## Test results

| Suite | Result |
|-------|--------|
| `phase15FinalManualRemediation.test.js` | 65 passed |
| `phase15ServerContracts.test.js` | 14 passed |
| `organizationVerificationFoundation.test.js` | 17 passed |
| `finalPreLaunchRemediationAcceptance.test.js` | 8 suites passed |
| `phase10PublicShell.test.js` | 74 passed |
| `adminConfirmDialogContract.test.js` | 15 passed |
| `secureAuthClientContract.test.js` | 63 passed |
| Module graph (`scripts/verify-module-link-integrity.mjs`) | ok |
| Lint (touched client/server scope) | clean |
| Frontend `vite build` | succeeded (after replacing illegal `@apply bg-primary/10`) |

## Runtime state (local staging, not production)

Recreated **only** `frontend`, `api-a`, `api-b`. Mongo/Redis/media volumes preserved. Worker not started. Existing local overlays (`docker-compose.appenv-align.yml`, `docker-compose.sec3f-local.yml`) used so AuthCookiePolicy and nginx `backend` alias keep working. Those overlays were not modified or committed.

| Service | State |
|---------|--------|
| frontend | healthy |
| api-a | healthy |
| api-b | healthy |
| Mongo | healthy (volume preserved) |
| Redis | healthy (volume preserved) |
| Caddy | running (`edurozgaar-sec3f-local-caddy`) |
| Mailpit | healthy |
| worker | stopped / Exited |

Health `/api/health` **200**. Readiness `/api/health/ready` **200**. Public smoke (Home, Jobs, Internships, Scholarships, Program Explorer, Blog, Career Guidance, Help, Sitemap, Privacy, Tests, Exam Prep, Agents, Foreign Studies, Schools & Colleges) **200**. No unexpected 5xx in this smoke.

## Deferred post-launch

- Assessment engine
- Autonomous AI Agent / Copilot actions
- Live Stripe / payouts
- Live email worker
- Telegram / WhatsApp provider activation
- LinkedIn automation
- External scraping remains OFF
- Paid AI remains OFF (budget policy)

## Manual acceptance required

USER must manually test Public, Student, Employer, Agent, Institution, and Admin surfaces.

Only after USER explicitly says manual acceptance PASS will Phase 16 — Final Launch Re-certification run.

**STOP. Do not certify, push, deploy, or enable live providers.**
