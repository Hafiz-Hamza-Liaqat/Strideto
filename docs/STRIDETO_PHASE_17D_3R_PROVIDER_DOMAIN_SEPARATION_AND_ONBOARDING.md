# STRIDETO PHASE 17D-3R
PROVIDER DOMAIN SEPARATION, MANDATORY ONBOARDING
& TEAM DUTY ACCESS CORRECTION

**STRIDETO PHASE 17D-3R IMPLEMENTATION: COMPLETE**

**FUNCTIONAL ACCEPTANCE: PASS**

**SCENARIO 1: PASS**

**SCENARIO 2: PASS**

**ENGINEERING CLOSURE AUDIT: PASS**

**AUTOMATED/BROWSER VISUAL ACCEPTANCE: PASS WITH EXPLICIT TOOLING/MANUAL LIMITATIONS**

---

## 1. Baseline

- Phase start predecessor: `c20a9a0` (`docs(release): record phase 17d-3 provider workspace`)
- Branch: `main`
- **Audited implementation HEAD:** `e39d0f39b5e60fee61dac662d0d40981baa68849` (`fix(ui): prevent feedback control overlapping mobile forms`)
- Tracked WIP left untouched: `AdminDataTable.jsx`, `AdminTableFilters.jsx`, `FormField.jsx`
- Protected local files left untracked: `docker-compose.appenv-align.yml`, `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`, `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Existing stash left untouched: `wip: AdminTableFilters values wiring (pre-phase-10)`
- Worker remained STOPPED
- No push, no deploy, no Phase 17D-4, no Phase 18

The first documentation snapshot was committed at `4cbccf4`. Subsequent USER + browser + engineering acceptance found three defects, each closed by a follow-up commit before this sign-off. Those findings are recorded in §46; they are not erased.

---

## 2. Problem being corrected

17D-3 added a real Business Services provider workspace inside the Agent portal, but the Agent experience still treated every provider as an education/study agent: one mixed sidebar, education-heavy dashboard, no mandatory professional-area question at registration, and agency invites that granted whole-organization membership without domain-scoped duties.

---

## 3. Repository audit

Audited Agent registration (`/agent/register`, `POST /api/auth/agent/register`), onboarding wizard, `ProtectedAgentRoute`, AgentLayout/nav, dashboard, Team/invite/accept, 17D-3 GBS routes, and public acquisition (navbar/footer `/agents`, `/agent/login`, directory). No public Business Services marketplace existed. No homepage “Become an Agent” card existed; the directory and register entry were updated instead of duplicating a new public marketplace page.

---

## 4. Provider Domain registry

Canonical source-controlled registry: `shared/provider/providerDomains.js`

| domainId | Public name |
|---|---|
| `education_mobility` | Education & Mobility |
| `business_services` | Business Formation & Corporate Services |

Unknown domain IDs: DENY. Architecture is additive.

---

## 5. Provider Domain persistence

Collection `ProviderDomainEnrollment`: `subjectType`, `subjectId`, `domainId`, `status`, `onboardingStatus`, `selectedAt`, `selectedBy`, `schemaVersion`, `recordVersion`. Unique `(subjectType, subjectId, domainId)`. Duplicate activation returns the existing enrollment.

Agent self domain ≠ Agency domain.

---

## 6. Legacy Agent compatibility

`AgentProfile.providerDomainInitializationState`: missing/null → `legacy` (compatibility only). Effective domain: `education_mobility` ONLY. No automatic `business_services`. No live backfill. Dry-run utility: `server/scripts/providerDomainLegacyDryRun.js` (does not write).

---

## 7. Required registration question

New self-registering providers must multi-select domain cards: Education & Mobility and/or Business Formation & Corporate Services. Selecting both cards = both. No contradictory “Both” radio.

Invite-aware registration (`?invite=`) does not force an Independent personal domain; agency domain access is enough.

---

## 8. Required validation behavior

Frontend: Continue disabled until at least one valid selectable domain; accessible error if submitted empty.

Backend: `validateRequiredProviderDomainSelection` rejects zero, unknown, and (when provider flag is off) `business_services`. No silent `undefined → education_mobility` for new accounts.

---

## 9. Registration failure safety

New accounts are created `pending`. Successful enrollment persistence marks `ready`. If enrollment throws, state remains `pending` and the route guard blocks operational workspace URLs. Duplicate enrollments are unique-index idempotent.

---

## 10. Provider Home

`/agent` is Provider Home (`ProviderHome.jsx`). It lists only authorized subject × domain workspaces, grouped Independent vs Agency, with server-authoritative domain-scoped counters.

---

## 11. One-domain behavior

Exactly one accessible workspace: login/home auto-opens that workspace. Provider Home remains at `/agent?home=1` with **+ Add another provider category**.

---

## 12. Multi-domain behavior

Two or more workspaces: default Provider Home. `localStorage strideto-provider-workspace` is UX only; stale/unauthorized preference is ignored. Preference never activates a domain.

---

## 13. Add Provider Category

`POST /api/agent/provider-domains` enrolls the requested domain for an authorized subject. Already-active → 200 existing. Does not auto-verify. UI redirects Business to capabilities setup and Education to verification.

Provider Home Add targets the exact subject group. Agency Add uses `subjectType=organization`. Independent Add uses `subjectType=agent`. GBS setup Add respects the exact URL subject. Ordinary members cannot activate an Agency domain.

---

## 14. Workspace context

UX context = `subjectType + subjectId + providerDomainId`. Server re-validates subject, domain enrollment, membership, and domain permission on protected operations. Context is not authority.

---

## 15. Independent vs Agency

Provider Home groups by subject label. Independent enrollments are never collapsed into Agency enrollments. Agency Business ≠ Independent Business.

---

## 16. Education & Mobility workspace

Existing education product relabeled, not rebuilt. Overview at `/agent/education`. `/agent/services` remains canonical Education & Mobility Services.

---

## 17. Business Services workspace

17D-3 routes preserved: `/agent/business-services`, capabilities, jurisdictions, listings. No fake Requests/Quotes/Formation Cases/Mailroom nav.

An inactive/unenrolled exact subject shows Add/setup state. Operational Business subnav does not mount. Visiting `/agent/business-services*` does not enroll a domain and does not mint `ProviderCapability`.

---

## 18. Sidebar separation

Shared: Provider Home, Profile, Identity & Organization / Trust Center, Messages, Notifications, Account Settings, Help, Team (agency).

Education workspace: Overview, Professional Verification, Education & Mobility Services, Marketplace, Availability, Student Leads, Clients, Consultations, Cases, Reviews.

Business workspace: Overview, Business Verification, Capabilities, Jurisdictions, Service Listings.

---

## 19. Verification/Trust separation

Trust Center layers Identity & Organization separately from Professional Domains. Copy distinguishes email/identity/organization from Education professional verification and Business capability verification. Education-only Trust Center does not expose operational Manage Business Verification.

---

## 20. Service separation

Education service form remains education categories only and rejects `capabilityId` / GBS capability IDs.

GBS listing create rejects education `AGENT_SERVICE_CATEGORIES` as `capabilityId`.

---

## 21. Posting-rule separation

Education posting continues existing education verification/marketplace rules.

Business listing still requires 17D-3 explicit ACTIVE VERIFIED `capabilityId` + scope + catalog/moderation. 17D-3 Mongo listing tests still pass.

---

## 22. Settings separation

Account Settings groups shared security/billing/notifications vs education-specific (availability/services) vs business-specific (GBS workspace). No fake future pages.

---

## 23. Agency domain activation

Organization type does not activate all domains. Agency domains are explicit enrollments on the organization subject. Owner/admin may add a domain. Ordinary members cannot. Activation ≠ professional verification.

---

## 24. Team invite

Invite payload now includes `domainAccess`. Only Agency-activated domains are assignable.

---

## 25. Required team domain selection

Frontend: Send Invite disabled at zero domains.

Backend: `provider_domain_selection_required` if zero. Agency without business cannot grant business access until the Agency activates `business_services`.

---

## 26. Team domain permissions

Source-controlled in `shared/provider/providerDomainPermissions.js`. Stored on `AgentMembership.domainAccess`. Existing roles `owner|admin|member` preserved. Permissions grant workspace duties only.

Legacy memberships without `domainAccess` map to education_mobility via existing role capabilities. They do not receive business_services.

`AgentMembership.recordVersion` is the stale-write field. `PATCH /agent/team/member/domain-access` accepts optional `expectedVersion`; a supplied stale version rejects with `409 optimistic_concurrency_conflict`. If `expectedVersion` is omitted, the current repository pattern permits last-write-wins. This is not mandatory CAS.

---

## 27. Personal vs Agency professional authority

Invite/domain access does not mint `ProviderCapability`. Personal RA/ACSP/formation trust does not transfer to Agency and vice versa. 17D-3 exact-subject rules remain. Team duty ≠ professional capability.

---

## 28. Membership leave/suspend behavior

Inactive/suspended memberships are excluded from `resolveAuthorizedProviderSubjects` (`active: true`). Agency workspace access ends. Personal enrollments/capabilities remain. `TEAM_DOMAIN_ACCESS_REMOVED` is audited on deactivation. No credential transfer. No data deletion.

---

## 29. Scenario 1 — final result: PASS

Disposable local Provider, Education selected first, Business added later.

Recorded outcome:

- New disposable Provider selected Education & Mobility only
- Zero-domain frontend prevented continuation
- Backend zero-domain registration rejected (`provider_domain_selection_required`)
- Education activated first
- Business Formation & Corporate Services explicitly added later
- Exactly one Business enrollment (Add Domain retry/idempotent)
- Both workspaces available after Add
- ProviderCapabilities remained zero / none auto-VERIFIED
- Education and Business services remained separated
- Re-login preserved truthful domain state

No production Trust mutation. Fixture passwords/tokens are not recorded here.

---

## 30. Scenario 2 — final result: PASS

Disposable local Agency, Education then Agency Business, Business-only invitee.

Recorded outcome:

- Agency Education active
- Agency Business explicitly added to the organization subject (`subjectType=organization`)
- Independent owner enrollment remained separate (none created by Agency Add)
- Agency Team invite showed only activated domains
- Zero-selection invite prevented (frontend disabled; backend `provider_domain_selection_required`)
- Business-only member received Agency Business access
- Business-only member did **not** receive Education operational access
- Team access minted no professional capability
- Ordinary member could not add Agency Education
- Membership deactivation removed Agency workspace access
- Personal/account state remained
- No credential transfer
- No data deletion

No production Trust mutation. Fixture passwords/tokens are not recorded here.

---

## 31. Public provider discoverability

Register title: “Join Strideto as a Service Provider” with both domain descriptions.

Directory intro explains both professional fields and links to register. Explicitly states Business Services public marketplace is not available.

Navbar/footer English labels: Service Providers / Provider Portal. CMS seed defaults updated (not a live CMS write).

---

## 32. Feature-flag behavior

- `isBusinessServicesProviderEnabled` = `BUSINESS_SERVICES_PROVIDER_ENABLED=1` OR `BUSINESS_SERVICES_ENABLED=1` (compat)
- `isBusinessServicesPublicMarketplaceEnabled` = `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=1` only (default OFF)
- Provider workspace middleware uses the provider flag
- Listing publication gate remains on `BUSINESS_SERVICES_ENABLED` for 17D-2/2R1 compatibility; listings stay private; no public marketplace routes
- When provider flag is off, Business card is Coming Soon / non-selectable; server rejects business enrollment
- Provider onboarding being enabled does **not** automatically expose the public marketplace
- Local QA override is only in untracked `docker-compose.appenv-align.yml` (not committed)

Public Business Services marketplace: **OFF**

---

## 33. Route compatibility

`/agent/services` preserved. `/agent/business-services/*` preserved. `/agent` is now Provider Home; education overview is `/agent/education`. No redirect loops. No public `/business-services` or `/business`.

---

## 34. Existing Agent regression

Phase 5 Agent portal source contract: 111 checks passed (nav IA updated to domain-specific labels). Mission 11 Agent/Agency portal: 30/30. Education dashboard, services, team, settings remain functional. Agent login/refresh/logout remain Agent-realm. No fifth Provider auth cookie.

---

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
| 17D-3 UI contract | 31 passed |
| 17D-3 Mongo workspace | 4/4 passed |

---

## 36. UI/theme

Semantic tokens reused (`bg-bg-main`, `dark:` variants, `cardClass`, primary). No new arbitrary white/black/gray palette. Public Navbar/Footer theme contract unchanged. Agent/Provider `PortalBrand` retained.

---

## 37. Responsive behavior

Domain cards: `grid-cols-1 md:grid-cols-2`, `break-words`, `min-w-0`. Switcher/menu `max-h-72 overflow-auto` and wrapping.

**Browser visual evidence: PASS for automatable required matrix, with explicit manual/tooling exceptions.**

### System (Appearance → System actually selected)

| Viewport | Result |
|---|---|
| 320 | PASS |
| 375 | PASS |
| 768 | PASS |
| 1024 | PASS |
| 1440 | PASS |

System → OS Light proven across the matrix. System → OS Dark proven at representative registration 375.

### Dark (Appearance → Dark actually selected)

| Viewport | Result |
|---|---|
| 375 | PASS |
| 768 | PASS |
| 1024 | PASS |

Body overflow: **PASS** on tested required screens (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`). Team members table uses inner `overflow-x-auto` at 320/375; that is not body overflow.

No shell blink: **PASS**. Agent/Provider shell remained mounted across Home → Education → Business → Trust → Home.

Below `sm`, Feedback participates in document flow. `sm+` retains fixed placement. Feedback is not mounted on the Agent portal shell.

---

## 38. Accessibility

Browser-verifiable evidence:

Registration:

- Native checkbox controls
- DOM `readOnly=false`
- No `readonly` DOM attribute
- Required fieldset
- `aria-required=true`
- Associated hint (`aria-describedby="provider-domains-hint"`)
- Selected state not color-only (“Selected” text)

Team:

- Native domain checkboxes
- Readable labels (Education & Mobility; Business Formation & Corporate Services)
- Zero selection prevents invite
- No raw permission identifiers exposed

Workspace switcher:

- Keyboard open / Escape proven
- WHO (subject) + WHICH (domain) context understandable
- Long subject names wrap
- Menu stays inside viewport

The accessibility tree’s checkbox `readonly` state is a **tooling artifact / not supported by DOM evidence**. It is not a confirmed product defect.

Full screen-reader pass remains USER MANUAL.

---

## 39. Browser visual evidence — final

**PASS for automatable required matrix, with explicit manual/tooling exceptions.**

Three visual/product defects were discovered during USER + browser acceptance and are **CLOSED** (§46).

### Manual / tooling limitations (not application defects; do not block engineering closure)

**Native browser 200% zoom:** NOT PROVEN / USER MANUAL. Browser automation cannot control real Chrome UI zoom. CSS `zoom`, `transform: scale`, and `devicePixelRatio` were not used as substitute evidence.

**Actual screen reader:** NOT PROVEN / USER MANUAL. Accessibility-tree inspection is not equivalent to a real screen-reader session.

**Automated keyboard Space / focus-visible:** PARTIALLY NOT PROVEN / TOOLING. DOM/native semantics were inspected; automation did not reliably reproduce all native key / `:focus-visible` behavior.

---

## 40. USER acceptance scenarios

Manual steps remain the operator checklist. Final results are §29 and §30 (**PASS**). Do **not** mutate real production provider Trust.

---

## 41. Tests — final accepted counts

| Suite | Count |
|---|---|
| 17D-3R source contract | 64 |
| 17D-3R UI contract | 45 |
| 17D-3R Mongo | 9/9 |
| 17D-3 source contract | 57 |
| 17D-3 UI contract | 31 |
| 17D-3 pricing/risk catalog | 25 |
| 17D-3 Mongo workspace | 4/4 |
| Phase 5 Agent portal | 111 |
| Mission 11 Agent/Agency portal | 30/30 |
| 17D-0 workspace context | 73 |
| 17D-1 focused | 106 + 76 + 41 |
| 17D-1R1 | 38 + 39 |
| 17D-1R2 | 52 |
| 17D-2 | 345 + 27 |
| 17D-2R1 | 43 + 27 |
| Feedback mobile regression | 9 |
| Module graph | PASS (1873 modules / 5965 imports) |
| Server syntax / touched-file lint | PASS (0 eslint errors on 17D-3R files) |
| Frontend production build | PASS |

Isolated Mongo DBs used during closure: disposable `strideto_17d3r_*` / `strideto_17d3_*` databases (dropped after tests). Host Mongo `27018`.

---

## 42. Runtime health

Final audited runtime (closure audit; rebuild of `api-a`, `api-b`, `frontend` only; no `down`, no volume prune):

- frontend: healthy
- api-a `/api/health` 200; `/api/health/ready` 200
- api-b `/api/health` 200; `/api/health/ready` 200
- Mongo healthy; Redis healthy; Mailpit healthy; Caddy running
- Worker: not running (`workerRunning: false`)
- No unexpected provider-route 5xx during closure audit

---

## 43. Persistent DB mutation statement

No mass update of production/staging Agent/Agency rows. Tests used disposable `strideto_17d3r_*` / `strideto_17d3_*` databases that were dropped. Disposable local/test fixtures were used for acceptance only. No mass cleanup or production mutation.

---

## 44. Backfill statement

Provider Domain live backfill executed: **NO**

Persistent Agent/Agency migration executed: **NO**

---

## 45. Real provider Trust mutation statement

Real provider verification changed: **NO**

Verified RA/ACSP records created for acceptance: **NO**

---

## 46. Acceptance findings and closures

Historical product gaps corrected by the 17D-3R foundation (registration question, domain enrollments, team `domainAccess`, sidebar split) remain as originally audited.

USER + browser acceptance after `4cbccf4` then found three additional defects. Each was closed before engineering sign-off.

### Finding A — inactive Business workspace chrome — CLOSED

Initial visual acceptance found an Education-only provider could open `/agent/business-services*` and see Business operational chrome despite no Business enrollment.

Correction: `78b6b423fad9d7a3e0f7b365d98addba876fa535` `fix(provider): deny inactive domain operational workspace chrome`

After fix:

- inactive exact subject shows Add/setup state
- operational Business subnav does not mount
- URL visit creates no enrollment
- URL visit creates no ProviderCapability
- Education-only Trust Center no longer exposes operational Manage Business Verification
- positive Business-authorized workspace still works

### Finding B — Agency Add Domain subject targeting — CLOSED

Scenario 2 found Agency owner/admin Add Domain UI always targeted the Independent Agent subject.

Correction: `87f132f25a4c6f3b368f4124ffd2889164fedd37` `fix(provider): target agency domain activation to organization subject`

After fix:

- Provider Home Add action targets the exact subject group
- Agency Add targets `subjectType=organization`
- Independent Add targets `subjectType=agent`
- GBS setup respects exact URL subject
- owner/admin may activate an Agency domain
- ordinary member cannot
- no capability minted
- Agency Business ≠ Independent Business

### Finding C — Feedback mobile overlap — CLOSED

Visual matrix found the Feedback fixed control overlapped registration fields at 320/375.

Correction: `e39d0f39b5e60fee61dac662d0d40981baa68849` `fix(ui): prevent feedback control overlapping mobile forms`

After fix:

- below `sm`, Feedback participates in document flow
- `sm+` retains fixed placement
- 320 PASS
- 375 PASS
- no horizontal body overflow
- form controls remain reachable
- Feedback remains accessible

**Known open implementation blockers: NONE**

---

## 47. Remaining non-blocking notes

- Native 200% browser zoom: USER MANUAL
- Real screen-reader session: USER MANUAL
- Native keyboard/focus-visible confirmation where desired: USER MANUAL / tooling
- CMS live database may still show older “Agents & Agencies” labels until CMS is re-seeded/edited; seed defaults were updated in source only
- Education onboarding wizard (identity/markets) remains education-oriented after domain selection; it is not a second contradictory domain chooser
- Usage & Billing / Commerce remain reachable via Settings, not the domain sidebars

These are not known implementation/security/visual blockers.

---

## 48. Deferred items

Domain deletion/deactivation cascade; public Business Services marketplace; Business Client workspace; Service Request; Quote; Formation Case; Mailroom; payments; scanner; KMS; WAF; Turnstile production enablement; Phase 17D-4; Phase 18; multiple concurrent Agency memberships product (architecture already enumerates all).

Public Business Services marketplace: **OFF**  
Business Client workspace: **NOT IMPLEMENTED**  
Provider HSI sharing: **NOT ENABLED**  
Scanner: **NOT IMPLEMENTED**  
KMS: **NOT IMPLEMENTED**  
Payments: **NOT_CONFIGURED**  
Phase 17D-4: **NOT STARTED**  
Phase 18: **NOT STARTED**

---

## 49. Commits

Complete 17D-3R implementation/fix sequence (audited implementation HEAD is item 7):

1. `966ea6de723925a98f9ea95862b26208b29b3618` `feat(provider): add provider domain onboarding and enrollment foundation`
2. `7184e59e07ebb8e02230e1d202095427aa7abf52` `feat(ui): separate provider domains and workspace navigation`
3. `e81d548392ed0a558c98d087fc4257bb2f8eb074` `test(provider): verify multi-domain onboarding and team isolation`
4. `4cbccf49cee18cc93d646772159b01979202ddd2` `docs(release): record phase 17d-3r provider domain correction`
5. `78b6b423fad9d7a3e0f7b365d98addba876fa535` `fix(provider): deny inactive domain operational workspace chrome`
6. `87f132f25a4c6f3b368f4124ffd2889164fedd37` `fix(provider): target agency domain activation to organization subject`
7. `e39d0f39b5e60fee61dac662d0d40981baa68849` `fix(ui): prevent feedback control overlapping mobile forms`

This documentation sign-off is a subsequent docs-only commit on `main`. It does not change implementation.

---

## 50. Audited implementation HEAD

`e39d0f39b5e60fee61dac662d0d40981baa68849`

`fix(ui): prevent feedback control overlapping mobile forms`

This is the audited implementation HEAD. The docs sign-off commit that records this report is a later, separate commit.

---

## 51. Working tree / source-control safety

Throughout closure, tracked WIP remained untouched:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Protected local files remained uncommitted:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Stash `{0}`: `wip: AdminTableFilters values wiring (pre-phase-10)` untouched.

No push. No deploy.

---

## 52. Worker

STOPPED

---

## 53. Push/deployment

Push: **NO**  
Deployment: **NO**

---

## 54. Phase 17D-4

NOT STARTED

---

## 55. Phase 18

NOT STARTED

---

## 56. Engineering closure

**17D-3R ENGINEERING CLOSURE AUDIT: PASS**

### Input validation

PASS. Server-authoritative `validateRequiredProviderDomainSelection`; unknown domain rejected; zero registration/team selection rejected; untrusted body cannot set verification, capability trust, admin permissions, owner invite role, or professional verification.

### Domain concurrency

PASS. Unique `(subjectType, subjectId, domainId)` index plus duplicate-key (`11000`) reconciliation. Two simultaneous Add Domain commands yield one logical enrollment.

### Team stale-write protection

PASS. `AgentMembership.recordVersion`. Optional `expectedVersion`. Supplied stale version → `409 optimistic_concurrency_conflict`. If `expectedVersion` is omitted, current repository pattern permits last-write-wins. This is not mandatory CAS.

### Idempotency

PASS. Onboarding completion is safe if already `ready`/`legacy`. Add Domain uniqueness/idempotency. Duplicate pending invite rejected (`DUPLICATE_INVITE`). Duplicate account registration prevented (generic existing-email response).

### Audit events

All required events implemented on the shared GBS audit catalog (`logAudit` + `redactAuditMetadata`):

- `provider_domain_selected`
- `provider_domain_added`
- `provider_domain_onboarding_completed`
- `provider_domain_access_denied`
- `agency_provider_domain_activated`
- `team_domain_access_granted`
- `team_domain_access_updated`
- `team_domain_access_removed`
- `provider_workspace_context_denied`

No sensitive token/password/invite-secret/evidence bodies intentionally logged.

### Rate/abuse controls

PASS. Existing Redis-backed limiters reused. No new CAPTCHA. Turnstile remains not_configured unless separately enabled.

| Mutation | Protection |
|---|---|
| Provider-domain onboarding | `providerDomainWriteLimiter` |
| Add Domain | `providerDomainWriteLimiter` |
| Team invite | `agentTeamInviteLimiter` |
| Team domain-access update | `agentTeamInviteLimiter` |
| Agent registration | `employerAuthLimiter` |
| Global API | `apiLimiter` |

### Route/subject authority

PASS. Context is UX. Server re-checks Agent realm, subject, enrollment, membership, domain permission, and ProviderCapability/listing scope as applicable.

### Auth realm isolation

PASS. No fifth Provider cookie. Employer/Institution/User cannot use Provider/Agent APIs. 17D-0 workspace/public identity intact.

### Feature flags

PASS. Provider workspace flag separate from public marketplace flag. Marketplace remains OFF.

### Module integrity

PASS. `1873` modules / `5965` relative imports (`scripts/verify-module-link-integrity.mjs`).

### Server checks

PASS. `node --check` on core 17D-3R modules; eslint 0 errors on touched 17D-3R server files.

### Frontend production build

PASS.

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

Verified RA/ACSP created for acceptance: **NO**

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

Remaining USER-manual evidence: native 200% browser zoom; real screen-reader session; native keyboard/focus-visible confirmation where desired.

No known implementation/security/visual blocker remains.
