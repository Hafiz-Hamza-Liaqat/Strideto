/**
 * Admin verified-data launch routes (Mission 25).
 *
 * Read-only visibility into launch batches and their dry-run plans.
 * There is deliberately no POST/PATCH/DELETE here: Mission 25 exposes no
 * canonical mutation surface, and no public route touches this router.
 *
 * Auth + Staff are enforced by the parent adminRouter; each route additionally
 * requires the Mission 21 data-quality permission.
 */
import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import * as launch from '../controllers/data/adminVerifiedLaunchController.js';

export const adminVerifiedLaunchRouter = Router();

adminVerifiedLaunchRouter.get(
  '/data/verified-launch/batches',
  requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE),
  launch.adminListLaunchBatches
);

adminVerifiedLaunchRouter.get(
  '/data/verified-launch/batches/:manifestFile/dry-run',
  requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE),
  launch.adminLaunchBatchDryRun
);
