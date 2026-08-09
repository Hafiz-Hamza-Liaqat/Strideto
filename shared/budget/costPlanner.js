/**
 * Budget / Cost Planner — shared contract (Mission 20).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 *
 * CORE PRINCIPLE: KNOWN ≠ ESTIMATED ≠ UNKNOWN.
 * Never conflate truth categories. Unknown amount ≠ zero.
 *
 * Does NOT:
 *   - fetch exchange rates
 *   - add amounts across currencies without explicit FX snapshot
 *   - invent living costs, visa fees, test fees, airfare
 *   - provide financial advice
 *   - execute payments
 */

// ── Plan status ───────────────────────────────────────────────────────────────

export const PLAN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

// ── Journey types (mirrored from agent constants for independence) ─────────────

export const JOURNEY_TYPES = Object.freeze({
  STUDY: 'study',
  WORK: 'work',
  VISIT: 'visit',
  RESEARCH: 'research',
  OTHER: 'other',
});

// ── Cost categories ───────────────────────────────────────────────────────────

export const COST_CATEGORIES = Object.freeze({
  TUITION: 'tuition',
  APPLICATION_FEE: 'application_fee',
  ENROLLMENT_DEPOSIT: 'enrollment_deposit',
  TEST_FEE: 'test_fee',
  TEST_PREPARATION: 'test_preparation',
  DOCUMENT_FEE: 'document_fee',
  CREDENTIAL_EVALUATION: 'credential_evaluation',
  VISA_APPLICATION_FEE: 'visa_application_fee',
  IMMIGRATION_HEALTH_FEE: 'immigration_health_fee',
  BIOMETRICS: 'biometrics',
  MEDICAL_EXAM: 'medical_exam',
  INSURANCE: 'insurance',
  FLIGHT_TRAVEL: 'flight_travel',
  LOCAL_TRANSPORT: 'local_transport',
  ACCOMMODATION: 'accommodation',
  FOOD: 'food',
  UTILITIES: 'utilities',
  BOOKS_MATERIALS: 'books_materials',
  TECHNOLOGY: 'technology',
  LIVING_EXPENSES: 'living_expenses',
  AGENT_SERVICE: 'agent_service',
  CONSULTATION: 'consultation',
  PROFESSIONAL_SERVICE: 'professional_service',
  EMERGENCY_BUFFER: 'emergency_buffer',
  OTHER: 'other',
});

// ── Cost cadence ──────────────────────────────────────────────────────────────

export const COST_CADENCES = Object.freeze({
  ONE_TIME: 'one_time',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  TERM: 'term',
  SEMESTER: 'semester',
  YEARLY: 'yearly',
  CUSTOM: 'custom',
  UNKNOWN: 'unknown',
});

// ── Truth / source category ───────────────────────────────────────────────────

/**
 * Every CostItem must carry one of these. Never conflate them.
 * Public/user copy must make this distinction obvious.
 */
export const TRUTH_CATEGORIES = Object.freeze({
  VERIFIED: 'verified',                     // Source-backed authoritative record
  INSTITUTION_OFFICIAL: 'institution_official', // Sourced from institution directly
  GOVERNMENT_OFFICIAL: 'government_official',   // Government / official body
  STUDENT_ENTERED: 'student_entered',       // Student typed it in
  STRIDETO_ESTIMATE: 'strideto_estimate',   // Platform estimate (must have source/date)
  DERIVED: 'derived',                       // Calculated deterministically from known inputs
  UNKNOWN: 'unknown',                       // Not yet known
});

/** Labels suitable for display. Never expose raw enum if UI needs prose. */
export const TRUTH_CATEGORY_LABELS = Object.freeze({
  [TRUTH_CATEGORIES.VERIFIED]: 'Source-backed',
  [TRUTH_CATEGORIES.INSTITUTION_OFFICIAL]: 'Institution official',
  [TRUTH_CATEGORIES.GOVERNMENT_OFFICIAL]: 'Government official',
  [TRUTH_CATEGORIES.STUDENT_ENTERED]: 'Your estimate',
  [TRUTH_CATEGORIES.STRIDETO_ESTIMATE]: 'Strideto estimate',
  [TRUTH_CATEGORIES.DERIVED]: 'Calculated',
  [TRUTH_CATEGORIES.UNKNOWN]: 'Unknown',
});

// ── Tuition basis ─────────────────────────────────────────────────────────────

export const TUITION_BASES = Object.freeze({
  PER_YEAR: 'per_year',
  PER_SEMESTER: 'per_semester',
  PER_TERM: 'per_term',
  PER_CREDIT: 'per_credit',
  WHOLE_PROGRAM: 'whole_program',
  ONE_TIME: 'one_time',
  UNKNOWN: 'unknown',
});

// ── Freshness states (aligned with Mission 5) ─────────────────────────────────

export const COST_FRESHNESS = Object.freeze({
  FRESH: 'fresh',
  REVIEW_DUE: 'review_due',
  STALE: 'stale',
  BROKEN: 'broken',
  UNKNOWN: 'unknown',
});

// ── Affordability states ──────────────────────────────────────────────────────

export const AFFORDABILITY_STATES = Object.freeze({
  WITHIN_BUDGET: 'within_budget',
  NEAR_BUDGET: 'near_budget',
  OVER_BUDGET: 'over_budget',
  INSUFFICIENT_INFORMATION: 'insufficient_information',
  MULTI_CURRENCY_UNRESOLVED: 'multi_currency_unresolved',
});

// ── Scholarship scenario semantics ────────────────────────────────────────────

export const FUNDING_SCENARIOS = Object.freeze({
  WITHOUT_SCHOLARSHIP: 'without_scholarship',
  WITH_SCHOLARSHIP_IF_AWARDED: 'with_scholarship_if_awarded',
  AWARDED_CONFIRMED: 'awarded_confirmed',
});

// ── Item amount states ────────────────────────────────────────────────────────

export const AMOUNT_STATES = Object.freeze({
  KNOWN: 'known',       // amountMinor + currency present
  ESTIMATED: 'estimated', // amountMinor + currency present but not authoritative
  UNKNOWN: 'unknown',   // no amount
});

// ── Plan change event types ───────────────────────────────────────────────────

export const PLAN_EVENT_TYPES = Object.freeze({
  CREATED: 'plan_created',
  ITEM_ADDED: 'item_added',
  ITEM_REMOVED: 'item_removed',
  AMOUNT_CHANGED: 'amount_changed',
  CANONICAL_REFRESHED: 'canonical_refreshed',
  SCHOLARSHIP_SCENARIO_CHANGED: 'scholarship_scenario_changed',
  BUDGET_UPDATED: 'budget_updated',
  SCENARIO_CLONED: 'scenario_cloned',
  ARCHIVED: 'plan_archived',
});

// ── FX snapshot shape validator ───────────────────────────────────────────────

/**
 * Validates a provider-neutral FX rate snapshot object.
 * Rate is represented as an integer rational: rateNumerator / rateDenominator.
 * This avoids floating-point drift in financial conversions.
 *
 * @param {object} snapshot
 * @returns {boolean}
 */
export function isValidFxSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const { baseCurrency, quoteCurrency, rateNumerator, rateDenominator, source, asOf } = snapshot;
  if (typeof baseCurrency !== 'string' || baseCurrency.length !== 3) return false;
  if (typeof quoteCurrency !== 'string' || quoteCurrency.length !== 3) return false;
  if (!Number.isSafeInteger(rateNumerator) || rateNumerator <= 0) return false;
  if (!Number.isSafeInteger(rateDenominator) || rateDenominator <= 0) return false;
  if (typeof source !== 'string' || !source.trim()) return false;
  if (!(asOf instanceof Date) && typeof asOf !== 'string') return false;
  return true;
}

/**
 * Convert a Money amount using an explicit FX snapshot (rational arithmetic).
 * Returns null if snapshot is invalid or conversion unavailable.
 *
 * Rounding: half away from zero on the final minor-unit result.
 *
 * NEVER call without an explicit validated snapshot.
 */
export function convertMoney(money, targetCurrency, fxSnapshot) {
  if (!money || !Number.isSafeInteger(money.amountMinor)) return null;
  if (typeof targetCurrency !== 'string' || targetCurrency.length !== 3) return null;
  if (!isValidFxSnapshot(fxSnapshot)) return null;
  if (money.currency === targetCurrency) {
    return { amountMinor: money.amountMinor, currency: targetCurrency };
  }
  if (fxSnapshot.baseCurrency !== money.currency || fxSnapshot.quoteCurrency !== targetCurrency) {
    return null; // snapshot does not cover this pair
  }
  // Rational conversion: result = amountMinor * rateNumerator / rateDenominator
  // Using BigInt to avoid overflow on large amounts
  const num = BigInt(money.amountMinor) * BigInt(fxSnapshot.rateNumerator);
  const denom = BigInt(fxSnapshot.rateDenominator);
  // Round half away from zero
  const sign = num >= 0n ? 1n : -1n;
  const absNum = num < 0n ? -num : num;
  const quotient = absNum / denom;
  const remainder = absNum % denom;
  const rounded = remainder * 2n >= denom ? quotient + 1n : quotient;
  const result = Number(sign * rounded);
  if (!Number.isSafeInteger(result)) return null;
  return { amountMinor: result, currency: targetCurrency };
}

// ── Validation helpers ────────────────────────────────────────────────────────

export function isValidCategory(cat) {
  return Object.values(COST_CATEGORIES).includes(cat);
}

export function isValidCadence(cad) {
  return Object.values(COST_CADENCES).includes(cad);
}

export function isValidTruthCategory(tc) {
  return Object.values(TRUTH_CATEGORIES).includes(tc);
}

export function isValidTuitionBasis(basis) {
  return Object.values(TUITION_BASES).includes(basis);
}

export function isValidPlanStatus(s) {
  return Object.values(PLAN_STATUSES).includes(s);
}

export function isValidAffordabilityState(s) {
  return Object.values(AFFORDABILITY_STATES).includes(s);
}

export function isValidFundingScenario(s) {
  return Object.values(FUNDING_SCENARIOS).includes(s);
}

export function isValidAmountState(s) {
  return Object.values(AMOUNT_STATES).includes(s);
}

/** True when truthCategory indicates student-supplied (not platform-verified). */
export function isStudentSupplied(truthCategory) {
  return truthCategory === TRUTH_CATEGORIES.STUDENT_ENTERED;
}

/** True when truthCategory is authoritative (not student-entered or estimate). */
export function isCanonical(truthCategory) {
  return [
    TRUTH_CATEGORIES.VERIFIED,
    TRUTH_CATEGORIES.INSTITUTION_OFFICIAL,
    TRUTH_CATEGORIES.GOVERNMENT_OFFICIAL,
  ].includes(truthCategory);
}

/**
 * Deterministic near-budget threshold: within 10% of stated budget.
 * Used only when currencies are compatible.
 */
export const NEAR_BUDGET_THRESHOLD_RATIO = 0.10;
