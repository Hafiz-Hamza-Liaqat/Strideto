/**
 * Run: node src/__tests__/transactionalFreeBetaSubmissionBoundaryCorrection.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildMajorEditPublicationCandidate,
  buildPublicationCandidateCorrection,
} from '../services/publishing/contracts/PublicationCandidateContract.js';
import { buildPublishingOperationSeed } from '../services/publishing/contracts/PublishingOperationContextContract.js';
import * as serviceModule from '../services/publishing/TransactionalFreeBetaSubmissionService.js';

const {
  TRANSACTION_SERVICE_BOUNDARY_OUTCOMES,
  TRANSACTION_SERVICE_BOUNDARY_INPUT_FIELDS,
  TRANSACTION_SERVICE_BOUNDARY_OPERATION_FIELDS,
  TRANSACTION_SERVICE_BOUNDARY_EFFECT_FIELDS,
  TRANSACTION_SERVICE_BOUNDARY_RESULT_FIELDS,
  TransactionalSubmissionBoundaryError,
  createDormantTransactionalFreeBetaSubmissionBoundary,
  getTransactionalSubmissionReconciliationContext,
} = serviceModule;

let assertions = 0;
function equal(actual, expected, message) {
  assertions += 1;
  assert.strictEqual(actual, expected, message);
}
function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepStrictEqual(actual, expected, message);
}
async function rejectsCode(action, code) {
  assertions += 1;
  await assert.rejects(
    action,
    (error) =>
      error instanceof TransactionalSubmissionBoundaryError &&
      error.code === code
  );
}

const IDS = Object.freeze({
  base: '111111111111111111111111',
  job: '222222222222222222222222',
  owner: '333333333333333333333333',
  submission: '444444444444444444444444',
  acknowledgement: '555555555555555555555555',
  moderation: '666666666666666666666666',
  newCycle: '777777777777777777777777',
  correction: '888888888888888888888888',
  predecessorCycle: '999999999999999999999999',
});
const NOW = '2026-07-30T10:00:00.000Z';
const BASE_HASH = 'a'.repeat(64);
const REQUEST_HASH = 'b'.repeat(64);
const RULES_HASH = 'c'.repeat(64);

deepEqual(Object.keys(serviceModule), [
  'PublishingSubmissionDomainError',
  'TRANSACTIONAL_JOB_REPOSITORY_CONTRACT',
  'TRANSACTION_SERVICE_BOUNDARY_EFFECT_FIELDS',
  'TRANSACTION_SERVICE_BOUNDARY_INPUT_FIELDS',
  'TRANSACTION_SERVICE_BOUNDARY_OPERATION_FIELDS',
  'TRANSACTION_SERVICE_BOUNDARY_OUTCOMES',
  'TRANSACTION_SERVICE_BOUNDARY_RESULT_FIELDS',
  'TransactionalSubmissionBoundaryError',
  'createDormantTransactionalFreeBetaSubmissionBoundary',
  'createTransactionalFreeBetaSubmissionService',
  'getTransactionalSubmissionReconciliationContext',
]);

function destination() {
  return {
    schemaVersion: 1,
    mode: 'internal_platform',
    normalizedTarget: null,
    targetDigest:
      'c2b68765289729eb2eac3cf25926e9845bd16204eac01471273a20fca000a0b8',
    normalizedDomain: null,
    trustClassification: 'INTERNAL_PLATFORM',
    evidenceSource: 'server_derived_internal_route',
    evaluatedAt: NOW,
    validationPolicyVersion: 'free-beta-2026-01',
    classifiedByActorType: 'system',
    classifiedByActorId: null,
  };
}

function content() {
  return {
    title: 'Engineer',
    companyName: 'Example Employer',
    organizationName: null,
    description: 'Build reliable systems.',
    requirements: ['Relevant degree'],
    responsibilities: [],
    benefits: [],
    skillsRequired: ['Node.js'],
    salaryRange: null,
    salaryCurrency: 'PKR',
    location: 'Lahore',
    province: 'Punjab',
    city: 'Lahore',
    category: 'Technology',
    employmentType: 'full-time',
    jobType: 'Private',
    educationRequirement: 'Bachelor',
    experience: '2 years',
    gender: null,
    workMode: 'on_site',
    deadline: '2027-01-01T00:00:00.000Z',
    totalSeats: null,
    autoCloseWhenFilled: true,
    applicationInstructions: null,
    logoUrl: null,
    gallery: [],
  };
}

function majorCandidate() {
  return buildMajorEditPublicationCandidate(
    {
      approvedBase: {
        approvedSubmissionId: IDS.base,
        approvedPublicationVersion: 7,
        approvedCandidateHash: BASE_HASH,
        content: content(),
        destinationEvidence: destination(),
      },
      patch: {},
    },
    {
      jobId: IDS.job,
      expectedPublicationVersion: 7,
      evaluatedAt: new Date(NOW),
    }
  );
}

function correctionCandidate() {
  return buildPublicationCandidateCorrection(
    {
      priorCandidate: majorCandidate(),
      patch: { educationRequirement: 'Bachelor or equivalent experience' },
    },
    {
      jobId: IDS.job,
      expectedPublicationVersion: 8,
      evaluatedAt: new Date(NOW),
    }
  );
}

function majorSeed() {
  return buildPublishingOperationSeed(
    {
      operationId: '123e4567-e89b-42d3-a456-426614174000',
      operationKind: 'major_edit_submission',
      ownerType: 'employer',
      ownerId: IDS.owner,
      employerId: IDS.owner,
      jobId: IDS.job,
      idempotencyKey: 'stable-key-123456',
      submissionId: IDS.submission,
      acknowledgementId: IDS.acknowledgement,
      moderationEventId: IDS.moderation,
      newModerationCycleId: IDS.newCycle,
      expectedPublicationVersion: 7,
      expectedPublicationState: 'active',
      correctionOfSubmissionId: null,
      rulesVersion: 'employer-rules-1',
    },
    { initiatedAt: new Date(NOW) }
  );
}

function correctionSeed() {
  return buildPublishingOperationSeed(
    {
      operationId: '223e4567-e89b-42d3-a456-426614174001',
      operationKind: 'correction_submission',
      ownerType: 'employer',
      ownerId: IDS.owner,
      employerId: IDS.owner,
      jobId: IDS.job,
      idempotencyKey: 'stable-key-654321',
      submissionId: IDS.submission,
      acknowledgementId: IDS.acknowledgement,
      moderationEventId: IDS.moderation,
      newModerationCycleId: IDS.newCycle,
      expectedPublicationVersion: 8,
      expectedPublicationState: 'rejected',
      correctionOfSubmissionId: IDS.correction,
      rulesVersion: 'employer-rules-1',
    },
    { initiatedAt: new Date(NOW) }
  );
}

function verificationSnapshot() {
  return {
    verified: true,
    verificationLevel: 'verified',
    accountStatus: 'active',
    normalizedCompanyName: 'Example Employer',
    emailPresent: true,
    emailValid: true,
    emailDomain: 'example.test',
    websiteDomain: null,
    requiredProfileChecks: {
      companyName: true,
      email: true,
      companyDescription: true,
      industry: true,
      location: true,
      website: true,
    },
    predicateCapabilityVersion: 'free-beta-employer-eligibility-v1',
    eligibilityResultCodes: [],
  };
}

function usage({
  dailyUsed,
  monthlyUsed,
  activeUsed,
  dailyTime = null,
  monthlyTime = null,
}) {
  return {
    daily: {
      used: dailyUsed,
      limit: 1,
      remaining: Math.max(0, 1 - dailyUsed),
      nextEligibleAt: dailyTime,
    },
    rolling30Days: {
      used: monthlyUsed,
      limit: 10,
      remaining: Math.max(0, 10 - monthlyUsed),
      nextSlotAt: monthlyTime,
    },
    activeFreeJobs: {
      planCode: 'free_beta',
      used: activeUsed,
      limit: 5,
      remaining: Math.max(0, 5 - activeUsed),
      hasCapacity: activeUsed < 5,
    },
  };
}

function quotaSnapshot({
  charged = true,
  activeRelease = true,
  beforeDaily = 0,
  beforeMonthly = 0,
  beforeActive = 5,
} = {}) {
  return {
    policyCode: 'free_beta',
    policyVersion: 'free-beta-2026-01',
    capturedAt: NOW,
    before: usage({
      dailyUsed: beforeDaily,
      monthlyUsed: beforeMonthly,
      activeUsed: beforeActive,
    }),
    after: usage({
      dailyUsed: beforeDaily + (charged ? 1 : 0),
      monthlyUsed: beforeMonthly + (charged ? 1 : 0),
      activeUsed: beforeActive - (activeRelease ? 1 : 0),
    }),
  };
}

function majorInput(overrides = {}) {
  return {
    operationSeed: majorSeed(),
    candidate: majorCandidate(),
    requestFingerprint: REQUEST_HASH,
    rulesDigest: RULES_HASH,
    employerEligibility: {
      eligible: true,
      verificationSnapshot: verificationSnapshot(),
    },
    correctionDecision: {
      classification: 'not_applicable',
      quotaCharged: true,
      quotaExemptionReason: null,
      moderationCycleId: IDS.newCycle,
      blockerCodes: [],
    },
    quotaSnapshot: quotaSnapshot(),
    ...overrides,
  };
}

function chargedCorrectionInput(overrides = {}) {
  return {
    operationSeed: correctionSeed(),
    candidate: correctionCandidate(),
    requestFingerprint: REQUEST_HASH,
    rulesDigest: RULES_HASH,
    employerEligibility: {
      eligible: true,
      verificationSnapshot: verificationSnapshot(),
    },
    correctionDecision: {
      classification: 'charged_correction',
      quotaCharged: true,
      quotaExemptionReason: null,
      moderationCycleId: IDS.newCycle,
      blockerCodes: ['MODERATION_CYCLE_MISSING'],
    },
    quotaSnapshot: quotaSnapshot({ activeRelease: false }),
    ...overrides,
  };
}

function exemptCorrectionInput(overrides = {}) {
  return {
    operationSeed: correctionSeed(),
    candidate: correctionCandidate(),
    requestFingerprint: REQUEST_HASH,
    rulesDigest: RULES_HASH,
    employerEligibility: {
      eligible: true,
      verificationSnapshot: verificationSnapshot(),
    },
    correctionDecision: {
      classification: 'reviewer_requested_exempt',
      quotaCharged: false,
      quotaExemptionReason: 'reviewer_requested_correction',
      moderationCycleId: IDS.predecessorCycle,
      blockerCodes: [],
    },
    quotaSnapshot: quotaSnapshot({
      charged: false,
      activeRelease: false,
    }),
    ...overrides,
  };
}

function createHarness(outcome = 'COMMIT_ACKNOWLEDGED') {
  const state = {
    calls: 0,
    operations: [],
    outcome,
    throwError: false,
    resultTransform: null,
  };
  const boundary = createDormantTransactionalFreeBetaSubmissionBoundary({
    transactionExecutor: {
      async execute(operation) {
        state.calls += 1;
        state.operations.push(operation);
        if (state.throwError) throw new Error('private driver failure');
        if (state.resultTransform) return state.resultTransform(operation);
        if (state.outcome === 'COMMIT_ACKNOWLEDGED') {
          return {
            outcome: state.outcome,
            operationContext: operation.operationContext,
          };
        }
        return { outcome: state.outcome };
      },
    },
  });
  return { boundary, state };
}

deepEqual(TRANSACTION_SERVICE_BOUNDARY_OUTCOMES, [
  'COMMIT_ACKNOWLEDGED',
  'DEFINITELY_ABORTED',
  'APPLICATION_ERROR_BEFORE_COMMIT',
  'COMMIT_RESULT_UNKNOWN',
]);
deepEqual(TRANSACTION_SERVICE_BOUNDARY_INPUT_FIELDS, [
  'operationSeed',
  'candidate',
  'requestFingerprint',
  'rulesDigest',
  'employerEligibility',
  'correctionDecision',
  'quotaSnapshot',
]);
deepEqual(TRANSACTION_SERVICE_BOUNDARY_OPERATION_FIELDS, [
  'schemaVersion',
  'operationContext',
  'intendedEffects',
]);
deepEqual(TRANSACTION_SERVICE_BOUNDARY_EFFECT_FIELDS, [
  'quotaGuard',
  'acknowledgement',
  'submission',
  'canonicalJobCompareAndSet',
  'moderationEvent',
  'outboxIntents',
]);
deepEqual(TRANSACTION_SERVICE_BOUNDARY_RESULT_FIELDS, [
  'status',
  'code',
  'message',
  'commitAcknowledged',
  'definitelyAborted',
  'reconciliationRequired',
  'automaticRetryAllowed',
  'sameKeyRetryMayBeAuthorized',
]);
for (const value of [
  TRANSACTION_SERVICE_BOUNDARY_OUTCOMES,
  TRANSACTION_SERVICE_BOUNDARY_INPUT_FIELDS,
  TRANSACTION_SERVICE_BOUNDARY_OPERATION_FIELDS,
  TRANSACTION_SERVICE_BOUNDARY_EFFECT_FIELDS,
  TRANSACTION_SERVICE_BOUNDARY_RESULT_FIELDS,
]) {
  equal(Object.isFrozen(value), true);
}

assertions += 1;
assert.throws(
  () => createDormantTransactionalFreeBetaSubmissionBoundary({}),
  (error) =>
    error instanceof TransactionalSubmissionBoundaryError &&
    error.code === 'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED'
);
assertions += 1;
assert.throws(
  () =>
    createDormantTransactionalFreeBetaSubmissionBoundary({
      transactionExecutor: { execute() {} },
      repository: {},
    }),
  (error) =>
    error instanceof TransactionalSubmissionBoundaryError &&
    error.code === 'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED'
);

// Matching acknowledged commit.
{
  const { boundary, state } = createHarness();
  deepEqual(Object.keys(boundary), ['executeSubmissionOperation']);
  const result = await boundary.executeSubmissionOperation(majorInput());
  equal(state.calls, 1);
  equal(result.status, 'accepted');
  equal(result.code, 'SUBMISSION_COMMITTED');
  equal(result.commitAcknowledged, true);
  equal(result.reconciliationRequired, false);
  equal(result.automaticRetryAllowed, false);
  equal(getTransactionalSubmissionReconciliationContext(result), null);
  deepEqual(Object.keys(result), TRANSACTION_SERVICE_BOUNDARY_RESULT_FIELDS);
  equal(Object.isFrozen(result), true);

  const operation = state.operations[0];
  deepEqual(
    Object.keys(operation),
    TRANSACTION_SERVICE_BOUNDARY_OPERATION_FIELDS
  );
  deepEqual(
    Object.keys(operation.intendedEffects),
    TRANSACTION_SERVICE_BOUNDARY_EFFECT_FIELDS
  );
  equal(Object.isFrozen(operation), true);
  equal(Object.isFrozen(operation.operationContext), true);
  equal(Object.isFrozen(operation.intendedEffects), true);
  equal(operation.operationContext.operationId, majorSeed().operationId);
  equal(operation.operationContext.submissionId, IDS.submission);
  equal(operation.operationContext.acknowledgementId, IDS.acknowledgement);
  equal(operation.operationContext.moderationEventId, IDS.moderation);
  equal(operation.operationContext.newModerationCycleId, IDS.newCycle);
  equal(operation.operationContext.initiatedAt, NOW);
  equal(
    operation.operationContext.candidateHash,
    majorCandidate().candidateHash
  );
  equal(operation.operationContext.expectedPublicationVersion, 7);
  equal(operation.operationContext.expectedCommittedPublicationVersion, 8);
}

// Exact intended atomic effect inventories and C4 payloads.
{
  const { boundary, state } = createHarness();
  await boundary.executeSubmissionOperation(majorInput());
  const { intendedEffects: effects, operationContext: context } =
    state.operations[0];
  deepEqual(Object.keys(effects.quotaGuard), [
    'ownerType',
    'ownerId',
    'policyCode',
    'policyVersion',
  ]);
  deepEqual(Object.keys(effects.acknowledgement), [
    '_id',
    'employerId',
    'jobId',
    'submissionId',
    'policyVersion',
    'rulesVersion',
    'rulesDigest',
    'accepted',
    'acceptedAt',
    'createdAt',
  ]);
  deepEqual(Object.keys(effects.submission), [
    '_id',
    'jobId',
    'employerId',
    'quotaOwnerType',
    'quotaOwnerId',
    'submissionKind',
    'planCode',
    'policyVersion',
    'state',
    'acceptedAt',
    'idempotencyKey',
    'requestFingerprint',
    'correctionOfSubmissionId',
    'moderationCycleId',
    'quotaCharged',
    'quotaExemptionReason',
    'jobRevision',
    'contentSnapshot',
    'rulesAcknowledgementId',
    'verificationSnapshot',
    'quotaSnapshot',
    'publicationCandidate',
    'operationEvidence',
    'moderationSummary',
  ]);
  deepEqual(Object.keys(effects.submission.publicationCandidate), [
    'schemaVersion',
    'policyVersion',
    'candidateKind',
    'candidateRevision',
    'baseApprovedSubmissionId',
    'baseApprovedCandidateHash',
    'basePublicationVersion',
    'expectedPublicationVersion',
    'previousCandidateHash',
    'content',
    'destinationEvidence',
    'candidateHash',
  ]);
  equal(
    Object.keys(effects.submission.publicationCandidate.content).length,
    26
  );
  equal(
    Object.keys(effects.submission.publicationCandidate.destinationEvidence)
      .length,
    11
  );
  deepEqual(Object.keys(effects.submission.operationEvidence), [
    'schemaVersion',
    'operationId',
    'operationKind',
    'moderationEventId',
    'newModerationCycleId',
    'expectedPublicationVersion',
    'expectedPublicationState',
    'outboxDeduplicationKeys',
    'initiatedAt',
    'expectedCommittedPublicationVersion',
    'expectedCommittedPublicationState',
    'expectedCurrentSubmissionId',
    'rulesVersion',
    'rulesDigest',
  ]);
  deepEqual(Object.keys(effects.moderationEvent.submittedEvidence), [
    'schemaVersion',
    'operationId',
    'operationKind',
    'submissionId',
    'candidateHash',
    'candidateKind',
    'candidateRevision',
    'destinationMode',
    'destinationTargetDigest',
    'expectedPublicationVersion',
    'moderationCycleId',
    'actorClassification',
    'eventType',
    'eventTimestamp',
  ]);
  deepEqual(Object.keys(effects.canonicalJobCompareAndSet), [
    'employerId',
    'jobId',
    'expectedPublicationVersion',
    'expectedSourceState',
    'expectedCurrentSubmissionId',
    'expectedCommittedPublicationVersion',
    'expectedCommittedPublicationState',
    'submissionId',
    'submissionKind',
    'baseApprovedSubmissionId',
    'releaseActiveFreeSlot',
  ]);
  deepEqual(Object.keys(effects.moderationEvent), [
    '_id',
    'jobId',
    'submissionId',
    'employerId',
    'actorType',
    'actorId',
    'action',
    'fromState',
    'toState',
    'reasonCode',
    'reasonTextInternal',
    'reasonTextEmployer',
    'contentHash',
    'metadata',
    'submittedEvidence',
    'createdAt',
  ]);
  deepEqual(Object.keys(effects.outboxIntents[0]), [
    'type',
    'deduplicationKey',
    'aggregateId',
    'employerId',
    'jobId',
  ]);
  deepEqual(Object.keys(effects.outboxIntents[1]), [
    'type',
    'deduplicationKey',
    'aggregateId',
    'jobId',
  ]);
  equal(effects.acknowledgement._id, context.acknowledgementId);
  equal(effects.submission._id, context.submissionId);
  equal(effects.moderationEvent._id, context.moderationEventId);
  equal(effects.submission.moderationCycleId, context.actualModerationCycleId);
  equal(
    effects.moderationEvent.submittedEvidence.moderationCycleId,
    context.actualModerationCycleId
  );
  equal(
    effects.submission.publicationCandidate.candidateHash,
    context.candidateHash
  );
  equal(
    effects.moderationEvent.submittedEvidence.candidateHash,
    context.candidateHash
  );
  equal(effects.canonicalJobCompareAndSet.releaseActiveFreeSlot, true);
  equal(effects.canonicalJobCompareAndSet.expectedPublicationVersion, 7);
  equal(
    effects.canonicalJobCompareAndSet.expectedCommittedPublicationVersion,
    8
  );
  equal(
    effects.canonicalJobCompareAndSet.expectedCurrentSubmissionId,
    IDS.submission
  );
  equal(effects.outboxIntents.length, 2);
  equal(
    effects.outboxIntents[0].deduplicationKey,
    `${IDS.submission}:employer_submission_received`
  );
  equal(
    effects.outboxIntents[1].deduplicationKey,
    `${IDS.submission}:admin_job_review_requested`
  );
  equal(effects.submission.quotaCharged, true);
  equal(effects.submission.quotaSnapshot.before.activeFreeJobs.used, 5);
  equal(effects.submission.quotaSnapshot.after.activeFreeJobs.used, 4);
}

// Charged and exempt correction decisions stay separate and are not invented.
{
  const chargedHarness = createHarness();
  await chargedHarness.boundary.executeSubmissionOperation(
    chargedCorrectionInput()
  );
  const charged = chargedHarness.state.operations[0].intendedEffects.submission;
  equal(charged.submissionKind, 'correction');
  equal(charged.quotaCharged, true);
  equal(charged.quotaExemptionReason, null);
  equal(charged.moderationCycleId, IDS.newCycle);
  equal(charged.publicationCandidate.candidateRevision, 2);
  equal(
    charged.publicationCandidate.previousCandidateHash,
    majorCandidate().candidateHash
  );
  equal(
    chargedHarness.state.operations[0].intendedEffects.canonicalJobCompareAndSet
      .releaseActiveFreeSlot,
    false
  );

  const exemptHarness = createHarness();
  await exemptHarness.boundary.executeSubmissionOperation(
    exemptCorrectionInput()
  );
  const exempt = exemptHarness.state.operations[0].intendedEffects.submission;
  equal(exempt.submissionKind, 'correction');
  equal(exempt.quotaCharged, false);
  equal(exempt.quotaExemptionReason, 'reviewer_requested_correction');
  equal(exempt.moderationCycleId, IDS.predecessorCycle);
  equal(exempt.quotaSnapshot.before.daily.used, 0);
  equal(exempt.quotaSnapshot.after.daily.used, 0);
}

// Definite abort and pre-commit application failure stay bounded.
for (const [outcome, code, definitelyAborted] of [
  ['DEFINITELY_ABORTED', 'TRANSACTION_DEFINITELY_ABORTED', true],
  ['APPLICATION_ERROR_BEFORE_COMMIT', 'TRANSACTION_APPLICATION_ERROR', false],
]) {
  const { boundary, state } = createHarness(outcome);
  const result = await boundary.executeSubmissionOperation(majorInput());
  equal(state.calls, 1);
  equal(result.status, 'failed');
  equal(result.code, code);
  equal(result.commitAcknowledged, false);
  equal(result.definitelyAborted, definitelyAborted);
  equal(result.reconciliationRequired, false);
  equal(result.automaticRetryAllowed, false);
  equal(result.sameKeyRetryMayBeAuthorized, true);
  equal(getTransactionalSubmissionReconciliationContext(result), null);
}

// Unknown commit never retries and retains only an internal reconciliation context.
for (const mode of ['outcome', 'throw', 'malformed']) {
  const { boundary, state } = createHarness('COMMIT_RESULT_UNKNOWN');
  if (mode === 'throw') state.throwError = true;
  if (mode === 'malformed') {
    state.resultTransform = () => ({
      outcome: 'COMMIT_ACKNOWLEDGED',
      operationContext: null,
      driverError: 'private',
    });
  }
  const result = await boundary.executeSubmissionOperation(majorInput());
  equal(state.calls, 1);
  equal(result.status, 'indeterminate');
  equal(result.code, 'TRANSACTION_COMMIT_RESULT_UNKNOWN');
  equal(result.commitAcknowledged, null);
  equal(result.definitelyAborted, false);
  equal(result.reconciliationRequired, true);
  equal(result.automaticRetryAllowed, false);
  equal(result.sameKeyRetryMayBeAuthorized, false);
  const internal = getTransactionalSubmissionReconciliationContext(result);
  equal(internal.operationId, majorSeed().operationId);
  equal(internal.submissionId, IDS.submission);
  equal(internal.candidateHash, majorCandidate().candidateHash);
  const serialized = JSON.stringify(result);
  equal(serialized.includes(IDS.submission), false);
  equal(serialized.includes(majorCandidate().candidateHash), false);
  equal(serialized.includes('private'), false);
  equal(Object.hasOwn(structuredClone(result), 'operationContext'), false);
}

// Acknowledged commit requires exact validated returned evidence.
for (const [field, replacement] of [
  ['operationId', '323e4567-e89b-42d3-a456-426614174002'],
  ['submissionId', 'aaaaaaaaaaaaaaaaaaaaaaaa'],
  ['moderationEventId', 'bbbbbbbbbbbbbbbbbbbbbbbb'],
  ['candidateHash', 'd'.repeat(64)],
  ['expectedCommittedPublicationVersion', 9],
]) {
  const { boundary, state } = createHarness();
  state.resultTransform = (operation) => ({
    outcome: 'COMMIT_ACKNOWLEDGED',
    operationContext: {
      ...operation.operationContext,
      [field]: replacement,
    },
  });
  const result = await boundary.executeSubmissionOperation(majorInput());
  equal(result.status, 'indeterminate');
  equal(result.code, 'TRANSACTION_COMMIT_EVIDENCE_CONFLICT');
  equal(result.commitAcknowledged, null);
  equal(result.reconciliationRequired, true);
  equal(result.automaticRetryAllowed, false);
  equal(state.calls, 1);
}
{
  const { boundary, state } = createHarness();
  state.resultTransform = (operation) => ({
    outcome: 'COMMIT_ACKNOWLEDGED',
    operationContext: {
      ...operation.operationContext,
      outboxDeduplicationKeys: {
        ...operation.operationContext.outboxDeduplicationKeys,
        employerSubmissionReceived: 'altered',
      },
    },
  });
  const result = await boundary.executeSubmissionOperation(majorInput());
  equal(result.code, 'TRANSACTION_COMMIT_EVIDENCE_CONFLICT');
  equal(result.reconciliationRequired, true);
  equal(state.calls, 1);
}
{
  const { boundary, state } = createHarness();
  state.resultTransform = () => undefined;
  const result = await boundary.executeSubmissionOperation(majorInput());
  equal(result.code, 'TRANSACTION_COMMIT_RESULT_UNKNOWN');
  equal(result.commitAcknowledged, null);
  equal(state.calls, 1);
}

// Candidate and operation validation occurs before executor invocation.
{
  const { boundary, state } = createHarness();
  const forged = {
    ...majorCandidate(),
    candidateHash: 'f'.repeat(64),
  };
  await rejectsCode(
    boundary.executeSubmissionOperation(majorInput({ candidate: forged })),
    'TRANSACTION_BOUNDARY_CANDIDATE_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const invalidDestination = structuredClone(majorCandidate());
  invalidDestination.destinationEvidence.normalizedTarget =
    'https://untrusted.test/apply';
  await rejectsCode(
    boundary.executeSubmissionOperation(
      majorInput({ candidate: invalidDestination })
    ),
    'TRANSACTION_BOUNDARY_CANDIDATE_INVALID'
  );
  equal(state.calls, 0);
}
assertions += 1;
assert.throws(() =>
  buildPublicationCandidateCorrection(
    {
      priorCandidate: majorCandidate(),
      patch: {},
    },
    {
      jobId: IDS.job,
      expectedPublicationVersion: 8,
      evaluatedAt: new Date(NOW),
    }
  )
);
{
  const { boundary, state } = createHarness();
  const wrongJob = {
    ...majorSeed(),
    jobId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  };
  await rejectsCode(
    boundary.executeSubmissionOperation(
      majorInput({ operationSeed: wrongJob })
    ),
    'TRANSACTION_BOUNDARY_CANDIDATE_INVALID'
  );
  equal(state.calls, 0);
}
for (const operationSeed of [
  { ...majorSeed(), schemaVersion: 2 },
  { ...majorSeed(), policyVersion: 'free-beta-old' },
  { ...majorSeed(), operationId: 'not-a-uuid' },
  { ...majorSeed(), submissionId: 'not-an-object-id' },
  { ...majorSeed(), operationKind: 'renewal_submission' },
  { ...majorSeed(), expectedPublicationVersion: 8 },
  { ...majorSeed(), initiatedAt: '2026-07-30' },
  {
    ...majorSeed(),
    outboxDeduplicationKeys: {
      ...majorSeed().outboxDeduplicationKeys,
      employerSubmissionReceived: 'altered',
    },
  },
]) {
  const { boundary, state } = createHarness();
  await rejectsCode(
    boundary.executeSubmissionOperation(majorInput({ operationSeed })),
    'TRANSACTION_BOUNDARY_OPERATION_INVALID'
  );
  equal(state.calls, 0);
}

// Eligibility and rolling quota fail before the executor and produce safe errors.
{
  const { boundary, state } = createHarness();
  const eligibility = {
    eligible: false,
    verificationSnapshot: verificationSnapshot(),
  };
  await rejectsCode(
    boundary.executeSubmissionOperation(
      majorInput({ employerEligibility: eligibility })
    ),
    'TRANSACTION_BOUNDARY_ELIGIBILITY_REJECTED'
  );
  equal(state.calls, 0);
}
for (const exhausted of [
  quotaSnapshot({ beforeDaily: 1 }),
  quotaSnapshot({ beforeMonthly: 10 }),
]) {
  const { boundary, state } = createHarness();
  await rejectsCode(
    boundary.executeSubmissionOperation(
      majorInput({ quotaSnapshot: exhausted })
    ),
    'TRANSACTION_BOUNDARY_QUOTA_REJECTED'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const input = exemptCorrectionInput({
    quotaSnapshot: quotaSnapshot({
      charged: false,
      activeRelease: false,
      beforeDaily: 1,
      beforeMonthly: 10,
    }),
  });
  const result = await boundary.executeSubmissionOperation(input);
  equal(result.status, 'accepted');
  equal(state.calls, 1);
}

// Structurally invalid correction decisions cannot grant an exemption.
for (const correctionDecision of [
  {
    classification: 'reviewer_requested_exempt',
    quotaCharged: false,
    quotaExemptionReason: 'reviewer_requested_correction',
    moderationCycleId: IDS.predecessorCycle,
    blockerCodes: ['MODERATION_CYCLE_MISSING'],
  },
  {
    classification: 'charged_correction',
    quotaCharged: false,
    quotaExemptionReason: null,
    moderationCycleId: IDS.newCycle,
    blockerCodes: ['MODERATION_CYCLE_MISSING'],
  },
  {
    classification: 'charged_correction',
    quotaCharged: true,
    quotaExemptionReason: null,
    moderationCycleId: IDS.newCycle,
    blockerCodes: ['NO_PREVIOUS_REJECTION'],
  },
]) {
  const { boundary, state } = createHarness();
  await rejectsCode(
    boundary.executeSubmissionOperation(
      chargedCorrectionInput({ correctionDecision })
    ),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}

// Strict hostile envelopes and unknown/private fields fail before execution.
for (const invalidInput of [
  null,
  [],
  new Date(),
  /unsafe/u,
  new Map(),
  new Set(),
  Object.create(null),
  { ...majorInput(), metadata: {} },
  { ...majorInput(), request: {} },
  { ...majorInput(), session: {} },
  { ...majorInput(), token: 'private' },
]) {
  const { boundary, state } = createHarness();
  await rejectsCode(
    boundary.executeSubmissionOperation(invalidInput),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  class Command {
    constructor() {
      Object.assign(this, majorInput());
    }
  }
  await rejectsCode(
    boundary.executeSubmissionOperation(new Command()),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const accessor = majorInput();
  Object.defineProperty(accessor, 'requestFingerprint', {
    enumerable: true,
    get() {
      throw new Error('must not execute');
    },
  });
  await rejectsCode(
    boundary.executeSubmissionOperation(accessor),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const hidden = majorInput();
  Object.defineProperty(hidden, 'hidden', { value: true });
  await rejectsCode(
    boundary.executeSubmissionOperation(hidden),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const symbolic = majorInput();
  symbolic[Symbol('unsafe')] = true;
  await rejectsCode(
    boundary.executeSubmissionOperation(symbolic),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const inherited = Object.create({ inherited: true });
  Object.assign(inherited, majorInput());
  await rejectsCode(
    boundary.executeSubmissionOperation(inherited),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const proxy = new Proxy(majorInput(), {
    ownKeys() {
      throw new Error('private proxy failure');
    },
  });
  await rejectsCode(
    boundary.executeSubmissionOperation(proxy),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}
{
  const { boundary, state } = createHarness();
  const circular = majorInput();
  circular.metadata = circular;
  await rejectsCode(
    boundary.executeSubmissionOperation(circular),
    'TRANSACTION_BOUNDARY_INPUT_INVALID'
  );
  equal(state.calls, 0);
}

// Input ordering is irrelevant, output ordering and values remain deterministic.
{
  const original = majorInput();
  const reversed = Object.fromEntries(Object.entries(original).reverse());
  const firstHarness = createHarness();
  const secondHarness = createHarness();
  await firstHarness.boundary.executeSubmissionOperation(original);
  await secondHarness.boundary.executeSubmissionOperation(reversed);
  deepEqual(
    firstHarness.state.operations[0],
    secondHarness.state.operations[0]
  );
}

// No mutable input or executor result alias reaches the service-held evidence.
{
  const input = majorInput();
  input.candidate = structuredClone(input.candidate);
  const before = structuredClone(input);
  const { boundary, state } = createHarness();
  state.resultTransform = (operation) => {
    assert.throws(() => {
      operation.operationContext.operationId = 'altered';
    }, TypeError);
    return {
      outcome: 'COMMIT_ACKNOWLEDGED',
      operationContext: structuredClone(operation.operationContext),
    };
  };
  const result = await boundary.executeSubmissionOperation(input);
  deepEqual(input, before);
  equal(result.status, 'accepted');
  equal(state.calls, 1);
  input.candidate.content.requirements.push('Caller mutation');
  equal(
    state.operations[0].intendedEffects.submission.publicationCandidate.content
      .requirements.length,
    1
  );
}

// Public results and errors are bounded, JSON-safe, and clone-safe.
{
  const { boundary } = createHarness('COMMIT_RESULT_UNKNOWN');
  const result = await boundary.executeSubmissionOperation(majorInput());
  const json = JSON.stringify(result);
  for (const sensitive of [
    IDS.owner,
    IDS.job,
    IDS.submission,
    IDS.acknowledgement,
    IDS.moderation,
    IDS.newCycle,
    REQUEST_HASH,
    RULES_HASH,
    majorCandidate().candidateHash,
    'stable-key-123456',
    'Engineer',
    'example.test',
  ]) {
    equal(json.includes(sensitive), false);
  }
  deepEqual(structuredClone(result), JSON.parse(json));
  equal(Object.getPrototypeOf(result), Object.prototype);
}
{
  const { boundary } = createHarness();
  let caught;
  try {
    await boundary.executeSubmissionOperation({
      ...majorInput(),
      requestFingerprint: 'not-a-hash',
    });
  } catch (error) {
    caught = error;
  }
  const json = JSON.stringify(caught);
  deepEqual(JSON.parse(json), {
    status: 400,
    code: 'TRANSACTION_BOUNDARY_INPUT_INVALID',
    message: 'The submission transaction input is invalid.',
  });
  equal(json.includes('not-a-hash'), false);
  equal(json.includes('stack'), false);
  equal(json.includes('cause'), false);
}

// Purity/dormancy static proof.
const servicePath = fileURLToPath(
  new URL(
    '../services/publishing/TransactionalFreeBetaSubmissionService.js',
    import.meta.url
  )
);
const source = readFileSync(servicePath, 'utf8');
for (const forbidden of [
  "from 'mongoose'",
  'from "mongoose"',
  "from 'mongodb'",
  '/models/',
  'Mongoose',
  'startSession',
  'withTransaction',
  'process.env',
  'fetch(',
  'axios',
  'readFile',
  'writeFile',
  'console.',
  'setTimeout',
  'setInterval',
  'addEventListener',
]) {
  equal(source.includes(forbidden), false, forbidden);
}
equal(
  source.match(/executeTransaction\(operation\)/gu)?.length,
  1,
  'the corrected boundary has exactly one executor call site'
);
equal(
  source.includes('createDormantTransactionalFreeBetaSubmissionBoundary'),
  true
);
equal(source.includes('executeSubmissionOperation'), true);
const correctedBoundarySource = source.slice(
  source.indexOf(
    'export function createDormantTransactionalFreeBetaSubmissionBoundary'
  ),
  source.indexOf('export function createTransactionalFreeBetaSubmissionService')
);
for (const forbiddenGeneration of [
  'idFactory',
  'clock.now',
  'Date.now',
  'randomUUID',
  'new ObjectId',
  'mongoose',
  'session:',
  '.session',
]) {
  equal(correctedBoundarySource.includes(forbiddenGeneration), false);
}

console.log(
  `transactionalFreeBetaSubmissionBoundaryCorrection.test.js: ${assertions} assertions passed`
);
