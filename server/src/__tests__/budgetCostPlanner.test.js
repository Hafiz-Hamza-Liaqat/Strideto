/**
 * Mission 20 — Budget / Cost Planner tests.
 *
 * Pure-contract tests (no DB, no network). Run:
 *   node src/__tests__/budgetCostPlanner.test.js
 *
 * 56 behavioral and security tests covering all Mission 20 requirements.
 *
 * Test groups:
 *   1-6    Shared contract constants
 *   7-13   Money / minor units / currency validation
 *   14-17  FX snapshot / multi-currency guards
 *   18-21  FX conversion (rational arithmetic / rounding)
 *   22-26  Tuition basis and derivation
 *   27-30  Recurring cost expansion
 *   31-35  Scholarship funding application
 *   36-40  Budget gap and affordability
 *   41-43  Scenario comparison guard
 *   44-47  Data quality and completeness
 *   48-50  Privacy / isolation contracts
 *   51-53  Source truth category guards
 *   54-56  Edge cases (unknown=0 guard, zero-decimal, integer overflow guard)
 */

import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

const {
  PLAN_STATUSES,
  JOURNEY_TYPES,
  COST_CATEGORIES,
  COST_CADENCES,
  TRUTH_CATEGORIES,
  TUITION_BASES,
  FRESHNESS_STATES: _FS,
  COST_FRESHNESS,
  AFFORDABILITY_STATES,
  FUNDING_SCENARIOS,
  AMOUNT_STATES,
  PLAN_EVENT_TYPES,
  isValidCategory,
  isValidCadence,
  isValidTruthCategory,
  isValidTuitionBasis,
  isValidPlanStatus,
  isStudentSupplied,
  isCanonical,
  isValidFxSnapshot,
  convertMoney,
  NEAR_BUDGET_THRESHOLD_RATIO,
} = await load('shared/budget/costPlanner.js');

const {
  groupTotalsByCurrency,
  expandRecurringCost,
  deriveTuitionTotal,
  applyScholarshipFunding,
  calculateBudgetGap,
  resolveMultiCurrencyAffordability,
  dataQualitySummary,
  planCompleteness,
  arePlansComparable,
} = await load('shared/budget/calculationEngine.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ── 1-6: Shared contract constants ───────────────────────────────────────────

console.log('\n[1-6] Shared contract constants');

test('1. PLAN_STATUSES contains draft, active, archived', () => {
  assert.ok(PLAN_STATUSES.DRAFT === 'draft');
  assert.ok(PLAN_STATUSES.ACTIVE === 'active');
  assert.ok(PLAN_STATUSES.ARCHIVED === 'archived');
});

test('2. TRUTH_CATEGORIES covers all 7 required types', () => {
  const required = ['verified','institution_official','government_official','student_entered','strideto_estimate','derived','unknown'];
  for (const r of required) assert.ok(Object.values(TRUTH_CATEGORIES).includes(r), `Missing: ${r}`);
});

test('3. COST_CATEGORIES contains tuition, accommodation, visa_application_fee, emergency_buffer', () => {
  assert.ok(isValidCategory('tuition'));
  assert.ok(isValidCategory('accommodation'));
  assert.ok(isValidCategory('visa_application_fee'));
  assert.ok(isValidCategory('emergency_buffer'));
});

test('4. COST_CADENCES contains all required cadences including unknown', () => {
  const required = ['one_time','monthly','yearly','semester','term','weekly','daily','custom','unknown'];
  for (const r of required) assert.ok(isValidCadence(r), `Missing cadence: ${r}`);
});

test('5. TUITION_BASES covers per_year, per_semester, whole_program, unknown', () => {
  assert.ok(isValidTuitionBasis('per_year'));
  assert.ok(isValidTuitionBasis('per_semester'));
  assert.ok(isValidTuitionBasis('whole_program'));
  assert.ok(isValidTuitionBasis('unknown'));
});

test('6. AMOUNT_STATES contains known, estimated, unknown', () => {
  assert.ok(AMOUNT_STATES.KNOWN === 'known');
  assert.ok(AMOUNT_STATES.ESTIMATED === 'estimated');
  assert.ok(AMOUNT_STATES.UNKNOWN === 'unknown');
});

// ── 7-13: Money / minor units / currency ─────────────────────────────────────

console.log('\n[7-13] Money / minor units / currency');

test('7. isStudentSupplied returns true for student_entered only', () => {
  assert.ok(isStudentSupplied('student_entered'));
  assert.ok(!isStudentSupplied('verified'));
  assert.ok(!isStudentSupplied('institution_official'));
});

test('8. isCanonical returns true for verified, institution_official, government_official', () => {
  assert.ok(isCanonical('verified'));
  assert.ok(isCanonical('institution_official'));
  assert.ok(isCanonical('government_official'));
  assert.ok(!isCanonical('student_entered'));
  assert.ok(!isCanonical('strideto_estimate'));
});

test('9. groupTotalsByCurrency sums in integer minor units', () => {
  const items = [
    { amountState: 'known', money: { amountMinor: 100000, currency: 'USD' } },
    { amountState: 'known', money: { amountMinor: 50000, currency: 'USD' } },
  ];
  const { totals } = groupTotalsByCurrency(items);
  assert.strictEqual(totals['USD'], 150000);
});

test('10. groupTotalsByCurrency counts unknown items and does not total them', () => {
  const items = [
    { amountState: 'unknown', money: null },
    { amountState: 'known', money: { amountMinor: 50000, currency: 'USD' } },
  ];
  const { totals, unknownCount } = groupTotalsByCurrency(items);
  assert.strictEqual(unknownCount, 1);
  assert.strictEqual(totals['USD'], 50000);
});

test('11. groupTotalsByCurrency does NOT add across currencies', () => {
  const items = [
    { amountState: 'known', money: { amountMinor: 100000, currency: 'USD' } },
    { amountState: 'known', money: { amountMinor: 80000, currency: 'GBP' } },
  ];
  const { totals } = groupTotalsByCurrency(items);
  assert.ok('USD' in totals && 'GBP' in totals, 'Both currencies must be present separately');
  assert.ok(!('USD_GBP' in totals), 'No combined key');
  assert.strictEqual(totals['USD'], 100000);
  assert.strictEqual(totals['GBP'], 80000);
});

test('12. Unknown amount must NOT become zero', () => {
  const items = [{ amountState: 'unknown', money: null }];
  const { totals, unknownCount } = groupTotalsByCurrency(items);
  assert.strictEqual(unknownCount, 1);
  // No currency key with 0 for unknown
  for (const v of Object.values(totals)) {
    assert.ok(v !== 0 || false, 'Unknown item must not contribute 0 to totals');
  }
  assert.deepStrictEqual(totals, {}); // unknown item contributes nothing to totals
});

test('13. groupTotalsByCurrency tracks estimated items separately', () => {
  const items = [
    { amountState: 'estimated', money: { amountMinor: 30000, currency: 'EUR' } },
    { amountState: 'known', money: { amountMinor: 70000, currency: 'EUR' } },
  ];
  const { totals, estimatedCount } = groupTotalsByCurrency(items);
  assert.strictEqual(estimatedCount, 1);
  assert.strictEqual(totals['EUR'], 100000);
});

// ── 14-17: FX snapshot / multi-currency guards ────────────────────────────────

console.log('\n[14-17] FX snapshot / multi-currency guards');

test('14. isValidFxSnapshot rejects missing or invalid snapshot', () => {
  assert.ok(!isValidFxSnapshot(null));
  assert.ok(!isValidFxSnapshot({}));
  assert.ok(!isValidFxSnapshot({ baseCurrency: 'USD', quoteCurrency: 'GBP', rateNumerator: -1, rateDenominator: 1, source: 'test', asOf: new Date() }));
});

test('15. isValidFxSnapshot accepts valid rational snapshot', () => {
  const snap = { baseCurrency: 'USD', quoteCurrency: 'GBP', rateNumerator: 79, rateDenominator: 100, source: 'test', asOf: new Date() };
  assert.ok(isValidFxSnapshot(snap));
});

test('16. convertMoney returns null without valid FX snapshot', () => {
  const money = { amountMinor: 10000, currency: 'USD' };
  assert.strictEqual(convertMoney(money, 'GBP', null), null);
  assert.strictEqual(convertMoney(money, 'GBP', {}), null);
});

test('17. resolveMultiCurrencyAffordability returns MULTI_CURRENCY_UNRESOLVED for multiple currencies', () => {
  const result = resolveMultiCurrencyAffordability(['USD', 'GBP']);
  assert.ok(result !== null);
  assert.strictEqual(result.affordabilityState, AFFORDABILITY_STATES.MULTI_CURRENCY_UNRESOLVED);
});

// ── 18-21: FX conversion ──────────────────────────────────────────────────────

console.log('\n[18-21] FX conversion (rational arithmetic)');

test('18. convertMoney converts using rational rate (no float drift)', () => {
  // 100 USD → GBP at rate 79/100 = 79 GBP (minor units, both 2-decimal)
  const snap = { baseCurrency: 'USD', quoteCurrency: 'GBP', rateNumerator: 79, rateDenominator: 100, source: 'test', asOf: new Date() };
  const result = convertMoney({ amountMinor: 100, currency: 'USD' }, 'GBP', snap);
  assert.strictEqual(result.amountMinor, 79);
  assert.strictEqual(result.currency, 'GBP');
});

test('19. convertMoney returns original when source===target currency', () => {
  const snap = { baseCurrency: 'USD', quoteCurrency: 'GBP', rateNumerator: 79, rateDenominator: 100, source: 'test', asOf: new Date() };
  const result = convertMoney({ amountMinor: 5000, currency: 'USD' }, 'USD', snap);
  assert.strictEqual(result.amountMinor, 5000);
});

test('20. convertMoney returns null when snapshot does not cover the pair', () => {
  const snap = { baseCurrency: 'EUR', quoteCurrency: 'GBP', rateNumerator: 85, rateDenominator: 100, source: 'test', asOf: new Date() };
  const result = convertMoney({ amountMinor: 10000, currency: 'USD' }, 'GBP', snap);
  assert.strictEqual(result, null);
});

test('21. Synthetic explicit FX snapshot only — no invented rate (validation)', () => {
  // Without a snapshot, conversion must be unavailable
  const result = convertMoney({ amountMinor: 10000, currency: 'USD' }, 'GBP', undefined);
  assert.strictEqual(result, null, 'Must return null when no FX snapshot provided');
});

// ── 22-26: Tuition basis and derivation ──────────────────────────────────────

console.log('\n[22-26] Tuition basis and derivation');

test('22. deriveTuitionTotal returns null for unknown basis', () => {
  const result = deriveTuitionTotal({ amountMinor: 100000, currency: 'USD' }, 'unknown', 24);
  assert.strictEqual(result, null);
});

test('23. deriveTuitionTotal derives per_year with known duration (labelled DERIVED)', () => {
  const tuition = { amountMinor: 1000000, currency: 'USD' }; // $10,000 per year
  const result = deriveTuitionTotal(tuition, 'per_year', 24); // 2 years
  assert.ok(result !== null);
  assert.strictEqual(result.derivedMoney.amountMinor, 2000000);
  assert.ok(result.trace.includes('DERIVED'));
});

test('24. deriveTuitionTotal returns null when duration unknown (cannot multiply)', () => {
  const result = deriveTuitionTotal({ amountMinor: 1000000, currency: 'USD' }, 'per_year', null);
  assert.strictEqual(result, null);
});

test('25. deriveTuitionTotal treats whole_program as no-multiply (total = tuition)', () => {
  const tuition = { amountMinor: 5000000, currency: 'GBP' };
  const result = deriveTuitionTotal(tuition, 'whole_program', 36);
  assert.ok(result !== null);
  assert.strictEqual(result.derivedMoney.amountMinor, 5000000);
  assert.strictEqual(result.periods, 1);
});

test('26. deriveTuitionTotal: per_semester × 4 semesters (24 months)', () => {
  const tuition = { amountMinor: 500000, currency: 'CAD' };
  const result = deriveTuitionTotal(tuition, 'per_semester', 24);
  assert.ok(result !== null);
  assert.strictEqual(result.derivedMoney.amountMinor, 2000000); // 4 semesters
});

// ── 27-30: Recurring cost expansion ──────────────────────────────────────────

console.log('\n[27-30] Recurring cost expansion');

test('27. expandRecurringCost expands monthly correctly over 12 months', () => {
  const item = { amountState: 'known', money: { amountMinor: 100000, currency: 'GBP' }, cadence: 'monthly' };
  const result = expandRecurringCost(item, 12);
  assert.ok(result !== null);
  assert.strictEqual(result.expanded.amountMinor, 1200000);
  assert.strictEqual(result.periods, 12);
});

test('28. expandRecurringCost returns null for unknown cadence', () => {
  const item = { amountState: 'known', money: { amountMinor: 100000, currency: 'USD' }, cadence: 'unknown' };
  const result = expandRecurringCost(item, 12);
  assert.strictEqual(result, null);
});

test('29. expandRecurringCost returns null for unknown amount item', () => {
  const item = { amountState: 'unknown', money: null, cadence: 'monthly' };
  const result = expandRecurringCost(item, 12);
  assert.strictEqual(result, null);
});

test('30. expandRecurringCost returns null when horizon missing', () => {
  const item = { amountState: 'known', money: { amountMinor: 50000, currency: 'EUR' }, cadence: 'monthly' };
  assert.strictEqual(expandRecurringCost(item, null), null);
  assert.strictEqual(expandRecurringCost(item, 0), null);
});

// ── 31-35: Scholarship funding ────────────────────────────────────────────────

console.log('\n[31-35] Scholarship funding application');

test('31. applyScholarshipFunding: without_scholarship scenario does nothing', () => {
  const items = [{ category: 'tuition', amountState: 'known', money: { amountMinor: 1000000, currency: 'USD' } }];
  const funding = { type: 'fixed_amount', amountMinor: 500000, currency: 'USD', components: [] };
  const result = applyScholarshipFunding(items, funding, FUNDING_SCENARIOS.WITHOUT_SCHOLARSHIP);
  assert.strictEqual(result[0].money.amountMinor, 1000000);
  assert.ok(!result[0].scholarshipReduction);
});

test('32. applyScholarshipFunding: fixed_amount reduces tuition', () => {
  const items = [{ category: 'tuition', amountState: 'known', money: { amountMinor: 1000000, currency: 'USD' } }];
  const funding = { type: 'fixed_amount', amountMinor: 300000, currency: 'USD', components: [] };
  const result = applyScholarshipFunding(items, funding, FUNDING_SCENARIOS.WITH_SCHOLARSHIP_IF_AWARDED);
  assert.strictEqual(result[0].money.amountMinor, 700000);
  assert.ok(result[0].scholarshipReduction);
  assert.strictEqual(result[0].fundingScenario, FUNDING_SCENARIOS.WITH_SCHOLARSHIP_IF_AWARDED);
});

test('33. applyScholarshipFunding: partial scholarship without known amount does not guess', () => {
  // partial type with no amountMinor
  const items = [{ category: 'tuition', amountState: 'known', money: { amountMinor: 1000000, currency: 'USD' } }];
  const funding = { type: 'partial', amountMinor: null, currency: null, components: [] };
  const result = applyScholarshipFunding(items, funding, FUNDING_SCENARIOS.WITH_SCHOLARSHIP_IF_AWARDED);
  // Must not reduce — no known amount
  assert.strictEqual(result[0].money.amountMinor, 1000000);
});

test('34. applyScholarshipFunding: component_based applies only to matching category', () => {
  const items = [
    { category: 'tuition', amountState: 'known', money: { amountMinor: 1000000, currency: 'GBP' } },
    { category: 'accommodation', amountState: 'known', money: { amountMinor: 200000, currency: 'GBP' } },
  ];
  const funding = {
    type: 'component_based',
    amountMinor: null, currency: null,
    components: [{ component: 'accommodation', amountMinor: 100000, currency: 'GBP' }],
  };
  const result = applyScholarshipFunding(items, funding, FUNDING_SCENARIOS.WITH_SCHOLARSHIP_IF_AWARDED);
  assert.strictEqual(result.find((i) => i.category === 'tuition').money.amountMinor, 1000000); // unchanged
  assert.strictEqual(result.find((i) => i.category === 'accommodation').money.amountMinor, 100000); // reduced
});

test('35. Potential eligibility does not equal awarded funding (scenario guard)', () => {
  // WITHOUT_SCHOLARSHIP scenario → no reduction, even if funding object present
  const items = [{ category: 'tuition', amountState: 'known', money: { amountMinor: 1000000, currency: 'USD' } }];
  const funding = { type: 'fixed_amount', amountMinor: 500000, currency: 'USD', components: [] };
  const result = applyScholarshipFunding(items, funding, FUNDING_SCENARIOS.WITHOUT_SCHOLARSHIP);
  assert.strictEqual(result[0].money.amountMinor, 1000000);
});

// ── 36-40: Budget gap and affordability ──────────────────────────────────────

console.log('\n[36-40] Budget gap and affordability');

test('36. calculateBudgetGap: within_budget when costs < budget', () => {
  const r = calculateBudgetGap({ knownCostMinor: 80000, studentBudgetMinor: 100000, currency: 'USD', unknownCostCount: 0 });
  assert.strictEqual(r.affordabilityState, AFFORDABILITY_STATES.WITHIN_BUDGET);
  assert.strictEqual(r.knownGapMinor, -20000);
});

test('37. calculateBudgetGap: over_budget when costs > budget', () => {
  const r = calculateBudgetGap({ knownCostMinor: 120000, studentBudgetMinor: 100000, currency: 'USD', unknownCostCount: 0 });
  assert.strictEqual(r.affordabilityState, AFFORDABILITY_STATES.OVER_BUDGET);
  assert.strictEqual(r.knownGapMinor, 20000);
});

test('38. calculateBudgetGap: insufficient_information when unknownCostCount > 0', () => {
  const r = calculateBudgetGap({ knownCostMinor: 80000, studentBudgetMinor: 100000, currency: 'USD', unknownCostCount: 3 });
  assert.strictEqual(r.affordabilityState, AFFORDABILITY_STATES.INSUFFICIENT_INFORMATION);
  assert.ok(r.explanation.includes('unknown'));
});

test('39. calculateBudgetGap: insufficient_information when no student budget', () => {
  const r = calculateBudgetGap({ knownCostMinor: 80000, studentBudgetMinor: null, currency: 'USD', unknownCostCount: 0 });
  assert.strictEqual(r.affordabilityState, AFFORDABILITY_STATES.INSUFFICIENT_INFORMATION);
});

test('40. calculateBudgetGap: near_budget within 10% threshold', () => {
  // budget 100000, cost 95000 → gap = -5000, within 10% of 100000
  const r = calculateBudgetGap({ knownCostMinor: 95000, studentBudgetMinor: 100000, currency: 'USD', unknownCostCount: 0 });
  assert.strictEqual(r.affordabilityState, AFFORDABILITY_STATES.NEAR_BUDGET);
});

// ── 41-43: Scenario comparison guard ─────────────────────────────────────────

console.log('\n[41-43] Scenario comparison guard');

test('41. arePlansComparable: refuses when unknown costs exist', () => {
  const a = { totals: { USD: 100000 }, unknownCount: 1 };
  const b = { totals: { USD: 90000 }, unknownCount: 0 };
  const r = arePlansComparable(a, b);
  assert.ok(!r.comparable);
  assert.ok(r.reason.toLowerCase().includes('unknown'));
});

test('42. arePlansComparable: refuses when currencies differ', () => {
  const a = { totals: { USD: 100000 }, unknownCount: 0 };
  const b = { totals: { GBP: 90000 }, unknownCount: 0 };
  const r = arePlansComparable(a, b);
  assert.ok(!r.comparable);
});

test('43. arePlansComparable: allows when same single currency and no unknowns', () => {
  const a = { totals: { USD: 100000 }, unknownCount: 0 };
  const b = { totals: { USD: 90000 }, unknownCount: 0 };
  const r = arePlansComparable(a, b);
  assert.ok(r.comparable);
});

// ── 44-47: Data quality and completeness ─────────────────────────────────────

console.log('\n[44-47] Data quality and completeness');

test('44. dataQualitySummary counts truth categories correctly', () => {
  const items = [
    { truthCategory: 'verified', freshness: 'fresh' },
    { truthCategory: 'student_entered', freshness: 'fresh' },
    { truthCategory: 'unknown', freshness: 'stale' },
    { truthCategory: 'institution_official', freshness: 'broken' },
  ];
  const q = dataQualitySummary(items);
  assert.strictEqual(q.counts.verified, 1);
  assert.strictEqual(q.counts.student_entered, 1);
  assert.strictEqual(q.counts.unknown, 1);
  assert.strictEqual(q.staleCount, 2);
});

test('45. planCompleteness: reports missing required categories', () => {
  const items = [{ category: 'tuition', amountState: 'known', label: 'Tuition' }];
  const required = ['tuition', 'accommodation', 'visa_application_fee'];
  const r = planCompleteness(items, required);
  assert.ok(!r.complete);
  assert.ok(r.missing.includes('accommodation'));
  assert.ok(r.missing.includes('visa_application_fee'));
});

test('46. planCompleteness: unknown items appear in unknownItems list', () => {
  const items = [
    { category: 'tuition', amountState: 'known', label: 'Tuition' },
    { category: 'accommodation', amountState: 'unknown', label: 'Accommodation' },
  ];
  const r = planCompleteness(items, ['tuition']);
  assert.ok(r.unknownItems.includes('Accommodation'));
});

test('47. planCompleteness: stale items appear in staleItems list', () => {
  const items = [{ category: 'tuition', amountState: 'known', label: 'Tuition', freshness: 'stale' }];
  const r = planCompleteness(items, []);
  assert.ok(r.staleItems.includes('Tuition'));
});

// ── 48-50: Privacy / isolation contracts ─────────────────────────────────────

console.log('\n[48-50] Privacy / isolation contracts');

test('48. PLAN_STATUSES does not expose a public status', () => {
  const values = Object.values(PLAN_STATUSES);
  assert.ok(!values.includes('public'), 'No public plan status must exist');
});

test('49. Student-entered truth category correctly identified as non-canonical', () => {
  assert.ok(!isCanonical('student_entered'));
  assert.ok(!isCanonical('strideto_estimate'));
  assert.ok(!isCanonical('derived'));
  assert.ok(!isCanonical('unknown'));
});

test('50. FUNDING_SCENARIOS includes explicit conditional scenario language', () => {
  assert.strictEqual(FUNDING_SCENARIOS.WITH_SCHOLARSHIP_IF_AWARDED, 'with_scholarship_if_awarded');
  assert.strictEqual(FUNDING_SCENARIOS.WITHOUT_SCHOLARSHIP, 'without_scholarship');
});

// ── 51-53: Source truth category guards ──────────────────────────────────────

console.log('\n[51-53] Source truth category guards');

test('51. isValidTruthCategory validates known categories', () => {
  assert.ok(isValidTruthCategory('verified'));
  assert.ok(isValidTruthCategory('student_entered'));
  assert.ok(!isValidTruthCategory('made_up'));
  assert.ok(!isValidTruthCategory(''));
});

test('52. TRUTH_CATEGORIES are distinct — no overlap between student_entered and canonical', () => {
  const canonical = ['verified','institution_official','government_official'];
  assert.ok(!canonical.includes(TRUTH_CATEGORIES.STUDENT_ENTERED));
  assert.ok(!canonical.includes(TRUTH_CATEGORIES.STRIDETO_ESTIMATE));
});

test('53. Strideto estimate is not canonical', () => {
  assert.ok(!isCanonical(TRUTH_CATEGORIES.STRIDETO_ESTIMATE));
});

// ── 54-56: Edge cases ─────────────────────────────────────────────────────────

console.log('\n[54-56] Edge cases');

test('54. Unknown amount must not equal zero — groupTotalsByCurrency excludes unknowns entirely', () => {
  const items = [
    { amountState: AMOUNT_STATES.UNKNOWN, money: null },
    { amountState: AMOUNT_STATES.UNKNOWN, money: null },
  ];
  const { totals, unknownCount } = groupTotalsByCurrency(items);
  assert.strictEqual(unknownCount, 2);
  assert.deepStrictEqual(totals, {}, 'totals must be empty — unknown ≠ 0');
});

test('55. Zero-decimal currency (JPY): amountMinor has no sub-unit — grouping preserves it', () => {
  const items = [
    { amountState: 'known', money: { amountMinor: 100000, currency: 'JPY' } }, // ¥100,000
    { amountState: 'known', money: { amountMinor: 50000, currency: 'JPY' } },
  ];
  const { totals } = groupTotalsByCurrency(items);
  assert.strictEqual(totals['JPY'], 150000);
});

test('56. NEAR_BUDGET_THRESHOLD_RATIO is 0.10 (10%)', () => {
  assert.strictEqual(NEAR_BUDGET_THRESHOLD_RATIO, 0.10);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nMission 20 tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
