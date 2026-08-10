/**
 * Budget Plan Service — Mission 20.
 *
 * All operations require authenticated userId (server-derived from JWT).
 * No cross-user access. No Agent/Institution/Employer access.
 * No Commerce mutation. No live FX/cost APIs.
 */
import mongoose from 'mongoose';
import { StudentCostPlan } from '../models/budget/StudentCostPlan.js';
import { CostItem } from '../models/budget/CostItem.js';
import { Program } from '../models/education/Program.js';
import { CanonicalScholarship as _CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import {
  PLAN_STATUSES,
  TRUTH_CATEGORIES as _TRUTH_CATEGORIES,
  AMOUNT_STATES,
  COST_CATEGORIES as _COST_CATEGORIES,
  COST_CADENCES,
  COST_FRESHNESS,
  TUITION_BASES as _TUITION_BASES,
  FUNDING_SCENARIOS as _FUNDING_SCENARIOS,
  PLAN_EVENT_TYPES,
  isValidCategory,
  isValidCadence,
  isValidTruthCategory,
  isValidTuitionBasis,
  isValidPlanStatus as _isValidPlanStatus,
  isStudentSupplied,
  isCanonical,
} from '../../../shared/budget/costPlanner.js';
import {
  groupTotalsByCurrency,
  deriveTuitionTotal as _deriveTuitionTotal,
  calculateBudgetGap,
  resolveMultiCurrencyAffordability,
  dataQualitySummary,
  planCompleteness,
  applyScholarshipFunding as _applyScholarshipFunding,
} from '../../../shared/budget/calculationEngine.js';
import { normalizeCurrency } from '../../../shared/international/currency.js';

const MAX_ITEMS_PER_PLAN = 200;
const MAX_PLANS_PER_USER = 50;
const MAX_ASSUMPTIONS = 20;
const MAX_ASSUMPTION_LENGTH = 500;
const MAX_LABEL_LENGTH = 300;
const MAX_NOTES_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateMoney(money) {
  if (!money || typeof money !== 'object') return false;
  const { amountMinor, currency } = money;
  if (!Number.isSafeInteger(amountMinor)) return false;
  if (typeof currency !== 'string' || normalizeCurrency(currency) !== currency) return false;
  return true;
}

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ── Plan CRUD ─────────────────────────────────────────────────────────────────

export async function createCostPlan(userId, body) {
  const count = await StudentCostPlan.countDocuments({ ownerUserId: userId, status: { $ne: PLAN_STATUSES.ARCHIVED } });
  if (count >= MAX_PLANS_PER_USER) {
    throw Object.assign(new Error('Plan limit reached'), { status: 429 });
  }

  const { title, journeyType, destinationCountry, programId, targetIntake, planningHorizonMonths, displayCurrency, assumptions } = body;

  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE_LENGTH) {
    throw Object.assign(new Error('title is required and must be ≤200 chars'), { status: 400 });
  }

  let programRef = {};
  if (programId) {
    if (!validateObjectId(programId)) throw Object.assign(new Error('Invalid programId'), { status: 400 });
    const program = await Program.findById(programId).select('name institutionId').lean();
    if (!program) throw Object.assign(new Error('Program not found'), { status: 404 });
    programRef = { programId: program._id, programTitle: program.name };
  }

  const validatedAssumptions = [];
  if (Array.isArray(assumptions)) {
    for (const a of assumptions.slice(0, MAX_ASSUMPTIONS)) {
      if (typeof a === 'string' && a.trim().length <= MAX_ASSUMPTION_LENGTH) {
        validatedAssumptions.push(a.trim());
      }
    }
  }

  const plan = await StudentCostPlan.create({
    ownerUserId: userId,
    title: title.trim(),
    journeyType: journeyType || 'study',
    destinationCountry: (destinationCountry || '').toUpperCase().slice(0, 2) || '',
    ...programRef,
    targetIntake: (targetIntake || '').slice(0, 100),
    planningHorizonMonths: typeof planningHorizonMonths === 'number' ? Math.round(planningHorizonMonths) : null,
    displayCurrency: normalizeCurrency(displayCurrency || '') || '',
    assumptions: validatedAssumptions,
    history: [{ eventType: PLAN_EVENT_TYPES.CREATED, description: 'Plan created', at: new Date() }],
    status: PLAN_STATUSES.DRAFT,
  });

  return plan;
}

export async function listCostPlans(userId, { page = 1, limit = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));
  const plans = await StudentCostPlan
    .find({ ownerUserId: userId })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(Math.min(50, limit))
    .select('-history')
    .lean();
  const total = await StudentCostPlan.countDocuments({ ownerUserId: userId });
  return { plans, total, page, limit };
}

export async function getCostPlan(userId, planId) {
  if (!validateObjectId(planId)) throw Object.assign(new Error('Invalid planId'), { status: 400 });
  const plan = await StudentCostPlan.findById(planId).lean();
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });
  if (String(plan.ownerUserId) !== String(userId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return plan;
}

export async function updateCostPlan(userId, planId, body) {
  const plan = await getCostPlan(userId, planId);
  if (plan.status === PLAN_STATUSES.ARCHIVED) {
    throw Object.assign(new Error('Cannot modify archived plan'), { status: 409 });
  }

  const patch = {};
  if (typeof body.title === 'string' && body.title.trim()) {
    patch.title = body.title.trim().slice(0, MAX_TITLE_LENGTH);
  }
  if (body.journeyType) patch.journeyType = body.journeyType;
  if (typeof body.destinationCountry === 'string') {
    patch.destinationCountry = body.destinationCountry.toUpperCase().slice(0, 2);
  }
  if (typeof body.targetIntake === 'string') {
    patch.targetIntake = body.targetIntake.slice(0, 100);
  }
  if (typeof body.planningHorizonMonths === 'number') {
    patch.planningHorizonMonths = Math.round(body.planningHorizonMonths);
  }
  if (body.displayCurrency) {
    const norm = normalizeCurrency(body.displayCurrency);
    if (norm) patch.displayCurrency = norm;
  }
  if (Array.isArray(body.assumptions)) {
    patch.assumptions = body.assumptions.slice(0, MAX_ASSUMPTIONS)
      .filter((a) => typeof a === 'string' && a.trim().length <= MAX_ASSUMPTION_LENGTH)
      .map((a) => a.trim());
  }

  if (body.budgetSnapshot) {
    const bs = body.budgetSnapshot;
    const budgetCurrency = normalizeCurrency(bs.currency || '');
    patch.budgetSnapshot = {
      totalAmountMinor: Number.isSafeInteger(bs.totalAmountMinor) ? bs.totalAmountMinor : null,
      currency: budgetCurrency || '',
      tuitionAmountMinor: Number.isSafeInteger(bs.tuitionAmountMinor) ? bs.tuitionAmountMinor : null,
      livingAmountMinor: Number.isSafeInteger(bs.livingAmountMinor) ? bs.livingAmountMinor : null,
      period: (bs.period || '').slice(0, 50),
      snapshotAt: new Date(),
    };
  }

  patch['$push'] = { history: { eventType: PLAN_EVENT_TYPES.BUDGET_UPDATED, description: 'Plan updated', at: new Date() } };

  return StudentCostPlan.findByIdAndUpdate(planId, patch, { new: true, lean: true });
}

export async function archiveCostPlan(userId, planId) {
  const plan = await getCostPlan(userId, planId);
  if (plan.status === PLAN_STATUSES.ARCHIVED) return plan;
  return StudentCostPlan.findByIdAndUpdate(
    planId,
    {
      status: PLAN_STATUSES.ARCHIVED,
      archivedAt: new Date(),
      $push: { history: { eventType: PLAN_EVENT_TYPES.ARCHIVED, description: 'Plan archived', at: new Date() } },
    },
    { new: true, lean: true }
  );
}

// ── Scenario clone ────────────────────────────────────────────────────────────

export async function cloneCostPlan(userId, planId) {
  const original = await getCostPlan(userId, planId);
  const count = await StudentCostPlan.countDocuments({ ownerUserId: userId, status: { $ne: PLAN_STATUSES.ARCHIVED } });
  if (count >= MAX_PLANS_PER_USER) {
    throw Object.assign(new Error('Plan limit reached'), { status: 429 });
  }

  const cloneData = {
    ownerUserId: userId,
    title: `${original.title} (copy)`.slice(0, MAX_TITLE_LENGTH),
    journeyType: original.journeyType,
    destinationCountry: original.destinationCountry,
    programId: original.programId,
    programTitle: original.programTitle,
    programInstitutionName: original.programInstitutionName,
    scholarshipScenarios: JSON.parse(JSON.stringify(original.scholarshipScenarios || [])),
    targetIntake: original.targetIntake,
    planningHorizonMonths: original.planningHorizonMonths,
    displayCurrency: original.displayCurrency,
    budgetSnapshot: JSON.parse(JSON.stringify(original.budgetSnapshot || {})),
    assumptions: [...(original.assumptions || [])],
    status: PLAN_STATUSES.DRAFT,
    clonedFromPlanId: original._id,
    history: [{ eventType: PLAN_EVENT_TYPES.SCENARIO_CLONED, description: `Cloned from plan ${original._id}`, at: new Date() }],
  };

  const newPlan = await StudentCostPlan.create(cloneData);

  // Clone cost items
  const items = await CostItem.find({ planId: original._id, removedAt: null }).lean();
  if (items.length > 0) {
    const clonedItems = items.map((item) => {
      const { _id, planId: _, createdAt: _createdAt, updatedAt: _updatedAt, __v, ...rest } = item;
      return { ...rest, planId: newPlan._id, ownerUserId: userId };
    });
    await CostItem.insertMany(clonedItems);
  }

  return newPlan;
}

// ── Cost item CRUD ────────────────────────────────────────────────────────────

export async function addCostItem(userId, planId, body) {
  const plan = await getCostPlan(userId, planId);
  if (plan.status === PLAN_STATUSES.ARCHIVED) {
    throw Object.assign(new Error('Cannot add items to archived plan'), { status: 409 });
  }

  const itemCount = await CostItem.countDocuments({ planId, removedAt: null });
  if (itemCount >= MAX_ITEMS_PER_PLAN) {
    throw Object.assign(new Error(`Plan cannot exceed ${MAX_ITEMS_PER_PLAN} cost items`), { status: 429 });
  }

  const {
    category, label, amountState, money, tuitionBasis, cadence,
    quantity, truthCategory, provenance, notes, required: isRequired,
    studentEditable, effectiveDate,
  } = body;

  if (!isValidCategory(category)) throw Object.assign(new Error(`Invalid category: ${category}`), { status: 400 });
  if (typeof label !== 'string' || !label.trim()) throw Object.assign(new Error('label is required'), { status: 400 });
  if (!Object.values(AMOUNT_STATES).includes(amountState)) throw Object.assign(new Error(`Invalid amountState`), { status: 400 });
  if (!isValidTruthCategory(truthCategory)) throw Object.assign(new Error(`Invalid truthCategory`), { status: 400 });

  // Enforce: student-entered cannot masquerade as verified
  if (isStudentSupplied(truthCategory) && isCanonical(truthCategory)) {
    throw Object.assign(new Error('truthCategory conflict'), { status: 400 });
  }

  let moneyValue = null;
  if (amountState !== AMOUNT_STATES.UNKNOWN) {
    if (!validateMoney(money)) throw Object.assign(new Error('Valid money (amountMinor, currency) required for known/estimated items'), { status: 400 });
    moneyValue = { amountMinor: money.amountMinor, currency: normalizeCurrency(money.currency) };
  }

  const item = await CostItem.create({
    planId,
    ownerUserId: userId,
    category,
    label: label.trim().slice(0, MAX_LABEL_LENGTH),
    amountState,
    money: moneyValue,
    tuitionBasis: isValidTuitionBasis(tuitionBasis) ? tuitionBasis : null,
    cadence: isValidCadence(cadence) ? cadence : COST_CADENCES.ONE_TIME,
    quantity: typeof quantity === 'number' ? quantity : null,
    truthCategory,
    provenance: provenance && typeof provenance === 'object' ? {
      sourceType: (provenance.sourceType || '').slice(0, 100),
      sourceUrl: (provenance.sourceUrl || '').slice(0, 2000),
      publisher: (provenance.publisher || '').slice(0, 200),
      lastVerifiedAt: provenance.lastVerifiedAt ? new Date(provenance.lastVerifiedAt) : null,
      evidenceRef: (provenance.evidenceRef || '').slice(0, 500),
      sourceVersion: (provenance.sourceVersion || '').slice(0, 200),
    } : null,
    freshness: body.freshness || COST_FRESHNESS.UNKNOWN,
    studentEditable: Boolean(studentEditable),
    required: isRequired !== false,
    notes: (notes || '').slice(0, MAX_NOTES_LENGTH),
    effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
  });

  await StudentCostPlan.findByIdAndUpdate(planId, {
    $push: { history: { eventType: PLAN_EVENT_TYPES.ITEM_ADDED, description: `Item added: ${label}`, at: new Date() } },
  });

  return item;
}

export async function listCostItems(userId, planId) {
  await getCostPlan(userId, planId); // ownership check
  return CostItem.find({ planId, removedAt: null }).sort({ createdAt: 1 }).lean();
}

export async function removeCostItem(userId, planId, itemId) {
  await getCostPlan(userId, planId); // ownership check
  if (!validateObjectId(itemId)) throw Object.assign(new Error('Invalid itemId'), { status: 400 });
  const item = await CostItem.findById(itemId);
  if (!item || String(item.planId) !== String(planId)) throw Object.assign(new Error('Item not found'), { status: 404 });
  item.removedAt = new Date();
  await item.save();
  await StudentCostPlan.findByIdAndUpdate(planId, {
    $push: { history: { eventType: PLAN_EVENT_TYPES.ITEM_REMOVED, description: `Item removed: ${item.label}`, at: new Date() } },
  });
}

export async function updateCostItemAmount(userId, planId, itemId, body) {
  await getCostPlan(userId, planId); // ownership check
  if (!validateObjectId(itemId)) throw Object.assign(new Error('Invalid itemId'), { status: 400 });
  const item = await CostItem.findById(itemId);
  if (!item || String(item.planId) !== String(planId)) throw Object.assign(new Error('Item not found'), { status: 404 });

  // Non-student-editable canonical items cannot be changed by student directly
  if (!item.studentEditable && isCanonical(item.truthCategory)) {
    throw Object.assign(new Error('This cost item is not student-editable'), { status: 403 });
  }

  const { amountState, money, notes } = body;
  if (amountState && Object.values(AMOUNT_STATES).includes(amountState)) {
    item.amountState = amountState;
  }
  if (item.amountState !== AMOUNT_STATES.UNKNOWN) {
    if (!validateMoney(money)) throw Object.assign(new Error('Valid money required'), { status: 400 });
    item.money = { amountMinor: money.amountMinor, currency: normalizeCurrency(money.currency) };
  } else {
    item.money = null;
  }
  if (typeof notes === 'string') item.notes = notes.slice(0, MAX_NOTES_LENGTH);

  await item.save();
  await StudentCostPlan.findByIdAndUpdate(planId, {
    $push: { history: { eventType: PLAN_EVENT_TYPES.AMOUNT_CHANGED, description: `Amount updated: ${item.label}`, at: new Date() } },
  });
  return item;
}

// ── Canonical item refresh ────────────────────────────────────────────────────

/**
 * Refresh a canonical cost item from the current Program tuition/fee data.
 * Explicit action only — never silently updates stored plan.
 */
export async function refreshCanonicalItem(userId, planId, itemId) {
  const plan = await getCostPlan(userId, planId);
  if (!validateObjectId(itemId)) throw Object.assign(new Error('Invalid itemId'), { status: 400 });
  const item = await CostItem.findById(itemId);
  if (!item || String(item.planId) !== String(planId)) throw Object.assign(new Error('Item not found'), { status: 404 });
  if (!isCanonical(item.truthCategory)) throw Object.assign(new Error('Only canonical items can be refreshed'), { status: 400 });
  if (!plan.programId) throw Object.assign(new Error('No program linked to this plan'), { status: 400 });

  const program = await Program.findById(plan.programId).select('tuition').lean();
  if (!program || !program.tuition) throw Object.assign(new Error('Program tuition data not available'), { status: 404 });

  const { amountMinor, currency } = program.tuition;
  if (!Number.isSafeInteger(amountMinor) || !normalizeCurrency(currency)) {
    throw Object.assign(new Error('Program tuition data is incomplete'), { status: 422 });
  }

  const prevMinor = item.money ? item.money.amountMinor : null;
  item.money = { amountMinor, currency: normalizeCurrency(currency) };
  item.amountState = AMOUNT_STATES.KNOWN;
  if (item.provenance) item.provenance.lastVerifiedAt = new Date();
  item.freshness = COST_FRESHNESS.FRESH;

  await item.save();

  await StudentCostPlan.findByIdAndUpdate(planId, {
    $push: {
      history: {
        eventType: PLAN_EVENT_TYPES.CANONICAL_REFRESHED,
        description: `Canonical refresh: ${item.label}. Previous: ${prevMinor} → ${amountMinor} ${currency}`,
        at: new Date(),
      },
    },
  });

  return { item, changed: prevMinor !== amountMinor };
}

// ── Budget summary ────────────────────────────────────────────────────────────

/**
 * Compute deterministic plan summary.
 * Returns grouped totals, gap, affordability, data quality.
 * Never fabricates amounts or FX rates.
 */
export async function getCostPlanSummary(userId, planId) {
  const plan = await getCostPlan(userId, planId);
  const items = await CostItem.find({ planId, removedAt: null }).lean();

  const grouped = groupTotalsByCurrency(items);
  const quality = dataQualitySummary(items);

  const currencyKeys = Object.keys(grouped.totals);
  const multiCurrencyCheck = resolveMultiCurrencyAffordability(currencyKeys);

  let budgetGap = null;
  if (!multiCurrencyCheck && currencyKeys.length === 1) {
    const currency = currencyKeys[0];
    const bs = plan.budgetSnapshot || {};
    if (Number.isSafeInteger(bs.totalAmountMinor) && normalizeCurrency(bs.currency) === currency) {
      budgetGap = calculateBudgetGap({
        knownCostMinor: grouped.totals[currency],
        knownFundingMinor: 0,
        studentBudgetMinor: bs.totalAmountMinor,
        currency,
        unknownCostCount: grouped.unknownCount,
      });
    }
  }

  const completeness = planCompleteness(items);

  return {
    planId,
    title: plan.title,
    status: plan.status,
    totalsByCurrency: grouped.totals,
    unknownCostCount: grouped.unknownCount,
    estimatedCostCount: grouped.estimatedCount,
    multiCurrencyUnresolved: !!multiCurrencyCheck,
    multiCurrencyExplanation: multiCurrencyCheck ? multiCurrencyCheck.explanation : null,
    budgetGap,
    affordabilityState: budgetGap ? budgetGap.affordabilityState : (multiCurrencyCheck ? multiCurrencyCheck.affordabilityState : 'insufficient_information'),
    dataQuality: quality,
    completeness,
    assumptions: plan.assumptions || [],
    planningHorizonMonths: plan.planningHorizonMonths,
    displayCurrency: plan.displayCurrency,
    note: 'Based on currently known costs only. Unknown costs are not included in totals.',
  };
}
