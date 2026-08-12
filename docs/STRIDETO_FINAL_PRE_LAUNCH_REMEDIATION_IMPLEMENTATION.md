# Strideto — Final Pre-Launch Remediation Implementation

**Status:** COMPLETE (engineering implementation + acceptance)  
**Starting HEAD:** `4b77971`  
**Branch:** `main`  
**Runtime:** `https://localhost:8443`  
**Worker:** STOPPED  
**Push / deployment:** NOT performed  
**Launch certification:** NOT RUN  

## Absolute notice

**PREVIOUS PHASE-14 CERTIFICATION DOES NOT CERTIFY THIS NEW HEAD.**

Phase 0–14 / Mission 27 evidence remains historical for prior candidates only. This remediation implements the locked final pre-launch roadmap after post-certification manual QA defects. User manual acceptance of the whole platform is still required before any launch re-certification, push, or deployment discussion.

## Pre-flight

| Item | Result |
|------|--------|
| Starting HEAD | `4b77971` |
| Branch | `main` |
| WIP isolated | path-scoped stashes for `AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx` (no `-u`) |
| Protected untracked | left untouched |
| Unexpected tracked changes | none at start |

## Implementation commits

1. `28284a7` — `fix(platform): finalize shared pre-launch experience`
2. `25b63fb` — `fix(discovery): finalize international public experience`
3. `595cf39` — `fix(hiring): finalize student and employer authority workflows`
4. `9a0938d` — `fix(agent): finalize onboarding marketplace and trust authority`
5. `542b84f` — `fix(institution): finalize official-data portal workflows`
6. `daf13bc` — `fix(admin): finalize announcements and cross-role operations`
7. *(this docs commit)* — `docs(release): record final pre-launch remediation implementation`

Prior post-certification remediation commits (from `5ff6ae0` → `4b77971`) remain in history and are prerequisites, not re-certified.

## Mission outcomes

### Mission A — Shared Platform Foundation

| Area | Outcome |
|------|---------|
| Navigation flicker / scroll | Existing `ScrollManager`: PUSH/REPLACE top on pathname change; POP restores; hash targets anchors; no setTimeout hack |
| Skip link | Shared `SkipLink` + `.skip-link` focus styles |
| Form system | Shared primitives already present (`PhoneInput`, `CountrySelect`, `LocationFields`, `PasswordInput`, `MultiSelect`, etc.); FormField WIP preserved untouched |
| International geography | Shared country → region → city contract reused |
| Phone | Tel semantics + dial code; not type=number |
| Password recovery | Student/Employer/Agent/Institution forgot/reset routes; no worker activation |
| Welcome | Portal welcome once (onboarding) + welcome-back once per auth session |

### Mission B — Public / Discovery

| Area | Outcome |
|------|---------|
| Jobs filtering | International filters (no hidden PK default) from prior remediation |
| Job taxonomy | Expanded to locked Mission B2 families/specializations; legacy family labels retained for stored records |
| Program Explorer | Country facets from records (prior) |
| Career Guidance | Professional FAQ themes + salary honesty (“Unavailable / source required”) |
| Agent directory / privacy | Public-safe projection preserved |

### Mission C — Student / Employer

| Area | Outcome |
|------|---------|
| Application authority | Students cannot write Employer authoritative stages (`applicationAuthority.js`) |
| External application | Copy clarifies: Applied externally; status not yet provided by Employer unless matched update exists |
| Kanban | Stage moves only for personal trackers using allowed transitions |
| Entitlement / openings / pipeline | Prior remediation + contracts remain source of truth |

### Mission D — Agent / Trust

| Area | Outcome |
|------|---------|
| Marketplace draft | MultiSelect countries/languages; controlled journey categories |
| Canonical picker | Searchable program picker via `GET /education/programs?search=`; server derives IDs / provenance |
| Raw IDs | Removed from ordinary authoring UX |
| Evidence policy | Central policy retained: Maps supporting-only; website ≠ credential/accreditation |
| Commerce | Free / not_configured; no Stripe activation |

### Mission E — Institution

| Area | Outcome |
|------|---------|
| Admissions pipeline | Stage cards link to `/institution/applications?status=` |
| Applications inbox | Reads `status` query param |
| Organization type Other | Required custom value serialized as `Other: {custom}` |
| Claim / publishing gate | Prior remediation retained (picker + dual gate) |

### Mission F — Admin / Announcements

| Area | Outcome |
|------|---------|
| New Announcement | Opens real editor (`openCreate`) |
| Schedule decision | **Launch honesty option A:** scheduled auto-publish UI disabled while worker stopped; Draft + Publish Now + optional expiry |
| Server | Ignores `scheduledAt` on save; creates as draft |
| Confirm dialogs | Prior fix preserved (`open = false`) |
| Sidebar scroll | Prior persistence retained |
| Audience isolation | Prior announcement feed targeting retained |

## Workflow decisions

1. **Scheduled announcements:** Disabled for launch honesty (no fake cron). Worker remains stopped.
2. **Marketplace advanced references:** Fail closed to agent_statement unless a searchable published program is selected.
3. **Acknowledgement:** Driven by announcement `type: action_required` (no separate `acknowledgementRequired` schema field).
4. **Taxonomy expansion:** Additive; legacy family labels remain valid for existing records.
5. **Unknown ≠ zero / missing ≠ false:** Preserved in prior authority/entitlement/projection work.

## Trust / authority invariants (unchanged)

- No client-forged badges or verification scores
- Maps alone cannot mint VERIFIED
- Generic website cannot mint professional credential or accreditation badges
- Organization approval ≠ every granular badge VERIFIED
- Student cannot set Employer hiring states
- Institution dual publishing gate requires org verification + approved canonical claim
- Relationship ≠ Vault access
- No Admin “Mark paid”; entitlement is server-derived

## Focused tests

- `client/src/__tests__/finalPreLaunchSharedFoundation.test.js`
- `client/src/__tests__/finalPreLaunchDiscovery.test.js`
- `client/src/__tests__/finalPreLaunchHiringAuthority.test.js`
- `client/src/__tests__/finalPreLaunchAgentTrust.test.js`
- `client/src/__tests__/finalPreLaunchInstitution.test.js`
- `client/src/__tests__/finalPreLaunchAdminAnnouncements.test.js`
- `client/src/__tests__/finalPreLaunchRemediationAcceptance.test.js` (aggregator)
- `adminConfirmDialogContract.test.js` included in acceptance pack

## Engineering acceptance

| Check | Result |
|------|--------|
| Module graph (`verify-module-link-integrity.mjs`) | PASS |
| Focused lint (touched client pages) | PASS (0 errors) |
| Frontend Vite build | PASS |
| Acceptance pack | PASS (7 suites) |
| API recreate | api-a / api-b healthy |
| Frontend recreate | healthy |
| Health / readiness | 200 expected via staging Caddy |
| Worker | STOPPED |
| Live providers | Stripe/email worker/AI/payouts/scraping NOT activated |

## Deferred providers

- Stripe / payouts
- Transactional email worker
- Paid AI providers
- External scrapers
- Scheduled announcement cron

## Remaining requirement

**USER MANUAL ACCEPTANCE OF THE WHOLE PLATFORM at `https://localhost:8443`.**

Only after explicit user approval may final launch re-certification be run. Do not push. Do not deploy.

## WIP restore

After documentation commit, restore unstaged:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`
