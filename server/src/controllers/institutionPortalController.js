/**
 * Institution Portal controller (Mission 18).
 *
 * All mutations enforce server-authoritative:
 *   - active membership
 *   - organization scoping
 *   - approved verification where required
 *   - approved canonical claim where required
 *   - program ownership
 *   - no cross-institution access
 *
 * Public projection helpers strip internal fields before responding.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { Organization } from '../models/Organization.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { ProgramRequirement } from '../models/education/ProgramRequirement.js';
import { TestAcceptance } from '../models/education/TestAcceptance.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { InstitutionMembership } from '../models/institution/InstitutionMembership.js';
import { InstitutionClaim } from '../models/institution/InstitutionClaim.js';
import { InstitutionProfile } from '../models/institution/InstitutionProfile.js';
import { InstitutionDataConflict } from '../models/institution/InstitutionDataConflict.js';
import { InstitutionChangeEvent } from '../models/institution/InstitutionChangeEvent.js';
import { logAudit } from '../services/auditService.js';
import * as portalService from '../services/institutionPortalService.js';
import {
  INSTITUTION_ROLES,
  CLAIM_STATES,
  CONFLICT_STATES,
  CHANGE_CATEGORIES,
  INSTITUTION_NOTIFICATION_TYPES,
  canSubmitOfficialChanges,
  canManageTeam,
} from '../../../shared/institution/institutionPortal.js';
import { PUB_STATUSES } from '../../../shared/education/taxonomy.js';
import { ACCEPTANCE_SCOPES } from '../../../shared/education/acceptanceExplorer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actor(req) {
  return {
    userId: req.institution?.institutionAccountId,
    role: 'institution',
    realm: 'institution',
    correlationId: req.headers['x-request-id'] || '',
  };
}

async function resolveMembershipOrFail(req, organizationId) {
  const membership = await portalService.resolveActiveMembership(
    req.institution.institutionAccountId,
    organizationId
  );
  if (!membership) {
    return null;
  }
  return membership;
}

// Safe public projection — strip internal fields
function publicInstitutionProjection(institution) {
  if (!institution) return null;
  const { _id, officialName, slug, countryCode, city, region, officialWebsite,
    officialDomain, institutionType, isPublic, status, organizationId } = institution;
  return { _id, officialName, slug, countryCode, city, region, officialWebsite,
    officialDomain, institutionType, isPublic, status, hasOrganizationManagement: !!organizationId };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const getDashboard = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const claim = await portalService.resolveApprovedClaim(organizationId);
  const metrics = await portalService.getDashboardMetrics(organizationId, claim?.canonicalInstitutionId || null);

  return res.status(200).json({ organizationId, membership: { role: membership.role }, ...metrics });
});

// ---------------------------------------------------------------------------
// Organization verification (reuse Mission 2 routes)
// Institution-specific onboarding completeness check
// ---------------------------------------------------------------------------

export const getOnboardingStatus = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const [verification, claim, profile] = await Promise.all([
    portalService.resolveVerification(organizationId),
    InstitutionClaim.findOne({ organizationId }).lean(),
    InstitutionProfile.findOne({ organizationId }).lean(),
  ]);

  const stages = [
    { stage: 'account', complete: true },
    { stage: 'organization_identity', complete: !!(profile?.officialDisplayName || profile?.legalName) },
    { stage: 'official_website', complete: !!profile?.officialWebsite },
    { stage: 'location', complete: !!(profile?.addresses?.length > 0) },
    { stage: 'verification_evidence', complete: verification?.status !== 'draft' },
    { stage: 'canonical_claim', complete: !!(claim?.state === CLAIM_STATES.SUBMITTED || claim?.state === CLAIM_STATES.APPROVED) },
    { stage: 'verification_submitted', complete: !!(verification?.status === 'verification_pending' || verification?.status === 'under_review' || verification?.status === 'approved') },
    { stage: 'approved', complete: verification?.status === 'approved' },
  ];

  return res.status(200).json({
    organizationId,
    verificationStatus: verification?.status || 'draft',
    claimState: claim?.state || null,
    completenessScore: profile?.completenessScore || 0,
    stages,
    // Pre-approval restrictions documented (not enforced here — service layer enforces)
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getProfile = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const profile = await portalService.getOrCreateProfile(organizationId);
  return res.status(200).json({ profile });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to update profile' });
  }

  const profile = await portalService.updateProfile({
    organizationId,
    updates: req.body,
    actor: actor(req),
    membership,
  });
  return res.status(200).json({ profile });
});

// ---------------------------------------------------------------------------
// Canonical institution claim
// ---------------------------------------------------------------------------

export const startClaim = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to start a claim' });
  }

  const { canonicalInstitutionId, proposedCanonical, authorityEvidenceRefs } = req.body;

  const claim = await portalService.startClaim({
    organizationId,
    representativeAccountId: req.institution.institutionAccountId,
    canonicalInstitutionId: canonicalInstitutionId || null,
    proposedCanonical: proposedCanonical || null,
    authorityEvidenceRefs: authorityEvidenceRefs || [],
    actor: actor(req),
  });

  return res.status(201).json({ claim });
});

export const submitClaim = asyncHandler(async (req, res) => {
  const { organizationId, claimId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to submit claim' });
  }

  const claim = await portalService.submitClaim({ claimId, organizationId, actor: actor(req) });
  return res.status(200).json({ claim });
});

export const getClaim = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const claim = await InstitutionClaim.findOne({ organizationId }).lean();
  return res.status(200).json({ claim: claim || null });
});

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export const listPrograms = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const claim = await portalService.resolveApprovedClaim(organizationId);
  if (!claim?.canonicalInstitutionId) {
    return res.status(200).json({ programs: [], message: 'No approved canonical institution claim' });
  }

  const { status, page = 1, limit = 20 } = req.query;
  const safeLimit = Math.min(parseInt(limit), 50);
  const query = { institutionId: claim.canonicalInstitutionId };
  if (status) query.status = status;

  const programs = await Program.find(query)
    .sort({ createdAt: -1 })
    .skip((parseInt(page) - 1) * safeLimit)
    .limit(safeLimit)
    .lean();

  return res.status(200).json({ programs });
});

export const createProgram = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to create programs' });
  }

  const claim = await portalService.assertApprovedClaim(organizationId);
  await portalService.assertApprovedVerification(organizationId);

  const program = await portalService.createProgramDraft({
    organizationId,
    canonicalInstitutionId: claim.canonicalInstitutionId,
    programData: req.body,
    actor: actor(req),
  });

  return res.status(201).json({ program });
});

export const getProgram = asyncHandler(async (req, res) => {
  const { organizationId, programId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const claim = await portalService.resolveApprovedClaim(organizationId);
  if (!claim) return res.status(403).json({ error: 'No approved claim' });

  const program = await Program.findById(programId).lean();
  if (!program) return res.status(404).json({ error: 'Program not found' });
  if (program.institutionId.toString() !== claim.canonicalInstitutionId.toString()) {
    return res.status(403).json({ error: 'Program does not belong to this institution' });
  }

  return res.status(200).json({ program });
});

export const updateProgram = asyncHandler(async (req, res) => {
  const { organizationId, programId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to update programs' });
  }

  const claim = await portalService.assertApprovedClaim(organizationId);

  const program = await portalService.updateProgram({
    programId,
    organizationId,
    canonicalInstitutionId: claim.canonicalInstitutionId,
    updates: req.body,
    actor: actor(req),
    membershipRole: membership.role,
  });

  return res.status(200).json({ program });
});

export const submitProgram = asyncHandler(async (req, res) => {
  const { organizationId, programId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to submit programs' });
  }

  const claim = await portalService.assertApprovedClaim(organizationId);

  const program = await portalService.submitProgramForReview({
    programId, organizationId,
    canonicalInstitutionId: claim.canonicalInstitutionId,
    actor: actor(req),
  });

  return res.status(200).json({ program });
});

// ---------------------------------------------------------------------------
// Test Acceptance (institution/program scope only)
// ---------------------------------------------------------------------------

export const createTestAcceptance = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const claim = await portalService.assertApprovedClaim(organizationId);
  await portalService.assertApprovedVerification(organizationId);

  const { programId, ...testAcceptanceData } = req.body;

  const ta = await portalService.createOrUpdateTestAcceptance({
    organizationId,
    canonicalInstitutionId: claim.canonicalInstitutionId,
    programId: programId || null,
    testAcceptanceData,
    actor: actor(req),
  });

  return res.status(201).json({ testAcceptance: ta });
});

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export const createRequirement = asyncHandler(async (req, res) => {
  const { organizationId, programId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const claim = await portalService.assertApprovedClaim(organizationId);
  await portalService.assertProgramOwnership(programId, claim.canonicalInstitutionId);

  const { requirementType, semantics, conditionNote, testId, minimumScore,
    sectionMinimums, subjectName, documentName, description, intake,
    effectiveFrom, effectiveTo } = req.body;

  if (!requirementType || !semantics) {
    return res.status(400).json({ error: 'requirementType and semantics are required' });
  }

  const requirement = await ProgramRequirement.create({
    programId,
    requirementType, semantics, conditionNote, testId, minimumScore,
    sectionMinimums, subjectName, documentName, description, intake,
    effectiveFrom, effectiveTo,
    sources: [{ sourceType: 'institution_official' }],
  });

  await logAudit({
    action: 'institution_requirement_created',
    actor: actor(req),
    metadata: { organizationId, programId, requirementId: requirement._id },
  });

  return res.status(201).json({ requirement });
});

// ---------------------------------------------------------------------------
// Freshness reconfirmation
// ---------------------------------------------------------------------------

export const reconfirmFreshness = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canSubmitOfficialChanges(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const claim = await portalService.resolveApprovedClaim(organizationId);
  const { programId, reconfirmationNote, sourceUrl } = req.body;

  await portalService.reconfirmFreshness({
    organizationId,
    canonicalInstitutionId: claim?.canonicalInstitutionId || null,
    programId: programId || null,
    reconfirmationNote: reconfirmationNote || '',
    sourceUrl: sourceUrl || '',
    actor: actor(req),
    membershipRole: membership.role,
  });

  return res.status(200).json({ message: 'Freshness reconfirmed and audited' });
});

// ---------------------------------------------------------------------------
// Data quality / conflicts
// ---------------------------------------------------------------------------

export const getDataConflicts = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const conflicts = await InstitutionDataConflict.find({
    organizationId,
    state: { $in: [CONFLICT_STATES.OPEN, CONFLICT_STATES.UNDER_REVIEW] },
  }).lean();

  return res.status(200).json({ conflicts });
});

export const getChangeHistory = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const { limit = 50, page = 1 } = req.query;
  const safeLimit = Math.min(parseInt(limit), 100);
  const skip = (parseInt(page) - 1) * safeLimit;

  const events = await InstitutionChangeEvent.find({ organizationId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();

  return res.status(200).json({ events });
});

// ---------------------------------------------------------------------------
// Team management
// ---------------------------------------------------------------------------

export const getTeam = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });

  const members = await InstitutionMembership.find({ organizationId, active: true })
    .populate('institutionAccountId', 'email lastLoginAt createdAt')
    .lean();

  // Never expose private security data — only email and join metadata
  const safe = members.map((m) => ({
    _id: m._id,
    role: m.role,
    joinedAt: m.joinedAt,
    account: m.institutionAccountId
      ? { email: m.institutionAccountId.email, lastLoginAt: m.institutionAccountId.lastLoginAt }
      : null,
  }));

  return res.status(200).json({ members: safe });
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { organizationId, memberId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canManageTeam(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to manage team' });
  }

  const { role } = req.body;
  if (!Object.values(INSTITUTION_ROLES).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const target = await InstitutionMembership.findOne({ _id: memberId, organizationId, active: true });
  if (!target) return res.status(404).json({ error: 'Membership not found' });

  // Owner cannot be demoted by admin (only owner can demote themselves)
  if (target.role === INSTITUTION_ROLES.OWNER && membership.role !== INSTITUTION_ROLES.OWNER) {
    return res.status(403).json({ error: 'Only an owner can change another owner\'s role' });
  }

  target.role = role;
  await target.save();

  await logAudit({
    action: 'institution_team_role_updated',
    actor: actor(req),
    metadata: { organizationId, memberId, newRole: role },
  });

  return res.status(200).json({ membership: { _id: target._id, role: target.role } });
});

export const revokeMember = asyncHandler(async (req, res) => {
  const { organizationId, memberId } = req.params;
  const membership = await resolveMembershipOrFail(req, organizationId);
  if (!membership) return res.status(403).json({ error: 'Active membership required' });
  if (!canManageTeam(membership.role)) {
    return res.status(403).json({ error: 'Insufficient role to revoke members' });
  }

  const target = await InstitutionMembership.findOne({ _id: memberId, organizationId, active: true });
  if (!target) return res.status(404).json({ error: 'Membership not found' });
  if (target.role === INSTITUTION_ROLES.OWNER) {
    return res.status(403).json({ error: 'Owner membership cannot be revoked this way' });
  }

  target.active = false;
  target.revokedAt = new Date();
  target.revokedBy = req.institution.institutionAccountId;
  await target.save();

  await logAudit({
    action: 'institution_team_member_revoked',
    actor: actor(req),
    metadata: { organizationId, memberId },
  });

  return res.status(200).json({ message: 'Membership revoked' });
});

// ---------------------------------------------------------------------------
// Public institution profile (safe projection)
// ---------------------------------------------------------------------------

export const getPublicInstitutionProfile = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const institution = await CanonicalInstitution.findOne({ slug, status: PUB_STATUSES.PUBLISHED }).lean();
  if (!institution) return res.status(404).json({ error: 'Institution not found' });

  // Check for verified organization management
  let verifiedManagement = null;
  if (institution.organizationId) {
    const verification = await portalService.resolveVerification(institution.organizationId);
    if (verification?.status === 'approved') {
      const claim = await portalService.resolveApprovedClaim(institution.organizationId);
      if (claim) {
        verifiedManagement = {
          officialDataSupplied: true,
          sourceType: 'institution_official',
          note: 'Official information supplied/confirmed by this institution',
        };
      }
    }
  }

  // Public programs (published only)
  const programs = await Program.find({ institutionId: institution._id, status: PUB_STATUSES.PUBLISHED })
    .select('name slug degreeLevel field studyMode durationMonths country campus officialProgramUrl tuition intakes lastVerifiedAt freshnessState')
    .limit(20)
    .lean();

  return res.status(200).json({
    institution: publicInstitutionProjection(institution),
    verifiedManagement,
    programs,
    // No trust badges beyond what Mission 2 evidence supports
  });
});

// ---------------------------------------------------------------------------
// Public institution directory
// ---------------------------------------------------------------------------

export const searchInstitutionDirectory = asyncHandler(async (req, res) => {
  const { name, countryCode, institutionType, page = 1, limit = 20 } = req.query;
  // Bounded pagination — no fake rankings
  const result = await portalService.searchPublicInstitutions({
    name, countryCode, institutionType,
    page: parseInt(page),
    limit: Math.min(parseInt(limit) || 20, 50),
  });

  return res.status(200).json(result);
});
