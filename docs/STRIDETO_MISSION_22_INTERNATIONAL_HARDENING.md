# Strideto Mission 22 — International Hardening

## Outcome

Mission 22 hardens the accepted platform for multi-country operation by enforcing Mission 1 contracts. International architecture does not mean every country, corridor, provider, or jurisdiction is production-ready.

## Targeted assumption audit

Runtime inspection found universal leakage in legacy Company/University country defaults, Job currency defaults, Admin creation forms, editorial workflow timezone fallback, fixed `en-PK` date display, and two public Money displays that divided minor units by 100. Pakistan-specific launch content, SEO content, source scrapers, province configuration, synthetic fixtures, and the configured Pakistan credential rule remain legitimate and were preserved.

## Hardened contracts

- Countries: canonical ISO 3166-1 alpha-2 normalization remains authoritative. Legacy Pakistan/United States/UK/United Kingdom values are read-compatible without write-time backfill. Unknown values remain unknown. Human labels use `Intl.DisplayNames`.
- Jurisdictions: a centralized resolver built on rollout configuration returns required, optional, not-applicable, or not-configured. Unknown/invalid jurisdictions fail truthfully.
- Currency/Money: new legacy Job records no longer inherit PKR; non-empty salary currency must be canonical ISO 4217. Public Program and Scholarship displays use the shared currency-aware formatter, including zero-, two-, and three-decimal currencies. Mixed-currency arithmetic remains forbidden and FX requires an explicit snapshot.
- Time: generic editorial workflows now fall back to UTC, never Karachi. Consultation and Employer scheduling continue to preserve UTC instants plus IANA timezone identity. Shared Intl formatting covers DST-sensitive and non-DST zones; date-only values are not presented with invented times.
- Locale: the common client date utility now delegates to the shared locale-aware formatter instead of fixed `en-PK` rendering.
- Phones/addresses: E.164 normalization never invents a calling code. Region and postal code remain jurisdiction-dependent and optional in the generic Address contract.
- Unicode: organization validation preserves international Unicode names, diacritics, apostrophes, and hyphens while rejecting markup/control characters. Stable opaque ids remain the security identity.

## Product-domain boundaries

- Student nationality, residence, education country, and destination preferences remain separate.
- Education preserves original grading systems, international qualification taxonomy, institution-supplied intake semantics, TestAcceptance scope precedence, and separate Scholarship nationality/residence criteria. No guessed GPA conversion or universal IELTS rule was added.
- Agent service countries and destination countries remain distinct. Institution Program Money retains its currency.
- Consultation double-booking and cross-timezone scheduling remain instant-based. Journey urgency has no server-local/Karachi dependency. Case destination remains explicit.
- Commerce retains immutable transaction currency. Organization approval and provider/Stripe readiness remain separate. Budget Planner retains unresolved multi-currency state and explicit-FX-only conversion. Copilot gains no jurisdiction facts or provider access.
- Employer routes and scheduling architecture were not redesigned; targeted Employer regressions passed.

## Admin and readiness

Mission 21 system readiness now includes a bounded count of Organizations missing canonical country and exposes read-only international-readiness semantics. The deterministic `CountryReadiness` projection evaluates configuration, education data, verification policy, currency, provider, and freshness evidence. Its strongest state is `ready_for_internal_testing`; it always reports `productionReady: false`.

No legacy diagnostic mutates data. Historical free-text country/currency/timezone values may require a future bounded dry-run migration plan, but Mission 22 performed no backfill or silent rewrite.

## Verification

- Mission 22: 60/60 Node-native checks passed.
- Mission 1 regression: 13/13 checks passed.
- Employer post-job validation: all assertions passed.
- Employer timezone identity: 83 assertions passed.
- Synthetic matrix countries: PK, US, GB, CA, DE, AE, JP, IN, NG, BR, AU.
- Currencies: USD, PKR, EUR, GBP, JPY, KWD.
- Timezones: Asia/Karachi, America/Toronto, Europe/London, Asia/Tokyo, Australia/Sydney, Asia/Dubai.
- Targeted hardened-path scan found no universal runtime Pakistan, PKR, +92, Asia/Karachi, fixed `en-PK`, or `amountMinor / 100` assumptions.
- Frontend production build passed (1,139 modules); existing chunk-size and mixed dynamic/static import warnings remain non-blocking.

## Deferred and no-live-operation statement

Verified country data belongs to Mission 25. Full responsive/accessibility/RTL acceptance belongs to Mission 24. Provider country/currency activation and jurisdiction-specific legal, tax, and immigration policy require future authoritative validation.

No live database normalization, migration, backfill, seed, FX call, payment/provider call, legal/tax/travel API, notification, worker, push, or deployment was performed.
