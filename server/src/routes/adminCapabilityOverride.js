/**
 * Super-admin capability override routes.
 *
 * All three routes require:
 *   - requireAuth + requireStaff (applied at adminRouter level)
 *   - requireSuperAdmin (applied here — double-checked in controller)
 *
 * No Admin, Moderator, Editor, Support, Reviewer, or any non-staff role
 * may call these endpoints.
 */
import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/rbac.js';
import * as ctrl from '../controllers/admin/adminCapabilityOverrideController.js';

export const adminCapabilityOverrideRouter = Router();

// Read-only: any staff can view for audit transparency (Moderator+)
// but we restrict to SuperAdmin to limit who knows this mechanism exists.
adminCapabilityOverrideRouter.get(
  '/:organizationId',
  requireSuperAdmin,
  ctrl.getOverrideStatus
);

adminCapabilityOverrideRouter.post(
  '/:organizationId/grant',
  requireSuperAdmin,
  ctrl.grantOverride
);

adminCapabilityOverrideRouter.post(
  '/:organizationId/revoke',
  requireSuperAdmin,
  ctrl.revokeOverride
);
