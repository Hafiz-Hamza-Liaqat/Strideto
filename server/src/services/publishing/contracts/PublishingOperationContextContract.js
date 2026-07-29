import {
  PUBLICATION_CANDIDATE_POLICY_VERSION,
  validatePublicationCandidate,
} from './PublicationCandidateContract.js';

export const PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION = 1;
export const PUBLISHING_OPERATION_POLICY_VERSION = 'free-beta-2026-01';

export const PUBLISHING_OPERATION_KINDS = Object.freeze([
  'major_edit_submission',
  'correction_submission',
]);

export const PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS = Object.freeze([
  'SAME_LOGICAL_OPERATION',
  'DIFFERENT_LOGICAL_OPERATION',
  'IDENTITY_CONFLICT',
]);

export const PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES = Object.freeze([
  'SCHEMA_VERSION_MISMATCH',
  'POLICY_VERSION_MISMATCH',
  'OPERATION_ID_MISMATCH',
  'OPERATION_KIND_MISMATCH',
  'OWNER_TYPE_MISMATCH',
  'OWNER_ID_MISMATCH',
  'EMPLOYER_ID_MISMATCH',
  'JOB_ID_MISMATCH',
  'IDEMPOTENCY_KEY_MISMATCH',
  'SUBMISSION_ID_MISMATCH',
  'ACKNOWLEDGEMENT_ID_MISMATCH',
  'MODERATION_EVENT_ID_MISMATCH',
  'NEW_MODERATION_CYCLE_ID_MISMATCH',
  'EXPECTED_PUBLICATION_VERSION_MISMATCH',
  'EXPECTED_PUBLICATION_STATE_MISMATCH',
  'CORRECTION_OF_SUBMISSION_ID_MISMATCH',
  'RULES_VERSION_MISMATCH',
  'EMPLOYER_SUBMISSION_RECEIVED_OUTBOX_KEY_MISMATCH',
  'ADMIN_JOB_REVIEW_REQUESTED_OUTBOX_KEY_MISMATCH',
  'INITIATED_AT_MISMATCH',
  'REQUEST_FINGERPRINT_MISMATCH',
  'CANDIDATE_HASH_MISMATCH',
  'CANDIDATE_REVISION_MISMATCH',
  'CANDIDATE_KIND_MISMATCH',
  'BASE_APPROVED_SUBMISSION_ID_MISMATCH',
  'BASE_APPROVED_CANDIDATE_HASH_MISMATCH',
  'BASE_PUBLICATION_VERSION_MISMATCH',
  'ACTUAL_MODERATION_CYCLE_ID_MISMATCH',
  'EXPECTED_COMMITTED_PUBLICATION_VERSION_MISMATCH',
  'EXPECTED_COMMITTED_PUBLICATION_STATE_MISMATCH',
  'EXPECTED_CURRENT_SUBMISSION_ID_MISMATCH',
  'RULES_DIGEST_MISMATCH',
  'QUOTA_CHARGED_MISMATCH',
]);

export const PUBLISHING_OPERATION_SEED_FIELDS = Object.freeze([
  'schemaVersion',
  'policyVersion',
  'operationId',
  'operationKind',
  'ownerType',
  'ownerId',
  'employerId',
  'jobId',
  'idempotencyKey',
  'submissionId',
  'acknowledgementId',
  'moderationEventId',
  'newModerationCycleId',
  'expectedPublicationVersion',
  'expectedPublicationState',
  'correctionOfSubmissionId',
  'rulesVersion',
  'outboxDeduplicationKeys',
  'initiatedAt',
]);

export const PUBLISHING_OPERATION_CONTEXT_FIELDS = Object.freeze([
  ...PUBLISHING_OPERATION_SEED_FIELDS,
  'requestFingerprint',
  'candidateHash',
  'candidateRevision',
  'candidateKind',
  'baseApprovedSubmissionId',
  'baseApprovedCandidateHash',
  'basePublicationVersion',
  'actualModerationCycleId',
  'expectedCommittedPublicationVersion',
  'expectedCommittedPublicationState',
  'expectedCurrentSubmissionId',
  'rulesDigest',
  'quotaCharged',
]);

export const PUBLISHING_OPERATION_IDENTIFIER_POLICIES = deepFreeze({
  operationId: {
    type: 'uuid_v4',
    length: 36,
    canonicalCase: 'lowercase',
  },
  objectId: {
    type: 'mongo_object_id',
    length: 24,
    canonicalCase: 'lowercase',
  },
  hash: {
    type: 'sha256_hex',
    length: 64,
    canonicalCase: 'lowercase',
  },
  idempotencyKey: {
    type: 'printable_ascii',
    minimumLength: 16,
    maximumLength: 128,
  },
  rulesVersion: {
    type: 'trimmed_string',
    minimumLength: 1,
    maximumLength: 100,
  },
});

export const PUBLISHING_OPERATION_OUTBOX_KEY_POLICY = deepFreeze({
  separator: ':',
  maximumLength: 160,
  employerSubmissionReceivedType: 'employer_submission_received',
  adminJobReviewRequestedType: 'admin_job_review_requested',
});

export const PUBLISHING_OPERATION_BOUNDS = deepFreeze({
  operationIdLength: 36,
  objectIdLength: 24,
  hashLength: 64,
  idempotencyKeyMinimumLength: 16,
  idempotencyKeyMaximumLength: 128,
  rulesVersionMinimumLength: 1,
  rulesVersionMaximumLength: 100,
  outboxKeyMaximumLength: 160,
  operationSeedFieldCount: 19,
  operationContextFieldCount: 32,
  identityMismatchCodeMaximum: 33,
});

export const PUBLISHING_OPERATION_ERROR_CODES = Object.freeze([
  'OPERATION_CONTEXT_INPUT_INVALID',
  'OPERATION_IDENTIFIER_SET_INVALID',
  'OPERATION_CANDIDATE_MISMATCH',
  'OPERATION_IDENTITY_CONFLICT',
  'OPERATION_KIND_UNSUPPORTED',
]);

export const PUBLISHING_OPERATION_ERROR_MESSAGES = deepFreeze({
  OPERATION_CONTEXT_INPUT_INVALID:
    'The publishing operation context is invalid.',
  OPERATION_IDENTIFIER_SET_INVALID:
    'The publishing operation identifiers are invalid.',
  OPERATION_CANDIDATE_MISMATCH:
    'The publishing candidate does not match the operation context.',
  OPERATION_IDENTITY_CONFLICT:
    'The publishing operation identity conflicts with prior context.',
  OPERATION_KIND_UNSUPPORTED: 'The publishing operation kind is unsupported.',
});

const SEED_INPUT_FIELDS = Object.freeze([
  'operationId',
  'operationKind',
  'ownerType',
  'ownerId',
  'employerId',
  'jobId',
  'idempotencyKey',
  'submissionId',
  'acknowledgementId',
  'moderationEventId',
  'newModerationCycleId',
  'expectedPublicationVersion',
  'expectedPublicationState',
  'correctionOfSubmissionId',
  'rulesVersion',
]);
const COMMIT_EVIDENCE_FIELDS = Object.freeze([
  'requestFingerprint',
  'actualModerationCycleId',
  'expectedCommittedPublicationVersion',
  'expectedCommittedPublicationState',
  'expectedCurrentSubmissionId',
  'rulesDigest',
  'quotaCharged',
]);
const BUILD_CONTEXT_FIELDS = Object.freeze([
  'operationSeed',
  'candidate',
  'commitEvidence',
]);
const VALIDATE_CONTEXT_OPTIONS_FIELDS = Object.freeze(['candidate']);
const INITIATED_AT_OPTIONS_FIELDS = Object.freeze(['initiatedAt']);
const OUTBOX_KEY_FIELDS = Object.freeze([
  'employerSubmissionReceived',
  'adminJobReviewRequested',
]);
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]+$/u;
const CANONICAL_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const FIELD_TO_MISMATCH = Object.freeze([
  ['schemaVersion', 'SCHEMA_VERSION_MISMATCH'],
  ['policyVersion', 'POLICY_VERSION_MISMATCH'],
  ['operationId', 'OPERATION_ID_MISMATCH'],
  ['operationKind', 'OPERATION_KIND_MISMATCH'],
  ['ownerType', 'OWNER_TYPE_MISMATCH'],
  ['ownerId', 'OWNER_ID_MISMATCH'],
  ['employerId', 'EMPLOYER_ID_MISMATCH'],
  ['jobId', 'JOB_ID_MISMATCH'],
  ['idempotencyKey', 'IDEMPOTENCY_KEY_MISMATCH'],
  ['submissionId', 'SUBMISSION_ID_MISMATCH'],
  ['acknowledgementId', 'ACKNOWLEDGEMENT_ID_MISMATCH'],
  ['moderationEventId', 'MODERATION_EVENT_ID_MISMATCH'],
  ['newModerationCycleId', 'NEW_MODERATION_CYCLE_ID_MISMATCH'],
  ['expectedPublicationVersion', 'EXPECTED_PUBLICATION_VERSION_MISMATCH'],
  ['expectedPublicationState', 'EXPECTED_PUBLICATION_STATE_MISMATCH'],
  ['correctionOfSubmissionId', 'CORRECTION_OF_SUBMISSION_ID_MISMATCH'],
  ['rulesVersion', 'RULES_VERSION_MISMATCH'],
  ['initiatedAt', 'INITIATED_AT_MISMATCH'],
  ['requestFingerprint', 'REQUEST_FINGERPRINT_MISMATCH'],
  ['candidateHash', 'CANDIDATE_HASH_MISMATCH'],
  ['candidateRevision', 'CANDIDATE_REVISION_MISMATCH'],
  ['candidateKind', 'CANDIDATE_KIND_MISMATCH'],
  ['baseApprovedSubmissionId', 'BASE_APPROVED_SUBMISSION_ID_MISMATCH'],
  ['baseApprovedCandidateHash', 'BASE_APPROVED_CANDIDATE_HASH_MISMATCH'],
  ['basePublicationVersion', 'BASE_PUBLICATION_VERSION_MISMATCH'],
  ['actualModerationCycleId', 'ACTUAL_MODERATION_CYCLE_ID_MISMATCH'],
  [
    'expectedCommittedPublicationVersion',
    'EXPECTED_COMMITTED_PUBLICATION_VERSION_MISMATCH',
  ],
  [
    'expectedCommittedPublicationState',
    'EXPECTED_COMMITTED_PUBLICATION_STATE_MISMATCH',
  ],
  ['expectedCurrentSubmissionId', 'EXPECTED_CURRENT_SUBMISSION_ID_MISMATCH'],
  ['rulesDigest', 'RULES_DIGEST_MISMATCH'],
  ['quotaCharged', 'QUOTA_CHARGED_MISMATCH'],
]);

export class PublishingOperationContextContractError extends Error {
  constructor(code) {
    const safeCode = PUBLISHING_OPERATION_ERROR_CODES.includes(code)
      ? code
      : 'OPERATION_CONTEXT_INPUT_INVALID';
    const message = PUBLISHING_OPERATION_ERROR_MESSAGES[safeCode];
    super(message);
    this.name = 'PublishingOperationContextContractError';
    this.status =
      safeCode === 'OPERATION_CANDIDATE_MISMATCH' ||
      safeCode === 'OPERATION_IDENTITY_CONFLICT'
        ? 409
        : 400;
    this.code = safeCode;
    this.safeMessage = message;
    Object.freeze(this);
  }

  toJSON() {
    return Object.freeze({
      status: this.status,
      code: this.code,
      message: this.safeMessage,
    });
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    seen.has(value)
  ) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key], seen);
  }
  return Object.freeze(value);
}

function operationError(code) {
  return new PublishingOperationContextContractError(code);
}

function assertStrictRecord(value, expectedFields, code) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set
  ) {
    throw operationError(code);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw operationError(code);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedFields.length ||
    keys.some((key) => typeof key !== 'string') ||
    keys.some(
      (key) =>
        UNSAFE_KEYS.has(key) ||
        key.includes('.') ||
        key.startsWith('$') ||
        !expectedFields.includes(key)
    ) ||
    expectedFields.some((field) => !Object.hasOwn(value, field))
  ) {
    throw operationError(code);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw operationError(code);
    }
  }
}

function canonicalObjectId(value) {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw operationError('OPERATION_IDENTIFIER_SET_INVALID');
  }
  return value;
}

function canonicalHash(value, code = 'OPERATION_CONTEXT_INPUT_INVALID') {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw operationError(code);
  }
  return value;
}

function canonicalUuidV4(value) {
  if (typeof value !== 'string' || !UUID_V4_PATTERN.test(value)) {
    throw operationError('OPERATION_IDENTIFIER_SET_INVALID');
  }
  return value;
}

function canonicalSafeInteger(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  return value;
}

function canonicalIsoString(value) {
  if (
    typeof value !== 'string' ||
    !CANONICAL_ISO_PATTERN.test(value) ||
    new Date(value).toISOString() !== value
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  return value;
}

function canonicalInitiatedAt(value) {
  if (
    !(value instanceof Date) ||
    Object.getPrototypeOf(value) !== Date.prototype ||
    Number.isNaN(value.getTime())
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  return value.toISOString();
}

function canonicalIdempotencyKey(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < PUBLISHING_OPERATION_BOUNDS.idempotencyKeyMinimumLength ||
    value.length > PUBLISHING_OPERATION_BOUNDS.idempotencyKeyMaximumLength ||
    !PRINTABLE_ASCII_PATTERN.test(value)
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  return value;
}

function canonicalRulesVersion(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < PUBLISHING_OPERATION_BOUNDS.rulesVersionMinimumLength ||
    value.length > PUBLISHING_OPERATION_BOUNDS.rulesVersionMaximumLength
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  return value;
}

function assertOperationKind(value) {
  if (!PUBLISHING_OPERATION_KINDS.includes(value)) {
    throw operationError('OPERATION_KIND_UNSUPPORTED');
  }
  return value;
}

function deriveOutboxDeduplicationKeys(submissionId) {
  const employerSubmissionReceived = `${submissionId}${PUBLISHING_OPERATION_OUTBOX_KEY_POLICY.separator}${PUBLISHING_OPERATION_OUTBOX_KEY_POLICY.employerSubmissionReceivedType}`;
  const adminJobReviewRequested = `${submissionId}${PUBLISHING_OPERATION_OUTBOX_KEY_POLICY.separator}${PUBLISHING_OPERATION_OUTBOX_KEY_POLICY.adminJobReviewRequestedType}`;
  if (
    employerSubmissionReceived.length >
      PUBLISHING_OPERATION_BOUNDS.outboxKeyMaximumLength ||
    adminJobReviewRequested.length >
      PUBLISHING_OPERATION_BOUNDS.outboxKeyMaximumLength
  ) {
    throw operationError('OPERATION_IDENTIFIER_SET_INVALID');
  }
  return deepFreeze({
    employerSubmissionReceived,
    adminJobReviewRequested,
  });
}

function validateOutboxKeys(value, submissionId) {
  assertStrictRecord(
    value,
    OUTBOX_KEY_FIELDS,
    'OPERATION_IDENTIFIER_SET_INVALID'
  );
  const expected = deriveOutboxDeduplicationKeys(submissionId);
  if (
    value.employerSubmissionReceived !== expected.employerSubmissionReceived ||
    value.adminJobReviewRequested !== expected.adminJobReviewRequested
  ) {
    throw operationError('OPERATION_IDENTIFIER_SET_INVALID');
  }
  return expected;
}

function validateSeedRelationships(seed) {
  if (
    seed.ownerType !== 'employer' ||
    seed.ownerId !== seed.employerId ||
    !Number.isSafeInteger(seed.expectedPublicationVersion) ||
    seed.expectedPublicationVersion < 0
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  if (seed.operationKind === 'major_edit_submission') {
    if (
      seed.expectedPublicationState !== 'active' ||
      seed.correctionOfSubmissionId !== null
    ) {
      throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
    }
  } else if (
    seed.expectedPublicationState !== 'rejected' ||
    seed.correctionOfSubmissionId === null
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
}

function validateSeedRecord(seed) {
  assertStrictRecord(
    seed,
    PUBLISHING_OPERATION_SEED_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  if (
    seed.schemaVersion !== PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION ||
    seed.policyVersion !== PUBLISHING_OPERATION_POLICY_VERSION
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  const operationId = canonicalUuidV4(seed.operationId);
  const operationKind = assertOperationKind(seed.operationKind);
  const ownerId = canonicalObjectId(seed.ownerId);
  const employerId = canonicalObjectId(seed.employerId);
  const jobId = canonicalObjectId(seed.jobId);
  const submissionId = canonicalObjectId(seed.submissionId);
  const acknowledgementId = canonicalObjectId(seed.acknowledgementId);
  const moderationEventId = canonicalObjectId(seed.moderationEventId);
  const newModerationCycleId = canonicalObjectId(seed.newModerationCycleId);
  const correctionOfSubmissionId =
    seed.correctionOfSubmissionId === null
      ? null
      : canonicalObjectId(seed.correctionOfSubmissionId);
  const expectedPublicationVersion = canonicalSafeInteger(
    seed.expectedPublicationVersion
  );
  const initiatedAt = canonicalIsoString(seed.initiatedAt);
  const normalized = {
    schemaVersion: PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION,
    policyVersion: PUBLISHING_OPERATION_POLICY_VERSION,
    operationId,
    operationKind,
    ownerType: seed.ownerType,
    ownerId,
    employerId,
    jobId,
    idempotencyKey: canonicalIdempotencyKey(seed.idempotencyKey),
    submissionId,
    acknowledgementId,
    moderationEventId,
    newModerationCycleId,
    expectedPublicationVersion,
    expectedPublicationState: seed.expectedPublicationState,
    correctionOfSubmissionId,
    rulesVersion: canonicalRulesVersion(seed.rulesVersion),
    outboxDeduplicationKeys: validateOutboxKeys(
      seed.outboxDeduplicationKeys,
      submissionId
    ),
    initiatedAt,
  };
  validateSeedRelationships(normalized);
  return deepFreeze(normalized);
}

function validatedCandidate(candidate, jobId) {
  try {
    const value = validatePublicationCandidate(candidate, { jobId });
    if (value.policyVersion !== PUBLICATION_CANDIDATE_POLICY_VERSION) {
      throw operationError('OPERATION_CANDIDATE_MISMATCH');
    }
    return value;
  } catch (error) {
    if (error instanceof PublishingOperationContextContractError) {
      throw error;
    }
    throw operationError('OPERATION_CANDIDATE_MISMATCH');
  }
}

function validateCandidateRelationships(seed, candidate) {
  const expectedKind =
    seed.operationKind === 'major_edit_submission'
      ? 'major_edit'
      : 'correction';
  if (
    candidate.policyVersion !== seed.policyVersion ||
    candidate.candidateKind !== expectedKind ||
    candidate.expectedPublicationVersion !== seed.expectedPublicationVersion ||
    (expectedKind === 'major_edit' &&
      (candidate.candidateRevision !== 1 ||
        candidate.previousCandidateHash !== null)) ||
    (expectedKind === 'correction' &&
      (candidate.candidateRevision < 2 ||
        typeof candidate.previousCandidateHash !== 'string'))
  ) {
    throw operationError('OPERATION_CANDIDATE_MISMATCH');
  }
}

function validateCommitEvidence(evidence, seed, candidate) {
  assertStrictRecord(
    evidence,
    COMMIT_EVIDENCE_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  const normalized = {
    requestFingerprint: canonicalHash(evidence.requestFingerprint),
    actualModerationCycleId: canonicalObjectId(
      evidence.actualModerationCycleId
    ),
    expectedCommittedPublicationVersion: canonicalSafeInteger(
      evidence.expectedCommittedPublicationVersion
    ),
    expectedCommittedPublicationState:
      evidence.expectedCommittedPublicationState,
    expectedCurrentSubmissionId: canonicalObjectId(
      evidence.expectedCurrentSubmissionId
    ),
    rulesDigest: canonicalHash(evidence.rulesDigest),
    quotaCharged: evidence.quotaCharged,
  };
  if (
    typeof normalized.quotaCharged !== 'boolean' ||
    normalized.expectedCommittedPublicationVersion !==
      seed.expectedPublicationVersion + 1 ||
    normalized.expectedCommittedPublicationState !== 'pending_review' ||
    normalized.expectedCurrentSubmissionId !== seed.submissionId ||
    (seed.operationKind === 'major_edit_submission' &&
      (!normalized.quotaCharged ||
        normalized.actualModerationCycleId !== seed.newModerationCycleId)) ||
    (seed.operationKind === 'correction_submission' &&
      normalized.quotaCharged &&
      normalized.actualModerationCycleId !== seed.newModerationCycleId) ||
    candidate.baseApprovedSubmissionId === null
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  return deepFreeze(normalized);
}

function validateContextRecord(context, candidate, requireCandidate) {
  assertStrictRecord(
    context,
    PUBLISHING_OPERATION_CONTEXT_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  const seedSource = {};
  for (const field of PUBLISHING_OPERATION_SEED_FIELDS) {
    seedSource[field] = context[field];
  }
  const seed = validateSeedRecord(seedSource);
  const normalizedCandidate = requireCandidate
    ? validatedCandidate(candidate, seed.jobId)
    : null;
  if (normalizedCandidate) {
    validateCandidateRelationships(seed, normalizedCandidate);
  }
  const evidence = validateCommitEvidence(
    {
      requestFingerprint: context.requestFingerprint,
      actualModerationCycleId: context.actualModerationCycleId,
      expectedCommittedPublicationVersion:
        context.expectedCommittedPublicationVersion,
      expectedCommittedPublicationState:
        context.expectedCommittedPublicationState,
      expectedCurrentSubmissionId: context.expectedCurrentSubmissionId,
      rulesDigest: context.rulesDigest,
      quotaCharged: context.quotaCharged,
    },
    seed,
    normalizedCandidate || {
      baseApprovedSubmissionId: context.baseApprovedSubmissionId,
    }
  );
  const candidateFields = {
    candidateHash: canonicalHash(
      context.candidateHash,
      'OPERATION_CANDIDATE_MISMATCH'
    ),
    candidateRevision: canonicalSafeInteger(context.candidateRevision),
    candidateKind: context.candidateKind,
    baseApprovedSubmissionId: canonicalObjectId(
      context.baseApprovedSubmissionId
    ),
    baseApprovedCandidateHash: canonicalHash(
      context.baseApprovedCandidateHash,
      'OPERATION_CANDIDATE_MISMATCH'
    ),
    basePublicationVersion: canonicalSafeInteger(
      context.basePublicationVersion
    ),
  };
  if (
    !['major_edit', 'correction'].includes(candidateFields.candidateKind) ||
    (seed.operationKind === 'major_edit_submission' &&
      (candidateFields.candidateKind !== 'major_edit' ||
        candidateFields.candidateRevision !== 1 ||
        candidateFields.basePublicationVersion !==
          seed.expectedPublicationVersion)) ||
    (seed.operationKind === 'correction_submission' &&
      (candidateFields.candidateKind !== 'correction' ||
        candidateFields.candidateRevision < 2)) ||
    (normalizedCandidate &&
      (candidateFields.candidateHash !== normalizedCandidate.candidateHash ||
        candidateFields.candidateRevision !==
          normalizedCandidate.candidateRevision ||
        candidateFields.candidateKind !== normalizedCandidate.candidateKind ||
        candidateFields.baseApprovedSubmissionId !==
          normalizedCandidate.baseApprovedSubmissionId ||
        candidateFields.baseApprovedCandidateHash !==
          normalizedCandidate.baseApprovedCandidateHash ||
        candidateFields.basePublicationVersion !==
          normalizedCandidate.basePublicationVersion))
  ) {
    throw operationError('OPERATION_CANDIDATE_MISMATCH');
  }
  const result = {};
  for (const field of PUBLISHING_OPERATION_SEED_FIELDS) {
    result[field] = seed[field];
  }
  Object.assign(result, {
    requestFingerprint: evidence.requestFingerprint,
    candidateHash: candidateFields.candidateHash,
    candidateRevision: candidateFields.candidateRevision,
    candidateKind: candidateFields.candidateKind,
    baseApprovedSubmissionId: candidateFields.baseApprovedSubmissionId,
    baseApprovedCandidateHash: candidateFields.baseApprovedCandidateHash,
    basePublicationVersion: candidateFields.basePublicationVersion,
    actualModerationCycleId: evidence.actualModerationCycleId,
    expectedCommittedPublicationVersion:
      evidence.expectedCommittedPublicationVersion,
    expectedCommittedPublicationState:
      evidence.expectedCommittedPublicationState,
    expectedCurrentSubmissionId: evidence.expectedCurrentSubmissionId,
    rulesDigest: evidence.rulesDigest,
    quotaCharged: evidence.quotaCharged,
  });
  return deepFreeze(result);
}

function valuesEqual(left, right) {
  if (left === right) return true;
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    return OUTBOX_KEY_FIELDS.every((field) => left[field] === right[field]);
  }
  return false;
}

function collectIdentityMismatchCodes(left, right) {
  const codes = [];
  for (const [field, code] of FIELD_TO_MISMATCH) {
    if (!valuesEqual(left[field], right[field])) {
      codes.push(code);
    }
    if (field === 'rulesVersion') {
      if (
        left.outboxDeduplicationKeys.employerSubmissionReceived !==
        right.outboxDeduplicationKeys.employerSubmissionReceived
      ) {
        codes.push('EMPLOYER_SUBMISSION_RECEIVED_OUTBOX_KEY_MISMATCH');
      }
      if (
        left.outboxDeduplicationKeys.adminJobReviewRequested !==
        right.outboxDeduplicationKeys.adminJobReviewRequested
      ) {
        codes.push('ADMIN_JOB_REVIEW_REQUESTED_OUTBOX_KEY_MISMATCH');
      }
    }
  }
  return Object.freeze(codes);
}

function validateComparableContext(context) {
  assertStrictRecord(
    context,
    PUBLISHING_OPERATION_CONTEXT_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  assertStrictRecord(
    context.outboxDeduplicationKeys,
    OUTBOX_KEY_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  const scalarTypes = {
    schemaVersion: 'number',
    policyVersion: 'string',
    operationId: 'string',
    operationKind: 'string',
    ownerType: 'string',
    ownerId: 'string',
    employerId: 'string',
    jobId: 'string',
    idempotencyKey: 'string',
    submissionId: 'string',
    acknowledgementId: 'string',
    moderationEventId: 'string',
    newModerationCycleId: 'string',
    expectedPublicationVersion: 'number',
    expectedPublicationState: 'string',
    rulesVersion: 'string',
    initiatedAt: 'string',
    requestFingerprint: 'string',
    candidateHash: 'string',
    candidateRevision: 'number',
    candidateKind: 'string',
    baseApprovedSubmissionId: 'string',
    baseApprovedCandidateHash: 'string',
    basePublicationVersion: 'number',
    actualModerationCycleId: 'string',
    expectedCommittedPublicationVersion: 'number',
    expectedCommittedPublicationState: 'string',
    expectedCurrentSubmissionId: 'string',
    rulesDigest: 'string',
    quotaCharged: 'boolean',
  };
  for (const [field, type] of Object.entries(scalarTypes)) {
    if (typeof context[field] !== type) {
      throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
    }
  }
  if (
    context.correctionOfSubmissionId !== null &&
    typeof context.correctionOfSubmissionId !== 'string'
  ) {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  for (const field of OUTBOX_KEY_FIELDS) {
    if (typeof context.outboxDeduplicationKeys[field] !== 'string') {
      throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
    }
  }
  return context;
}

function hasExclusiveIdentityReuse(left, right) {
  const directFields = [
    'submissionId',
    'acknowledgementId',
    'moderationEventId',
    'newModerationCycleId',
    'expectedCurrentSubmissionId',
  ];
  if (directFields.some((field) => left[field] === right[field])) {
    return true;
  }
  if (
    left.outboxDeduplicationKeys.employerSubmissionReceived ===
      right.outboxDeduplicationKeys.employerSubmissionReceived ||
    left.outboxDeduplicationKeys.adminJobReviewRequested ===
      right.outboxDeduplicationKeys.adminJobReviewRequested
  ) {
    return true;
  }
  return (
    left.ownerType === right.ownerType &&
    left.ownerId === right.ownerId &&
    left.idempotencyKey === right.idempotencyKey
  );
}

export function buildPublishingOperationSeed(input, options) {
  assertStrictRecord(
    input,
    SEED_INPUT_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  assertStrictRecord(
    options,
    INITIATED_AT_OPTIONS_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  const submissionId = canonicalObjectId(input.submissionId);
  return validateSeedRecord({
    schemaVersion: PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION,
    policyVersion: PUBLISHING_OPERATION_POLICY_VERSION,
    operationId: input.operationId,
    operationKind: input.operationKind,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    employerId: input.employerId,
    jobId: input.jobId,
    idempotencyKey: input.idempotencyKey,
    submissionId,
    acknowledgementId: input.acknowledgementId,
    moderationEventId: input.moderationEventId,
    newModerationCycleId: input.newModerationCycleId,
    expectedPublicationVersion: input.expectedPublicationVersion,
    expectedPublicationState: input.expectedPublicationState,
    correctionOfSubmissionId: input.correctionOfSubmissionId,
    rulesVersion: input.rulesVersion,
    outboxDeduplicationKeys: deriveOutboxDeduplicationKeys(submissionId),
    initiatedAt: canonicalInitiatedAt(options.initiatedAt),
  });
}

export function buildPublishingOperationContext(input) {
  assertStrictRecord(
    input,
    BUILD_CONTEXT_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  const seed = validateSeedRecord(input.operationSeed);
  const candidate = validatedCandidate(input.candidate, seed.jobId);
  validateCandidateRelationships(seed, candidate);
  const evidence = validateCommitEvidence(
    input.commitEvidence,
    seed,
    candidate
  );
  const context = {};
  for (const field of PUBLISHING_OPERATION_SEED_FIELDS) {
    context[field] = seed[field];
  }
  Object.assign(context, {
    requestFingerprint: evidence.requestFingerprint,
    candidateHash: candidate.candidateHash,
    candidateRevision: candidate.candidateRevision,
    candidateKind: candidate.candidateKind,
    baseApprovedSubmissionId: candidate.baseApprovedSubmissionId,
    baseApprovedCandidateHash: candidate.baseApprovedCandidateHash,
    basePublicationVersion: candidate.basePublicationVersion,
    actualModerationCycleId: evidence.actualModerationCycleId,
    expectedCommittedPublicationVersion:
      evidence.expectedCommittedPublicationVersion,
    expectedCommittedPublicationState:
      evidence.expectedCommittedPublicationState,
    expectedCurrentSubmissionId: evidence.expectedCurrentSubmissionId,
    rulesDigest: evidence.rulesDigest,
    quotaCharged: evidence.quotaCharged,
  });
  return validateContextRecord(context, candidate, true);
}

export function validatePublishingOperationSeed(seed) {
  return validateSeedRecord(seed);
}

export function validatePublishingOperationContext(context, options) {
  assertStrictRecord(
    options,
    VALIDATE_CONTEXT_OPTIONS_FIELDS,
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
  return validateContextRecord(context, options.candidate, true);
}

export function comparePublishingOperationIdentity(leftContext, rightContext) {
  let left;
  let right;
  try {
    left = validateComparableContext(leftContext);
    right = validateComparableContext(rightContext);
  } catch {
    throw operationError('OPERATION_CONTEXT_INPUT_INVALID');
  }
  const mismatchCodes = collectIdentityMismatchCodes(left, right);
  let classification;
  if (mismatchCodes.length === 0) {
    validateContextRecord(left, null, false);
    validateContextRecord(right, null, false);
    classification = 'SAME_LOGICAL_OPERATION';
  } else if (
    left.operationId === right.operationId ||
    hasExclusiveIdentityReuse(left, right)
  ) {
    classification = 'IDENTITY_CONFLICT';
  } else {
    classification = 'DIFFERENT_LOGICAL_OPERATION';
  }
  return deepFreeze({ classification, mismatchCodes });
}
