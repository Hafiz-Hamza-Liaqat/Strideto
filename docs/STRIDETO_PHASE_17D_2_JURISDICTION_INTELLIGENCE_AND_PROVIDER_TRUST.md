# STRIDETO PHASE 17D-2
JURISDICTION INTELLIGENCE, OFFICIAL SOURCE CATALOG
& PROVIDER CAPABILITY TRUST

This is **not** Phase 17D-3. This is **not** Phase 18.

Persistent catalog import executed: **NO**

Persistent User/Org capability backfill: **NO**

Real provider capability verification: **NO**

Public GBS routes: **NONE**

GBS UI: **NONE**

Business Services feature: **OFF**

Provider HSI sharing: **NOT ENABLED**

Scanner: **NOT IMPLEMENTED**

KMS: **NOT IMPLEMENTED**

Payments: **NOT_CONFIGURED** (unchanged)

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 17D-3: **NOT STARTED**

Phase 18: **NOT STARTED**

---

## 1. Baseline

- Expected HEAD at start: `8b36f2a`
- Confirmed: `8b36f2a` `docs(release): record phase 17d-1r2 legacy fallback closure` on `main`
- Architecture documents were not reopened or reinterpreted:
  - `docs/STRIDETO_PHASE_17D_A_GLOBAL_BUSINESS_SERVICES_ARCHITECTURE_GAP_AUDIT.md`
  - `docs/STRIDETO_PHASE_17D_B_PRODUCT_AUTHORITY_SECURITY_ARCHITECTURE_LOCK.md`
  - `docs/STRIDETO_PHASE_17D_1_BUSINESS_CLIENT_AUTHORITY_FOUNDATION.md`
  - `docs/STRIDETO_PHASE_17D_1R1_AUTHORITY_FOUNDATION_INTEGRITY_CLOSURE.md`
  - `docs/STRIDETO_PHASE_17D_1R2_LEGACY_CAPABILITY_FALLBACK_CLOSURE.md`
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

---

## 2. Legacy-window read-only audit

**READ ONLY.** No repair. No backfill. No user mutation. No PII printed.

Detection window (commit/runtime boundary, **not** authorization logic):

- Capability-era start: `25f9ccf` `feat(auth): add auditable user and organization capability grants` at `2026-08-14 16:38:45 +0500`
- R2 fix: `8c6e442` `fix(auth): isolate legacy student fallback from new registrations` at `2026-08-14 17:45:48 +0500`
- Query window used: `2026-08-14T11:30:00.000Z` … `2026-08-14T12:50:00.000Z`
- Database: persistent staging `edurozgaar` on host `27018`

Counts:

| Metric | Count |
| --- | ---: |
| Total User documents | 116 |
| Historical pattern (`role=User`, schema missing/`<1`, init state unset) | 105 |
| User-role rows created inside the capability-era window | **0** |
| Suspicious ambiguous capability-era rows (window + missing active student grant) | **0** |

All 116 users currently have `capabilitySchemaVersion` missing and `capabilityInitializationState` missing. That is the expected historical/legacy shape. None were created during the 17D-1 → 17D-1R2 hole.

**Result: SAFE. Phase 17D-2 continued.**

A createdAt/time boundary was used for detection only. It was not added to authorization logic.

---

## 3. Repository reuse audit

| Existing | Decision |
| --- | --- |
| `shared/international/country.js` ISO 3166-1 | **Reused** for countryCode validation |
| `shared/international/jurisdiction.js` rollout policy | **Not overloaded** — it is feature-rollout policy, not a geo hierarchy |
| `shared/trust/sourceVerification.js` + `CanonicalSource` | **Not overloaded** — education/scholarship authority tiers and URL-dedup, incompatible with GBS registrar/tax legal facts |
| `shared/international/evidence.js` source URL helper | **Not reused for GBS legal URLs** — too permissive (localhost http allowed). New stricter GBS URL validator |
| `shared/gbs/constants.js` / `ProviderCapability` / listing subset | **Extended** — capabilityId + taxonomy; exact-subject rules unchanged |
| `shared/platform/optimisticConcurrency.js` | **Reused** for review CAS |
| `server/src/services/platform/optimisticConcurrency.js` Mongo CAS | **Reused** for ProviderCapability review |
| Idempotency Mongo store | **Not over-wired** — no new externally reachable high-value command |
| `permissionPolicy.js` staff RBAC | **Extended** with catalog/source review actions; no fifth auth realm |
| `gbsAuditEvents.js` | **Extended** with source/fee/capability/title events |
| Quote contracts | Untouched (still contracts only) |
| `isBusinessServicesEnabled` | Unchanged, default **OFF** |
| Education/institution source models | Not used as legal GBS truth |

Forbidden pattern `if (country === 'US' && state === 'WY')` was not introduced in controllers/components. New jurisdictions are additive catalog rows.

---

## 4. Jurisdiction model

Canonical records live in `shared/gbs/catalog/` and `GbsJurisdiction`.

Fields: opaque `id`, `code`, `countryCode`, `name`, `level`, `parentJurisdictionId`, `status`, `reviewStatus`, `schemaVersion`, `recordVersion`, timestamps.

There is **no** universal `state` field. Level is an enumerated hierarchy value.

Unknown parent: validation error. Cycles: rejected. Codes unique within `countryCode + code`.

---

## 5. Country/level hierarchy

Supported levels: `country`, `state`, `province`, `territory`, `emirate`, `free_zone`, `region`, `district`, `other`.

Launch-wave country rows: `PK`, `US`, `GB` (`launchCoverage: true`, `reviewStatus: draft`).

Structural future country rows only: `SG`, `AE`, `CA`, `AU` (`launchCoverage: false`, not launch-ready).

US children attach to `j:US`. Example shapes the architecture supports without populating Wave-2 as launch-ready: US→Wyoming; Canada→Ontario later; UAE→Dubai / free zone later.

---

## 6. US all-state/DC structural inventory

ISO 3166-2 codes for all **50 states + District of Columbia** (DC `level=district`).

All structural US children: `reviewStatus = draft`.

These rows do **not** mean legal facts are reviewed.

---

## 7. Initial US candidates

Launch-candidate marker only: **DE, WY, FL, TX**.

Candidate ≠ reviewed ≠ public. Candidate jurisdictions remain `reviewStatus=draft`. No public projection.

---

## 8. Authority registry

Jurisdiction-scoped authorities. Types include national/state/provincial registrar, tax, licensing, government portal, official legislation/registry, local, other.

Required separations implemented:

- US: state registrar ≠ IRS (`auth:US-WY-SOS` vs `auth:US-IRS`)
- Pakistan: SECP ≠ FBR
- UK: Companies House ≠ HMRC

A fee/rule points at the authority that controls it.

---

## 9. Official Source registry

Legal facts may be sourced only from accepted official classes. Competitor marketing, blogs, SEO, news, Reddit/social, AI-generated text, search snippets, and provider self-declared data **cannot** become authoritative legal facts.

Review statuses: `draft`, `under_review`, `reviewed`, `stale`, `superseded`, `rejected`.

---

## 10. Source revision/history

`sourceVersion` = domain history. `recordVersion` = optimistic concurrency. They are not the same.

A material change to a reviewed source creates a new `sourceVersion`. The old revision remains queryable and is marked superseded rather than silently rewritten.

CURRENT CATALOG TRUTH ≠ HISTORICAL TRANSACTION SNAPSHOT. No quote/case product exists yet; the invariant is encoded in the catalog/review services.

---

## 11. Freshness policy

Versioned in `shared/gbs/freshnessPolicy.js` (`17d-2.0`):

| Class | Review interval |
| --- | ---: |
| government_fee | 90 days |
| formation_rule | 180 days |
| periodic_obligation | 180 days |
| authority_identity | 365 days |
| source_default | 180 days |

Not hardcoded in page/controller code.

---

## 12. Effective-date semantics

CURRENT requires conceptually:

- `reviewStatus == reviewed`
- `superseded == false`
- `now <= reviewDueAt`
- `effectiveFrom <= now` where set
- `effectiveTo` absent **or** `now < effectiveTo`

Otherwise not CURRENT. Past `reviewDueAt` → `stale`. Future `effectiveFrom` → `not_yet_effective`. Past `effectiveTo` → `expired`.

---

## 13. Source fingerprint

Deterministic canonical JSON over normalized non-secret catalog fields, SHA-256 on the server.

Proves revision identity, **not** legal validity. HTML bodies are not hashed or stored.

---

## 14. Entity Type registry

Jurisdiction-scoped IDs, e.g. `et:US-WY:LLC` ≠ `et:GB:LTD` ≠ `et:PK:PVT` / `et:PK:SMC`.

Unsupported jurisdiction/entity combination is denied. No global LLC/LTD SKU.

---

## 15. Jurisdiction Rule foundation

Versioned catalog facts (`GbsJurisdictionRule`), not executable legal engines in controllers.

Thin-launch categories used: formation eligibility, RA/RO requirements, member rules, identifier/tax separation notices, protected-title reference (ACSP).

Not a personalized legal-advice engine.

---

## 16. Government Fee registry

Separate ownership: `government` only in this catalog. Provider/third-party/platform fees are not mixed in.

Amount models: `fixed`, `range`, `variable`, `not_catalogued`.

Unknown/ambiguous amounts use `not_catalogued`. Negative amounts rejected. Currency required (ISO 4217). `fxAuthoritative` is always false.

No combined package price (Florida $100 filing and $25 RA designation are separate government fees).

---

## 17. Pakistan official-source research

Research date: **2026-08-14**.

Official sources:

- https://www.secp.gov.pk/company-formation/registration-of-company/ — private company (2+ persons); single member company (one member). Direct fetch from this environment was Cloudflare-blocked; official URL and SECP-published incorporation FAQ content were used to confirm structure classes, not fees.
- https://leap.secp.gov.pk/ — eZfile/LEAP portal
- https://www.fbr.gov.pk/ — FBR remains a **separate** tax authority

Recorded rules: SECP incorporation does **not** complete NTN; bank account not guaranteed; tax registration not guaranteed. No SECP PINs stored. No personalized tax advice.

**SECP incorporation fee: `not_catalogued`** (official fee calculator/page was not successfully retrieved in this window).

---

## 18. UK official-source research

Research date: **2026-08-14**.

Official sources verified by fetching the live pages:

- https://www.gov.uk/limited-company-formation/register-your-company — digital incorporation **£100**, paper **£124**
- https://www.gov.uk/government/publications/companies-house-fees/companies-house-fees — same incorporation table; confirmation statement digital **£50**; effective from the 1 February 2026 fee change
- https://www.gov.uk/limited-company-formation/company-address — registered office: physical UK address, same country as registration, PO Box not permitted
- https://www.gov.uk/guidance/being-an-authorised-corporate-service-provider — ACSP / Companies House authorised agent
- https://find-and-update.company-information.service.gov.uk/ — official search
- https://www.gov.uk/corporation-tax — HMRC Corporation Tax, distinct from Companies House

ACSP is a protected/regulatory title. Ordinary Agent verification MUST NOT grant ACSP.

---

## 19. US federal official-source research

- https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online

IRS EIN is **federal**, not state formation. Official page: form the state entity first; online EIN tool requires US/territory principal place of business. Instant EIN / guaranteed banking / Stripe are **not** claimed.

EIN application amount: **`not_catalogued`** (page retrieved did not state a filing amount).

No `USA LLC` SKU.

---

## 20. Delaware official-source research

Official registrar: Delaware Division of Corporations.

- https://corp.delaware.gov/howtoform/ — formation entry (HTML fetch timed out from this environment; official URL retained)
- https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx — entity search
- https://corp.delaware.gov/fee/ — fee landing page **does not publish a current LLC Certificate of Formation amount in HTML**

Conflicting official PDF snippets exist historically (`$90` vs `$110`). **Formation fee left `not_catalogued` / draft.** LLC entity support is recorded as a reviewed eligibility fact sourced from the official how-to-form/forms family, without inventing a fee.

---

## 21. Wyoming official-source research

- https://sos.wyo.gov/business/default.aspx — SOS Business Division / WyoBiz entry
- https://sos.wyo.gov/Business/docs/BusinessFees.pdf — **Articles of Organization $100.00**, effective **1 July 2026**, revised June 2026
- https://sos.wyo.gov/Business/docs/HowToFindOrBecomeARegisteredAgent.pdf — RA required; physical Wyoming address; PO Box / drop box / mail-forwarding insufficient
- https://wyobiz.wyo.gov/ — official portal / search

---

## 22. Florida official-source research

- https://dos.fl.gov/sunbiz/start-business/efile/fl-llc/ — LLC Articles of Organization e-file
- https://dos.fl.gov/sunbiz/forms/fees/llc-fees — filing **$100.00** + registered agent designation **$25.00** (separate government fees; not a package SKU)
- https://search.sunbiz.org/Inquiry/CorporationSearch/ByName — official search

---

## 23. Texas official-source research

- https://www.sos.state.tx.us/corp/instructions/205.shtml — Form 205; LLC Certificate of Formation filing fee **$300**; registered agent required; entity cannot be its own agent; registered office may not be solely a mailbox service
- https://direct.sos.state.tx.us/help/help-corp.asp?pg=fee — same $300 formation fee for Forms 201/203/205/206
- https://direct.sos.state.tx.us/ — SOSDirect

Franchise tax is Texas Comptroller, not SOS, and was **not** catalogued as a formation fee.

---

## 24. Facts intentionally left unverified/not_catalogued

- Pakistan SECP incorporation fee amount
- Delaware LLC Certificate of Formation fee amount
- IRS EIN application fee/amount
- All non-candidate US state fees and rules
- Singapore / UAE / Canada / Australia launch facts
- County/city licenses
- Tax engines, NTN completion, bank account, Stripe/Amazon, “best state”, “tax-free”
- Full corporate-law / periodic-compliance databases
- Wyoming annual report license tax formula beyond noting the official PDF describes an assets-based tax (not encoded as a fake fixed package)

---

## 25. Seed/import manifests

Repository-native catalog in `shared/gbs/catalog/`:

- `usSubnational.js` — 50 states + DC
- `researchMeta.js` — research date 2026-08-14
- `index.js` — countries, jurisdictions, authorities, sources, entity types, fees, rules; schema-validated on load

Deterministic, versioned (`17d-2.0`), official URLs only for legal facts, no PII, no secrets, no downloaded government document bodies.

---

## 26. Import utility

`server/src/scripts/importGbsCatalog.js` + `catalogImportService.js`.

- Default: **dry-run**
- Explicit `--apply` still refused unless isolated `strideto_17d2_*` DB **and** `STRIDETO_GBS_CATALOG_APPLY_CONFIRM=1`
- Persistent `edurozgaar` apply: **forbidden**
- This phase executed dry-run only against an in-memory store
- Dry-run counts (2026-08-14): create **118**, update 0, revision 0, unchanged 0, stale 0, rejected 0, invalid 0
- No destructive delete. Supersession would create history

---

## 27. Persistent import statement

Persistent catalog import executed: **NO**

Isolated Mongo used only for CAS tests (`strideto_17d2_integrity_run1`) and then **dropped**.

---

## 28. Provider Business Services taxonomy

Narrow MVP IDs:

- `business_formation`
- `formation_consultation`
- `document_preparation`
- `registered_agent`
- `registered_office`
- `ein_assistance`

Public role label: Business Services Provider. Formation specialization label: Business Formation Provider. **No fifth auth realm.**

---

## 29. Protected-title registry

Evidence-gated titles: Registered Agent, Registered Office Provider, ACSP, CSP, Attorney, Tax Professional, Accountant, Company Secretary, other regulated.

The registry does **not** assert every label is legally protected in every jurisdiction. It means Strideto treats the claim as evidence-gated.

---

## 30. Provider evidence model

Metadata only: type, authority/jurisdiction, decision, effective dates, optional Vault ref flag.

No passport/licence scans in public media. Vault-bound later. HSI provider-sharing **NOT ENABLED**.

Statuses remain: `claimed` ≠ `evidence_submitted` ≠ `evidence_backed` ≠ `verified`.

---

## 31. Capability verification service

Service-layer primitives (no Admin UI): submit evidence, mark evidence-backed, verify, needs information, reject, suspend, revoke.

Staff RBAC (`admin.provider.verification`). Provider cannot self-verify. Organization Verified alone does not verify formation / RA / ACSP / lawyer / accountant.

---

## 32. Jurisdiction-capability enforcement

Exact subject from 17D-1 remains mandatory.

WY formation verified ⇏ DE formation. WY RA verified ⇏ DE RA. Formation verified ⇏ RA. UK formation ⇏ ACSP. Agent capability remains Agent subject. Agency capability remains Organization subject.

---

## 33. Source review service

Service-layer primitives (no Admin UI): create draft, submit, approve reviewed revision, mark stale, reject/supersede.

High-authority review requires staff permission + audit. Material reviewed changes create a new `sourceVersion`.

---

## 34. Publication eligibility

`resolvePublicationEligibility` returns: `current`, `draft`, `under_review`, `stale`, `superseded`, `not_yet_effective`, `expired`, `rejected` (plus `inactive`).

Only `current` is eligible for future current-public projection. **No public route.**

Future listing gate helper (no listing CRUD): feature ON + exact-subject active VERIFIED capability + scope subset + protected-title if required + current jurisdiction facts + Admin listing review.

---

## 35. Security/audit events

Added (safe, no evidence bodies): `jurisdiction_created`, `jurisdiction_reviewed`, `authority_created`, `source_draft_created`, `source_submitted`, `source_reviewed`, `source_marked_stale`, `source_superseded`, `source_rejected`, `fee_created`, `fee_reviewed`, `fee_superseded`, `provider_capability_evidence_submitted`, `provider_capability_evidence_backed`, `provider_capability_verified`, `provider_capability_needs_information`, `provider_capability_rejected`, `protected_title_verified`, `protected_title_denied`.

Existing suspend/revoke events reused.

Official source URLs: HTTPS required; `javascript:`, `data:`, `file:`, localhost, loopback, and private-network targets rejected. No arbitrary URL fetcher / SSRF. No live source-refresh jobs.

---

## 36. Concurrency

17D-1R1 `recordVersion` CAS reused.

ProviderCapability review: Mongo `findOneAndUpdate` on `{ _id, subjectType, subjectId, recordVersion }`. Stale → **409**. Wrong subject → **404**, no existence leak.

Official source / government fee: versioned rows + compare-and-set on `recordVersion`.

No new externally reachable high-value command, so generic idempotency was **not** over-wired. 17D-1R2 crash-window invariant remains: generic `IdempotencyRecord` does not magically provide exactly-once semantics across an arbitrary crash.

---

## 37. Index/performance

Justified indexes only:

- Jurisdiction: unique `countryCode+code`; `parentJurisdictionId`; `reviewStatus`
- Sources: unique `sourceId+sourceVersion`; `jurisdictionId+reviewStatus+reviewDueAt`
- Fees: unique `feeId+sourceVersion`; `jurisdictionId+entityTypeId+feeCategory+reviewStatus`
- ProviderCapability: `subjectType+subjectId+capabilityId+status`; jurisdiction scope; `capabilityId+trustStatus`

New GBS catalog models are **not** imported on API boot, so they do not create collections in persistent `edurozgaar`.

---

## 38. Source tests

`phase17d2CatalogFoundation.test.js`: **294** assertions (jurisdiction 1–7, source authority 8–12, freshness 13–20, history 21–25, fees 26–31, entity types 32–35, plus provenance for every seed legal fact).

`phase17d2Concurrency.mongo.test.js`: **4** tests (ProviderCapability CAS, wrong-subject 404, source CAS, fee version history). Isolated DB dropped afterwards.

---

## 39. Trust tests

`phase17d2ProviderTrust.test.js`: **27** assertions covering mandatory items 36–55 and the future listing publication gate.

---

## 40. Authority regression

Reran:

| Test | Result |
| --- | --- |
| phase17d1CapabilityFoundation | 106 passed |
| phase17d1ProviderAndPlatform | 41 passed |
| phase17d1StudentRouteAuthority | 76 passed |
| phase17d1r1RoleAndRegistration | 39 passed |
| phase17d1r1SourceContract | 38 passed |
| phase17d1r2LegacyFallbackIsolation | 52 passed |
| phase17d1r1ConcurrencyIdempotency.mongo | 6 passed |

17D-2 did not reopen Student/Business Client, staff auto-student, pending fallback, role transitions, Employer/Agent/Institution isolation, listing subset, or global deny.

---

## 41. Runtime health

api-a / api-b rebuilt with safe Compose (`--env-file .env.staging` + staging + sec3f-local + appenv-align). No `down`, no `-v`, no prune.

- api-a `/api/health` → **200**
- api-a `/api/health/ready` → **200**
- api-b `/api/health` → **200**
- api-b `/api/health/ready` → **200**

Frontend image was **not** rebuilt (no client import of new shared GBS catalog modules).

---

## 42. UI/theme statement

No GBS UI. No navigation. No public pages. No Admin GBS UI. Appendix-B visual law untouched. AdminDataTable / AdminTableFilters / FormField untouched.

New visual acceptance: **N/A**.

---

## 43. Actual findings

1. Persistent staging has **zero** capability-era ambiguous User rows from the 17D-1→R2 window.
2. Delaware official HTML fee schedule does not state a current LLC formation amount; do not guess.
3. Pakistan SECP site was Cloudflare-blocked from this research environment; structure classes were confirmed from official URLs/FAQ, fees left unverified.
4. UK Companies House digital incorporation is **£100** on the current official pages (fee change from 1 February 2026), not an older audit memory number.
5. Florida government RA designation fee is a **state filing fee**, not a provider RA price.

---

## 44. Remaining gaps

- No Admin catalog review UI
- No public projection / marketplace
- Delaware and Pakistan formation fee amounts still unverified
- Non-candidate US states have structural rows only
- No live source-refresh adapter (intentionally out of scope)
- ProviderCapability `capabilityId` is additive; existing 17D-1 fixture rows without it remain valid

---

## 45. Deferred items

Phase 17D-3 and later: public `/business-services`, Business Client workspace, Agent GBS UI, Service Request / Quote / Case products, Mailroom, payments, scanner, KMS, WAF, Turnstile, Wave-2 countries as launch coverage, full legal databases.

---

## 46. Commits

1. `5950ef9` — `feat(gbs): add jurisdiction and official-source intelligence foundation`
2. `25b0ca2` — `feat(trust): add jurisdiction-scoped business services capability verification`
3. This document — `docs(release): record phase 17d-2 jurisdiction intelligence foundation`

---

## 47. Current HEAD

Recorded after commits in the working-tree section of the operator return.

---

## 48. Working tree

Known WIP and protected/local files must remain as at baseline, plus 17D-2 files committed.

---

## 49. Worker

**STOPPED** (not present in `docker ps`).

---

## 50. Push/deployment

Push: **NO**

Deployment: **NO**

---

## 51. Phase 17D-3

**NOT STARTED.**

---

## 52. Phase 18

**NOT STARTED.**

---

## 53. Frozen §35 gate answers

**What new authority was introduced?**  
Staff-only catalog/source review policy actions (`admin.gbs.catalog.review`, `admin.gbs.source.review`) plus additive Business Services capability IDs and protected-title evidence gates. No fifth auth realm. No public GBS authority.

**What new data was introduced?**  
Source-controlled jurisdiction/authority/source/entity/fee/rule catalog manifests and Mongoose models. Not imported into persistent Mongo.

**What tenant boundary was introduced?**  
Jurisdiction-scoped ProviderCapability verification (WY ⇏ DE; formation ⇏ RA; UK formation ⇏ ACSP). Exact-subject rules from 17D-1 unchanged.

**What abuse path was introduced?**  
Internal review primitives only. No public routes. Catalog importer cannot apply to `edurozgaar`.

**What rate/resource limit protects it?**  
No new public endpoint. Existing `/api` limiter unchanged. Official URL validator rejects private/localhost schemes (no SSRF fetcher).

**What audit event records it?**  
Extended GBS audit catalog listed in §35.

**What recovery impact exists?**  
None on current-user products. Catalog is not live. Historical users untouched.

**What UI/theme surfaces were added?**  
None.

**What responsive evidence exists?**  
N/A (no UI).

**What backward compatibility exists?**  
17D-1 ProviderCapability records without `capabilityId` still validate. Student/Business Client/staff/legacy fallback isolation unchanged. Feature flag still OFF.

**Was this security authorization or operational configuration?**  
**Security authorization** (source-controlled catalog truth + Trust verification). `BUSINESS_SERVICES_ENABLED` remains operational and default OFF.

**What concurrency/idempotency protects mutations?**  
`recordVersion` Mongo CAS for ProviderCapability; source/fee version history + CAS. No new reachable high-value idempotent command. Generic idempotency is still not exactly-once across crash windows.

**What listing subset behavior exists?**  
17D-1 subset authorizer unchanged, plus optional `capabilityId` match. Future publication gate tested only; no listing CRUD.

**What Vault/HSI behavior changed?**  
None. Provider HSI sharing NOT ENABLED. Scanner NOT IMPLEMENTED.

**What catalog freshness/effective-date behavior exists?**  
Canonical eligibility service: only `current` may later be projected; STALE ≠ CURRENT; effective dates enforced; policy versioned.

---

**STOP.** Do not start Phase 17D-3, public discovery, `/business`, Service Request, Quote, Case, Mailroom, payments, scanner, KMS, WAF, Turnstile, or Phase 18.

NEXT: USER + CHATGPT REVIEW PHASE 17D-2 BEFORE PHASE 17D-3.
