/**
 * Institution Portal routes (Mission 18).
 *
 * Security boundaries:
 * - Auth routes: secureTrustedOrigin + rate limiting
 * - Portal routes: requireAuth + requireInstitutionAuth
 * - User/Employer/Agent realms cannot invoke Institution mutations
 * - VAULT: Institution auth grants zero Vault access
 * - No Student lookup, no Agent case access, no Employer hiring authority
 * - No direct application submission claim
 * - Admin review: separate /admin/institution routes
 */
import { Router } from 'express';
import { requireAuth, requireInstitutionAuth, requireAdmin } from '../middleware/auth.js';
import { secureTrustedOrigin } from '../middleware/secureTrustedOrigin.js';
import { employerAuthLimiter, refreshLimiter, searchLimiter } from '../middleware/rateLimit.js';
import * as authCtrl from '../controllers/institutionAuthController.js';
import * as portalCtrl from '../controllers/institutionPortalController.js';

export const institutionPortalRouter = Router();

// ---------------------------------------------------------------------------
// Auth (institution realm — isolated from user/employer/agent)
// ---------------------------------------------------------------------------

institutionPortalRouter.post(
  '/auth/institution/register',
  employerAuthLimiter,
  secureTrustedOrigin,
  authCtrl.institutionRegister
);

institutionPortalRouter.post(
  '/auth/institution/login',
  employerAuthLimiter,
  secureTrustedOrigin,
  authCtrl.institutionLogin
);

institutionPortalRouter.post(
  '/auth/institution/refresh-token',
  refreshLimiter,
  secureTrustedOrigin,
  authCtrl.institutionRefreshToken
);

institutionPortalRouter.post(
  '/auth/institution/logout',
  secureTrustedOrigin,
  requireAuth,
  requireInstitutionAuth,
  authCtrl.institutionLogout
);

institutionPortalRouter.post(
  '/auth/institution/logout-all',
  secureTrustedOrigin,
  requireAuth,
  requireInstitutionAuth,
  authCtrl.institutionLogoutAll
);

institutionPortalRouter.get(
  '/auth/institution/me',
  requireAuth,
  requireInstitutionAuth,
  authCtrl.institutionMe
);

// ---------------------------------------------------------------------------
// Public surfaces (no auth required)
// ---------------------------------------------------------------------------

// Institution directory — bounded pagination, no fake rankings
institutionPortalRouter.get(
  '/institutions/directory',
  searchLimiter,
  portalCtrl.searchInstitutionDirectory
);

// Public verified institution profile
institutionPortalRouter.get(
  '/institutions/:slug/profile',
  portalCtrl.getPublicInstitutionProfile
);

// ---------------------------------------------------------------------------
// Institution portal (requires Institution realm auth)
// ---------------------------------------------------------------------------

const portal = Router();
portal.use(requireAuth, requireInstitutionAuth);

// Onboarding / dashboard
portal.get('/:organizationId/dashboard', portalCtrl.getDashboard);
portal.get('/:organizationId/onboarding', portalCtrl.getOnboardingStatus);

// Official profile management
portal.get('/:organizationId/profile', portalCtrl.getProfile);
portal.patch('/:organizationId/profile', portalCtrl.updateProfile);

// Canonical institution claim
portal.get('/:organizationId/claim', portalCtrl.getClaim);
portal.post('/:organizationId/claim', portalCtrl.startClaim);
portal.post('/:organizationId/claim/:claimId/submit', portalCtrl.submitClaim);

// Program management (ownership enforced — approved claim required)
portal.get('/:organizationId/programs', portalCtrl.listPrograms);
portal.post('/:organizationId/programs', portalCtrl.createProgram);
portal.get('/:organizationId/programs/:programId', portalCtrl.getProgram);
portal.patch('/:organizationId/programs/:programId', portalCtrl.updateProgram);
portal.post('/:organizationId/programs/:programId/submit', portalCtrl.submitProgram);

// Requirements (program-scoped, ownership enforced)
portal.post('/:organizationId/programs/:programId/requirements', portalCtrl.createRequirement);

// Test acceptance (institution/program scope — country-level protected)
portal.post('/:organizationId/test-acceptance', portalCtrl.createTestAcceptance);

// Freshness reconfirmation (auditable)
portal.post('/:organizationId/freshness/reconfirm', portalCtrl.reconfirmFreshness);

// Data quality
portal.get('/:organizationId/data-conflicts', portalCtrl.getDataConflicts);
portal.get('/:organizationId/change-history', portalCtrl.getChangeHistory);

// Team management
portal.get('/:organizationId/team', portalCtrl.getTeam);
portal.patch('/:organizationId/team/:memberId/role', portalCtrl.updateMemberRole);
portal.delete('/:organizationId/team/:memberId', portalCtrl.revokeMember);

institutionPortalRouter.use('/institution', portal);

// ---------------------------------------------------------------------------
// Admin review extensions (Admin realm — reuse Mission 2 verification admin)
// Minimal institution-specific surfaces: claim review, data conflict resolution
// ---------------------------------------------------------------------------

const adminInstitution = Router();
adminInstitution.use(requireAuth, requireAdmin);

adminInstitution.get('/claims', async (req, res) => {
  const { InstitutionClaim } = await import('../models/institution/InstitutionClaim.js');
  const { state, page = 1, limit = 20 } = req.query;
  const query = {};
  if (state) query.state = state;
  const safeLimit = Math.min(parseInt(limit), 50);
  const claims = await InstitutionClaim.find(query)
    .sort({ submittedAt: 1 })
    .skip((parseInt(page) - 1) * safeLimit)
    .limit(safeLimit)
    .lean();
  return res.status(200).json({ claims });
});

adminInstitution.patch('/claims/:claimId', async (req, res) => {
  const { InstitutionClaim } = await import('../models/institution/InstitutionClaim.js');
  const { CanonicalInstitution } = await import('../models/education/CanonicalInstitution.js');
  const { Organization } = await import('../models/Organization.js');
  const { logAudit } = await import('../services/auditService.js');
  const { CLAIM_STATES, CLAIM_TRANSITIONS, isValidClaimTransition } = await import('../../../shared/institution/institutionPortal.js');
  const { claimId } = req.params;
  const { action, reason } = req.body;

  const claim = await InstitutionClaim.findById(claimId);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const transitions = {
    approve: CLAIM_STATES.APPROVED,
    reject: CLAIM_STATES.REJECTED,
    request_information: CLAIM_STATES.NEEDS_INFORMATION,
    begin_review: CLAIM_STATES.UNDER_REVIEW,
    revoke: CLAIM_STATES.REVOKED,
  };
  const targetState = transitions[action];
  if (!targetState) return res.status(400).json({ error: 'Invalid action' });
  if (!isValidClaimTransition(claim.state, targetState)) {
    return res.status(409).json({ error: `Cannot transition from ${claim.state} to ${targetState}` });
  }

  claim.history.push({
    fromState: claim.state, toState: targetState,
    changedBy: req.user.userId, changedByRealm: 'admin', reason: reason || '', at: new Date(),
  });
  claim.state = targetState;
  claim.reviewedAt = new Date();
  claim.reviewedBy = req.user.userId;

  if (targetState === CLAIM_STATES.APPROVED) {
    claim.approvedAt = new Date();
    // If approved and claim has a proposedCanonical but no canonicalInstitutionId,
    // create the canonical institution record now (controlled, not automatic).
    if (!claim.canonicalInstitutionId && claim.proposedCanonical?.officialName) {
      const { educationSlug } = await import('../../../shared/education/taxonomy.js');
      let slug = educationSlug(claim.proposedCanonical.officialName);
      const base = slug;
      let attempt = 0;
      while (await CanonicalInstitution.exists({ slug })) { attempt++; slug = `${base}-${attempt + 1}`; }
      const ci = await CanonicalInstitution.create({
        ...claim.proposedCanonical,
        slug,
        organizationId: claim.organizationId,
        status: 'draft',
      });
      claim.canonicalInstitutionId = ci._id;
      // Link organization → canonical institution
      await Organization.findByIdAndUpdate(claim.organizationId, {});
    }
    if (claim.canonicalInstitutionId) {
      await CanonicalInstitution.findByIdAndUpdate(claim.canonicalInstitutionId, {
        organizationId: claim.organizationId,
      });
    }
  }

  if (targetState === CLAIM_STATES.REJECTED || targetState === CLAIM_STATES.NEEDS_INFORMATION) {
    claim.rejectedReason = reason || '';
  }

  await claim.save();
  await logAudit({
    action: `institution_claim_${action}`,
    actor: { userId: req.user.userId, role: req.user.role },
    metadata: { claimId, organizationId: claim.organizationId, targetState },
  });

  return res.status(200).json({ claim });
});

adminInstitution.get('/conflicts', async (req, res) => {
  const { InstitutionDataConflict } = await import('../models/institution/InstitutionDataConflict.js');
  const { state = 'open', page = 1, limit = 20 } = req.query;
  const safeLimit = Math.min(parseInt(limit), 50);
  const conflicts = await InstitutionDataConflict.find({ state })
    .sort({ createdAt: 1 })
    .skip((parseInt(page) - 1) * safeLimit)
    .limit(safeLimit)
    .lean();
  return res.status(200).json({ conflicts });
});

adminInstitution.patch('/conflicts/:conflictId/resolve', async (req, res) => {
  const { InstitutionDataConflict } = await import('../models/institution/InstitutionDataConflict.js');
  const { logAudit } = await import('../services/auditService.js');
  const { conflictId } = req.params;
  const { resolution, resolvedAs } = req.body;

  const conflict = await InstitutionDataConflict.findById(conflictId);
  if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

  const validResolutions = ['resolved_institution', 'resolved_existing', 'dismissed'];
  if (!validResolutions.includes(resolvedAs)) {
    return res.status(400).json({ error: 'resolvedAs must be resolved_institution, resolved_existing, or dismissed' });
  }

  conflict.state = resolvedAs;
  conflict.resolution = resolution || '';
  conflict.resolvedBy = req.user.userId;
  conflict.resolvedAt = new Date();
  await conflict.save();

  await logAudit({
    action: 'institution_conflict_resolved',
    actor: { userId: req.user.userId, role: req.user.role },
    metadata: { conflictId, resolvedAs },
  });

  return res.status(200).json({ conflict });
});

institutionPortalRouter.use('/admin/institution', adminInstitution);
