import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildMajorEditPublicationCandidate,
  buildPublicationCandidateCorrection,
} from '../services/publishing/contracts/PublicationCandidateContract.js';
import * as contract from '../services/publishing/contracts/PublishingOperationContextContract.js';

const {
  PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION,
  PUBLISHING_OPERATION_POLICY_VERSION,
  PUBLISHING_OPERATION_KINDS,
  PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS,
  PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES,
  PUBLISHING_OPERATION_SEED_FIELDS,
  PUBLISHING_OPERATION_CONTEXT_FIELDS,
  PUBLISHING_OPERATION_IDENTIFIER_POLICIES,
  PUBLISHING_OPERATION_OUTBOX_KEY_POLICY,
  PUBLISHING_OPERATION_BOUNDS,
  PUBLISHING_OPERATION_ERROR_CODES,
  PUBLISHING_OPERATION_ERROR_MESSAGES,
  PublishingOperationContextContractError,
  buildPublishingOperationSeed,
  buildPublishingOperationContext,
  validatePublishingOperationSeed,
  validatePublishingOperationContext,
  comparePublishingOperationIdentity,
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
function throwsCode(action, code) {
  assertions += 1;
  assert.throws(
    action,
    (error) =>
      error instanceof PublishingOperationContextContractError &&
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
    validationPolicyVersion: PUBLISHING_OPERATION_POLICY_VERSION,
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

function correctionCandidate(prior = majorCandidate()) {
  return buildPublicationCandidateCorrection(
    {
      priorCandidate: prior,
      patch: { title: 'Engineer II' },
    },
    {
      jobId: IDS.job,
      expectedPublicationVersion: 8,
      evaluatedAt: new Date(NOW),
    }
  );
}

function seedInput(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function correctionSeedInput(overrides = {}) {
  return seedInput({
    operationId: '223e4567-e89b-42d3-a456-426614174001',
    operationKind: 'correction_submission',
    expectedPublicationVersion: 8,
    expectedPublicationState: 'rejected',
    correctionOfSubmissionId: IDS.correction,
    ...overrides,
  });
}

function commitEvidence(seed, overrides = {}) {
  return {
    requestFingerprint: REQUEST_HASH,
    actualModerationCycleId: seed.newModerationCycleId,
    expectedCommittedPublicationVersion: seed.expectedPublicationVersion + 1,
    expectedCommittedPublicationState: 'pending_review',
    expectedCurrentSubmissionId: seed.submissionId,
    rulesDigest: RULES_HASH,
    quotaCharged: true,
    ...overrides,
  };
}

function buildMajorContext() {
  const seed = buildPublishingOperationSeed(seedInput(), {
    initiatedAt: new Date(NOW),
  });
  const candidate = majorCandidate();
  return {
    seed,
    candidate,
    context: buildPublishingOperationContext({
      operationSeed: seed,
      candidate,
      commitEvidence: commitEvidence(seed),
    }),
  };
}

const expectedExports = [
  'PUBLISHING_OPERATION_BOUNDS',
  'PUBLISHING_OPERATION_CONTEXT_FIELDS',
  'PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION',
  'PUBLISHING_OPERATION_ERROR_CODES',
  'PUBLISHING_OPERATION_ERROR_MESSAGES',
  'PUBLISHING_OPERATION_IDENTIFIER_POLICIES',
  'PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS',
  'PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES',
  'PUBLISHING_OPERATION_KINDS',
  'PUBLISHING_OPERATION_OUTBOX_KEY_POLICY',
  'PUBLISHING_OPERATION_POLICY_VERSION',
  'PUBLISHING_OPERATION_SEED_FIELDS',
  'PublishingOperationContextContractError',
  'buildPublishingOperationContext',
  'buildPublishingOperationSeed',
  'comparePublishingOperationIdentity',
  'validatePublishingOperationContext',
  'validatePublishingOperationSeed',
];
deepEqual(Object.keys(contract).sort(), expectedExports);
equal(PUBLISHING_OPERATION_CONTEXT_SCHEMA_VERSION, 1);
equal(PUBLISHING_OPERATION_POLICY_VERSION, 'free-beta-2026-01');
deepEqual(PUBLISHING_OPERATION_KINDS, [
  'major_edit_submission',
  'correction_submission',
]);
deepEqual(PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS, [
  'SAME_LOGICAL_OPERATION',
  'DIFFERENT_LOGICAL_OPERATION',
  'IDENTITY_CONFLICT',
]);
equal(PUBLISHING_OPERATION_SEED_FIELDS.length, 19);
equal(PUBLISHING_OPERATION_CONTEXT_FIELDS.length, 32);
equal(PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES.length, 33);
equal(PUBLISHING_OPERATION_ERROR_CODES.length, 5);
equal(PUBLISHING_OPERATION_BOUNDS.identityMismatchCodeMaximum, 33);
equal(PUBLISHING_OPERATION_IDENTIFIER_POLICIES.operationId.length, 36);
equal(PUBLISHING_OPERATION_IDENTIFIER_POLICIES.objectId.length, 24);
equal(PUBLISHING_OPERATION_IDENTIFIER_POLICIES.hash.length, 64);
equal(PUBLISHING_OPERATION_OUTBOX_KEY_POLICY.maximumLength, 160);
for (const value of [
  PUBLISHING_OPERATION_KINDS,
  PUBLISHING_OPERATION_IDENTITY_CLASSIFICATIONS,
  PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES,
  PUBLISHING_OPERATION_SEED_FIELDS,
  PUBLISHING_OPERATION_CONTEXT_FIELDS,
  PUBLISHING_OPERATION_IDENTIFIER_POLICIES,
  PUBLISHING_OPERATION_IDENTIFIER_POLICIES.operationId,
  PUBLISHING_OPERATION_OUTBOX_KEY_POLICY,
  PUBLISHING_OPERATION_BOUNDS,
  PUBLISHING_OPERATION_ERROR_CODES,
  PUBLISHING_OPERATION_ERROR_MESSAGES,
]) {
  equal(Object.isFrozen(value), true);
}

const major = buildMajorContext();
deepEqual(Object.keys(major.seed), PUBLISHING_OPERATION_SEED_FIELDS);
deepEqual(Object.keys(major.context), PUBLISHING_OPERATION_CONTEXT_FIELDS);
equal(major.seed.initiatedAt, NOW);
equal(
  major.seed.outboxDeduplicationKeys.employerSubmissionReceived,
  `${IDS.submission}:employer_submission_received`
);
equal(
  major.seed.outboxDeduplicationKeys.adminJobReviewRequested,
  `${IDS.submission}:admin_job_review_requested`
);
equal(Object.isFrozen(major.seed), true);
equal(Object.isFrozen(major.seed.outboxDeduplicationKeys), true);
equal(Object.isFrozen(major.context), true);
deepEqual(validatePublishingOperationSeed(major.seed), major.seed);
deepEqual(
  validatePublishingOperationContext(major.context, {
    candidate: major.candidate,
  }),
  major.context
);
deepEqual(JSON.parse(JSON.stringify(major.seed)), major.seed);
deepEqual(structuredClone(major.context), major.context);

const correctionSeed = buildPublishingOperationSeed(correctionSeedInput(), {
  initiatedAt: new Date(NOW),
});
const correction = correctionCandidate();
const correctionContext = buildPublishingOperationContext({
  operationSeed: correctionSeed,
  candidate: correction,
  commitEvidence: commitEvidence(correctionSeed, {
    actualModerationCycleId: IDS.predecessorCycle,
    quotaCharged: false,
  }),
});
equal(correctionContext.candidateKind, 'correction');
equal(correctionContext.candidateRevision, 2);
equal(correctionContext.quotaCharged, false);
equal(correctionContext.actualModerationCycleId, IDS.predecessorCycle);

for (const invalidOperationId of [
  '123E4567-E89B-42D3-A456-426614174000',
  '123e4567-e89b-12d3-a456-426614174000',
  '{123e4567-e89b-42d3-a456-426614174000}',
  ' 123e4567-e89b-42d3-a456-426614174000',
]) {
  throwsCode(
    () =>
      buildPublishingOperationSeed(
        seedInput({ operationId: invalidOperationId }),
        {
          initiatedAt: new Date(NOW),
        }
      ),
    'OPERATION_IDENTIFIER_SET_INVALID'
  );
}
for (const invalidId of [
  'A'.repeat(24),
  'z'.repeat(24),
  '1'.repeat(23),
  new String(IDS.job),
]) {
  throwsCode(
    () =>
      buildPublishingOperationSeed(seedInput({ jobId: invalidId }), {
        initiatedAt: new Date(NOW),
      }),
    'OPERATION_IDENTIFIER_SET_INVALID'
  );
}
for (const invalidDate of [
  NOW,
  new Date('invalid'),
  new (class extends Date {})(),
]) {
  throwsCode(
    () =>
      buildPublishingOperationSeed(seedInput(), { initiatedAt: invalidDate }),
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
}
throwsCode(
  () =>
    buildPublishingOperationSeed(
      seedInput({ operationKind: 'initial_submission' }),
      { initiatedAt: new Date(NOW) }
    ),
  'OPERATION_KIND_UNSUPPORTED'
);
throwsCode(
  () =>
    buildPublishingOperationSeed(
      seedInput({ expectedPublicationState: 'draft' }),
      { initiatedAt: new Date(NOW) }
    ),
  'OPERATION_CONTEXT_INPUT_INVALID'
);
throwsCode(
  () =>
    buildPublishingOperationContext({
      operationSeed: major.seed,
      candidate: correction,
      commitEvidence: commitEvidence(major.seed),
    }),
  'OPERATION_CANDIDATE_MISMATCH'
);
throwsCode(
  () =>
    buildPublishingOperationContext({
      operationSeed: major.seed,
      candidate: major.candidate,
      commitEvidence: {
        ...commitEvidence(major.seed),
        expectedCommittedPublicationVersion: 99,
      },
    }),
  'OPERATION_CONTEXT_INPUT_INVALID'
);
throwsCode(
  () =>
    validatePublishingOperationSeed({
      ...structuredClone(major.seed),
      outboxDeduplicationKeys: {
        ...major.seed.outboxDeduplicationKeys,
        employerSubmissionReceived: 'forged',
      },
    }),
  'OPERATION_IDENTIFIER_SET_INVALID'
);

const same = comparePublishingOperationIdentity(major.context, major.context);
deepEqual(same, {
  classification: 'SAME_LOGICAL_OPERATION',
  mismatchCodes: [],
});
equal(Object.isFrozen(same), true);
equal(Object.isFrozen(same.mismatchCodes), true);

const alternativeValues = {
  SCHEMA_VERSION_MISMATCH: ['schemaVersion', 2],
  POLICY_VERSION_MISMATCH: ['policyVersion', 'free-beta-other'],
  OPERATION_ID_MISMATCH: [
    'operationId',
    '323e4567-e89b-42d3-a456-426614174002',
  ],
  OPERATION_KIND_MISMATCH: ['operationKind', 'correction_submission'],
  OWNER_TYPE_MISMATCH: ['ownerType', 'other'],
  OWNER_ID_MISMATCH: ['ownerId', 'a'.repeat(24)],
  EMPLOYER_ID_MISMATCH: ['employerId', 'b'.repeat(24)],
  JOB_ID_MISMATCH: ['jobId', 'c'.repeat(24)],
  IDEMPOTENCY_KEY_MISMATCH: ['idempotencyKey', 'different-key-1234'],
  SUBMISSION_ID_MISMATCH: ['submissionId', 'd'.repeat(24)],
  ACKNOWLEDGEMENT_ID_MISMATCH: ['acknowledgementId', 'e'.repeat(24)],
  MODERATION_EVENT_ID_MISMATCH: ['moderationEventId', 'f'.repeat(24)],
  NEW_MODERATION_CYCLE_ID_MISMATCH: ['newModerationCycleId', 'a'.repeat(24)],
  EXPECTED_PUBLICATION_VERSION_MISMATCH: ['expectedPublicationVersion', 8],
  EXPECTED_PUBLICATION_STATE_MISMATCH: ['expectedPublicationState', 'rejected'],
  CORRECTION_OF_SUBMISSION_ID_MISMATCH: [
    'correctionOfSubmissionId',
    IDS.correction,
  ],
  RULES_VERSION_MISMATCH: ['rulesVersion', 'employer-rules-2'],
  EMPLOYER_SUBMISSION_RECEIVED_OUTBOX_KEY_MISMATCH: [
    'outboxDeduplicationKeys.employerSubmissionReceived',
    'different:employer_submission_received',
  ],
  ADMIN_JOB_REVIEW_REQUESTED_OUTBOX_KEY_MISMATCH: [
    'outboxDeduplicationKeys.adminJobReviewRequested',
    'different:admin_job_review_requested',
  ],
  INITIATED_AT_MISMATCH: ['initiatedAt', '2026-07-30T10:00:01.000Z'],
  REQUEST_FINGERPRINT_MISMATCH: ['requestFingerprint', 'd'.repeat(64)],
  CANDIDATE_HASH_MISMATCH: ['candidateHash', 'e'.repeat(64)],
  CANDIDATE_REVISION_MISMATCH: ['candidateRevision', 2],
  CANDIDATE_KIND_MISMATCH: ['candidateKind', 'correction'],
  BASE_APPROVED_SUBMISSION_ID_MISMATCH: [
    'baseApprovedSubmissionId',
    'a'.repeat(24),
  ],
  BASE_APPROVED_CANDIDATE_HASH_MISMATCH: [
    'baseApprovedCandidateHash',
    'f'.repeat(64),
  ],
  BASE_PUBLICATION_VERSION_MISMATCH: ['basePublicationVersion', 8],
  ACTUAL_MODERATION_CYCLE_ID_MISMATCH: [
    'actualModerationCycleId',
    'b'.repeat(24),
  ],
  EXPECTED_COMMITTED_PUBLICATION_VERSION_MISMATCH: [
    'expectedCommittedPublicationVersion',
    9,
  ],
  EXPECTED_COMMITTED_PUBLICATION_STATE_MISMATCH: [
    'expectedCommittedPublicationState',
    'active',
  ],
  EXPECTED_CURRENT_SUBMISSION_ID_MISMATCH: [
    'expectedCurrentSubmissionId',
    'c'.repeat(24),
  ],
  RULES_DIGEST_MISMATCH: ['rulesDigest', '1'.repeat(64)],
  QUOTA_CHARGED_MISMATCH: ['quotaCharged', false],
};

function withChangedPath(source, path, value) {
  const clone = structuredClone(source);
  const parts = path.split('.');
  let target = clone;
  while (parts.length > 1) {
    target = target[parts.shift()];
  }
  target[parts[0]] = value;
  return clone;
}

for (const code of PUBLISHING_OPERATION_IDENTITY_MISMATCH_CODES) {
  const [path, value] = alternativeValues[code];
  const changed = withChangedPath(major.context, path, value);
  const result = comparePublishingOperationIdentity(major.context, changed);
  deepEqual(result.mismatchCodes, [code], code);
  equal(result.classification, 'IDENTITY_CONFLICT', code);
}

const different = structuredClone(major.context);
Object.assign(different, {
  operationId: '423e4567-e89b-42d3-a456-426614174003',
  idempotencyKey: 'different-key-5678',
  submissionId: 'a'.repeat(24),
  acknowledgementId: 'b'.repeat(24),
  moderationEventId: 'c'.repeat(24),
  newModerationCycleId: 'd'.repeat(24),
  expectedCurrentSubmissionId: 'a'.repeat(24),
});
different.outboxDeduplicationKeys = {
  employerSubmissionReceived: `${different.submissionId}:employer_submission_received`,
  adminJobReviewRequested: `${different.submissionId}:admin_job_review_requested`,
};
equal(
  comparePublishingOperationIdentity(major.context, different).classification,
  'DIFFERENT_LOGICAL_OPERATION'
);
equal(different.jobId, major.context.jobId);
equal(different.employerId, major.context.employerId);

for (const path of [
  'submissionId',
  'acknowledgementId',
  'moderationEventId',
  'newModerationCycleId',
  'expectedCurrentSubmissionId',
  'outboxDeduplicationKeys.employerSubmissionReceived',
  'outboxDeduplicationKeys.adminJobReviewRequested',
]) {
  const conflict = structuredClone(different);
  const originalValue = path
    .split('.')
    .reduce((value, part) => value[part], major.context);
  const parts = path.split('.');
  let target = conflict;
  while (parts.length > 1) target = target[parts.shift()];
  target[parts[0]] = originalValue;
  equal(
    comparePublishingOperationIdentity(major.context, conflict).classification,
    'IDENTITY_CONFLICT',
    path
  );
}
const sameOwnerKey = structuredClone(different);
sameOwnerKey.idempotencyKey = major.context.idempotencyKey;
equal(
  comparePublishingOperationIdentity(major.context, sameOwnerKey)
    .classification,
  'IDENTITY_CONFLICT'
);

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
  throwsCode(
    () => buildPublishingOperationSeed(hostile, { initiatedAt: new Date(NOW) }),
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
}
const accessor = seedInput();
Object.defineProperty(accessor, 'operationId', {
  enumerable: true,
  get: () => seedInput().operationId,
});
throwsCode(
  () => buildPublishingOperationSeed(accessor, { initiatedAt: new Date(NOW) }),
  'OPERATION_CONTEXT_INPUT_INVALID'
);
const hidden = seedInput();
Object.defineProperty(hidden, 'hidden', { value: true });
throwsCode(
  () => buildPublishingOperationSeed(hidden, { initiatedAt: new Date(NOW) }),
  'OPERATION_CONTEXT_INPUT_INVALID'
);
const symbol = seedInput();
symbol[Symbol('private')] = true;
throwsCode(
  () => buildPublishingOperationSeed(symbol, { initiatedAt: new Date(NOW) }),
  'OPERATION_CONTEXT_INPUT_INVALID'
);
for (const unsafe of ['metadata', 'request', 'session', 'token', '$where']) {
  throwsCode(
    () =>
      buildPublishingOperationSeed(
        { ...seedInput(), [unsafe]: 'forbidden' },
        { initiatedAt: new Date(NOW) }
      ),
    'OPERATION_CONTEXT_INPUT_INVALID'
  );
}

for (const code of PUBLISHING_OPERATION_ERROR_CODES) {
  const error = new PublishingOperationContextContractError(code, {
    operationId: seedInput().operationId,
    candidateHash: major.context.candidateHash,
  });
  deepEqual(Object.keys(error.toJSON()), ['status', 'code', 'message']);
  equal(error.toJSON().code, code);
  equal(error.toJSON().message, PUBLISHING_OPERATION_ERROR_MESSAGES[code]);
  equal(JSON.stringify(error.toJSON()).includes(IDS.job), false);
  equal(
    JSON.stringify(error.toJSON()).includes(major.context.candidateHash),
    false
  );
  equal(Object.isFrozen(error.toJSON()), true);
}
const safeFallback = new PublishingOperationContextContractError(
  'CALLER_CONTROLLED',
  'private'
);
equal(safeFallback.code, 'OPERATION_CONTEXT_INPUT_INVALID');

const source = readFileSync(
  fileURLToPath(
    new URL(
      '../services/publishing/contracts/PublishingOperationContextContract.js',
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
]) {
  equal(source.includes(forbidden), false, forbidden);
}

console.log(
  `publishingOperationContextContract.test.js: ${assertions} assertions passed`
);
