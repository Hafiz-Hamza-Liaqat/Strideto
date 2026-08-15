# STRIDETO PHASE 17D-7
BUSINESS SERVICES QUOTES AND CUSTOMER DECISION

**PHASE 17D-7: FORMALLY CLOSED**

**GBS QUOTE: PASS**

**FINAL AUTHENTICATED VISUAL ACCEPTANCE: PASS**

**KNOWN IMPLEMENTATION BLOCKERS: NONE**

**QUOTE ORIGIN: ready_for_quote ONLY**

**MONEY: INTEGER MINOR UNITS**

**FIXED / STARTING-AT / RANGE HONESTY: PASS**

**GOVERNMENT FEES: CATALOG-BACKED SNAPSHOTS**

**THIRD-PARTY FEES: DEFERRED**

**LAZY PERSISTED EXPIRATION: PASS**

**ONE ACTIVE QUOTE: PASS**

**ACCEPTED QUOTE FINAL: PASS**

**REPLACEMENT AFTER DECLINE / WITHDRAW / EXPIRY: PASS**

**REQUEST CANCELLATION CONSISTENCY: PASS**

**EXACT-SUBJECT: PASS**

**QUOTES.MANAGE: PASS**

**IDEMPOTENCY: PASS**

**CONCURRENT CREATE: PASS**

**CAS: PASS**

**RACES: PASS**

**MARKETPLACE-OFF OPERATION: PASS**

**AUTHORITY-LOSS FAIL-CLOSED: PASS**

**PAYMENT: NOT_CONFIGURED**

**FORMATION CASE: NOT IMPLEMENTED**

**MESSAGING: NOT IMPLEMENTED**

**DOCUMENTS: NOT IMPLEMENTED**

**MAILROOM: NOT IMPLEMENTED**

**QUOTE PDF: NOT IMPLEMENTED**

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

**PHASE 17D-8: NOT STARTED**

**PHASE 18: NOT STARTED**

---

## 1. Baseline HEAD

Starting HEAD for implementation: `12af854f8621f3d6d615c514cb982ce973ae3d78`

`docs(release): record phase 17d-6 service request readiness`

Branch: `main`

Protected WIP left untouched throughout Phase 17D-7:

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

Audited implementation HEAD: `02e962854978e92f528e35b4c6fd6a6f20f9ef9b`

`docs(release): record phase 17d-7 quote readiness`

This remains the application/test implementation baseline. No application, test, or config change was made after that commit. The final docs sign-off commit that contains this file is the formal final Phase 17D-7 HEAD.

The last application/test commit of 17D-7 is `2b226d1`.

---

## 3. Complete 17D-7 commit history

1. `5b623bb` `feat(gbs): add quote authority and commercial terms foundation`
2. `0c01fc1` `feat(gbs): add provider and business client quote workflows`
3. `2b226d1` `test(gbs): verify quote lifecycle money and isolation`
4. `02e9628` `docs(release): record phase 17d-7 quote readiness`
5. final docs sign-off commit created after this report (`docs(release): finalize phase 17d-7 acceptance and closure`)

---

## 4. Quote architecture

`GbsQuote` is a new persistence model at `server/src/models/gbs/GbsQuote.js`. It is not CommerceOrder, an Education Case proposal, an Employer offer, or a payment document.

A Quote may originate only from an existing `GbsServiceRequest` with `status = ready_for_quote`. There is no unsolicited free-standing Quote, no customer-created Quote, and no Provider-selected arbitrary customer.

Provider subject is copied from the Service Request (`providerSubjectType` + `providerSubjectId`) and re-checked against the current exact workspace. Wrong Independent or Agency subject returns generic 404.

`publicQuoteRef` is opaque, high-entropy, URL-safe, unique, length-bounded, and non-sequential (`randomBytes` base64url). Sequential `Q-000001` / `QT-0001` and raw Mongo ObjectIds are rejected. Known quoteRef alone never grants access.

Persisted statuses: `draft`, `sent`, `accepted`, `declined`, `withdrawn`, `expired`. `superseded` remains in the enum for compatibility and is not emitted. There is no `paid`, `processing`, `case_started`, or `completed` status.

ServiceRequest status is unchanged. No `quote_sent` / `quote_accepted` / `quote_declined` statuses were added. After accept, the request remains `ready_for_quote` for 17D-8 handoff (`acceptedQuoteId` is not written in 17D-7).

---

## 5. Money, fees, and totals

Professional lines use canonical `shared/international/money.js` integer `amountMinor` + ISO currency. `parseMoney` / `addMoney` / `fromDecimal` are used. There is no JS floating commercial arithmetic and no `amount * 100`.

Professional lines share one Quote currency, `ownership=provider`, `category=provider_service`, max 20 lines. No quantity, unit, discount, coupon, or tax engine.

Listing honesty at send:

- `fixed`: professional subtotal must equal advertised amount and currency
- `starting_at`: professional subtotal must be >= advertised start
- `range`: professional subtotal must stay within advertised min/max
- `quote_required`: any valid professional amount within generic bounds

Official fees are catalog-backed snapshots only. Provider selects approved catalog fee IDs. At send the server reloads current catalog data and snapshots `feeId`, label, currency, amountMinor when fixed/listed, amountModel, cadence, sourceId, sourceVersion, `ownership=government`, `category=official_government`. Catalog major-unit amounts convert with `fromDecimal`. Variable / range / not_catalogued models are snapshotted without fabricating a fixed amount and are not added to the grand total. After send, catalog changes do not mutate the Quote.

Third-party fee lines remain empty. Provider input is rejected.

No FX. Unlike currencies are never added. Official fees retain catalog currency and are grouped. Grand total exists only when every included fixed monetary component shares one currency and is summable. UI always separates Professional Service Fees from Official / Government Fees.

Live mixed-currency visual fixture: **NOT PROVEN — NO SAFE EXISTING FIXTURE**. This is not a known product defect. Supporting implementation/test law remains: no FX; unlike currencies are never added; grand total is omitted unless every included fixed monetary component shares one currency and is summable. No live mixed-currency screenshot is claimed.

---

## 6. Lifecycle, expiry, replacement, cancel

Provider creates a draft from a ready request, edits allowlisted commercial fields, then sends. Send freezes terms, sets `sentAt` and `expiresAt = sentAt + validForDays` (1–30, default 7). Server clock is authoritative.

Lazy persisted expiration: before create-replacement / accept / decline / withdraw / active-slot decisions, `normalizeExpiredQuoteForMutation()` CAS `sent → expired` when `expiresAt <= now`, sets `expiredAt`, increments `recordVersion`, and audits once. No Worker. GET remains read-only and may project `effectiveStatus=expired`.

One active Quote per ServiceRequest: partial unique index on `{ serviceRequestId: 1 }` where status is `draft` or `sent`. Expired leaves `sent`, releasing the slot.

Accepted Quote is final for that ServiceRequest. No replacement after accept. Replacement is allowed after declined / withdrawn / expired when the request is still `ready_for_quote`, no accepted Quote exists, and professional authority passes. New Quote is a new document with `quoteRevision += 1`. Old commercial history is immutable.

Request cancel:

- no Quote, or only a draft: cancel allowed; leftover drafts are withdrawn
- active sent Quote: `409 quote_decision_required`
- accepted Quote: `409 quote_already_accepted`
- terminal declined/withdrawn/expired with no active replacement: cancel allowed

Mongo multi-document transactions were not introduced. Consistency uses CAS choreography: cancel denies sent/accepted; SEND and ACCEPT re-check request `ready_for_quote` immediately; leftover drafts are closed after cancel. A cancelled request cannot later send or accept a commercial Quote.

---

## 7. Authority, privacy, marketplace

Customer: ordinary non-staff User + active `business_client` + owns `requesterUserId`. Staff is denied by `businessClientProductAuth` / `requireNonStaffUser`. Other customers get 404.

Provider: existing Agent realm + exact Independent or Agency workspace + Business domain. `business_services.view` reads. `business_services.requests.manage` does not create/send Quotes. `business_services.quotes.manage` creates, edits, sends, and withdraws. Owner/Admin receive the full Business permission catalog including quotes.manage. Ordinary members stay view-only unless granted. Education duties do not authorize. Team duty does not mint ProviderCapability.

Capability / domain / listing moderation loss: history readable; accept denied; withdraw allowed if exact-subject access remains. Restoring authority before expiry may resume accept. Marketplace public flag is irrelevant for existing Quote workflow. Committed marketplace default remains OFF.

Customer Quote views expose safe display name, actingFor, voluntary business name, preferred language, summary, and service context. They do not expose email, phone, home address, User id, student profile, ID docs, or payment credentials.

Provider Quote views expose public-safe name, Independent/Agency label, capability, jurisdiction, commercial terms, and public verification context. They do not expose Agent email, phone, WhatsApp, memberships, evidence, Admin notes, permission tree, or reviewedBy.

`providerTerms` and decline notes render as plain text.

---

## 8. Idempotency, CAS, indexes

Commands: `gbs.quote.create`, `gbs.quote.send`, `gbs.quote.accept`, `gbs.quote.decline`, `gbs.quote.withdraw` via durable Mongo idempotency + `creationCommandId` unique sparse index + 11000 recovery. Same key + same fingerprint replays. Same key + different payload: `409 idempotency_conflict`. Works across api-a / api-b.

CAS uses `recordVersion` / `expectedVersion`. Stale writes: `409 optimistic_concurrency_conflict`. Accept vs withdraw and accept vs decline converge to one winner via atomic status predicates. Accept requires `expiresAt > now`.

Critical Quote indexes are provisioned create-only by `provisionCriticalIdempotencyIndexes` (same 17D-6 infrastructure). `autoIndex` remains opt-in (`MONGO_AUTO_INDEX === '1'`). No global `syncIndexes`. No index drops.

Physical Quote indexes:

1. `gbs_quote_public_ref_unique` `{ publicQuoteRef: 1 }` unique
2. `gbs_quote_creation_command_unique` `{ creationCommandId: 1 }` unique sparse
3. `gbs_quote_active_slot_unique` `{ serviceRequestId: 1 }` unique partial `status ∈ {draft, sent}`
4. `gbs_quote_requester_created` `{ requesterUserId: 1, createdAt: -1 }`
5. `gbs_quote_provider_inbox` `{ providerSubjectType: 1, providerSubjectId: 1, status: 1, createdAt: -1 }`
6. `gbs_quote_status_expires` `{ status: 1, expiresAt: 1 }`

Live autoIndex=false provisioning created those six names on a disposable `strideto_17d7_*` database and again on staging api-a/api-b startup (`quoteCreated` listed the same names; second process created none).

---

## 9. Audit, notifications, security

Audit events: `gbs_quote_created`, `gbs_quote_updated`, `gbs_quote_sent`, `gbs_quote_accepted`, `gbs_quote_declined`, `gbs_quote_withdrawn`, `gbs_quote_expired`. Metadata is redacted: no providerTerms, declineNote, customerSummary, email, phone, tokens, cookies, or documents.

Notifications use `createUserNotificationOnce` + queued email. Quote sent → customer. Accepted/declined → exact Provider Business-duty recipients. Withdrawn (if previously sent) → customer. No expiration email. Email payload is generic title/text/link only. Worker remains STOPPED, so queued mail is not delivered locally.

Provider Quote writes: `secureTrustedOrigin` + `gbsQuoteWriteLimiter`. Customer accept/decline: `secureTrustedOrigin` + `gbsBuyerWriteLimiter`. Reads: existing authenticated read limiter. No CAPTCHA. No new cookie. No fifth auth realm.

List queries: page/limit default 20 max 50, newest sort, allowlisted filters status / capabilityId / currency.

---

## 10. Tests

| Suite | Result |
|---|---|
| `phase17d7SourceContract.test.js` | 89 passed |
| `phase17d7BuyerUi.test.js` | 27 passed |
| `phase17d7ProviderQuoteUi.test.js` | 27 passed |
| `phase17d7Quote.mongo.test.js` | PASS (origin, exact subject, duties, money, honesty, official fees, CAS, expiry, accept/decline/withdraw, races, cancel, grant/capability/domain/listing loss, marketplace OFF accept, indexes) |
| `phase17d7LiveIndexIdempotency.mongo.test.js` (autoIndex=false) | PASS |
| `phase17d6SourceContract.test.js` | 94 passed |
| `phase17d6BuyerUi.test.js` | 24 passed |
| `phase17d6ProviderRequestUi.test.js` | 14 passed |
| `phase17d6ServiceRequest.mongo.test.js` | PASS |
| `phase17d6LiveIndexIdempotency.mongo.test.js` (autoIndex=false) | 3 passed |
| `phase17d5SourceContract.test.js` | 94 passed |
| `phase17d5MarketplaceUi.test.js` | 53 passed |
| `phase17d4SourceContract.test.js` | 78 passed |
| `phase17d3SourceContract.test.js` | 59 passed |
| `phase17d3ProviderWorkspace.mongo.test.js` | 4 passed |
| `phase17d3rSourceContract.test.js` | 66 passed |
| `phase17d3rProviderDomains.mongo.test.js` | 9 passed |
| `phase17d1ProviderAndPlatform.test.js` | 41 passed |
| `mongoStartupIndexPolicy.test.js` | 2/2 passed |
| Touched eslint | PASS |
| `node --check` on touched server files | PASS |
| Quote module import | PASS |
| Frontend production build | PASS (`vite build`, 7.86s) |

Disposable test databases used `strideto_17d7_*` / `strideto_17d6_*` / `strideto_17d3*` names and were dropped by the test `after` hooks.

---

## 11. Runtime

Rebuilt only `api-a`, `api-b`, and `frontend` with `--no-deps` during implementation. Did not recreate mongodb, redis, or mailpit. Did not `docker compose down`. Worker was not started.

Final authenticated visual/runtime acceptance used the same stack. Marketplace stayed OFF. Worker stayed STOPPED.

- frontend: healthy
- api-a `/api/health` 200, `/api/health/ready` 200
- api-b `/api/health` 200, `/api/health/ready` 200
- mongodb healthy
- redis healthy
- mailpit healthy
- caddy `https://localhost:8443/` 200
- workerRunning=false (`edurozgaar-staging-worker-1` Exited 0)
- `BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0` on api-a and api-b
- `GET /api/business-services/enabled` → `enabled=false`
- Existing Quote workflow operated while marketplace was OFF
- Marketplace remains OFF after acceptance
- `MONGO_AUTO_INDEX` unset
- Unauthenticated Quote routes: 401 `Authentication required` (not 5xx)
- Quote critical indexes provisioned on api-a and api-b startup
- Unexpected Quote-route 5xx during the visual acceptance window: **NONE**

Acceptance-window queue (intentionally not drained):

- `queuePending=129`
- email=104
- notification=25
- `workerRunning=false`
- `effectiveState=queued_worker_stopped`

Queued notification/email work does not mean delivery occurred. Worker remained STOPPED.

---

## 12. Visual and accessibility

Quote pages use nested routes (`path: 'quotes'`), `min-w-0`, `break-words-safe` / `break-all`, `overflow-x-auto` for tables, labelled money inputs, separate Professional vs Official headings, `AdminConfirmDialog` with explicit `open`, `role="alert"`, and `aria-busy`. Accept copy states that accepting does not take payment, does not create a Formation Case, does not submit to a government authority, and does not guarantee approval.

**AUTHENTICATED VISUAL MATRIX: PASS**

System / Light / Dark: **PASS**

320 / 375 / 768 / 1024 / 1440: **PASS**

Body overflow: **PASS**

Customer no-shell-blink: **PASS**

Provider no-shell-blink: **PASS**

Browser-verifiable accessibility: **PASS**

Native 200%: **NOT PROVEN / USER MANUAL**

Real screen reader: **NOT PROVEN / USER MANUAL**

### System theme proof

Appearance = System was explicitly selected (`aria-pressed` on System). Saved preference was not changed to explicit Light merely to fake System proof.

- System → OS Light: **PASS** (`pref=system`, emulated `prefers-color-scheme: light`, `html` class `light`)
- System → OS Dark: **PASS** (`pref=system`, OS `prefers-color-scheme: dark`, `html` class `dark`)

### Customer Quote UI

**PASS**

Covered:

- Business Overview
- Service Requests
- Quotes list
- Quote detail
- Sent
- Accepted
- Declined
- Withdrawn
- Expired
- Accept dialog
- Decline dialog
- Professional Service Fees
- Official / Government Fees
- No Pay Now
- No Proceed to Payment
- No Start Case
- No Upload Documents
- No Chat
- No fake government-submission UI

### Provider Quote UI

**PASS**

Covered:

- Quotes list
- Quote detail
- draft editor
- professional fee line controls
- official fee selection
- provider terms
- valid-for days
- Save Draft
- Send Quote
- Withdraw
- Create Quote from `ready_for_quote` request
- Independent exact-subject context
- Agency exact-subject context
- VIEW-only vs Quote-write visibility
- No Case UI
- No Payment UI

### Responsive matrix

Measured `document.documentElement.scrollWidth <= clientWidth + 1` on tested Quote pages. No body horizontal overflow.

SYSTEM

- 320 PASS
- 375 PASS
- 768 PASS
- 1024 PASS
- 1440 PASS

LIGHT

- 320 PASS
- 375 PASS
- 768 PASS
- 1024 PASS
- 1440 PASS

DARK

- 320 PASS
- 375 PASS
- 768 PASS
- 1024 PASS
- 1440 PASS

### Dialogs

Accept dialog: **PASS**. Copy: accepting does not take payment; does not create a Formation Case; does not submit to government; does not guarantee approval.

Decline dialog: **PASS**. Labelled reason and optional note. No chat/negotiation UI.

Withdraw dialog: **PASS**.

Dialogs remained inside the mobile viewport. Escape close: **PASS** for tested dialogs.

### Quote states

Expired: **PASS**. Visible text `Expired`. Accept unavailable. Worker not required.

Accepted: **PASS**. Visible text `Accepted`. No replacement Quote action. No Pay action. No Formation Case UI.

### Mixed-currency live visual fixture

**NOT PROVEN — NO SAFE EXISTING FIXTURE**

This is not a known product defect. No live mixed-currency screenshot is claimed.

### Accessibility

Browser-verifiable accessibility: **PASS**

- semantic h1/h2/h3 structure
- labelled money fields
- currency association
- Professional / Official fee headings
- status visible as text
- `role=alert` errors
- `aria-busy` loading
- real buttons/links
- accessible confirmation dialogs
- plain-text `providerTerms`

Keyboard/focus: **PASS** for tested dialog Escape and labelled controls. Every focus-visible state was not screenshot-proven.

Native 200%: **NOT PROVEN / USER MANUAL**

Real screen reader: **NOT PROVEN / USER MANUAL**

### Shell stability

Customer no-shell-blink: **PASS**. 110 samples: Business shell/navigation remained mounted.

Provider no-shell-blink: **PASS**. 0 missing-shell samples: Agent Portal / current subject shell remained mounted during SPA navigation.

Full document navigation may remount; in-SPA transitions did not blank the shell.

### Error / security visual states

- Unknown Quote ref: safe Quote not found
- Other-customer Quote: generic Quote not found
- No PII leakage
- No stack trace
- Agency subject: no Independent Quote leakage
- Unexpected Quote route 5xx: **NONE**

---

## 13. What 17D-7 does not do

No payment, payment intent, escrow, commission, payout, or refund. No Formation Case. No government filing. No document collection. No general messaging. No Mailroom. No Quote PDF. No Worker. No push. No deploy. 17D-8 is not started. Phase 18 is not started.

Deferred:

- Phase 17D-8 Formation Cases: **NOT STARTED**
- Payment: **NOT_CONFIGURED**
- Messaging: **NOT IMPLEMENTED**
- Documents: **NOT IMPLEMENTED**
- Mailroom: **NOT IMPLEMENTED**
- Quote PDF: **NOT IMPLEMENTED**
- FX: **NOT IMPLEMENTED**
- Tax engine: **NOT IMPLEMENTED**
- Production marketplace launch: **NOT PERFORMED**
- Phase 18: **NOT STARTED**

---

# FINAL PHASE 17D-7 CLOSURE

Functional implementation: **PASS**

Money / pricing truthfulness: **PASS**

Exact-subject authority: **PASS**

Customer ownership: **PASS**

Agency duty isolation: **PASS**

Idempotency / multi-api: **PASS**

Critical indexes: **PASS**

CAS / race safety: **PASS**

Marketplace-OFF operation: **PASS**

Runtime: **PASS**

Authenticated visual acceptance: **PASS**

Responsive: **PASS**

System / Light / Dark: **PASS**

Browser accessibility: **PASS**

Native 200%: **NOT PROVEN / USER MANUAL**

Real screen reader: **NOT PROVEN / USER MANUAL**

Known implementation blockers: **NONE**

Phase 17D-7: **CLOSED**
