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
import { requireAuth, requireInstitutionAuth } from '../middleware/auth.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import { requireStaff, requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import { secureTrustedOrigin } from '../middleware/secureTrustedOrigin.js';
import { employerAuthLimiter, refreshLimiter, searchLimiter, forgotPasswordLimiter, authLimiter } from '../middleware/rateLimit.js';
import { requireTurnstileWhenEnabled } from '../middleware/turnstile.js';
import { requireInstitutionEmailVerified } from '../middleware/requireEmailVerified.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { INSTITUTION_TYPES } from '../../../shared/education/taxonomy.js';
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
  requireTurnstileWhenEnabled('register'),
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

institutionPortalRouter.post(
  '/auth/institution/change-password',
  secureTrustedOrigin,
  requireAuth,
  requireInstitutionAuth,
  authCtrl.institutionChangePassword
);

institutionPortalRouter.post(
  '/auth/institution/forgot-password',
  secureTrustedOrigin,
  forgotPasswordLimiter,
  requireTurnstileWhenEnabled('password_recovery'),
  authCtrl.institutionForgotPassword
);

institutionPortalRouter.post(
  '/auth/institution/reset-password',
  secureTrustedOrigin,
  authLimiter,
  authCtrl.institutionResetPassword
);

institutionPortalRouter.get(
  '/auth/institution/invitations/preview',
  portalCtrl.previewInvite
);

institutionPortalRouter.post(
  '/auth/institution/invitations/accept',
  secureTrustedOrigin,
  requireAuth,
  requireInstitutionAuth,
  portalCtrl.acceptInvite
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
portal.post('/:organizationId/claim', requireInstitutionEmailVerified(), portalCtrl.startClaim);
portal.patch('/:organizationId/claim/:claimId', requireInstitutionEmailVerified(), portalCtrl.updateClaim);
portal.post('/:organizationId/claim/:claimId/submit', requireInstitutionEmailVerified(), portalCtrl.submitClaim);
portal.post('/:organizationId/claim/:claimId/reopen', requireInstitutionEmailVerified(), portalCtrl.reopenClaim);

// Program management (ownership enforced — approved claim required)
portal.get('/:organizationId/programs', portalCtrl.listPrograms);
portal.post('/:organizationId/programs', requireInstitutionEmailVerified(), portalCtrl.createProgram);
portal.get('/:organizationId/programs/:programId', portalCtrl.getProgram);
portal.patch('/:organizationId/programs/:programId', requireInstitutionEmailVerified(), portalCtrl.updateProgram);
portal.post('/:organizationId/programs/:programId/submit', requireInstitutionEmailVerified(), portalCtrl.submitProgram);

// Requirements (program-scoped, ownership enforced)
portal.post('/:organizationId/programs/:programId/requirements', requireInstitutionEmailVerified(), portalCtrl.createRequirement);

// Test acceptance (institution/program scope — country-level protected)
portal.get('/:organizationId/test-acceptance', portalCtrl.listTestAcceptance);
portal.post('/:organizationId/test-acceptance', requireInstitutionEmailVerified(), portalCtrl.createTestAcceptance);

portal.get('/:organizationId/scholarships', portalCtrl.listScholarships);
portal.post('/:organizationId/scholarships', requireInstitutionEmailVerified(), portalCtrl.createScholarship);
portal.patch('/:organizationId/scholarships/:scholarshipId', requireInstitutionEmailVerified(), portalCtrl.updateScholarship);

portal.get('/:organizationId/applications', portalCtrl.listApplications);
portal.get('/:organizationId/applications/:applicationId', portalCtrl.getApplication);
portal.patch('/:organizationId/applications/:applicationId/status', portalCtrl.transitionApplication);

portal.get('/:organizationId/usage-billing', portalCtrl.getUsageBilling);
portal.get('/:organizationId/vault', portalCtrl.denyVault);
portal.get('/:organizationId/students', portalCtrl.denyVault);

// Freshness reconfirmation (auditable)
portal.post('/:organizationId/freshness/reconfirm', portalCtrl.reconfirmFreshness);

// Data quality
portal.get('/:organizationId/data-conflicts', portalCtrl.getDataConflicts);
portal.get('/:organizationId/change-history', portalCtrl.getChangeHistory);

// Team management
portal.get('/:organizationId/team', portalCtrl.getTeam);
portal.patch('/:organizationId/team/:memberId/role', portalCtrl.updateMemberRole);
portal.delete('/:organizationId/team/:memberId', portalCtrl.revokeMember);
portal.get('/:organizationId/team/invites', portalCtrl.listInvites);
portal.post('/:organizationId/team/invites', portalCtrl.createInvite);
portal.post('/:organizationId/team/invites/:invitationId/revoke', portalCtrl.revokeInvite);

institutionPortalRouter.use('/institution', portal);

institutionPortalRouter.post(
  '/student/institution-admissions',
  ...studentProductAuth,
  portalCtrl.studentSubmitAdmission
);
institutionPortalRouter.get(
  '/student/institution-admissions',
  ...studentProductAuth,
  portalCtrl.studentListAdmissions
);
institutionPortalRouter.post(
  '/student/institution-admissions/:applicationId/withdraw',
  ...studentProductAuth,
  portalCtrl.studentWithdrawAdmission
);
institutionPortalRouter.post(
  '/student/institution-admissions/:applicationId/respond',
  ...studentProductAuth,
  portalCtrl.studentRespondAdmission
);

// ---------------------------------------------------------------------------
// Admin review extensions (Admin realm — reuse Mission 2 verification admin)
// Minimal institution-specific surfaces: claim review, data conflict resolution
// ---------------------------------------------------------------------------

const adminInstitution = Router();
adminInstitution.use(requireAuth, requireStaff);

adminInstitution.get('/claims', requirePermission(PERMISSIONS.VERIFICATION_READ), asyncHandler(async (req, res) => {
  const { InstitutionClaim } = await import('../models/institution/InstitutionClaim.js');
  const { OrganizationVerification } = await import('../models/OrganizationVerification.js');
  const { state, q, countryCode, page = 1, limit = 20 } = req.query;
  const query = {};
  if (state) query.state = state;
  if (countryCode) query.countryCode = String(countryCode).toUpperCase();
  if (q && String(q).trim()) {
    const re = new RegExp(String(q).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ officialDomain: re }, { normalizedName: re }];
  }
  const safeLimit = Math.min(parseInt(limit, 10) || 20, 50);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const [claims, total] = await Promise.all([
    InstitutionClaim.find(query)
      .sort({ submittedAt: 1 })
      .skip((pageNum - 1) * safeLimit)
      .limit(safeLimit)
      .populate('organizationId', 'displayName legalName organizationType countryCode')
      .populate('canonicalInstitutionId', 'officialName countryCode officialDomain slug')
      .lean(),
    InstitutionClaim.countDocuments(query),
  ]);

  const orgIds = claims.map((c) => c.organizationId?._id || c.organizationId).filter(Boolean);
  const verifications = orgIds.length
    ? await OrganizationVerification.find({ organizationId: { $in: orgIds } })
      .select('organizationId status')
      .lean()
    : [];
  const verByOrg = new Map(verifications.map((v) => [String(v.organizationId), v.status]));

  const competingIds = claims
    .map((c) => c.canonicalInstitutionId?._id || c.canonicalInstitutionId)
    .filter(Boolean);
  const competing = competingIds.length
    ? await InstitutionClaim.find({
      canonicalInstitutionId: { $in: competingIds },
      state: { $in: ['submitted', 'under_review', 'approved'] },
    }).select('_id canonicalInstitutionId organizationId state').lean()
    : [];

  const enriched = claims.map((claim) => {
    const canonicalId = String(claim.canonicalInstitutionId?._id || claim.canonicalInstitutionId || '');
    const rivals = competing.filter(
      (c) => String(c.canonicalInstitutionId) === canonicalId && String(c._id) !== String(claim._id)
    );
    return {
      ...claim,
      organizationVerificationState: verByOrg.get(String(claim.organizationId?._id || claim.organizationId)) || null,
      competingClaims: rivals.map((r) => ({
        claimId: r._id,
        organizationId: r.organizationId,
        state: r.state,
      })),
    };
  });

  return res.status(200).json({
    claims: enriched,
    pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  });
}));

adminInstitution.patch('/claims/:claimId', requirePermission(PERMISSIONS.VERIFICATION_APPROVE), asyncHandler(async (req, res) => {
  const { InstitutionClaim } = await import('../models/institution/InstitutionClaim.js');
  const { CanonicalInstitution } = await import('../models/education/CanonicalInstitution.js');
  const { Organization } = await import('../models/Organization.js');
  const { OrganizationVerification } = await import('../models/OrganizationVerification.js');
  const { logAudit } = await import('../services/auditService.js');
  const { CLAIM_STATES, isValidClaimTransition } = await import('../../../shared/institution/institutionPortal.js');
  const { CANONICAL_CLAIM_NOTIFICATION_TYPES } = await import('../../../shared/platform/organizationVerificationNotifications.js');
  const { emitCanonicalClaimNotifications } = await import('../services/orgVerificationNotificationBridge.js');
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

  const reasonRequired = ['reject', 'request_information', 'revoke'].includes(action);
  if (reasonRequired && !String(reason || '').trim()) {
    return res.status(422).json({ error: 'A reason is required for this action' });
  }

  if (targetState === CLAIM_STATES.APPROVED) {
    const verification = await OrganizationVerification.findOne({ organizationId: claim.organizationId })
      .select('status')
      .lean();
    if (!verification || verification.status !== 'approved') {
      return res.status(409).json({
        error: 'Organization verification must be approved before canonical claim approval',
      });
    }
    if (claim.canonicalInstitutionId) {
      const competingApproved = await InstitutionClaim.findOne({
        canonicalInstitutionId: claim.canonicalInstitutionId,
        state: CLAIM_STATES.APPROVED,
        _id: { $ne: claim._id },
      }).select('_id organizationId').lean();
      if (competingApproved) {
        return res.status(409).json({
          error: 'A competing approved claim already exists for this canonical institution',
          competingClaimId: competingApproved._id,
        });
      }
    }
  }

  const fromState = claim.state;
  claim.history.push({
    fromState, toState: targetState,
    changedBy: req.user.userId, changedByRealm: 'admin', reason: reason || '', at: new Date(),
  });
  claim.state = targetState;
  claim.reviewedAt = new Date();
  claim.reviewedBy = req.user.userId;

  if (targetState === CLAIM_STATES.APPROVED) {
    claim.approvedAt = new Date();
    if (!claim.canonicalInstitutionId && claim.proposedCanonical?.officialName) {
      const { educationSlug } = await import('../../../shared/education/taxonomy.js');
      const proposed = typeof claim.proposedCanonical.toObject === 'function'
        ? claim.proposedCanonical.toObject()
        : { ...claim.proposedCanonical };
      const officialName = String(proposed.officialName || '').trim();
      if (!officialName) {
        return res.status(422).json({ error: 'proposedCanonical.officialName is required to create a canonical institution' });
      }
      const allowedTypes = Object.values(INSTITUTION_TYPES);
      const org = await Organization.findById(claim.organizationId).select('organizationType').lean();
      const institutionType = allowedTypes.includes(proposed.institutionType)
        ? proposed.institutionType
        : (allowedTypes.includes(org?.organizationType) ? org.organizationType : INSTITUTION_TYPES.UNIVERSITY);
      let slug = educationSlug(officialName);
      const base = slug;
      let attempt = 0;
      while (await CanonicalInstitution.exists({ slug })) { attempt++; slug = `${base}-${attempt + 1}`; }
      const ci = await CanonicalInstitution.create({
        officialName,
        countryCode: proposed.countryCode || '',
        city: proposed.city || '',
        region: proposed.region || '',
        officialWebsite: proposed.officialWebsite || '',
        officialDomain: proposed.officialDomain || '',
        institutionType,
        isPublic: proposed.isPublic ?? null,
        slug,
        organizationId: claim.organizationId,
        status: 'draft',
      });
      claim.canonicalInstitutionId = ci._id;
      await Organization.findByIdAndUpdate(claim.organizationId, {});
    }
    if (claim.canonicalInstitutionId) {
      await CanonicalInstitution.findByIdAndUpdate(claim.canonicalInstitutionId, {
        organizationId: claim.organizationId,
      });
    }
  }

  if (targetState === CLAIM_STATES.NEEDS_INFORMATION) {
    claim.informationRequestReason = String(reason || '').trim();
    claim.rejectedReason = '';
  } else if (targetState === CLAIM_STATES.REJECTED) {
    claim.rejectedReason = String(reason || '').trim();
    claim.informationRequestReason = '';
  } else if (targetState === CLAIM_STATES.APPROVED || targetState === CLAIM_STATES.UNDER_REVIEW) {
    claim.informationRequestReason = '';
  }

  await claim.save();
  await logAudit({
    action: `institution_claim_${action}`,
    actor: { userId: req.user.userId, role: req.user.role },
    metadata: { claimId, organizationId: claim.organizationId, targetState },
  });

  const notifType = targetState === CLAIM_STATES.NEEDS_INFORMATION
    ? CANONICAL_CLAIM_NOTIFICATION_TYPES.NEEDS_INFORMATION
    : targetState === CLAIM_STATES.APPROVED
      ? CANONICAL_CLAIM_NOTIFICATION_TYPES.APPROVED
      : targetState === CLAIM_STATES.REJECTED
        ? CANONICAL_CLAIM_NOTIFICATION_TYPES.REJECTED
        : targetState === CLAIM_STATES.UNDER_REVIEW
          ? CANONICAL_CLAIM_NOTIFICATION_TYPES.SUBMITTED
          : null;
  if (notifType) {
    void emitCanonicalClaimNotifications({
      organizationId: claim.organizationId,
      claimId: claim._id,
      notificationType: notifType,
      transitionId: `${claim._id}:${fromState}:${targetState}:${claim.history.length}`,
    }).catch(() => {});
  }

  return res.status(200).json({ claim });
}));

adminInstitution.get('/conflicts', requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE), asyncHandler(async (req, res) => {
  const { InstitutionDataConflict } = await import('../models/institution/InstitutionDataConflict.js');
  const { state = 'open', page = 1, limit = 20 } = req.query;
  const safeLimit = Math.min(parseInt(limit), 50);
  const conflicts = await InstitutionDataConflict.find({ state })
    .sort({ createdAt: 1 })
    .skip((parseInt(page) - 1) * safeLimit)
    .limit(safeLimit)
    .lean();
  return res.status(200).json({ conflicts });
}));

adminInstitution.patch('/conflicts/:conflictId/resolve', requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE), asyncHandler(async (req, res) => {
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
}));

institutionPortalRouter.use('/admin/institution', adminInstitution);
