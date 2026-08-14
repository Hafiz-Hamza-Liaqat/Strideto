/**
 * Admin GBS capability and listing moderation routes (Phase 17D-4).
 *
 * Mounted at /api/admin/gbs. requireAuth + requireStaff + admin read/write
 * limiters are applied by adminRouter. No mass-assignment PATCH.
 */
import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import * as ctrl from '../controllers/admin/adminGbsModerationController.js';

export const adminGbsRouter = Router();

adminGbsRouter.get(
  '/capabilities/queue',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.listCapabilityQueue
);
adminGbsRouter.get(
  '/capabilities/:id',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.getCapabilityDetail
);
adminGbsRouter.post(
  '/capabilities/:id/mark-evidence-backed',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  (req, res, next) => {
    req.params.action = 'mark-evidence-backed';
    return ctrl.reviewCapability(req, res, next);
  }
);
adminGbsRouter.post(
  '/capabilities/:id/verify',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  (req, res, next) => {
    req.params.action = 'verify';
    return ctrl.reviewCapability(req, res, next);
  }
);
adminGbsRouter.post(
  '/capabilities/:id/needs-information',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  (req, res, next) => {
    req.params.action = 'needs-information';
    return ctrl.reviewCapability(req, res, next);
  }
);
adminGbsRouter.post(
  '/capabilities/:id/reject',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  (req, res, next) => {
    req.params.action = 'reject';
    return ctrl.reviewCapability(req, res, next);
  }
);
adminGbsRouter.post(
  '/capabilities/:id/suspend',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  (req, res, next) => {
    req.params.action = 'suspend';
    return ctrl.reviewCapability(req, res, next);
  }
);
adminGbsRouter.post(
  '/capabilities/:id/revoke',
  requirePermission(PERMISSIONS.VERIFICATION_REVOKE),
  (req, res, next) => {
    req.params.action = 'revoke';
    return ctrl.reviewCapability(req, res, next);
  }
);

adminGbsRouter.get(
  '/listings/queue',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.listListingQueue
);
adminGbsRouter.get(
  '/listings/:id',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.getListingDetail
);
adminGbsRouter.post(
  '/listings/:id/approve',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  (req, res, next) => {
    req.params.action = 'approve';
    return ctrl.reviewListing(req, res, next);
  }
);
adminGbsRouter.post(
  '/listings/:id/needs-information',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  (req, res, next) => {
    req.params.action = 'needs-information';
    return ctrl.reviewListing(req, res, next);
  }
);
adminGbsRouter.post(
  '/listings/:id/reject',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  (req, res, next) => {
    req.params.action = 'reject';
    return ctrl.reviewListing(req, res, next);
  }
);
adminGbsRouter.post(
  '/listings/:id/suspend',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  (req, res, next) => {
    req.params.action = 'suspend';
    return ctrl.reviewListing(req, res, next);
  }
);
