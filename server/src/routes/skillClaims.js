/**
 * Skill claim / evidence / verification routes.
 *
 * Three distinct audiences, three distinct guards — note that no route lets a
 * caller write their own trust state:
 *
 *   applicant (Student realm)  create claims, attach evidence, request review
 *   employer  (Employer realm)  READ ONLY, scoped to their own applicants
 *   reviewer  (staff)           record decisions, gated per-permission
 *
 * There is deliberately no AI/Copilot route: verification has no machine
 * entry point, and `authorizeClaimTransition` refuses any non-user realm.
 */
import { Router } from 'express';
import {
  requireAuth,
  requireEmployerAuth,
} from '../middleware/auth.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import {
  createSkillClaim,
  listMySkillClaims,
  addSkillEvidence,
  submitSkillClaimForReview,
  getSkillClaimHistory,
  getApplicantSkillsForEmployer,
  recordSkillVerification,
  getSkillVerificationOptions,
  listSkillClaimsForReview,
} from '../controllers/career/skillClaimController.js';

export const skillClaimsRouter = Router();

const applicantAuth = [...studentProductAuth];

// --- Applicant ------------------------------------------------------------
skillClaimsRouter.get('/skill-claims', ...applicantAuth, listMySkillClaims);
skillClaimsRouter.post('/skill-claims', ...applicantAuth, createSkillClaim);
skillClaimsRouter.post('/skill-claims/:claimId/evidence', ...applicantAuth, addSkillEvidence);
skillClaimsRouter.post('/skill-claims/:claimId/submit', ...applicantAuth, submitSkillClaimForReview);
skillClaimsRouter.get('/skill-claims/:claimId/history', requireAuth, getSkillClaimHistory);

// --- Employer (read-only) --------------------------------------------------
skillClaimsRouter.get(
  '/employer/applicants/:applicantId/skills',
  requireAuth,
  requireEmployerAuth,
  getApplicantSkillsForEmployer
);

// --- Reviewer (staff) ------------------------------------------------------
// The specific permission for each outcome is enforced inside the service by
// `authorizeClaimTransition`; this gate only ensures a reviewer got this far.
skillClaimsRouter.get(
  '/admin/skill-verification/options',
  requireAuth,
  requirePermission(PERMISSIONS.SKILL_VERIFICATION_READ),
  getSkillVerificationOptions
);
skillClaimsRouter.get(
  '/admin/skill-claims',
  requireAuth,
  requirePermission(PERMISSIONS.SKILL_VERIFICATION_READ),
  listSkillClaimsForReview
);
skillClaimsRouter.post(
  '/admin/skill-claims/:claimId/verification',
  requireAuth,
  requirePermission(
    PERMISSIONS.SKILL_VERIFICATION_REVIEW,
    PERMISSIONS.SKILL_VERIFICATION_APPROVE,
    PERMISSIONS.SKILL_VERIFICATION_REVOKE
  ),
  recordSkillVerification
);
