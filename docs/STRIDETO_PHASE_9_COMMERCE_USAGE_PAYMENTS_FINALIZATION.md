# Strideto Phase 9 — Commerce / Usage / Payments Finalization

> **Status:** FROZEN  
> **Baseline after Phase 8 freeze:** `c43e02d`  
> **Authority:** [STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md](STRIDETO_FINAL_FROZEN_MODIFICATION_ROADMAP.md)  
> **Phase 0–8:** FROZEN (not redesigned)  
> **This phase owns:** commerce contracts, usage/quota financial integration, checkout/payment authority, refunds, disputes, reconciliation, receipts, Agent KYC/Connect/payout readiness, financial notifications, financial audit, provider-state truth  
> **Later phases** may own navigation/legal/SEO (10), visual a11y (11), infrastructure/performance (12). They may not redesign frozen portals or enable live money.

Runtime at `https://localhost:8443` (Docker `edurozgaar-staging` + SEC-3F Caddy + local `appenv-align`). Worker **stopped**. Local rebuild of **frontend, api-a, api-b only**. Mongo/Redis/media volumes preserved. No `down -v`, no volume prune, no push, no deploy. **No live Stripe**, no real cards, refunds, payouts, Connect accounts, or email/SMS/push.

**Permanent invariant:** client intent ≠ payment success. Order ≠ paid. Professional dispute ≠ financial dispute. Refund request ≠ refunded. Payout request ≠ payout paid. Only trusted server/provider evidence may establish provider-controlled states.

---

## Money model

Canonical Money remains integer `amountMinor` + explicit ISO currency (`shared/international/money.js`, Mission 1). Zero is a valid amount and is **not** unknown. Unknown is explicit (`UNKNOWN_MONEY`: `unknown: true`, `amountMinor: null`, `currency: null`). Cross-currency arithmetic throws. No implicit FX. Presentation formatting is client-only.

## Order model

`CommerceOrder` identifies purchaser (owner type + id derived from the authenticated principal, never from client `customerId`/`organizationId`), seller organization where relevant, purpose (`agent_consultation` / `agent_professional_service` / `catalog_product`), source resource, integer amount, ISO currency, status, provider reference (select:false), timestamps, and audit. There is no generic money-transfer product. New catalog orders remain `pending_payment` with `paymentAvailability: 'not_configured'` when Stripe is absent.

## Payment state authority

Accepted vocabulary is reused: `pending_payment`, `payment_processing`, `paid`, `failed`, `cancelled`, `partially_refunded`, `refunded`, plus marketplace availability `not_configured` / `provider_pending_future` / `requires_action` / `processing` / `provider_confirmed`. Client cannot set `paid`, `refunded`, `payoutPaid`, `providerReference`, webhook-verified flags, commission, platform fee, or KYC/capability fields (`mass_assignment_rejected` **400**). Admin cannot mark paid. Simulated provider success is the only local path to `paid`, and only when marketplace Stripe is `not_configured`, `MARKETPLACE_STRIPE_MODE` is not `live`, and Host is localhost/127.0.0.1.

## Provider events

Live Stripe webhooks remain signature-verified (`constructEvent` + `STRIPE_CONNECT_WEBHOOK_SECRET`) and are **not called** in this run. Local simulation uses `SimulatedMarketplaceProvider` (never imports Stripe) and authenticated `/marketplace-payments/simulation/*` routes. Events are idempotent by provider event id + payload fingerprint. Duplicate replay returns `duplicate: true` with no second charge, refund, ledger row, payout mutation, or notification. Amount/currency/destination mismatches write `CommerceReconciliation` `manual_review` and **do not** set the order paid.

Standalone local Mongo has no replica set. `paymentSucceeded` uses `runFinanceWrite`: replica-set transactions when available, otherwise the same idempotent upserts without a session, so local paid simulation is **200** rather than unexpected **500**.

## Employer usage / quota

Frozen Phase-4 `FREE_BETA_PUBLISHING_POLICY` is unchanged:

- unlimited private drafts; drafts consume **no** quota and require **no** payment
- verified organization: 1 charged free submission / 24h
- max 5 active free jobs; 10 charged submissions / rolling 30 days
- approved free listing visibility 30 days
- `paidPublishingEnabled: false`

Commerce does not require payment for a free action. Employer checkout returns controlled **503** `not_configured` when Stripe is absent or paid publishing is disabled — it does not invent a price or return fake success.

## Employer paid products

Inventory is live `CommerceProduct` count (`audience: employer`, active, public, non-free). When count is 0 the billing API/UI shows `paidProducts.state = not_configured`. No paid Employer product was invented for Phase 9.

## Student / Agent payments

Truthful states: **free** (no order required), **payment_required** (pending order until provider event), **not_configured** (Stripe configuration). Student creates the order (`paid: false`). Agent cannot mark paid. Student cannot mark paid. Local simulation: pending → trusted synthetic `payment_intent.succeeded` → `paid` + ledger + receipt projection. Failure simulation leaves the order `failed` and receipt **409** `receipt_not_available`.

## Agent commission

`getCommissionPolicy()` returns `{ configured: false, note: 'Commission not configured' }` until an approved policy exists. No 10/15/20% invented. Fee helper with `type: 'none'` yields zero in the same currency.

## KYC / Connect

Provider readiness keeps **separate** fields: `providerKycStatus` / onboarding, `chargesCapability`, `transfersCapability`, `payoutsEnabled`. Agent cannot self-set KYC. Live Connect onboarding is not executed. Local `simulateConnect` writes `provider: 'simulation'` and `acct_sim_{orgId}` only after approved organization verification; duplicate connect is idempotent. Unverified simulate is **403**.

## Payouts

No homemade wallet. Payout paid is provider-authoritative only. Local default remains `not_configured` / `pending_kyc` / `eligible_future` after simulated enablement — never fabricated `paid` without a payout event. Duplicate capability events do not invent a second payout.

## Refunds

Refund request identifies original confirmed transaction, amount, currency, reason, requester, and stays `requested` until a trusted refund event. Over-refund and cross-currency are **400**. Client `refunded=true` / `status` is **400** `mass_assignment_rejected`. Full refund via simulated `refund.updated` is idempotent. Partial refund remains supported by the existing amount ≤ original bound. Professional Trust disputes do not call `requestRefund`.

## Professional vs financial disputes

`professionalTrustService` has no CommerceRefund / requestRefund path. Provider `charge.dispute.*` writes `ProviderFinancialDispute` only. Any bridge must be explicit, authorized, and audited — none is automatic.

## Reconciliation

Stored enum unchanged: `pending_provider | matched | mismatch | manual_review | resolved`. Operational projection: `reconciled | attention_required | manual_review_required`. Mismatch never silently rewrites paid state. Admin Super Control list now includes `operationalState`. Admin may only mark manual review with a required reason. Ledger remains immutable.

## Ledger / history

Append-only `CommerceLedgerEntry`. Idempotency keys prevent duplicate economic events from retries. No fabricated second ledger for UI. Balances are derived.

## Receipts

`GET /commerce/orders/:orderId/receipt` returns a projection only after provider-confirmed paid/refunded states: order number, amountMinor, currency, truncated provider reference, date, purpose, refund state. `downloadablePdf: false`. No PAN/CVV, webhook payload, or secret ids. Pending/failed orders: **409**. Foreign order: **404**.

## Institution

Launch plan remains **Free** (`INSTITUTION_LAUNCH_BILLING`). Future paid Institution products: `not_configured`. No Institution checkout or subscription was created. Runtime billing page: Free + `Live Stripe called: false`.

## Notifications

In-app only via frozen `createUserNotificationOnce` (worker stopped, no real email):

| Audience | Events | Dedupe |
|---|---|---|
| Student | paid / failed / refunded | `commerce:paid:` / `commerce:failed:` / `commerce:refunded:` |
| Agent seller | paid / KYC / payout | `commerce:paid:seller:` / `commerce:kyc:` / `commerce:payout:` |
| Admin (COMMERCE_ADMIN_READ) | reconciliation mismatch | `commerce:recon:` |

Copy is safe (no clientSecret, no Stripe secrets). Deep link `/commerce-history`. Fail-soft: notification errors never fail payment authority.

## Financial audit

Privileged actions audit actor, action, target, metadata (amount/currency/outcome), not raw card/payment-secret material. Simulation audits `liveProviderCalled: false`.

## Idempotency / concurrency

Deterministic keys on order create, provider event id, refund request, ledger lines. In-flight duplicate order/refund retries return the same record. Duplicate provider success/failure/refund events do not double-post. Invalid transitions fail closed (activate already-active job **400**; paid order not overwritten by failure).

## Authorization / security

Student A cannot read Student B receipt (**404**). Agent token on Student commerce history **401**. Institution cannot read Employer/Agent billing (**401**). Unauthenticated Admin commerce **401**; Student on Admin reconciliation **403**. Webhook signature required for live path; simulation denied when Stripe configured or mode `live`. No PAN/CVV storage. Provider references `select:false`. Mass assignment refused.

## HTTP truth

Representative: **200/201** success, **400** mass-assignment / validation, **401** unauth, **403** cross-role / unverified KYC, **404** foreign/missing, **409** receipt-not-available / conflict, **503** provider `not_configured`. Unexpected **5xx** on the Phase 9 probe: **0** (controlled 503 is accepted not-configured semantics).

## Real-runtime simulated evidence (`https://localhost:8443`)

| Chain | Result |
|---|---|
| A Employer free | Draft **201** `quotaConsumed=false`, usage `drafts=1` `dailyUsed=0`; activate **200** `quotaConsumed=true`; retry **400** already active (no double consume) |
| B Employer paid | `paidProducts=not_configured`; checkout **503** `not_configured`; no fake success |
| C Free consultation | Free Agent service create/activate **201/200**; no payment order required |
| D Paid simulation | Order **201** `paid=false` `pending_payment`; simulate success **200** `paid`; replay `duplicate=true`; receipt **200** `downloadablePdf=false`; liveProviderCalled=false |
| E Failure | Simulate failed **200**; replay duplicate; receipt **409** `receipt_not_available` |
| F Refund | Request **201** `requested`; fx/over/mass **400**; simulate refund **200** `refunded`; replay duplicate |
| G KYC/payout | Unverified simulate **403**; after local approved verification, simulate connect **201** ready, charges/transfers active, payout `eligible_future`; replay ready; no live payout |
| H Reconciliation | Amount/currency mismatch recorded as `manual_review` / operational `manual_review_required`; mismatch fixture upserted; Admin student **403**; no silent paid rewrite |
| I Tenancy | Cross-student receipt **404**; Agent on Student history **401**; Institution on Employer/Agent billing **401**; Admin unauth **401** |

Live Stripe called: **No**. Worker: **stopped**.

## UI (no portal redesign)

Checked at 320 / 768 / 1440 on `https://localhost:8443`:

- Student `/commerce-history`: “An order is not a payment… not enabled”; empty orders/transactions; no fake Paid
- Employer `/employer/billing`: provider `not_configured` · paid products `not_configured`; “Success is never fabricated.”; table empty
- Agent `/agent/usage-billing`: “Commission not configured”; KYC `not_started`; charges/transfers inactive separately; no wallet
- Agent `/agent/commerce`: KYC/charges/transfers/payout separated; “Agents cannot mark paid”
- Institution `/institution/billing`: Free launch plan; future products Not configured; Live Stripe called false
- Admin `/admin/sc/commerce` without Admin session: no financial internals leaked

## Deferred live-provider operations

Not in Phase 9 (and not required to freeze):

- Production Stripe keys / live Connect onboarding
- Live charges, refunds, payouts, webhook traffic
- Worker / email / SMS / push
- Invented Employer or Institution paid SKUs
- Approved commission percentages
- Downloadable PDF receipts
- Replica-set requirement for local Docker Mongo (standalone fallback is accepted)

Known non-blocking Vite notes (browserslist stale, react-dom import overlap, some chunks >500 kB) remain Phase 12. Phase 8 login-return is not reopened.

---

## Freeze gate

All Phase 9 freeze-gate conditions are met: integer-minor Money + ISO currency, no implicit FX, client cannot fabricate payment authority, provider events idempotent, Employer free policy intact, no invented paid products, Agent free/payment_required/not_configured truthful, commission not_configured, KYC/charges/transfers/payout separated, refunds safe, professional vs financial disputes separate, reconciliation identifies mismatches without silent repair, tenant isolation and mass assignment fail closed, card-data boundaries hold, notifications dedupe, no live provider, zero unexpected 5xx, zero unresolved BLOCKER/P0/P1/financial MAJOR, local simulation passed.
