import {
  FREE_BETA_POLICY_VERSION,
  JOB_PUBLICATION_STATE,
  PUBLISHING_POLICY_CODES,
  PUBLICATION_SUBMISSION_KINDS,
} from '../../config/freeBetaPublishingPolicy.js';
import { resolveEmployerPublishingQuotaOwner } from './QuotaOwnerResolver.js';
import {
  buildEmployerVerificationSnapshot,
  evaluateEmployerSubmissionEligibility,
} from './EmployerSubmissionEligibility.js';
import {
  CORRECTION_CONTENT_FIELDS,
  evaluateReviewerCorrectionExemption,
} from './ReviewerCorrectionEligibility.js';
import { validatePublicationCandidate } from './contracts/PublicationCandidateContract.js';
import {
  buildPublishingOperationContext,
  comparePublishingOperationIdentity,
  validatePublishingOperationContext,
  validatePublishingOperationSeed,
} from './contracts/PublishingOperationContextContract.js';

const DISPLAY_TIMEZONE = 'Asia/Karachi';
const ALLOWED_COMMAND_FIELDS = new Set([
  'authenticatedEmployerId',
  'jobId',
  'submissionKind',
  'expectedPublicationVersion',
  'idempotencyKey',
  'postingRules',
  'correctionOfSubmissionId',
]);
const ALLOWED_POSTING_RULES_FIELDS = new Set(['accepted', 'version']);
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const HEX_DIGEST = /^[a-f0-9]{64}$/i;
// Fatal blockers mean the command cannot safely be accepted as a correction
// of the same owned vacancy. Every other known exemption blocker below is a
// valid correction that falls back to ordinary charged quota treatment.
const FATAL_CORRECTION_BLOCKERS = new Set([
  'NO_PREVIOUS_REJECTION',
  'NOT_IMMEDIATE_PREDECESSOR',
  'DIFFERENT_JOB',
  'INVALID_CONTENT_SNAPSHOT',
]);
const CHARGEABLE_CORRECTION_BLOCKERS = new Set([
  'MODERATION_CYCLE_MISSING',
  'MODERATION_CYCLE_MISMATCH',
  'CORRECTION_WINDOW_EXPIRED',
  'EXEMPT_CORRECTION_ALREADY_USED',
  'NO_REQUESTED_CORRECTION_FIELDS',
  'UNREQUESTED_FIELD_CHANGED',
  'CORE_VACANCY_CHANGED',
  'NO_REQUESTED_FIELD_CHANGED',
]);

export const TRANSACTION_SERVICE_BOUNDARY_OUTCOMES = Object.freeze([
  'COMMIT_ACKNOWLEDGED',
  'DEFINITELY_ABORTED',
  'APPLICATION_ERROR_BEFORE_COMMIT',
  'COMMIT_RESULT_UNKNOWN',
]);

export const TRANSACTION_SERVICE_BOUNDARY_INPUT_FIELDS = Object.freeze([
  'operationSeed',
  'candidate',
  'requestFingerprint',
  'rulesDigest',
  'employerEligibility',
  'correctionDecision',
  'quotaSnapshot',
]);

export const TRANSACTION_SERVICE_BOUNDARY_OPERATION_FIELDS = Object.freeze([
  'schemaVersion',
  'operationContext',
  'intendedEffects',
]);

export const TRANSACTION_SERVICE_BOUNDARY_EFFECT_FIELDS = Object.freeze([
  'quotaGuard',
  'acknowledgement',
  'submission',
  'canonicalJobCompareAndSet',
  'moderationEvent',
  'outboxIntents',
]);

export const TRANSACTION_SERVICE_BOUNDARY_RESULT_FIELDS = Object.freeze([
  'status',
  'code',
  'message',
  'commitAcknowledged',
  'definitelyAborted',
  'reconciliationRequired',
  'automaticRetryAllowed',
  'sameKeyRetryMayBeAuthorized',
]);

const TRANSACTION_SERVICE_BOUNDARY_MESSAGES = Object.freeze({
  SUBMISSION_COMMITTED: 'The submission transaction was committed.',
  TRANSACTION_DEFINITELY_ABORTED:
    'The submission transaction was definitely aborted.',
  TRANSACTION_APPLICATION_ERROR:
    'The submission transaction stopped before commit.',
  TRANSACTION_COMMIT_RESULT_UNKNOWN:
    'The submission transaction requires reconciliation.',
  TRANSACTION_COMMIT_EVIDENCE_CONFLICT:
    'The submission transaction requires integrity reconciliation.',
  TRANSACTION_BOUNDARY_INPUT_INVALID:
    'The submission transaction input is invalid.',
  TRANSACTION_BOUNDARY_CANDIDATE_INVALID:
    'The publication candidate is invalid.',
  TRANSACTION_BOUNDARY_OPERATION_INVALID:
    'The publishing operation context is invalid.',
  TRANSACTION_BOUNDARY_ELIGIBILITY_REJECTED:
    'The employer is not eligible to submit this job.',
  TRANSACTION_BOUNDARY_QUOTA_REJECTED:
    'The Free Beta submission quota has been reached.',
  TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED:
    'A compatible transaction executor is required.',
});

const BOUNDARY_INPUT_FIELDS = TRANSACTION_SERVICE_BOUNDARY_INPUT_FIELDS;
const BOUNDARY_FACTORY_FIELDS = Object.freeze(['transactionExecutor']);
const EMPLOYER_ELIGIBILITY_FIELDS = Object.freeze([
  'eligible',
  'verificationSnapshot',
]);
const VERIFICATION_SNAPSHOT_FIELDS = Object.freeze([
  'verified',
  'verificationLevel',
  'accountStatus',
  'normalizedCompanyName',
  'emailPresent',
  'emailValid',
  'emailDomain',
  'websiteDomain',
  'requiredProfileChecks',
  'predicateCapabilityVersion',
  'eligibilityResultCodes',
]);
const PROFILE_CHECK_FIELDS = Object.freeze([
  'companyName',
  'email',
  'companyDescription',
  'industry',
  'location',
  'website',
]);
const CORRECTION_DECISION_FIELDS = Object.freeze([
  'classification',
  'quotaCharged',
  'quotaExemptionReason',
  'moderationCycleId',
  'blockerCodes',
]);
const CORRECTION_CLASSIFICATIONS = Object.freeze([
  'not_applicable',
  'charged_correction',
  'reviewer_requested_exempt',
]);
const QUOTA_SNAPSHOT_FIELDS = Object.freeze([
  'policyCode',
  'policyVersion',
  'capturedAt',
  'before',
  'after',
]);
const QUOTA_USAGE_FIELDS = Object.freeze([
  'daily',
  'rolling30Days',
  'activeFreeJobs',
]);
const DAILY_USAGE_FIELDS = Object.freeze([
  'used',
  'limit',
  'remaining',
  'nextEligibleAt',
]);
const MONTHLY_USAGE_FIELDS = Object.freeze([
  'used',
  'limit',
  'remaining',
  'nextSlotAt',
]);
const ACTIVE_USAGE_FIELDS = Object.freeze([
  'planCode',
  'used',
  'limit',
  'remaining',
  'hasCapacity',
]);
const EXECUTOR_RESULT_FIELDS = Object.freeze(['outcome']);
const ACKNOWLEDGED_EXECUTOR_RESULT_FIELDS = Object.freeze([
  'outcome',
  'operationContext',
]);
const TRANSACTION_EXECUTOR_FIELDS = Object.freeze(['execute']);
const BOUNDARY_UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CANONICAL_OBJECT_ID = /^[a-f0-9]{24}$/u;
const CANONICAL_HASH = /^[a-f0-9]{64}$/u;
const CANONICAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DOMAIN_NAME =
  /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const RECONCILIATION_CONTEXTS = new WeakMap();

export class TransactionalSubmissionBoundaryError extends Error {
  constructor(status, code) {
    super(
      TRANSACTION_SERVICE_BOUNDARY_MESSAGES[code] ||
        TRANSACTION_SERVICE_BOUNDARY_MESSAGES.TRANSACTION_BOUNDARY_INPUT_INVALID
    );
    this.name = 'TransactionalSubmissionBoundaryError';
    this.status = status;
    this.code = Object.hasOwn(TRANSACTION_SERVICE_BOUNDARY_MESSAGES, code)
      ? code
      : 'TRANSACTION_BOUNDARY_INPUT_INVALID';
  }

  toJSON() {
    return Object.freeze({
      status: this.status,
      code: this.code,
      message: this.message,
    });
  }
}

function boundaryError(status, code) {
  return new TransactionalSubmissionBoundaryError(status, code);
}

function deepFreezeBoundary(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreezeBoundary(child);
    }
    Object.freeze(value);
  }
  return value;
}

function assertBoundaryRecord(
  value,
  fields,
  code = 'TRANSACTION_BOUNDARY_INPUT_INVALID'
) {
  const status = code === 'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED' ? 503 : 400;
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw boundaryError(status, code);
    }

    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== fields.length ||
      fields.some((field) => !keys.includes(field))
    ) {
      throw boundaryError(status, code);
    }

    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== 'string' ||
        BOUNDARY_UNSAFE_KEYS.has(key) ||
        key.includes('.') ||
        key.startsWith('$') ||
        !descriptor ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) {
        throw boundaryError(status, code);
      }
    }
  } catch (error) {
    if (error instanceof TransactionalSubmissionBoundaryError) {
      throw error;
    }
    throw boundaryError(status, code);
  }
}

function canonicalBoundaryIso(value) {
  let canonical = false;
  try {
    canonical =
      typeof value === 'string' &&
      CANONICAL_ISO.test(value) &&
      new Date(value).toISOString() === value;
  } catch {
    canonical = false;
  }
  if (!canonical) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return value;
}

function canonicalBoundaryStringArray(value, allowedValues) {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
    }
    const keys = Reflect.ownKeys(value);
    const expectedKeys = [...value.map((_, index) => String(index)), 'length'];
    if (
      keys.length !== expectedKeys.length ||
      expectedKeys.some((key) => !keys.includes(key))
    ) {
      throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
      }
    }
    if (
      value.some(
        (item) =>
          typeof item !== 'string' ||
          (allowedValues && !allowedValues.has(item))
      ) ||
      new Set(value).size !== value.length
    ) {
      throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
    }
    return Object.freeze([...value]);
  } catch (error) {
    if (error instanceof TransactionalSubmissionBoundaryError) throw error;
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
}

function canonicalBoundaryHash(value) {
  if (typeof value !== 'string' || !CANONICAL_HASH.test(value)) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return value;
}

function canonicalOptionalDomain(value) {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length > 253 ||
    !DOMAIN_NAME.test(value)
  ) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return value;
}

function canonicalOptionalText(value, maximumLength) {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximumLength ||
    value !== value.trim()
  ) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return value;
}

function copyVerificationSnapshot(value) {
  assertBoundaryRecord(value, VERIFICATION_SNAPSHOT_FIELDS);
  assertBoundaryRecord(value.requiredProfileChecks, PROFILE_CHECK_FIELDS);
  if (
    value.verified !== true ||
    !['verified', 'trusted'].includes(value.verificationLevel) ||
    value.accountStatus !== 'active' ||
    typeof value.emailPresent !== 'boolean' ||
    typeof value.emailValid !== 'boolean' ||
    value.emailPresent !== true ||
    value.emailValid !== true ||
    !PROFILE_CHECK_FIELDS.every(
      (field) => value.requiredProfileChecks[field] === true
    ) ||
    value.predicateCapabilityVersion !== 'free-beta-employer-eligibility-v1' ||
    canonicalBoundaryStringArray(value.eligibilityResultCodes).length !== 0
  ) {
    throw boundaryError(403, 'TRANSACTION_BOUNDARY_ELIGIBILITY_REJECTED');
  }
  const snapshot = {
    verified: true,
    verificationLevel: value.verificationLevel,
    accountStatus: 'active',
    normalizedCompanyName: canonicalOptionalText(
      value.normalizedCompanyName,
      300
    ),
    emailPresent: true,
    emailValid: true,
    emailDomain: canonicalOptionalDomain(value.emailDomain),
    websiteDomain: canonicalOptionalDomain(value.websiteDomain),
    requiredProfileChecks: {
      companyName: true,
      email: true,
      companyDescription: true,
      industry: true,
      location: true,
      website: true,
    },
    predicateCapabilityVersion: value.predicateCapabilityVersion,
    eligibilityResultCodes: [],
  };
  return deepFreezeBoundary(snapshot);
}

function validateEmployerEligibility(value) {
  assertBoundaryRecord(value, EMPLOYER_ELIGIBILITY_FIELDS);
  if (value.eligible !== true) {
    throw boundaryError(403, 'TRANSACTION_BOUNDARY_ELIGIBILITY_REJECTED');
  }
  return deepFreezeBoundary({
    eligible: true,
    verificationSnapshot: copyVerificationSnapshot(value.verificationSnapshot),
  });
}

function canonicalUsageNumber(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return value;
}

function canonicalUsageTime(value) {
  return value === null ? null : canonicalBoundaryIso(value);
}

function copyRollingUsage(value, fields, timeField, expectedLimit) {
  assertBoundaryRecord(value, fields);
  const used = canonicalUsageNumber(value.used);
  const limit = canonicalUsageNumber(value.limit);
  const remaining = canonicalUsageNumber(value.remaining);
  if (limit !== expectedLimit || remaining !== Math.max(0, limit - used)) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return deepFreezeBoundary({
    used,
    limit,
    remaining,
    [timeField]: canonicalUsageTime(value[timeField]),
  });
}

function copyActiveUsage(value) {
  assertBoundaryRecord(value, ACTIVE_USAGE_FIELDS);
  const used = canonicalUsageNumber(value.used);
  const limit = canonicalUsageNumber(value.limit);
  const remaining = canonicalUsageNumber(value.remaining);
  if (
    value.planCode !== PUBLISHING_POLICY_CODES.FREE_BETA ||
    limit !== 5 ||
    remaining !== Math.max(0, limit - used) ||
    value.hasCapacity !== used < limit
  ) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return deepFreezeBoundary({
    planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
    used,
    limit,
    remaining,
    hasCapacity: value.hasCapacity,
  });
}

function copyUsageSnapshot(value) {
  assertBoundaryRecord(value, QUOTA_USAGE_FIELDS);
  return deepFreezeBoundary({
    daily: copyRollingUsage(
      value.daily,
      DAILY_USAGE_FIELDS,
      'nextEligibleAt',
      1
    ),
    rolling30Days: copyRollingUsage(
      value.rolling30Days,
      MONTHLY_USAGE_FIELDS,
      'nextSlotAt',
      10
    ),
    activeFreeJobs: copyActiveUsage(value.activeFreeJobs),
  });
}

function validateCorrectionDecision(value, operationSeed) {
  assertBoundaryRecord(value, CORRECTION_DECISION_FIELDS);
  if (
    !CORRECTION_CLASSIFICATIONS.includes(value.classification) ||
    typeof value.quotaCharged !== 'boolean' ||
    !CANONICAL_OBJECT_ID.test(value.moderationCycleId) ||
    !Array.isArray(value.blockerCodes)
  ) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  const majorEdit = operationSeed.operationKind === 'major_edit_submission';
  const blockerCodes = canonicalBoundaryStringArray(
    value.blockerCodes,
    CHARGEABLE_CORRECTION_BLOCKERS
  );
  const exempt = value.classification === 'reviewer_requested_exempt';
  const chargedCorrection = value.classification === 'charged_correction';
  if (
    (majorEdit &&
      (value.classification !== 'not_applicable' ||
        value.quotaCharged !== true ||
        value.quotaExemptionReason !== null ||
        value.moderationCycleId !== operationSeed.newModerationCycleId ||
        blockerCodes.length !== 0)) ||
    (!majorEdit && value.classification === 'not_applicable') ||
    (chargedCorrection &&
      (value.quotaCharged !== true ||
        value.quotaExemptionReason !== null ||
        value.moderationCycleId !== operationSeed.newModerationCycleId ||
        blockerCodes.length === 0)) ||
    (exempt &&
      (value.quotaCharged !== false ||
        value.quotaExemptionReason !== 'reviewer_requested_correction' ||
        blockerCodes.length !== 0))
  ) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  return deepFreezeBoundary({
    classification: value.classification,
    quotaCharged: value.quotaCharged,
    quotaExemptionReason: value.quotaExemptionReason,
    moderationCycleId: value.moderationCycleId,
    blockerCodes,
  });
}

function validateQuotaSnapshot(value, operationSeed, correctionDecision) {
  assertBoundaryRecord(value, QUOTA_SNAPSHOT_FIELDS);
  if (
    value.policyCode !== PUBLISHING_POLICY_CODES.FREE_BETA ||
    value.policyVersion !== FREE_BETA_POLICY_VERSION ||
    canonicalBoundaryIso(value.capturedAt) !== operationSeed.initiatedAt
  ) {
    throw boundaryError(400, 'TRANSACTION_BOUNDARY_INPUT_INVALID');
  }
  const before = copyUsageSnapshot(value.before);
  const after = copyUsageSnapshot(value.after);
  const chargedDelta = correctionDecision.quotaCharged ? 1 : 0;
  const activeDelta =
    operationSeed.operationKind === 'major_edit_submission' ? -1 : 0;
  if (
    (correctionDecision.quotaCharged &&
      (before.daily.used >= before.daily.limit ||
        before.rolling30Days.used >= before.rolling30Days.limit)) ||
    after.daily.used !== before.daily.used + chargedDelta ||
    after.rolling30Days.used !== before.rolling30Days.used + chargedDelta ||
    after.activeFreeJobs.used !== before.activeFreeJobs.used + activeDelta ||
    after.daily.nextEligibleAt !== before.daily.nextEligibleAt ||
    after.rolling30Days.nextSlotAt !== before.rolling30Days.nextSlotAt
  ) {
    throw boundaryError(429, 'TRANSACTION_BOUNDARY_QUOTA_REJECTED');
  }
  return deepFreezeBoundary({
    policyCode: PUBLISHING_POLICY_CODES.FREE_BETA,
    policyVersion: FREE_BETA_POLICY_VERSION,
    capturedAt: value.capturedAt,
    before,
    after,
  });
}

function cloneCandidateContent(content) {
  const clone = {};
  for (const [field, value] of Object.entries(content)) {
    clone[field] = Array.isArray(value) ? [...value] : value;
  }
  return deepFreezeBoundary(clone);
}

function cloneDestinationEvidence(value) {
  return deepFreezeBoundary({
    schemaVersion: value.schemaVersion,
    mode: value.mode,
    normalizedTarget: value.normalizedTarget,
    targetDigest: value.targetDigest,
    normalizedDomain: value.normalizedDomain,
    trustClassification: value.trustClassification,
    evidenceSource: value.evidenceSource,
    evaluatedAt: value.evaluatedAt,
    validationPolicyVersion: value.validationPolicyVersion,
    classifiedByActorType: value.classifiedByActorType,
    classifiedByActorId: value.classifiedByActorId,
  });
}

function clonePublicationCandidate(candidate) {
  return deepFreezeBoundary({
    schemaVersion: candidate.schemaVersion,
    policyVersion: candidate.policyVersion,
    candidateKind: candidate.candidateKind,
    candidateRevision: candidate.candidateRevision,
    baseApprovedSubmissionId: candidate.baseApprovedSubmissionId,
    baseApprovedCandidateHash: candidate.baseApprovedCandidateHash,
    basePublicationVersion: candidate.basePublicationVersion,
    expectedPublicationVersion: candidate.expectedPublicationVersion,
    previousCandidateHash: candidate.previousCandidateHash,
    content: cloneCandidateContent(candidate.content),
    destinationEvidence: cloneDestinationEvidence(
      candidate.destinationEvidence
    ),
    candidateHash: candidate.candidateHash,
  });
}

function buildContentSnapshot(candidate) {
  const content = candidate.content;
  return deepFreezeBoundary({
    contentHash: candidate.candidateHash,
    title: content.title,
    companyName: content.companyName,
    description: content.description,
    requirements: [...content.requirements],
    responsibilities: [...content.responsibilities],
    skillsRequired: [...content.skillsRequired],
    salaryRange: content.salaryRange,
    salaryCurrency: content.salaryCurrency,
    location: content.location,
    province: content.province,
    city: content.city,
    category: content.category,
    employmentType: content.employmentType,
    jobType: content.jobType,
    educationRequirement: content.educationRequirement,
    experience: content.experience,
    applicationMode:
      candidate.destinationEvidence.mode === 'internal_platform'
        ? 'internal'
        : 'external',
    applicationDomain: candidate.destinationEvidence.normalizedDomain,
    workMode: content.workMode,
    deadline: content.deadline,
    totalSeats: content.totalSeats,
  });
}

function buildOperationEvidence(context) {
  return deepFreezeBoundary({
    schemaVersion: context.schemaVersion,
    operationId: context.operationId,
    operationKind: context.operationKind,
    moderationEventId: context.moderationEventId,
    newModerationCycleId: context.newModerationCycleId,
    expectedPublicationVersion: context.expectedPublicationVersion,
    expectedPublicationState: context.expectedPublicationState,
    outboxDeduplicationKeys: {
      employerSubmissionReceived:
        context.outboxDeduplicationKeys.employerSubmissionReceived,
      adminJobReviewRequested:
        context.outboxDeduplicationKeys.adminJobReviewRequested,
    },
    initiatedAt: context.initiatedAt,
    expectedCommittedPublicationVersion:
      context.expectedCommittedPublicationVersion,
    expectedCommittedPublicationState:
      context.expectedCommittedPublicationState,
    expectedCurrentSubmissionId: context.expectedCurrentSubmissionId,
    rulesVersion: context.rulesVersion,
    rulesDigest: context.rulesDigest,
  });
}

function buildSubmittedEvidence(context, candidate) {
  return deepFreezeBoundary({
    schemaVersion: context.schemaVersion,
    operationId: context.operationId,
    operationKind: context.operationKind,
    submissionId: context.submissionId,
    candidateHash: candidate.candidateHash,
    candidateKind: candidate.candidateKind,
    candidateRevision: candidate.candidateRevision,
    destinationMode: candidate.destinationEvidence.mode,
    destinationTargetDigest: candidate.destinationEvidence.targetDigest,
    expectedPublicationVersion: context.expectedPublicationVersion,
    moderationCycleId: context.actualModerationCycleId,
    actorClassification: 'employer',
    eventType: 'submitted',
    eventTimestamp: context.initiatedAt,
  });
}

function buildBoundaryOperation({
  context,
  candidate,
  eligibility,
  correctionDecision,
  quotaSnapshot,
}) {
  const majorEdit = context.operationKind === 'major_edit_submission';
  const submissionKind = majorEdit ? 'major_edit' : 'correction';
  const slotsReleased = majorEdit ? 1 : 0;
  const contentSnapshot = buildContentSnapshot(candidate);
  const publicationCandidate = clonePublicationCandidate(candidate);
  const operationEvidence = buildOperationEvidence(context);
  const submittedEvidence = buildSubmittedEvidence(context, candidate);
  const acknowledgement = {
    _id: context.acknowledgementId,
    employerId: context.employerId,
    jobId: context.jobId,
    submissionId: context.submissionId,
    policyVersion: context.policyVersion,
    rulesVersion: context.rulesVersion,
    rulesDigest: context.rulesDigest,
    accepted: true,
    acceptedAt: context.initiatedAt,
    createdAt: context.initiatedAt,
  };
  const submission = {
    _id: context.submissionId,
    jobId: context.jobId,
    employerId: context.employerId,
    quotaOwnerType: context.ownerType,
    quotaOwnerId: context.ownerId,
    submissionKind,
    planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
    policyVersion: context.policyVersion,
    state: 'pending_review',
    acceptedAt: context.initiatedAt,
    idempotencyKey: context.idempotencyKey,
    requestFingerprint: context.requestFingerprint,
    correctionOfSubmissionId: context.correctionOfSubmissionId,
    moderationCycleId: context.actualModerationCycleId,
    quotaCharged: context.quotaCharged,
    quotaExemptionReason: correctionDecision.quotaExemptionReason,
    jobRevision: context.expectedPublicationVersion,
    contentSnapshot,
    rulesAcknowledgementId: context.acknowledgementId,
    verificationSnapshot: eligibility.verificationSnapshot,
    quotaSnapshot,
    publicationCandidate,
    operationEvidence,
    moderationSummary: null,
  };
  const canonicalJobCompareAndSet = {
    employerId: context.employerId,
    jobId: context.jobId,
    expectedPublicationVersion: context.expectedPublicationVersion,
    expectedSourceState: context.expectedPublicationState,
    expectedCurrentSubmissionId: context.submissionId,
    expectedCommittedPublicationVersion:
      context.expectedCommittedPublicationVersion,
    expectedCommittedPublicationState:
      context.expectedCommittedPublicationState,
    submissionId: context.submissionId,
    submissionKind,
    baseApprovedSubmissionId: context.baseApprovedSubmissionId,
    releaseActiveFreeSlot: majorEdit,
  };
  const moderationEvent = {
    _id: context.moderationEventId,
    jobId: context.jobId,
    submissionId: context.submissionId,
    employerId: context.employerId,
    actorType: 'employer',
    actorId: context.employerId,
    action: 'submitted',
    fromState: context.expectedPublicationState,
    toState: context.expectedCommittedPublicationState,
    reasonCode: null,
    reasonTextInternal: null,
    reasonTextEmployer: null,
    contentHash: context.candidateHash,
    metadata: {
      quotaCharged: context.quotaCharged,
      quotaExemptionReason: correctionDecision.quotaExemptionReason,
      moderationCycleId: context.actualModerationCycleId,
      submissionKind,
      currentActiveFreeJobs: quotaSnapshot.before.activeFreeJobs.used,
      projectedActiveFreeJobs: quotaSnapshot.after.activeFreeJobs.used,
      slotsReleased,
      policyVersion: context.policyVersion,
    },
    submittedEvidence,
    createdAt: context.initiatedAt,
  };
  const outboxIntents = [
    {
      type: 'employer_submission_received',
      deduplicationKey:
        context.outboxDeduplicationKeys.employerSubmissionReceived,
      aggregateId: context.submissionId,
      employerId: context.employerId,
      jobId: context.jobId,
    },
    {
      type: 'admin_job_review_requested',
      deduplicationKey: context.outboxDeduplicationKeys.adminJobReviewRequested,
      aggregateId: context.submissionId,
      jobId: context.jobId,
    },
  ];
  return deepFreezeBoundary({
    schemaVersion: 1,
    operationContext: context,
    intendedEffects: {
      quotaGuard: {
        ownerType: context.ownerType,
        ownerId: context.ownerId,
        policyCode: PUBLISHING_POLICY_CODES.FREE_BETA,
        policyVersion: context.policyVersion,
      },
      acknowledgement,
      submission,
      canonicalJobCompareAndSet,
      moderationEvent,
      outboxIntents,
    },
  });
}

function boundaryResult(
  code,
  {
    status,
    commitAcknowledged,
    definitelyAborted,
    reconciliationRequired,
    sameKeyRetryMayBeAuthorized,
    reconciliationContext,
  }
) {
  const result = deepFreezeBoundary({
    status,
    code,
    message: TRANSACTION_SERVICE_BOUNDARY_MESSAGES[code],
    commitAcknowledged,
    definitelyAborted,
    reconciliationRequired,
    automaticRetryAllowed: false,
    sameKeyRetryMayBeAuthorized,
  });
  if (reconciliationContext) {
    RECONCILIATION_CONTEXTS.set(result, reconciliationContext);
  }
  return result;
}

function unknownBoundaryResult(
  context,
  { code = 'TRANSACTION_COMMIT_RESULT_UNKNOWN' } = {}
) {
  return boundaryResult(code, {
    status: 'indeterminate',
    commitAcknowledged: null,
    definitelyAborted: false,
    reconciliationRequired: true,
    sameKeyRetryMayBeAuthorized: false,
    reconciliationContext: context,
  });
}

function validateExecutorResult(value) {
  let outcome;
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, 'outcome');
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, 'value')
    ) {
      return null;
    }
    outcome = descriptor.value;
  } catch {
    return null;
  }
  if (!TRANSACTION_SERVICE_BOUNDARY_OUTCOMES.includes(outcome)) return null;
  const expectedFields =
    outcome === 'COMMIT_ACKNOWLEDGED'
      ? ACKNOWLEDGED_EXECUTOR_RESULT_FIELDS
      : EXECUTOR_RESULT_FIELDS;
  try {
    assertBoundaryRecord(value, expectedFields);
    return value;
  } catch {
    return null;
  }
}

export function getTransactionalSubmissionReconciliationContext(result) {
  const context = RECONCILIATION_CONTEXTS.get(result);
  return context || null;
}

/**
 * Dormant C5 boundary. It performs no database work and accepts no session.
 * A future adapter must generate the stable seed before invoking this API.
 */
export function createDormantTransactionalFreeBetaSubmissionBoundary(
  dependencies
) {
  assertBoundaryRecord(
    dependencies,
    BOUNDARY_FACTORY_FIELDS,
    'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED'
  );
  if (
    !dependencies.transactionExecutor ||
    typeof dependencies.transactionExecutor.execute !== 'function'
  ) {
    throw boundaryError(503, 'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED');
  }
  assertBoundaryRecord(
    dependencies.transactionExecutor,
    TRANSACTION_EXECUTOR_FIELDS,
    'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED'
  );
  const executeTransaction = dependencies.transactionExecutor.execute;

  async function executeSubmissionOperation(input) {
    assertBoundaryRecord(input, BOUNDARY_INPUT_FIELDS);
    let operationSeed;
    let candidate;
    let operationContext;
    try {
      operationSeed = validatePublishingOperationSeed(input.operationSeed);
    } catch {
      throw boundaryError(409, 'TRANSACTION_BOUNDARY_OPERATION_INVALID');
    }
    try {
      candidate = validatePublicationCandidate(input.candidate, {
        jobId: operationSeed.jobId,
      });
    } catch {
      throw boundaryError(422, 'TRANSACTION_BOUNDARY_CANDIDATE_INVALID');
    }
    const eligibility = validateEmployerEligibility(input.employerEligibility);
    const correctionDecision = validateCorrectionDecision(
      input.correctionDecision,
      operationSeed
    );
    const quotaSnapshot = validateQuotaSnapshot(
      input.quotaSnapshot,
      operationSeed,
      correctionDecision
    );
    try {
      operationContext = buildPublishingOperationContext({
        operationSeed,
        candidate,
        commitEvidence: {
          requestFingerprint: canonicalBoundaryHash(input.requestFingerprint),
          actualModerationCycleId: correctionDecision.moderationCycleId,
          expectedCommittedPublicationVersion:
            operationSeed.expectedPublicationVersion + 1,
          expectedCommittedPublicationState: 'pending_review',
          expectedCurrentSubmissionId: operationSeed.submissionId,
          rulesDigest: canonicalBoundaryHash(input.rulesDigest),
          quotaCharged: correctionDecision.quotaCharged,
        },
      });
      operationContext = validatePublishingOperationContext(operationContext, {
        candidate,
      });
    } catch (error) {
      if (error instanceof TransactionalSubmissionBoundaryError) {
        throw error;
      }
      throw boundaryError(409, 'TRANSACTION_BOUNDARY_OPERATION_INVALID');
    }
    const operation = buildBoundaryOperation({
      context: operationContext,
      candidate,
      eligibility,
      correctionDecision,
      quotaSnapshot,
    });

    let rawResult;
    try {
      rawResult = await executeTransaction(operation);
    } catch {
      return unknownBoundaryResult(operationContext);
    }
    const executorResult = validateExecutorResult(rawResult);
    if (!executorResult) {
      return unknownBoundaryResult(operationContext);
    }
    if (executorResult.outcome === 'COMMIT_RESULT_UNKNOWN') {
      return unknownBoundaryResult(operationContext);
    }
    if (executorResult.outcome === 'DEFINITELY_ABORTED') {
      return boundaryResult('TRANSACTION_DEFINITELY_ABORTED', {
        status: 'failed',
        commitAcknowledged: false,
        definitelyAborted: true,
        reconciliationRequired: false,
        sameKeyRetryMayBeAuthorized: true,
      });
    }
    if (executorResult.outcome === 'APPLICATION_ERROR_BEFORE_COMMIT') {
      return boundaryResult('TRANSACTION_APPLICATION_ERROR', {
        status: 'failed',
        commitAcknowledged: false,
        definitelyAborted: false,
        reconciliationRequired: false,
        sameKeyRetryMayBeAuthorized: true,
      });
    }

    try {
      const returnedContext = validatePublishingOperationContext(
        executorResult.operationContext,
        { candidate }
      );
      const comparison = comparePublishingOperationIdentity(
        operationContext,
        returnedContext
      );
      if (comparison.classification !== 'SAME_LOGICAL_OPERATION') {
        return unknownBoundaryResult(operationContext, {
          code: 'TRANSACTION_COMMIT_EVIDENCE_CONFLICT',
        });
      }
    } catch {
      return unknownBoundaryResult(operationContext, {
        code: 'TRANSACTION_COMMIT_EVIDENCE_CONFLICT',
      });
    }
    return boundaryResult('SUBMISSION_COMMITTED', {
      status: 'accepted',
      commitAcknowledged: true,
      definitelyAborted: false,
      reconciliationRequired: false,
      sameKeyRetryMayBeAuthorized: false,
    });
  }

  return Object.freeze({
    executeSubmissionOperation,
  });
}

export const TRANSACTIONAL_JOB_REPOSITORY_CONTRACT = Object.freeze({
  getOwnedJobForSubmission:
    'Returns an owned canonical job, or { found, owned, job } without exposing another employer.',
  compareAndSetPendingReview:
    'Atomically verifies owner, source state, publication version, and no pending submission before setting pending_review.',
});

export class PublishingSubmissionDomainError extends Error {
  constructor({ status, code, safeMessage, details }) {
    super(safeMessage);
    this.name = 'PublishingSubmissionDomainError';
    this.status = status;
    this.code = code;
    this.safeMessage = safeMessage;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }
}

function domainError(status, code, safeMessage, details) {
  return new PublishingSubmissionDomainError({
    status,
    code,
    safeMessage,
    details,
  });
}

function requireMethod(target, method, dependencyName) {
  if (!target || typeof target[method] !== 'function') {
    throw new TypeError(
      `${dependencyName}.${method} is required for the dormant submission service`
    );
  }
}

function canonicalIdentifier(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function sameIdentifier(left, right) {
  const leftId = canonicalIdentifier(left);
  return leftId.length > 0 && leftId === canonicalIdentifier(right);
}

function validateCommand(command) {
  if (
    !command ||
    typeof command !== 'object' ||
    Array.isArray(command) ||
    Object.keys(command).some((key) => !ALLOWED_COMMAND_FIELDS.has(key))
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'The submission command is invalid.'
    );
  }

  if (
    !canonicalIdentifier(command.authenticatedEmployerId) ||
    !canonicalIdentifier(command.jobId) ||
    !PUBLICATION_SUBMISSION_KINDS.includes(command.submissionKind) ||
    !Number.isInteger(command.expectedPublicationVersion) ||
    command.expectedPublicationVersion < 0
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'The submission command is invalid.'
    );
  }

  const postingRules = command.postingRules;
  if (
    !postingRules ||
    typeof postingRules !== 'object' ||
    Array.isArray(postingRules) ||
    Object.keys(postingRules).some(
      (key) => !ALLOWED_POSTING_RULES_FIELDS.has(key)
    ) ||
    typeof postingRules.version !== 'string' ||
    postingRules.version.trim().length === 0
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'The posting-rules acknowledgement is invalid.'
    );
  }

  if (postingRules.accepted !== true) {
    throw domainError(
      422,
      'POSTING_RULES_NOT_ACCEPTED',
      'The current Employer Posting Rules must be accepted.'
    );
  }

  if (
    command.submissionKind === 'correction' &&
    !canonicalIdentifier(command.correctionOfSubmissionId)
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'A correction must identify its preceding submission.'
    );
  }

  if (
    command.submissionKind !== 'correction' &&
    command.correctionOfSubmissionId !== undefined &&
    command.correctionOfSubmissionId !== null
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'Only correction submissions may identify a preceding submission.'
    );
  }

  const idempotencyKey =
    typeof command.idempotencyKey === 'string'
      ? command.idempotencyKey.trim()
      : '';
  if (
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128 ||
    !PRINTABLE_ASCII.test(idempotencyKey)
  ) {
    throw domainError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
      'The idempotency key must be 16 to 128 printable ASCII characters.'
    );
  }

  return Object.freeze({
    ...command,
    idempotencyKey,
    postingRules: Object.freeze({
      accepted: true,
      version: postingRules.version.trim(),
    }),
  });
}

function normalizeOwnedJobResult(result) {
  if (!result) {
    throw domainError(404, 'JOB_NOT_FOUND', 'The requested job was not found.');
  }
  if (result.found === false) {
    throw domainError(404, 'JOB_NOT_FOUND', 'The requested job was not found.');
  }
  if (result.owned === false) {
    throw domainError(403, 'JOB_NOT_OWNED', 'The requested job is not owned.');
  }
  return result.job || result;
}

function assertJobState(job, command) {
  const state = job?.publicationState;
  if (state === JOB_PUBLICATION_STATE.PENDING_REVIEW) {
    throw domainError(
      409,
      'SUBMISSION_ALREADY_PENDING',
      'This job already has a submission pending review.'
    );
  }

  if (
    !Number.isInteger(job?.publicationVersion) ||
    job.publicationVersion !== command.expectedPublicationVersion
  ) {
    throw domainError(
      409,
      'JOB_VERSION_CONFLICT',
      'The job changed before this submission was accepted.'
    );
  }

  const validKindsByState = {
    [JOB_PUBLICATION_STATE.DRAFT]: ['initial'],
    [JOB_PUBLICATION_STATE.REJECTED]: ['correction'],
    [JOB_PUBLICATION_STATE.EXPIRED]: ['renewal', 'repost'],
    [JOB_PUBLICATION_STATE.CLOSED]: ['renewal', 'repost'],
    [JOB_PUBLICATION_STATE.ACTIVE]: ['major_edit'],
  };

  if (!validKindsByState[state]?.includes(command.submissionKind)) {
    throw domainError(
      409,
      'JOB_STATE_NOT_SUBMITTABLE',
      'The job cannot be submitted from its current state.'
    );
  }
}

function validateContentSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    typeof snapshot.contentHash !== 'string' ||
    !HEX_DIGEST.test(snapshot.contentHash) ||
    Object.keys(snapshot).some(
      (key) => key !== 'contentHash' && !CORRECTION_CONTENT_FIELDS.includes(key)
    )
  ) {
    throw domainError(
      422,
      'INVALID_SUBMISSION_COMMAND',
      'The canonical job content snapshot is invalid.'
    );
  }
  return snapshot;
}

function validateFingerprint(value) {
  if (typeof value !== 'string' || !HEX_DIGEST.test(value)) {
    throw new TypeError(
      'requestFingerprintBuilder must return a 64-character hexadecimal digest'
    );
  }
  return value.toLowerCase();
}

function validateRulesRecord(value) {
  if (
    !value ||
    typeof value.version !== 'string' ||
    typeof value.digest !== 'string' ||
    !HEX_DIGEST.test(value.digest)
  ) {
    throw new TypeError(
      'postingRulesRegistry must return a versioned SHA-256 rules record'
    );
  }
  return value;
}

function quotaLimitError(usage) {
  if (usage.daily.used >= usage.daily.limit) {
    return domainError(
      429,
      'ROLLING_24H_LIMIT',
      'The rolling 24-hour Free Beta submission limit has been reached.',
      {
        nextEligibleAt: usage.daily.nextEligibleAt,
        displayTimezone: DISPLAY_TIMEZONE,
      }
    );
  }
  if (usage.rolling30Days.used >= usage.rolling30Days.limit) {
    return domainError(
      429,
      'ROLLING_30D_LIMIT',
      'The rolling 30-day Free Beta submission limit has been reached.',
      {
        nextEligibleAt: usage.rolling30Days.nextSlotAt,
        displayTimezone: DISPLAY_TIMEZONE,
      }
    );
  }
  return null;
}

function usageProjection(usage, { chargedDelta = 0, activeDelta = 0 } = {}) {
  const dailyUsed = usage.daily.used + chargedDelta;
  const monthlyUsed = usage.rolling30Days.used + chargedDelta;
  const activeUsed = usage.activeFreeJobs.used + activeDelta;
  const dailyLimit = usage.daily.limit;
  const monthlyLimit = usage.rolling30Days.limit;
  const activeLimit = usage.activeFreeJobs.limit;

  return Object.freeze({
    daily: Object.freeze({
      used: dailyUsed,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - dailyUsed),
      nextEligibleAt: usage.daily.nextEligibleAt ?? null,
    }),
    rolling30Days: Object.freeze({
      used: monthlyUsed,
      limit: monthlyLimit,
      remaining: Math.max(0, monthlyLimit - monthlyUsed),
      nextSlotAt: usage.rolling30Days.nextSlotAt ?? null,
    }),
    activeFreeJobs: Object.freeze({
      planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
      used: activeUsed,
      limit: activeLimit,
      remaining: Math.max(0, activeLimit - activeUsed),
      hasCapacity: activeUsed < activeLimit,
    }),
  });
}

function stableSubmissionResult(submission, { idempotentReplay }) {
  return Object.freeze({
    idempotentReplay,
    submission: Object.freeze({
      id: submission._id || submission.id,
      jobId: submission.jobId,
      state: submission.state,
      submissionKind: submission.submissionKind,
      planCode: submission.planCode,
      policyVersion: submission.policyVersion,
      acceptedAt: submission.acceptedAt,
      quotaCharged: submission.quotaCharged,
      quotaExemptionReason: submission.quotaExemptionReason ?? null,
      moderationCycleId: submission.moderationCycleId,
    }),
    publicationState: JOB_PUBLICATION_STATE.PENDING_REVIEW,
    usage: submission.quotaSnapshot?.after,
  });
}

function mappedCasError(result) {
  const code = result?.code;
  const supported = new Set([
    'JOB_NOT_OWNED',
    'JOB_VERSION_CONFLICT',
    'JOB_STATE_NOT_SUBMITTABLE',
    'SUBMISSION_ALREADY_PENDING',
  ]);
  const selected = supported.has(code) ? code : 'JOB_VERSION_CONFLICT';
  const statuses = {
    JOB_NOT_OWNED: 403,
    JOB_VERSION_CONFLICT: 409,
    JOB_STATE_NOT_SUBMITTABLE: 409,
    SUBMISSION_ALREADY_PENDING: 409,
  };
  return domainError(
    statuses[selected],
    selected,
    'The job changed before the submission transaction committed.'
  );
}

/**
 * All collaborators are provider-neutral and must preserve the supplied
 * transaction session. No production Job adapter is provided by this module.
 */
export function createTransactionalFreeBetaSubmissionService({
  transactionRunner,
  employerRepository,
  jobRepository,
  submissionRepository,
  acknowledgementRepository,
  moderationEventRepository,
  quotaUsageService,
  serializedQuotaGuard,
  notificationOutbox,
  postingRulesRegistry,
  contentSnapshotBuilder,
  requestFingerprintBuilder,
  idFactory,
  clock,
}) {
  if (
    !jobRepository ||
    typeof jobRepository.getOwnedJobForSubmission !== 'function' ||
    typeof jobRepository.compareAndSetPendingReview !== 'function'
  ) {
    throw domainError(
      503,
      'CANONICAL_JOB_REPOSITORY_REQUIRED',
      'A compatible canonical job repository is required.'
    );
  }

  requireMethod(transactionRunner, 'run', 'transactionRunner');
  requireMethod(employerRepository, 'getById', 'employerRepository');
  requireMethod(
    submissionRepository,
    'findByOwnerAndIdempotencyKey',
    'submissionRepository'
  );
  requireMethod(
    submissionRepository,
    'getCorrectionContext',
    'submissionRepository'
  );
  requireMethod(submissionRepository, 'create', 'submissionRepository');
  requireMethod(
    acknowledgementRepository,
    'create',
    'acknowledgementRepository'
  );
  requireMethod(
    moderationEventRepository,
    'getLatestForSubmission',
    'moderationEventRepository'
  );
  requireMethod(
    moderationEventRepository,
    'append',
    'moderationEventRepository'
  );
  requireMethod(quotaUsageService, 'getUsage', 'quotaUsageService');
  requireMethod(serializedQuotaGuard, 'acquire', 'serializedQuotaGuard');
  requireMethod(notificationOutbox, 'enqueueMany', 'notificationOutbox');
  requireMethod(postingRulesRegistry, 'getCurrent', 'postingRulesRegistry');
  requireMethod(contentSnapshotBuilder, 'build', 'contentSnapshotBuilder');
  requireMethod(
    requestFingerprintBuilder,
    'build',
    'requestFingerprintBuilder'
  );
  requireMethod(idFactory, 'next', 'idFactory');
  requireMethod(clock, 'now', 'clock');

  async function submitFreeBetaJob(command) {
    try {
      return await transactionRunner.run(async ({ session }) => {
        const validated = validateCommand(command);
        const acceptedAt = clock.now();
        if (
          !(acceptedAt instanceof Date) ||
          Number.isNaN(acceptedAt.getTime())
        ) {
          throw new TypeError('clock.now must return a valid Date');
        }

        const employer = await employerRepository.getById({
          employerId: validated.authenticatedEmployerId,
          session,
        });
        const eligibility = evaluateEmployerSubmissionEligibility(employer);
        if (!eligibility.eligible) {
          const first = eligibility.blockers[0];
          const status = first.code === 'EMPLOYER_NOT_FOUND' ? 404 : 403;
          throw domainError(status, first.code, first.message, {
            blockerCodes: eligibility.blockers.map(({ code }) => code),
          });
        }

        const ownedResult = await jobRepository.getOwnedJobForSubmission({
          employerId: validated.authenticatedEmployerId,
          jobId: validated.jobId,
          session,
        });
        const job = normalizeOwnedJobResult(ownedResult);
        if (
          !sameIdentifier(job.employerId, validated.authenticatedEmployerId)
        ) {
          throw domainError(
            403,
            'JOB_NOT_OWNED',
            'The requested job is not owned.'
          );
        }

        const quotaOwner = resolveEmployerPublishingQuotaOwner(employer);
        await serializedQuotaGuard.acquire(quotaOwner, { session });

        const contentSnapshot = validateContentSnapshot(
          await contentSnapshotBuilder.build({
            job,
            submissionKind: validated.submissionKind,
            session,
          })
        );
        const requestFingerprint = validateFingerprint(
          await requestFingerprintBuilder.build({
            jobId: validated.jobId,
            expectedPublicationVersion: validated.expectedPublicationVersion,
            submissionKind: validated.submissionKind,
            correctionOfSubmissionId:
              validated.correctionOfSubmissionId ?? null,
            policyVersion: FREE_BETA_POLICY_VERSION,
            rulesVersion: validated.postingRules.version,
            contentHash: contentSnapshot.contentHash,
          })
        );

        const existing =
          await submissionRepository.findByOwnerAndIdempotencyKey({
            quotaOwnerType: quotaOwner.ownerType,
            quotaOwnerId: quotaOwner.ownerId,
            idempotencyKey: validated.idempotencyKey,
            session,
          });
        if (existing) {
          if (existing.requestFingerprint !== requestFingerprint) {
            throw domainError(
              409,
              'IDEMPOTENCY_KEY_REUSED',
              'The idempotency key was already used for another submission.'
            );
          }
          return stableSubmissionResult(existing, { idempotentReplay: true });
        }

        assertJobState(job, validated);

        const currentRules = validateRulesRecord(
          await postingRulesRegistry.getCurrent({ session })
        );
        if (validated.postingRules.version !== currentRules.version) {
          throw domainError(
            409,
            'POSTING_RULES_VERSION_CHANGED',
            'The Employer Posting Rules changed before submission.',
            { currentVersion: currentRules.version }
          );
        }

        let correctionResult = null;
        let quotaCharged = true;
        let quotaExemptionReason = null;
        let moderationCycleId;

        if (validated.submissionKind === 'correction') {
          const correctionContext =
            await submissionRepository.getCorrectionContext({
              correctionOfSubmissionId: validated.correctionOfSubmissionId,
              jobId: validated.jobId,
              session,
            });
          const latestModerationEvent =
            await moderationEventRepository.getLatestForSubmission({
              submissionId: validated.correctionOfSubmissionId,
              session,
            });

          correctionResult = evaluateReviewerCorrectionExemption({
            previousSubmission: correctionContext?.previousSubmission,
            latestModerationEvent,
            correctionOfSubmissionId: validated.correctionOfSubmissionId,
            currentJobId: validated.jobId,
            currentContentSnapshot: contentSnapshot,
            previousContentSnapshot:
              correctionContext?.previousSubmission?.contentSnapshot,
            existingCycleSubmissions:
              correctionContext?.existingCycleSubmissions || [],
            now: acceptedAt,
          });

          if (
            correctionResult.blockerCodes.some((code) =>
              FATAL_CORRECTION_BLOCKERS.has(code)
            )
          ) {
            throw domainError(
              409,
              'CORRECTION_NOT_EXEMPT',
              'The correction does not match the required rejected submission.',
              { blockerCodes: correctionResult.blockerCodes }
            );
          }

          if (
            correctionResult.blockerCodes.some(
              (code) => !CHARGEABLE_CORRECTION_BLOCKERS.has(code)
            )
          ) {
            throw new TypeError(
              'Reviewer-correction blocker classification is incomplete'
            );
          }

          quotaCharged = correctionResult.quotaCharged;
          quotaExemptionReason = correctionResult.quotaExemptionReason;
          moderationCycleId = quotaCharged
            ? undefined
            : correctionResult.moderationCycleId;
        }

        const usage = await quotaUsageService.getUsage(quotaOwner, {
          now: acceptedAt,
          session,
        });
        if (quotaCharged) {
          const limitError = quotaLimitError(usage);
          if (limitError) {
            throw limitError;
          }
        }
        if (!moderationCycleId) {
          moderationCycleId = idFactory.next('moderationCycle');
        }

        const releaseActiveFreeSlot =
          job.publicationState === JOB_PUBLICATION_STATE.ACTIVE &&
          validated.submissionKind === 'major_edit';
        const slotsReleased = releaseActiveFreeSlot ? 1 : 0;
        const projectedActiveFreeJobs =
          usage.activeFreeJobs.used - slotsReleased;
        if (projectedActiveFreeJobs < 0) {
          throw new TypeError('Projected active Free Beta usage is invalid');
        }

        const acknowledgementId = idFactory.next('acknowledgement');
        const submissionId = idFactory.next('submission');
        const moderationEventId = idFactory.next('moderationEvent');
        const beforeUsage = usageProjection(usage);
        const afterUsage = usageProjection(usage, {
          chargedDelta: quotaCharged ? 1 : 0,
          activeDelta: -slotsReleased,
        });
        const quotaSnapshot = Object.freeze({
          policyCode: PUBLISHING_POLICY_CODES.FREE_BETA,
          policyVersion: FREE_BETA_POLICY_VERSION,
          capturedAt: acceptedAt,
          before: beforeUsage,
          after: afterUsage,
        });

        await acknowledgementRepository.create(
          {
            _id: acknowledgementId,
            employerId: validated.authenticatedEmployerId,
            jobId: validated.jobId,
            submissionId,
            policyVersion: FREE_BETA_POLICY_VERSION,
            rulesVersion: currentRules.version,
            rulesDigest: currentRules.digest.toLowerCase(),
            accepted: true,
            acceptedAt,
            createdAt: acceptedAt,
          },
          { session }
        );

        const submission = await submissionRepository.create(
          {
            _id: submissionId,
            jobId: validated.jobId,
            employerId: validated.authenticatedEmployerId,
            quotaOwnerType: quotaOwner.ownerType,
            quotaOwnerId: quotaOwner.ownerId,
            submissionKind: validated.submissionKind,
            planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
            policyVersion: FREE_BETA_POLICY_VERSION,
            state: 'pending_review',
            acceptedAt,
            idempotencyKey: validated.idempotencyKey,
            requestFingerprint,
            correctionOfSubmissionId:
              validated.correctionOfSubmissionId ?? null,
            moderationCycleId,
            quotaCharged,
            quotaExemptionReason,
            jobRevision: validated.expectedPublicationVersion,
            contentSnapshot,
            rulesAcknowledgementId: acknowledgementId,
            verificationSnapshot: buildEmployerVerificationSnapshot(
              employer,
              eligibility
            ),
            quotaSnapshot,
            moderationSummary: null,
          },
          { session }
        );

        const casResult = await jobRepository.compareAndSetPendingReview({
          employerId: validated.authenticatedEmployerId,
          jobId: validated.jobId,
          expectedPublicationVersion: validated.expectedPublicationVersion,
          expectedSourceState: job.publicationState,
          submissionId,
          submissionKind: validated.submissionKind,
          contentSnapshot,
          releaseActiveFreeSlot,
          session,
        });
        if (!casResult || casResult.matched !== true) {
          throw mappedCasError(casResult);
        }

        await moderationEventRepository.append(
          {
            _id: moderationEventId,
            jobId: validated.jobId,
            submissionId,
            employerId: validated.authenticatedEmployerId,
            actorType: 'employer',
            actorId: validated.authenticatedEmployerId,
            action: 'submitted',
            fromState: job.publicationState,
            toState: JOB_PUBLICATION_STATE.PENDING_REVIEW,
            reasonCode: null,
            reasonTextInternal: null,
            reasonTextEmployer: null,
            contentHash: contentSnapshot.contentHash,
            metadata: {
              quotaCharged,
              quotaExemptionReason,
              moderationCycleId,
              submissionKind: validated.submissionKind,
              currentActiveFreeJobs: usage.activeFreeJobs.used,
              projectedActiveFreeJobs,
              slotsReleased,
              policyVersion: FREE_BETA_POLICY_VERSION,
            },
            createdAt: acceptedAt,
          },
          { session }
        );

        await notificationOutbox.enqueueMany(
          [
            {
              type: 'employer_submission_received',
              deduplicationKey: `${submissionId}:employer_submission_received`,
              aggregateId: submissionId,
              employerId: validated.authenticatedEmployerId,
              jobId: validated.jobId,
            },
            {
              type: 'admin_job_review_requested',
              deduplicationKey: `${submissionId}:admin_job_review_requested`,
              aggregateId: submissionId,
              jobId: validated.jobId,
            },
          ],
          { session }
        );

        return stableSubmissionResult(submission, {
          idempotentReplay: false,
        });
      });
    } catch (error) {
      if (error instanceof PublishingSubmissionDomainError) {
        throw error;
      }
      throw domainError(
        500,
        'TRANSACTION_FAILED',
        'The submission transaction could not be completed.'
      );
    }
  }

  return Object.freeze({
    submitFreeBetaJob,
  });
}
