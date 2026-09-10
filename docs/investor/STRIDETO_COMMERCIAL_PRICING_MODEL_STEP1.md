# STRIDETO Proposed Commercial Pricing Model — Step 1

## 1. Purpose and Status

**MANAGEMENT-APPROVED COMMERCIAL MODEL**
**NOT LIVE VALIDATED PRODUCTION PRICING**
**FOR INVESTOR MARKET-SIZING PURPOSES**

**GLOBAL CANONICAL PRICEBOOK: USD**

This document records the approved commercial pricebook and management assumptions for investor market-sizing. It does not activate billing, change product behavior, alter payment configuration, modify pricing seeds, or change the Free Beta policy.

ARPA means **annual revenue per paying organization**. It excludes free organizations and does not include free-to-paid conversion.

There is one canonical pricebook. Customer geography may affect adoption, willingness to pay, conversion, payment success, issuer fees, and rollout timing, but it does not create a separate canonical price.

## 2. Repository Truth vs Management Model

| Area | Current repository/product state | Approved commercial model | Future implementation required? |
|---|---|---|---|
| Employer Free | Free Beta permits up to 5 active free jobs. Evidence: server/src/config/freeBetaPublishingPolicy.js, maximumActiveFreeJobs: 5. | $0; future commercial entitlement is 1 active basic job, basic profile, applicant access, organic visibility, and dashboard. | Yes — do not change Free Beta in this task. |
| Employer PAYG | server/src/seed/jobPlans.js contains placeholder-style Starter $1/7 days, Standard $2/30 days, and Premium $3/until-filled plans. Paid publishing is gated by paidPublishingEnabled: false. | $1/7 days, $2/15 days, $3/30 days. Base revenue. | Yes — add the approved 15-day product and align plan behavior later. |
| Employer subscriptions | No live Growth/Pro subscription catalog or recurring checkout was found. CommerceProduct has future recurring schema capability. | Growth $5/month or $50/year; Pro $12/month or $120/year. | Yes — implement subscriptions and entitlements later. |
| Education & Mobility providers | Provider plan billing is not live. | Free $0; Growth $9/month or $90/year; Pro $19/month or $190/year. Subscription-first. | Yes. |
| Business / Professional Service providers | Provider commerce and service pricing are readiness boundaries; no live subscription billing was found. | Free $0; Growth $12/month or $120/year; Pro $29/month or $290/year. Subscription-first. | Yes. |
| Institutions | Institution launch billing is free/not configured. | Free initially; institution subscriptions are not modeled. | Deferred. |
| Individual users | Demand-side users remain free. | Free; treated as a demand/liquidity metric. | No paid-user model approved. |
| Featured/sponsored listings | Capability or product concepts exist, but they are not linked to live paid billing. | Secondary revenue only. Excluded from base ARPA. | Yes, if later approved. |
| Commissions, leads, consultations, advertising | No validated live monetization was found. | Future/upside only. Excluded from base ARPA. | Yes, if later approved. |

## 3. Employer Pricing

### Free

| Plan | Price | Future commercial entitlement | Revenue classification |
|---|---:|---|---|
| Employer Free | $0 | 1 active basic job; basic employer/company profile; basic applicant access; standard organic visibility; employer dashboard | Free / liquidity |

The current Free Beta policy remains separate and currently permits 5 active free jobs. The 1-job limit is the approved future commercial model, not current product behavior.

### Pay-as-you-go — base revenue

| Duration | Price | Primary value |
|---|---:|---|
| 7 days | $1 | Time-limited paid job visibility |
| 15 days | $2 | Time-limited paid job visibility |
| 30 days | $3 | Time-limited paid job visibility |

### Subscriptions — base revenue

| Plan | Monthly price | Annual price | Suggested commercial value | Likely buyer |
|---|---:|---:|---|---|
| Employer Growth | $5/month | $50/year | Approximately 10 active jobs; applicant dashboard; job management; branding; basic analytics; saved templates; limited team access | Growing employer |
| Employer Pro | $12/month | $120/year | Approximately 30–50 active jobs; multiple team members; stronger analytics; candidate management; priority support; enhanced branding; promotional credits where later supported | Higher-volume employer |

Enterprise pricing is not approved.

## 4. Education & Mobility Provider Pricing

| Plan | Monthly price | Annual price | Model |
|---|---:|---:|---|
| Free | $0 | $0 | Free provider presence |
| Growth | $9/month | $90/year | Subscription-first provider plan |
| Pro | $19/month | $190/year | Higher-capability subscription plan |

Qualified lead fees and commissions remain future/upside and are excluded from base ARPA.

## 5. Business / Professional Service Pricing

| Plan | Monthly price | Annual price | Model |
|---|---:|---:|---|
| Free | $0 | $0 | Free provider presence |
| Growth | $12/month | $120/year | Subscription-first provider plan |
| Pro | $29/month | $290/year | Subscription-first provider plan |

Commissions and transaction revenue remain future/upside and are excluded from base ARPA.

## 6. Institutions

Institutions are **FREE INITIALLY**.

Institution subscription revenue is **DO NOT MODEL YET** and is excluded from base revenue, base ARPA, TAM, SAM, and SOM until separately approved.

## 7. Individual Users

Candidates, students, job seekers, and other opportunity seekers remain free. They are demand-side liquidity users, not the primary payer unit and not part of paying-organization ARPA.

## 8. Revenue Stream Classification

| Revenue stream | Classification | Included in base ARPA? | Current product state | Commercial intent |
|---|---|---:|---|---|
| Organization subscriptions | BASE REVENUE | Yes | Not live validated production billing | Core recurring revenue |
| Employer PAYG | BASE REVENUE | Yes | Stripe checkout path exists but paid publishing is disabled | Core usage revenue |
| Featured listings | SECONDARY REVENUE | No | Not linked to paid billing | Optional promotion revenue |
| Sponsored listings | SECONDARY REVENUE | No | Not linked to paid billing | Optional promotion revenue |
| Qualified lead fees | FUTURE / UPSIDE | No | Not configured as validated billing | Future variable revenue |
| Paid consultation facilitation | FUTURE / UPSIDE | No | Not configured as validated billing | Future variable revenue |
| Marketplace commission | FUTURE / UPSIDE | No | Commission architecture is not active commercial billing | Future transaction revenue |
| Advertising/sponsorship | FUTURE / UPSIDE | No | Not found as validated revenue | Future revenue |
| Institution subscriptions | DO NOT MODEL YET | No | Institutions launch free/not configured | Deferred monetization |

Secondary and future revenue are excluded from base ARPA.

## 9. ARPA Assumptions

All items in this section are **MANAGEMENT ASSUMPTIONS**, not historical production facts.

Geography is no longer a pricebook distinction. Geographic mix may be used later as an adoption, conversion, payment-success, or rollout scenario—not as a different canonical price.

| Scenario | PAYG posts per paying PAYG employer/year | PAYG duration mix (7 / 15 / 30 days) | Employer mix (PAYG / Growth / Pro) | Provider mix (Growth / Pro) | Billing mix (monthly / annual) | Free-to-paid conversion |
|---|---:|---|---|---|---|---:|
| Conservative | 2 | 50% / 35% / 15% | 65% / 30% / 5% | 85% / 15% | 80% / 20% | 2% |
| Base | 4 | 30% / 40% / 30% | 50% / 40% / 10% | 75% / 25% | 65% / 35% | 5% |
| Upside | 6 | 20% / 30% / 50% | 35% / 45% / 20% | 60% / 40% | 50% / 50% | 10% |

ARPA is annual revenue per paying organization. Free-to-paid conversion is documented separately and is not multiplied into paying-customer ARPA.

## 10. Global USD ARPA

All values below are calculated management-model outputs, in USD per paying organization per year. They are not historical revenue and do not include free organizations.

| Segment | Conservative | Base | Upside |
|---|---:|---:|---:|
| Employer | **$26.51** | **$40.16** | **$55.98** |
| Education & Mobility Provider | **$121.80** | **$129.95** | **$143.00** |
| Business / Professional Service Provider | **$168.78** | **$183.63** | **$206.80** |

## 11. Calculation Detail

### Employer PAYG

| Scenario | Weighted post-price calculation | Weighted price | Posts/year | PAYG annual revenue |
|---|---|---:|---:|---:|
| Conservative | (50% × $1) + (35% × $2) + (15% × $3) | $1.65 | 2 | $3.30 |
| Base | (30% × $1) + (40% × $2) + (30% × $3) | $2.00 | 4 | $8.00 |
| Upside | (20% × $1) + (30% × $2) + (50% × $3) | $2.30 | 6 | $13.80 |

Growth annualized revenue = monthly share × ($5 × 12) + annual share × $50. Pro annualized revenue = monthly share × ($12 × 12) + annual share × $120.

| Scenario | Growth annualized revenue | Pro annualized revenue | Employer ARPA formula | Employer ARPA |
|---|---:|---:|---|---:|
| Conservative | $58.00 | $139.20 | (65% × $3.30) + (30% × $58.00) + (5% × $139.20) | **$26.51** |
| Base | $56.50 | $135.60 | (50% × $8.00) + (40% × $56.50) + (10% × $135.60) | **$40.16** |
| Upside | $55.00 | $132.00 | (35% × $13.80) + (45% × $55.00) + (20% × $132.00) | **$55.98** |

### Education & Mobility Provider ARPA

Growth annualized revenue uses $9/month and $90/year. Pro annualized revenue uses $19/month and $190/year.

| Scenario | Growth annualized revenue | Pro annualized revenue | Provider ARPA formula | ARPA |
|---|---:|---:|---|---:|
| Conservative | $104.40 | $220.40 | (85% × $104.40) + (15% × $220.40) | **$121.80** |
| Base | $101.70 | $214.70 | (75% × $101.70) + (25% × $214.70) | **$129.95** |
| Upside | $99.00 | $209.00 | (60% × $99.00) + (40% × $209.00) | **$143.00** |

### Business / Professional Service Provider ARPA

Growth annualized revenue uses $12/month and $120/year. Pro annualized revenue uses $29/month and $290/year.

| Scenario | Growth annualized revenue | Pro annualized revenue | Provider ARPA formula | ARPA |
|---|---:|---:|---|---:|
| Conservative | $139.20 | $336.40 | (85% × $139.20) + (15% × $336.40) | **$168.78** |
| Base | $135.60 | $327.70 | (75% × $135.60) + (25% × $327.70) | **$183.63** |
| Upside | $132.00 | $319.00 | (60% × $132.00) + (40% × $319.00) | **$206.80** |

## 12. Geographic Adoption Scenarios

The pricebook is global and USD-denominated. Geography may still be modeled separately for free-to-paid conversion, customer mix, adoption, willingness to pay, payment success, card and banking access, rollout timing, retention, and churn.

These factors do not change the canonical list price. No geography-specific pricebook ARPA or FX conversion is calculated here.

## 13. Free-to-Paid Assumptions

Free-to-paid conversion remains a separate management assumption:

- Conservative: 2%
- Base: 5%
- Upside: 10%

It is **not part of paying-organization ARPA**. It belongs later in SOM, revenue forecasting, customer acquisition modeling, and conversion analysis.

## 14. Customer Payment Experience

Conceptual future experience:

- Displayed price: USD 1.00
- Checkout submission: USD 1.00
- A customer may use a card or account denominated in another currency.
- Examples include accounts denominated in PKR, GBP, AED, or CAD.
- The customer’s bank, card issuer, or payment network may convert the USD charge at the applicable rate.
- The issuer or network may apply separate foreign-transaction, conversion, or other fees.
- Those fees are not STRIDETO revenue.

Investor-safe disclosure:

> STRIDETO’s canonical prices are denominated in USD. Customers using cards or accounts denominated in another currency may have the charge converted by their bank, card issuer, or payment network at the applicable rate and may incur separate conversion or transaction fees.

STRIDETO does not calculate or guarantee the conversion rate.

## 15. Tax Status

Tax is not implemented and is not approved as part of this documentation revision.

Approved wording:

> Applicable taxes may be added where required.

No tax percentage, tax treatment, VAT/GST assumption, or tax engine behavior is defined here. Tax remains a **FUTURE LEGAL / COMMERCIAL IMPLEMENTATION DECISION**.

## 16. Payment Architecture Note

Current repository behavior:

- employer checkout is Stripe-specific;
- the employer checkout path uses USD;
- employer paid publishing is disabled;
- no automatic FX engine exists;
- no tax engine exists;
- no alternate payment gateway is implemented;
- generic Commerce contracts support ISO currencies, but they do not constitute live billing.

Future merchant and gateway selection is separate from the canonical USD pricebook. No alternate gateway is selected by this document.

## 17. Risks / Validation Needed

The management model requires future validation of willingness to pay, free-to-paid conversion, PAYG posting frequency, duration preference, Growth/Pro mix, monthly/annual billing mix, churn, retention, payment success by geography, card and banking access, subscription adoption, tax/legal requirements, and provider/employer entitlement limits.

The ARPA values above are management-model outputs, not historical or validated production revenue.

## 18. Approved Management Decisions

The following decisions are **APPROVED**:

- one global USD-only canonical pricebook;
- Employer PAYG is base revenue;
- organization subscriptions are base revenue;
- provider subscriptions are subscription-first;
- featured and sponsored listings are secondary revenue;
- qualified leads, consultations, commissions, advertising, and sponsorship are future/upside;
- institutions remain free initially and are not modeled yet;
- individual users remain free;
- the primary market-sizing payer unit is one unique paying organization;
- PAYG and subscription employers must not be double-counted;
- future variable revenue is excluded from base ARPA;
- free-to-paid conversion is not multiplied into paying-organization ARPA;
- no Enterprise plan is priced at this stage.

## 19. Product Implementation Decisions Deferred

The following require a separate future implementation phase:

- change the Free Beta commercial limit from 5 active jobs to 1 if and when launch policy is approved;
- replace placeholder JobPlan seed values;
- add the approved 15-day PAYG product;
- implement Growth and Pro subscriptions;
- define employer and provider entitlements;
- implement payment-provider selection or abstraction;
- activate paid publishing;
- implement tax handling;
- implement refunds and failed-payment handling;
- implement renewals, cancellation, and proration;
- define merchant settlement and provider payout strategy;
- define production billing operations and compliance controls.

No separate country-specific canonical pricebook is planned in this model.

## 20. Step 1 Final Status

The global USD pricebook and USD-only ARPA calculations are internally consistent for documentation and investor market-sizing purposes. They are management-model outputs, not live production pricing or historical revenue.

**STEP 1 STATUS: READY FOR STEP 2**

No product, billing, payment, seed, Free Beta, configuration, database, or UI behavior was changed by this document revision.
