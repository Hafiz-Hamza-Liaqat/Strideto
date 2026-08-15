# STRIDETO PHASE 17D-8A
GBS CASE WORKSPACE AND PRE-SUBMISSION TRACKING

**PHASE 17D-8A: FORMALLY CLOSED**

**GBS CASE: PASS**

**PHASE BOUNDARY: PRE-SUBMISSION ONLY**

**STOP LINE: ready_for_submission**

**CASE ORIGIN: ACCEPTED QUOTE ONLY**

**ONE CASE PER QUOTE: PASS**

**CASE INITIALIZER RECOVERY: PASS**

**COMPANY FORMATION: STOPS AT ready_for_submission**

**GENERIC PROFESSIONAL SERVICE: INTERNAL COMPLETION ALLOWED WITHOUT FILING CLAIM**

**SUBMITTED TO AUTHORITY: NOT IMPLEMENTED**

**GOVERNMENT TRACKING: NOT IMPLEMENTED**

**GOVERNMENT OUTCOME: NOT IMPLEMENTED**

**AUTHORITY REFERENCE: NOT IMPLEMENTED**

**DOCUMENTS: NOT IMPLEMENTED**

**KYC: NOT IMPLEMENTED**

**E-SIGNATURE: NOT IMPLEMENTED**

**PAYMENT: NOT_CONFIGURED**

**MESSAGING: NOT IMPLEMENTED**

**MY BUSINESSES: NOT IMPLEMENTED**

**PUBLIC MARKETPLACE: OFF**

**WORKER: STOPPED**

**AUTHENTICATED VISUAL MATRIX: PASS**

**SYSTEM / LIGHT / DARK: PASS**

**320 / 375 / 768 / 1024 / 1440: PASS**

**BODY OVERFLOW: PASS**

**CUSTOMER NO-SHELL-BLINK: PASS**

**PROVIDER NO-SHELL-BLINK: PASS**

**BROWSER-VERIFIABLE ACCESSIBILITY: PASS**

**NATIVE 200% ZOOM: NOT PROVEN / USER MANUAL**

**SCREEN READER: NOT PROVEN / USER MANUAL**

**PHASE 17D-8 FULL FILING: NOT IMPLEMENTED**

**PHASE 18: NOT STARTED**

---

## 1. Baseline HEAD

Starting HEAD for implementation: `36d85a60876778f5a22f8e1c7436db301fd83409`

`docs(release): finalize phase 17d-7 acceptance and closure`

Audited 17D-7 application/test HEAD: `02e962854978e92f528e35b4c6fd6a6f20f9ef9b`

Branch: `main`

Protected WIP left untouched throughout Phase 17D-8A:

- `client/src/components/admin/AdminDataTable.jsx`
- `client/src/components/admin/AdminTableFilters.jsx`
- `client/src/components/common/FormField.jsx`

Protected untracked files left untracked:

- `docker-compose.appenv-align.yml`
- `docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md`
- `docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md`

Existing stash left untouched: `stash@{0}: On main: wip: AdminTableFilters values wiring (pre-phase-10)`

Worker remained STOPPED (`edurozgaar-staging-worker-1` Exited). No push. No deploy.

---

## 2. Why this phase is 17D-8A

The broader original 17D-8 filing track would require government submission, authority outcomes, document provenance, KYC, and statutory consent/e-sign architecture. Those dependencies are not approved and are not implemented here.

17D-8A is therefore the bounded operational slice:

Accepted Quote → idempotent `GbsCase` initialization → provider preparation → optional structured customer action → ready for submission → **STOP**.

It is Case workspace and pre-submission tracking. It is not government filing, live application tracking, or STRIDETO filing on a customer's behalf.

---

## 3. Hard document / consent dependency

Quote acceptance is commercial acceptance of a STRIDETO service Quote. It is **not** statutory filing consent.

Government submission remains blocked until a later phase can prove:

- document provenance
- bounded identity/KYC collection
- electronic signature / filing authorization
- authority API or truthful manual-filing evidence

17D-8A does not invent those. No `filing_authorized`, no Vault grants, no passport/ID upload, no signature capture.

---

## 4. GbsCase generic model

Implemented: `server/src/models/gbs/GbsCase.js`

Not created: `FormationCase`, `ApplicationCase`, `ClientBusiness`

Not reused: Education `ProfessionalCase`, Education `/agent/cases`

Specialization is by source-controlled workflow template:

- `company_formation` for `business_formation`
- `generic_professional_service` for formation_consultation, document_preparation, registered_agent, registered_office, ein_assistance, and other non-formation capabilities

Providers cannot upload workflow JSON. Customers cannot choose workflow authority.

---

## 5. Case origin and initializer

A Case may originate only from `GbsQuote.status = accepted` plus that Quote's exact `GbsServiceRequest`.

Command: `gbs.case.initialize`

Quote ACCEPT remains a commercial mutation. After accept success or replay, `ensureGbsCaseForAcceptedQuote(...)` runs as a distinct idempotent command.

Recovery routes call the same initializer:

- `POST /api/business/quotes/:quoteRef/case`
- `POST /api/agent/business-services/quotes/:quoteRef/case`

Server copies requester, exact provider subject, listing, capability, jurisdiction, and service context. Client bodies cannot inject those authorities.

Live recovery: the existing 17D-6/7 accepted Quote `gY78RDzm6r5n9-Upj2wYW5sf` had no Case. Ensure created exactly one Case `DTPXRd-9BOY7PcNoAifZT_a_`. Accept replay and api-a/api-b concurrent ensure returned the same Case. Mongo count for that `quoteId`: **1**.

Quote remains `accepted`. ServiceRequest remains `ready_for_quote`. No Case status was copied onto the ServiceRequest.

---

## 6. Identifier, statuses, milestones

`publicCaseRef` is opaque base64url from 18 random bytes, unique, non-sequential, not a Mongo ObjectId, not `CASE-0001`. Knowing the ref alone does not grant authority.

Locked 17D-8A statuses:

`open` | `in_progress` | `awaiting_client` | `ready_for_submission` | `cancelled` | `unable_to_proceed` | `completed`

`completed` is allowed only for `generic_professional_service`. Company formation **cannot** complete in 17D-8A.

Not present: `submitted_to_authority`, `authority_processing`, `approved`, `registered`, `rejected_by_authority`.

Milestones: `case_opened`, `preparation`, `awaiting_customer_action`, `ready_for_submission`, plus terminal `cancelled` / `unable_to_proceed` / `service_completed` (generic only).

No `submittedAt`, `authorityReference`, `registrationNumber`, `formationDate`, `paidAt`, document ids, or chat ids.

---

## 7. Customer tasks

Bounded structured tasks only. Types: `customer_action`, `provider_action`, `informational`.

Allowlisted keys: `proposed_business_name`, `confirm_service_scope`, `preferred_contact_window`, `additional_non_sensitive_note`.

Input types: `short_text`, `choice`, `confirmation`. No file, passport, DOB, address, bank, signature, or arbitrary JSON.

Customer completes only their own `customer_action` tasks. Provider cannot impersonate customer completion. Completing required tasks from `awaiting_client` deterministically resumes `in_progress`.

---

## 8. Authority, duty, marketplace

Initialization and professional progression require current exact Provider subject, ProviderCapability ACTIVE+VERIFIED, Business domain active, listing professionally valid and Admin-approved, not suspended/rejected/archived. Marketplace public flag is irrelevant.

Capability / domain / listing moderation loss: history remains readable; professional progression denied; no auto-transfer.

`business_client` grant loss: owner history remains readable; buyer mutations denied.

Duty:

- `business_services.view` — Case list/detail
- `business_services.requests.manage` — no Case progression
- `business_services.quotes.manage` — no Case progression
- `business_services.cases.manage` — Case operational mutations
- `education_mobility.cases.manage` — does **not** authorize GBS Cases

Marketplace remained `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0` on api-a and api-b. Case workflow operated while marketplace was OFF.

---

## 9. Customer cancellation and provider unable-to-proceed

Because 17D-8A records no authority submission, the customer may cancel while `open`, `in_progress`, `awaiting_client`, or `ready_for_submission`.

Live cancel of `DTPXRd-9BOY7PcNoAifZT_a_`: status `cancelled`. Quote stayed `accepted`. ServiceRequest stayed `ready_for_quote`. No refund processed. Case not deleted.

Provider `unable-to-proceed` uses allowlisted reason codes. `government_rejected` is not a reason because no authority outcome exists.

Cancel vs ready-for-submission: exactly one winner via status + `recordVersion` CAS. No Case is both cancelled and ready_for_submission.

---

## 10. Idempotency, indexes, CAS

Durable Mongo idempotency for:

`gbs.case.initialize`, `gbs.case.start_preparation`, `gbs.case.request_customer_action`, `gbs.case.complete_customer_action`, `gbs.case.ready_for_submission`, `gbs.case.cancel`, `gbs.case.unable_to_proceed`, plus generic complete when the template allows it.

Same key + same fingerprint: replay. Same key + different payload: `409 idempotency_conflict`.

Critical indexes (explicit create-only; `autoIndex` remains OFF; no `syncIndexes()` / `dropIndexes()`):

1. `gbs_case_public_ref_unique` `{ publicCaseRef: 1 }` unique
2. `gbs_case_creation_command_unique` `{ creationCommandId: 1 }` unique sparse
3. `gbs_case_quote_unique` `{ quoteId: 1 }` unique
4. `gbs_case_requester_created` `{ requesterUserId: 1, createdAt: -1 }`
5. `gbs_case_provider_inbox` `{ providerSubjectType: 1, providerSubjectId: 1, status: 1, updatedAt: -1 }`
6. `gbs_case_status_updated` `{ status: 1, updatedAt: -1 }`

Live provision: api-a created the six indexes; api-b created none (idempotent). `MONGO_AUTO_INDEX` unset.

Every Case mutation uses `recordVersion` / `expectedVersion`. Stale writes: `409 optimistic_concurrency_conflict`.

---

## 11. Privacy, audit, notifications, limits

Customer ownership is `requesterUserId`. Other customer: generic 404. Provider ownership is exact subject. Wrong Provider: generic 404.

Provider projection: display name, actingFor, voluntary business name, service context, preferred language, approved safe task values. No email, phone, home address, User ID, student profile, documents, or payment credentials.

Timeline is append-only server events. Client cannot PATCH history. Provenance is `system` / `customer` / `provider` only. No `government` actor.

Audit events added: `gbs_case_created`, `gbs_case_stage_changed`, `gbs_case_customer_action_requested`, `gbs_case_customer_action_completed`, `gbs_case_cancelled`, `gbs_case_unable_to_proceed`, `gbs_case_ready_for_submission`. No authority-submission audit events. Free-text bodies and sensitive task values are not logged.

Notifications use `createUserNotificationOnce` + queued email. Copy is operational, not governmental. Worker STOPPED: queued ≠ delivered.

Writes: `gbsCaseWriteLimiter` (provider Case mutations) and `gbsBuyerWriteLimiter` (customer task/cancel/ensure). Origin: `secureTrustedOrigin`. No public mutation. No new cookie. No CAPTCHA.

Pagination default 20, max 50. Allowlisted filters only. Customer queries force requester. Provider queries force exact subject.

---

## 12. Runtime

Rebuilt only `api-a`, `api-b`, `frontend` with `--no-deps`. Did not recreate mongodb, redis, or mailpit. Did not `docker compose down`. Worker not started.

- api-a / api-b / frontend: healthy
- `GET /api/health` 200; mongo up; redis up
- `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0`
- Unexpected Case-route 5xx during acceptance: **NONE**
- Controlled statuses observed: 200, 201, 400, 401, 403, 404, 409

Queue (intentionally not drained):

- `queuePending=136`
- email=111
- notification=25
- `workerRunning=false`
- `effectiveState=queued_worker_stopped`

---

## 13. Visual and accessibility

Customer nav: Overview, Service Requests, Quotes, Cases. No Payments, Documents, Messages, My Businesses, or Mailroom in the Business workspace.

Provider Business Services nav preserves existing order and adds Cases after Quotes. Education `/agent/cases` is unchanged.

Customer-visible ready-for-submission copy:

> The provider has marked this Case ready for the next filing or submission step. Strideto has not submitted anything to a government authority.

Workspace copy: payment is not taken here; government filing is not started here.

Cancel dialog: cancelling stops pre-submission tracking; accepted Quote remains historical; no refund because payment is not configured; nothing was submitted to a government authority.

Prohibited positive-state wording was not found on Case surfaces: submitted to government, government processing, company registered, STRIDETO filed, Pay Now, Upload documents. Agent Portal chrome still contains the pre-existing Education Messages link; GBS Case detail has no Chat action.

SYSTEM / LIGHT / DARK: **PASS** (resolved dark on provider, Light preference on customer, System control present).

320 / 375 / 768 / 1024 / 1440: **PASS**. `scrollWidth <= clientWidth + 1` on tested Case list/detail pages.

Browser-verifiable accessibility: **PASS** — semantic h1/h2/h3, timeline as list, status as text, labelled cancel reason/note, real buttons/links, dialog, `role=alert` / `aria-busy` in Case forms.

Native 200%: **NOT PROVEN / USER MANUAL**

Screen reader: **NOT PROVEN / USER MANUAL**

Customer no-shell-blink: **PASS** (Overview → Cases → Case → Quotes; Business sections nav remained mounted).

Provider no-shell-blink: **PASS** (Overview → Quotes → Cases → Case detail → Service Requests → Overview; Agent Portal / subject shell remained mounted).

Full document navigation may remount auth; in-SPA transitions did not blank the shell.

---

## 14. Tests

Focused:

- `phase17d8aSourceContract.test.js` — 83 assertions passed
- `phase17d8aBuyerUi.test.js` — 25 assertions passed
- `phase17d8aProviderCaseUi.test.js` — 24 assertions passed
- `phase17d8aCase.mongo.test.js` — PASS (origin, isolation, lifecycle, races, authority loss, recovery, indexes, CAS)
- `phase17d8aLiveIndexIdempotency.mongo.test.js` — PASS (`autoIndex=false`, create-only, api-a/api-b-like repeat)

17D-7 regressions (accept/idempotency plus Case-link copy updates): PASS

17D-6 source contract (buyer `/cases` now allowed as 17D-8A): PASS

17D-3R domain/team duty: PASS

Education Case isolation: GBS routes and `business_services.cases.manage` are separate from `education_mobility.cases.manage` and `/agent/cases`. `professionalCaseManagement.test.js` still fails on a pre-existing `requireUserAuth` vs `studentProductAuth` mismatch in `server/src/routes/cases.js`; Education routes were not modified in 17D-8A.

Module link integrity: PASS

Touched ESLint: PASS (pre-existing `react-refresh` warning on `client/src/routes/index.jsx` only)

`node --check` on new/edited server files: PASS

Frontend production build: PASS

Live API script against api-a/api-b: 25/25 passed (ensure, concurrent ensure, accept replay, ownership 404, start-preparation, customer action, ready-for-submission, list/pagination). Subsequent live UI cancel proved customer cancellation without Quote rollback.

No dependency upgrades. No package installation.

---

## 15. What 17D-8A does not do

No `submitted_to_authority`. No government API, scraping, or live authority polling. No authority reference, registration number, formation date, or authority decision. No payment, commission, payout, or refund. No Vault/GBS document upload. No KYC. No e-signature. No chat/WebSocket/Mailroom. No My Businesses. No fifth auth realm. No Worker start. No push. No deploy. Phase 18 is not started.

Deferred:

- Phase 17D-8 full filing: **NOT IMPLEMENTED**
- Government tracking / outcomes: **NOT IMPLEMENTED**
- Documents / KYC / e-sign: **NOT IMPLEMENTED**
- Payment: **NOT_CONFIGURED**
- Messaging: **NOT IMPLEMENTED**
- Mailroom: **NOT IMPLEMENTED**
- My Businesses: **NOT IMPLEMENTED**
- Production marketplace launch: **NOT PERFORMED**
- Phase 18: **NOT STARTED**

---

# FINAL PHASE 17D-8A CLOSURE

Functional implementation: **PASS**

Case origin / one Case per Quote: **PASS**

Initializer recovery: **PASS**

Exact-subject authority: **PASS**

Customer ownership: **PASS**

Agency `cases.manage` isolation: **PASS** (mongo + source; live visual used Independent)

Idempotency / concurrent initialize: **PASS**

Critical indexes: **PASS**

CAS / cancel-vs-ready: **PASS**

Marketplace-OFF operation: **PASS**

Runtime: **PASS**

Authenticated visual acceptance: **PASS**

Responsive: **PASS**

System / Light / Dark: **PASS**

Browser accessibility: **PASS**

Native 200%: **NOT PROVEN / USER MANUAL**

Real screen reader: **NOT PROVEN / USER MANUAL**

Known implementation blockers: **NONE**

Phase 17D-8A: **CLOSED**
