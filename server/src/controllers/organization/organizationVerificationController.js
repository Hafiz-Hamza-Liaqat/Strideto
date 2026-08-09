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

/**
 * Derive actor from request. Supports future org realm; for now also handles
 * admin actors acting on behalf of an organization (e.g. onboarding support).
 */
function actor(req, organizationId) {
  return {
    userId: req.user?.userId || req.employer?.employerId,
    role: req.user?.role || 'employer',
    realm: req.user ? 'admin' : 'employer',
    correlationId: req.headers['x-request-id'] || '',
  };
}

/**
 * Resolve and verify that the authenticated actor may access the given
 * organizationId. For now:
 *   - Admin/staff may access any.
 *   - Employer may only access the Organization linked to their employerId.
 */
async function assertOwnership(req, organizationId) {
  // Admin/staff bypass — they have VERIFICATION_READ permission (route guards ensure this)
  if (req.user?.role) return;

  // Employer: must be linked via legacyEmployerId
  if (req.employer?.employerId) {
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
      submittedAt: e.submittedAt,
      rejectionReason: e.status === 'rejected' ? e.rejectionReason : undefined,
      expiresAt: e.expiresAt,
    }));

    return res.json({
      status: record.status,
      submittedAt: record.submittedAt,
      informationRequestReason: record.informationRequestReason || '',
      rejectionReason: record.rejectionReason || '',
      earnedBadges: record.earnedBadges || [],
      verifiedAt: record.verifiedAt,
      nextReviewAt: record.nextReviewAt,
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

    const { profile } = req.body;
    if (!profile || typeof profile !== 'object') {
      return res.status(422).json({ error: 'profile is required' });
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

    const { profile } = req.body;
    if (!profile || typeof profile !== 'object') {
      return res.status(422).json({ error: 'profile is required' });
    }

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
