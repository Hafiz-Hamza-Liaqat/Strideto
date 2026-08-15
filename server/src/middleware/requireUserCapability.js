/**
 * User-realm capability middleware (Phase 17D-1).
 *
 * Student product writes require an active `student` grant (or the narrow
 * legacy compatibility resolver). Generic User account/security/vault routes
 * must NOT use this middleware.
 */
import { requireAuth, requireUserAuth } from './auth.js';
import { requireNonStaffUser } from './requireNonStaffUser.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import {
  authorizeUserCapability,
  denyBody,
} from '../services/security/authorizeAction.js';

export function requireActiveUserCapability(capabilityId) {
  return async function requireActiveUserCapabilityMiddleware(req, res, next) {
    try {
      const decision = await authorizeUserCapability(req, capabilityId);
      if (!decision.allowed) {
        return res.status(decision.status || 403).json(denyBody(decision));
      }
      req.capabilityDecision = decision;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const requireStudentCapability = requireActiveUserCapability(
  USER_CAPABILITY_IDS.STUDENT
);

export const requireBusinessClientCapability = requireActiveUserCapability(
  USER_CAPABILITY_IDS.BUSINESS_CLIENT
);

/** Canonical Student-product auth chain. */
export const studentProductAuth = [
  requireAuth,
  requireUserAuth,
  requireStudentCapability,
];

/** Explicit Business Client activation — ordinary User only, grant not required. */
export const businessClientActivateAuth = [
  requireAuth,
  requireUserAuth,
  requireNonStaffUser,
];

/** Canonical Business Client product auth chain. */
export const businessClientProductAuth = [
  requireAuth,
  requireUserAuth,
  requireNonStaffUser,
  requireBusinessClientCapability,
];
