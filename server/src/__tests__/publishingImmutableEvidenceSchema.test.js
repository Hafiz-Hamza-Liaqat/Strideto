/**
 * Dormant additive immutable publishing-evidence schema tests (E.1F-H2B-B3-C4).
 * Run: node src/__tests__/publishingImmutableEvidenceSchema.test.js
 */
import assert from 'assert';
import mongoose from 'mongoose';
import { JobModerationEvent } from '../models/JobModerationEvent.js';
import { JobPublicationSubmission } from '../models/JobPublicationSubmission.js';

let assertionCount = 0;
function equal(actual, expected, message) {
  assertionCount += 1;
  assert.strictEqual(actual, expected, message);
}
function deepEqual(actual, expected, message) {
  assertionCount += 1;
  assert.deepStrictEqual(actual, expected, message);
}
function ok(value, message) {
  assertionCount += 1;
  assert.ok(value, message);
}
async function rejects(action, expectation, message) {
  assertionCount += 1;
  await assert.rejects(action, expectation, message);
}

const objectId = (value) =>
  new mongoose.Types.ObjectId(value.toString(16).padStart(24, '0'));
const hash = (character) => character.repeat(64);
const ACCEPTED_AT = new Date('2026-07-29T12:00:00.000Z');
const ACCEPTED_AT_ISO = ACCEPTED_AT.toISOString();
const OPERATION_ID = '123e4567-e89b-42d3-a456-426614174000';

const CANDIDATE_FIELDS = Object.freeze([
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
const CONTENT_FIELDS = Object.freeze([
  'title',
  'companyName',
  'organizationName',
  'description',
  'requirements',
  'responsibilities',
  'benefits',
  'skillsRequired',
  'salaryRange',
  'salaryCurrency',
  'location',
  'province',
  'city',
  'category',
  'employmentType',
  'jobType',
  'educationRequirement',
  'experience',
  'gender',
  'workMode',
  'deadline',
  'totalSeats',
  'autoCloseWhenFilled',
  'applicationInstructions',
  'logoUrl',
  'gallery',
]);
const DESTINATION_FIELDS = Object.freeze([
  'schemaVersion',
  'mode',
  'normalizedTarget',
  'targetDigest',
  'normalizedDomain',
  'trustClassification',
  'evidenceSource',
  'evaluatedAt',
  'validationPolicyVersion',
  'classifiedByActorType',
  'classifiedByActorId',
]);
const OPERATION_FIELDS = Object.freeze([
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
const OUTBOX_FIELDS = Object.freeze([
  'employerSubmissionReceived',
  'adminJobReviewRequested',
]);
const SUBMITTED_EVIDENCE_FIELDS = Object.freeze([
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

function usageSnapshot() {
  return {
    daily: { used: 0, limit: 1, remaining: 1, nextEligibleAt: null },
    rolling30Days: {
      used: 0,
      limit: 10,
      remaining: 10,
      nextSlotAt: null,
    },
    activeFreeJobs: {
      planCode: 'free_beta',
      used: 1,
      limit: 5,
      remaining: 4,
      hasCapacity: true,
    },
  };
}

function candidateContent(overrides = {}) {
  return {
    title: 'Senior Engineer',
    companyName: 'Example Company',
    organizationName: null,
    description: 'Build reliable education platform services.',
    requirements: ['Node.js'],
    responsibilities: ['Maintain publishing services'],
    benefits: [],
    skillsRequired: ['JavaScript'],
    salaryRange: null,
    salaryCurrency: 'PKR',
    location: 'Lahore',
    province: 'Punjab',
    city: 'Lahore',
    category: 'Engineering',
    employmentType: 'full-time',
    jobType: 'Private',
    educationRequirement: 'Bachelor degree',
    experience: 'Three years',
    gender: null,
    workMode: 'hybrid',
    deadline: '2026-08-31T23:59:59.000Z',
    totalSeats: 2,
    autoCloseWhenFilled: true,
    applicationInstructions: null,
    logoUrl: null,
    gallery: [],
    ...overrides,
  };
}

function destinationEvidence(overrides = {}) {
  return {
    schemaVersion: 1,
    mode: 'internal_platform',
    normalizedTarget: null,
    targetDigest: hash('d'),
    normalizedDomain: null,
    trustClassification: 'INTERNAL_PLATFORM',
    evidenceSource: 'server_derived_internal_route',
    evaluatedAt: ACCEPTED_AT_ISO,
    validationPolicyVersion: 'free-beta-2026-01',
    classifiedByActorType: 'system',
    classifiedByActorId: null,
    ...overrides,
  };
}

function publicationCandidate(overrides = {}) {
  return {
    schemaVersion: 1,
    policyVersion: 'free-beta-2026-01',
    candidateKind: 'major_edit',
    candidateRevision: 1,
    baseApprovedSubmissionId: objectId(11).toString(),
    baseApprovedCandidateHash: hash('a'),
    basePublicationVersion: 7,
    expectedPublicationVersion: 7,
    previousCandidateHash: null,
    content: candidateContent(),
    destinationEvidence: destinationEvidence(),
    candidateHash: hash('c'),
    ...overrides,
  };
}

function operationEvidence(submissionId, moderationCycleId, overrides = {}) {
  return {
    schemaVersion: 1,
    operationId: OPERATION_ID,
    operationKind: 'major_edit_submission',
    moderationEventId: objectId(12).toString(),
    newModerationCycleId: moderationCycleId.toString(),
    expectedPublicationVersion: 7,
    expectedPublicationState: 'active',
    outboxDeduplicationKeys: {
      employerSubmissionReceived: `${submissionId}:employer_submission_received`,
      adminJobReviewRequested: `${submissionId}:admin_job_review_requested`,
    },
    initiatedAt: ACCEPTED_AT_ISO,
    expectedCommittedPublicationVersion: 8,
    expectedCommittedPublicationState: 'pending_review',
    expectedCurrentSubmissionId: submissionId.toString(),
    rulesVersion: 'employer-rules-2026-01',
    rulesDigest: hash('e'),
    ...overrides,
  };
}

function submission(overrides = {}) {
  const {
    candidateOverrides,
    operationOverrides,
    publicationCandidate: candidateOverride,
    operationEvidence: operationOverride,
    ...documentOverrides
  } = overrides;
  const submissionId = documentOverrides._id || objectId(1);
  const employerId = documentOverrides.employerId || objectId(2);
  const moderationCycleId = documentOverrides.moderationCycleId || objectId(3);
  const candidate =
    candidateOverride || publicationCandidate(candidateOverrides);
  const operation =
    operationOverride ||
    operationEvidence(submissionId, moderationCycleId, operationOverrides);
  const usage = usageSnapshot();
  return {
    _id: submissionId,
    jobId: objectId(4),
    employerId,
    quotaOwnerType: 'employer',
    quotaOwnerId: employerId,
    submissionKind: 'major_edit',
    state: 'pending_review',
    acceptedAt: ACCEPTED_AT,
    idempotencyKey: 'free-beta-request-c4-0001',
    requestFingerprint: hash('f'),
    moderationCycleId,
    quotaCharged: true,
    jobRevision: 7,
    contentSnapshot: {
      contentHash: hash('9'),
      title: 'Senior Engineer',
      applicationMode: 'internal',
    },
    rulesAcknowledgementId: objectId(5),
    verificationSnapshot: {
      verified: true,
      verificationLevel: 'verified',
      accountStatus: 'active',
      normalizedCompanyName: 'Example Company',
      emailPresent: true,
      emailValid: true,
      emailDomain: 'example.com',
      predicateCapabilityVersion: 'employer-eligibility-v1',
      eligibilityResultCodes: [],
    },
    quotaSnapshot: {
      policyCode: 'free_beta',
      policyVersion: 'free-beta-2026-01',
      capturedAt: ACCEPTED_AT,
      before: usage,
      after: usage,
    },
    publicationCandidate: candidate,
    operationEvidence: operation,
    ...documentOverrides,
  };
}

function legacySubmission() {
  const value = submission();
  delete value.publicationCandidate;
  delete value.operationEvidence;
  return value;
}

function submittedEvidence(submissionId, moderationCycleId, overrides = {}) {
  return {
    schemaVersion: 1,
    operationId: OPERATION_ID,
    operationKind: 'major_edit_submission',
    submissionId: submissionId.toString(),
    candidateHash: hash('c'),
    candidateKind: 'major_edit',
    candidateRevision: 1,
    destinationMode: 'internal_platform',
    destinationTargetDigest: hash('d'),
    expectedPublicationVersion: 7,
    moderationCycleId: moderationCycleId.toString(),
    actorClassification: 'employer',
    eventType: 'submitted',
    eventTimestamp: ACCEPTED_AT_ISO,
    ...overrides,
  };
}

function moderationEvent(overrides = {}) {
  const {
    evidenceOverrides,
    submittedEvidence: submittedEvidenceOverride,
    ...documentOverrides
  } = overrides;
  const submissionId = documentOverrides.submissionId || objectId(1);
  const moderationCycleId = documentOverrides.moderationCycleId || objectId(3);
  return {
    _id: objectId(12),
    jobId: objectId(4),
    submissionId,
    employerId: objectId(2),
    actorType: 'employer',
    actorId: objectId(2),
    action: 'submitted',
    fromState: 'active',
    toState: 'pending_review',
    contentHash: hash('c'),
    metadata: { moderationCycleId },
    submittedEvidence:
      submittedEvidenceOverride ||
      submittedEvidence(submissionId, moderationCycleId, evidenceOverrides),
    createdAt: ACCEPTED_AT,
    ...documentOverrides,
  };
}

function schemaFields(schema) {
  return Object.keys(schema.paths);
}

function assertNoMixedOrMap(schema) {
  for (const path of Object.values(schema.paths)) {
    equal(path.instance === 'Mixed', false);
    equal(path.instance === 'Map', false);
    if (path.schema) assertNoMixedOrMap(path.schema);
  }
}

async function immutableMutation(Model, plain, mutate, readValue) {
  const document = new Model(plain);
  document.$isNew = false;
  document.$__reset();
  for (const subdocument of document.$getAllSubdocs()) {
    subdocument.$isNew = false;
    subdocument.$__reset();
  }
  const before = structuredClone(readValue(document));
  let mutationError = null;
  try {
    mutate(document);
  } catch (error) {
    mutationError = error;
  }
  if (mutationError) {
    ok(
      mutationError.isImmutableError ||
        /immutable|append-only/.test(mutationError.message)
    );
    equal(
      JSON.stringify(structuredClone(readValue(document))),
      JSON.stringify(before)
    );
    return;
  }
  if (document.$__.validationError) {
    ok(/immutable/.test(document.$__.validationError.message));
    equal(
      JSON.stringify(structuredClone(readValue(document))),
      JSON.stringify(before)
    );
    return;
  }
  const after = structuredClone(readValue(document));
  if (JSON.stringify(after) === JSON.stringify(before)) {
    equal(JSON.stringify(after), JSON.stringify(before));
    await document.validate();
    ok(true);
  } else {
    await rejects(
      document.validate(),
      /immutable .* evidence cannot be modified/
    );
    ok(document.isModified());
  }
}

// Exact top-level and nested inventories.
const candidatePath = JobPublicationSubmission.schema.path(
  'publicationCandidate'
);
const operationPath = JobPublicationSubmission.schema.path('operationEvidence');
const submittedPath = JobModerationEvent.schema.path('submittedEvidence');
ok(candidatePath);
ok(operationPath);
ok(submittedPath);
equal(candidatePath.options.default, undefined);
equal(operationPath.options.default, undefined);
equal(submittedPath.options.default, undefined);
equal(candidatePath.options.immutable, true);
equal(operationPath.options.immutable, true);
equal(submittedPath.options.immutable, true);
equal(candidatePath.schema.options._id, false);
equal(operationPath.schema.options._id, false);
equal(submittedPath.schema.options._id, false);
equal(candidatePath.schema.options.strict, 'throw');
equal(operationPath.schema.options.strict, 'throw');
equal(submittedPath.schema.options.strict, 'throw');
deepEqual(schemaFields(candidatePath.schema), [...CANDIDATE_FIELDS]);
deepEqual(schemaFields(candidatePath.schema.path('content').schema), [
  ...CONTENT_FIELDS,
]);
deepEqual(
  schemaFields(candidatePath.schema.path('destinationEvidence').schema),
  [...DESTINATION_FIELDS]
);
deepEqual(schemaFields(operationPath.schema), [...OPERATION_FIELDS]);
deepEqual(
  schemaFields(operationPath.schema.path('outboxDeduplicationKeys').schema),
  [...OUTBOX_FIELDS]
);
deepEqual(schemaFields(submittedPath.schema), [...SUBMITTED_EVIDENCE_FIELDS]);

// Exact schema types, enums, bounds, and immutable flags.
const contentSchema = candidatePath.schema.path('content').schema;
const destinationSchema = candidatePath.schema.path(
  'destinationEvidence'
).schema;
for (const field of CONTENT_FIELDS) {
  equal(contentSchema.path(field).options.immutable, true, field);
}
for (const field of DESTINATION_FIELDS) {
  equal(destinationSchema.path(field).options.immutable, true, field);
}
for (const field of OPERATION_FIELDS) {
  equal(operationPath.schema.path(field).options.immutable, true, field);
}
for (const field of SUBMITTED_EVIDENCE_FIELDS) {
  equal(submittedPath.schema.path(field).options.immutable, true, field);
}
deepEqual(candidatePath.schema.path('candidateKind').options.enum, [
  'major_edit',
  'correction',
]);
deepEqual(contentSchema.path('employmentType').options.enum, [
  'full-time',
  'part-time',
  'contract',
  'internship',
]);
deepEqual(contentSchema.path('jobType').options.enum, [
  'Government',
  'Private',
  'Internship',
]);
deepEqual(contentSchema.path('workMode').options.enum, [
  'on_site',
  'remote',
  'hybrid',
]);
deepEqual(destinationSchema.path('mode').options.enum, [
  'internal_platform',
  'external_url',
  'external_email',
]);
deepEqual(destinationSchema.path('trustClassification').options.enum, [
  'INTERNAL_PLATFORM',
  'ADMIN_REVIEW_REQUIRED',
  'ADMIN_APPROVED_FOR_PUBLICATION',
  'UNVERIFIED_REJECTED',
]);
deepEqual(destinationSchema.path('classifiedByActorType').options.enum, [
  'system',
  'staff',
  'security_operator',
]);
equal(contentSchema.path('title').options.validate.validator('x'), true);
equal(contentSchema.path('title').options.validate.validator(''), false);
equal(
  contentSchema.path('description').options.validate.validator('x'.repeat(20)),
  true
);
equal(
  contentSchema.path('description').options.validate.validator('x'.repeat(19)),
  false
);
equal(
  contentSchema
    .path('requirements')
    .options.validate.validator(Array(200).fill('x')),
  true
);
equal(
  contentSchema
    .path('requirements')
    .options.validate.validator(Array(201).fill('x')),
  false
);
equal(
  contentSchema
    .path('skillsRequired')
    .options.validate.validator(Array(40).fill('x')),
  true
);
equal(
  contentSchema
    .path('skillsRequired')
    .options.validate.validator(Array(41).fill('x')),
  false
);
equal(operationPath.schema.path('rulesVersion').options.minlength, 1);
equal(operationPath.schema.path('rulesVersion').options.maxlength, 100);
equal(
  operationPath.schema
    .path('outboxDeduplicationKeys')
    .schema.path('employerSubmissionReceived').options.maxlength,
  160
);

// Complete evidence and legacy compatibility.
const completeSubmission = new JobPublicationSubmission(submission());
await completeSubmission.validate();
ok(completeSubmission.publicationCandidate);
ok(completeSubmission.operationEvidence);
const legacy = new JobPublicationSubmission(legacySubmission());
await legacy.validate();
equal(legacy.publicationCandidate, undefined);
equal(legacy.operationEvidence, undefined);

const completeEvent = new JobModerationEvent(moderationEvent());
await completeEvent.validate();
ok(completeEvent.submittedEvidence);
const legacyEventValue = moderationEvent();
delete legacyEventValue.submittedEvidence;
delete legacyEventValue.metadata;
const legacyEvent = new JobModerationEvent(legacyEventValue);
await legacyEvent.validate();
equal(legacyEvent.submittedEvidence, undefined);

// Partial envelopes fail closed and no evidence is fabricated.
const onlyCandidate = submission();
delete onlyCandidate.operationEvidence;
await rejects(
  new JobPublicationSubmission(onlyCandidate).validate(),
  /complete immutable publication evidence is required/
);
const onlyOperation = submission();
delete onlyOperation.publicationCandidate;
await rejects(
  new JobPublicationSubmission(onlyOperation).validate(),
  /complete immutable publication evidence is required/
);
const partialCandidate = publicationCandidate();
delete partialCandidate.candidateHash;
await rejects(
  new JobPublicationSubmission(
    submission({ publicationCandidate: partialCandidate })
  ).validate(),
  /publication candidate evidence is incomplete/
);
const partialContent = candidateContent();
delete partialContent.gallery;
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({ content: partialContent }),
    })
  ).validate(),
  /publication candidate content evidence is incomplete/
);
const partialDestination = destinationEvidence();
delete partialDestination.targetDigest;
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        destinationEvidence: partialDestination,
      }),
    })
  ).validate(),
  /application destination evidence is incomplete/
);
const partialOperation = operationEvidence(objectId(1), objectId(3));
delete partialOperation.rulesDigest;
await rejects(
  new JobPublicationSubmission(
    submission({ operationEvidence: partialOperation })
  ).validate(),
  /publishing operation evidence is incomplete/
);
const partialSubmitted = submittedEvidence(objectId(1), objectId(3));
delete partialSubmitted.candidateHash;
await rejects(
  new JobModerationEvent(
    moderationEvent({ submittedEvidence: partialSubmitted })
  ).validate(),
  /submitted moderation evidence relationships are invalid/
);

// Candidate, destination, operation, and event relationship checks.
await rejects(
  new JobPublicationSubmission(
    submission({
      candidateOverrides: {
        candidateRevision: 2,
      },
    })
  ).validate(),
  /publication candidate relationship is invalid/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      candidateOverrides: {
        candidateKind: 'correction',
        candidateRevision: 2,
        previousCandidateHash: hash('b'),
      },
    })
  ).validate(),
  /immutable publication evidence relationships are invalid/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      operationOverrides: {
        expectedCommittedPublicationVersion: 9,
      },
    })
  ).validate(),
  /immutable publication evidence relationships are invalid/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      operationOverrides: {
        expectedCurrentSubmissionId: objectId(99).toString(),
      },
    })
  ).validate(),
  /immutable publication evidence relationships are invalid/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      operationOverrides: {
        initiatedAt: '2026-07-29T12:00:01.000Z',
      },
    })
  ).validate(),
  /immutable publication evidence relationships are invalid/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      operationOverrides: {
        newModerationCycleId: objectId(99).toString(),
      },
    })
  ).validate(),
  /moderation-cycle evidence relationship is invalid/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        destinationEvidence: destinationEvidence({
          normalizedTarget: 'https://jobs.example.net/opening',
        }),
      }),
    })
  ).validate(),
  /application destination relationship is invalid/
);
const externalUrlSubmission = new JobPublicationSubmission(
  submission({
    publicationCandidate: publicationCandidate({
      destinationEvidence: destinationEvidence({
        mode: 'external_url',
        normalizedTarget: 'https://careers.example.pk/openings/42',
        normalizedDomain: 'careers.example.pk',
        trustClassification: 'ADMIN_REVIEW_REQUIRED',
        evidenceSource: 'employer_declared_external_target',
      }),
    }),
  })
);
await externalUrlSubmission.validate();
equal(
  externalUrlSubmission.publicationCandidate.destinationEvidence
    .normalizedDomain,
  'careers.example.pk'
);
const externalEmailSubmission = new JobPublicationSubmission(
  submission({
    publicationCandidate: publicationCandidate({
      destinationEvidence: destinationEvidence({
        mode: 'external_email',
        normalizedTarget: 'Hiring.Team@careers.example.pk',
        normalizedDomain: 'careers.example.pk',
        trustClassification: 'ADMIN_REVIEW_REQUIRED',
        evidenceSource: 'employer_declared_external_target',
      }),
    }),
  })
);
await externalEmailSubmission.validate();
equal(
  externalEmailSubmission.publicationCandidate.destinationEvidence
    .normalizedTarget,
  'Hiring.Team@careers.example.pk'
);
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        destinationEvidence: destinationEvidence({
          mode: 'external_url',
          normalizedTarget: 'https://CAREERS.example.pk/openings/42',
          normalizedDomain: 'careers.example.pk',
          trustClassification: 'ADMIN_REVIEW_REQUIRED',
          evidenceSource: 'employer_declared_external_target',
        }),
      }),
    })
  ).validate(),
  /application destination relationship is invalid/
);
await rejects(
  new JobModerationEvent(
    moderationEvent({
      evidenceOverrides: { candidateHash: hash('8') },
    })
  ).validate(),
  /submitted moderation evidence relationships are invalid/
);
await rejects(
  new JobModerationEvent(
    moderationEvent({
      evidenceOverrides: { moderationCycleId: objectId(99).toString() },
    })
  ).validate(),
  /submitted moderation evidence relationships are invalid/
);
await rejects(
  new JobModerationEvent(
    moderationEvent({
      evidenceOverrides: { eventTimestamp: '2026-07-29T12:00:01.000Z' },
    })
  ).validate(),
  /submitted moderation evidence relationships are invalid/
);

// Strict security: unknown, hostile, and unsupported evidence is rejected.
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: {
        ...publicationCandidate(),
        sourceUrl: 'https://forbidden.invalid',
      },
    })
  ).validate(),
  /publicationCandidate|strict mode|unsupported evidence/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        content: {
          ...candidateContent(),
          payment: { token: 'private' },
        },
      }),
    })
  ).validate(),
  /publicationCandidate|strict mode|unsupported evidence/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        destinationEvidence: {
          ...destinationEvidence(),
          jobId: objectId(4).toString(),
        },
      }),
    })
  ).validate(),
  /publicationCandidate|strict mode|unsupported evidence/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      operationEvidence: {
        ...operationEvidence(objectId(1), objectId(3)),
        session: { transaction: true },
      },
    })
  ).validate(),
  /operationEvidence|strict mode|unsupported evidence/
);
await rejects(
  new JobModerationEvent(
    moderationEvent({
      submittedEvidence: {
        ...submittedEvidence(objectId(1), objectId(3)),
        metadata: { private: true },
      },
    })
  ).validate(),
  /submittedEvidence|strict mode|unsupported evidence/
);
await rejects(
  new JobPublicationSubmission(
    submission({ publicationCandidate: new Map() })
  ).validate(),
  /publicationCandidate|invalid evidence|complete immutable/
);
await rejects(
  new JobPublicationSubmission(
    submission({ operationEvidence: new Set() })
  ).validate(),
  /operationEvidence|invalid evidence|complete immutable/
);
await rejects(
  new JobModerationEvent(
    moderationEvent({ submittedEvidence: /unsafe/u })
  ).validate(),
  /submittedEvidence|invalid evidence|relationships/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        candidateRevision: '1',
      }),
    })
  ).validate(),
  /publicationCandidate|invalid evidence|invalid type/
);
await rejects(
  new JobPublicationSubmission(
    submission({
      publicationCandidate: publicationCandidate({
        content: candidateContent({ autoCloseWhenFilled: 'true' }),
      }),
    })
  ).validate(),
  /publicationCandidate|invalid evidence|invalid type/
);
await rejects(
  new JobModerationEvent(
    moderationEvent({
      submittedEvidence: submittedEvidence(objectId(1), objectId(3), {
        candidateRevision: '1',
      }),
    })
  ).validate(),
  /submittedEvidence|unsupported evidence|relationships|invalid type/
);
const accessorCandidate = publicationCandidate();
Object.defineProperty(accessorCandidate, 'candidateHash', {
  enumerable: true,
  get() {
    return hash('c');
  },
});
await rejects(
  new JobPublicationSubmission(
    submission({ publicationCandidate: accessorCandidate })
  ).validate(),
  /publicationCandidate|strict mode|unsupported evidence/
);
const symbolOperation = operationEvidence(objectId(1), objectId(3));
symbolOperation[Symbol('private')] = 'forbidden';
await rejects(
  new JobPublicationSubmission(
    submission({ operationEvidence: symbolOperation })
  ).validate(),
  /operationEvidence|strict mode|unsupported evidence/
);

// Error text is category/path oriented and does not repeat private values.
const privateOperationValue = 'private-operation-identity';
const invalidOperationDocument = new JobPublicationSubmission(
  submission({
    operationOverrides: { operationId: privateOperationValue },
  })
);
let privateOperationError;
try {
  await invalidOperationDocument.validate();
} catch (error) {
  privateOperationError = error;
}
ok(privateOperationError);
equal(privateOperationError.message.includes(privateOperationValue), false);
const privateDestinationValue = ' private-destination@example.net ';
const invalidDestinationDocument = new JobPublicationSubmission(
  submission({
    publicationCandidate: publicationCandidate({
      destinationEvidence: destinationEvidence({
        mode: 'external_email',
        normalizedTarget: privateDestinationValue,
        normalizedDomain: 'example.net',
        trustClassification: 'ADMIN_REVIEW_REQUIRED',
        evidenceSource: 'employer_declared_external_target',
      }),
    }),
  })
);
let privateDestinationError;
try {
  await invalidDestinationDocument.validate();
} catch (error) {
  privateDestinationError = error;
}
ok(privateDestinationError);
equal(privateDestinationError.message.includes(privateDestinationValue), false);

// Mongoose schema-level immutability: assignments are ignored or validation
// rejects a detected mutation. Array in-place mutation is explicitly covered.
const hydratedSubmission = completeSubmission.toObject({
  depopulate: true,
  versionKey: false,
});
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.publicationCandidate = publicationCandidate({
      candidateHash: hash('7'),
    });
  },
  (document) => document.publicationCandidate.candidateHash
);
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.publicationCandidate.candidateHash = hash('7');
  },
  (document) => document.publicationCandidate.candidateHash
);
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.operationEvidence.operationId =
      '123e4567-e89b-42d3-a456-426614174001';
  },
  (document) => document.operationEvidence.operationId
);
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.operationEvidence.expectedPublicationVersion = 8;
  },
  (document) => document.operationEvidence.expectedPublicationVersion
);
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.publicationCandidate.destinationEvidence.targetDigest = hash('7');
  },
  (document) => document.publicationCandidate.destinationEvidence.targetDigest
);
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.operationEvidence.outboxDeduplicationKeys.employerSubmissionReceived = `${objectId(99)}:employer_submission_received`;
  },
  (document) =>
    document.operationEvidence.outboxDeduplicationKeys
      .employerSubmissionReceived
);
await immutableMutation(
  JobPublicationSubmission,
  hydratedSubmission,
  (document) => {
    document.publicationCandidate.content.requirements.push('Changed');
  },
  (document) => [...document.publicationCandidate.content.requirements]
);

const hydratedEvent = completeEvent.toObject({
  depopulate: true,
  versionKey: false,
});
await immutableMutation(
  JobModerationEvent,
  hydratedEvent,
  (document) => {
    document.submittedEvidence = submittedEvidence(objectId(1), objectId(3), {
      candidateHash: hash('7'),
    });
  },
  (document) => document.submittedEvidence.candidateHash
);
await immutableMutation(
  JobModerationEvent,
  hydratedEvent,
  (document) => {
    document.submittedEvidence.candidateHash = hash('7');
  },
  (document) => document.submittedEvidence.candidateHash
);
await immutableMutation(
  JobModerationEvent,
  hydratedEvent,
  (document) => {
    document.submittedEvidence.moderationCycleId = objectId(99).toString();
  },
  (document) => document.submittedEvidence.moderationCycleId
);

// New envelopes introduce no Mixed/Map path and no index.
assertNoMixedOrMap(candidatePath.schema);
assertNoMixedOrMap(operationPath.schema);
assertNoMixedOrMap(submittedPath.schema);
equal(JobPublicationSubmission.schema.indexes().length, 11);
equal(JobModerationEvent.schema.indexes().length, 4);
for (const [fields] of JobPublicationSubmission.schema.indexes()) {
  equal(
    Object.keys(fields).some(
      (field) =>
        field.startsWith('publicationCandidate') ||
        field.startsWith('operationEvidence')
    ),
    false
  );
}
for (const [fields] of JobModerationEvent.schema.indexes()) {
  equal(
    Object.keys(fields).some((field) => field.startsWith('submittedEvidence')),
    false
  );
}

// Disconnected compilation and JSON serialization require no database.
equal(JobPublicationSubmission.db.readyState, 0);
equal(JobModerationEvent.db.readyState, 0);
const serializedSubmission = JSON.parse(
  JSON.stringify(completeSubmission.toObject())
);
const serializedEvent = JSON.parse(JSON.stringify(completeEvent.toObject()));
equal(serializedSubmission.publicationCandidate.candidateHash, hash('c'));
equal(serializedSubmission.operationEvidence.operationId, OPERATION_ID);
equal(serializedEvent.submittedEvidence.candidateHash, hash('c'));
equal(
  Object.hasOwn(serializedSubmission.publicationCandidate, 'sourceUrl'),
  false
);
equal(
  Object.hasOwn(
    serializedSubmission.publicationCandidate.destinationEvidence,
    'jobId'
  ),
  false
);
equal(Object.hasOwn(serializedEvent.submittedEvidence, 'metadata'), false);
equal(
  Object.hasOwn(
    JobPublicationSubmission.schema.virtuals,
    'publicationCandidate'
  ),
  false
);
equal(
  Object.hasOwn(JobModerationEvent.schema.virtuals, 'submittedEvidence'),
  false
);

console.log(
  `publishingImmutableEvidenceSchema.test.js: ${assertionCount} assertions passed`
);
