import { comparePublishingOperationIdentity } from './PublishingOperationContextContract.js';

export const PUBLISHING_RECONCILIATION_SCHEMA_VERSION = 1;

export const PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS = Object.freeze([
  'schemaVersion',
  'observedAt',
  'readAuthority',
  'submission',
  'canonicalJob',
  'acknowledgement',
  'moderationEvent',
  'outbox',
  'quota',
]);

export const PUBLISHING_RECONCILIATION_READ_AUTHORITY_FIELDS = Object.freeze([
  'status',
  'source',
  'consistency',
  'roundsCompleted',
  'visibilityProven',
  'failureClassification',
]);

export const PUBLISHING_RECONCILIATION_SUBMISSION_FOUND_FIELDS = Object.freeze([
  'state',
  'submissionIdMatches',
  'ownerMatches',
  'idempotencyKeyMatches',
  'requestFingerprintMatches',
  'jobIdMatches',
  'employerIdMatches',
  'candidateHashMatches',
  'candidateRevisionMatches',
  'candidateKindMatches',
  'baseBindingMatches',
  'expectedPublicationVersionMatches',
  'stateMatches',
  'quotaEvidenceMatches',
  'safeResultAvailable',
]);

export const PUBLISHING_RECONCILIATION_JOB_FOUND_FIELDS = Object.freeze([
  'state',
  'stateClassification',
  'ownerMatches',
  'publicationVersionMatches',
  'currentSubmissionMatches',
  'lastApprovedSubmissionMatches',
  'policyVersionMatches',
]);

export const PUBLISHING_RECONCILIATION_ACKNOWLEDGEMENT_FOUND_FIELDS =
  Object.freeze([
    'state',
    'acknowledgementIdMatches',
    'submissionIdMatches',
    'jobIdMatches',
    'employerIdMatches',
    'acceptedMatches',
    'policyVersionMatches',
    'rulesVersionMatches',
    'rulesDigestMatches',
  ]);

export const PUBLISHING_RECONCILIATION_MODERATION_FOUND_FIELDS = Object.freeze([
  'state',
  'moderationEventIdMatches',
  'submissionIdMatches',
  'jobIdMatches',
  'employerIdMatches',
  'actionMatches',
  'stateTransitionMatches',
  'moderationCycleMatches',
  'candidateHashMatches',
]);

export const PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS = Object.freeze([
  'state',
  'deduplicationKeyMatches',
  'submissionIdMatches',
  'jobIdMatches',
  'typeMatches',
  'audienceMatches',
  'employerPresenceMatches',
]);

export const PUBLISHING_RECONCILIATION_QUOTA_FOUND_FIELDS = Object.freeze([
  'state',
  'chargedEvidenceStatus',
  'guardEvidenceStatus',
]);

export const PUBLISHING_RECONCILIATION_RESULT_FIELDS = Object.freeze([
  'schemaVersion',
  'outcome',
  'actions',
  'terminal',
  'success',
  'retryAllowed',
  'reconcileLater',
  'manualReviewRequired',
  'securityReviewRequired',
  'mismatchCodes',
  'missingCodes',
]);

export const PUBLISHING_RECONCILIATION_OBSERVATION_STATES = Object.freeze([
  'FOUND',
  'ABSENT',
  'DUPLICATE',
  'DUPLICATE_OVERFLOW',
  'READ_FAILED',
]);

export const PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES = Object.freeze([
  'COMPLETE',
  'RETRYABLE_FAILURE',
  'NON_RETRYABLE_FAILURE',
]);

export const PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS =
  Object.freeze([
    'CONNECTION_UNAVAILABLE',
    'SELECTION_UNAVAILABLE',
    'READ_CONCERN_UNAVAILABLE',
    'SNAPSHOT_UNAVAILABLE',
    'UNKNOWN_READ_FAILURE',
  ]);

export const PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS =
  Object.freeze(['BASE_UNCHANGED', 'COMMITTED_MATCH', 'CONFLICT']);

export const PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES = Object.freeze([
  'MATCH',
  'CONFLICT',
  'NOT_APPLICABLE',
]);

export const PUBLISHING_RECONCILIATION_OUTCOMES = Object.freeze([
  'COMMITTED',
  'NOT_COMMITTED',
  'INDETERMINATE',
  'CORRUPT',
  'SECURITY_CONFLICT',
]);

export const PUBLISHING_RECONCILIATION_ACTIONS = Object.freeze([
  'RETURN_SUCCESS',
  'RETURN_FAILURE',
  'RETURN_RETRYABLE_FAILURE',
  'DO_NOT_RETRY',
  'RECONCILE_AGAIN_LATER',
  'ESCALATE_MANUAL_REVIEW',
  'ESCALATE_SECURITY_REVIEW',
]);

export const PUBLISHING_RECONCILIATION_MISMATCH_CODES = Object.freeze([
  'SUBMISSION_ID_CONFLICT',
  'IDEMPOTENCY_FINGERPRINT_CONFLICT',
  'SUBMISSION_RELATION_CONFLICT',
  'CANDIDATE_CONFLICT',
  'BASE_BINDING_CONFLICT',
  'QUOTA_EVIDENCE_CONFLICT',
  'JOB_OWNERSHIP_CONFLICT',
  'JOB_STATE_CONFLICT',
  'JOB_VERSION_CONFLICT',
  'JOB_SUBMISSION_LINK_CONFLICT',
  'ACKNOWLEDGEMENT_CONFLICT',
  'MODERATION_EVENT_CONFLICT',
  'MODERATION_CYCLE_CONFLICT',
  'OUTBOX_CONFLICT',
  'DUPLICATE_RECORDS',
  'UNEXPECTED_OUTBOX_RECORDS',
]);

export const PUBLISHING_RECONCILIATION_MISSING_CODES = Object.freeze([
  'SUBMISSION_MISSING',
  'JOB_MISSING',
  'ACKNOWLEDGEMENT_MISSING',
  'MODERATION_EVENT_MISSING',
  'OUTBOX_INTENT_MISSING',
]);

export const PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES = deepFreeze({
  submission: 'SECURITY_CONFLICT',
  acknowledgement: 'SECURITY_CONFLICT',
  moderationEvent: 'SECURITY_CONFLICT',
  employerSubmissionReceived: 'SECURITY_CONFLICT',
  adminJobReviewRequested: 'SECURITY_CONFLICT',
  canonicalJob: 'CORRUPT',
  quota: 'CORRUPT',
  unexpectedRecords: 'CORRUPT',
});

export const PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY = deepFreeze({
  COMMITTED: {
    actions: ['RETURN_SUCCESS', 'DO_NOT_RETRY'],
    terminal: true,
    success: true,
    retryAllowed: false,
    reconcileLater: false,
    manualReviewRequired: false,
    securityReviewRequired: false,
  },
  NOT_COMMITTED: {
    actions: ['RETURN_RETRYABLE_FAILURE', 'DO_NOT_RETRY'],
    terminal: true,
    success: false,
    retryAllowed: true,
    reconcileLater: false,
    manualReviewRequired: false,
    securityReviewRequired: false,
  },
  INDETERMINATE: {
    actions: ['RECONCILE_AGAIN_LATER', 'DO_NOT_RETRY'],
    terminal: false,
    success: null,
    retryAllowed: false,
    reconcileLater: true,
    manualReviewRequired: false,
    securityReviewRequired: false,
  },
  CORRUPT: {
    actions: ['RETURN_FAILURE', 'DO_NOT_RETRY', 'ESCALATE_MANUAL_REVIEW'],
    terminal: true,
    success: false,
    retryAllowed: false,
    reconcileLater: false,
    manualReviewRequired: true,
    securityReviewRequired: false,
  },
  SECURITY_CONFLICT: {
    actions: [
      'RETURN_FAILURE',
      'DO_NOT_RETRY',
      'ESCALATE_MANUAL_REVIEW',
      'ESCALATE_SECURITY_REVIEW',
    ],
    terminal: true,
    success: false,
    retryAllowed: false,
    reconcileLater: false,
    manualReviewRequired: true,
    securityReviewRequired: true,
  },
});

export const PUBLISHING_RECONCILIATION_BOUNDS = deepFreeze({
  observationFieldCount: 9,
  readAuthorityFieldCount: 6,
  submissionFoundFieldCount: 15,
  jobFoundFieldCount: 7,
  acknowledgementFoundFieldCount: 9,
  moderationFoundFieldCount: 9,
  outboxGroupFieldCount: 3,
  outboxFoundFieldCount: 7,
  quotaFoundFieldCount: 3,
  resultFieldCount: 11,
  duplicateCountMinimum: 2,
  duplicateCountMaximum: 10,
  duplicateOverflowThreshold: 11,
  mismatchCodeMaximum: 16,
  missingCodeMaximum: 5,
  contradictionCodeMaximum: 0,
  actionMaximum: 4,
  maximumReconciliationCategoryCount: 21,
  reconciliationRoundMinimum: 1,
  reconciliationRoundMaximum: 3,
});

export const PUBLISHING_RECONCILIATION_ERROR_CODES = Object.freeze([
  'RECONCILIATION_INPUT_INVALID',
  'RECONCILIATION_COMPARISON_FAILED',
]);

export const PUBLISHING_RECONCILIATION_ERROR_MESSAGES = deepFreeze({
  RECONCILIATION_INPUT_INVALID:
    'The publishing reconciliation input is invalid.',
  RECONCILIATION_COMPARISON_FAILED:
    'The publishing reconciliation comparison could not be completed.',
});

const EVALUATION_FIELDS = Object.freeze(['operationContext', 'observations']);
const OUTBOX_GROUP_FIELDS = Object.freeze([
  'employerSubmissionReceived',
  'adminJobReviewRequested',
  'unexpectedRecords',
]);
const STATE_ONLY_FIELDS = Object.freeze(['state']);
const DUPLICATE_FIELDS = Object.freeze(['state', 'count']);
const UNEXPECTED_FOUND_FIELDS = Object.freeze(['state']);
const CANONICAL_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export class PublishingReconciliationContractError extends Error {
  constructor(code) {
    const safeCode = PUBLISHING_RECONCILIATION_ERROR_CODES.includes(code)
      ? code
      : 'RECONCILIATION_INPUT_INVALID';
    const message = PUBLISHING_RECONCILIATION_ERROR_MESSAGES[safeCode];
    super(message);
    this.name = 'PublishingReconciliationContractError';
    this.status = safeCode === 'RECONCILIATION_COMPARISON_FAILED' ? 500 : 400;
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

function reconciliationError(code) {
  return new PublishingReconciliationContractError(code);
}

function assertStrictRecord(value, expectedFields) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set
  ) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
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
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw reconciliationError('RECONCILIATION_INPUT_INVALID');
    }
  }
}

function assertBooleans(value, fields) {
  for (const field of fields) {
    if (field !== 'state' && typeof value[field] !== 'boolean') {
      throw reconciliationError('RECONCILIATION_INPUT_INVALID');
    }
  }
}

function validateTaggedObservation(value, foundFields, kind) {
  assertStrictRecordForState(value, foundFields);
  if (!PUBLISHING_RECONCILIATION_OBSERVATION_STATES.includes(value.state)) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  if (value.state === 'FOUND') {
    assertStrictRecord(value, foundFields);
    if (kind === 'job') {
      if (
        !PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS.includes(
          value.stateClassification
        )
      ) {
        throw reconciliationError('RECONCILIATION_INPUT_INVALID');
      }
      assertBooleans(
        value,
        foundFields.filter((field) => field !== 'stateClassification')
      );
    } else if (kind === 'quota') {
      if (
        !PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES.includes(
          value.chargedEvidenceStatus
        ) ||
        value.guardEvidenceStatus !== 'NOT_OPERATION_ADDRESSABLE'
      ) {
        throw reconciliationError('RECONCILIATION_INPUT_INVALID');
      }
    } else if (kind !== 'unexpected') {
      assertBooleans(value, foundFields);
    }
  } else if (value.state === 'DUPLICATE') {
    assertStrictRecord(value, DUPLICATE_FIELDS);
    if (
      !Number.isInteger(value.count) ||
      value.count < PUBLISHING_RECONCILIATION_BOUNDS.duplicateCountMinimum ||
      value.count > PUBLISHING_RECONCILIATION_BOUNDS.duplicateCountMaximum
    ) {
      throw reconciliationError('RECONCILIATION_INPUT_INVALID');
    }
  } else {
    assertStrictRecord(value, STATE_ONLY_FIELDS);
  }
  return deepFreeze(structuredClone(value));
}

function assertStrictRecordForState(value, foundFields) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.hasOwn(value, 'state')
  ) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  const state = value.state;
  const fields =
    state === 'FOUND'
      ? foundFields
      : state === 'DUPLICATE'
        ? DUPLICATE_FIELDS
        : STATE_ONLY_FIELDS;
  assertStrictRecord(value, fields);
}

function validateReadAuthority(value, hasReadFailure) {
  assertStrictRecord(value, PUBLISHING_RECONCILIATION_READ_AUTHORITY_FIELDS);
  if (
    !PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES.includes(value.status) ||
    value.source !== 'primary' ||
    value.consistency !== 'majority_snapshot' ||
    !Number.isInteger(value.roundsCompleted) ||
    value.roundsCompleted <
      PUBLISHING_RECONCILIATION_BOUNDS.reconciliationRoundMinimum ||
    value.roundsCompleted >
      PUBLISHING_RECONCILIATION_BOUNDS.reconciliationRoundMaximum ||
    typeof value.visibilityProven !== 'boolean'
  ) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  if (value.status === 'COMPLETE') {
    if (
      value.visibilityProven !== true ||
      value.failureClassification !== null ||
      hasReadFailure
    ) {
      throw reconciliationError('RECONCILIATION_INPUT_INVALID');
    }
  } else if (
    value.visibilityProven !== false ||
    !PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS.includes(
      value.failureClassification
    ) ||
    !hasReadFailure
  ) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  return deepFreeze(structuredClone(value));
}

function validateObservationEnvelope(observations) {
  assertStrictRecord(
    observations,
    PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS
  );
  if (
    observations.schemaVersion !== PUBLISHING_RECONCILIATION_SCHEMA_VERSION ||
    typeof observations.observedAt !== 'string' ||
    !CANONICAL_ISO_PATTERN.test(observations.observedAt) ||
    new Date(observations.observedAt).toISOString() !== observations.observedAt
  ) {
    throw reconciliationError('RECONCILIATION_INPUT_INVALID');
  }
  assertStrictRecord(observations.outbox, OUTBOX_GROUP_FIELDS);
  const submission = validateTaggedObservation(
    observations.submission,
    PUBLISHING_RECONCILIATION_SUBMISSION_FOUND_FIELDS,
    'submission'
  );
  const canonicalJob = validateTaggedObservation(
    observations.canonicalJob,
    PUBLISHING_RECONCILIATION_JOB_FOUND_FIELDS,
    'job'
  );
  const acknowledgement = validateTaggedObservation(
    observations.acknowledgement,
    PUBLISHING_RECONCILIATION_ACKNOWLEDGEMENT_FOUND_FIELDS,
    'acknowledgement'
  );
  const moderationEvent = validateTaggedObservation(
    observations.moderationEvent,
    PUBLISHING_RECONCILIATION_MODERATION_FOUND_FIELDS,
    'moderation'
  );
  const employerSubmissionReceived = validateTaggedObservation(
    observations.outbox.employerSubmissionReceived,
    PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS,
    'outbox'
  );
  const adminJobReviewRequested = validateTaggedObservation(
    observations.outbox.adminJobReviewRequested,
    PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS,
    'outbox'
  );
  const unexpectedRecords = validateTaggedObservation(
    observations.outbox.unexpectedRecords,
    UNEXPECTED_FOUND_FIELDS,
    'unexpected'
  );
  const quota = validateTaggedObservation(
    observations.quota,
    PUBLISHING_RECONCILIATION_QUOTA_FOUND_FIELDS,
    'quota'
  );
  const componentStates = [
    submission,
    canonicalJob,
    acknowledgement,
    moderationEvent,
    employerSubmissionReceived,
    adminJobReviewRequested,
    unexpectedRecords,
    quota,
  ];
  const readAuthority = validateReadAuthority(
    observations.readAuthority,
    componentStates.some(({ state }) => state === 'READ_FAILED')
  );
  return deepFreeze({
    schemaVersion: PUBLISHING_RECONCILIATION_SCHEMA_VERSION,
    observedAt: observations.observedAt,
    readAuthority,
    submission,
    canonicalJob,
    acknowledgement,
    moderationEvent,
    outbox: {
      employerSubmissionReceived,
      adminJobReviewRequested,
      unexpectedRecords,
    },
    quota,
  });
}

function isDuplicate(observation) {
  return (
    observation.state === 'DUPLICATE' ||
    observation.state === 'DUPLICATE_OVERFLOW'
  );
}

function collectMismatchCodes(observations) {
  const found = (value) => value.state === 'FOUND';
  const requested = new Set();
  const submission = observations.submission;
  const job = observations.canonicalJob;
  const acknowledgement = observations.acknowledgement;
  const moderation = observations.moderationEvent;
  const employerOutbox = observations.outbox.employerSubmissionReceived;
  const adminOutbox = observations.outbox.adminJobReviewRequested;
  const unexpected = observations.outbox.unexpectedRecords;
  const quota = observations.quota;

  if (found(submission)) {
    if (!submission.submissionIdMatches) {
      requested.add('SUBMISSION_ID_CONFLICT');
    }
    if (
      !submission.ownerMatches ||
      !submission.idempotencyKeyMatches ||
      !submission.requestFingerprintMatches
    ) {
      requested.add('IDEMPOTENCY_FINGERPRINT_CONFLICT');
    }
    if (!submission.jobIdMatches || !submission.employerIdMatches) {
      requested.add('SUBMISSION_RELATION_CONFLICT');
    }
    if (
      !submission.candidateHashMatches ||
      !submission.candidateRevisionMatches ||
      !submission.candidateKindMatches
    ) {
      requested.add('CANDIDATE_CONFLICT');
    }
    if (!submission.baseBindingMatches) {
      requested.add('BASE_BINDING_CONFLICT');
    }
    if (!submission.quotaEvidenceMatches || !submission.safeResultAvailable) {
      requested.add('QUOTA_EVIDENCE_CONFLICT');
    }
    if (!submission.expectedPublicationVersionMatches) {
      requested.add('JOB_VERSION_CONFLICT');
    }
    if (!submission.stateMatches) {
      requested.add('JOB_STATE_CONFLICT');
    }
  }
  if (found(job)) {
    if (!job.ownerMatches) requested.add('JOB_OWNERSHIP_CONFLICT');
    if (job.stateClassification === 'CONFLICT' || !job.policyVersionMatches) {
      requested.add('JOB_STATE_CONFLICT');
    }
    if (!job.publicationVersionMatches) {
      requested.add('JOB_VERSION_CONFLICT');
    }
    if (!job.currentSubmissionMatches || !job.lastApprovedSubmissionMatches) {
      requested.add('JOB_SUBMISSION_LINK_CONFLICT');
    }
  }
  if (
    found(acknowledgement) &&
    Object.entries(acknowledgement).some(
      ([key, value]) => key !== 'state' && value !== true
    )
  ) {
    requested.add('ACKNOWLEDGEMENT_CONFLICT');
  }
  if (found(moderation)) {
    if (
      !moderation.moderationEventIdMatches ||
      !moderation.submissionIdMatches ||
      !moderation.jobIdMatches ||
      !moderation.employerIdMatches ||
      !moderation.candidateHashMatches
    ) {
      requested.add('MODERATION_EVENT_CONFLICT');
    }
    if (!moderation.moderationCycleMatches) {
      requested.add('MODERATION_CYCLE_CONFLICT');
    }
    if (!moderation.actionMatches || !moderation.stateTransitionMatches) {
      requested.add('MODERATION_EVENT_CONFLICT');
    }
  }
  for (const outbox of [employerOutbox, adminOutbox]) {
    if (
      found(outbox) &&
      Object.entries(outbox).some(
        ([key, value]) => key !== 'state' && value !== true
      )
    ) {
      requested.add('OUTBOX_CONFLICT');
    }
  }
  if (found(quota) && quota.chargedEvidenceStatus === 'CONFLICT') {
    requested.add('QUOTA_EVIDENCE_CONFLICT');
  }
  if (
    [
      submission,
      job,
      acknowledgement,
      moderation,
      employerOutbox,
      adminOutbox,
      quota,
    ].some(isDuplicate)
  ) {
    requested.add('DUPLICATE_RECORDS');
  }
  if (unexpected.state !== 'ABSENT') {
    requested.add('UNEXPECTED_OUTBOX_RECORDS');
  }
  return Object.freeze(
    PUBLISHING_RECONCILIATION_MISMATCH_CODES.filter((code) =>
      requested.has(code)
    )
  );
}

function collectMissingCodes(observations) {
  const requested = new Set();
  if (observations.submission.state === 'ABSENT') {
    requested.add('SUBMISSION_MISSING');
  }
  if (observations.canonicalJob.state === 'ABSENT') {
    requested.add('JOB_MISSING');
  }
  if (observations.acknowledgement.state === 'ABSENT') {
    requested.add('ACKNOWLEDGEMENT_MISSING');
  }
  if (observations.moderationEvent.state === 'ABSENT') {
    requested.add('MODERATION_EVENT_MISSING');
  }
  if (
    observations.outbox.employerSubmissionReceived.state === 'ABSENT' ||
    observations.outbox.adminJobReviewRequested.state === 'ABSENT'
  ) {
    requested.add('OUTBOX_INTENT_MISSING');
  }
  return Object.freeze(
    PUBLISHING_RECONCILIATION_MISSING_CODES.filter((code) =>
      requested.has(code)
    )
  );
}

function hasSecurityConflict(observations) {
  if (
    isDuplicate(observations.submission) ||
    isDuplicate(observations.acknowledgement) ||
    isDuplicate(observations.moderationEvent) ||
    isDuplicate(observations.outbox.employerSubmissionReceived) ||
    isDuplicate(observations.outbox.adminJobReviewRequested)
  ) {
    return true;
  }
  if (observations.submission.state === 'FOUND') {
    const submission = observations.submission;
    if (
      !submission.submissionIdMatches ||
      !submission.ownerMatches ||
      !submission.idempotencyKeyMatches ||
      !submission.requestFingerprintMatches ||
      !submission.jobIdMatches ||
      !submission.employerIdMatches ||
      !submission.candidateHashMatches ||
      !submission.candidateRevisionMatches ||
      !submission.candidateKindMatches ||
      !submission.baseBindingMatches
    ) {
      return true;
    }
  }
  if (
    observations.canonicalJob.state === 'FOUND' &&
    !observations.canonicalJob.ownerMatches
  ) {
    return true;
  }
  if (observations.acknowledgement.state === 'FOUND') {
    const value = observations.acknowledgement;
    if (
      !value.acknowledgementIdMatches ||
      !value.submissionIdMatches ||
      !value.jobIdMatches ||
      !value.employerIdMatches
    ) {
      return true;
    }
  }
  if (observations.moderationEvent.state === 'FOUND') {
    const value = observations.moderationEvent;
    if (
      !value.moderationEventIdMatches ||
      !value.submissionIdMatches ||
      !value.jobIdMatches ||
      !value.employerIdMatches ||
      !value.moderationCycleMatches ||
      !value.candidateHashMatches
    ) {
      return true;
    }
  }
  for (const value of [
    observations.outbox.employerSubmissionReceived,
    observations.outbox.adminJobReviewRequested,
  ]) {
    if (
      value.state === 'FOUND' &&
      (!value.deduplicationKeyMatches ||
        !value.submissionIdMatches ||
        !value.jobIdMatches)
    ) {
      return true;
    }
  }
  return false;
}

function hasCorruptTopology(observations) {
  const submission = observations.submission;
  const job = observations.canonicalJob;
  const acknowledgement = observations.acknowledgement;
  const moderation = observations.moderationEvent;
  const employerOutbox = observations.outbox.employerSubmissionReceived;
  const adminOutbox = observations.outbox.adminJobReviewRequested;
  const unexpected = observations.outbox.unexpectedRecords;
  const quota = observations.quota;
  if (
    isDuplicate(job) ||
    isDuplicate(quota) ||
    unexpected.state === 'FOUND' ||
    isDuplicate(unexpected)
  ) {
    return true;
  }
  if (submission.state === 'FOUND') {
    if (
      [acknowledgement, moderation, employerOutbox, adminOutbox, quota].some(
        ({ state }) => state === 'ABSENT'
      )
    ) {
      return true;
    }
    if (
      !submission.expectedPublicationVersionMatches ||
      !submission.stateMatches ||
      !submission.quotaEvidenceMatches ||
      !submission.safeResultAvailable
    ) {
      return true;
    }
  }
  if (
    submission.state === 'ABSENT' &&
    [acknowledgement, moderation, employerOutbox, adminOutbox, quota].some(
      ({ state }) => state === 'FOUND'
    )
  ) {
    return true;
  }
  if (
    (employerOutbox.state === 'FOUND') !== (adminOutbox.state === 'FOUND') &&
    [employerOutbox.state, adminOutbox.state].includes('ABSENT')
  ) {
    return true;
  }
  if (job.state === 'FOUND') {
    if (
      job.stateClassification === 'COMMITTED_MATCH' &&
      [
        submission,
        acknowledgement,
        moderation,
        employerOutbox,
        adminOutbox,
      ].some(({ state }) => state === 'ABSENT')
    ) {
      return true;
    }
    if (
      job.stateClassification === 'CONFLICT' ||
      !job.publicationVersionMatches ||
      !job.currentSubmissionMatches ||
      !job.lastApprovedSubmissionMatches ||
      !job.policyVersionMatches
    ) {
      return true;
    }
  }
  if (acknowledgement.state === 'FOUND') {
    const value = acknowledgement;
    if (
      !value.acceptedMatches ||
      !value.policyVersionMatches ||
      !value.rulesVersionMatches ||
      !value.rulesDigestMatches
    ) {
      return true;
    }
  }
  if (
    moderation.state === 'FOUND' &&
    (!moderation.actionMatches || !moderation.stateTransitionMatches)
  ) {
    return true;
  }
  for (const value of [employerOutbox, adminOutbox]) {
    if (
      value.state === 'FOUND' &&
      (!value.typeMatches ||
        !value.audienceMatches ||
        !value.employerPresenceMatches)
    ) {
      return true;
    }
  }
  return quota.state === 'FOUND' && quota.chargedEvidenceStatus === 'CONFLICT';
}

function hasIndeterminateEvidence(observations) {
  const states = [
    observations.submission,
    observations.canonicalJob,
    observations.acknowledgement,
    observations.moderationEvent,
    observations.outbox.employerSubmissionReceived,
    observations.outbox.adminJobReviewRequested,
    observations.outbox.unexpectedRecords,
    observations.quota,
  ].map(({ state }) => state);
  return (
    observations.readAuthority.status !== 'COMPLETE' ||
    observations.readAuthority.visibilityProven !== true ||
    states.includes('READ_FAILED')
  );
}

function allTrueExceptState(value) {
  return Object.entries(value).every(
    ([key, entry]) => key === 'state' || entry === true
  );
}

function isCommittedProof(context, observations) {
  const quotaMatches =
    observations.quota.state === 'FOUND' &&
    observations.quota.guardEvidenceStatus === 'NOT_OPERATION_ADDRESSABLE' &&
    observations.quota.chargedEvidenceStatus ===
      (context.quotaCharged ? 'MATCH' : 'NOT_APPLICABLE');
  return (
    observations.readAuthority.status === 'COMPLETE' &&
    observations.readAuthority.visibilityProven === true &&
    observations.submission.state === 'FOUND' &&
    allTrueExceptState(observations.submission) &&
    observations.canonicalJob.state === 'FOUND' &&
    observations.canonicalJob.stateClassification === 'COMMITTED_MATCH' &&
    Object.entries(observations.canonicalJob).every(
      ([key, value]) =>
        key === 'state' || key === 'stateClassification' || value === true
    ) &&
    observations.acknowledgement.state === 'FOUND' &&
    allTrueExceptState(observations.acknowledgement) &&
    observations.moderationEvent.state === 'FOUND' &&
    allTrueExceptState(observations.moderationEvent) &&
    observations.outbox.employerSubmissionReceived.state === 'FOUND' &&
    allTrueExceptState(observations.outbox.employerSubmissionReceived) &&
    observations.outbox.adminJobReviewRequested.state === 'FOUND' &&
    allTrueExceptState(observations.outbox.adminJobReviewRequested) &&
    observations.outbox.unexpectedRecords.state === 'ABSENT' &&
    quotaMatches
  );
}

function isNotCommittedProof(observations) {
  return (
    observations.readAuthority.status === 'COMPLETE' &&
    observations.readAuthority.visibilityProven === true &&
    observations.submission.state === 'ABSENT' &&
    observations.acknowledgement.state === 'ABSENT' &&
    observations.moderationEvent.state === 'ABSENT' &&
    observations.outbox.employerSubmissionReceived.state === 'ABSENT' &&
    observations.outbox.adminJobReviewRequested.state === 'ABSENT' &&
    observations.outbox.unexpectedRecords.state === 'ABSENT' &&
    observations.quota.state === 'ABSENT' &&
    observations.canonicalJob.state === 'FOUND' &&
    observations.canonicalJob.stateClassification === 'BASE_UNCHANGED' &&
    Object.entries(observations.canonicalJob).every(
      ([key, value]) =>
        key === 'state' || key === 'stateClassification' || value === true
    )
  );
}

function buildReconciliationResult(outcome, mismatchCodes, missingCodes) {
  const policy = PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY[outcome];
  return deepFreeze({
    schemaVersion: PUBLISHING_RECONCILIATION_SCHEMA_VERSION,
    outcome,
    actions: [...policy.actions],
    terminal: policy.terminal,
    success: policy.success,
    retryAllowed: policy.retryAllowed,
    reconcileLater: policy.reconcileLater,
    manualReviewRequired: policy.manualReviewRequired,
    securityReviewRequired: policy.securityReviewRequired,
    mismatchCodes: [...mismatchCodes],
    missingCodes: [...missingCodes],
  });
}

export function evaluatePublishingReconciliation(input) {
  try {
    assertStrictRecord(input, EVALUATION_FIELDS);
    const identity = comparePublishingOperationIdentity(
      input.operationContext,
      input.operationContext
    );
    if (identity.classification !== 'SAME_LOGICAL_OPERATION') {
      throw reconciliationError('RECONCILIATION_INPUT_INVALID');
    }
    const observations = validateObservationEnvelope(input.observations);
    const mismatchCodes = collectMismatchCodes(observations);
    const missingCodes = collectMissingCodes(observations);
    let outcome = 'INDETERMINATE';
    if (hasSecurityConflict(observations)) {
      outcome = 'SECURITY_CONFLICT';
    } else if (hasCorruptTopology(observations)) {
      outcome = 'CORRUPT';
    } else if (hasIndeterminateEvidence(observations)) {
      outcome = 'INDETERMINATE';
    } else if (isCommittedProof(input.operationContext, observations)) {
      outcome = 'COMMITTED';
    } else if (isNotCommittedProof(observations)) {
      outcome = 'NOT_COMMITTED';
    }
    return buildReconciliationResult(outcome, mismatchCodes, missingCodes);
  } catch (error) {
    if (error instanceof PublishingReconciliationContractError) {
      throw error;
    }
    if (error?.code?.startsWith('OPERATION_')) {
      throw reconciliationError('RECONCILIATION_INPUT_INVALID');
    }
    throw reconciliationError('RECONCILIATION_COMPARISON_FAILED');
  }
}
