# STRIDETO PHASE 17D-3R
PROVIDER DOMAIN SEPARATION, MANDATORY ONBOARDING
& TEAM DUTY ACCESS CORRECTION

## 1. Baseline

- Expected HEAD at start: `c20a9a0` (`docs(release): record phase 17d-3 provider workspace`)
- Branch: `main`
- Tracked WIP left untouched: `AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx`
- Protected local files left untracked: `docker-compose.appenv-align.yml`, `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Existing stash left untouched: `wip: AdminTableFilters values wiring (pre-phase-10)`
- Worker remained STOPPED
- No push, no deploy, no Phase 17D-4, no Phase 18

## 2. Problem being corrected

17D-3 added a real Business Services provider workspace inside the Agent portal, but the Agent experience still treated every provider as an education/study agent: one mixed sidebar, education-heavy dashboard, no mandatory professional-area question at registration, and agency invites that granted whole-organization membership without domain-scoped duties.

## 3. Repository audit

Audited Agent registration (`/agent/register`, `POST /api/auth/agent/register`), onboarding wizard, `ProtectedAgentRoute`, AgentLayout/nav, dashboard, Team/invite/accept, 17D-3 GBS routes, and public acquisition (navbar/footer `/agents`, `/agent/login`, directory). No public Business Services marketplace existed. No homepage “Become an Agent” card existed; the directory and register entry were updated instead of duplicating a new public marketplace page.

## 4. Provider Domain registry

Canonical source-controlled registry: `shared/provider/providerDomains.js`

| domainId | Public name |
|---|---|
| `education_mobility` | Education & Mobility |
| `business_services` | Business Formation & Corporate Services |

Unknown domain IDs: DENY. Architecture is additive.

## 5. Provider Domain persistence

Collection `ProviderDomainEnrollment`: `subjectType`, `subjectId`, `domainId`, `status`, `onboardingStatus`, `selectedAt`, `selectedBy`, `schemaVersion`, `recordVersion`. Unique `(subjectType, subjectId, domainId)`. Duplicate activation returns the existing enrollment.

Agent self domain ≠ Agency domain.

## 6. Legacy Agent compatibility

`AgentProfile.providerDomainInitializationState`: missing/null → `legacy` (compatibility only). Effective domain: `education_mobility` ONLY. No automatic `business_services`. No live backfill. Dry-run utility: `server/scripts/providerDomainLegacyDryRun.js` (does not write).

## 7. Required registration question

New self-registering providers must multi-select domain cards: Education & Mobility and/or Business Formation & Corporate Services. Selecting both cards = both. No contradictory “Both” radio.

Invite-aware registration (`?invite=`) does not force an Independent personal domain; agency domain access is enough.

## 8. Required validation behavior

Frontend: Continue disabled until at least one valid selectable domain; accessible error if submitted empty.

Backend: `validateRequiredProviderDomainSelection` rejects zero, unknown, and (when provider flag is off) `business_services`. No silent `undefined → education_mobility` for new accounts.

## 9. Registration failure safety

New accounts are created `pending`. Successful enrollment persistence marks `ready`. If enrollment throws, state remains `pending` and the route guard blocks operational workspace URLs. Duplicate enrollments are unique-index idempotent.

## 10. Provider Home

`/agent` is Provider Home (`ProviderHome.jsx`). It lists only authorized subject × domain workspaces, grouped Independent vs Agency, with server-authoritative domain-scoped counters.

## 11. One-domain behavior

Exactly one accessible workspace: login/home auto-opens that workspace. Provider Home remains at `/agent?home=1` with **+ Add another provider category**.

## 12. Multi-domain behavior

Two or more workspaces: default Provider Home. `localStorage strideto-provider-workspace` is UX only; stale/unauthorized preference is ignored. Preference never activates a domain.

## 13. Add Provider Category

`POST /api/agent/provider-domains` enrolls the requested domain for an authorized subject. Already-active → 200 existing. Does not auto-verify. UI redirects Business to capabilities setup and Education to verification.

## 14. Workspace context

UX context = `subjectType + subjectId + providerDomainId`. Server re-validates subject, domain enrollment, membership, and domain permission on protected operations.

## 15. Independent vs Agency

Provider Home groups by subject label. Independent enrollments are never collapsed into Agency enrollments.

## 16. Education & Mobility workspace

Existing education product relabeled, not rebuilt. Overview at `/agent/education`. `/agent/services` remains canonical Education & Mobility Services.

## 17. Business Services workspace

17D-3 routes preserved: `/agent/business-services`, capabilities, jurisdictions, listings. No fake Requests/Quotes/Formation Cases/Mailroom nav.

## 18. Sidebar separation

Shared: Provider Home, Profile, Identity & Organization / Trust Center, Messages, Notifications, Account Settings, Help, Team (agency).

Education workspace: Overview, Professional Verification, Education & Mobility Services, Marketplace, Availability, Student Leads, Clients, Consultations, Cases, Reviews.

Business workspace: Overview, Business Verification, Capabilities, Jurisdictions, Service Listings.

## 19. Verification/Trust separation

Trust Center now layers Identity & Organization separately from Professional Domains. Copy distinguishes email/identity/organization from Education professional verification and Business capability verification.

## 20. Service separation

Education service form remains education categories only and rejects `capabilityId` / GBS capability IDs.

GBS listing create rejects education `AGENT_SERVICE_CATEGORIES` as `capabilityId`.

## 21. Posting-rule separation

Education posting continues existing education verification/marketplace rules.

Business listing still requires 17D-3 explicit ACTIVE VERIFIED `capabilityId` + scope + catalog/moderation. 17D-3 Mongo listing tests still pass.

## 22. Settings separation

Account Settings groups shared security/billing/notifications vs education-specific (availability/services) vs business-specific (GBS workspace). No fake future pages.

## 23. Agency domain activation

Organization type does not activate all domains. Agency domains are explicit enrollments on the organization subject. Owner/admin may add a domain. Activation ≠ professional verification.

## 24. Team invite

Invite payload now includes `domainAccess`. Only Agency-activated domains are assignable.

## 25. Required team domain selection

Frontend: Send Invite disabled at zero domains.

Backend: `provider_domain_selection_required` if zero. Agency without business cannot grant business access until the Agency activates `business_services`.

## 26. Team domain permissions

Source-controlled in `shared/provider/providerDomainPermissions.js`. Stored on `AgentMembership.domainAccess`. Existing roles `owner|admin|member` preserved. Permissions grant workspace duties only.

Legacy memberships without `domainAccess` map to education_mobility via existing role capabilities. They do not receive business_services.

## 27. Personal vs Agency professional authority

Invite/domain access does not mint `ProviderCapability`. Personal RA/ACSP/formation trust does not transfer to Agency and vice versa. 17D-3 exact-subject rules remain.

## 28. Membership leave/suspend behavior

Inactive/suspended memberships are excluded from `resolveAuthorizedProviderSubjects` (`active: true`). Agency workspace access ends. Personal enrollments/capabilities remain. `TEAM_DOMAIN_ACCESS_REMOVED` is audited on deactivation.

## 29. Scenario 1 proof

Mongo + source tests: education-only enrollment; later add `business_services` idempotent; no ProviderCapability VERIFIED created. Provider Home shows both after add. Manual UI steps are in §75 of the phase prompt / §40 below.

## 30. Scenario 2 proof

Mongo test `agency business invite does not grant education or personal capability`: education-only agency cannot invite to business; after Agency activates business, business-only invite works; member cannot access education workspace; no personal/agency VERIFIED capability; inactive membership removes Agency workspace.

## 31. Public provider discoverability

Register title: “Join Strideto as a Service Provider” with both domain descriptions.

Directory intro explains both professional fields and links to register. Explicitly states Business Services public marketplace is not available.

Navbar/footer English labels: Service Providers / Provider Portal. CMS seed defaults updated (not a live CMS write).

## 32. Feature-flag behavior

- `isBusinessServicesProviderEnabled` = `BUSINESS_SERVICES_PROVIDER_ENABLED=1` OR `BUSINESS_SERVICES_ENABLED=1` (compat)
- `isBusinessServicesPublicMarketplaceEnabled` = `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=1` only (default OFF)
- Provider workspace middleware uses the provider flag
- Listing publication gate remains on `BUSINESS_SERVICES_ENABLED` for 17D-2/2R1 compatibility; listings stay private; no public marketplace routes
- When provider flag is off, Business card is Coming Soon / non-selectable; server rejects business enrollment
- Local QA override is only in untracked `docker-compose.appenv-align.yml` (not committed)

## 33. Route compatibility

`/agent/services` preserved. `/agent/business-services/*` preserved. `/agent` is now Provider Home; education overview is `/agent/education`. No redirect loops. No public `/business-services` or `/business`.

## 34. Existing Agent regression

Phase 5 Agent portal source contract: 111 checks passed (nav IA updated to domain-specific labels). Mission 11 Agent/Agency portal: 30/30. Education dashboard, services, team, settings remain functional.

## 35. 17D authority regression

| Test | Result |
|---|---|
| 17D-0 workspace context | 73 passed |
| 17D-1 capability foundation | 106 passed |
| 17D-1 student route authority | 76 passed |
| 17D-1 provider/platform | 41 passed |
| 17D-1R1 source | 38 passed |
| 17D-1R1 role/registration | 39 passed |
| 17D-1R2 legacy fallback | 52 passed |
| 17D-2 catalog foundation | 345 passed |
| 17D-2 provider trust | 27 passed |
| 17D-2R1 catalog truth | 43 passed |
| 17D-2R1 provider authority | 27 passed |
| 17D-3 pricing/risk catalog | 25 passed |
| 17D-3 source contract | 57 passed |
| 17D-3 UI contract | 25 passed |
| 17D-3 Mongo workspace | 4/4 passed |

## 36. UI/theme

Semantic tokens reused (`bg-bg-main`, `dark:` variants, `cardClass`, primary). No new arbitrary white/black/gray palette. Public Navbar/Footer theme contract unchanged. Agent/Provider `PortalBrand` retained.

## 37. Responsive behavior

Domain cards: `grid-cols-1 md:grid-cols-2`, `break-words`, `min-w-0`. Switcher/menu `max-h-72 overflow-auto` and wrapping. Automated pixel proof at 320/375/768/1024/1440 × System/Light/Dark was not captured in-browser this phase.

## 38. Accessibility

Domain cards are labeled checkboxes; selected status includes a “Selected” text chip; required legend; `role="alert"` on errors; switcher `aria-haspopup="listbox"`; invite fieldset legend; focusable Continue. Full screen-reader pass is USER MANUAL.

## 39. Browser visual evidence

**NOT PROVEN**

Local TLS browser automation was not used to claim visual PASS across theme × viewport matrix.

**USER MANUAL ACCEPTANCE: REQUIRED**

## 40. USER manual acceptance

### Scenario 1 — one person, two professional fields

1. Open Provider register.
2. Select **Education & Mobility only**. Continue stays disabled until a card is selected.
3. Complete email verification using local Mailpit (worker is STOPPED, so use an already-verified local fixture or queued-mail process you already use).
4. Confirm Education workspace appears; Business operational pages are not mixed into the education sidebar.
5. Open Provider Home (`/agent?home=1`).
6. Add **Business Formation & Corporate Services**.
7. Confirm a separate Business workspace appears.
8. Confirm no Business Formation / Registered Agent / ACSP capability is VERIFIED.
9. Switch workspaces; confirm duties/services/posting stay separate.

### Scenario 2 — two people, different fields (local/test fixtures only)

1. Use/create an Agency with Education domain.
2. Activate Business domain for the Agency (not personal).
3. Invite a second provider with **Business only**; prove Send Invite stays disabled at zero domains.
4. Accept invitation confirming Business access.
5. Second member sees Agency Business workspace, not Education operational access.
6. Second member is not automatically Verified; no credential transfer either direction.
7. Deactivate/remove membership; Agency workspace access disappears; personal domains remain.

Do **not** mutate real production provider Trust.

## 41. Tests

| Suite | Count |
|---|---|
| 17D-3R source contract | 51 |
| 17D-3R UI contract | 23 |
| 17D-3R Mongo | 5/5 |
| 17D-3 source + UI + Mongo | 57 + 25 + 4 |
| 17D-0..2R1 focused | as §35 |
| Phase 5 Agent portal | 111 |
| Mission 11 portal | 30/30 |
| Frontend production build | pass |

Isolated Mongo DBs: `strideto_17d3r_integrity_run1`, `strideto_17d3_integrity_run1` (dropped after tests). Host Mongo `27018`.

## 42. Runtime health

After rebuild of `api-a`, `api-b`, `frontend` only (no `down`, no volume prune):

- frontend: healthy
- api-a `/api/health` 200; `/api/health/ready` 200
- api-b `/api/health` 200; `/api/health/ready` 200
- Mongo healthy; Redis healthy; Mailpit healthy; Caddy up
- Worker: not running (`workerRunning: false`)

## 43. Persistent DB mutation statement

No mass update of production/staging Agent/Agency rows. Tests used disposable `strideto_17d3r_*` / `strideto_17d3_*` databases that were dropped.

## 44. Backfill statement

Provider Domain backfill executed: **NO**

Persistent Agent/Agency migration executed: **NO**

## 45. Real provider Trust mutation statement

Real provider verification changed: **NO**

No Verified RA/ACSP records created to make visuals pass.

## 46. Actual findings

- Historical Agent register created org+owner+profile with no professional-area selection; incomplete agents could open `/agent/services`.
- Team invites were `{ email, role }` only.
- One mixed Agent sidebar showed education duties to every provider.
- `memberships[0]` is still not used; all active memberships are enumerated.
- Invite-aware registration was added so a new invitee is not forced to create an Independent domain merely to join an Agency.

## 47. Remaining gaps

- Browser visual matrix not proven.
- CMS live database still may show older “Agents & Agencies” labels until CMS is re-seeded/edited; seed defaults were updated in source only.
- Education onboarding wizard (identity/markets) remains education-oriented after domain selection; it is not a second contradictory domain chooser.
- Usage & Billing / Commerce remain reachable via Settings, not the domain sidebars.

## 48. Deferred items

Domain deletion/deactivation cascade; public Business Services marketplace; Business Client workspace; Service Request; Quote; Formation Case; Mailroom; payments; scanner; KMS; WAF; Turnstile; Phase 17D-4; Phase 18; multiple concurrent Agency memberships product (architecture already enumerates all).

## 49. Commits

1. `966ea6d` feat(provider): add provider domain onboarding and enrollment foundation
2. `7184e59` feat(ui): separate provider domains and workspace navigation
3. `e81d548` test(provider): verify multi-domain onboarding and team isolation
4. `docs(release): record phase 17d-3r provider domain correction` (this document)

## 50. Current HEAD

Will be the docs commit on `main` after this file is committed. Predecessor: `e81d548`.

## 51. Working tree

After this docs commit, remaining unstaged/untracked:

- `client/src/components/admin/AdminDataTable.jsx` (known WIP, untouched)
- `client/src/components/admin/AdminTableFilters.jsx` (known WIP, untouched)
- `client/src/components/common/FormField.jsx` (known WIP, untouched)
- `docker-compose.appenv-align.yml` (protected local, untracked)
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` (protected local, untracked)
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` (protected local, untracked)
- stash `{0}`: `wip: AdminTableFilters values wiring (pre-phase-10)` untouched

## 52. Worker

STOPPED

## 53. Push/deployment

Push: **NO**  
Deployment: **NO**

## 54. Phase 17D-4

NOT STARTED

## 55. Phase 18

NOT STARTED

---

## Explicit statements (required)

New Provider Domains: `education_mobility`, `business_services`

At least one domain required for new self-registration: **YES**

Required question bypassable: **NO**

New Agent silently defaults to Education: **NO**

Legacy Agent compatibility defaults to Education: **YES, compatibility only**

Business Domain selection grants professional verification: **NO**

Team domain access grants professional verification: **NO**

Personal ProviderCapability transfers to Agency: **NO**

Agency ProviderCapability transfers to member: **NO**

Provider Domain backfill executed: **NO**

Persistent Agent/Agency migration executed: **NO**

Real provider verification changed: **NO**

Public Business Services marketplace: **OFF**

Business Client workspace: **NOT IMPLEMENTED**

Provider HSI sharing: **NOT ENABLED**

Scanner: **NOT IMPLEMENTED**

KMS: **NOT IMPLEMENTED**

Payments: **NOT_CONFIGURED**

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 17D-4: **NOT STARTED**

Phase 18: **NOT STARTED**
