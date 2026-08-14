/**
 * organizationVerificationController — Organization-side verification status
 * and submission surface (Mission 2).
 *
 * This controller is the reusable surface that future Agent/Institution portals
 * will also use. For now it enforces ownership via the authenticated organization
 * record — no cross-organization access.
 *
 * NOTE: No organization auth realm exists yet (future mission). This controller
 * is structured for when that realm lands. For now, Admin-level callers may
 * also access it for testing. The organization ownership check is performed
 * against the profile's organizationId field.
 */
import * as verificationService from '../../services/verificationService.js';
import { resolveCredentialPolicy } from '../../services/credentialPolicyService.js';
import { Organization } from '../../models/Organization.js';
import { AgentProfile } from '../../models/agent/AgentProfile.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { EmployerMembership } from '../../models/employer/EmployerMembership.js';
import { InstitutionMembership } from '../../models/institution/InstitutionMembership.js';
import { employerRoleHasCapability, EMPLOYER_CAPABILITIES } from '../../../../shared/employer/team.js';
import { Employer } from '../../models/Employer.js';
import { AgentAccount } from '../../models/agent/AgentAccount.js';
import { InstitutionAccount } from '../../models/institution/InstitutionAccount.js';
import { isB2bEmailVerificationRequired } from '../../services/auth/realmEmailVerification.js';
import { canonicalizeStoredPhone } from '../../../../shared/international/phone.js';

async function prepareAgentSubmission(req, organizationId) {
  if (!req.agent?.agentAccountId) return;
  const record = await verificationService.getVerification(organizationId);
  if (record.status !== 'draft') return;
  // Authenticated Agent session is sufficient to leave draft → email_verified,
  // matching Employer Phase 4. This is account-session proof, not professional verification.
  await verificationService.markEmailVerified(organizationId, actor(req, organizationId));
}

/**
 * Derive actor from request. Supports future org realm; for now also handles
 * admin actors acting on behalf of an organization (e.g. onboarding support).
 */
function normalizeVerificationProfile(profile) {
  const next = { ...profile };
  delete next.phoneVerified;
  delete next.phoneCountry;
  delete next.trustStatus;
  delete next.verificationStatus;
  if (next.authorizedRepresentative && typeof next.authorizedRepresentative === 'object') {
    const rep = next.authorizedRepresentative;
    next.representativeRole = next.representativeRole || rep.title || '';
    next.representativeAuthorizationRef = next.representativeAuthorizationRef || rep.authority || '';
    next.authorizedRepresentative = rep.fullName || '';
  }
  if (next.officialPhone && !next.phone) next.phone = next.officialPhone;
  const phoneResult = canonicalizeStoredPhone(next.phone);
  if (!phoneResult.ok) {
    throw Object.assign(new Error(phoneResult.error), { status: 400 });
  }
  next.phone = phoneResult.value;
  delete next.officialPhone;
  return next;
}

function actor(req, _organizationId) {
  return {
    userId: req.user?.userId || req.employer?.employerId || req.agent?.agentAccountId || req.institution?.institutionAccountId,
    role: req.user?.role || (req.institution ? 'institution' : req.agent ? 'agent' : 'employer'),
    realm: req.user ? 'admin' : (req.institution ? 'institution' : req.agent ? 'agent' : 'employer'),
    correlationId: req.headers['x-request-id'] || '',
  };
}

/**
 * Resolve and verify that the authenticated actor may access the given
 * organizationId. For now:
 *   - Admin/staff may access any.
 *   - Employer may only access the Organization linked to their employerId.
 */
const STAFF_VERIFICATION_ROLES = new Set(['Admin', 'SuperAdmin', 'Editor', 'Moderator']);

async function assertAccountEmailVerified(req) {
  if (STAFF_VERIFICATION_ROLES.has(req.user?.role)) return;
  let account = null;
  if (req.employer?.employerId) {
    account = await Employer.findById(req.employer.employerId).select('emailVerified createdAt').lean();
  } else if (req.agent?.agentAccountId) {
    account = await AgentAccount.findById(req.agent.agentAccountId).select('emailVerified createdAt').lean();
  } else if (req.institution?.institutionAccountId) {
    account = await InstitutionAccount.findById(req.institution.institutionAccountId).select('emailVerified createdAt').lean();
  }
  if (isB2bEmailVerificationRequired(account)) {
    throw Object.assign(new Error('Verify your email before this action'), {
      status: 403,
      code: 'email_verification_required',
    });
  }
}

async function assertOwnership(req, organizationId) {
  // Staff support bypass only — ordinary User/Student tokens must not read
  // another organization's verification dossier.
  if (STAFF_VERIFICATION_ROLES.has(req.user?.role)) return;

  // Employer: active membership in this organization, or legacy owner link.
  if (req.employer?.employerId) {
    const membership = await EmployerMembership.findOne({
      organizationId,
      employerId: req.employer.employerId,
      active: true,
    }).select('role');
    if (membership) {
      if (!employerRoleHasCapability(membership.role, EMPLOYER_CAPABILITIES.VERIFICATION_READ)) {
        throw Object.assign(
          new Error('Access denied: verification is not permitted for this role'),
          { code: 'FORBIDDEN', status: 403 }
        );
      }
      return;
    }
    const org = await Organization.findOne({
      _id: organizationId,
      legacyEmployerId: req.employer.employerId,
    }).select('_id');
    if (!org) {
      throw Object.assign(
        new Error('Access denied: organization does not belong to this account'),
        { code: 'FORBIDDEN', status: 403 }
      );
    }
    return;
  }

  // Agent realm: the profile link and an active organization membership must
  // both match. This prevents stale or cross-agency profile links from being
  // used as authorization.
  if (req.agent?.agentAccountId) {
    const profile = await AgentProfile.findOne({
      agentAccountId: req.agent.agentAccountId,
      organizationId,
    }).select('_id');
    const membership = await AgentMembership.findOne({
      agentAccountId: req.agent.agentAccountId,
      organizationId,
      active: true,
    }).select('_id');
    if (!profile || !membership) {
      throw Object.assign(
        new Error('Access denied: organization does not belong to this account'),
        { code: 'FORBIDDEN', status: 403 }
      );
    }
    return;
  }

  if (req.institution?.institutionAccountId) {
    const membership = await InstitutionMembership.findOne({
      organizationId,
      institutionAccountId: req.institution.institutionAccountId,
      active: true,
    }).select('_id');
    if (!membership) {
      throw Object.assign(
        new Error('Access denied: organization does not belong to this account'),
        { code: 'FORBIDDEN', status: 403 }
      );
    }
    return;
  }

  throw Object.assign(new Error('Authentication required'), { code: 'UNAUTHENTICATED', status: 401 });
}

/** GET /organizations/:organizationId/verification */
export async function getVerificationStatus(req, res) {
  try {
    const { organizationId } = req.params;
    await assertOwnership(req, organizationId);

    const record = await verificationService.getVerification(organizationId);
    const evidence = await verificationService.getEvidence(organizationId);

    // Safe projection: never expose reviewer internals to the org side
    const safeEvidence = evidence.map((e) => ({
      _id: e._id,
      evidenceType: e.evidenceType,
      status: e.status,
      sourceUrl: e.sourceUrl || '',
      claimedAuthority: e.claimedAuthority || '',
      submittedAt: e.submittedAt,
      rejectionReason: e.status === 'rejected' ? e.rejectionReason : undefined,
      expiresAt: e.expiresAt,
      reviewedAt: e.reviewedAt,
    }));

    return res.json({
      status: record.status,
      submittedAt: record.submittedAt,
      informationRequestReason: record.informationRequestReason || '',
      rejectionReason: record.rejectionReason || '',
      earnedBadges: record.earnedBadges || [],
      verifiedAt: record.verifiedAt,
      nextReviewAt: record.nextReviewAt,
      profile: record.profile || {},
      evidence: safeEvidence,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/** POST /organizations/:organizationId/verification/submit */
export async function submitVerification(req, res) {
  try {
    const { organizationId } = req.params;
    await assertOwnership(req, organizationId);
    await assertAccountEmailVerified(req);
    if (req.employer?.employerId) {
      const membership = await EmployerMembership.findOne({
        organizationId,
        employerId: req.employer.employerId,
        active: true,
      }).select('role');
      const role = membership?.role;
      if (role && !employerRoleHasCapability(role, EMPLOYER_CAPABILITIES.VERIFICATION_SUBMIT)) {
        return res.status(403).json({ error: 'Verification submission is not permitted for this role' });
      }
    }

    const { profile: rawProfile } = req.body;
    if (!rawProfile || typeof rawProfile !== 'object') {
      return res.status(422).json({ error: 'profile is required' });
    }
    const profile = normalizeVerificationProfile(rawProfile);

    await prepareAgentSubmission(req, organizationId);
    if (req.employer?.employerId || req.institution?.institutionAccountId) {
      const current = await verificationService.getVerification(organizationId);
      if (current.status === 'draft') {
        await verificationService.markEmailVerified(organizationId, actor(req, organizationId));
      }
    }

    const updated = await verificationService.submitVerification(
      organizationId,
      profile,
      actor(req, organizationId)
    );

    // Include credential policy hint for the org's context
    const credentialPolicy = resolveCredentialPolicy({
      organizationType: updated.organizationType,
      countryCode: updated.countryCode || profile.countryCode,
    });

    return res.json({
      status: updated.status,
      submittedAt: updated.submittedAt,
      slaDeadlineAt: updated.slaDeadlineAt,
      credentialPolicyHint: credentialPolicy,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/** POST /organizations/:organizationId/verification/evidence */
export async function addEvidence(req, res) {
  try {
    const { organizationId } = req.params;
    await assertOwnership(req, organizationId);
    await assertAccountEmailVerified(req);

    const evidence = await verificationService.addEvidence(
      organizationId,
      req.body,
      actor(req, organizationId)
    );

    return res.status(201).json({
      evidenceId: evidence._id,
      evidenceType: evidence.evidenceType,
      status: evidence.status,
      submittedAt: evidence.submittedAt,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * POST /organizations/:organizationId/verification/respond
 * Re-submit after a needs_information request.
 */
export async function respondToInformationRequest(req, res) {
  try {
    const { organizationId } = req.params;
    await assertOwnership(req, organizationId);
    await assertAccountEmailVerified(req);

    const { profile: rawProfile } = req.body;
    if (!rawProfile || typeof rawProfile !== 'object') {
      return res.status(422).json({ error: 'profile is required' });
    }
    const profile = normalizeVerificationProfile(rawProfile);

    await prepareAgentSubmission(req, organizationId);

    const updated = await verificationService.submitVerification(
      organizationId,
      profile,
      actor(req, organizationId)
    );

    return res.json({
      status: updated.status,
      submittedAt: updated.submittedAt,
      slaDeadlineAt: updated.slaDeadlineAt,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/** GET /organizations/:organizationId/verification/credential-policy */
export async function getCredentialPolicy(req, res) {
  try {
    const { organizationId } = req.params;
    await assertOwnership(req, organizationId);

    const org = await Organization.findById(organizationId).select('organizationType countryCode');
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const policy = resolveCredentialPolicy({
      organizationType: org.organizationType,
      countryCode: org.countryCode,
    });

    return res.json({ credentialPolicy: policy });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
