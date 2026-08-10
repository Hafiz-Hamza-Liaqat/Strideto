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
  methodMayIssueVerified,
  evaluateVerificationSufficiency,
  resolveProficiencyScore,
  isProficiencyEvidenced,
  isValidSkillEvidenceType,
  validateEvidenceUrl,
  validateEvidenceDescription,
  validateApplicantVisibleRequest,
  validateSkillName,
  deriveCurrentTrustState,
  buildSkillSnapshot,
  projectClaimForEmployer,
  projectClaimForPublic,
  matchesTrustFilter,
  extractApplicantInput,
  APPLICANT_CLAIM_INPUT_FIELDS,
  APPLICANT_EVIDENCE_INPUT_FIELDS,
} from '../../../../shared/career/skillVerification.js';
import {
  emitSkillTrustNotifications,
  reconcileSkillTrustNotifications,
  SKILL_TRUST_IN_APP_DELIVERY,
} from './skillTrustNotificationBridge.js';
import { logger } from '../../utils/logger.js';

const S = SKILL_CLAIM_STATUSES;

/**
 * Commit a status transition atomically.
 *
 * Compare-and-set on the status we authorized FROM. Two reviewers deciding the
 * same claim concurrently both pass the pure authorization check — it runs
 * against a read copy — so without this guard both would write, producing two
 * verifications, two history rows and two contradictory notifications for one
 * decision. The conditional update makes exactly one of them the winner; the
 * loser is told the claim moved.
 *
 * @returns {Promise<object|null>} the updated claim, or null if someone else won
 */
async function commitStatusTransition({ claimId, fromStatus, set, inc = null }) {
  const update = { $set: set };
  // Counters ride along as `$inc` so a concurrent writer's increment is never
  // clobbered by a value computed from this request's stale read.
  if (inc) update.$inc = inc;
  return UserSkillClaim.findOneAndUpdate({ _id: claimId, status: fromStatus }, update, { new: true });
}

/**
 * Fire notifications for a committed transition.
 *
 * Deliberately awaited but never allowed to throw: trust state is already
 * durable at this point. The returned status distinguishes a successfully
 * ensured inbox row from a recoverable pending-reconciliation side effect.
 */
async function notifyTransition({ claim, history }) {
  try {
    const delivery = await emitSkillTrustNotifications({
      claim,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      historyId: history._id,
      applicantVisibleRequest: history.applicantVisibleRequest ?? '',
      occurredAt: history.occurredAt,
    });
    if (delivery.status === SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION) {
      logger.warn('skill_trust_notification_pending_reconciliation', {
        transitionId: String(history._id),
      });
    }
    return delivery;
  } catch {
    logger.warn('skill_trust_notification_pending_reconciliation', {
      transitionId: String(history._id),
    });
    return {
      created: 0,
      skipped: 0,
      failed: 1,
      status: SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION,
      transitionId: String(history._id),
    };
  }
}

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
export function authorizeClaimTransition({
  claim,
  toStatus,
  actor,
  method,
  reason,
  evidenceRefs,
  applicantVisibleRequest,
} = {}) {
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
    /*
     * The method policy gate, applied before anything else about the request
     * is considered. Reviewing a self-published link — however carefully —
     * establishes that the work exists, which is `evidence_backed`. Only a
     * method that reaches outside the applicant's own publishing may conclude
     * `verified`, and no permission, role or payload can substitute for one.
     */
    if (toStatus === S.VERIFIED && !methodMayIssueVerified(method)) {
      return fail(
        'METHOD_CANNOT_VERIFY',
        422,
        `'${method}' can establish that evidence exists and is relevant, which is `
          + `'${S.EVIDENCE_BACKED}'. Issuing '${S.VERIFIED}' requires a credential, a `
          + 'confirmed reference, or a structured assessment.'
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

  let safeApplicantVisibleRequest = '';
  if (requirements.requiresApplicantVisibleRequest) {
    const request = validateApplicantVisibleRequest(applicantVisibleRequest);
    if (!request.ok) {
      const code = request.reason === 'too_long'
        ? 'APPLICANT_VISIBLE_REQUEST_TOO_LONG'
        : 'APPLICANT_VISIBLE_REQUEST_INVALID';
      return fail(
        code,
        422,
        'Plain-text instructions for the applicant are required when requesting more information'
      );
    }
    safeApplicantVisibleRequest = request.value;
  } else if (
    typeof applicantVisibleRequest === 'string' &&
    applicantVisibleRequest.trim().length > 0
  ) {
    return fail(
      'APPLICANT_VISIBLE_REQUEST_NOT_ALLOWED',
      422,
      'Applicant-visible instructions are only accepted for needs-information decisions'
    );
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

  return {
    ok: true,
    actorClass: TRANSITION_ACTORS.REVIEWER,
    requirements,
    applicantVisibleRequest: safeApplicantVisibleRequest,
  };
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
  applicantVisibleRequest = '',
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
    applicantVisibleRequest,
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
    proficiencyScore: null,
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

  if (!shouldTransition) {
    // Additional evidence on an already-submitted claim: the counter moves, the
    // trust state does not, and no state-change notification is warranted.
    await UserSkillClaim.updateOne({ _id: claim._id }, { $inc: { evidenceCount: 1 } });
    claim.evidenceCount = existingCount + 1;
    return { ok: true, evidence, claim };
  }

  const now = new Date();
  const committed = await commitStatusTransition({
    claimId: claim._id,
    fromStatus,
    set: { status: S.EVIDENCE_SUBMITTED, statusChangedAt: now },
    inc: { evidenceCount: 1 },
  });
  if (!committed) {
    // Lost the race — the evidence is stored, but this request did not own the
    // transition, so it must not append history or notify a second time.
    await UserSkillClaim.updateOne({ _id: claim._id }, { $inc: { evidenceCount: 1 } });
    return { ok: true, evidence, claim: await UserSkillClaim.findById(claim._id) };
  }

  const history = await appendHistory({
    claim: committed,
    fromStatus,
    toStatus: S.EVIDENCE_SUBMITTED,
    actor,
    actorClass: TRANSITION_ACTORS.APPLICANT,
    reason: 'Evidence attached by applicant',
    evidenceRefs: [evidence._id],
    correlationId,
  });

  const notificationDelivery = await notifyTransition({ claim: committed, history });

  return { ok: true, evidence, claim: committed, notificationDelivery };
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
  const now = new Date();
  const committed = await commitStatusTransition({
    claimId: claim._id,
    fromStatus,
    set: { status: S.VERIFICATION_PENDING, statusChangedAt: now },
  });
  // A double-submit races here: only the request that actually moved the claim
  // queues it for review and tells the reviewers about it.
  if (!committed) {
    return fail('CLAIM_STATE_CHANGED', 409, 'This skill claim was already updated');
  }

  const history = await appendHistory({
    claim: committed,
    fromStatus,
    toStatus: S.VERIFICATION_PENDING,
    actor,
    actorClass: TRANSITION_ACTORS.APPLICANT,
    reason: 'Review requested by applicant',
    correlationId,
  });

  const notificationDelivery = await notifyTransition({ claim: committed, history });

  return { ok: true, claim: committed, notificationDelivery };
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
  applicantVisibleRequest = '',
  /** { rubricId, rubricVersion, score } — required by rubric-scored methods. */
  assessment = null,
  /** Issuer or referee actually contacted, for methods that demand one. */
  corroborationRef = '',
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
    applicantVisibleRequest,
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

  /*
   * The sufficiency gate, run against the evidence that was ACTUALLY cited —
   * which is why it happens here rather than in the pure authorization step.
   * A reviewer citing only a GitHub repository, a Figma file or a portfolio
   * cannot reach `verified` no matter which method they name: those are
   * self-published, so the applicant remains the only source.
   */
  const sufficiency = evaluateVerificationSufficiency({
    toStatus,
    method,
    evidenceTypes: resolvedEvidence.map((e) => e.evidenceType),
    assessment,
    corroborationRef,
  });
  if (!sufficiency.ok) {
    return fail(sufficiency.code, 422, sufficiency.message);
  }

  const now = new Date();
  const grantsTrust = toStatus === S.VERIFIED || toStatus === S.EVIDENCE_BACKED;
  const policy = sufficiency.policy;

  // Measured, or null. Never inferred from how many links were attached.
  const proficiencyScore = resolveProficiencyScore(
    { status: toStatus, method, assessment, revokedAt: null, expiresAt },
    now
  );

  /*
   * Verification lifetime. Policy supplies a default so a credential check or
   * an assessment does not stand unreviewed forever; an explicit expiry from
   * the reviewer wins.
   */
  const effectiveExpiry =
    toStatus === S.VERIFIED
      ? (expiresAt
        ?? (policy.defaultValidityDays
          ? new Date(now.getTime() + policy.defaultValidityDays * 86_400_000)
          : null))
      : null;

  const fromStatus = claim.status;

  /*
   * The verification id is allocated BEFORE anything is written so the claim
   * transition can be the compare-and-set that decides the race. Creating the
   * SkillVerification first (as this originally did) meant a reviewer who lost
   * a concurrent decision had already written a verification record that no
   * claim pointed at — a permanent orphan in the trust audit trail, and, once
   * notifications exist, a second contradictory alert for one decision.
   */
  const verificationId = new mongoose.Types.ObjectId();

  const set = {
    status: toStatus,
    statusChangedAt: now,
    currentVerificationId: verificationId,
    // Null unless a scoring assessment produced one — evidence-backed never does.
    proficiencyScore,
    verificationMethod: grantsTrust ? method : null,
  };

  if (toStatus === S.VERIFIED) {
    set.verifiedBy = actor.id;
    set.verifiedByRole = actor.role;
    set.verifiedAt = now;
    set.expiresAt = effectiveExpiry;
  } else {
    // Any non-verified outcome clears prior verified standing outright.
    set.verifiedBy = null;
    set.verifiedByRole = '';
    set.verifiedAt = null;
    if (toStatus !== S.EVIDENCE_BACKED) set.expiresAt = null;
  }

  if (toStatus === S.REVOKED) {
    set.revokedAt = now;
    set.revokedBy = actor.id;
  }

  const committed = await commitStatusTransition({ claimId: claim._id, fromStatus, set });
  if (!committed) {
    return fail(
      'CLAIM_STATE_CHANGED',
      409,
      'This skill claim was decided by another reviewer; reload before deciding again'
    );
  }

  const verification = await SkillVerification.create({
    _id: verificationId,
    claimId: claim._id,
    userId: claim.userId,
    outcome: toStatus,
    method,
    evidenceRefs: resolvedEvidence.map((e) => e._id),
    reason: String(reason).trim(),
    applicantVisibleRequest: decision.applicantVisibleRequest,
    actorId: actor.id,
    actorRole: actor.role,
    actorRealm: actor.realm,
    proficiencyScore,
    rubricId: assessment?.rubricId ? String(assessment.rubricId).trim() : '',
    rubricVersion: assessment?.rubricVersion != null ? String(assessment.rubricVersion).trim() : '',
    corroborationRef: corroborationRef ? String(corroborationRef).trim() : '',
    decidedAt: now,
    expiresAt: effectiveExpiry,
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

  const history = await appendHistory({
    claim: committed,
    fromStatus,
    toStatus,
    actor,
    actorClass: TRANSITION_ACTORS.REVIEWER,
    method,
    reason: String(reason).trim(),
    applicantVisibleRequest: decision.applicantVisibleRequest,
    evidenceRefs: resolvedEvidence.map((e) => e._id),
    verificationId: verification._id,
    correlationId,
  });

  /*
   * Only now — after the authoritative transition is durable — may anything
   * announce it. A "verification approved" notification cannot precede or
   * outlive the transition that earned it.
   */
  const notificationDelivery = await notifyTransition({ claim: committed, history });

  return { ok: true, claim: committed, verification, notificationDelivery };
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
  const committed = await commitStatusTransition({
    claimId: claim._id,
    fromStatus,
    // Expiry clears any measured score: nothing current measures this any more.
    set: { status: S.EXPIRED, statusChangedAt: now, proficiencyScore: null },
  });
  // A sweep running twice over the same claim expires it once.
  if (!committed) {
    return fail('CLAIM_STATE_CHANGED', 409, 'This skill claim was already updated');
  }

  const history = await appendHistory({
    claim: committed,
    fromStatus,
    toStatus: S.EXPIRED,
    actor,
    actorClass: TRANSITION_ACTORS.SYSTEM,
    reason: 'Verification lifetime elapsed',
    correlationId,
  });

  const notificationDelivery = await notifyTransition({ claim: committed, history });

  return { ok: true, claim: committed, notificationDelivery };
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
    // Null unless an assessment measured it. Owners see the same truth
    // employers do — no private "real" score exists behind the projection.
    proficiencyScore: isProficiencyEvidenced(claim, now) ? claim.proficiencyScore : null,
    proficiencyEvidenced: isProficiencyEvidenced(claim, now),
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
  // Ordered by how recently trust was established, not by any score — there is
  // no ranking number to sort on, and inventing one is what this release removed.
  const claims = await UserSkillClaim.find(query)
    .sort({ verifiedAt: -1, statusChangedAt: -1 })
    .limit(SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER)
    .lean();
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

/** Pure read-authority decision for the private transition history. */
export function authorizeClaimHistoryRead({ claim, actor }) {
  const isOwner =
    actor?.realm === USER_REALM &&
    String(actor?.id ?? '') === String(claim.userId);
  const isReviewer =
    actor?.realm === USER_REALM &&
    isStaffRole(actor?.role) &&
    hasPermission(actor.role, 'skill_verification:read');
  return { allowed: isOwner || isReviewer, isOwner, isReviewer };
}

/** Pure privacy projection: internal reasons are reviewer-only. */
export function projectClaimHistory(history, { isReviewer = false } = {}) {
  return history.map((h) => ({
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    actorClass: h.actorClass,
    // Reviewer identity stays internal; the owner sees the role, not the person.
    actorRole: h.actorRole,
    method: h.method,
    ...(isReviewer ? { reason: h.reason } : {}),
    ...(h.toStatus === S.NEEDS_INFORMATION && h.applicantVisibleRequest
      ? { applicantVisibleRequest: h.applicantVisibleRequest }
      : {}),
    occurredAt: h.occurredAt,
  }));
}

/** Append-only history for one claim. Owner or authorized reviewer only. */
export async function getClaimHistory({ claimId, actor }) {
  if (!mongoose.Types.ObjectId.isValid(claimId)) {
    return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');
  }
  const claim = await UserSkillClaim.findById(claimId).lean();
  if (!claim) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const authority = authorizeClaimHistoryRead({ claim, actor });
  if (!authority.allowed) return fail('CLAIM_NOT_FOUND', 404, 'Skill claim not found');

  const history = await SkillVerificationHistory.find({ claimId })
    .sort({ occurredAt: -1 })
    .limit(200)
    .lean();

  return {
    ok: true,
    history: projectClaimHistory(history, authority),
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
  reconcileSkillTrustNotifications,
  listOwnClaims,
  assertEmployerMayViewApplicant,
  listClaimsForEmployer,
  listClaimsForReview,
  listPublicClaims,
  authorizeClaimHistoryRead,
  projectClaimHistory,
  getClaimHistory,
  buildApplicationSkillSnapshot,
};
