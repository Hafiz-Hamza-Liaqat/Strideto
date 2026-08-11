/**
 * verificationService — Organization Verification lifecycle (Mission 2).
 *
 * Canonical authority for all verification state transitions, submission,
 * evidence management, badge derivation, SLA tracking, and capability gating.
 *
 * Authorization is always the caller's responsibility (routes/controllers
 * enforce role requirements); this service enforces:
 *   - Valid state transitions only.
 *   - Organization ownership on every mutating call.
 *   - Audit trail on every transition.
 *   - Safe metadata in audit records.
 *   - No automatic approval.
 */
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { VerificationEvidence } from '../models/VerificationEvidence.js';
import { VerificationTransition } from '../models/VerificationTransition.js';
import { Organization } from '../models/Organization.js';
import { logAudit } from './auditService.js';
import {
  VERIFICATION_STATUSES,
  EVIDENCE_TYPES as _EVIDENCE_TYPES,
  EVIDENCE_STATUSES,
  RISK_LEVELS,
  isValidTransition,
  isValidEvidenceType,
  isValidEvidenceStatus,
  isValidRiskLevel as _isValidRiskLevel,
  isValidRiskSignal,
  requiresEnhancedReview,
  canExercisePrivilegedCapability,
  deriveBadges,
  validateSubmissionCompleteness,
  computeSlaDeadline,
} from '../../../shared/international/verification.js';
import { findForbiddenMetadataKeys } from '../../../shared/international/audit.js';
import { INSTITUTION_ORGANIZATION_TYPES } from '../../../shared/institution/institutionPortal.js';
import { InstitutionClaim } from '../models/institution/InstitutionClaim.js';
import { emitOrgVerificationNotifications } from './orgVerificationNotificationBridge.js';

const VS = VERIFICATION_STATUSES;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve or create the OrganizationVerification record for an org.
 * Validates that the Organization exists first.
 */
async function resolveRecord(organizationId) {
  const org = await Organization.findById(organizationId).select(
    'organizationType countryCode displayName'
  );
  if (!org) throw Object.assign(new Error('Organization not found'), { code: 'ORG_NOT_FOUND', status: 404 });

  let record = await OrganizationVerification.findOne({ organizationId });
  if (!record) {
    record = await OrganizationVerification.create({
      organizationId,
      organizationType: org.organizationType,
      countryCode: org.countryCode || '',
      status: VS.DRAFT,
    });
  }
  return { record, org };
}

/** Write an immutable transition record and an audit log entry. */
async function recordTransition(organizationId, fromStatus, toStatus, actor, reason, metadata = {}) {
  // Validate metadata safety before persisting
  const forbidden = findForbiddenMetadataKeys(metadata);
  if (forbidden.length) {
    throw new Error(`Audit metadata contains forbidden key(s): ${forbidden.join(', ')}`);
  }

  const transition = await VerificationTransition.create({
    organizationId,
    fromStatus,
    toStatus,
    actorId: actor?.userId || actor?._id,
    actorRole: actor?.role || '',
    actorRealm: actor?.realm || (actor?.role ? 'admin' : 'system'),
    reason: reason || '',
    metadata,
    correlationId: actor?.correlationId || '',
    occurredAt: new Date(),
  });

  await logAudit({
    actor,
    action: `verification.transition.${toStatus}`,
    targetType: 'OrganizationVerification',
    targetId: String(organizationId),
    status: 'success',
    metadata: { fromStatus, toStatus, reason: reason || '' },
    reason: reason || '',
  });

  return transition;
}

function scheduleVerificationNotifications({ organizationId, fromStatus, toStatus, transitionId, organizationType }) {
  void emitOrgVerificationNotifications({
    organizationId,
    fromStatus,
    toStatus,
    transitionId,
    organizationType,
  }).catch(() => {});
}

/** Apply a status transition with all guards. Returns updated record. */
async function applyTransition(organizationId, toStatus, actor, reason, extraUpdate = {}) {
  const { record } = await resolveRecord(organizationId);
  const fromStatus = record.status;

  if (!isValidTransition(fromStatus, toStatus)) {
    throw Object.assign(
      new Error(`Invalid transition: ${fromStatus} → ${toStatus}`),
      { code: 'INVALID_TRANSITION', status: 409 }
    );
  }

  const transition = await recordTransition(organizationId, fromStatus, toStatus, actor, reason, {
    organizationType: record.organizationType,
    countryCode: record.countryCode,
  });

  const update = { status: toStatus, ...extraUpdate };
  const updated = await OrganizationVerification.findOneAndUpdate(
    { organizationId, status: fromStatus },
    { $set: update },
    { new: true }
  );
  if (!updated) {
    throw Object.assign(
      new Error('Verification state changed concurrently'),
      { code: 'CONFLICT', status: 409 }
    );
  }
  scheduleVerificationNotifications({
    organizationId,
    fromStatus,
    toStatus,
    transitionId: transition._id,
    organizationType: record.organizationType,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or create the verification record for an organization.
 * Safe for any authenticated actor (authorization at route level).
 */
export async function getVerification(organizationId) {
  const { record } = await resolveRecord(organizationId);
  return record;
}

/**
 * Mark email as verified (organization-initiated).
 * Transition: draft → email_verified.
 */
export async function markEmailVerified(organizationId, actor) {
  return applyTransition(organizationId, VS.EMAIL_VERIFIED, actor, 'Email address verified');
}

/**
 * Submit the verification profile.
 * Validates completeness; transition: email_verified|rejected|expired → verification_pending.
 * Also accepted from needs_information (re-submission after info request).
 */
export async function submitVerification(organizationId, profile, actor) {
  const completeness = validateSubmissionCompleteness(profile);
  if (!completeness.ok) {
    throw Object.assign(
      new Error(`Incomplete submission: missing ${completeness.missing.join(', ')}`),
      { code: 'INCOMPLETE_SUBMISSION', status: 422, missing: completeness.missing }
    );
  }

  const { record } = await resolveRecord(organizationId);
  const fromStatus = record.status;

  if (!isValidTransition(fromStatus, VS.VERIFICATION_PENDING)) {
    throw Object.assign(
      new Error(`Cannot submit from status: ${fromStatus}`),
      { code: 'INVALID_TRANSITION', status: 409 }
    );
  }

  const now = new Date();
  const slaDeadlineAt = computeSlaDeadline(now);

  const transition = await recordTransition(organizationId, fromStatus, VS.VERIFICATION_PENDING, actor, 'Profile submitted for verification', {
    organizationType: record.organizationType,
    profileSummary: {
      legalName: profile.legalName,
      countryCode: profile.countryCode,
      hasRegistrationNumber: !!profile.registrationNumber,
      hasLicense: !!profile.licenseNumber,
    },
  });

  const updated = await OrganizationVerification.findOneAndUpdate(
    { organizationId, status: fromStatus },
    {
      $set: {
        status: VS.VERIFICATION_PENDING,
        profile,
        submittedAt: now,
        slaDeadlineAt,
        informationRequestReason: '',
      },
    },
    { new: true }
  );
  if (!updated) {
    throw Object.assign(
      new Error('Verification state changed concurrently'),
      { code: 'CONFLICT', status: 409 }
    );
  }
  scheduleVerificationNotifications({
    organizationId,
    fromStatus,
    toStatus: VS.VERIFICATION_PENDING,
    transitionId: transition._id,
    organizationType: record.organizationType,
  });
  return updated;
}

/**
 * Admin/Moderator: begin reviewing a pending/re-submitted organization.
 * Transition: verification_pending → under_review.
 */
export async function beginReview(organizationId, actor) {
  return applyTransition(organizationId, VS.UNDER_REVIEW, actor, 'Review started', {
    currentReviewerId: actor?.userId || actor?._id,
    lastReviewedAt: new Date(),
  });
}

/**
 * Admin/Moderator: request more information.
 * Transition: under_review|enhanced_review → needs_information.
 */
export async function requestInformation(organizationId, reason, actor) {
  if (!reason?.trim()) {
    throw Object.assign(
      new Error('A reason is required when requesting more information'),
      { code: 'REASON_REQUIRED', status: 422 }
    );
  }
  return applyTransition(organizationId, VS.NEEDS_INFORMATION, actor, reason, {
    informationRequestReason: reason.trim(),
    lastReviewedAt: new Date(),
  });
}

/**
 * Admin: approve the organization.
 * Transition: under_review|needs_information|enhanced_review → approved.
 * Records verifiedAt, verifiedBy, increments verificationVersion.
 */
export async function approve(organizationId, actor, reason) {
  const { record } = await resolveRecord(organizationId);
  const fromStatus = record.status;

  if (!isValidTransition(fromStatus, VS.APPROVED)) {
    throw Object.assign(
      new Error(`Cannot approve from status: ${fromStatus}`),
      { code: 'INVALID_TRANSITION', status: 409 }
    );
  }

  const now = new Date();

  // Recompute badges from current accepted evidence
  const evidenceRecords = await VerificationEvidence.find({ organizationId }).select('evidenceType status').lean();
  const earnedBadges = deriveBadges(evidenceRecords);

  const transition = await recordTransition(organizationId, fromStatus, VS.APPROVED, actor, reason || 'Approved', {
    organizationType: record.organizationType,
    badgesEarned: earnedBadges,
  });

  const updated = await OrganizationVerification.findOneAndUpdate(
    { organizationId, status: fromStatus },
    {
      $set: {
        status: VS.APPROVED,
        verifiedAt: now,
        verifiedBy: actor?.userId || actor?._id,
        earnedBadges,
        lastReviewedAt: now,
        initialDecisionAt: record.initialDecisionAt || now,
        reviewNotes: reason || '',
      },
      $inc: { verificationVersion: 1 },
    },
    { new: true }
  );
  if (!updated) {
    throw Object.assign(
      new Error('Verification state changed concurrently'),
      { code: 'CONFLICT', status: 409 }
    );
  }
  scheduleVerificationNotifications({
    organizationId,
    fromStatus,
    toStatus: VS.APPROVED,
    transitionId: transition._id,
    organizationType: record.organizationType,
  });
  return updated;
}

/**
 * Admin: reject the organization.
 * Transition: under_review|needs_information|enhanced_review → rejected.
 * Reason is required.
 */
export async function reject(organizationId, actor, reason) {
  if (!reason?.trim()) {
    throw Object.assign(
      new Error('A rejection reason is required'),
      { code: 'REASON_REQUIRED', status: 422 }
    );
  }

  const { record } = await resolveRecord(organizationId);
  const fromStatus = record.status;
  const now = new Date();

  if (!isValidTransition(fromStatus, VS.REJECTED)) {
    throw Object.assign(
      new Error(`Cannot reject from status: ${fromStatus}`),
      { code: 'INVALID_TRANSITION', status: 409 }
    );
  }

  const transition = await recordTransition(organizationId, fromStatus, VS.REJECTED, actor, reason, {
    organizationType: record.organizationType,
  });

  const updated = await OrganizationVerification.findOneAndUpdate(
    { organizationId, status: fromStatus },
    {
      $set: {
        status: VS.REJECTED,
        rejectionReason: reason.trim(),
        lastReviewedAt: now,
        initialDecisionAt: record.initialDecisionAt || now,
      },
    },
    { new: true }
  );
  if (!updated) {
    throw Object.assign(
      new Error('Verification state changed concurrently'),
      { code: 'CONFLICT', status: 409 }
    );
  }
  scheduleVerificationNotifications({
    organizationId,
    fromStatus,
    toStatus: VS.REJECTED,
    transitionId: transition._id,
    organizationType: record.organizationType,
  });
  return updated;
}

/**
 * Admin/Moderator: escalate to enhanced review.
 * Transition: under_review|needs_information → enhanced_review.
 */
export async function escalate(organizationId, actor, reason) {
  return applyTransition(organizationId, VS.ENHANCED_REVIEW, actor, reason || 'Escalated for enhanced review', {
    lastReviewedAt: new Date(),
  });
}

/**
 * Admin: suspend an approved organization.
 * Clears earned badges — capability gate is immediately revoked.
 */
export async function suspend(organizationId, actor, reason) {
  if (!reason?.trim()) {
    throw Object.assign(
      new Error('A suspension reason is required'),
      { code: 'REASON_REQUIRED', status: 422 }
    );
  }

  const result = await applyTransition(organizationId, VS.SUSPENDED, actor, reason, {
    earnedBadges: [],
    lastReviewedAt: new Date(),
  });

  return result;
}

/**
 * SuperAdmin: permanently revoke.
 * Highest-risk action; clears badges and cannot be undone except by
 * SuperAdmin returning to a different status (ALLOWED_TRANSITIONS[REVOKED] = []).
 */
export async function revoke(organizationId, actor, reason) {
  if (!reason?.trim()) {
    throw Object.assign(
      new Error('A revocation reason is required'),
      { code: 'REASON_REQUIRED', status: 422 }
    );
  }

  return applyTransition(organizationId, VS.REVOKED, actor, reason, {
    earnedBadges: [],
    lastReviewedAt: new Date(),
  });
}

/**
 * Unsuspend a suspended organization back to approved.
 * Admin-level action.
 */
export async function unsuspend(organizationId, actor, reason) {
  const evidenceRecords = await VerificationEvidence.find({ organizationId }).select('evidenceType status').lean();
  const earnedBadges = deriveBadges(evidenceRecords);

  return applyTransition(organizationId, VS.APPROVED, actor, reason || 'Suspension lifted', {
    earnedBadges,
    lastReviewedAt: new Date(),
  });
}

/**
 * Policy/system: mark as expired.
 * Can be re-entered via verification_pending | under_review.
 * (Schedulers are a future mission — this is the boundary to call them into.)
 */
export async function expire(organizationId, actor, reason) {
  return applyTransition(organizationId, VS.EXPIRED, actor, reason || 'Verification expired', {
    earnedBadges: [],
  });
}

// ---------------------------------------------------------------------------
// Evidence management
// ---------------------------------------------------------------------------

/**
 * Add an evidence record for an organization.
 * Caller must be the organization owner or an authorized admin.
 */
export async function addEvidence(organizationId, evidenceData, actor) {
  if (!isValidEvidenceType(evidenceData?.evidenceType)) {
    throw Object.assign(
      new Error('Invalid evidenceType'),
      { code: 'INVALID_EVIDENCE_TYPE', status: 422 }
    );
  }

  // Safe metadata check
  if (evidenceData.safeMetadata) {
    const forbidden = findForbiddenMetadataKeys(evidenceData.safeMetadata);
    if (forbidden.length) {
      throw Object.assign(
        new Error(`Evidence metadata contains forbidden key(s): ${forbidden.join(', ')}`),
        { code: 'FORBIDDEN_METADATA', status: 422 }
      );
    }
  }

  const evidence = await VerificationEvidence.create({
    organizationId,
    evidenceType: evidenceData.evidenceType,
    status: EVIDENCE_STATUSES.PENDING,
    sourceUrl: evidenceData.sourceUrl || '',
    evidenceRef: evidenceData.evidenceRef || '',
    safeMetadata: evidenceData.safeMetadata || {},
    expiresAt: evidenceData.expiresAt,
    correlationId: actor?.correlationId || '',
    submittedAt: new Date(),
  });

  await logAudit({
    actor,
    action: 'verification.evidence.submitted',
    targetType: 'VerificationEvidence',
    targetId: String(evidence._id),
    status: 'success',
    metadata: {
      organizationId: String(organizationId),
      evidenceType: evidenceData.evidenceType,
    },
  });

  return evidence;
}

/**
 * Admin/Moderator: review an evidence record (accept or reject).
 * Verifies cross-organization isolation: evidenceId must belong to organizationId.
 */
export async function reviewEvidence(organizationId, evidenceId, status, reason, actor) {
  if (!isValidEvidenceStatus(status)) {
    throw Object.assign(
      new Error('Invalid evidence status'),
      { code: 'INVALID_EVIDENCE_STATUS', status: 422 }
    );
  }

  // Cross-organization isolation: query with BOTH fields
  const evidence = await VerificationEvidence.findOne({ _id: evidenceId, organizationId });
  if (!evidence) {
    throw Object.assign(
      new Error('Evidence record not found'),
      { code: 'NOT_FOUND', status: 404 }
    );
  }

  evidence.status = status;
  evidence.reviewedAt = new Date();
  evidence.reviewedBy = actor?.userId || actor?._id;
  if (status === EVIDENCE_STATUSES.REJECTED && reason) {
    evidence.rejectionReason = reason.trim();
  }
  await evidence.save();

  // Recompute badges for the organization
  await recomputeBadges(organizationId);

  await logAudit({
    actor,
    action: `verification.evidence.${status}`,
    targetType: 'VerificationEvidence',
    targetId: String(evidenceId),
    status: 'success',
    metadata: {
      organizationId: String(organizationId),
      evidenceType: evidence.evidenceType,
      reason: reason || '',
    },
  });

  return evidence;
}

/**
 * Recompute and persist earned badges from current accepted evidence.
 * Called after evidence reviews and approval. Returns updated badge array.
 */
export async function recomputeBadges(organizationId) {
  const evidenceRecords = await VerificationEvidence.find({ organizationId })
    .select('evidenceType status')
    .lean();
  const earned = deriveBadges(evidenceRecords);

  await OrganizationVerification.updateOne(
    { organizationId },
    { $set: { earnedBadges: earned } }
  );
  return earned;
}

/**
 * Get all evidence records for an organization.
 * Authorization is at the route level; this enforces isolation by organizationId.
 */
export async function getEvidence(organizationId) {
  return VerificationEvidence.find({ organizationId })
    .sort({ submittedAt: -1 })
    .lean();
}

/**
 * Get transition history for an organization (most recent first).
 */
export async function getTransitionHistory(organizationId) {
  return VerificationTransition.find({ organizationId })
    .sort({ occurredAt: -1 })
    .lean();
}

// ---------------------------------------------------------------------------
// Risk management
// ---------------------------------------------------------------------------

/**
 * Set risk level and add a risk signal. High/critical automatically escalates
 * to enhanced_review if currently under_review.
 */
export async function recordRiskSignal(organizationId, signal, detail, actor) {
  if (!isValidRiskSignal(signal)) {
    throw Object.assign(
      new Error('Invalid risk signal'),
      { code: 'INVALID_RISK_SIGNAL', status: 422 }
    );
  }

  const { record } = await resolveRecord(organizationId);

  // Recompute risk level: escalate never de-escalates via this call
  const signalCount = (record.riskSignals?.length || 0) + 1;
  let newRiskLevel = record.riskLevel;
  if (signalCount >= 3) newRiskLevel = RISK_LEVELS.HIGH;
  else if (signalCount >= 2) newRiskLevel = RISK_LEVELS.MEDIUM;

  if (signal === 'suspicious_claim' || signal === 'duplicate_organization') {
    newRiskLevel = RISK_LEVELS.HIGH;
  }

  await OrganizationVerification.updateOne(
    { organizationId },
    {
      $push: { riskSignals: { signal, detail: detail || '', detectedAt: new Date() } },
      $set: { riskLevel: newRiskLevel },
    }
  );

  // Auto-escalate high/critical risk in active review
  if (
    requiresEnhancedReview(newRiskLevel) &&
    record.status === VS.UNDER_REVIEW
  ) {
    await applyTransition(
      organizationId,
      VS.ENHANCED_REVIEW,
      actor,
      `Auto-escalated: ${signal} (risk level ${newRiskLevel})`
    );
  }

  await logAudit({
    actor,
    action: 'verification.risk.signal',
    targetType: 'OrganizationVerification',
    targetId: String(organizationId),
    status: 'success',
    metadata: { signal, newRiskLevel },
  });

  return { newRiskLevel };
}

// ---------------------------------------------------------------------------
// Capability gate
// ---------------------------------------------------------------------------

/**
 * Returns whether the given organization may exercise privileged capabilities.
 * This is the canonical gate for all future Mission guards.
 * Does NOT throw — callers handle the false case.
 */
export async function canPerformPrivilegedAction(organizationId) {
  const record = await OrganizationVerification.findOne({ organizationId })
    .select('status')
    .lean();
  if (!record) return false;
  return canExercisePrivilegedCapability(record.status);
}

// ---------------------------------------------------------------------------
// Admin queue
// ---------------------------------------------------------------------------

const QUEUE_STATUSES = [
  VS.VERIFICATION_PENDING,
  VS.UNDER_REVIEW,
  VS.NEEDS_INFORMATION,
  VS.ENHANCED_REVIEW,
];

function escapeRegex(val) {
  return String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Admin verification queue — supports status/type/country/search filtering.
 * Does not search confidential evidence contents.
 */
export async function getVerificationQueue({
  status,
  organizationType,
  countryCode,
  riskLevel,
  q,
  submittedFrom,
  submittedTo,
  claimState,
  page = 1,
  limit = 20,
} = {}) {
  const query = {};

  const statusList = (Array.isArray(status) ? status : status ? [status] : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (statusList.includes('all')) {
    // Reviewer explicitly requested every lifecycle state, including draft.
  } else if (statusList.length) {
    query.status = { $in: statusList };
  } else {
    query.status = { $in: QUEUE_STATUSES };
  }

  if (organizationType === 'institution') {
    query.organizationType = { $in: INSTITUTION_ORGANIZATION_TYPES };
  } else if (organizationType) {
    query.organizationType = organizationType;
  }
  if (countryCode) query.countryCode = countryCode.toUpperCase();
  if (riskLevel) query.riskLevel = riskLevel;

  if (submittedFrom || submittedTo) {
    query.submittedAt = {};
    if (submittedFrom) query.submittedAt.$gte = new Date(submittedFrom);
    if (submittedTo) query.submittedAt.$lte = new Date(submittedTo);
  }

  if (q && String(q).trim()) {
    const re = new RegExp(escapeRegex(String(q).trim().slice(0, 100)), 'i');
    const matchingOrgs = await Organization.find({
      $or: [{ displayName: re }, { legalName: re }],
    }).select('_id').limit(50).lean();
    query.$or = [
      { 'profile.legalName': re },
      { 'profile.displayName': re },
      { 'profile.registrationNumber': re },
      { organizationId: { $in: matchingOrgs.map((o) => o._id) } },
    ];
  }

  if (claimState) {
    const claimsForState = await InstitutionClaim.find({ state: claimState })
      .select('organizationId')
      .lean();
    query.organizationId = { $in: claimsForState.map((c) => c.organizationId) };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    OrganizationVerification.find(query)
      .sort({ riskLevel: -1, slaDeadlineAt: 1, submittedAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('organizationId', 'displayName legalName organizationType countryCode slug')
      .populate('currentReviewerId', 'email role')
      .lean(),
    OrganizationVerification.countDocuments(query),
  ]);

  const orgIds = items.map((row) => row.organizationId?._id || row.organizationId).filter(Boolean);
  const claims = orgIds.length
    ? await InstitutionClaim.find({ organizationId: { $in: orgIds } })
      .select('organizationId state submittedAt canonicalInstitutionId')
      .sort({ submittedAt: -1 })
      .lean()
    : [];
  const claimByOrg = new Map();
  for (const claim of claims) {
    const key = String(claim.organizationId);
    if (!claimByOrg.has(key)) claimByOrg.set(key, claim);
  }

  const enriched = items.map((row) => {
    const key = String(row.organizationId?._id || row.organizationId || '');
    const claim = claimByOrg.get(key) || null;
    return {
      ...row,
      canonicalClaimState: claim?.state || null,
      canonicalClaimId: claim?._id || null,
    };
  });

  return { items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
}
