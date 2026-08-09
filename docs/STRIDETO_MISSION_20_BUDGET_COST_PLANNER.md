# Strideto Mission 20 — Budget / Cost Planner

## Overview

Mission 20 builds the Student journey cost-planning layer. A Student can understand how much a study, work, or visit journey may cost; which costs are known, estimated, or unknown; which scholarships reduce costs; whether known costs fit their stated budget; and what assumptions were used.

**Core principle**: KNOWN COST ≠ ESTIMATED COST ≠ UNKNOWN COST. Unknown amount is never zero.

---

## CostPlan Model (`StudentCostPlan`)

| Field | Description |
|---|---|
| `ownerUserId` | Server-derived from JWT. Never client-supplied. |
| `title` | Human-readable plan title (≤200 chars). |
| `journeyType` | `study`, `work`, `visit`, `research`, `other`. |
| `destinationCountry` | ISO 3166-1 alpha-2, optional. |
| `programId` | Optional Program reference, validated server-side. |
| `scholarshipScenarios` | Scholarship references with explicit scenario semantics. |
| `targetIntake` | e.g. "Fall 2025". |
| `planningHorizonMonths` | Used for recurring cost expansion. |
| `displayCurrency` | ISO 4217 display preference — does not imply conversion. |
| `budgetSnapshot` | Snapshot of Student stated budget at plan creation/update. |
| `status` | `draft`, `active`, `archived`. |
| `assumptions` | Explicit human-readable assumptions (≤20 items). |
| `history` | Lightweight change log (plan events). |
| `clonedFromPlanId` | Set on cloned scenarios — safe reference, no mutation of original. |

---

## CostItem Model

| Field | Description |
|---|---|
| `planId` | Foreign key to StudentCostPlan. |
| `ownerUserId` | Denormalized from plan for fast ownership guard. |
| `category` | One of 25 supported cost categories. |
| `label` | Human-readable label (≤300 chars). |
| `amountState` | `known`, `estimated`, `unknown`. Never conflated. |
| `money` | `{ amountMinor: integer, currency: ISO }`. Null when `amountState === 'unknown'`. |
| `tuitionBasis` | `per_year`, `per_semester`, `per_term`, `per_credit`, `whole_program`, `one_time`, `unknown`. |
| `cadence` | `one_time`, `monthly`, `yearly`, `semester`, `term`, `weekly`, `daily`, `custom`, `unknown`. |
| `truthCategory` | One of 7 truth tiers (see below). Required. |
| `provenance` | Source URL, publisher, lastVerifiedAt, evidenceRef (for canonical items). |
| `freshness` | `fresh`, `review_due`, `stale`, `broken`, `unknown`. |
| `deriveTrace` | Derivation description and source item IDs (for DERIVED items). |
| `scholarshipReduction` | Applied reduction record for funding scenarios. |
| `studentEditable` | True for student-entered or student-adjustable items. |
| `required` | True for required journey costs, false for optional. |

---

## Cost Categories (25 supported)

`tuition`, `application_fee`, `enrollment_deposit`, `test_fee`, `test_preparation`, `document_fee`, `credential_evaluation`, `visa_application_fee`, `immigration_health_fee`, `biometrics`, `medical_exam`, `insurance`, `flight_travel`, `local_transport`, `accommodation`, `food`, `utilities`, `books_materials`, `technology`, `living_expenses`, `agent_service`, `consultation`, `professional_service`, `emergency_buffer`, `other`

Not every journey uses every category. Unknown official fees are not populated with invented defaults.

---

## Truth / Source Categories

| Category | Meaning |
|---|---|
| `verified` | Source-backed authoritative record |
| `institution_official` | Sourced from institution directly |
| `government_official` | Government / official body |
| `student_entered` | Student typed it in |
| `strideto_estimate` | Platform estimate (must have source/date) |
| `derived` | Calculated deterministically from known inputs |
| `unknown` | Not yet known |

Student-entered amount **cannot masquerade as verified**. Strideto estimate is not canonical. Unknown is not zero.

---

## Money / Multi-Currency Rules

- All monetary amounts stored as integer `amountMinor` + ISO 4217 `currency` (Mission 1 Money contract).
- No floating-point financial arithmetic.
- A plan may contain items in **multiple currencies**.
- Amounts in different currencies are **never added together** without an explicit FX snapshot.
- `groupTotalsByCurrency()` returns `{ totals: { [currency]: integer } }`.
- If multiple currencies: `totalsByCurrency` shows each separately; `multiCurrencyUnresolved: true`.

---

## FX Boundary

**No live exchange rates.** `FxRateSnapshot` is:

```js
{
  baseCurrency: 'USD',     // ISO 4217
  quoteCurrency: 'GBP',
  rateNumerator: 79,       // integer rational — avoids float drift
  rateDenominator: 100,
  source: 'test-fixture',
  asOf: Date
}
```

`convertMoney(money, targetCurrency, fxSnapshot)` returns `null` if snapshot invalid or pair not covered. Tests use synthetic explicit rate fixtures only. Without rate: **conversion unavailable**. Never silently uses an assumed today's rate.

---

## Program Tuition

- Reuses canonical Program `tuition` field (Mission 7/18): `amountMinor`, `currency`, `per` (basis), `notes`.
- Basis values: `per_year`, `per_semester`, `per_term`, `per_credit`, `whole_program`, `one_time`, `unknown`.
- **Unknown basis → no multiplication.**
- **Unknown duration → no fake total.**
- `deriveTuitionTotal(tuitionMoney, basis, durationMonths)` derives deterministic totals with explicit DERIVED label and trace.
- `whole_program` / `one_time` → no multiplication (tuition IS the total).
- Derived totals preserve component source references.

---

## Scholarship Funding Scenarios

Reuses Mission 7 CanonicalScholarship funding model. Funding types: `full`, `partial`, `fixed_amount`, `component_based`, `unknown`.

**Scenarios:**
- `without_scholarship` — no reduction applied.
- `with_scholarship_if_awarded` — explicitly conditional.
- `awarded_confirmed` — confirmed state only when product supports it.

**Rules:**
- `fixed_amount`: subtracts from matching category, clamped to 0.
- `component_based`: applies only to matching component→category.
- `full`: reduces tuition to 0 (when tuition known).
- `partial` without known amount: **no guess made**.
- `unknown` amount: **no reduction**.
- Potential eligibility ≠ awarded funding. Default comparison communicates "assumes scholarship is awarded."

---

## Recurring Costs

`expandRecurringCost(item, horizonMonths)` expands recurring items deterministically.

Returns `null` when cadence is `unknown`/`custom` or horizon missing. Derived total explicitly labelled. One-time costs expand as × 1.

---

## Budget Gap and Affordability

`calculateBudgetGap({ knownCostMinor, knownFundingMinor, studentBudgetMinor, currency, unknownCostCount })` returns:

| State | Condition |
|---|---|
| `within_budget` | netCost ≤ studentBudget (outside near-budget threshold) |
| `near_budget` | netCost within 10% of studentBudget |
| `over_budget` | netCost > studentBudget |
| `insufficient_information` | unknownCostCount > 0 or no student budget |
| `multi_currency_unresolved` | Multiple currencies detected |

**Language**: "Based on currently known costs" — never "You can afford this." Language explicitly calls out unknown costs and unresolved currencies.

---

## Scenario Comparison

`arePlansComparable(planAResult, planBResult)` validates before any comparison:
- Refuses if either plan has unknown costs.
- Refuses if currencies differ.
- Only ranks plans when **same single currency, no unknowns**.

---

## Data Quality / Provenance / Freshness

- `dataQualitySummary(items)` returns counts by truth tier and stale count.
- `planCompleteness(items, requiredCategories)` returns missing/unknown/stale lists.
- Stale tuition shows warning. Broken source not silently shown as current.
- Canonical items carry `provenance.lastVerifiedAt`, `provenance.sourceVersion`.
- `refreshCanonicalItem()` is **explicit** — never silently mutates stored plan.
- Plan history records what changed and when.

### Historical Snapshot

Saved CostPlan retains `provenance.sourceVersion` / `lastVerifiedAt` so "What data did I use?" is answerable. Refreshing updates explicitly and records a `canonical_refreshed` event.

---

## API Routes (all authenticated Student)

| Method | Path | Description |
|---|---|---|
| GET | `/api/budget/plans` | List plans (paginated) |
| POST | `/api/budget/plans` | Create plan |
| GET | `/api/budget/plans/:planId` | Plan detail |
| PATCH | `/api/budget/plans/:planId` | Update plan |
| POST | `/api/budget/plans/:planId/archive` | Archive plan |
| POST | `/api/budget/plans/:planId/clone` | Clone scenario |
| GET | `/api/budget/plans/:planId/summary` | Computed summary |
| GET | `/api/budget/plans/:planId/items` | List cost items |
| POST | `/api/budget/plans/:planId/items` | Add cost item |
| DELETE | `/api/budget/plans/:planId/items/:itemId` | Remove item |
| PATCH | `/api/budget/plans/:planId/items/:itemId/amount` | Update student amount |
| POST | `/api/budget/plans/:planId/items/:itemId/refresh` | Refresh canonical item |

---

## Client Routes

| Path | Page |
|---|---|
| `/budget` | BudgetPlannerPage — list all plans |
| `/budget/new` | NewBudgetPlanPage — create plan |
| `/budget/compare` | BudgetComparePage — compare two plans |
| `/budget/:planId` | BudgetPlanDetailPage — plan detail, items, summary |

All routes wrapped in `ProtectedRoute` (Student auth required).

---

## Calculation Engine (shared/budget/calculationEngine.js)

Pure deterministic helpers — no I/O, no state:

- `groupTotalsByCurrency(items)` — group and sum by currency
- `expandRecurringCost(item, horizonMonths)` — expand recurring costs
- `deriveTuitionTotal(tuitionMoney, basis, durationMonths)` — derive tuition with trace
- `applyScholarshipFunding(items, funding, scenario)` — apply scholarship reductions
- `calculateBudgetGap(opts)` — determine affordability state and gap
- `resolveMultiCurrencyAffordability(currencyKeys)` — guard for multi-currency
- `dataQualitySummary(items)` — count truth tiers, stale items
- `planCompleteness(items, requiredCategories)` — missing/unknown/stale lists
- `arePlansComparable(planAResult, planBResult)` — validate comparison eligibility

All financial arithmetic in integer minor units. No float arithmetic.

---

## Privacy / Security

- **Ownership**: `ownerUserId` server-derived from JWT. No arbitrary userId from client.
- **Cross-user isolation**: service layer enforces `ownerUserId === req.userId` on every access.
- **No Agent / Institution / Employer access**: budget plans are private Student data.
- **No public projection**: no public endpoint for budget data.
- **Bounded inputs**: ≤200 plans/user, ≤200 items/plan, ≤20 assumptions, bounded labels/notes.
- **Currency validation**: ISO 4217 via `normalizeCurrency()`.
- **amountMinor validation**: `Number.isSafeInteger()` enforced at model and service layers.
- **Audit**: plan created, archived, cloned, canonical refreshed, amount changed — safe metadata only.

---

## Integration

### Student Profile (Mission 3)
Budget snapshot captures student's stated budget (`totalAmountMinor`, `currency`, `tuitionAmountMinor`, `livingAmountMinor`, `period`) at plan creation/update. Does not overwrite Universal Student Profile.

### Personalization (Mission 8)
Summary may expose "selected Program exceeds stated budget" signal. No Mission 8 match score change.

### Journey Planner (Mission 9)
Budget summary may surface budget-gap/budget-review signal for deterministic Journey consumption. Mission 9 remains authoritative for NBA ordering. No silent NBA mutation.

### Copilot (Mission 19)
Copilot may consume structured plan summary (known total, unknown costs, funding scenario, gap). Cannot invent missing costs or FX rates.

### Commerce (Mission 16/17)
**Strict separation**: CostPlan is planning only. Creating a CostItem does not create a Commerce order, payment due, or ledger entry. No Commerce mutation from budget calculations.

---

## Constraints / Boundaries

- **No live FX API**: convertMoney requires explicit synthetic snapshot.
- **No live tuition/cost scraping**: canonical data comes only from existing Program/Scholarship models.
- **No fabricated living-cost datasets**: student enters or leaves unknown.
- **No visa/test/travel fee datasets seeded**: these require Mission 25 controlled data population.
- **No investment/loan/credit-worthiness recommendation**.
- **No guarantee of visa financial sufficiency or real-world affordability**.
- **No financial advice language**: deterministic planning language only.

---

## Mission 21 Boundary

Mission 21 (Admin Super-Control Center) may expose aggregate operational metrics but **not** private Student budget plan details. Admin cannot browse individual cost plans by default.
