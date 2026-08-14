# STRIDETO PHASE 17D-2R1
CATALOG TRUTH & PROVIDER CAPABILITY AUTHORITY CLOSURE

This is **not** Phase 17D-3. This is **not** Phase 18.

Persistent catalog import: **NO**

Persistent User/Org backfill: **NO**

Real provider verification: **NO**

Public GBS routes: **NONE**

GBS UI: **NONE**

Business Services feature: **OFF**

Provider HSI sharing: **NOT ENABLED**

Scanner: **NOT IMPLEMENTED**

KMS: **NOT IMPLEMENTED**

Payments: **NOT_CONFIGURED**

Worker: **STOPPED**

Push: **NO**

Deployment: **NO**

Phase 17D-3: **NOT STARTED**

Phase 18: **NOT STARTED**

---

## 1. Baseline

- Expected HEAD at start: `606aba3`
- Confirmed: `606aba3` `docs(release): record phase 17d-2 jurisdiction intelligence foundation` on `main`
- Architecture documents were not reopened:
  - `docs/STRIDETO_PHASE_17D_A_GLOBAL_BUSINESS_SERVICES_ARCHITECTURE_GAP_AUDIT.md`
  - `docs/STRIDETO_PHASE_17D_B_PRODUCT_AUTHORITY_SECURITY_ARCHITECTURE_LOCK.md`
  - `docs/STRIDETO_PHASE_17D_1_BUSINESS_CLIENT_AUTHORITY_FOUNDATION.md`
  - `docs/STRIDETO_PHASE_17D_1R1_AUTHORITY_FOUNDATION_INTEGRITY_CLOSURE.md`
  - `docs/STRIDETO_PHASE_17D_1R2_LEGACY_CAPABILITY_FALLBACK_CLOSURE.md`
  - `docs/STRIDETO_PHASE_17D_2_JURISDICTION_INTELLIGENCE_AND_PROVIDER_TRUST.md`
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
- No live catalog import, no capability backfill, no provider mutation, no public route, no UI

---

## 2. Official-source re-verification date

Re-verified from current official government sources on **2026-08-14**.

Correction research window:

- `CATALOG_CORRECTION_RESEARCH_DATE`: `2026-08-14`
- `CATALOG_CORRECTION_RETRIEVED_AT`: `2026-08-14T13:30:00.000Z`
- `CATALOG_CORRECTION_LAST_REVIEWED_AT`: `2026-08-14T13:30:00.000Z`

The original 17D-2 research timestamps (`2026-08-14T12:00:00.000Z`) remain on historical rows.

---

## 3. IRS EIN correction

Current official IRS page:

- `https://www.irs.gov/businesses/employer-identification-number`
- States that EIN issuance directly from the IRS is **free**.

Current catalog fact (`fee:US-IRS-EIN` sourceVersion **2**):

| Field | Value |
| --- | --- |
| authority | IRS (`auth:US-IRS`) |
| fee category | `ein_issuance` |
| owner | government |
| currency | USD |
| amountModel | fixed |
| amount | **0** |
| reviewStatus | reviewed |
| sourceId | `src:US-IRS-EIN-fee` |
| sourceVersion | 2 |
| retrievedAt / lastReviewedAt | `2026-08-14T13:30:00.000Z` |

Split preserved:

- IRS government fee = **USD 0**
- Provider EIN assistance fee = **provider-defined later** (not catalogued)
- Does **not** claim provider EIN assistance is free
- Does **not** imply guaranteed EIN issuance
- Form-the-state-entity-first remains a separate reviewed rule

---

## 4. Delaware fee correction

Current official Delaware Division of Corporations fee schedule PDF:

- `https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf`
- Limited Liability Companies / Formation – domestic = **$110.00**
- Schedule revision observed August 2026 (`effectiveFrom` `2026-08-01`)

Current catalog fact (`fee:US-DE-llc-formation` sourceVersion **2**):

| Field | Value |
| --- | --- |
| government fee | USD **110** |
| authority | Delaware Division of Corporations (`auth:US-DE-DOS`) |
| entity | Delaware domestic LLC (`et:US-DE:LLC`) |
| source | current official fee schedule revision (`src:US-DE-fee-schedule-2026-08`) |
| reviewStatus | reviewed |

The HTML landing page `https://corp.delaware.gov/fee/` still does not publish the amount in HTML. It is retained as historical source `src:US-DE-fee-page`.

---

## 5. Delaware RA rule

The 17D-2 catalog had LLC-supported eligibility only (`rule:US-DE-llc-supported`). A Registered Agent **requirement** row was missing.

Current official guidance:

- `https://corp.delaware.gov/faqs-regarding-registered-agents/`
- Every Delaware business entity must maintain a Registered Agent in Delaware with a **physical street address**.

Added reviewed rule `rule:US-DE-registered-agent` (one row, no duplicate).

Kept separate:

- registered-agent **requirement** (this rule)
- provider Registered Agent **service price** (not invented)
- provider Registered Agent **capability** (Trust taxonomy; not a government fee)

No Delaware government RA service fee was invented. Florida’s existing USD 25 RA **designation** filing fee remains a Florida government fee, not a Delaware or provider price.

---

## 6. Facts unchanged after re-verification

Same-day 17D-2 official facts left unchanged:

| Fact | Current catalog |
| --- | --- |
| UK Companies House digital incorporation | GBP **100** |
| UK Companies House paper incorporation | GBP **124** |
| Wyoming LLC formation | USD **100** |
| Florida LLC articles | USD **100** |
| Florida RA designation (government filing) | USD **25** |
| Texas LLC formation | USD **300** |
| Pakistan SECP incorporation amount | still `not_catalogued` / draft |

---

## 7. Source history behavior

Historical rows were **not** deleted.

| Record | v1 (history) | v2 (current) |
| --- | --- | --- |
| `fee:US-IRS-EIN` | `not_catalogued` / superseded; apply-online page did not state an amount | reviewed USD 0 |
| `src:US-IRS-EIN` | retained as process/identity source | new `src:US-IRS-EIN-fee` is the fee-amount source |
| `fee:US-DE-llc-formation` | `not_catalogued` / superseded; HTML landing page | reviewed USD 110 from official PDF |
| `src:US-DE-fee-page` | retained, marked superseded as the fee-amount source | new `src:US-DE-fee-schedule-2026-08` |
| `rule:US-DE-llc-supported` | `formationFeeNotCatalogued: true` superseded | `formationFeeNotCatalogued: false` |

Tests prove v1 remains queryable. A current revision supersedes older ambiguity; it does not rewrite it invisibly.

---

## 8. ProviderCapability capabilityId hard gate

New GBS authority requires **all** of:

- `capabilityId` exists
- `capabilityId` is a known canonical GBS capability (`business_formation`, `formation_consultation`, `document_preparation`, `registered_agent`, `registered_office`, `ein_assistance`)
- status `active`
- trustStatus `VERIFIED`
- exact subject match
- jurisdiction / entity / service / protected-title scope subset
- `requested.capabilityId === capability.capabilityId` (**mandatory**, not optional)

Missing/undefined `capabilityId` → **not GBS-authoritative**.

Canonical helper: `authorizeGbsProviderAction` in `shared/gbs/gbsProviderAuthority.js`.

Future listing publication (`evaluateListingPublicationGate`) no longer infers `listing.capabilityId || capability.capabilityId`. Both sides must present the same known capabilityId.

17D-1 `authorizeListingScope` remains for historical listing-subset reads when **both** sides omit `capabilityId`. If a GBS request **does** present `capabilityId`, the capability must have a matching known id (legacy empty id denies).

No inference of `business_formation`, `registered_agent`, `registered_office`, or ACSP from legacy broad flags.

---

## 9. Legacy ProviderCapability compatibility

Existing 17D-1 rows without `capabilityId`:

- remain schema-readable (`validateProviderCapabilityRecord` still accepts empty `capabilityId`)
- remain historically queryable
- are **not** eligible for new GBS authority or GBS listing publication

No live migration. No silent `capabilityId` assignment. Promotion into Business Services later requires explicit reviewed re-verification.

---

## 10. Protected-title evidence policy

Source-controlled module: `shared/gbs/protectedTitleEvidencePolicy.js`

- `policyVersion`: `17d-2r1.0`
- **Not** Admin-editable
- Per-title / per-jurisdiction fields: `titleId`, `jurisdictionScope`, `capabilityId`, `allowedSubjectTypes`, `evidenceRequired`, `requiredEvidenceClasses`, `acceptedAuthorityClasses`, official-registry preferred/required, `exactSubjectMatch`, `effectiveDateRequired`, current-status/expiry policy, `reviewRequired`, `verificationReadiness`

Titles are **not** globally identical.

Where policy is not researched: `verificationReadiness` = `needs_policy` / `not_configured`. Those titles **cannot** reach `VERIFIED`.

Additive stubs remain for Registered Office Provider, CSP, Attorney, Tax Professional, Accountant, Company Secretary, and other regulated titles.

---

## 11. ACSP policy

UK ACSP (`titleId: acsp`, `jurisdictionScope: j:GB`) is **ready**.

Required evidence class: official Companies House / GOV.UK registry status on the **exact** Agent or Organization subject.

Catalog sources added (identity/list class only; **not scraped**):

- `https://www.gov.uk/government/publications/list-of-authorised-corporate-service-providers-acsps`
- `https://www.gov.uk/government/publications/ceased-or-suspended-authorised-corporate-service-providers-acsps`

The following **cannot** become ACSP:

- ordinary Agent verification
- Organization Verified
- UK `business_formation` capability
- website claims

ACSP remains a **protected title**, not a GBS capability id.

---

## 12. Registered Agent jurisdiction policy

Registered Agent verification is jurisdiction-scoped:

- `US-WY registered_agent` ≠ `US-DE registered_agent` ≠ `US-TX registered_agent` ≠ `US-FL registered_agent`

Evidence classes differ:

- Wyoming: SOS commercial registered-agent registration preferred
- Delaware: physical Delaware street-address confirmation (no invented government RA license registry)
- Texas / Florida: jurisdiction-scoped authority confirmation; no cross-state reuse

Organization Verified alone: **DENY** protected-title verification.

Formation capability alone: **DENY** Registered Agent title.

---

## 13. Review-service hardening

`createProviderCapabilityReviewService().verify()` refuses `VERIFIED` when:

| Condition | Reason code |
| --- | --- |
| capabilityId missing | `gbs_capability_id_missing` |
| unknown capabilityId | `gbs_capability_id_unknown` |
| protected-title policy missing / not configured | `protected_title_policy_not_configured` |
| required evidence absent | `required_evidence_absent` |
| wrong subject | `404` `provider_capability_not_found` (no existence leak) |
| wrong jurisdiction | `protected_title_jurisdiction_mismatch` |
| evidence expired where current status is required | `protected_title_evidence_expired` |
| Organization Verified is the only evidence | `organization_verified_insufficient` |
| provider self-verify | `staff_review_required` / `provider_self_verify_forbidden` |

Staff review + valid required evidence + exact subject + correct policy **may** reach `VERIFIED`.

recordVersion CAS preserved: stale → **409**.

No public or Admin UI was added.

---

## 14. Catalog tests

`phase17d2r1CatalogTruth.test.js`: **43 passed**

Proved:

1. IRS official EIN government fee is current reviewed USD 0
2. EIN provider assistance remains a separate provider-defined concept
3. Delaware domestic LLC current formation fee is USD 110
4. Delaware RA requirement is official-source backed
5. No Delaware provider RA price invented
6. UK fee facts unchanged
7. Wyoming / Florida / Texas current source facts unchanged
8. Historical source/fee/rule revisions are not deleted

`phase17d2CatalogFoundation.test.js`: **345 passed** (assertion 29 now uses the still-`not_catalogued` SECP fee as the unknown-amount example)

Memory dry-run (empty store): `create=127` `revision=0` `update=0` `unchanged=0` `stale=0` `invalid=0`. Persistent import remains refused for `edurozgaar`.

---

## 15. Provider Trust tests

`phase17d2r1ProviderAuthority.test.js`: **27 passed**

Mandatory proofs 9–24:

9. missing capabilityId cannot authorize GBS action
10. unknown capabilityId denied
11. explicit `business_formation` VERIFIED allows in-scope formation
12. formation VERIFIED does not grant registered_agent
13. WY registered_agent VERIFIED does not grant DE registered_agent
14. legacy row without capabilityId is readable and not GBS publication-authoritative
15. Agency cannot use Agent capability
16. Agent cannot use Agency capability
17. Org Verified alone → no GBS capability
18. UK formation → no ACSP
19. ACSP evidence missing → deny verification
20. ACSP wrong subject → 404 / no existence leak
21. protected-title policy missing/not configured → cannot verify title
22. expired evidence where current status is required → cannot project title as current
23. provider self-verify → deny
24. staff + valid required evidence + exact subject + correct policy → may VERIFIED

`phase17d2ProviderTrust.test.js`: **27 passed**

---

## 16. Authority regression

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
| phase17d2CatalogFoundation | 345 passed |
| phase17d2ProviderTrust | 27 passed |
| phase17d2Concurrency.mongo | 4 passed |

Unchanged:

- Student / Business Client authority
- staff authority
- Employer / Agent / Institution isolation
- global deny
- listing subset, except explicit capabilityId tightening for **new GBS** publication/authority
- legacy ProviderCapability remains readable
- no fifth realm / cookie

Mongo CAS used disposable databases `strideto_17d2_r1_cas` and `strideto_17d1r1_integrity_r1cas` on host `27018`. Persistent `edurozgaar` was not mutated.

---

## 17. Persistent import statement

Persistent catalog import: **NO**

Dry-run only, against an in-memory store.

Expected empty-store dry-run:

| Metric | Count |
| --- | ---: |
| creates | 127 |
| revisions | 0 |
| updates | 0 |
| unchanged | 0 |
| stale | 0 |
| invalid | 0 |

`assertCatalogApplyAllowed({ apply: true, dbName: 'edurozgaar' })` remains refused.

---

## 18. Real provider mutation statement

Real provider verification: **NO**

No persistent ProviderCapability / Agent / Organization Trust rows were migrated, guessed, or verified.

---

## 19. Runtime health

api-a / api-b rebuilt with safe Compose (`--env-file .env.staging` + staging + sec3f-local + appenv-align). `--no-deps --force-recreate --build api-a api-b` only. No `down`, no `-v`, no prune.

- api-a `/api/health` → **200**
- api-a `/api/health/ready` → **200**
- api-b `/api/health` → **200**
- api-b `/api/health/ready` → **200**

Frontend image was **not** rebuilt.

---

## 20. Commits

1. `2ab3445` — `fix(gbs): correct current government fee provenance`
2. `6fd27b1` — `fix(trust): require explicit gbs capability and protected-title evidence policy`
3. This document — `docs(release): record phase 17d-2r1 catalog truth closure`

Exact SHAs are recorded after those commits in the operator return / current HEAD section.

---

## 21. Current HEAD

Recorded after commits in the working-tree section of the operator return.

---

## 22. Working tree

Known WIP remains dirty and uncommitted:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Protected/local files remain untracked:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Stash untouched.

---

## 23. Worker

Worker: **STOPPED**

Health payload: `workerRunning: false`, `effectiveState: queued_worker_stopped`. Worker container is not in `docker ps`.

---

## 24. Push/deploy

Push: **NO**

Deployment: **NO**

---

## 25. Phase 17D-3

Phase 17D-3: **NOT STARTED**

Not implemented: `/business-services`, `/business`, provider/Admin GBS dashboards, listing CRUD UI, Service Request, Quote product, Case product, estimator, comparison UI, Mailroom, scanner, KMS, WAF, Turnstile, payments, government submission.

---

## 26. Phase 18

Phase 18: **NOT STARTED**
