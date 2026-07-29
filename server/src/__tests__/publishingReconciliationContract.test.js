import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as contract from '../services/publishing/contracts/PublishingReconciliationContract.js';

const {
  PUBLISHING_RECONCILIATION_SCHEMA_VERSION,
  PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS,
  PUBLISHING_RECONCILIATION_READ_AUTHORITY_FIELDS,
  PUBLISHING_RECONCILIATION_SUBMISSION_FOUND_FIELDS,
  PUBLISHING_RECONCILIATION_JOB_FOUND_FIELDS,
  PUBLISHING_RECONCILIATION_ACKNOWLEDGEMENT_FOUND_FIELDS,
  PUBLISHING_RECONCILIATION_MODERATION_FOUND_FIELDS,
  PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS,
  PUBLISHING_RECONCILIATION_QUOTA_FOUND_FIELDS,
  PUBLISHING_RECONCILIATION_RESULT_FIELDS,
  PUBLISHING_RECONCILIATION_OBSERVATION_STATES,
  PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES,
  PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS,
  PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS,
  PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES,
  PUBLISHING_RECONCILIATION_OUTCOMES,
  PUBLISHING_RECONCILIATION_ACTIONS,
  PUBLISHING_RECONCILIATION_MISMATCH_CODES,
  PUBLISHING_RECONCILIATION_MISSING_CODES,
  PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES,
  PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY,
  PUBLISHING_RECONCILIATION_BOUNDS,
  PUBLISHING_RECONCILIATION_ERROR_CODES,
  PUBLISHING_RECONCILIATION_ERROR_MESSAGES,
  PublishingReconciliationContractError,
  evaluatePublishingReconciliation,
} = contract;

let assertions = 0;
function equal(actual, expected, message) {
  assertions += 1;
  assert.strictEqual(actual, expected, message);
}
function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepStrictEqual(actual, expected, message);
}
function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function throwsCode(action, code = 'RECONCILIATION_INPUT_INVALID') {
  assertions += 1;
  assert.throws(
    action,
    (error) =>
      error instanceof PublishingReconciliationContractError &&
      error.code === code
  );
}

const ID = Object.freeze({
  owner: '111111111111111111111111',
  job: '222222222222222222222222',
  submission: '333333333333333333333333',
  acknowledgement: '444444444444444444444444',
  moderation: '555555555555555555555555',
  cycle: '666666666666666666666666',
  base: '777777777777777777777777',
});
const NOW = '2026-07-30T10:00:00.000Z';

function operationContext(overrides = {}) {
  const submissionId = overrides.submissionId || ID.submission;
  return {
    schemaVersion: 1,
    policyVersion: 'free-beta-2026-01',
    operationId: '123e4567-e89b-42d3-a456-426614174000',
    operationKind: 'major_edit_submission',
    ownerType: 'employer',
    ownerId: ID.owner,
    employerId: ID.owner,
    jobId: ID.job,
    idempotencyKey: 'stable-key-123456',
    submissionId,
    acknowledgementId: ID.acknowledgement,
    moderationEventId: ID.moderation,
    newModerationCycleId: ID.cycle,
    expectedPublicationVersion: 7,
    expectedPublicationState: 'active',
    correctionOfSubmissionId: null,
    rulesVersion: 'employer-rules-1',
    outboxDeduplicationKeys: {
      employerSubmissionReceived: `${submissionId}:employer_submission_received`,
      adminJobReviewRequested: `${submissionId}:admin_job_review_requested`,
    },
    initiatedAt: NOW,
    requestFingerprint: 'a'.repeat(64),
    candidateHash: 'b'.repeat(64),
    candidateRevision: 1,
    candidateKind: 'major_edit',
    baseApprovedSubmissionId: ID.base,
    baseApprovedCandidateHash: 'c'.repeat(64),
    basePublicationVersion: 7,
    actualModerationCycleId: ID.cycle,
    expectedCommittedPublicationVersion: 8,
    expectedCommittedPublicationState: 'pending_review',
    expectedCurrentSubmissionId: submissionId,
    rulesDigest: 'd'.repeat(64),
    quotaCharged: true,
    ...overrides,
  };
}

const foundSubmission = () => ({
  state: 'FOUND',
  submissionIdMatches: true,
  ownerMatches: true,
  idempotencyKeyMatches: true,
  requestFingerprintMatches: true,
  jobIdMatches: true,
  employerIdMatches: true,
  candidateHashMatches: true,
  candidateRevisionMatches: true,
  candidateKindMatches: true,
  baseBindingMatches: true,
  expectedPublicationVersionMatches: true,
  stateMatches: true,
  quotaEvidenceMatches: true,
  safeResultAvailable: true,
});
const foundJob = (stateClassification = 'COMMITTED_MATCH') => ({
  state: 'FOUND',
  stateClassification,
  ownerMatches: true,
  publicationVersionMatches: true,
  currentSubmissionMatches: true,
  lastApprovedSubmissionMatches: true,
  policyVersionMatches: true,
});
const foundAcknowledgement = () => ({
  state: 'FOUND',
  acknowledgementIdMatches: true,
  submissionIdMatches: true,
  jobIdMatches: true,
  employerIdMatches: true,
  acceptedMatches: true,
  policyVersionMatches: true,
  rulesVersionMatches: true,
  rulesDigestMatches: true,
});
const foundModeration = () => ({
  state: 'FOUND',
  moderationEventIdMatches: true,
  submissionIdMatches: true,
  jobIdMatches: true,
  employerIdMatches: true,
  actionMatches: true,
  stateTransitionMatches: true,
  moderationCycleMatches: true,
  candidateHashMatches: true,
});
const foundOutbox = () => ({
  state: 'FOUND',
  deduplicationKeyMatches: true,
  submissionIdMatches: true,
  jobIdMatches: true,
  typeMatches: true,
  audienceMatches: true,
  employerPresenceMatches: true,
});
const foundQuota = (chargedEvidenceStatus = 'MATCH') => ({
  state: 'FOUND',
  chargedEvidenceStatus,
  guardEvidenceStatus: 'NOT_OPERATION_ADDRESSABLE',
});
const absent = () => ({ state: 'ABSENT' });

function completeAuthority() {
  return {
    status: 'COMPLETE',
    source: 'primary',
    consistency: 'majority_snapshot',
    roundsCompleted: 3,
    visibilityProven: true,
    failureClassification: null,
  };
}
function failedAuthority() {
  return {
    status: 'RETRYABLE_FAILURE',
    source: 'primary',
    consistency: 'majority_snapshot',
    roundsCompleted: 2,
    visibilityProven: false,
    failureClassification: 'CONNECTION_UNAVAILABLE',
  };
}

function committedObservations() {
  return {
    schemaVersion: 1,
    observedAt: NOW,
    readAuthority: completeAuthority(),
    submission: foundSubmission(),
    canonicalJob: foundJob(),
    acknowledgement: foundAcknowledgement(),
    moderationEvent: foundModeration(),
    outbox: {
      employerSubmissionReceived: foundOutbox(),
      adminJobReviewRequested: foundOutbox(),
      unexpectedRecords: absent(),
    },
    quota: foundQuota(),
  };
}

function notCommittedObservations() {
  return {
    schemaVersion: 1,
    observedAt: NOW,
    readAuthority: completeAuthority(),
    submission: absent(),
    canonicalJob: foundJob('BASE_UNCHANGED'),
    acknowledgement: absent(),
    moderationEvent: absent(),
    outbox: {
      employerSubmissionReceived: absent(),
      adminJobReviewRequested: absent(),
      unexpectedRecords: absent(),
    },
    quota: absent(),
  };
}

function evaluate(observations, context = operationContext()) {
  return evaluatePublishingReconciliation({
    operationContext: context,
    observations,
  });
}

const expectedExports = [
  'PUBLISHING_RECONCILIATION_ACKNOWLEDGEMENT_FOUND_FIELDS',
  'PUBLISHING_RECONCILIATION_ACTIONS',
  'PUBLISHING_RECONCILIATION_BOUNDS',
  'PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES',
  'PUBLISHING_RECONCILIATION_ERROR_CODES',
  'PUBLISHING_RECONCILIATION_ERROR_MESSAGES',
  'PUBLISHING_RECONCILIATION_JOB_FOUND_FIELDS',
  'PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS',
  'PUBLISHING_RECONCILIATION_MISMATCH_CODES',
  'PUBLISHING_RECONCILIATION_MISSING_CODES',
  'PUBLISHING_RECONCILIATION_MODERATION_FOUND_FIELDS',
  'PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS',
  'PUBLISHING_RECONCILIATION_OBSERVATION_STATES',
  'PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS',
  'PUBLISHING_RECONCILIATION_OUTCOMES',
  'PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY',
  'PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES',
  'PUBLISHING_RECONCILIATION_QUOTA_FOUND_FIELDS',
  'PUBLISHING_RECONCILIATION_READ_AUTHORITY_FIELDS',
  'PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES',
  'PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS',
  'PUBLISHING_RECONCILIATION_RESULT_FIELDS',
  'PUBLISHING_RECONCILIATION_SCHEMA_VERSION',
  'PUBLISHING_RECONCILIATION_SUBMISSION_FOUND_FIELDS',
  'PublishingReconciliationContractError',
  'evaluatePublishingReconciliation',
];
deepEqual(Object.keys(contract).sort(), expectedExports);
equal(PUBLISHING_RECONCILIATION_SCHEMA_VERSION, 1);
equal(PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS.length, 9);
equal(PUBLISHING_RECONCILIATION_READ_AUTHORITY_FIELDS.length, 6);
equal(PUBLISHING_RECONCILIATION_SUBMISSION_FOUND_FIELDS.length, 15);
equal(PUBLISHING_RECONCILIATION_JOB_FOUND_FIELDS.length, 7);
equal(PUBLISHING_RECONCILIATION_ACKNOWLEDGEMENT_FOUND_FIELDS.length, 9);
equal(PUBLISHING_RECONCILIATION_MODERATION_FOUND_FIELDS.length, 9);
equal(PUBLISHING_RECONCILIATION_OUTBOX_FOUND_FIELDS.length, 7);
equal(PUBLISHING_RECONCILIATION_QUOTA_FOUND_FIELDS.length, 3);
equal(PUBLISHING_RECONCILIATION_RESULT_FIELDS.length, 11);
deepEqual(PUBLISHING_RECONCILIATION_OBSERVATION_STATES, [
  'FOUND',
  'ABSENT',
  'DUPLICATE',
  'DUPLICATE_OVERFLOW',
  'READ_FAILED',
]);
deepEqual(PUBLISHING_RECONCILIATION_OUTCOMES, [
  'COMMITTED',
  'NOT_COMMITTED',
  'INDETERMINATE',
  'CORRUPT',
  'SECURITY_CONFLICT',
]);
equal(PUBLISHING_RECONCILIATION_MISMATCH_CODES.length, 16);
equal(PUBLISHING_RECONCILIATION_MISSING_CODES.length, 5);
equal(PUBLISHING_RECONCILIATION_ACTIONS.length, 7);
equal(PUBLISHING_RECONCILIATION_ERROR_CODES.length, 2);
equal(PUBLISHING_RECONCILIATION_BOUNDS.duplicateCountMinimum, 2);
equal(PUBLISHING_RECONCILIATION_BOUNDS.duplicateCountMaximum, 10);
equal(PUBLISHING_RECONCILIATION_BOUNDS.duplicateOverflowThreshold, 11);
equal(PUBLISHING_RECONCILIATION_BOUNDS.maximumReconciliationCategoryCount, 21);
equal(PUBLISHING_RECONCILIATION_BOUNDS.actionMaximum, 4);
for (const value of [
  PUBLISHING_RECONCILIATION_OBSERVATION_FIELDS,
  PUBLISHING_RECONCILIATION_OBSERVATION_STATES,
  PUBLISHING_RECONCILIATION_READ_AUTHORITY_STATUSES,
  PUBLISHING_RECONCILIATION_READ_FAILURE_CLASSIFICATIONS,
  PUBLISHING_RECONCILIATION_JOB_STATE_CLASSIFICATIONS,
  PUBLISHING_RECONCILIATION_QUOTA_CHARGED_STATUSES,
  PUBLISHING_RECONCILIATION_OUTCOMES,
  PUBLISHING_RECONCILIATION_ACTIONS,
  PUBLISHING_RECONCILIATION_MISMATCH_CODES,
  PUBLISHING_RECONCILIATION_MISSING_CODES,
  PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES,
  PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY,
  PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY.SECURITY_CONFLICT.actions,
  PUBLISHING_RECONCILIATION_BOUNDS,
  PUBLISHING_RECONCILIATION_ERROR_CODES,
  PUBLISHING_RECONCILIATION_ERROR_MESSAGES,
]) {
  equal(Object.isFrozen(value), true);
}

const committed = evaluate(committedObservations());
equal(committed.outcome, 'COMMITTED');
deepEqual(Object.keys(committed), PUBLISHING_RECONCILIATION_RESULT_FIELDS);
deepEqual(
  committed.actions,
  PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY.COMMITTED.actions
);
equal(committed.terminal, true);
equal(committed.success, true);
equal(committed.retryAllowed, false);
equal(committed.reconcileLater, false);
equal(committed.manualReviewRequired, false);
equal(committed.securityReviewRequired, false);
deepEqual(committed.mismatchCodes, []);
deepEqual(committed.missingCodes, []);
equal(Object.isFrozen(committed), true);
equal(Object.isFrozen(committed.actions), true);
equal(Object.isFrozen(committed.mismatchCodes), true);
deepEqual(structuredClone(committed), committed);
deepEqual(JSON.parse(JSON.stringify(committed)), committed);

const notCommitted = evaluate(notCommittedObservations());
equal(notCommitted.outcome, 'NOT_COMMITTED');
deepEqual(
  notCommitted.actions,
  PUBLISHING_RECONCILIATION_OUTCOME_ACTION_POLICY.NOT_COMMITTED.actions
);
equal(notCommitted.retryAllowed, true);
equal(notCommitted.success, false);
deepEqual(notCommitted.missingCodes, [
  'SUBMISSION_MISSING',
  'ACKNOWLEDGEMENT_MISSING',
  'MODERATION_EVENT_MISSING',
  'OUTBOX_INTENT_MISSING',
]);

const componentPaths = [
  ['submission'],
  ['canonicalJob'],
  ['acknowledgement'],
  ['moderationEvent'],
  ['outbox', 'employerSubmissionReceived'],
  ['outbox', 'adminJobReviewRequested'],
  ['outbox', 'unexpectedRecords'],
  ['quota'],
];

function setPath(source, path, value) {
  const clone = structuredClone(source);
  let target = clone;
  for (const part of path.slice(0, -1)) target = target[part];
  target[path.at(-1)] = value;
  return clone;
}

for (const path of componentPaths) {
  for (const value of [
    { state: 'ABSENT' },
    { state: 'DUPLICATE', count: 2 },
    { state: 'DUPLICATE', count: 10 },
    { state: 'DUPLICATE_OVERFLOW' },
  ]) {
    const result = evaluate(setPath(committedObservations(), path, value));
    ok(PUBLISHING_RECONCILIATION_OUTCOMES.includes(result.outcome));
  }
  const failed = setPath(committedObservations(), path, {
    state: 'READ_FAILED',
  });
  failed.readAuthority = failedAuthority();
  equal(evaluate(failed).outcome, 'INDETERMINATE');
  for (const invalid of [
    { state: 'DUPLICATE', count: 1 },
    { state: 'DUPLICATE', count: 11 },
    { state: 'DUPLICATE_OVERFLOW', count: 11 },
    { state: 'ABSENT', error: 'private' },
    { state: 'READ_FAILED', stack: 'private' },
    { state: 'UNKNOWN' },
  ]) {
    throwsCode(() => evaluate(setPath(committedObservations(), path, invalid)));
  }
}

const submissionSecurityFields = [
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
];
for (const field of submissionSecurityFields) {
  const observations = committedObservations();
  observations.submission[field] = false;
  equal(evaluate(observations).outcome, 'SECURITY_CONFLICT', field);
}
for (const field of [
  'expectedPublicationVersionMatches',
  'stateMatches',
  'quotaEvidenceMatches',
  'safeResultAvailable',
]) {
  const observations = committedObservations();
  observations.submission[field] = false;
  equal(evaluate(observations).outcome, 'CORRUPT', field);
}
for (const field of [
  'acknowledgementIdMatches',
  'submissionIdMatches',
  'jobIdMatches',
  'employerIdMatches',
]) {
  const observations = committedObservations();
  observations.acknowledgement[field] = false;
  equal(evaluate(observations).outcome, 'SECURITY_CONFLICT', field);
}
for (const field of [
  'acceptedMatches',
  'policyVersionMatches',
  'rulesVersionMatches',
  'rulesDigestMatches',
]) {
  const observations = committedObservations();
  observations.acknowledgement[field] = false;
  equal(evaluate(observations).outcome, 'CORRUPT', field);
}
for (const field of [
  'moderationEventIdMatches',
  'submissionIdMatches',
  'jobIdMatches',
  'employerIdMatches',
  'moderationCycleMatches',
  'candidateHashMatches',
]) {
  const observations = committedObservations();
  observations.moderationEvent[field] = false;
  equal(evaluate(observations).outcome, 'SECURITY_CONFLICT', field);
}
for (const field of ['actionMatches', 'stateTransitionMatches']) {
  const observations = committedObservations();
  observations.moderationEvent[field] = false;
  equal(evaluate(observations).outcome, 'CORRUPT', field);
}

for (const outboxName of [
  'employerSubmissionReceived',
  'adminJobReviewRequested',
]) {
  for (const field of [
    'deduplicationKeyMatches',
    'submissionIdMatches',
    'jobIdMatches',
  ]) {
    const observations = committedObservations();
    observations.outbox[outboxName][field] = false;
    equal(evaluate(observations).outcome, 'SECURITY_CONFLICT');
  }
  for (const field of [
    'typeMatches',
    'audienceMatches',
    'employerPresenceMatches',
  ]) {
    const observations = committedObservations();
    observations.outbox[outboxName][field] = false;
    equal(evaluate(observations).outcome, 'CORRUPT');
  }
}

for (const path of componentPaths) {
  const duplicate = setPath(committedObservations(), path, {
    state: 'DUPLICATE_OVERFLOW',
  });
  const key = path.at(-1);
  const expected =
    PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES[key] ||
    PUBLISHING_RECONCILIATION_DUPLICATE_OUTCOMES[path[0]];
  equal(evaluate(duplicate).outcome, expected, path.join('.'));
}

const securityPlusFailure = committedObservations();
securityPlusFailure.submission.ownerMatches = false;
securityPlusFailure.quota = { state: 'READ_FAILED' };
securityPlusFailure.readAuthority = failedAuthority();
equal(evaluate(securityPlusFailure).outcome, 'SECURITY_CONFLICT');

const corruptionPlusFailure = committedObservations();
corruptionPlusFailure.acknowledgement = absent();
corruptionPlusFailure.quota = { state: 'READ_FAILED' };
corruptionPlusFailure.readAuthority = failedAuthority();
equal(evaluate(corruptionPlusFailure).outcome, 'CORRUPT');

const securityPlusCorruption = committedObservations();
securityPlusCorruption.submission.ownerMatches = false;
securityPlusCorruption.acknowledgement = absent();
equal(evaluate(securityPlusCorruption).outcome, 'SECURITY_CONFLICT');

const securityPlusOverflow = committedObservations();
securityPlusOverflow.submission.ownerMatches = false;
securityPlusOverflow.quota = { state: 'DUPLICATE_OVERFLOW' };
equal(evaluate(securityPlusOverflow).outcome, 'SECURITY_CONFLICT');

const absentPlusFailure = notCommittedObservations();
absentPlusFailure.moderationEvent = { state: 'READ_FAILED' };
absentPlusFailure.readAuthority = failedAuthority();
equal(evaluate(absentPlusFailure).outcome, 'INDETERMINATE');

const allAbsentChangedJob = notCommittedObservations();
allAbsentChangedJob.canonicalJob = foundJob('CONFLICT');
equal(evaluate(allAbsentChangedJob).outcome, 'CORRUPT');

const fallback = notCommittedObservations();
fallback.canonicalJob = absent();
equal(evaluate(fallback).outcome, 'INDETERMINATE');

const oneOutboxMissing = committedObservations();
oneOutboxMissing.outbox.adminJobReviewRequested = absent();
equal(evaluate(oneOutboxMissing).outcome, 'CORRUPT');

const unexpectedOutbox = committedObservations();
unexpectedOutbox.outbox.unexpectedRecords = { state: 'FOUND' };
equal(evaluate(unexpectedOutbox).outcome, 'CORRUPT');
deepEqual(evaluate(unexpectedOutbox).mismatchCodes, [
  'UNEXPECTED_OUTBOX_RECORDS',
]);

const exemptContext = operationContext({
  operationKind: 'correction_submission',
  operationId: '223e4567-e89b-42d3-a456-426614174001',
  expectedPublicationVersion: 8,
  expectedPublicationState: 'rejected',
  correctionOfSubmissionId: '888888888888888888888888',
  candidateRevision: 2,
  candidateKind: 'correction',
  basePublicationVersion: 7,
  actualModerationCycleId: '999999999999999999999999',
  expectedCommittedPublicationVersion: 9,
  quotaCharged: false,
});
const exemptObservations = committedObservations();
exemptObservations.quota = foundQuota('NOT_APPLICABLE');
equal(evaluate(exemptObservations, exemptContext).outcome, 'COMMITTED');

const ordered = committedObservations();
const reversed = Object.fromEntries(Object.entries(ordered).reverse());
equal(evaluate(reversed).outcome, 'COMMITTED');

for (const hostile of [
  null,
  [],
  new Date(),
  /x/u,
  new Map(),
  new Set(),
  new (class Envelope {})(),
  Object.create({ inherited: true }),
]) {
  throwsCode(() => evaluatePublishingReconciliation(hostile));
}
const unknownEnvelope = {
  operationContext: operationContext(),
  observations: committedObservations(),
  metadata: {},
};
throwsCode(() => evaluatePublishingReconciliation(unknownEnvelope));
const accessor = committedObservations();
Object.defineProperty(accessor, 'submission', {
  enumerable: true,
  get: foundSubmission,
});
throwsCode(() => evaluate(accessor));
const hidden = committedObservations();
Object.defineProperty(hidden.submission, 'hidden', { value: true });
throwsCode(() => evaluate(hidden));
const symbol = committedObservations();
symbol.submission[Symbol('private')] = true;
throwsCode(() => evaluate(symbol));

for (const code of PUBLISHING_RECONCILIATION_ERROR_CODES) {
  const error = new PublishingReconciliationContractError(code, {
    operationId: operationContext().operationId,
    observation: committedObservations(),
  });
  deepEqual(Object.keys(error.toJSON()), ['status', 'code', 'message']);
  equal(error.toJSON().code, code);
  equal(error.toJSON().message, PUBLISHING_RECONCILIATION_ERROR_MESSAGES[code]);
  equal(JSON.stringify(error.toJSON()).includes(ID.job), false);
  equal(Object.isFrozen(error.toJSON()), true);
}
const safeFallback = new PublishingReconciliationContractError(
  'CALLER_CONTROLLED'
);
equal(safeFallback.code, 'RECONCILIATION_INPUT_INVALID');

for (const result of [
  committed,
  notCommitted,
  evaluate(securityPlusFailure),
  evaluate(corruptionPlusFailure),
  evaluate(absentPlusFailure),
]) {
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    ID.owner,
    ID.job,
    ID.submission,
    operationContext().operationId,
    operationContext().candidateHash,
    ':employer_submission_received',
  ]) {
    equal(serialized.includes(forbidden), false);
  }
  equal(result.actions.includes('RETRY_WRITE'), false);
}

const source = readFileSync(
  fileURLToPath(
    new URL(
      '../services/publishing/contracts/PublishingReconciliationContract.js',
      import.meta.url
    )
  ),
  'utf8'
);
for (const forbidden of [
  'mongoose',
  'mongodb',
  'process.env',
  'readFile',
  'writeFile',
  'console.',
  'setTimeout',
  'setInterval',
  'addEventListener',
  '/models/',
  '/controllers/',
  '/routes/',
  'TransactionalFreeBetaSubmissionService',
  'findOne',
  'aggregate(',
]) {
  equal(source.includes(forbidden), false, forbidden);
}

console.log(
  `publishingReconciliationContract.test.js: ${assertions} assertions passed`
);
