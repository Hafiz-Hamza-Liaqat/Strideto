/**
 * SkillVerificationService — the only writer of skill trust state.
 *
 * Trust rule enforced here, once, for every caller:
 *
 *     CLAIMED != VERIFIED       EVIDENCE SUBMITTED != VERIFIED
 *
 * The authorization decision is a pure function (`authorizeClaimTransition`)
 * deliberately separated from persistence, so the security matrix can be
 * exercised exhaustively without a database — which is how it is tested.
 * Every DB-mutating function below routes through it; there is no second path
 * to a verified claim.
 *
 * Denied by construction, not by convention:
 *   - applicants cannot verify themselves, set a score, or name a verifier
 *   - employers cannot verify or fabricate an applicant's status
 *   - Copilot/AI cannot issue verification (no realm it can present qualifies)
 *   - staff without the specific permission cannot approve
 *   - even a SuperAdmin cannot verify their OWN claim
 *   - no verification exists without method + reason + evidence + actor + time
 *
 * NO NETWORK. Evidence links are validated structurally and stored. This module
 * imports no http client and performs no fetch — asserted by the QA suite.
 */
import mongoose from 'mongoose';
import { UserSkillClaim } from '../../models/career/UserSkillClaim.js';
import { SkillEvidence, SKILL_EVIDENCE_STATUSES } from '../../models/career/SkillEvidence.js';
import { SkillVerification } from '../../models/career/SkillVerification.js';
import { SkillVerificationHistory } from '../../models/career/SkillVerificationHistory.js';
import { Application } from '../../models/Application.js';
import { Job } from '../../models/Job.js';
import { hasPermission, isStaffRole } from '../../config/rbac.js';
import {
  SKILL_CLAIM_STATUSES,
  SKILL_CLAIM_LIMITS,
  TRANSITION_ACTORS,
  isValidClaimStatus,
  isValidClaimTransition,
  getTransitionRequirements,
  isEnabledVerificationMethod,
  isValidVerificationMethod,
  isValidSkillEvidenceType,
  validateEvidenceUrl,
  validateEvidenceDescription,
  validateSkillName,
  computeVerificationScore,
  deriveCurrentTrustState,
  buildSkillSnapshot,
  projectClaimForEmployer,
  projectClaimForPublic,
  matchesTrustFilter,
  extractApplicantInput,
  APPLICANT_CLAIM_INPUT_FIELDS,
  APPLICANT_EVIDENCE_INPUT_FIELDS,
} from '../../../../shared/career/skillVerification.js';

const S = SKILL_CLAIM_STATUSES;

/** Realms that may ever act on a skill claim. Everything else is refused. */
const USER_REALM = 'user';

function fail(code, status, message, extra = {}) {
  return { ok: false, code, status, message, ...extra };
}

// ---------------------------------------------------------------------------
// Authorization — pure, DB-free, exhaustively testable
// ---------------------------------------------------------------------------

/**
 * Decide whether `actor` may move `claim` to `toStatus`, and whether they
 * supplied everything such a move requires.
 *
 * @param {object}  args
 * @param {object}  args.claim        stored claim (status + userId are what matter)
 * @param {string}  args.toStatus     target status
 * @param {object}  args.actor        server-derived principal:
 *                                    { id, role, realm, isSystem? }
 * @param {string}  [args.method]     verification method (reviewer actions)
 * @param {string}  [args.reason]     justification (reviewer actions)
 * @param {Array}   [args.evidenceRefs] evidence backing a trust grant
 *
 * Time-independent by design: whether an actor *may* make a move never depends
 * on the clock. Expiry is a separate, later check in `applyExpiry`, and read
 * paths derive expiry themselves via `deriveCurrentTrustState`.
 *
 * @returns {{ ok: true, actorClass: string, requirements: object }
 *          | { ok: false, code: string, status: number, message: string }}
 */
export function authorizeClaimTransition({ claim, toStatus, actor, method, reason, evidenceRefs } = {}) {
  if (!claim || !isValidClaimStatus(claim.status)) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }
  if (!actor || !actor.realm) {
    return fail('ACTOR_REQUIRED', 401, 'Authentication required');
  }
  if (!isValidClaimStatus(toStatus)) {
    return fail('INVALID_STATUS', 400, 'Unknown target status');
  }

  const requirements = getTransitionRequirements(toStatus);
  if (!requirements) {
    return fail('INVALID_STATUS', 400, 'Unknown target status');
  }

  // The state machine gates first: an illegal move is illegal for everyone,
  // including SuperAdmin. Revoked is terminal.
  if (!isValidClaimTransition(claim.status, toStatus)) {
    return fail(
      'INVALID_TRANSITION',
      409,
      `Cannot move a skill claim from '${claim.status}' to '${toStatus}'`
    );
  }

  const isOwner =
    Boolean(actor.id) && Boolean(claim.userId) && String(actor.id) === String(claim.userId);

  // -- System transitions (expiry) are internal-only ------------------------
  if (requirements.actor === TRANSITION_ACTORS.SYSTEM) {
    if (actor.isSystem !== true) {
      return fail('SYSTEM_ONLY', 403, 'This transition is applied by platform policy, not by a caller');
    }
    return { ok: true, actorClass: TRANSITION_ACTORS.SYSTEM, requirements };
  }

  // Only the Student/staff realm participates at all. An employer, agent or
  // institution token — and anything presenting an AI/service realm — is
  // refused before any permission is consulted.
  if (actor.realm !== USER_REALM) {
    return fail('REALM_NOT_PERMITTED', 403, 'This account type cannot act on skill claims');
  }

  // -- Applicant transitions ------------------------------------------------
  if (requirements.actor === TRANSITION_ACTORS.APPLICANT) {
    if (!isOwner) {
      return fail('NOT_CLAIM_OWNER', 403, 'You can only manage your own skill claims');
    }
    return { ok: true, actorClass: TRANSITION_ACTORS.APPLICANT, requirements };
  }

  // -- Reviewer transitions -------------------------------------------------
  if (!isStaffRole(actor.role)) {
    return fail('REVIEW_ROLE_REQUIRED', 403, 'Skill verification requires a reviewer role');
  }

  /*
   * Self-verification is refused even when the actor holds every permission.
   * A staff member who also has a Student profile must not sign off their own
   * skill — provenance would name them as both subject and authority.
   */
  if (isOwner) {
    return fail('SELF_VERIFICATION_DENIED', 403, 'You cannot review your own skill claim');
  }

  if (!requirements.permission || !hasPermission(actor.role, requirements.permission)) {
    return fail(
      'PERMISSION_REQUIRED',
      403,
      `Missing permission '${requirements.permission}' for this verification action`
    );
  }

  if (requirements.requiresMethod) {
    if (!isValidVerificationMethod(method)) {
      return fail('METHOD_REQUIRED', 422, 'A verification method is required');
    }
    if (!isEnabledVerificationMethod(method)) {
      return fail(
        'METHOD_NOT_ENABLED',
        422,
        `Verification method '${method}' is not available in this release`
      );
    }
  }

  if (requirements.requiresReason) {
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmed) {
      return fail('REASON_REQUIRED', 422, 'A reason is required for this verification action');
    }
    if (trimmed.length > SKILL_CLAIM_LIMITS.MAX_REASON_LENGTH) {
      return fail('REASON_TOO_LONG', 422, 'Reason exceeds the permitted length');
    }
    if (/[<>]/.test(trimmed)) {
      return fail('REASON_INVALID', 422, 'Reason must not contain markup');
    }
  }

  if (requirements.requiresEvidenceRef) {
    const refs = Array.isArray(evidenceRefs) ? evidenceRefs : [];
    if (refs.length === 0) {
      return fail(
        'EVIDENCE_REFERENCE_REQUIRED',
        422,
        'Granting skill trust requires at least one evidence reference'
      );
    }
    if (refs.length > SKILL_CLAIM_LIMITS.MAX_EVIDENCE_REFS_PER_VERIFICATION) {
      return fail('TOO_MANY_EVIDENCE_REFERENCES', 422, 'Too many evidence references');
    }
  }

  return { ok: true, actorClass: TRANSITION_ACTORS.REVIEWER, requirements };
}

/**
 * Validate applicant-supplied claim input, refusing any attempt to set a
 * trust-bearing field. Pure.
 */
export function validateClaimInput(payload) {
  const extracted = extractApplicantInput(payload, APPLICANT_CLAIM_INPUT_FIELDS);
  if (!extracted.ok) {
    if (extracted.reason === 'trust_controlled_field') {
      return fail(
        'TRUST_FIELD_FORBIDDEN',
        403,
        `Verification state cannot be set by the applicant: ${extracted.fields.join(', ')}`,
        { fields: extracted.fields }
      );
    }
    return fail('INVALID_PAYLOAD', 400, 'Invalid request body');
  }

  const name = validateSkillName(extracted.value.skillName);
  if (!name.ok) {
    return fail('INVALID_SKILL_NAME', 422, `Skill name rejected (${name.reason})`);
  }

  const years = extracted.value.yearsOfExperience;
  if (years !== undefined && years !== null && years !== '') {
    const n = Number(years);
    if (!Number.isFinite(n) || n < 0 || n > 70) {
      return fail('INVALID_YEARS', 422, 'yearsOfExperience must be between 0 and 70');
    }
  }

  return {
    ok: true,
    value: {
      skillName: name.value,
      normalizedSkillName: name.normalized,
      skillCategory: extracted.value.skillCategory,
      claimedLevel: extracted.value.claimedLevel,
      yearsOfExperience:
        years === undefined || years === null || years === '' ? null : Number(years),
    },
  };
}

/**
 * Validate applicant-supplied evidence input. Pure. The URL is checked
 * structurally only — it is never fetched.
 */
export function validateEvidenceInput(payload, { existingCount = 0 } = {}) {
  const extracted = extractApplicantInput(payload, APPLICANT_EVIDENCE_INPUT_FIELDS);
  if (!extracted.ok) {
    if (extracted.reason === 'trust_controlled_field') {
      return fail(
        'TRUST_FIELD_FORBIDDEN',
        403,
        `Verification state cannot be set by the applicant: ${extracted.fields.join(', ')}`,
        { fields: extracted.fields }
      );
    }
    return fail('INVALID_PAYLOAD', 400, 'Invalid request body');
  }

  if (existingCount >= SKILL_CLAIM_LIMITS.MAX_EVIDENCE_PER_CLAIM) {
    return fail(
      'EVIDENCE_LIMIT_REACHED',
      422,
      `A skill claim accepts at most ${SKILL_CLAIM_LIMITS.MAX_EVIDENCE_PER_CLAIM} evidence links`
    );
  }

  if (!isValidSkillEvidenceType(extracted.value.evidenceType)) {
    return fail('INVALID_EVIDENCE_TYPE', 422, 'Unsupported evidence type');
  }

  const url = validateEvidenceUrl(extracted.value.url);
  if (!url.ok) {
    return fail('INVALID_EVIDENCE_URL', 422, `Evidence URL rejected (${url.reason})`, {
      reason: url.reason,
    });
  }

  const description = validateEvidenceDescription(extracted.value.description);
  if (!description.ok) {
    return fail('INVALID_EVIDENCE_DESCRIPTION', 422, `Description rejected (${description.reason})`);
  }

  return {
    ok: true,
    value: {
      evidenceType: extracted.value.evidenceType,
      url: url.value,
      hostname: url.hostname,
      provider: url.provider,
      description: description.value,
    },
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Append one immutable history record. Called on EVERY status change; there is
 * no transition path that skips it.
 */
async function appendHistory({
  claim,
  fromStatus,
  toStatus,
  actor,
  actorClass,
  method = null,
  reason = '',
  evidenceRefs = [],
  verificationId = null,
  correlationId = '',
}) {
  return SkillVerificationHistory.create({
    claimId: claim._id,
    userId: claim.userId,
    fromStatus,
    toStatus,
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? '',
    actorRealm: actor?.realm ?? '',
    actorClass,
    method,
    reason,
    evidenceRefs,
    verificationId,
    correlationId,
  });
}

/**
 * Create a skill claim for the authenticated applicant.
 * `userId` comes from the session; the payload cannot influence it.
 */
export async function createClaim({ userId, payload, correlationId = '' }) {
  const validated = validateClaimInput(payload);
  if (!validated.ok) return validated;

  const existingCount = await UserSkillClaim.countDocuments({ userId });
  if (existingCount >= SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER) {
    return fail('CLAIM_LIMIT_REACHED', 422, `At most ${SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER} skill claims per profile`);
  }

  const duplicate = await UserSkillClaim.findOne({
    userId,
    normalizedSkillName: validated.value.normalizedSkillName,
  }).lean();
  if (duplicate) {
    return fail('DUPLICATE_CLAIM', 409, 'You have already claimed this skill');
  }

  const claim = await UserSkillClaim.create({
    userId,
    ...validated.value,
    status: S.CLAIMED,
    statusChangedAt: new Date(),
    verificationScore: 0,
  });

  await appendHistory({
    claim,
    fromStatus: S.CLAIMED,
    toStatus: S.CLAIMED,
    actor: { id: userId, role: 'User', realm: USER_REALM },
    actorClass: TRANSITION_ACTORS.APPLICANT,
    reason: 'Skill claimed by applicant',
    correlationId,
  });

  return { ok: true, claim };
}

/**
 * Attach an evidence link to the applicant's own claim.
 *
 * Moves `claimed` → `evidence_submitted` through the same authorization path
 * as every other transition. Attaching evidence never changes verified state.
 */
export async function addEvidence({ userId, claimId, payload, correlationId = '' }) {
  if (!mongoose.Types.ObjectId.isValid(claimId)) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }
  // Scoped by userId: another applicant's claim id returns 404, not 403,
  // so claim ids are not probeable.
  const claim = await UserSkillClaim.findOne({ _id: claimId, userId });
  if (!claim) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const existingCount = await SkillEvidence.countDocuments({ claimId: claim._id, userId });
  const validated = validateEvidenceInput(payload, { existingCount });
  if (!validated.ok) return validated;

  const actor = { id: userId, role: 'User', realm: USER_REALM };
  const fromStatus = claim.status;
  const shouldTransition = fromStatus === S.CLAIMED;

  if (shouldTransition) {
    const decision = authorizeClaimTransition({
      claim,
      toStatus: S.EVIDENCE_SUBMITTED,
      actor,
    });
    if (!decision.ok) return decision;
  }

  const evidence = await SkillEvidence.create({
    claimId: claim._id,
    userId,
    ...validated.value,
    status: SKILL_EVIDENCE_STATUSES.SUBMITTED,
  });

  claim.evidenceCount = existingCount + 1;
  if (shouldTransition) {
    claim.status = S.EVIDENCE_SUBMITTED;
    claim.statusChangedAt = new Date();
  }
  await claim.save();

  if (shouldTransition) {
    await appendHistory({
      claim,
      fromStatus,
      toStatus: S.EVIDENCE_SUBMITTED,
      actor,
      actorClass: TRANSITION_ACTORS.APPLICANT,
      reason: 'Evidence attached by applicant',
      evidenceRefs: [evidence._id],
      correlationId,
    });
  }

  return { ok: true, evidence, claim };
}

/** Applicant submits their evidence-backed claim for review. */
export async function submitForReview({ userId, claimId, correlationId = '' }) {
  if (!mongoose.Types.ObjectId.isValid(claimId)) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }
  const claim = await UserSkillClaim.findOne({ _id: claimId, userId });
  if (!claim) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const actor = { id: userId, role: 'User', realm: USER_REALM };
  const decision = authorizeClaimTransition({
    claim,
    toStatus: S.VERIFICATION_PENDING,
    actor,
  });
  if (!decision.ok) return decision;

  const evidenceCount = await SkillEvidence.countDocuments({ claimId: claim._id, userId });
  if (evidenceCount === 0) {
    return fail('EVIDENCE_REQUIRED', 422, 'Attach at least one evidence link before requesting review');
  }

  const fromStatus = claim.status;
  claim.status = S.VERIFICATION_PENDING;
  claim.statusChangedAt = new Date();
  await claim.save();

  await appendHistory({
    claim,
    fromStatus,
    toStatus: S.VERIFICATION_PENDING,
    actor,
    actorClass: TRANSITION_ACTORS.APPLICANT,
    reason: 'Review requested by applicant',
    correlationId,
  });

  return { ok: true, claim };
}

/**
 * Record a reviewer decision — the ONLY way a claim becomes verified or
 * evidence-backed.
 *
 * `actor` must be the server-derived principal. Any `verifiedBy`, `score` or
 * `verifiedAt` in a request body is rejected upstream by `extractApplicantInput`
 * and ignored here: those values are computed, never accepted.
 */
export async function recordVerificationDecision({
  actor,
  claimId,
  toStatus,
  method,
  reason,
  evidenceRefs = [],
  expiresAt = null,
  correlationId = '',
}) {
  if (!mongoose.Types.ObjectId.isValid(claimId)) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }
  const claim = await UserSkillClaim.findById(claimId);
  if (!claim) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const decision = authorizeClaimTransition({
    claim,
    toStatus,
    actor,
    method,
    reason,
    evidenceRefs,
  });
  if (!decision.ok) return decision;

  // Evidence must belong to THIS claim — a reviewer cannot cite another
  // applicant's evidence as provenance for this one.
  let resolvedEvidence = [];
  if (evidenceRefs.length) {
    const validIds = evidenceRefs.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== evidenceRefs.length) {
      return fail('INVALID_EVIDENCE_REFERENCE', 422, 'Evidence reference is not valid');
    }
    resolvedEvidence = await SkillEvidence.find({
      _id: { $in: validIds },
      claimId: claim._id,
      userId: claim.userId,
    }).lean();
    if (resolvedEvidence.length !== validIds.length) {
      return fail(
        'INVALID_EVIDENCE_REFERENCE',
        422,
        'Evidence reference does not belong to this skill claim'
      );
    }
  }

  const now = new Date();
  const grantsTrust = toStatus === S.VERIFIED || toStatus === S.EVIDENCE_BACKED;

  const score = grantsTrust
    ? computeVerificationScore(
        {
          status: toStatus,
          acceptedEvidenceTypes: resolvedEvidence.map((e) => e.evidenceType),
          method,
          revokedAt: null,
          expiresAt,
        },
        now
      )
    : 0;

  const verification = await SkillVerification.create({
    claimId: claim._id,
    userId: claim.userId,
    outcome: toStatus,
    method,
    evidenceRefs: resolvedEvidence.map((e) => e._id),
    reason: String(reason).trim(),
    actorId: actor.id,
    actorRole: actor.role,
    actorRealm: actor.realm,
    score,
    decidedAt: now,
    expiresAt: grantsTrust ? expiresAt : null,
    correlationId,
  });

  if (resolvedEvidence.length) {
    await SkillEvidence.updateMany(
      { _id: { $in: resolvedEvidence.map((e) => e._id) } },
      {
        $set: {
          status: grantsTrust ? SKILL_EVIDENCE_STATUSES.ACCEPTED : SKILL_EVIDENCE_STATUSES.REJECTED,
          reviewedAt: now,
          reviewedBy: actor.id,
        },
      }
    );
  }

  const fromStatus = claim.status;
  claim.status = toStatus;
  claim.statusChangedAt = now;
  claim.currentVerificationId = verification._id;
  claim.verificationScore = score;
  claim.verificationMethod = grantsTrust ? method : null;

  if (toStatus === S.VERIFIED) {
    claim.verifiedBy = actor.id;
    claim.verifiedByRole = actor.role;
    claim.verifiedAt = now;
    claim.expiresAt = expiresAt ?? null;
  } else {
    // Any non-verified outcome clears prior verified standing outright.
    claim.verifiedBy = null;
    claim.verifiedByRole = '';
    claim.verifiedAt = null;
    if (toStatus !== S.EVIDENCE_BACKED) claim.expiresAt = null;
  }

  if (toStatus === S.REVOKED) {
    claim.revokedAt = now;
    claim.revokedBy = actor.id;
  }

  await claim.save();

  await appendHistory({
    claim,
    fromStatus,
    toStatus,
    actor,
    actorClass: TRANSITION_ACTORS.REVIEWER,
    method,
    reason: String(reason).trim(),
    evidenceRefs: resolvedEvidence.map((e) => e._id),
    verificationId: verification._id,
    correlationId,
  });

  return { ok: true, claim, verification };
}

/**
 * Expire a verification that has passed its `expiresAt`. Policy-driven, so it
 * is a SYSTEM transition and unreachable from any HTTP route.
 *
 * Note that reads do not depend on this having run: `deriveCurrentTrustState`
 * treats a past `expiresAt` as expired regardless, so an expired grant never
 * displays as current even before this is applied.
 */
export async function applyExpiry({ claimId, correlationId = '' }, now = new Date()) {
  const claim = await UserSkillClaim.findById(claimId);
  if (!claim) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const actor = { id: null, role: 'system', realm: 'system', isSystem: true };
  const decision = authorizeClaimTransition({ claim, toStatus: S.EXPIRED, actor });
  if (!decision.ok) return decision;

  if (!claim.expiresAt || new Date(claim.expiresAt).getTime() > new Date(now).getTime()) {
    return fail('NOT_EXPIRED', 409, 'This verification has not expired');
  }

  const fromStatus = claim.status;
  claim.status = S.EXPIRED;
  claim.statusChangedAt = now;
  claim.verificationScore = 0;
  await claim.save();

  await appendHistory({
    claim,
    fromStatus,
    toStatus: S.EXPIRED,
    actor,
    actorClass: TRANSITION_ACTORS.SYSTEM,
    reason: 'Verification lifetime elapsed',
    correlationId,
  });

  return { ok: true, claim };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Owner view — the applicant's own claims with their evidence. */
export async function listOwnClaims({ userId, limit = 50 }) {
  const bounded = Math.min(Math.max(Number(limit) || 50, 1), SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER);
  const claims = await UserSkillClaim.find({ userId }).sort({ createdAt: -1 }).limit(bounded).lean();
  const evidence = await SkillEvidence.find({
    userId,
    claimId: { $in: claims.map((c) => c._id) },
  }).lean();

  const byClaim = new Map();
  for (const e of evidence) {
    const key = String(e.claimId);
    if (!byClaim.has(key)) byClaim.set(key, []);
    byClaim.get(key).push(e);
  }

  const now = new Date();
  return claims.map((claim) => ({
    id: String(claim._id),
    skillName: claim.skillName,
    skillCategory: claim.skillCategory,
    claimedLevel: claim.claimedLevel,
    yearsOfExperience: claim.yearsOfExperience,
    // Read-time derivation: an expired/revoked grant is never shown as current
    trustState: deriveCurrentTrustState(claim, now),
    verificationScore: claim.verificationScore,
    verificationMethod: claim.verificationMethod,
    verifiedAt: claim.verifiedAt,
    expiresAt: claim.expiresAt,
    evidenceCount: (byClaim.get(String(claim._id)) ?? []).length,
    evidence: (byClaim.get(String(claim._id)) ?? []).map((e) => ({
      id: String(e._id),
      evidenceType: e.evidenceType,
      url: e.url,
      hostname: e.hostname,
      provider: e.provider,
      description: e.description,
      status: e.status,
      submittedAt: e.submittedAt,
    })),
  }));
}

/**
 * An employer may read an applicant's skills only when that applicant actually
 * applied to one of the employer's own jobs. Without this, any authenticated
 * employer could enumerate arbitrary user ids and harvest candidate profiles.
 *
 * Returns 404 rather than 403 on failure so employer ids cannot be used to
 * probe which users exist.
 */
export async function assertEmployerMayViewApplicant({ employerId, applicantUserId }) {
  if (!mongoose.Types.ObjectId.isValid(applicantUserId)) {
    return fail('APPLICANT_NOT_FOUND', 404, 'Applicant not found');
  }
  const employerJobIds = await Job.find({ employerId }).distinct('_id');
  if (!employerJobIds.length) return fail('APPLICANT_NOT_FOUND', 404, 'Applicant not found');

  const application = await Application.exists({
    userId: applicantUserId,
    jobId: { $in: employerJobIds },
  });
  if (!application) return fail('APPLICANT_NOT_FOUND', 404, 'Applicant not found');
  return { ok: true };
}

/**
 * Employer view of one applicant's skills. Trust state is recomputed from
 * stored records here — an employer's filter never supplies it.
 */
export async function listClaimsForEmployer({ applicantUserId, trustFilter = 'any', skill = '' }) {
  const query = { userId: applicantUserId };
  if (skill) {
    const name = validateSkillName(skill);
    if (name.ok) query.normalizedSkillName = name.normalized;
  }
  const claims = await UserSkillClaim.find(query).sort({ verificationScore: -1 }).limit(SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER).lean();
  const evidence = await SkillEvidence.find({
    claimId: { $in: claims.map((c) => c._id) },
    status: { $ne: SKILL_EVIDENCE_STATUSES.REJECTED },
  }).lean();

  const byClaim = new Map();
  for (const e of evidence) {
    const key = String(e.claimId);
    if (!byClaim.has(key)) byClaim.set(key, []);
    byClaim.get(key).push(e);
  }

  const now = new Date();
  return claims
    .filter((claim) => matchesTrustFilter(claim, trustFilter, now))
    .map((claim) => projectClaimForEmployer(claim, byClaim.get(String(claim._id)) ?? [], now));
}

/**
 * Reviewer queue — claims awaiting a decision, with the evidence metadata a
 * reviewer needs to judge them.
 *
 * Read-only and permission-gated: holding `skill_verification:read` lets a
 * reviewer look, and nothing more. Granting trust still goes through
 * `recordVerificationDecision`, which demands the approve/review permission
 * plus method, reason and evidence — being able to see the queue confers no
 * authority over it.
 *
 * Evidence ids are returned because a decision must cite specific evidence;
 * the service verifies those ids belong to the claim before accepting them.
 */
export async function listClaimsForReview({ actor, status = '', limit = 25 }) {
  const permitted =
    actor?.realm === USER_REALM &&
    isStaffRole(actor?.role) &&
    hasPermission(actor.role, 'skill_verification:read');
  if (!permitted) {
    return fail('PERMISSION_REQUIRED', 403, 'Skill verification review access required');
  }

  // Default queue: everything a reviewer still owes an answer on.
  const AWAITING = [S.VERIFICATION_PENDING, S.EVIDENCE_SUBMITTED, S.NEEDS_INFORMATION];
  const query = isValidClaimStatus(status) ? { status } : { status: { $in: AWAITING } };

  const bounded = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const claims = await UserSkillClaim.find(query)
    .sort({ statusChangedAt: 1 })
    .limit(bounded)
    .lean();

  const evidence = await SkillEvidence.find({
    claimId: { $in: claims.map((c) => c._id) },
  }).lean();

  const byClaim = new Map();
  for (const e of evidence) {
    const key = String(e.claimId);
    if (!byClaim.has(key)) byClaim.set(key, []);
    byClaim.get(key).push(e);
  }

  const now = new Date();
  return {
    ok: true,
    claims: claims.map((claim) => ({
      id: String(claim._id),
      // The subject must be identifiable to a reviewer; this endpoint is
      // permissioned staff-only and returns no other profile data.
      applicantUserId: String(claim.userId),
      skillName: claim.skillName,
      skillCategory: claim.skillCategory,
      claimedLevel: claim.claimedLevel,
      yearsOfExperience: claim.yearsOfExperience,
      trustState: deriveCurrentTrustState(claim, now),
      statusChangedAt: claim.statusChangedAt,
      evidence: (byClaim.get(String(claim._id)) ?? []).map((e) => ({
        id: String(e._id),
        evidenceType: e.evidenceType,
        provider: e.provider,
        hostname: e.hostname,
        url: e.url,
        description: e.description,
        status: e.status,
        submittedAt: e.submittedAt,
      })),
    })),
  };
}

/** Public projection — narrower than the employer view. */
export async function listPublicClaims({ userId }) {
  const claims = await UserSkillClaim.find({ userId }).limit(SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER).lean();
  const now = new Date();
  return claims.map((claim) => projectClaimForPublic(claim, now));
}

/** Append-only history for one claim. Owner or authorized reviewer only. */
export async function getClaimHistory({ claimId, actor }) {
  if (!mongoose.Types.ObjectId.isValid(claimId)) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }
  const claim = await UserSkillClaim.findById(claimId).lean();
  if (!claim) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const isOwner = String(actor?.id ?? '') === String(claim.userId);
  const isReviewer =
    actor?.realm === USER_REALM &&
    isStaffRole(actor?.role) &&
    hasPermission(actor.role, 'skill_verification:read');
  if (!isOwner && !isReviewer) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }

  const history = await SkillVerificationHistory.find({ claimId })
    .sort({ occurredAt: -1 })
    .limit(200)
    .lean();

  return {
    ok: true,
    history: history.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorClass: h.actorClass,
      // Reviewer identity stays internal; the owner sees the role, not the person.
      actorRole: h.actorRole,
      method: h.method,
      reason: h.reason,
      occurredAt: h.occurredAt,
    })),
  };
}

/**
 * Build the application-time skill snapshot.
 *
 * Reads the applicant's stored claims directly — the caller passes only a
 * userId, never trust values, so an application payload cannot forge the
 * snapshot it is stored with.
 */
export async function buildApplicationSkillSnapshot({ userId }, now = new Date()) {
  const claims = await UserSkillClaim.find({ userId })
    .limit(SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER)
    .lean();
  return buildSkillSnapshot(claims, now);
}

export const skillVerificationService = {
  authorizeClaimTransition,
  validateClaimInput,
  validateEvidenceInput,
  createClaim,
  addEvidence,
  submitForReview,
  recordVerificationDecision,
  applyExpiry,
  listOwnClaims,
  assertEmployerMayViewApplicant,
  listClaimsForEmployer,
  listClaimsForReview,
  listPublicClaims,
  getClaimHistory,
  buildApplicationSkillSnapshot,
};
