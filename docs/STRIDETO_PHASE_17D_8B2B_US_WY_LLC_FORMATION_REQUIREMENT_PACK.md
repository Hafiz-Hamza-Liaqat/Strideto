# STRIDETO PHASE 17D-8B2B
US-WY LLC OFFICIAL-SOURCE FORMATION REQUIREMENT PACK
DRAFT PACK + GENERIC FACT / CHECK / SNAPSHOT RUNTIME

**PHASE 17D-8B2B: ENGINEERING COMPLETE**

**DRAFT PACK ENGINEERING: PASS**

**PACK ACTIVATION: NOT AUTHORIZED**

**LIVE WYOMING ROLLOUT: NOT ACTIVE**

**PRODUCTION PACK:** `gbs.requirement_pack.US-WY.LLC`

**PACK VERSION:** 1

**SCHEMA VERSION:** `17d-8b2b.0`

**activationStatus:** `draft`

**reviewStatus:** `draft`

**PACK SELECTED BY NORMAL RUNTIME:** NO

**HSI PRODUCTION:** OFF / NOT READY

**MARKETPLACE:** OFF

**EXISTING WORKER:** STOPPED

**B2C FILING AUTHORIZATION:** NOT IMPLEMENTED

**GOVERNMENT SUBMISSION:** NOT IMPLEMENTED

**17D-8B2C:** NOT STARTED

**17D-8C:** NOT STARTED

**PHASE 18:** NOT STARTED

17D-8B2B ENGINEERING COMPLETE does **not** mean the Wyoming pack is active.

---

## 1. Baseline

Starting HEAD: `6034b854231719c192e63dda700bb58fef4d3a15`

`docs(architecture): lock phase 17d-8b2b wyoming source decisions`

Implementation HEAD (code + tests, used for staging API rebuild): `75b821a2f37c2ce10bb30803cce49b86d7ea2e05`

`test(gbs): verify wyoming draft pack isolation and readiness`

This document is the docs-only sign-off commit after acceptance.

Closed predecessors: 17D-7, 17D-8A, 17D-8B1, 17D-8B2-PRE, 17D-8B2A, 17D-8B2B-PRE.

Protected WIP left untouched:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`
- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Stash `{0}` untouched. No push. No deploy. Existing Worker was not started.

---

## 2. What B2B means

B2B success is **source-controlled draft pack + generic Case snapshot/fact/check runtime + synthetic ACTIVE+REVIEWED proof + production draft invisibility**.

B2B success is **not**:

- Wyoming pack activation
- formal source review approval
- live Wyoming customer rollout
- Articles PDF / statutory signature
- RA consent upload
- HSI / document requirements
- CaseFilingAuthorization
- government filing

---

## 3. Pack identity

| Field | Value |
| --- | --- |
| packId | `gbs.requirement_pack.US-WY.LLC` |
| packVersion | 1 |
| schemaVersion | `17d-8b2b.0` |
| sourceSetId | `srcset:US-WY-LLC-formation-v1` |
| capabilityId | `business_formation` |
| jurisdictionId | `j:US-WY` |
| entityTypeId | `et:US-WY:LLC` |
| authorityId | `auth:US-WY-SOS` |
| packApplicableFrom | `2026-08-16T00:00:00.000Z` |
| feeRef | `fee:US-WY-llc-articles` ($100 only) |
| documentRequirements | 0 |
| hsiRequirementCount | 0 |
| activationStatus | `draft` |
| reviewStatus | `draft` |
| reviewedByRole / reviewedAt / approvalRef | unset |

`packApplicableFrom` is the earliest date STRIDETO considers this pack/source-set version applicable. It is not a claim that Wyoming law or forms became effective on that date. Each `sourceRef` keeps its own revision / effectiveDate / retrievedAt / lastReviewedAt.

---

## 4. Official sources

Encoded only from the 17D-8B2B-PRE lock. No new legal research. No fabricated reviewer.

Wyoming Secretary of State Business & UCC Center, Forms index, LLC Articles of Organization, fee schedule, how-to-create, registered-agent guidance, company-name guidance, WyoBiz name-search tips, WyoBiz portal, business statutes index, LLC Act, Registered Offices and Agents Act, and W.S. 17-16-123 effective-date reprint.

---

## 5. Selection law

Server key: `capabilityId + jurisdictionId + entityTypeId`.

A pack is selectable only if `activationStatus === active` AND `reviewStatus === reviewed` AND applicability permits it. Otherwise: no active requirement pack.

Production Wyoming v1 is draft/draft, so normal runtime never selects it. No env var, query parameter, Admin route, test HTTP endpoint, or database row can activate it. Client `packId` / `packVersion` / `sourceSetId` / activation / review fields are rejected as client-authoritative input.

Tests inject an in-memory ACTIVE+REVIEWED clone through `resolveRequirementPack({ registry })`. Production constant is never mutated.

---

## 6. Case snapshot

Optional Mixed fields on existing `GbsCase` (no new collection, no new index):

- `requirementPackSnapshot`
- `requirementFacts`
- `requirementChecks`
- `raConsentAttestation`

Snapshot copies pack identity (packId, packVersion, schemaVersion, sourceSetId, sourceSnapshotHash, capability, jurisdiction, entity type, authority, packApplicableFrom, requirement definition identity). Live registry is not Case truth.

Attach is integrated only into accepted-Quote → Case initialization. Production registry: Case initializes, no Wyoming snapshot. Injected ACTIVE+REVIEWED registry: one immutable snapshot. Same pack retry converges. Different pack/version: `requirement_pack_upgrade_required`. `gbs.case_requirement_pack.upgrade` exists as a dormant command id only.

`mutateGbsCaseRecord` cannot overwrite `requirementPackSnapshot`. Registry v2 does not rewrite a v1 Case.

No mass backfill. Staging Case `DTPXRd-9BOY7PcNoAifZT_a_` remains cancelled with **no** snapshot.

---

## 7. Facts, checks, RA consent

Required facts: proposed_entity_name, close_llc_election, ra_source, ra_kind, ra_name, ra_registered_office_street/city/state/postal_code, mailing_address, principal_office_address, entity_email, organizer_print_name, filing_contact_name, filing_contact_phone, ra_email, ra_phone.

Optional facts: ra_po_box_in_addition, ra_mailing_address_if_different, delayed_effective_date (metadata: not later than 90th day after filing; missing is not a blocker; B2B does not file).

Provenance records customer / provider / system-derived. Provider cannot rewrite customer provenance. Customer cannot mutate Provider-only checks or RA attestation. Staff cannot impersonate customer.

`close_llc_election === true` → `wy_close_llc_out_of_scope` (not coerced). Name suffix uses the locked Wyoming suffix set only; availability is not guaranteed. `name_distinguishability_search_performed` is a Provider attestation that a WyoBiz search was performed.

RA: physical WY street required; PO Box alone insufficient; drop-box-only invalid; `ra_source=provider_as_ra` → `provider_registered_agent_capability_required`. RA written consent is Provider attestation (`external_filer_retention`, waivable false). Copy: confirm written consent obtained and retained for the external filing. Not customer consent, not STRIDETO consent, not SOS approval. Audit fail-closed: attestation reverts if required audit persistence fails.

Organizer is print-name fact only. No signature. No Provider=organizer inference. Filing contact is not copied from account email/phone.

Derived checks: name_suffix_compliant, close_llc_not_elected, articles_facts_complete_for_external_filing, organizer_identified_for_external_execution, provider_not_claimed_as_wy_ra_without_capability, ra_written_consent_obtained_and_retained.

Manual checks: WyoBiz search, restricted words, RA eligibility, filing method (`wyobiz_online` | `paper_mail` only).

---

## 8. Readiness

No snapshot: existing 8A/8B1 document readiness unchanged. `productionDocumentPackForTemplate()` unchanged.

With injected Wyoming snapshot: B2B pre-submission requirements ready only when mandatory facts, Close LLC false, suffix valid, RA structural rules, mandatory Provider checks, RA consent attestation, organizer print name, filing method, and current exact Provider authority all hold. Documents 0. HSI irrelevant. `authorizedForExternalFiling` remains false. Absence of CaseFilingAuthorization does not block B2B requirement readiness. `ready_for_submission` remains STRIDETO pre-submission only.

Terminal Case and Provider authority loss deny mutation; readiness is not grandfathered.

---

## 9. APIs and UI

Generic Case routes (not Wyoming-named):

- Customer `PATCH /business/cases/:caseRef/requirement-facts`
- Provider `PATCH .../requirement-facts`, `POST .../requirement-checks`, `POST .../ra-consent/attest`

All mutations: authenticated subject, Case owner or exact Provider + `business_services.cases.manage`, `secureTrustedOrigin`, expectedVersion/CAS, idempotency, existing GBS write limiters.

Customer/Provider UI renders only when `requirementPack.attached`. DEV-only synthetic fixture at `/dev/gbs-requirement-pack-fixture` is stripped from production builds (`import.meta.env.DEV`). No Admin pack-review console. No upload, signature, or Submit-to-Wyoming controls. FormField.jsx untouched.

---

## 10. Audit / CAS / isolation

Audit events: pack attached, fact key updated, Provider check updated, RA consent attested. Metadata: Case ref, pack id/version, actor, exact Provider subject, fact/check key, timestamp, result. Raw address/email/phone/free text redacted via `AUDIT_SECRET_KEYS`.

CAS uses Case `recordVersion`. Idempotency: same key+fingerprint replay; same key+changed payload `409 idempotency_conflict`. Isolation: cross-customer/Agency 404, Independent vs Agency preserved, Education isolation preserved, no Admin implicit Provider subject.

---

## 11. Tests

| Suite | Result |
| --- | --- |
| `phase17d8b2bSourceContract.test.js` | 116 assertions PASS |
| `phase17d8b2bRequirementPack.mongo.test.js` | PASS |
| `phase17d8b2bRequirementUi.test.js` | 20 assertions PASS |
| `phase17d8aSourceContract.test.js` | 83 PASS |
| `phase17d8aBuyerUi.test.js` | 25 PASS |
| `phase17d8aProviderCaseUi.test.js` | 24 PASS |
| `phase17d8aCase.mongo.test.js` | PASS |
| `phase17d8b1SourceContract.test.js` | 74 PASS |
| `phase17d8b1CaseDocument.mongo.test.js` | PASS |
| `phase17d8b2aSourceContract.test.js` | 65 PASS |
| `phase17d7SourceContract.test.js` | 89 PASS |
| `phase17d7BuyerUi.test.js` | 27 PASS |
| `phase17d7ProviderQuoteUi.test.js` | 27 PASS |
| `phase17d7Quote.mongo.test.js` | PASS |
| `phase17d3rSourceContract.test.js` | 66 PASS |
| `phase17d3rProviderUi.test.js` | 45 PASS |
| `phase17d3rProviderDomains.mongo.test.js` | 9 PASS |
| `validateProductionEnv.test.js` | 62 PASS |

Mongo tests used disposable `strideto_*` databases on local Mongo, not staging.

---

## 12. Module / build

- `node --check` on touched `.js`: PASS (`.jsx` covered by ESLint + Vite)
- ESLint on touched JS/JSX: PASS (pre-existing `routes/index.jsx` react-refresh warning only)
- New npm dependencies: NONE
- Frontend production build: PASS (`vite build`, 41.26s). DEV fixture route not present in `client/dist`.

---

## 13. Customer / Provider visual acceptance

Synthetic ACTIVE snapshot fixture only. Production pack not activated. Staging DB not mutated for UI.

Stored appearance preference proven via `localStorage edurozgaar-theme` and `data-theme-preference`. System preference stored as `system`; resolved theme followed OS (dark in this environment) and was not inferred from HTML class alone.

| Surface | System | Light | Dark | 320 | 375 | 768 | 1024 | 1440 | Body overflow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer formation requirements | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS (`scrollWidth <= clientWidth + 1`) |
| Provider formation preparation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Accessibility smoke: semantic h1/h3/h4; labels associated to inputs; Required/Optional textual; readiness/status not color-only; real buttons; Provider attestations default missing and require deliberate confirm (`AdminConfirmDialog` `open={...}`); no file input; no signature widget; no Submit to Wyoming. Mutation errors use `role="alert"` in the Case panels.

Native 200%: USER MANUAL (not proven here).

Screen reader: USER MANUAL (not proven here).

Shell stability: Business Client and Provider workspace layouts still render `<Outlet />`. Fixture → Cases (`/business/cases`) and Quotes (`/agent/business-services/quotes`) kept the app header mounted (login gate as expected when unauthenticated); returning to the fixture remounted the requirement section.

---

## 14. Normal runtime

Rebuild/recreate of **api-a** and **api-b** only onto implementation HEAD `75b821a2f37c2ce10bb30803cce49b86d7ea2e05`. Mongo, Redis, Mailpit, Caddy, frontend, and volumes preserved. Existing Worker not started. No `docker compose down` / `down -v`. Images include `/shared/gbs/requirementPacks/usWyLlcV1.js` with `activationStatus: DRAFT` and `reviewStatus: DRAFT`.

Local APIs were recreated with the existing untracked `docker-compose.appenv-align.yml` overlay (read-only use; file not modified) so `NODE_ENV` / `APP_ENV` continue to agree. That overlay keeps `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`.

| Check | Result |
| --- | --- |
| api-a current implementation HEAD loaded | PASS |
| api-b current implementation HEAD loaded | PASS |
| api-a `GET /api/health` | 200 |
| api-a `GET /api/health/ready` | 200 |
| api-b `GET /api/health` | 200 |
| api-b `GET /api/health/ready` | 200 |
| Caddy `https://localhost:8443/` | 200 |
| frontend container | healthy |
| Mongo / Redis | healthy |
| HSI | OFF (`GET /api/health/hsi` 200 `enabled:false, ready:false, state:disabled`) |
| Marketplace | OFF (`BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`) |
| Existing Worker | STOPPED (`workerRunning:false`; no worker container) |
| Unauth Case list / Provider Case list / document metadata | 401, not 5xx |
| Production pack in container | draft/draft |
| Env override to activate pack | none (`REQUIREMENT_PACK_ACTIVATION` / `WY_PACK_ACTIVE` unset) |
| Staging `gbscases` with snapshot | 0 of 1 (cancelled Case `DTPXRd-9BOY7PcNoAifZT_a_`, attached false) |

Queue pending email/notification jobs were left undrained.

---

## 15. Activation blockers (remain open)

- production `reviewStatus`: draft
- production `activationStatus`: draft
- formal source review approval: not recorded
- legal questions from 17D-8B2B-PRE: still open
- B2C filing authorization: not implemented
- 8C government filing: not implemented

---

## 16. Commits

1. `f7099814535edcfd09a80301f71fd948cc1c5d68` feat(gbs): add versioned filing requirement pack foundation
2. `3d91bf73299e6d1226e111d5a179bac0dbbbf130` feat(gbs): add case formation facts and provider preparation workflow
3. `75b821a2f37c2ce10bb30803cce49b86d7ea2e05` test(gbs): verify wyoming draft pack isolation and readiness
4. this document: docs(release): record phase 17d-8b2b draft pack readiness

Every implementation commit kept the production Wyoming constant draft/draft.
