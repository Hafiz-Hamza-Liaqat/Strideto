# STRIDETO PHASE 17D-3
BUSINESS SERVICES PROVIDER WORKSPACE

This is **not** Phase 17D-4. This is **not** Phase 18.

Persistent catalog import: **NO**

Capability backfill: **NO**

Real provider verification: **NO**

Real provider listing publication: **NO**

Public Business Services: **OFF**

Business Client workspace: **NOT IMPLEMENTED**

Service Request: **NOT IMPLEMENTED**

Quote product: **NOT IMPLEMENTED**

Formation Case: **NOT IMPLEMENTED**

Provider HSI sharing: **NOT ENABLED**

Scanner: **NOT IMPLEMENTED**

KMS: **NOT IMPLEMENTED**

Payments: **NOT_CONFIGURED**

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 17D-4: **NOT STARTED**

Phase 18: **NOT STARTED**

---

## 1. Baseline

- Expected HEAD at start: `93a9cb5`
- Confirmed: `93a9cb5` `docs(release): record phase 17d-2r1 catalog truth closure` on `main`
- Architecture documents were not reopened or silently reinterpreted
- Known tracked WIP left untouched:
  - `client/src/components/admin/AdminDataTable.jsx`
  - `client/src/components/admin/AdminTableFilters.jsx`
  - `client/src/components/common/FormField.jsx`
- Protected/local files never staged:
  - `docker-compose.appenv-align.yml`
  - `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
  - `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`
- Older stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`
- No `git stash -u`, no `docker compose down`, no volume prune, no push, no deploy, no worker start
- Isolated test DBs used `strideto_17d3_*` / `strideto_17d1r1_integrity_*` / `strideto_17d2_*` and were dropped after tests

---

## 2. Agent/Agency membership audit

- One AgentAccount has exactly one AgentProfile
- AgentProfile.organizationId is the home Organization (`organizationType: agent` or `agency`)
- AgentMembership is unique per (organization, account), with `active` plus roles `owner|admin|member`
- Product currently prevents a second active agency via existing invite `CROSS_ORGANIZATION_DENIED`, but GBS enumerates **all** active memberships and never uses `memberships[0]`
- Institution `memberships[0]` pattern was not copied
- Some existing Agent commerce/case paths use unscoped `findOne({ active: true })` — GBS does not copy that
- `activeWorkspace` / localStorage has **zero** server authority
- Independent Agent home org (`organizationType: 'agent'`) is **not** an Agency GBS subject
- Agency GBS subject requires: active membership **and** `organizationType === 'agency'` **and** org not suspended/archived

---

## 3. Provider-subject context design

Canonical resolver: `resolveAuthorizedProviderSubjects(agentAccountId)`

Always returns:

1. Agent self: `{ subjectType: 'agent', subjectId: agentAccountId, label: '<name> — Independent' }`
2. Every authorized Agency Organization the Agent may actually act for

Preference key `strideto-gbs-provider-subject` is UX-only. Unknown/stale preference falls back to the first authorized subject (Independent). Unauthorized Agency is never selected silently.

---

## 4. Subject authorization

`assertAuthorizedProviderSubject` re-checks membership on every protected read/write.

Wrong subject → `404 provider_subject_context_denied` without existence leak, audited.

Suspended Agent → GBS workspace denied.

Suspended/archived Organization cannot be used as a provider subject.

No fifth auth realm. No formation-provider cookie. No registered-agent cookie. No universal auth token.

---

## 5. Provider workspace IA

Inside existing Agent portal (`ProtectedAgentRoute` + `AgentLayout`):

- `/agent/business-services` Overview
- `/agent/business-services/capabilities`
- `/agent/business-services/jurisdictions`
- `/agent/business-services/listings`
- `/agent/business-services/listings/new`
- `/agent/business-services/listings/:listingId/edit`

One sidebar entry: **Business Services** (gated). Subnav: Overview, Capabilities, Jurisdictions, Service Listings.

Distinction:

- Services → existing education/mobility professional services
- Business Services → formation/corporate-services provider workspace
- Trust → cross-product identity/org verification

No Requests, Quotes, Cases, Clients, Documents, Mailroom, Compliance, Revenue/Payouts modules.

No public `/business-services`. No Business Client `/business`.

---

## 6. Feature flag behavior

`BUSINESS_SERVICES_ENABLED` default **OFF**.

Server: `requireBusinessServicesEnabled` on all GBS routes except `GET /api/agent/business-services/enabled` (Agent-auth probe so the nav can hide without a Vite rebuild).

Frontend-hidden is not sufficient; disabled writes/reads return `403 business_services_feature_disabled`.

Production/staging secrets were not modified. Public marketplace remains unpublished.

Local visual acceptance may set a controlled non-production override; that is USER-owned and was not written into staging secrets.

---

## 7. Overview/dashboard

Setup/readiness cards only. No fake 0-grid for unimplemented domains.

Allowed counters only: capability claims, verified, under review, needs information, suspended, jurisdictions covered by verified capability, draft listings, listings under review, approved internal listings.

---

## 8. Server-authoritative counters

`getProviderWorkspaceSummary({ subjectType, subjectId })` queries Mongo for that exact subject.

Agent self does not include Agency records. Agency does not include personal Agent records.

---

## 9. Capability catalog

Canonical IDs only: `business_formation`, `formation_consultation`, `document_preparation`, `registered_agent`, `registered_office`, `ein_assistance`.

Labels come from `BUSINESS_SERVICES_CAPABILITIES`. Unknown IDs rejected. No provider-defined capability IDs.

---

## 10. Capability claim flow

Provider may claim. Provider may not self-verify.

Forbidden request fields stripped: `trustStatus`, `reviewedBy`, `protectedTitleVerified`, `status`, `recordVersion`, `review`.

Duplicate active `subject+capabilityId` returns the existing row (`created: false`) and a partial unique index guards the race.

Scope updates allowed only while `claimed` or `evidence_submitted`.

---

## 11. Evidence metadata

Non-HSI metadata only: registry reference, official HTTPS URL (stored, never fetched), issuing authority id, effective/expiry dates, public-safe notes.

No passport/national ID/licence scans. Provider website is not official proof.

Protected-title cards show: **Evidence submission requires additional verification support**.

---

## 12. Protected-title UX

Registered Agent / Registered Office are visibly distinct.

Copy uses **Registered Agent capability**, not “Licensed Registered Agent”.

UK formation does not mint ACSP. Org Verified does not mint a protected title.

---

## 13. Jurisdiction coverage

Provider page is catalog-driven (source-controlled manifest projection). PK / US / GB launch countries. US 50+DC exist structurally. Draft/structural rows are labelled **structural availability** / **candidate**, never CURRENT.

---

## 14. Entity-type scoping

Entity types are filtered by selected `jurisdictionId`. UK does not expose Wyoming LLC.

Server listing/claim authority still enforces scope subset.

---

## 15. Catalog/current-fact projection

`projectProviderCatalog()` uses `loadGbsCatalogManifest()` + `resolvePublicationEligibility`.

CURRENT may display as current fact. STALE is labelled not current. `not_catalogued` amount is `null`, never `0`.

No frontend static-array bypass. No persistent Admin-review import.

---

## 16. Service Listing model

`GbsServiceListing`: exact subject, capabilityId, jurisdiction/entity scope, copy, delivery, languages, pricingMode, providerFeeLines (integer minor units + currency, ownership=provider), provider turnaround estimate, moderationStatus, publicationStatus (always private in this phase), contentRevision, recordVersion, creationCommandId (unique sparse).

---

## 17. Listing lifecycle

`draft → under_review → needs_information | approved | rejected | suspended | archived`

Frozen 17D-B §5.9: **create (including draft) requires ACTIVE VERIFIED explicit capabilityId** for the exact subject and scope subset.

Draft is PRIVATE. Approved ≠ public. `publicationStatus` cannot become `public`. Provider cannot approve/publish/verify/unsuspend.

Archive allowed for draft / needs_information / rejected only.

---

## 18. Listing scope authorization

`authorizeGbsProviderAction` on create, update, and submit.

Legacy ProviderCapability without `capabilityId` is readable historically and **not** GBS-authoritative.

Agency cannot use Agent personal capability. Agent cannot use Agency capability. WY ≠ DE. Formation ≠ RA. Formation ≠ ACSP.

---

## 19. Material-change/re-review

Material fields: capability, jurisdiction, entity types, title/descriptions, included/excluded, pricing, protected-title ids.

Approved + material edit → `under_review`, `contentRevision++`, audit `gbs_listing_material_change`.

Provider-supplied `moderationStatus` / `publicationStatus` are ignored on update.

---

## 20. Concurrency

`mutateGbsServiceListingRecord` CAS on `_id + recordVersion + subject`. Stale → 409. Wrong subject → 404 `listing_not_found`.

---

## 21. Idempotent listing creation

Mongo idempotency store (`executeHighValueIdempotentCommand`) + domain unique `creationCommandId`.

Same command → one listing (replay). Same command id + different fingerprint → 409 conflict. Duplicate-key crash window reconciles to the existing listing.

No in-memory production authority.

---

## 22. Provider pricing

Modes: `fixed`, `starting_at`, `range`, `quote_required`.

Currency is explicit. Never inferred from country, locale, or address.

`quote_required` stores no fake mandatory fixed price. Range requires min ≤ max, same currency. Negative amounts rejected. Provider lines cannot be labelled government.

---

## 23. Government-fee separation

Government fees are catalog read-only projections (source label, URL, lastReviewedAt, current/stale/not_catalogued).

Provider cannot PATCH catalog amounts. Listing editor shows them separately from provider fees. No “total government package” invented.

---

## 24. EIN fee behavior

When `ein_assistance` applies: current IRS government fee USD **0** is shown as government truth when CURRENT.

Provider assistance is a separate provider fee and is not labelled as an IRS fee. EIN issuance is not guaranteed.

---

## 25. Turnaround truth

`providerTurnaroundEstimate` is labelled **provider-defined estimate**. It is not government processing time. High-risk “government approval in N days” language is review-flagged.

---

## 26. Claim-risk moderation

Deterministic classifier (`claimRiskClassifier.js`). Paid AI stays OFF.

Flags government affiliation, guaranteed registration/bank/Stripe/Amazon/visa, tax-free guaranteed, licensed-RA without RA capability, provider fee labelled government.

“We do not guarantee approval” is treated as a disclaimer, not a positive guarantee.

Flagged listings still go to Admin review; no auto-verify or auto-ban from text.

---

## 27. Provider-private API

All under `/api/agent/business-services/*` with `requireAuth` + `requireAgentAuth` (+ feature flag except `/enabled`).

Employer / Institution / User cookies cannot satisfy `requireAgentAuth`.

Projections omit reviewer IDs, internal notes, sensitive evidence, security-policy internals.

Pagination bounded (`LIST_PAGE_MAX` 50). Filters/sort allowlisted.

---

## 28. Audit events

Added/used: `provider_subject_context_denied`, `provider_capability_claim_created`, `provider_capability_scope_updated`, `provider_capability_evidence_submitted`, `gbs_listing_draft_created`, `gbs_listing_updated`, `gbs_listing_material_change`, `gbs_listing_submitted_review`, `gbs_listing_archived`, `gbs_listing_scope_denied`, `gbs_listing_risk_flagged`, `gbs_listing_idempotency_replay`, `gbs_listing_idempotency_conflict`.

No credentials, tokens, or document contents. Opaque IDs only.

---

## 29. Rate/resource budgets

Distinct buckets (15-minute writes unless noted):

- `gbs-capability-write` — claim/evidence (prod 30 / 15 min)
- `gbs-listing-write` — create/update/submit/archive (prod 40 / 15 min)
- `gbs-provider-read` — catalog/overview/list (prod 90 / min)

No CAPTCHA. Turnstile remains NOT_CONFIGURED.

Bounds: languages 16, entityTypeIds 16, included/excluded 30, fee lines 20, evidence rows 20, jurisdiction ids 32.

---

## 30. Input validation

Server validates capabilityId, subject, countryCode, jurisdictionId, entity types, currency, integer minor units, pricingMode, title/description lengths, arrays, turnaround, URLs, dates, recordVersion, creationCommandId, page/limit/status filters.

No `req.body` spread into models. Mass-assignment of trust/publication fields stripped.

---

## 31. Tenant/subject isolation

Exact `subjectType + subjectId` on every query. Cross-subject listing/capability access is 404. Preference never grants authority. Multiple agencies are not collapsed to `[0]`.

---

## 32. HSI/file statement

Provider HSI sharing: **NOT ENABLED**. No MediaAsset licence/passport uploads. Evidence URLs stored only. No `fetch(req.body.url)`.

---

## 33. Catalog import statement

Persistent catalog import: **NO**. Runtime projection from source-controlled manifests only.

---

## 34. Real provider mutation statement

Real provider verification: **NO**. Real listing publication: **NO**. Tests used isolated DBs. Persistent `edurozgaar` Agent Trust / catalog / listings were not mutated.

---

## 35. Existing Agent regression

Agent layout, PortalBrand `role="agent"`, Services/Marketplace/Trust/Availability/Team unchanged except one gated Business Services nav item.

`phase17d0WorkspaceContext.test.js`: 73 passed. `phase17cvThemeNavPortals.test.js`: 20 passed.

---

## 36. Authority regression

17D-1 / 17D-1R1 / 17D-1R2 / 17D-2 / 17D-2R1 source tests passed (Student vs Business Client, legacy fallback, staff no auto-student, global deny, realm isolation, explicit capabilityId, listing subset, protected titles, source freshness).

Mongo CAS regressions passed on isolated DBs.

---

## 37. UI/theme implementation

First GBS visual phase uses `surfaceClasses` (`ui`), Button, SearchableSelect, DateInput. FormField WIP was not touched.

Agent sidebar/brand unchanged. Public Navbar/Footer contract untouched. No StudentPortalNav inside Agent GBS.

---

## 38. Responsive strategy

Page max-width remains Agent `max-w-6xl`. Cards wrap. Listings: stacked cards below `lg`, table from `lg` up. No overflow-x-auto for the listings screen. Subject switcher `max-w-xl min-w-0`. Long labels use `break-words`.

---

## 39. Accessibility

Semantic headings, labelled comboboxes, dialog/menu reuse via SearchableSelect (Escape, listbox, focus), error `role="alert"`, status badges include text (not color-only), table headers on desktop listings.

---

## 40. Browser visual evidence

**NOT PROVEN**

Local TLS (`https://localhost:8443`) was not used for an authenticated Agent GBS walkthrough in this phase. Business Services remains flag-default OFF, so the nav is hidden without a USER-owned non-production override.

Do not treat this as visual PASS.

---

## 41. USER manual acceptance status

**REQUIRED**

Checklist:

A. Open Agent portal (existing Agent login)
B. With a local non-production `BUSINESS_SERVICES_ENABLED=1` override, open Business Services
C. Verify Independent subject; if multiple agencies exist, use the switcher (it must not grant extra authority)
D. Overview counters (real zeros/counts only)
E. Capabilities taxonomy
F. Claim a known capability (stays CLAIMED)
G. Jurisdiction selector from catalog; UK must not list Wyoming LLC
H. Evidence metadata (no file upload)
I. Listings empty/list
J. Create draft — server will reject until a VERIFIED capability exists (frozen policy). Do not verify a real Agent in `edurozgaar`
K. Pricing: explicit currency; quote_required has no fake fixed price
L. Government fee display: DE LLC USD 110 current; IRS EIN USD 0 current; SECP not catalogued ≠ 0
M. Submit requires VERIFIED; listing stays private
N. Light
O. Dark
P. System
Q. 320 / 375
R. 768
S. 1440
T. 200% zoom

Do not require live catalog import or real provider verification for visual checks.

---

## 42. Tests

17D-3 focused:

- `phase17d3SourceContract.test.js` — 56 assertions
- `phase17d3PricingRiskCatalog.test.js` — 25 assertions
- `phase17d3ProviderWorkspaceUi.test.js` — 25 assertions
- `phase17d3ProviderWorkspace.mongo.test.js` — 4 tests passed (subject, claim, listing CAS/idempotency)

Authority regression (passed): 17D-1 family, 17D-2 family, 17D-2R1, 17D-0 workspace, 17D-1R1/17D-2 Mongo CAS.

Frontend production build: passed.

Touched-file lint: no errors.

---

## 43. Runtime health

After rebuild of api-a, api-b, frontend only:

- frontend healthy
- api-a `/api/health` 200, `/api/health/ready` 200
- api-b `/api/health` 200, `/api/health/ready` 200
- mongodb healthy
- redis healthy
- mailpit healthy
- caddy running
- worker STOPPED (`edurozgaar-staging-worker-1 Exited`)

---

## 44. Actual findings

- Frozen 17D-B §5.9 requires VERIFIED even for listing **create**. The 17D-3 prompt’s optional “draft from CLAIMED” policy was **not** adopted. Draft remains private; submit still requires VERIFIED.
- Product currently allows at most one active agency membership, but GBS still enumerates all active memberships rather than `memberships[0]`.
- Independent home Organization is type `agent` and is not treated as an Agency subject.
- Catalog facts for provider UI are source-controlled projections, not persistent reviewed DB rows. That matches “no live import” and does not replace Admin catalog architecture.

No architecture contradiction required a product-policy decision beyond following the frozen listing-create rule.

---

## 45. Remaining gaps

- Admin GBS moderation UI (later Admin phase)
- Provider file/Vault evidence
- Public marketplace
- Browser visual matrix (USER)
- Feature remains OFF in staging/production secrets

---

## 46. Deferred items

Phase 17D-4, public Business Services, Business Client workspace, Service Request, Quote, Formation Case, Mailroom, payments, scanner, KMS, WAF, Turnstile, Phase 18.

---

## 47. Commits

1. `0070c75` `feat(gbs): add provider business services workspace foundation`
2. `a05c203` `feat(ui): add responsive provider business services workspace`
3. this report (`docs(release): record phase 17d-3 provider workspace`)

Listing APIs shipped with the backend foundation commit because they share the Agent-private router and CAS/idempotency stack. UI including listing editor is a separate commit.

---

## 48. Current HEAD

Start: `93a9cb5`

After 17D-3 commits: `a05c203` plus the following docs commit on `main`.

---

## 49. Working tree

Intended remaining unstaged/untracked after this report:

- `client/src/components/admin/AdminDataTable.jsx` (WIP)
- `client/src/components/admin/AdminTableFilters.jsx` (WIP)
- `client/src/components/common/FormField.jsx` (WIP)
- `docker-compose.appenv-align.yml` (protected local)
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md` (protected local)
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md` (protected local)

Stash untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`

---

## 50. Worker

**STOPPED**

---

## 51. Push/deployment

Push: **NO**

Deployment: **NO**

---

## 52. Phase 17D-4

**NOT STARTED**

---

## 53. Phase 18

**NOT STARTED**

---

## 54. Frozen §35 gate answers

**What new authority was introduced?**  
Agent-realm GBS provider actions for an exact authorized subject (Agent self or Agency membership). Listing create/update/submit require explicit known `capabilityId` + ACTIVE VERIFIED same-subject capability + scope subset. Provider cannot self-verify, approve, or publish.

**What new data was introduced?**  
Private `GbsServiceListing` records; ProviderCapability claims/evidence metadata created only in isolated tests. No persistent catalog import. No production Trust mutation.

**What tenant/subject boundary was introduced?**  
Exact `subjectType + subjectId`. Independent Agent ≠ Agency. Multiple agencies are not `[0]`. Preference is not authority.

**What abuse path was introduced?**  
Authenticated Agent GBS writes (claim, evidence metadata, listing CRUD/submit).

**What rate/resource limits protect it?**  
Separate capability-write, listing-write, and provider-read limiters plus array bounds.

**What audit events record it?**  
The 17D-3 GBS audit catalog listed in §28.

**What recovery impact exists?**  
Draft listings and claims can be archived/left unreviewed. No public publication to unwind. Isolated test DBs dropped.

**What UI/theme surfaces were added?**  
Agent-private Business Services Overview, Capabilities, Jurisdictions, Listings, Create/Edit, subject switcher.

**What responsive evidence exists?**  
Source-contract/UI tests for cards vs table, wrap, min-w-0. Browser matrix **NOT PROVEN**.

**What backward compatibility exists?**  
Existing Agent education/mobility portal unchanged aside from one gated nav item. 17D-1/2 authority intact. Legacy capability without `capabilityId` remains non-authoritative for GBS.

**Was this security authorization policy or operational configuration?**  
Security authorization policy (subject + capability + listing subset) plus operational feature flag default OFF.

**What concurrency/idempotency protects mutations?**  
recordVersion CAS; Mongo idempotency + `creationCommandId` unique index.

**What listing subset protection exists?**  
`authorizeGbsProviderAction` on create/update/submit. Frontend filters are not authorization.

**What Vault/HSI behavior changed?**  
None. HSI/file sharing not enabled.

**What catalog freshness/effective-date behavior applies?**  
Canonical eligibility service: CURRENT vs STALE vs not_catalogued. Draft jurisdictions are not CURRENT. EIN USD 0 and DE LLC USD 110 remain current when eligibility says so.

---

## Hard success conditions

1–68 as specified in the phase prompt are met in source/server tests and runtime health, except:

- Browser visual 320–1440 × System/Light/Dark and 200% zoom: **NOT PROVEN** (USER manual acceptance required)
- Visual “works” claims are therefore not made
