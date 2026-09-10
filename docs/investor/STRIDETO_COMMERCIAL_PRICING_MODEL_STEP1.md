# STRIDETO Proposed Commercial Pricing Model — Step 1

## 1. Purpose and Status

**MANAGEMENT-APPROVED COMMERCIAL MODEL**

**NOT LIVE VALIDATED PRODUCTION PRICING**

**FOR INVESTOR MARKET-SIZING PURPOSES**

This document records the management-approved commercial model and the approved management assumptions for Step 1 ARPA modeling. It does not change product behavior, billing, payment configuration, entitlements, pricing seeds, or Free Beta policy.

ARPA means **annual revenue per paying organization**. It excludes free organizations and does not include free-to-paid conversion.

## 2. Repository Truth vs Management Model

| Area | Current Repository/Product State | Approved Commercial Model | Future Implementation Required? |
|---|---|---|---|
| Employer free quota | Free Beta policy permits `maximumActiveFreeJobs: 5`; visibility is 30 days. Evidence: `server/src/config/freeBetaPublishingPolicy.js`. | One active basic job, basic profile, applicant access, organic visibility, and basic dashboard. | Yes — do not modify Free Beta in this document. |
| Employer PAYG | Seeded USD JobPlans are Starter USD 1 / 7 days, Standard USD 2 / 30 days, and Premium USD 3 / until filled. Paid publishing is gated by `paidPublishingEnabled: false`. Evidence: `server/src/seed/jobPlans.js`; `server/src/config/freeBetaPublishingPolicy.js`. | USD and localized PKR prices defined in §3. | Yes — align plans, durations, currencies, entitlements, and activation policy later. |
| Employer subscriptions | No live Growth/Pro subscription catalog or entitlement was found. `CommerceProduct` is schema capability only. | Growth and Pro subscriptions are base revenue. | Yes. |
| Provider subscriptions | Provider service pricing modes and free promotion exist; paid publishing plans are explicitly not configured. Evidence: `shared/agent/constants.js`; `server/src/models/agent/AgentService.js`; `client/src/pages/Agent/AgentMarketplace.jsx`. | Education/Mobility and Business/Professional providers use subscription-first Growth and Pro plans. | Yes. |
| Institutions | Launch plan is Free; provider state is `not_configured`. Evidence: `shared/institution/institutionPortal.js`; `client/src/pages/Institution/InstitutionBilling.jsx`. | Free initially; institution subscriptions are not modeled yet. | Deferred. |
| Featured/sponsored | `isFeatured` and `isSponsored` fields and admin routes exist, but no paid entitlement or price is linked. Evidence: `server/src/models/Job.js`; `server/src/routes/monetization.js`. | Secondary revenue only. | Yes, if monetized later. |
| Commission | Fee primitives exist, but `getCommissionPolicy()` returns `Commission not configured`. Evidence: `shared/commerce/contracts.js`. | Future/upside only. | Yes. |
| Advertising | Ad slots and impression/click tracking exist; no rate card or customer billing was found. Evidence: `server/src/models/AdSlotConfig.js`; `server/src/routes/monetization.js`. | Future/upside only. | Yes. |

## 3. Employer Pricing

### Free

| Market | Price | Commercial-model entitlement |
|---|---:|---|
| Pakistan | PKR 0 | One active basic job; basic company profile; basic applicant access; standard organic visibility; basic employer dashboard |
| International | USD 0 | One active basic job; basic company profile; basic applicant access; standard organic visibility; basic employer dashboard |

The one-job limit is the approved future commercial model. Current Free Beta behavior is five active free jobs and must not be represented as already changed.

### Pay-as-you-go — base revenue

| Market | Duration | Price |
|---|---:|---:|
| International | 7 days | USD 1 |
| International | 15 days | USD 2 |
| International | 30 days | USD 3 |
| Pakistan localized | 7 days | PKR 299 |
| Pakistan localized | 15 days | PKR 549 |
| Pakistan localized | 30 days | PKR 799 |

Pakistan prices are localized management prices and are not strict USD conversions.

### Growth — base revenue

| Market | Monthly | Annual | Suggested commercial-model entitlement |
|---|---:|---:|---|
| Pakistan | PKR 999 | PKR 9,990 | Approximately 10 active jobs; applicant dashboard; job-management tools; employer branding; basic analytics; saved templates; limited team access |
| International | USD 5 | USD 50 | Same entitlement |

### Pro — base revenue

| Market | Monthly | Annual | Suggested commercial-model entitlement |
|---|---:|---:|---|
| Pakistan | PKR 2,499 | PKR 24,990 | Approximately 30–50 active jobs; multiple team members; stronger analytics; candidate-management tools; priority support; enhanced branding; promotional credits where later supported |
| International | USD 12 | USD 120 | Same entitlement |

Enterprise pricing is not modeled.

## 4. Education & Mobility Provider Pricing

This segment is subscription-first. Employer PAYG mechanics do not apply.

### Free

| Market | Price |
|---|---:|
| Pakistan | PKR 0 |
| International | USD 0 |

### Growth

| Market | Monthly | Annual |
|---|---:|---:|
| Pakistan | PKR 1,499 | PKR 14,990 |
| International | USD 9 | USD 90 |

### Pro

| Market | Monthly | Annual |
|---|---:|---:|
| Pakistan | PKR 3,499 | PKR 34,990 |
| International | USD 19 | USD 190 |

Qualified lead fees and commissions remain future/upside revenue.

## 5. Business / Professional Service Pricing

This segment is also subscription-first. Commissions and transaction revenue remain future/upside.

### Free

| Market | Price |
|---|---:|
| Pakistan | PKR 0 |
| International | USD 0 |

### Growth

| Market | Monthly | Annual |
|---|---:|---:|
| Pakistan | PKR 1,999 | PKR 19,990 |
| International | USD 12 | USD 120 |

### Pro

| Market | Monthly | Annual |
|---|---:|---:|
| Pakistan | PKR 4,999 | PKR 49,990 |
| International | USD 29 | USD 290 |

## 6. Institutions

Institutions remain free initially.

**Classification: DO NOT MODEL YET.**

Institution subscription revenue is excluded from base TAM, SAM, SOM, and base ARPA.

## 7. Individual Users

Candidates, students, professionals, entrepreneurs, and opportunity seekers remain free.

They are demand-side and liquidity metrics, not the primary payer unit. The primary market-sizing unit is one unique paying organization.

## 8. Revenue Stream Classification

| Revenue Stream | Classification | Included in Base ARPA? | Current Product State | Commercial Intent |
|---|---|---:|---|---|
| Organization subscriptions | BASE REVENUE | Yes | Subscription schemas exist; approved plans are not live. | Primary recurring revenue |
| Employer PAYG | BASE REVENUE | Yes | Employer checkout scaffold exists but is gated off; current seeds are placeholders. | Primary usage revenue |
| Featured listing | SECONDARY REVENUE | No | Featured fields and admin controls exist; paid linkage is absent. | Future add-on |
| Sponsored listing | SECONDARY REVENUE | No | Sponsored fields and admin controls exist; paid linkage is absent. | Future add-on |
| Qualified lead fee | FUTURE / UPSIDE | No | Lead workflows exist; fee is not configured. | Future variable revenue |
| Paid consultation facilitation | FUTURE / UPSIDE | No | Consultation/payment states exist; commercial facilitation is not established. | Future variable revenue |
| Marketplace commission | FUTURE / UPSIDE | No | Commission policy is explicitly unconfigured. | Future variable revenue |
| Advertising / sponsorship | FUTURE / UPSIDE | No | Ad slots and tracking exist; price and billing are absent. | Future variable revenue |
| Institution subscriptions | DO NOT MODEL YET | No | Institution launch plan is Free and not configured for paid billing. | Deferred |

Future and secondary revenue is not included in base ARPA.

## 9. ARPA Assumptions

All assumptions in this section are **MANAGEMENT ASSUMPTIONS**, not historical production metrics.

| Scenario | PAYG posts per paying PAYG employer/year | PAYG duration mix (7 / 15 / 30 days) | Employer mix (PAYG / Growth / Pro) | Provider mix (Growth / Pro) | Billing mix (monthly / annual) | Geography mix (Pakistan / International) | Free-to-paid conversion |
|---|---:|---|---|---|---|---|---:|
| Conservative | 2 | 50% / 35% / 15% | 65% / 30% / 5% | 85% / 15% | 80% / 20% | 85% / 15% | 2% |
| Base | 4 | 30% / 40% / 30% | 50% / 40% / 10% | 75% / 25% | 65% / 35% | 70% / 30% | 5% |
| Upside | 6 | 20% / 30% / 50% | 35% / 45% / 20% | 60% / 40% | 50% / 50% | 50% / 50% | 10% |

ARPA is annual revenue per paying organization. Free-to-paid conversion is documented separately and is not multiplied into ARPA.

## 10. Pakistan ARPA

All Pakistan figures below are in PKR per paying organization per year.

| Segment | Conservative | Base | Upside |
|---|---:|---:|---:|
| Employer | PKR 5,525.89 | PKR 8,437.35 | PKR 11,753.25 |
| Education & Mobility Provider | PKR 20,868.40 | PKR 22,588.70 | PKR 25,289.00 |
| Business / Professional Service Provider | PKR 28,408.40 | PKR 31,063.70 | PKR 35,189.00 |

## 11. International ARPA

All International figures below are in USD per paying organization per year.

| Segment | Conservative | Base | Upside |
|---|---:|---:|---:|
| Employer | USD 26.05 | USD 40.16 | USD 55.98 |
| Education & Mobility Provider | USD 121.80 | USD 129.95 | USD 143.00 |
| Business / Professional Service Provider | USD 168.78 | USD 183.63 | USD 206.80 |

## 12. Optional Blended ARPA

The geographic mix is calculated as a weighted contribution in each native currency. No single PKR/USD blended number is presented because no FX assumption was approved.

| Segment | Conservative | Base | Upside |
|---|---|---|---|
| Employer | 85% × PKR 5,525.89 + 15% × USD 26.05 = **PKR 4,697.01 + USD 3.91** | 70% × PKR 8,437.35 + 30% × USD 40.16 = **PKR 5,906.15 + USD 12.05** | 50% × PKR 11,753.25 + 50% × USD 55.98 = **PKR 5,876.63 + USD 27.99** |
| Education & Mobility Provider | 85% × PKR 20,868.40 + 15% × USD 121.80 = **PKR 17,738.14 + USD 18.27** | 70% × PKR 22,588.70 + 30% × USD 129.95 = **PKR 15,812.09 + USD 38.99** | 50% × PKR 25,289.00 + 50% × USD 143.00 = **PKR 12,644.50 + USD 71.50** |
| Business / Professional Service Provider | 85% × PKR 28,408.40 + 15% × USD 168.78 = **PKR 24,147.14 + USD 25.32** | 70% × PKR 31,063.70 + 30% × USD 183.63 = **PKR 21,744.59 + USD 55.09** | 50% × PKR 35,189.00 + 50% × USD 206.80 = **PKR 17,594.50 + USD 103.40** |

These are calculated management-model contributions, not historical revenue. A single USD blended ARPA requires an approved FX methodology and dated exchange-rate source.

## 13. Calculation Detail

### Employer PAYG

```text
Pakistan PAYG annual revenue
= PAYG posts/year × weighted average post price
```

| Scenario | Pakistan weighted post price | Posts/year | Pakistan PAYG annual revenue |
|---|---:|---:|---:|
| Conservative | (50% × 299) + (35% × 549) + (15% × 799) = PKR 461.50 | 2 | PKR 923.00 |
| Base | (30% × 299) + (40% × 549) + (30% × 799) = PKR 549.00 | 4 | PKR 2,196.00 |
| Upside | (20% × 299) + (30% × 549) + (50% × 799) = PKR 624.00 | 6 | PKR 3,744.00 |

```text
International PAYG annual revenue
= PAYG posts/year × weighted average post price
```

| Scenario | International weighted post price | Posts/year | International PAYG annual revenue |
|---|---:|---:|---:|
| Conservative | (50% × 1) + (35% × 2) + (15% × 3) = USD 1.30 | 2 | USD 2.60 |
| Base | (30% × 1) + (40% × 2) + (30% × 3) = USD 2.00 | 4 | USD 8.00 |
| Upside | (20% × 1) + (30% × 2) + (50% × 3) = USD 2.30 | 6 | USD 13.80 |

### Subscription annual revenue

```text
Annual plan revenue per subscriber
= monthly price × 12 × monthly billing mix
  + annual price × annual billing mix
```

For example, Pakistan Employer Growth in the Base scenario:

```text
=(PKR 999 × 12 × 65%) + (PKR 9,990 × 35%)
=PKR 11,288.70
```

### Employer ARPA

```text
Employer ARPA
= PAYG customer share × PAYG annual revenue
  + Growth customer share × Growth annual subscription revenue
  + Pro customer share × Pro annual subscription revenue
```

Employer cohort shares total 100% in each scenario.

Pakistan Employer calculations:

```text
Conservative
= (65% × PKR 923.00)
  + (30% × PKR 11,588.40)
  + (5% × PKR 28,988.40)
= PKR 5,525.89

Base
= (50% × PKR 2,196.00)
  + (40% × PKR 11,288.70)
  + (10% × PKR 28,238.70)
= PKR 8,437.35

Upside
= (35% × PKR 3,744.00)
  + (45% × PKR 10,989.00)
  + (20% × PKR 27,489.00)
= PKR 11,753.25
```

International Employer calculations:

```text
Conservative
= (65% × USD 2.60) + (30% × USD 58.00) + (5% × USD 139.20)
= USD 26.05

Base
= (50% × USD 8.00) + (40% × USD 56.50) + (10% × USD 135.60)
= USD 40.16

Upside
= (35% × USD 13.80) + (45% × USD 55.00) + (20% × USD 132.00)
= USD 55.98
```

### Provider ARPA

```text
Provider ARPA
= Growth plan share × Growth annual subscription revenue
  + Pro plan share × Pro annual subscription revenue
```

The same provider formula is applied separately to Education/Mobility and Business/Professional Services, using their approved plan prices and the scenario-specific billing and plan mixes.

Provider plan shares total 100% in each scenario.

Provider subscription intermediate values:

| Segment / market | Scenario | Growth annual revenue | Pro annual revenue | Provider ARPA formula | ARPA |
|---|---|---:|---:|---|---:|
| Education/Mobility — Pakistan | Conservative | (PKR 1,499 × 12 × 80%) + (PKR 14,990 × 20%) = PKR 17,388.40 | (PKR 3,499 × 12 × 80%) + (PKR 34,990 × 20%) = PKR 40,588.40 | (85% × PKR 17,388.40) + (15% × PKR 40,588.40) | PKR 20,868.40 |
| Education/Mobility — Pakistan | Base | (PKR 1,499 × 12 × 65%) + (PKR 14,990 × 35%) = PKR 16,938.70 | (PKR 3,499 × 12 × 65%) + (PKR 34,990 × 35%) = PKR 39,538.70 | (75% × PKR 16,938.70) + (25% × PKR 39,538.70) | PKR 22,588.70 |
| Education/Mobility — Pakistan | Upside | (PKR 1,499 × 12 × 50%) + (PKR 14,990 × 50%) = PKR 16,489.00 | (PKR 3,499 × 12 × 50%) + (PKR 34,990 × 50%) = PKR 38,489.00 | (60% × PKR 16,489.00) + (40% × PKR 38,489.00) | PKR 25,289.00 |
| Education/Mobility — International | Conservative | (USD 9 × 12 × 80%) + (USD 90 × 20%) = USD 104.40 | (USD 19 × 12 × 80%) + (USD 190 × 20%) = USD 220.40 | (85% × USD 104.40) + (15% × USD 220.40) | USD 121.80 |
| Education/Mobility — International | Base | (USD 9 × 12 × 65%) + (USD 90 × 35%) = USD 101.70 | (USD 19 × 12 × 65%) + (USD 190 × 35%) = USD 214.70 | (75% × USD 101.70) + (25% × USD 214.70) | USD 129.95 |
| Education/Mobility — International | Upside | (USD 9 × 12 × 50%) + (USD 90 × 50%) = USD 99.00 | (USD 19 × 12 × 50%) + (USD 190 × 50%) = USD 209.00 | (60% × USD 99.00) + (40% × USD 209.00) | USD 143.00 |
| Business/Professional — Pakistan | Conservative | (PKR 1,999 × 12 × 80%) + (PKR 19,990 × 20%) = PKR 23,188.40 | (PKR 4,999 × 12 × 80%) + (PKR 49,990 × 20%) = PKR 57,988.40 | (85% × PKR 23,188.40) + (15% × PKR 57,988.40) | PKR 28,408.40 |
| Business/Professional — Pakistan | Base | (PKR 1,999 × 12 × 65%) + (PKR 19,990 × 35%) = PKR 22,588.70 | (PKR 4,999 × 12 × 65%) + (PKR 49,990 × 35%) = PKR 56,488.70 | (75% × PKR 22,588.70) + (25% × PKR 56,488.70) | PKR 31,063.70 |
| Business/Professional — Pakistan | Upside | (PKR 1,999 × 12 × 50%) + (PKR 19,990 × 50%) = PKR 21,989.00 | (PKR 4,999 × 12 × 50%) + (PKR 49,990 × 50%) = PKR 54,989.00 | (60% × PKR 21,989.00) + (40% × PKR 54,989.00) | PKR 35,189.00 |
| Business/Professional — International | Conservative | (USD 12 × 12 × 80%) + (USD 120 × 20%) = USD 139.20 | (USD 29 × 12 × 80%) + (USD 290 × 20%) = USD 336.40 | (85% × USD 139.20) + (15% × USD 336.40) | USD 168.78 |
| Business/Professional — International | Base | (USD 12 × 12 × 65%) + (USD 120 × 35%) = USD 135.60 | (USD 29 × 12 × 65%) + (USD 290 × 35%) = USD 327.70 | (75% × USD 135.60) + (25% × USD 327.70) | USD 183.63 |
| Business/Professional — International | Upside | (USD 12 × 12 × 50%) + (USD 120 × 50%) = USD 132.00 | (USD 29 × 12 × 50%) + (USD 290 × 50%) = USD 319.00 | (60% × USD 132.00) + (40% × USD 319.00) | USD 206.80 |

## 14. Free-to-Paid Assumptions

Free-to-paid conversion is **not part of paying-customer ARPA**.

It is documented for later use in:

- SOM modeling;
- revenue forecasting;
- free-user conversion modeling;
- customer acquisition scenarios.

| Scenario | Free-to-paid conversion |
|---|---:|
| Conservative | 2% |
| Base | 5% |
| Upside | 10% |

The ARPA calculations above use only paying-organization cohort shares. They do not multiply ARPA by free-to-paid conversion.

## 15. Risks / Validation Needed

The following assumptions require later validation and are not repository facts:

- willingness to pay;
- PAYG posting frequency;
- preferred PAYG duration;
- Growth/Pro mix;
- monthly/annual billing mix;
- Pakistan/international paying-organization mix;
- free-to-paid conversion;
- churn and retention;
- discounting and refunds;
- plan entitlement limits;
- provider subscription adoption;
- FX methodology for combined USD reporting.

The current product still requires separate implementation work for paid publishing, 15-day PAYG, PKR routing, employer/provider subscriptions, entitlements, Stripe activation, taxes, refunds, renewals, cancellation, and proration.

## 16. Approved Management Decisions

The following decisions are recorded as **APPROVED MANAGEMENT DECISIONS** for market-sizing work:

- organization subscriptions are base revenue;
- employer PAYG is base revenue;
- provider subscriptions are subscription-first;
- individual users remain free;
- institutions remain free initially and are not modeled yet;
- featured listings are secondary revenue;
- sponsored listings are secondary revenue;
- qualified lead fees are future/upside;
- paid consultation facilitation is future/upside;
- marketplace commission is future/upside;
- advertising/sponsorship is future/upside;
- future variable revenue is excluded from base ARPA;
- the primary payer unit is one unique paying organization;
- PAYG and subscription employers must not be counted twice.

## 17. Product Implementation Decisions Deferred

These decisions require a separate future implementation phase and are intentionally not changed here:

- changing Free Beta active-job capacity from 5 to 1;
- replacing existing JobPlan seed data;
- adding the 15-day PAYG plan;
- adding PKR pricing and currency routing;
- enabling paid publishing;
- implementing employer subscriptions;
- implementing provider subscription entitlements;
- activating Stripe or Stripe Connect in production;
- defining taxes;
- defining refunds;
- implementing renewals;
- implementing cancellation and proration;
- linking featured or sponsored status to paid entitlements;
- configuring commissions or transaction fees.

## 18. Step 1 Final Status

**STEP 1 STATUS: READY FOR STEP 2**

The management-approved pricing model is internally consistent for documentation and ARPA modeling. The calculated ARPAs are management-model outputs, not historical or validated production revenue. No product, billing, payment, seed, Free Beta, configuration, or UI behavior was changed.
