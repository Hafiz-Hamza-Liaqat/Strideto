# Strideto Mission 16 — Commerce Foundation

Mission 16 establishes provider-neutral financial contracts and performs no real financial activity.

## Compatibility

The accepted Employer `JobPlan`/`Payment`/Stripe checkout path remains unchanged and functional. Those records use legacy decimal USD fields. No balance, plan, or payment was migrated or recalculated. A future controlled adapter can snapshot a legacy plan into canonical Money and correlate confirmed legacy payments; it must be dry-runnable, idempotent, and preserve original records. No prior canonical credit store existed.

## Canonical commerce

Mission 1 Money (`amountMinor` safe integer plus normalized ISO 4217 currency) is authoritative. Arithmetic refuses mixed currencies and does not default to PKR or USD. Commerce accounts are scoped to owner and purpose; promotional/service credits are unit accounts, not stored cash.

The append-only ledger separates fiat entries from credit-unit entries. Balances are derived by account, currency, and credit type. Corrections append compensating reversal records. Issuance and consumption require idempotency keys and ledger provenance; clients cannot write ledger entries or balances.

Versioned products support audiences, billing modes, Money prices, features, credits, effectiveness windows, and public visibility. Every order embeds the exact product version, unit/base/discount/fee/total Money, quantity, and feature/credit snapshot. Orders, transactions, and ledger entries are distinct. New local orders remain `pending_payment` with `not_configured`; no client endpoint can confirm payment.

Fee policies support none, fixed same-currency Money, or integer basis points. Percentage rounding is deterministic to nearest minor unit with half rounded upward. No commercial rate is configured by default. Agent services support free, fixed-price, starting-from, quote-required, and payment-not-configured semantics; fixed/starting prices require Money. Consultations retain truthful Mission 13 payment-required/not-configured states and are not charged.

## Future provider boundary

Refund records reference a confirmed original transaction, enforce same currency/amount bounds, and begin as `requested`; no normal API can mark them refunded. Professional disputes do not trigger refunds. Payout readiness defaults to `not_configured`, stores no banking credentials, and keeps Mission 2 verification separate from future provider KYC.

Provider-event fingerprints and unique provider event IDs prepare idempotent signed-webhook processing. Reconciliation correlates order, transaction, ledger entries, future provider event, expected/actual Money, and discrepancies. Provider confirmation, signed webhooks, 3DS, KYC, payouts, refunds, chargebacks, and settlement belong to Mission 17.

## Authorization, audit, and UX

Student, Employer, and Agent histories are scoped respectively to the authenticated User, Employer, or active Agent organization. Admin/SuperAdmin has bounded catalog, history, credit issuance, and reversal operations; immutable ledger history has no edit/delete API. Financial audit metadata contains identifiers, integer amounts, currencies, status, and reasons—never card, CVV, bank, provider-secret, or webhook-secret data.

Student and Agent history surfaces explicitly distinguish orders from transactions and state that payments/payouts are unavailable. Existing Employer billing UX is preserved. Admin uses bounded commerce views for products, orders, transactions, ledger, refunds, reconciliation, and payout readiness.

Focused Mission 16 tests cover all 40 required financial/security behaviors. Mission 11 pricing regression and the frontend production build cover changed shared Agent pricing/client surfaces. No payment, refund, payout, provider/KYC call, live migration, backfill, worker, notification, push, or deployment occurred.
