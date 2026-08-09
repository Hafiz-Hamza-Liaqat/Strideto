/**
 * Organization-side verification routes (Mission 2).
 *
 * Reusable by future Agent, Institution portals. Currently accessible by:
 *   - Employer realm (linked organization via legacyEmployerId)
 *   - Admin realm (staff support and testing)
 *
 * Ownership is enforced in the controller (assertOwnership).
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/organization/organizationVerificationController.js';

export const organizationVerificationRouter = Router();

organizationVerificationRouter.use(requireAuth);

// Get current verification status and evidence summary
organizationVerificationRouter.get(
  '/:organizationId/verification',
  ctrl.getVerificationStatus
);

// Get credential policy hint for this org's type + country
organizationVerificationRouter.get(
  '/:organizationId/verification/credential-policy',
  ctrl.getCredentialPolicy
);

// Submit (or re-submit) the verification profile
organizationVerificationRouter.post(
  '/:organizationId/verification/submit',
  ctrl.submitVerification
);

// Add an evidence record
organizationVerificationRouter.post(
  '/:organizationId/verification/evidence',
  ctrl.addEvidence
);

// Respond to a needs_information request (re-submit with updated profile)
organizationVerificationRouter.post(
  '/:organizationId/verification/respond',
  ctrl.respondToInformationRequest
);
