# STRIDETO PHASE 17D-6
BUSINESS CLIENT WORKSPACE AND SERVICE REQUESTS

**STRIDETO PHASE 17D-6 IMPLEMENTATION: COMPLETE**

**BUSINESS CLIENT WORKSPACE: PASS**

**SERVICE REQUESTS (PRE-QUOTE): PASS**

**LIVE IDEMPOTENCY INDEX DRIFT: FIXED**

**PUBLIC MARKETPLACE DEFAULT: OFF**

**QUOTES: NOT IMPLEMENTED**

**FORMATION CASES: NOT IMPLEMENTED**

**PAYMENTS: NOT STARTED**

**WORKER: STOPPED**

**PHASE 17D-7: NOT STARTED**

**PHASE 17D-8: NOT STARTED**

**PHASE 18: NOT STARTED**

**NATIVE 200% ZOOM: NOT PROVEN / USER MANUAL**

**SCREEN READER: NOT PROVEN / USER MANUAL**

---

## 1. Baseline HEAD

Starting HEAD: `2a950b78928fc3c12648cccc76dd310950343272`

`docs(release): record phase 17d-5 public marketplace readiness`

Branch: `main`

Protected WIP left untouched throughout Phase 17D-6:

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

## 2. Audited implementation HEAD

**AUDITED IMPLEMENTATION HEAD:** `2457165518dabad1aa0b06e5ea834d56294ed032`

`test(gbs): verify service request isolation and lifecycle`

This hash is the last application/test commit of 17D-6. The docs sign-off commit that follows this report is recorded separately after commit and is not predicted here.

---

## 3. Complete 17D-6 commit history

1. `cecbc69f0457ec8e9796482b17d5e5e230efdf13` `feat(gbs): add business client service request authority`
2. `cf525995bd9c18daa377f94eef88b8f44a3b5942` `feat(gbs): add business client and provider request workflows`
3. `2457165518dabad1aa0b06e5ea834d56294ed032` `test(gbs): verify service request isolation and lifecycle`
4. docs sign-off commit created after this report

---

## 4. Phase objective

17D-6 adds the ordinary User Business Client workspace and pre-quote Service Requests only. A non-staff User may explicitly activate `business_client`, create a request against a live-eligible public listing, and progress with the owning Independent or Agency provider through `submitted` → `provider_reviewing` → `ready_for_quote`, or to `declined` / `cancelled`.

It does not add Quotes, Payments, Formation Cases, messaging, documents, Mailroom, My Businesses, or a fifth auth realm.

---

## 5. Scope

In scope:

- Explicit `POST /api/business/activate` granting only `business_client`
- Customer APIs under `/api/business/requests*`
- Provider APIs under `/api/agent/business-services/requests*`
- `/business` workspace (pages live in `pages/BusinessClient/`)
- Request Service CTA on listing detail only
- Provider Service Requests inbox on the Business workspace
- Pre-quote statuses only
- Schema-native unique command index plus create-only live provisioning because `autoIndex` is off
- Listing-style Mongo `11000` recovery with fingerprint and ownership checks

Out of scope (not started):

- Quotes / quote-required checkout
- Formation Cases
- Messaging / documents / Mailroom
- My Businesses
- Fifth auth cookie/realm
- 17D-7 / 17D-8 / Phase 18
- Starting Worker
- Production/staging marketplace enablement

---

## 6. Live idempotency blocker

**FIXED**

### Finding

LIVE IDEMPOTENCY INDEX DRIFT

Initial live behavior:

same command + same payload → two `GbsServiceRequest` rows

First `POST /api/business/requests` with `creationCommandId=live-cmd-1`:

- HTTP 201
- `publicRequestRef` `8ySXVsXnq4XQX9W71GwBDQLS`
- `_id` `6a809b6e47fe554cc7f570e5`

Immediate replay:

- HTTP 201
- `publicRequestRef` `-IweUaZhrXRm6W_lL5mn_cJS`
- `_id` `6a809b6e47fe554cc7f57104`

### Root cause

Staging/live-like Mongo runs with `autoIndex=false` unless `MONGO_AUTO_INDEX=1`, which is intentionally unset.

Physical indexes before the fix:

- `gbsservicerequests`: only `_id_`
- `idempotencyrecords`: only `_id_`

Schema-declared unique indexes were therefore never materialized. Mongo tests passed because they connect with `autoIndex=true`.

### Correction

- Named schema indexes on `GbsServiceRequest` and `IdempotencyRecord`
- Create-only provisioner `provisionCriticalIdempotencyIndexes` (never `syncIndexes`, never drop)
- API startup (api-a and api-b) provisions missing critical indexes only
- `createCustomerServiceRequest` recovers Mongo duplicate-key `11000` using the same create fingerprint and requester ownership
- Same command + different payload → `409` `{ error: "idempotency_conflict" }`
- Cross-user collision on the global `creationCommandId` unique index does not leak another user's request

`autoIndex` production behavior: **OFF / unchanged**. `MONGO_AUTO_INDEX=1` was not set and is not committed.

### Disposable duplicate cleanup

Re-queried and verified both known `live-cmd-1` rows (same disposable requester `6a809aaac4b6a765ad400e81`, listing `17d6-ind-wy-llc`, payload). Deleted only:

- request `6a809b6e47fe554cc7f57104`
- matching idempotency record `6a809b6e47fe554cc7f57101`

Kept canonical request `6a809b6e47fe554cc7f570e5` and its idempotency record. Kept the unique historical `gbs.listing.create` idempotency row. **Destructive DB action: those two disposable duplicate documents only.**

IdempotencyRecord duplicate-group audit before cleanup: **1 group**, all disposable 17D-6 `live-cmd-1`. No non-disposable duplicate groups. Unique index provisioning was therefore safe.

### Live replay after fix

| Check | Result |
|---|---|
| Sequential same command + payload | PASS — both 201, same `publicRequestRef` `yC9APZnHZggQztZMZUkH7Sor` |
| Concurrent api-a + api-b | PASS — both 201, same `publicRequestRef` `MuluGx0HOsTEbwttRL6FR_VT`; Mongo count 1 |
| Payload conflict | PASS — 409 `idempotency_conflict`; no second row |
| Side-effect dedupe | PASS — create audit 1; provider/customer notification keys 1 in autoIndex=false mongo test; replay does not re-notify |
| IdempotencyRecord physical unique index | PASS |
| GbsServiceRequest physical unique command index | PASS |
| No global autoIndex | PASS |
| No destructive index sync | PASS |

---

## 7. Physical critical indexes

`gbsservicerequests`:

- `_id_`
- `gbs_service_request_public_ref_unique` unique `{ publicRequestRef: 1 }`
- `gbs_service_request_creation_command_unique` unique sparse `{ creationCommandId: 1 }`
- `gbs_service_request_requester_created` `{ requesterUserId: 1, createdAt: -1 }`
- `gbs_service_request_provider_inbox` `{ providerSubjectType: 1, providerSubjectId: 1, status: 1, createdAt: -1 }`
- `gbs_service_request_listing_created` `{ listingId: 1, createdAt: -1 }`

`idempotencyrecords`:

- `_id_`
- `idempotency_record_command_unique` unique `{ principalId: 1, tenantId: 1, commandType: 1, idempotencyKey: 1 }`
- `idempotency_record_ttl` `{ expiresAt: 1 }` `expireAfterSeconds: 0`

---

## 8. Buyer authority

Buyer is the existing User realm plus an active `business_client` grant. `activeWorkspace` is UX only. Staff/Agent/Employer/Institution/unauthenticated cannot activate or use customer request APIs. Staff are denied, not silently stripped.

`POST /api/business/activate` is idempotent, grants only `business_client`, and rejects untrusted body fields (`capability`, `grantStatus`, `grantedBy`, `staff`, `role`, `userId`).

Request writes require `requireAuth` + `requireUserAuth` + `requireNonStaffUser` + `requireBusinessClientCapability`.

A brand-new disposable User with no grant received **403** on create. Ownership isolation returns generic **404** to another granted buyer.

---

## 9. Customer and provider routes

Customer:

- `GET /api/business/enabled`
- `POST /api/business/activate`
- `GET/POST /api/business/requests`
- `GET /api/business/requests/:requestRef`
- `POST /api/business/requests/:requestRef/cancel`

Provider (exact subject query/body):

- `GET /api/agent/business-services/requests`
- `GET /api/agent/business-services/requests/:requestRef` (GET does not mutate)
- `POST .../review`
- `POST .../ready-for-quote`
- `POST .../decline`

No generic PATCH. No quote/payment/case routes.

---

## 10. Lifecycle

Statuses: `submitted`, `provider_reviewing`, `ready_for_quote`, `declined`, `cancelled`.

Live HTTP:

- Independent inbox isolation vs another Independent: PASS
- Agency request not visible in Independent inbox: PASS
- VIEW member can read, cannot review (403): PASS
- `REQUESTS_MANAGE` can review: PASS
- ready-for-quote: PASS
- provider decline: PASS
- customer cancel from `ready_for_quote`: PASS

Create uses live `evaluatePublicMarketplaceEligibility`. Ready-for-quote re-checks listing/capability/domain and does **not** require marketplace ON.

---

## 11. Marketplace OFF restoration

Temporary `docker-compose.17d6-tmp.yml` was used only for create acceptance and was deleted. api-a/api-b were recreated without it. Protected `docker-compose.appenv-align.yml` was not edited.

After restoration:

- `GET /api/business-services/enabled` → `{ enabled: false }`
- Historical cancelled request GET → 200 `cancelled`
- New create → 404 `not_found`
- Public listing detail → 404

---

## 12. Tests

| Suite | Result |
|---|---|
| `phase17d6SourceContract.test.js` | 92 passed |
| `phase17d6BuyerUi.test.js` | 24 passed |
| `phase17d6ProviderRequestUi.test.js` | 13 passed |
| `phase17d6ServiceRequest.mongo.test.js` | PASS |
| `phase17d6LiveIndexIdempotency.mongo.test.js` (autoIndex=false) | 3 passed |
| `mongoStartupIndexPolicy.test.js` | 2/2 passed |
| `phase17d3SourceContract.test.js` | 57 passed |
| `phase17d3ProviderWorkspace.mongo.test.js` | PASS |
| `phase17d4Moderation.mongo.test.js` | PASS |
| `phase17d5Marketplace.mongo.test.js` | PASS |
| `phase17d1r1ConcurrencyIdempotency.mongo.test.js` | 6 passed |
| Touched eslint | PASS |
| `node --check` on touched server files | PASS |

---

## 13. Runtime / visual

Worker: `edurozgaar-staging-worker-1` Exited (0) throughout. Queue was not drained.

No unexpected 5xx observed on the live idempotency/lifecycle run. No shell-blink in this API-centric acceptance pass.

Native 200% zoom and screen reader: **NOT PROVEN / USER MANUAL**, same convention as 17D-5. Buyer/provider UI source contracts cover semantic controls, Request Service CTA placement, and no quote product UI.

---

## 14. What 17D-6 did not do

- Did not start 17D-7 / 17D-8 / Phase 18
- Did not add Quotes, Cases, payments, messaging, or a fifth realm
- Did not set `MONGO_AUTO_INDEX=1`
- Did not `syncIndexes` / drop collections / mass-clean Mongo
- Did not push or deploy
- Did not start Worker
- Did not commit qa-artifacts or protected WIP
