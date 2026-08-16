# STRIDETO MERGED PHASE 17D-9A
FILING AUTHORIZATION + EXTERNAL FILING FOUNDATION

**STRIDETO MERGED PHASE 17D-9A: FORMALLY CLOSED**

**ENGINEERING: PASS**

**PRODUCTION AUTHORIZATION: DISABLED / NOT READY**

**EXTERNAL FILING PROVENANCE ENGINEERING: PASS**

**LIVE WYOMING FILING: NOT ACTIVE**

**B2C PRE DECISION LOCK: PASS**

**CaseFilingAuthorization: PASS**

**ConsentGrant modified: NO**

**PRODUCTION WYOMING PACK:** `gbs.requirement_pack.US-WY.LLC` `activationStatus=draft` / `reviewStatus=draft`

**PRODUCTION LEGAL TEXT:** UNAPPROVED / DRAFT / NOT AVAILABLE

**PRODUCTION FILING AUTHORIZATION:** UNAVAILABLE

**PRODUCTION EXTERNAL FILING:** UNAVAILABLE

**HSI PRODUCTION:** OFF / NOT READY

**MARKETPLACE:** OFF

**EXISTING WORKER:** STOPPED

**17D-9B:** NOT STARTED

**PHASE 18:** NOT STARTED

This document records merged 17D-9A engineering acceptance. It does **not** authorize production legal wording, Wyoming pack activation, production filing authorization, live Wyoming filing, HSI enablement, Worker start, push, or deploy.

---

## 1. Baseline

Starting HEAD: `a7c9fda386a8a45c51fe7d29f83c960fa990d5d1`

`docs(release): finalize phase 17d-8b2b acceptance and closure`

Closed predecessors: 17D-3R, 17D-4, 17D-5, 17D-6, 17D-7, 17D-8A, 17D-8B1, 17D-8B2-PRE, 17D-8B2A, 17D-8B2B-PRE, 17D-8B2B.

**B2C PRE lock HEAD:** `85959f109833dccd9c0bfaa46e3ad6a99085cc3d`

`docs(architecture): lock case filing authorization decisions`

Canonical lock: `docs/STRIDETO_PHASE_17D_8B2C_PRE_CASE_FILING_AUTHORIZATION_DECISIONS.md`

**Audited implementation HEAD:** `edd60eb27de895d970e689286fb8ae168e11ba86`

`test(gbs): verify filing authorization and external submission safety`

Local staging api-a / api-b / frontend were rebuilt onto that implementation HEAD. Mongo, Redis, Mailpit, Caddy, volumes, and the stopped Worker were preserved. No `docker compose down` / `down -v`.

This document’s docs-only sign-off commit is the **final formal 17D-9A closure HEAD**.

Protected WIP left untouched:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`
- `docker-compose.appenv-align.yml` (read-only overlay use; file not modified)
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Stash `{0}` untouched. No push. No deploy. Existing Worker was not started. Queue remained undrained (`queuePending=136`).

---

## 2. What 17D-9A closed means

17D-9A success is **high-assurance CaseFilingAuthorization engineering + source-controlled draft legal-text registry + Provider-attested external filing provenance + synthetic DI acceptance + production remaining unavailable**.

17D-9A success is **not**:

- production legal authorization wording
- legal-text approval
- Wyoming pack activation or review fabrication
- production grant availability
- live Wyoming filing
- government credentials, WyoBiz automation, or government API
- government approved / registered / company formed status
- statutory signature / e-sign
- Provider organizer legal authority
- HSI / scanner / MinIO / Vault Transit changes
- Marketplace ON
- existing Worker start
- Phase 17D-9B or Phase 18

---

## 3. Locked architecture (from 17D-8B2C-PRE)

| Decision | Status |
| --- | --- |
| Dedicated `CaseFilingAuthorization` | SELECTED |
| ConsentGrant reuse | NO |
| Production legal wording | LEGAL REVIEW REQUIRED / UNAVAILABLE |
| Production Wyoming pack | DRAFT / NOT ACTIVE |
| Production filing authorization | DISABLED |
| Engineering implementation | AUTHORIZED |
| Government filing | NOT LIVE |
| New grant after `business_client` loss | DENIED |
| Exact authenticated Case owner revoke after `business_client` loss | ALLOWED (narrow exception) |

Concept separation preserved: quote acceptance ≠ CaseFilingAuthorization ≠ RA written consent ≠ statutory signature ≠ registered-agent signature ≠ Provider organizer authority ≠ government filing ≠ government acceptance. External submission attestation ≠ government acceptance.

---

## 4. CaseFilingAuthorization

Dedicated collection `gbs_case_filing_authorizations`. `autoIndex: false`. Opaque `publicAuthorizationRef`. Purpose: `gbs.case_filing_authorization.initial_formation`.

Immutable after grant: customer, Provider subject, Case, capability, jurisdiction, entity type, pack id/version, source set/hash, legal text id/version/hash, purpose, scope.

Bounded states: `active`, `revoked`, `invalidated`, `claimed_for_submission`, `used`, `superseded`. No `success` / `approved` / `complete`.

At most one currently effective authorization for exact Case + Provider subject + pack snapshot + purpose. Unique index is defense-in-depth; grant still uses idempotency + CAS.

No signature image, typed statutory signature, government credentials, RA consent bytes, identity documents, or full Case data.

---

## 5. Legal text

Backend/shared source-controlled registry. Frontend is not authoritative.

Production entry: metadata-only draft placeholder, empty paragraphs, `status=draft`. No fake lawyer, approval, or legal ticket.

Usable for a new grant only if approved + applicable. Tests inject synthetic approved text through internal dependency injection only. No HTTP parameter, env var, DB row, or Admin override can approve legal text. No production build silently substitutes test text.

Grant POST echoes displayed legalText version/hash. Mismatch: `409` `filing_authorization_text_changed`.

**EFFECT ON EXISTING ACTIVE GRANTS AFTER LEGAL-TEXT SUPERSESSION/WITHDRAWAL: LEGAL / PRODUCT POLICY REQUIRED.** Architecture supports current-text grants and stale-screen rejection. Production remains disabled.

---

## 6. Availability and production-disabled truth

Server-authoritative `resolveCaseFilingAuthorizationAvailability()`. Flags may disable only. Flags cannot activate the draft pack, approve legal text, or create Provider authority.

Normal production:

- Wyoming pack draft/draft → `available=false`, reason `requirement_pack_not_active`
- production legal text unapproved
- no grant control
- no submit control
- no authorization row created by page load

Runtime proof on rebuilt api-a/api-b (`APP_ENV=production`):

- pack `gbs.requirement_pack.US-WY.LLC` `draft/draft`
- legal text `draft`, paragraphs `0`
- `isGbsFilingAuthorizationEnabled=false`
- `isGbsExternalFilingAttestationEnabled=false`
- staging `gbs_case_filing_authorizations` count `0`
- staging `gbs_external_filing_submissions` count `0`

---

## 7. Grant / revoke / invalidation

Customer GET `/business/cases/:caseRef/filing-authorization` has no side effect.

Customer POST `.../grant`: authenticated, `requireNonStaffUser`, exact `requesterUserId`, active `business_client`, `secureTrustedOrigin`, rate limit, idempotency, server-resolved pack and legal text, current Provider authority, fail-closed audit.

Customer POST `.../revoke`: exact Case owner, same Case/customer, revocable status, idempotency, CAS, `secureTrustedOrigin`, fail-closed audit. Provider/Staff/Admin cannot grant or customer-revoke.

After `business_client` loss: new grant DENIED; exact authenticated requester MAY revoke an already-active authorization. No other Case mutation authority is granted by that exception.

Provider change (service/model test only, no product reassign route): old authorization invalidated / ineffective. No transfer.

Pack version or source snapshot change: old authorization not valid for future filing. Historical row retained.

Terminal Case (`cancelled` / `unable_to_proceed` / `completed`): new grant, claim, and attestation denied. Historical records preserved.

Provider authority loss: authorization does not override loss. Future filing eligibility false. Claim/attestation denied.

Optional `expiresAt` is supported. Production unset / POLICY REQUIRED. No default 30/90/forever.

---

## 8. Derived readiness (not government-ready)

8A `ready_for_submission` is not redefined as government-ready.

Derived overlays include `authorizedForExternalFiling` and `externalSubmissionState`. True only when B2B requirements are ready, an active valid CaseFilingAuthorization still matches pack/source/legal bindings, Case is non-terminal, Provider is currently authorized, and the authorization is not revoked/invalidated/expired/consumed.

RA written consent remains independent. CaseFilingAuthorization does not satisfy it. RA consent does not satisfy CaseFilingAuthorization.

No statutory signature pad, typed signature, signature image, or e-sign framework.

---

## 9. External filing provenance (8C foundation)

Dedicated `GbsExternalFilingSubmission`. `autoIndex: false`. Opaque `publicSubmissionRef`. One initial formation filing action per exact Case authorization.

`submitted_externally` means only: the exact authorized Provider attested that it performed the external filing action outside STRIDETO. It does **not** mean Wyoming accepted it, processed it, or that a company exists.

Allowed engineering states: `prepared`, `authorization_claimed`, `submitted_externally`. No `government_processing`, `government_approved`, `registered`, `company_formed`, `government_rejected`, or `certificate_issued`.

Claim is one Mongo atomic CAS transition on `status=active`. Claim is not submission. Concurrent customer revoke vs Provider claim: exactly one winner.

Provider attestation: exact Provider subject, current Case duty/`business_services.cases.manage`, B2B requirements ready, successful claim, `secureTrustedOrigin`, idempotency, CAS, fail-closed audit. Provider actor is recorded separately from Provider subject.

Copy: “Record external filing” / “Confirm external filing was completed outside STRIDETO”. Not “Submit to Wyoming”.

No government credentials, OTP, MFA, session cookie, WyoBiz password, portal automation, or government API. Attestation does **not** mark Case `completed`. No automatic company-formation outcome.

Filing method bounded: `wyobiz_online` | `paper_mail`. Authority id `auth:US-WY-SOS` is catalog identity, not a verified government receipt. No required invented Wyoming authority reference. No B2B receipt upload / HSI requirement added.

Resubmission / retry: LEGAL / PRODUCT POLICY REQUIRED. No generic resubmit UI. No unlimited retries.

---

## 10. Indexes and idempotency

Create-only critical index provisioning. `MONGO_AUTO_INDEX` remains OFF. No `syncIndexes()` / `dropIndexes()` / global reconcile.

Unique indexes are defense-in-depth. They do not replace `executeHighValueIdempotentCommand`, CAS predicates, or authorization/state checks.

Live index test: required unique/lookup indexes present; unrelated index retained.

---

## 11. Audit

High-assurance events use fail-closed `AuditLog.create`. Grant, revoke, claim, and attestation fail if audit persistence fails. No fail-soft `logAudit` for these authority mutations.

Safe metadata only: Case/authorization/submission refs, Provider subject, Provider actor safe ref, pack version, legal text hash, filing method, authority id, timestamps, event code.

Do not audit full legal text, addresses, emails, phones, government credentials, signatures, or document bodies.

Retention class: authorization `filing_consent`; submission `submitted_filing_evidence`. Production durations: POLICY REQUIRED. No hard-delete on revoke. No guessed TTL.

---

## 12. Customer and Provider UI

Generic Case section only when the API says relevant.

Customer states: Unavailable, Available, Authorized, Revoked, Invalidated, Claimed/used as appropriate. Production currently Unavailable: “Filing authorization is not yet available for this Case.” No grant checkbox/button.

Synthetic available ceremony: Provider identity, Case/service scope, jurisdiction/entity, purpose, legal text as real paragraphs (no `dangerouslySetInnerHTML`), version, unchecked affirmation, Authorize Provider, separate confirmation (`AdminConfirmDialog` with explicit `open={grantOpen}` / `open={revokeOpen}`). Dialogs default closed.

Revoke copy states that revocation cannot undo an already-recorded external filing.

Provider: read-only customer authorization status, B2B requirements state, external filing eligibility, submission provenance. Provider cannot grant or customer-revoke. Record control appears only when `externalSubmissionEligible=true`. After attestation: “External filing recorded — Provider attested. This is not government approval, registration, or company formation.”

DEV fixture: `/dev/gbs-filing-authorization-fixture` gated by `import.meta.env.DEV`. Absent from `client/dist` and from the rebuilt staging frontend nginx tree.

---

## 13. Visual / responsive / a11y

Synthetic DEV fixture only. Production grant/submit controls are not shown.

### Customer filing authorization surface

| Theme | 320 | 375 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| System | PASS | PASS | PASS | PASS | PASS |
| Light | PASS | PASS | PASS | PASS | PASS |
| Dark | PASS | PASS | PASS | PASS | PASS |

System theme: stored preference `edurozgaar-theme=system`. OS dark → resolved dark / `html.dark`. OS light (emulated `prefers-color-scheme: light`) → resolved light / `html.light`. Not inferred from html class alone.

Customer states visually exercised: unavailable (no grant control), available grant screen, confirmation modal, active + revoke modal, error `role=alert`, long Provider name, long legal text, XSS-hostile Provider name rendered as text (`<script>` / `<img onerror>` not executed; 0 img/script nodes).

### Provider authorization + external filing surface

| Theme | 320 | 375 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| System | PASS | PASS | PASS | PASS | PASS |
| Light | PASS | PASS | PASS | PASS | PASS |
| Dark | PASS | PASS | PASS | PASS | PASS |

Provider states visually exercised: not authorized, authorized/claimable, record confirmation modal, submitted_externally, authority-loss disabled, no “Submit to Wyoming”.

Body overflow: `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1` at every tested width, including 320 legal text, long Provider name, and open confirm dialogs. Legal text wraps. Grant/record controls remain reachable at 320.

Keyboard/focus: native labelled checkbox and buttons; Authorize/Record disabled until explicit check; confirmation Cancel received focus; Escape closed revoke dialog; global `:focus-visible` outline remains. No page-render auto-open.

Semantic headings, labelled checkboxes, `role=alert`, customer/provider `aria-busy` during mutation: PASS.

Unsafe raw HTML: NONE.

Native 200%: USER MANUAL (not proven in this browser tooling).

Screen reader: USER MANUAL (not proven in this browser tooling).

Shell stability on DEV fixture: customer fixture states and provider fixture states loaded inside the authenticated app shell without blanking or a full-page login flash. Production Case-list login journey was not invented; production authorization remains unavailable.

---

## 14. Tests

| Suite | Result |
| --- | --- |
| `phase17d9aSourceContract.test.js` | 86 PASS |
| `phase17d9aFilingAuthorizationUi.test.js` | 31 PASS |
| `phase17d9aFilingAuthorization.mongo.test.js` | PASS (disposable `strideto_17d9a_*`) |
| `phase17d9aLiveIndexIdempotency.mongo.test.js` | PASS |
| `phase17d8b2bSourceContract.test.js` | 116 PASS |
| `phase17d8b2bRequirementUi.test.js` | 20 PASS |
| `phase17d8b2aSourceContract.test.js` | 65 PASS |
| `phase17d8aSourceContract.test.js` | 83 PASS |
| `phase17d8aBuyerUi.test.js` | 25 PASS |
| `phase17d8aProviderCaseUi.test.js` | 24 PASS |
| `phase17d8b1SourceContract.test.js` | 74 PASS |
| `phase17d7SourceContract.test.js` | 89 PASS |
| `phase17d7BuyerUi.test.js` | 27 PASS |
| `phase17d7ProviderQuoteUi.test.js` | 27 PASS |
| `phase17d3rSourceContract.test.js` | 66 PASS |
| `phase17d3rProviderUi.test.js` | 45 PASS |
| `validateProductionEnv.test.js` | 62 PASS |

Mongo tests used disposable `strideto_17d9a_*` databases, not staging `edurozgaar`. Staging authorization/submission document counts remained `0`.

Covered by the 17D-9A mongo suite: production-disabled path, synthetic E2E grant→claim→attest, revoke-before-claim, revoke-vs-claim one winner, grant/revoke/attest idempotency, stale legal text 409, pack change, provider-change invalidation, provider authority loss, `business_client` loss revoke exception, terminal Case, quote acceptance does not create authorization, RA consent remains separate, audit fail-closed, isolation.

Known stale Education `professionalCaseManagement` regression: not fixed in this phase.

---

## 15. Static / build

- `node --check` on new server/shared JS: PASS
- ESLint on touched 17D-9A JS/JSX: PASS
- Known existing `routes/index.jsx` react-refresh warning: PRE-EXISTING / NON-BLOCKER
- New npm dependencies: NONE
- Vite production build: PASS
- DEV fixture absent from `client/dist`: PASS
- DEV fixture absent from rebuilt staging frontend: PASS

---

## 16. Normal runtime

Rebuild/recreate of **api-a**, **api-b**, and **frontend** only onto audited implementation HEAD `edd60eb27de895d970e689286fb8ae168e11ba86`. Mongo, Redis, Mailpit, Caddy, and volumes preserved. Existing Worker not started. No `docker compose down` / `down -v`.

Local APIs used the existing untracked `docker-compose.appenv-align.yml` overlay (read-only use; file not modified). That overlay keeps `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`.

| Check | Result |
| --- | --- |
| api-a current implementation HEAD loaded | PASS |
| api-b current implementation HEAD loaded | PASS |
| api-a `GET /api/health` | 200 |
| api-a `GET /api/health/ready` | 200 |
| api-b `GET /api/health` | 200 |
| api-b `GET /api/health/ready` | 200 |
| Caddy HTTPS root | 200 |
| Caddy `/api/health` | 200 |
| Caddy `/api/health/ready` | 200 |
| frontend | healthy |
| Mongo | healthy |
| Redis | healthy |
| HSI `GET /api/health/hsi` | enabled=false, ready=false, state=disabled, HTTP 200 |
| Marketplace `GET /api/business-services/listings` | 404 `not_found` |
| Unauthenticated Case / filing / attest routes | 401 (no unexpected 5xx) |
| Production Wyoming pack | draft/draft |
| Production legal text | draft / 0 paragraphs |
| Filing authorization flags | OFF |
| Staging authorization rows | 0 |
| Staging submission rows | 0 |
| Existing Worker | STOPPED (`exited 0`, 12 days) |
| Email/queue | `queued_worker_stopped`, pending 136 undrained |

---

## 17. Remaining production gates

| Gate | Status |
| --- | --- |
| Production filing-authorization wording | LEGAL REVIEW REQUIRED |
| Expiry default | POLICY REQUIRED |
| Existing-grant legal-text supersession/withdrawal | POLICY REQUIRED |
| Resubmission / retry | POLICY REQUIRED |
| Provider organizer / W.S. 17-29-203(b) signing authority | LEGAL / PRODUCT DECISION REQUIRED |
| Whether CaseFilingAuthorization is legally sufficient | LEGAL REVIEW REQUIRED |
| Filing-consent retention duration | POLICY REQUIRED |
| Wyoming pack activation | NOT AUTHORIZED |
| Government outcome model | NOT IN THIS PHASE |
| Statutory signature / e-sign | NOT IN THIS PHASE |
| Production filing authorization | DISABLED / NOT READY |
| Live Wyoming filing | NOT ACTIVE |

---

## 18. Out of scope / unchanged

- HSI activation: NO
- ClamAV / MinIO / Vault Transit / envelope encryption / HSI retention: NONE
- Marketplace ON: NO
- Existing Worker start: NO
- Payment coupling: NONE
- Email dependency for authorization/filing: NONE
- Protected WIP: untouched
- Push: NO
- Deploy: NO
- 17D-9B: NOT STARTED
- Phase 18: NOT STARTED

---

## 19. Commits

1. `85959f109833dccd9c0bfaa46e3ad6a99085cc3d` `docs(architecture): lock case filing authorization decisions`
2. `a3840d4bd7e6463e023bc5c5c3ebe9132f9239d7` `feat(gbs): add high-assurance case filing authorization` (includes 8C provenance foundation in the same backend commit)
3. `0409715f6d4e72d9684e6b23cff41bc2f769698b` `feat(gbs): add customer authorization and provider status workflow`
4. `edd60eb27de895d970e689286fb8ae168e11ba86` `test(gbs): verify filing authorization and external submission safety`
5. This docs-only closure commit: `docs(release): record phase 17d-9a merged authorization readiness`

No amend. No push.

---

## 20. Closure

PHASE 17D-9A CLOSED means engineering for CaseFilingAuthorization and Provider-attested external filing provenance is complete and production remains disabled.

It does **not** authorize draft→active, draft→reviewed, legal-text approval, production grant availability, production external filing, actual Wyoming filing, government credentials, HSI enablement, Worker start, 17D-9B, or Phase 18.
