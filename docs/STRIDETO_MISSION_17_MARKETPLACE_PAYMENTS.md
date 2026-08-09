# Strideto Mission 17 — Marketplace Payments

Mission 17 reuses the repository's Stripe SDK and preserves the accepted Employer Stripe checkout/webhook unchanged. A separate provider-neutral interface and Stripe Connect adapter serve marketplace payments, so Stripe objects do not replace Mission 16 orders, transactions, ledger, refunds, or reconciliation.

## Provider and Connect

Marketplace Stripe configuration fails closed as `not_configured`; explicit test/live mode, secret, Connect webhook secret, and a separate live-enable flag determine readiness. Source verification used injected synthetic clients only. Production must separately confirm actual Stripe platform/Connect activation and supported country, currency, capability, and payment-method configuration.

Each Agent/Agency organization has one safe Connect reference with hosted-onboarding status, charges/transfers capabilities, payout readiness, requirement summaries, and synchronization time. No banking or identity evidence is stored. Starting onboarding requires an active Agent membership, approved Mission 2 organization, profile country, and configured provider. The temporary hosted URL is returned only to that Agent and never audited. A return redirect remains pending until server synchronization proves provider readiness. Strideto verification and Stripe KYC are independent; paid capability requires both.

## Checkout and payment truth

The initial strategy is explicitly `destination_charge`: the destination comes from the seller organization's synchronized Connect account and the application fee comes from the immutable order snapshot using integer Money. Students cannot submit amount, currency, destination, fee, or paid state. Fixed-price active Agent services create server-priced orders, optionally linked to the exact owned consultation. PaymentIntent creation uses domain plus Stripe idempotency and returns only safe confirmation data and a client secret to the authenticated purchaser.

The frontend uses Stripe Payment Element/`confirmPayment`; raw card data never crosses the Strideto backend. `requires_action` and `processing` remain visible states. Creation, confirmation result, or onboarding return never marks an order paid. Only a signed provider event can do so.

## Webhooks, accounting, and reconciliation

`/api/webhooks/stripe-marketplace` is a dedicated raw-body route before JSON parsing and remains separate from `/api/webhooks/stripe` for Employer billing. Stripe signature verification rejects missing/invalid signatures and wrong configuration. Provider event ID plus payload fingerprint prevents replay; conflicting fingerprints become security failures.

Verified payment success correlates exact order, amount, currency, seller, and destination. Mismatches become `manual_review`, never silent success. Exactly-once transaction and ledger postings record purchaser debit, seller service credit, and configured platform fee. Failed/canceled events create no paid ledger effects. A linked consultation becomes financially paid only with its exact paid order; consultation lifecycle remains separate.

Student refund requests remain requests. Admin/SuperAdmin may initiate a provider refund, but only provider result completes it. Partial bounds and currency are checked against the confirmed transaction. Destination-charge policy explicitly uses transfer reversal and application-fee refund; verified completion appends compensating entries. Professional disputes never auto-refund.

Stripe Connect owns payout rails. Safe payout events synchronize provider-derived state; no manual withdrawal or bank engine exists. Card-network disputes use a separate financial-dispute model and never become Mission 15 professional disputes. No Vault, message, identity, or private-note evidence is uploaded. Provider financial changes preserve original ledger history and require compensating records/reconciliation.

## Operations, PCI, and rollout

Student checkout/history distinguishes orders, authentication, processing, and provider-confirmed success. Agent Commerce shows Connect onboarding, KYC/capabilities, action-required summaries, orders, and transactions without fake balances. Existing Mission 16 Admin commerce views plus authorized refund initiation provide the bounded operations foundation; no route marks paid/refunded/payout-paid or edits ledger.

Production rollout requires Stripe platform and Connect activation, validated supported countries/currencies, live keys and separate signed webhook secret, completed connected-account onboarding, enabled payment methods/3DS, and approved operational refund/dispute policies. Logs/audits omit secrets, raw bodies, full onboarding URLs, client secrets, payment credentials, bank data, and private KYC evidence.

Focused Mission 17 checks cover all 50 required payment/security behaviors. Mission 16, Mission 13, and Mission 11 regressions cover extended shared contracts; the frontend production build validates the Payment Element and Agent status UX. No real Stripe call, connected account, payment, refund, payout, chargeback, evidence submission, migration, backfill, worker, push, or deployment occurred.
