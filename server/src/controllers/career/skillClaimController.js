/**
 * Skill claim / evidence / verification HTTP surface.
 *
 * Every handler derives the acting identity from the authenticated session
 * (`req.user` / `req.employer`), never from the request body. A body that
 * mentions a trust-bearing field is rejected by the service rather than
 * silently trimmed, so an attempt to self-verify is visible in logs instead of
 * being quietly ignored.
 *
 * Status semantics:
 *   201 claim/evidence created
 *   200 read + accepted transitions
 *   400 malformed body
 *   401 unauthenticated
 *   403 wrong realm / not owner / missing permission / trust field supplied
 *   404 unknown claim, and any claim belonging to another user
 *   409 illegal state transition, duplicate claim
 *   422 validation failure (bad URL, missing method/reason/evidence, bounds)
 */
import { asyncHandler } from '../../utils/asyncHandler.js';
import { skillVerificationService } from '../../services/career/SkillVerificationService.js';
import {
  SKILL_CLAIM_STATUSES,
  VERIFICATION_METHODS,
  isEnabledVerificationMethod,
} from '../../../../shared/career/skillVerification.js';

/** Server-derived principal. The body cannot contribute to this. */
function actorFromRequest(req) {
  if (req.user) {
    return { id: req.user.userId, role: req.user.role, realm: 'user' };
  }
  if (req.employer) {
    return { id: req.employer.employerId, role: 'employer', realm: 'employer' };
  }
  if (req.agent) {
    return { id: req.agent.subjectId, role: 'agent', realm: 'agent' };
  }
  if (req.institution) {
    return { id: req.institution.subjectId, role: 'institution', realm: 'institution' };
  }
  return null;
}

function sendFailure(res, result) {
  return res.status(result.status || 400).json({
    error: result.message,
    code: result.code,
    ...(result.fields ? { fields: result.fields } : {}),
  });
}

// ---------------------------------------------------------------------------
// Applicant
// ---------------------------------------------------------------------------

export const createSkillClaim = asyncHandler(async (req, res) => {
  const result = await skillVerificationService.createClaim({
    userId: req.user.userId,
    payload: req.body,
    correlationId: req.id ?? '',
  });
  if (!result.ok) return sendFailure(res, result);
  return res.status(201).json({
    data: {
      id: String(result.claim._id),
      skillName: result.claim.skillName,
      skillCategory: result.claim.skillCategory,
      claimedLevel: result.claim.claimedLevel,
      trustState: result.claim.status,
      evidenceCount: 0,
    },
  });
});

export const listMySkillClaims = asyncHandler(async (req, res) => {
  const claims = await skillVerificationService.listOwnClaims({
    userId: req.user.userId,
    limit: req.query.limit,
  });
  return res.json({ data: claims });
});

export const addSkillEvidence = asyncHandler(async (req, res) => {
  const result = await skillVerificationService.addEvidence({
    userId: req.user.userId,
    claimId: req.params.claimId,
    payload: req.body,
    correlationId: req.id ?? '',
  });
  if (!result.ok) return sendFailure(res, result);
  return res.status(201).json({
    data: {
      id: String(result.evidence._id),
      evidenceType: result.evidence.evidenceType,
      url: result.evidence.url,
      hostname: result.evidence.hostname,
      provider: result.evidence.provider,
      description: result.evidence.description,
      status: result.evidence.status,
    },
    // Named explicitly so no client can mistake "submitted" for "verified".
    trustState: result.claim.status,
  });
});

export const submitSkillClaimForReview = asyncHandler(async (req, res) => {
  const result = await skillVerificationService.submitForReview({
    userId: req.user.userId,
    claimId: req.params.claimId,
    correlationId: req.id ?? '',
  });
  if (!result.ok) return sendFailure(res, result);
  return res.json({ data: { trustState: result.claim.status } });
});

export const getSkillClaimHistory = asyncHandler(async (req, res) => {
  const result = await skillVerificationService.getClaimHistory({
    claimId: req.params.claimId,
    actor: actorFromRequest(req),
  });
  if (!result.ok) return sendFailure(res, result);
  return res.json({ data: result.history });
});

// ---------------------------------------------------------------------------
// Employer (read-only — an employer can never write trust state)
// ---------------------------------------------------------------------------

export const getApplicantSkillsForEmployer = asyncHandler(async (req, res) => {
  // Scoped to applicants who applied to this employer's own jobs.
  const allowed = await skillVerificationService.assertEmployerMayViewApplicant({
    employerId: req.employer.employerId,
    applicantUserId: req.params.applicantId,
  });
  if (!allowed.ok) return sendFailure(res, allowed);

  const claims = await skillVerificationService.listClaimsForEmployer({
    applicantUserId: req.params.applicantId,
    // Filter value is validated server-side; trust state is always recomputed
    // from stored records, never taken from the query.
    trustFilter: req.query.trust ?? 'any',
    skill: req.query.skill ?? '',
  });
  return res.json({ data: claims });
});

// ---------------------------------------------------------------------------
// Reviewer (staff)
// ---------------------------------------------------------------------------

/**
 * Record a verification decision. The target status is explicit in the body so
 * approve / evidence-back / reject / needs-info / revoke all travel the same
 * audited path; each maps to a different required permission.
 */
export const recordSkillVerification = asyncHandler(async (req, res) => {
  const { toStatus, method, reason, evidenceRefs, expiresAt } = req.body ?? {};
  const result = await skillVerificationService.recordVerificationDecision({
    actor: actorFromRequest(req),
    claimId: req.params.claimId,
    toStatus,
    method,
    reason,
    evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs : [],
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    correlationId: req.id ?? '',
  });
  if (!result.ok) return sendFailure(res, result);
  return res.json({
    data: {
      trustState: result.claim.status,
      verificationScore: result.claim.verificationScore,
      verificationMethod: result.claim.verificationMethod,
      verifiedAt: result.claim.verifiedAt,
      expiresAt: result.claim.expiresAt,
    },
  });
});

/**
 * The reviewer's work queue. Read-only: seeing a claim here grants no authority
 * to decide it — that still requires the per-outcome permission.
 */
export const listSkillClaimsForReview = asyncHandler(async (req, res) => {
  const result = await skillVerificationService.listClaimsForReview({
    actor: actorFromRequest(req),
    status: req.query.status ?? '',
    limit: req.query.limit,
  });
  if (!result.ok) return sendFailure(res, result);
  return res.json({ data: result.claims });
});

/** Statuses a reviewer endpoint will accept, for client discovery. */
export const getSkillVerificationOptions = asyncHandler(async (_req, res) => {
  return res.json({
    data: {
      reviewableStatuses: [
        SKILL_CLAIM_STATUSES.EVIDENCE_BACKED,
        SKILL_CLAIM_STATUSES.VERIFIED,
        SKILL_CLAIM_STATUSES.NEEDS_INFORMATION,
        SKILL_CLAIM_STATUSES.REJECTED,
        SKILL_CLAIM_STATUSES.REVOKED,
      ],
      // Only methods this release will actually accept. Deferred ones
      // (practical assessment, automated provider check) are withheld rather
      // than offered and then refused.
      methods: Object.values(VERIFICATION_METHODS).filter(isEnabledVerificationMethod),
    },
  });
});
