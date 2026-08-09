/**
 * Budget / Cost Planner — pure deterministic calculation engine (Mission 20).
 *
 * Client- and server-safe: pure JS, no I/O, no state.
 *
 * ALL monetary arithmetic in integer minor units (Mission 1 Money contract).
 * No floating-point financial arithmetic.
 * No cross-currency addition without explicit FX snapshot.
 * Unknown amount never becomes zero.
 */

import {
  AMOUNT_STATES,
  COST_CADENCES,
  TRUTH_CATEGORIES,
  TUITION_BASES,
  AFFORDABILITY_STATES,
  FUNDING_SCENARIOS,
  NEAR_BUDGET_THRESHOLD_RATIO,
  isCanonical,
} from './costPlanner.js';

// ── Group totals by currency ──────────────────────────────────────────────────

/**
 * Aggregate cost items into totals keyed by ISO currency.
 * Skips unknown-amount items. Returns:
 *   { totals: { [currency]: number }, unknownCount: number, estimatedCount: number }
 *
 * NEVER adds amounts across currencies without FX snapshot.
 */
export function groupTotalsByCurrency(items) {
  const totals = {};
  let unknownCount = 0;
  let estimatedCount = 0;
  for (const item of items) {
    if (item.amountState === AMOUNT_STATES.UNKNOWN || !item.money) {
      unknownCount++;
      continue;
    }
    const { amountMinor, currency } = item.money;
    if (!Number.isSafeInteger(amountMinor) || typeof currency !== 'string') {
      unknownCount++;
      continue;
    }
    if (item.amountState === AMOUNT_STATES.ESTIMATED) estimatedCount++;
    totals[currency] = (totals[currency] || 0) + amountMinor;
    if (!Number.isSafeInteger(totals[currency])) {
      throw new Error(`Integer overflow accumulating ${currency} totals`);
    }
  }
  return { totals, unknownCount, estimatedCount };
}

// ── Recurring cost expansion ──────────────────────────────────────────────────

/**
 * Expand a recurring cost item over a known horizon.
 * Returns { expanded: Money, periods: number, trace: string } or null if not deterministic.
 *
 * Only expands when cadence and horizonMonths are both known.
 * Returns null for UNKNOWN cadence or missing horizon.
 *
 * NOTE: Caller must label result as DERIVED.
 */
export function expandRecurringCost(item, horizonMonths) {
  if (!item || item.amountState === AMOUNT_STATES.UNKNOWN) return null;
  if (typeof horizonMonths !== 'number' || !Number.isFinite(horizonMonths) || horizonMonths <= 0) return null;
  const { cadence, money } = item;
  if (!money || !Number.isSafeInteger(money.amountMinor)) return null;

  let periodsFloat = 0;
  switch (cadence) {
    case COST_CADENCES.MONTHLY:   periodsFloat = horizonMonths; break;
    case COST_CADENCES.WEEKLY:    periodsFloat = (horizonMonths * 365) / (12 * 7); break;
    case COST_CADENCES.DAILY:     periodsFloat = (horizonMonths * 365) / 12; break;
    case COST_CADENCES.YEARLY:    periodsFloat = horizonMonths / 12; break;
    case COST_CADENCES.SEMESTER:  periodsFloat = horizonMonths / 6; break;
    case COST_CADENCES.TERM:      periodsFloat = horizonMonths / 4; break;
    case COST_CADENCES.ONE_TIME:  periodsFloat = 1; break;
    case COST_CADENCES.UNKNOWN:
    case COST_CADENCES.CUSTOM:
    default: return null;
  }

  const periods = Math.round(periodsFloat);
  if (periods <= 0) return null;
  const expandedMinor = money.amountMinor * periods;
  if (!Number.isSafeInteger(expandedMinor)) return null;

  const trace = `${money.currency} ${money.amountMinor} × ${periods} ${cadence}(s) over ${horizonMonths} months = ${money.currency} ${expandedMinor}`;
  return { expanded: { amountMinor: expandedMinor, currency: money.currency }, periods, trace };
}

// ── Tuition total derivation ──────────────────────────────────────────────────

/**
 * Derive a deterministic program tuition total from tuition-per-period + duration.
 *
 * Returns { derivedMoney, periods, trace } or null if not deterministic.
 *
 * Rules:
 *   - tuitionBasis must be a known, compatible period-based value.
 *   - durationMonths must be provided and > 0.
 *   - WHOLE_PROGRAM / ONE_TIME basis → tuition IS the total (no multiplication).
 *   - UNKNOWN basis → return null (never multiply).
 *   - Result always labelled DERIVED by caller.
 */
export function deriveTuitionTotal(tuitionMoney, tuitionBasis, durationMonths) {
  if (!tuitionMoney || !Number.isSafeInteger(tuitionMoney.amountMinor)) return null;
  if (!tuitionBasis || tuitionBasis === TUITION_BASES.UNKNOWN) return null;

  if (tuitionBasis === TUITION_BASES.WHOLE_PROGRAM || tuitionBasis === TUITION_BASES.ONE_TIME) {
    return {
      derivedMoney: tuitionMoney,
      periods: 1,
      trace: `${tuitionMoney.currency} ${tuitionMoney.amountMinor} (whole program — no multiplication)`,
    };
  }

  if (typeof durationMonths !== 'number' || !Number.isFinite(durationMonths) || durationMonths <= 0) {
    return null; // cannot derive without known duration
  }

  let periods = 0;
  switch (tuitionBasis) {
    case TUITION_BASES.PER_YEAR:     periods = Math.round(durationMonths / 12); break;
    case TUITION_BASES.PER_SEMESTER: periods = Math.round(durationMonths / 6); break;
    case TUITION_BASES.PER_TERM:     periods = Math.round(durationMonths / 4); break;
    case TUITION_BASES.PER_CREDIT:   return null; // credits not known here
    default: return null;
  }

  if (periods <= 0) return null;
  const derivedMinor = tuitionMoney.amountMinor * periods;
  if (!Number.isSafeInteger(derivedMinor)) return null;

  const trace = `${tuitionMoney.currency} ${tuitionMoney.amountMinor}/${tuitionBasis} × ${periods} period(s) (${durationMonths} months) = ${tuitionMoney.currency} ${derivedMinor} [DERIVED]`;
  return { derivedMoney: { amountMinor: derivedMinor, currency: tuitionMoney.currency }, periods, trace };
}

// ── Scholarship component reduction ──────────────────────────────────────────

/**
 * Apply scholarship component funding to a set of cost items (by category).
 *
 * Only applies deterministic fixed amounts.
 * Partial/unknown funding amounts remain unknown.
 * Returns updated items array (new objects, no mutation).
 *
 * Rules:
 *   - FULL funding: if canonical tuition known, reduction = tuition amount; else unknown.
 *   - FIXED_AMOUNT: subtract from matching category; clamp to 0.
 *   - COMPONENT_BASED: match component to category; apply only where amount known.
 *   - PARTIAL without amount: no reduction (cannot guess %).
 *   - UNKNOWN: no reduction.
 *
 * fundingScenario must be explicitly conditional — never treat as guaranteed.
 */
export function applyScholarshipFunding(items, scholarshipFunding, fundingScenario) {
  if (!scholarshipFunding || fundingScenario === FUNDING_SCENARIOS.WITHOUT_SCHOLARSHIP) {
    return items.map((i) => ({ ...i }));
  }
  if (fundingScenario !== FUNDING_SCENARIOS.WITH_SCHOLARSHIP_IF_AWARDED &&
      fundingScenario !== FUNDING_SCENARIOS.AWARDED_CONFIRMED) {
    return items.map((i) => ({ ...i }));
  }

  const { type, amountMinor: fixedAmountMinor, currency: fixedCurrency, components } = scholarshipFunding;

  const result = items.map((item) => {
    const itemCopy = { ...item };
    if (item.amountState === AMOUNT_STATES.UNKNOWN || !item.money) return itemCopy;

    if (type === 'fixed_amount' && Number.isSafeInteger(fixedAmountMinor) && fixedCurrency) {
      if (item.money.currency !== fixedCurrency) return itemCopy;
      if (item.category === 'tuition') {
        const reduced = Math.max(0, item.money.amountMinor - fixedAmountMinor);
        return {
          ...itemCopy,
          money: { amountMinor: reduced, currency: fixedCurrency },
          scholarshipReduction: { amountMinor: fixedAmountMinor, currency: fixedCurrency },
          fundingScenario,
        };
      }
      return itemCopy;
    }

    if (type === 'component_based' && Array.isArray(components)) {
      for (const comp of components) {
        if (!comp.component || !comp.amountMinor || !comp.currency) continue;
        const mappedCategory = _componentToCategory(comp.component);
        if (mappedCategory !== item.category) continue;
        if (item.money.currency !== comp.currency) continue;
        const reduced = Math.max(0, item.money.amountMinor - comp.amountMinor);
        return {
          ...itemCopy,
          money: { amountMinor: reduced, currency: comp.currency },
          scholarshipReduction: { amountMinor: comp.amountMinor, currency: comp.currency },
          fundingScenario,
        };
      }
    }

    if (type === 'full' && item.category === 'tuition') {
      if (Number.isSafeInteger(item.money.amountMinor)) {
        return {
          ...itemCopy,
          money: { amountMinor: 0, currency: item.money.currency },
          scholarshipReduction: { ...item.money },
          fundingScenario,
        };
      }
    }

    return itemCopy;
  });

  return result;
}

function _componentToCategory(component) {
  const map = {
    tuition: 'tuition',
    accommodation: 'accommodation',
    travel: 'flight_travel',
    insurance: 'insurance',
    books_materials: 'books_materials',
    stipend: 'living_expenses',
    research_allowance: 'other',
  };
  return map[component] || null;
}

// ── Budget gap ────────────────────────────────────────────────────────────────

/**
 * Calculate known budget gap for a single currency.
 * Only valid when student budget currency === cost currency.
 *
 * Returns:
 *   {
 *     knownCostMinor, knownFundingMinor, studentBudgetMinor,
 *     knownGapMinor,  currency,
 *     unknownCostCount, affordabilityState, explanation
 *   }
 *
 * affordabilityState never claims full affordability when unknownCostCount > 0.
 */
export function calculateBudgetGap({ knownCostMinor, knownFundingMinor = 0, studentBudgetMinor, currency, unknownCostCount = 0 }) {
  if (!Number.isSafeInteger(knownCostMinor) || typeof currency !== 'string') {
    return {
      knownCostMinor: null, knownFundingMinor: null, studentBudgetMinor: null,
      knownGapMinor: null, currency, unknownCostCount,
      affordabilityState: AFFORDABILITY_STATES.INSUFFICIENT_INFORMATION,
      explanation: 'Known cost data incomplete.',
    };
  }

  const netCost = knownCostMinor - (Number.isSafeInteger(knownFundingMinor) ? knownFundingMinor : 0);

  if (!Number.isSafeInteger(studentBudgetMinor)) {
    return {
      knownCostMinor, knownFundingMinor, studentBudgetMinor: null,
      knownGapMinor: null, currency, unknownCostCount,
      affordabilityState: AFFORDABILITY_STATES.INSUFFICIENT_INFORMATION,
      explanation: 'No stated budget for comparison.',
    };
  }

  const gap = netCost - studentBudgetMinor;
  let affordabilityState;

  if (unknownCostCount > 0) {
    affordabilityState = AFFORDABILITY_STATES.INSUFFICIENT_INFORMATION;
  } else if (gap > 0) {
    affordabilityState = AFFORDABILITY_STATES.OVER_BUDGET;
  } else if (Math.abs(gap) <= Math.round(studentBudgetMinor * NEAR_BUDGET_THRESHOLD_RATIO)) {
    affordabilityState = AFFORDABILITY_STATES.NEAR_BUDGET;
  } else {
    affordabilityState = AFFORDABILITY_STATES.WITHIN_BUDGET;
  }

  const explanation = unknownCostCount > 0
    ? `Based on currently known costs only. ${unknownCostCount} cost(s) remain unknown and are not included.`
    : gap > 0
      ? `Known costs exceed your stated budget by ${currency} ${gap} minor units.`
      : `Known costs are within your stated budget (${currency} ${Math.abs(gap)} minor units remaining).`;

  return {
    knownCostMinor, knownFundingMinor, studentBudgetMinor,
    knownGapMinor: gap, currency, unknownCostCount,
    affordabilityState, explanation,
  };
}

// ── Multi-currency affordability guard ────────────────────────────────────────

/**
 * When multiple currencies are present, return MULTI_CURRENCY_UNRESOLVED.
 * Comparison is only meaningful within a single currency.
 */
export function resolveMultiCurrencyAffordability(currencyKeys) {
  const distinct = new Set(currencyKeys);
  if (distinct.size > 1) {
    return {
      affordabilityState: AFFORDABILITY_STATES.MULTI_CURRENCY_UNRESOLVED,
      explanation: 'Costs span multiple currencies. Convert using an explicit FX snapshot before comparing totals.',
    };
  }
  return null;
}

// ── Data quality summary ──────────────────────────────────────────────────────

/**
 * Summarise plan data quality.
 * Returns counts for each truth tier and staleness.
 */
export function dataQualitySummary(items) {
  const counts = {
    verified: 0,
    institution_official: 0,
    government_official: 0,
    student_entered: 0,
    strideto_estimate: 0,
    derived: 0,
    unknown: 0,
  };
  let staleCount = 0;

  for (const item of items) {
    const tc = item.truthCategory || TRUTH_CATEGORIES.UNKNOWN;
    if (counts[tc] !== undefined) counts[tc]++;
    if (item.freshness === 'stale' || item.freshness === 'broken') staleCount++;
  }

  return { counts, staleCount, total: items.length };
}

// ── Plan completeness ─────────────────────────────────────────────────────────

/**
 * Explain plan completeness against a required-category set.
 * Returns { complete: boolean, missing: string[], unknownItems: string[], staleItems: string[] }.
 *
 * 100% completeness = all required categories have a known/estimated item.
 * Does NOT claim real costs cannot change.
 */
export function planCompleteness(items, requiredCategories = []) {
  const presentCategories = new Set(
    items
      .filter((i) => i.amountState !== AMOUNT_STATES.UNKNOWN)
      .map((i) => i.category)
  );
  const missing = requiredCategories.filter((c) => !presentCategories.has(c));
  const unknownItems = items
    .filter((i) => i.amountState === AMOUNT_STATES.UNKNOWN)
    .map((i) => i.label || i.category);
  const staleItems = items
    .filter((i) => i.freshness === 'stale' || i.freshness === 'broken')
    .map((i) => i.label || i.category);

  return {
    complete: missing.length === 0 && unknownItems.length === 0,
    missing,
    unknownItems,
    staleItems,
  };
}

// ── Scenario comparison guard ─────────────────────────────────────────────────

/**
 * Validates whether two plans are comparable (same currency set, no unknowns in either).
 * Returns { comparable: boolean, reason: string }.
 *
 * Refuses misleading "cheapest" claim when not comparable.
 */
export function arePlansComparable(planAResult, planBResult) {
  const aCurrencies = Object.keys(planAResult.totals || {});
  const bCurrencies = Object.keys(planBResult.totals || {});

  if (planAResult.unknownCount > 0 || planBResult.unknownCount > 0) {
    return { comparable: false, reason: 'One or both plans have unknown cost items. Cannot determine a reliable total.' };
  }

  const aSet = new Set(aCurrencies);
  const bSet = new Set(bCurrencies);
  const allSame = aCurrencies.length === bCurrencies.length &&
    aCurrencies.every((c) => bSet.has(c)) &&
    bCurrencies.every((c) => aSet.has(c));

  if (!allSame || aCurrencies.length > 1) {
    return { comparable: false, reason: 'Plans use different or multiple currencies. Use an explicit FX snapshot to convert before comparing.' };
  }

  return { comparable: true, reason: 'Plans are in the same single currency with no unknown costs.' };
}
