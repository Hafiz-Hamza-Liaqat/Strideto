/**
 * Budget / Cost Planner routes — Mission 20.
 *
 * Security boundaries:
 *   - All routes require authentication as a Student (requireAuth + requireUserAuth)
 *   - userId is always server-derived from JWT
 *   - No cross-user access (enforced in service layer)
 *   - No Agent / Institution / Employer access
 *   - No public endpoints
 *   - No Commerce mutation
 *   - No live FX or cost APIs
 *
 * Routes:
 *   GET    /api/budget/plans            — list plans (paginated)
 *   POST   /api/budget/plans            — create plan
 *   GET    /api/budget/plans/:planId    — get plan detail
 *   PATCH  /api/budget/plans/:planId    — update plan
 *   POST   /api/budget/plans/:planId/archive   — archive plan
 *   POST   /api/budget/plans/:planId/clone     — clone plan (scenario)
 *   GET    /api/budget/plans/:planId/summary   — computed summary
 *   GET    /api/budget/plans/:planId/items     — list cost items
 *   POST   /api/budget/plans/:planId/items     — add cost item
 *   DELETE /api/budget/plans/:planId/items/:itemId         — remove item
 *   PATCH  /api/budget/plans/:planId/items/:itemId/amount  — update student amount
 *   POST   /api/budget/plans/:planId/items/:itemId/refresh — refresh canonical item
 */
import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import {
  createPlanHandler,
  listPlansHandler,
  getPlanHandler,
  updatePlanHandler,
  archivePlanHandler,
  clonePlanHandler,
  getPlanSummaryHandler,
  addItemHandler,
  listItemsHandler,
  removeItemHandler,
  updateItemAmountHandler,
  refreshItemHandler,
} from '../controllers/budgetPlanController.js';

export const budgetRouter = Router();

const studentAuth = [...studentProductAuth];

// Plan endpoints
budgetRouter.get('/budget/plans', ...studentAuth, listPlansHandler);
budgetRouter.post('/budget/plans', ...studentAuth, searchLimiter, createPlanHandler);
budgetRouter.get('/budget/plans/:planId', ...studentAuth, getPlanHandler);
budgetRouter.patch('/budget/plans/:planId', ...studentAuth, updatePlanHandler);
budgetRouter.post('/budget/plans/:planId/archive', ...studentAuth, archivePlanHandler);
budgetRouter.post('/budget/plans/:planId/clone', ...studentAuth, searchLimiter, clonePlanHandler);
budgetRouter.get('/budget/plans/:planId/summary', ...studentAuth, getPlanSummaryHandler);

// Cost item endpoints
budgetRouter.get('/budget/plans/:planId/items', ...studentAuth, listItemsHandler);
budgetRouter.post('/budget/plans/:planId/items', ...studentAuth, addItemHandler);
budgetRouter.delete('/budget/plans/:planId/items/:itemId', ...studentAuth, removeItemHandler);
budgetRouter.patch('/budget/plans/:planId/items/:itemId/amount', ...studentAuth, updateItemAmountHandler);
budgetRouter.post('/budget/plans/:planId/items/:itemId/refresh', ...studentAuth, searchLimiter, refreshItemHandler);
