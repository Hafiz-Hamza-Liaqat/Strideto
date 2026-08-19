/**
 * Budget Plan Controller — Mission 20.
 *
 * All handlers require authenticated Student (requireUserAuth).
 * userId is always derived from req.user.userId (set by auth middleware).
 * No cross-user access. No Commerce mutation.
 */
import {
  createCostPlan,
  listCostPlans,
  getCostPlan,
  updateCostPlan,
  archiveCostPlan,
  cloneCostPlan,
  addCostItem,
  listCostItems,
  removeCostItem,
  updateCostItemAmount,
  refreshCanonicalItem,
  getCostPlanSummary,
} from '../services/budgetPlanService.js';

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

// ── Plans ─────────────────────────────────────────────────────────────────────

export const createPlanHandler = handle(async (req, res) => {
  const plan = await createCostPlan(req.user.userId, req.body);
  res.status(201).json({ plan });
});

export const listPlansHandler = handle(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const result = await listCostPlans(req.user.userId, { page, limit });
  res.json(result);
});

export const getPlanHandler = handle(async (req, res) => {
  const plan = await getCostPlan(req.user.userId, req.params.planId);
  res.json({ plan });
});

export const updatePlanHandler = handle(async (req, res) => {
  const plan = await updateCostPlan(req.user.userId, req.params.planId, req.body);
  res.json({ plan });
});

export const archivePlanHandler = handle(async (req, res) => {
  const plan = await archiveCostPlan(req.user.userId, req.params.planId);
  res.json({ plan });
});

export const clonePlanHandler = handle(async (req, res) => {
  const plan = await cloneCostPlan(req.user.userId, req.params.planId);
  res.status(201).json({ plan });
});

export const getPlanSummaryHandler = handle(async (req, res) => {
  const summary = await getCostPlanSummary(req.user.userId, req.params.planId);
  res.json({ summary });
});

// ── Cost items ────────────────────────────────────────────────────────────────

export const addItemHandler = handle(async (req, res) => {
  const item = await addCostItem(req.user.userId, req.params.planId, req.body);
  res.status(201).json({ item });
});

export const listItemsHandler = handle(async (req, res) => {
  const items = await listCostItems(req.user.userId, req.params.planId);
  res.json({ items });
});

export const removeItemHandler = handle(async (req, res) => {
  await removeCostItem(req.user.userId, req.params.planId, req.params.itemId);
  res.json({ removed: true });
});

export const updateItemAmountHandler = handle(async (req, res) => {
  const item = await updateCostItemAmount(req.user.userId, req.params.planId, req.params.itemId, req.body);
  res.json({ item });
});

export const refreshItemHandler = handle(async (req, res) => {
  const result = await refreshCanonicalItem(req.user.userId, req.params.planId, req.params.itemId);
  res.json(result);
});
