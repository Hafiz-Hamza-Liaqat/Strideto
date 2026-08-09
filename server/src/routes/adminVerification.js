/**
 * Admin verification queue and review routes (Mission 2).
 *
 * All routes require:
 *   - requireAuth + requireStaff (applied at the adminRouter level)
 *   - At minimum VERIFICATION_READ permission
 *
 * Role gates per action:
 *   - Moderator: read queue, begin review, request info, escalate, review evidence
 *   - Admin: all of the above + approve, reject, suspend, unsuspend
 *   - SuperAdmin: all of the above + revoke
 */
import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import * as ctrl from '../controllers/admin/adminVerificationController.js';

export const adminVerificationRouter = Router();

// Queue — filtered list of pending/active review organizations
adminVerificationRouter.get(
  '/queue',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.getQueue
);

// Single organization verification detail
adminVerificationRouter.get(
  '/:organizationId',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.getOrgVerification
);

// Transition history only
adminVerificationRouter.get(
  '/:organizationId/history',
  requirePermission(PERMISSIONS.VERIFICATION_READ),
  ctrl.getTransitionHistory
);

// Moderator+ actions
adminVerificationRouter.post(
  '/:organizationId/begin-review',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  ctrl.beginReview
);

adminVerificationRouter.post(
  '/:organizationId/request-information',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  ctrl.requestInformation
);

adminVerificationRouter.post(
  '/:organizationId/escalate',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  ctrl.escalate
);

adminVerificationRouter.post(
  '/:organizationId/evidence/:evidenceId/review',
  requirePermission(PERMISSIONS.VERIFICATION_REVIEW),
  ctrl.reviewEvidence
);

// Admin+ actions (double-checked in controller)
adminVerificationRouter.post(
  '/:organizationId/approve',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  ctrl.approve
);

adminVerificationRouter.post(
  '/:organizationId/reject',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  ctrl.reject
);

adminVerificationRouter.post(
  '/:organizationId/suspend',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  ctrl.suspend
);

adminVerificationRouter.post(
  '/:organizationId/unsuspend',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  ctrl.unsuspend
);

// SuperAdmin only (double-checked in controller)
adminVerificationRouter.post(
  '/:organizationId/revoke',
  requirePermission(PERMISSIONS.VERIFICATION_REVOKE),
  ctrl.revoke
);

// Risk signals (Admin+)
adminVerificationRouter.post(
  '/:organizationId/risk-signal',
  requirePermission(PERMISSIONS.VERIFICATION_APPROVE),
  ctrl.recordRiskSignal
);
