/**
 * Additive publication-ledger and serialization-guard model tests (E.1F-H2A).
 * Run: node src/__tests__/jobPublicationSubmissionModel.test.js
 */
import nodeAssert from 'assert';
import mongoose from 'mongoose';
import { EmployerPublishingQuotaGuard } from '../models/EmployerPublishingQuotaGuard.js';
import { JobPublicationSubmission } from '../models/JobPublicationSubmission.js';

let assertionCount = 0;
const assert = new Proxy(nodeAssert, {
  apply(target, thisArg, argumentsList) {
    assertionCount += 1;
    return Reflect.apply(target, thisArg, argumentsList);
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== 'function') return value;
    return (...argumentsList) => {
      assertionCount += 1;
      return Reflect.apply(value, target, argumentsList);
    };
  },
});

function indexByName(schema, name) {
  return schema.indexes().find(([, options]) => options?.name === name);
}

function baseSubmission(overrides = {}) {
  const usageSnapshot = {
    daily: { used: 0, limit: 1, remaining: 1, nextEligibleAt: null },
    rolling30Days: {
      used: 0,
      limit: 10,
      remaining: 10,
      nextSlotAt: null,
    },
    activeFreeJobs: {
      planCode: 'free_beta',
      used: 0,
      limit: 5,
      remaining: 5,
      hasCapacity: true,
    },
  };

  return {
    jobId: new mongoose.Types.ObjectId(),
    employerId: new mongoose.Types.ObjectId(),
    quotaOwnerType: 'employer',
    quotaOwnerId: new mongoose.Types.ObjectId(),
    submissionKind: 'initial',
    state: 'pending_review',
    acceptedAt: new Date('2026-07-28T12:00:00.000Z'),
    idempotencyKey: 'free-beta-request-0001',
    requestFingerprint: 'a'.repeat(64),
    moderationCycleId: new mongoose.Types.ObjectId(),
    quotaCharged: true,
    jobRevision: 0,
    contentSnapshot: {
      contentHash: 'b'.repeat(64),
      title: 'Engineer',
      applicationMode: 'external',
      applicationDomain: 'jobs.example.com',
    },
    rulesAcknowledgementId: new mongoose.Types.ObjectId(),
    verificationSnapshot: {
      verified: true,
      verificationLevel: 'verified',
      accountStatus: 'active',
      normalizedCompanyName: 'Example',
      emailPresent: true,
      emailValid: true,
      emailDomain: 'example.com',
      predicateCapabilityVersion: 'employer-eligibility-v1',
      eligibilityResultCodes: [],
    },
    quotaSnapshot: {
      policyCode: 'free_beta',
      policyVersion: 'free-beta-2026-01',
      capturedAt: new Date('2026-07-28T12:00:00.000Z'),
      before: usageSnapshot,
      after: usageSnapshot,
    },
    ...overrides,
  };
}

const ownerIdempotency = indexByName(
  JobPublicationSubmission.schema,
  'publication_submission_owner_idempotency_unique'
);
assert.ok(ownerIdempotency, 'owner/idempotency unique index must exist');
assert.deepStrictEqual(ownerIdempotency[0], {
  quotaOwnerType: 1,
  quotaOwnerId: 1,
  idempotencyKey: 1,
});
assert.strictEqual(ownerIdempotency[1].unique, true);

const pendingPerJob = indexByName(
  JobPublicationSubmission.schema,
  'publication_submission_one_pending_per_job'
);
assert.ok(pendingPerJob, 'one-pending-submission-per-job index must exist');
assert.strictEqual(pendingPerJob[1].unique, true);
assert.deepStrictEqual(pendingPerJob[1].partialFilterExpression, {
  state: 'pending_review',
});

const exemptPerCycle = indexByName(
  JobPublicationSubmission.schema,
  'publication_submission_one_exempt_correction_per_cycle'
);
assert.ok(
  exemptPerCycle,
  'one exempt correction per moderation cycle index must exist'
);
assert.strictEqual(exemptPerCycle[1].unique, true);
assert.deepStrictEqual(exemptPerCycle[1].partialFilterExpression, {
  submissionKind: 'correction',
  quotaCharged: false,
});

assert.strictEqual(
  JobPublicationSubmission.schema.path('acceptedAt').options.immutable,
  true
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('quotaCharged').options.immutable,
  true
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('correctionOfSubmissionId').options
    .immutable,
  true
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('quotaCharged').options.default,
  undefined
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('contentSnapshot').schema.options.strict,
  'throw'
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('verificationSnapshot').schema.options
    .strict,
  'throw'
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('quotaSnapshot').schema.options.strict,
  'throw'
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('publicationCandidate').options
    .immutable,
  true
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('operationEvidence').options.immutable,
  true
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('publicationCandidate').options.default,
  undefined
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('operationEvidence').options.default,
  undefined
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('publicationCandidate').schema.options
    .strict,
  'throw'
);
assert.strictEqual(
  JobPublicationSubmission.schema.path('operationEvidence').schema.options
    .strict,
  'throw'
);

const legacySubmission = new JobPublicationSubmission(baseSubmission());
await legacySubmission.validate();
assert.strictEqual(legacySubmission.publicationCandidate, undefined);
assert.strictEqual(legacySubmission.operationEvidence, undefined);
assert.strictEqual(
  JobPublicationSubmission.schema
    .indexes()
    .some(([fields]) =>
      Object.keys(fields).some(
        (field) =>
          field.startsWith('publicationCandidate') ||
          field.startsWith('operationEvidence')
      )
    ),
  false
);

await new JobPublicationSubmission(
  baseSubmission({
    submissionKind: 'correction',
    correctionOfSubmissionId: new mongoose.Types.ObjectId(),
    quotaCharged: false,
    quotaExemptionReason: 'reviewer_requested_correction',
  })
).validate();

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      submissionKind: 'correction',
      correctionOfSubmissionId: null,
    })
  ).validate(),
  /correctionOfSubmissionId is required/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      quotaCharged: true,
      quotaExemptionReason: 'reviewer_requested_correction',
    })
  ).validate(),
  /quotaExemptionReason must be empty/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      quotaCharged: false,
      quotaExemptionReason: null,
    })
  ).validate(),
  /quotaExemptionReason is required/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      state: 'approved',
      approvedAt: null,
    })
  ).validate(),
  /approvedAt is required/
);

const reviewedAt = new Date('2026-07-28T13:00:00.000Z');
await new JobPublicationSubmission(
  baseSubmission({
    state: 'approved',
    reviewedAt,
    approvedAt: reviewedAt,
  })
).validate();

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      state: 'approved',
      reviewedAt: null,
      approvedAt: reviewedAt,
    })
  ).validate(),
  /reviewedAt is required/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      state: 'pending_review',
      approvedAt: reviewedAt,
    })
  ).validate(),
  /approvedAt is only valid/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      state: 'rejected',
      reviewedAt,
      rejectedAt: new Date(reviewedAt.getTime() + 1),
    })
  ).validate(),
  /reviewedAt must match/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      state: 'rejected',
      reviewedAt: new Date('2026-07-28T11:00:00.000Z'),
      rejectedAt: new Date('2026-07-28T11:00:00.000Z'),
    })
  ).validate(),
  /reviewedAt cannot be earlier/
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      verificationSnapshot: {
        verified: true,
        verificationLevel: 'verified',
        accountStatus: 'active',
        emailPresent: true,
        emailValid: true,
        predicateCapabilityVersion: 'employer-eligibility-v1',
        eligibilityResultCodes: [],
        rawPrivateField: 'synthetic-test-value',
      },
    })
  ).validate(),
  (error) =>
    error.errors?.verificationSnapshot?.reason?.message ===
    'verificationSnapshot.rawPrivateField is not an allowed snapshot field'
);

await assert.rejects(
  new JobPublicationSubmission(
    baseSubmission({
      contentSnapshot: {
        contentHash: 'b'.repeat(64),
        title: 'Engineer',
        rawRequest: { body: 'must-not-be-accepted' },
      },
    })
  ).validate(),
  (error) =>
    error.errors?.contentSnapshot?.reason?.message ===
    'contentSnapshot.rawRequest is not an allowed snapshot field'
);

const submissionWithUnsafeQuotaSnapshot = baseSubmission();
submissionWithUnsafeQuotaSnapshot.quotaSnapshot.before.daily.secret = 'no';
await assert.rejects(
  new JobPublicationSubmission(submissionWithUnsafeQuotaSnapshot).validate(),
  (error) =>
    error.errors?.quotaSnapshot?.reason?.message ===
    'quotaSnapshot.before.daily.secret is not an allowed snapshot field'
);

const guardOwnerId = new mongoose.Types.ObjectId();
const guard = new EmployerPublishingQuotaGuard({
  _id: `employer:${guardOwnerId}`,
  ownerType: 'employer',
  ownerId: guardOwnerId,
});
await guard.validate();

await assert.rejects(
  new EmployerPublishingQuotaGuard({
    _id: `organization:${guardOwnerId}`,
    ownerType: 'employer',
    ownerId: guardOwnerId,
  }).validate(),
  /namespaced owner identity/
);

const guardOwnerUnique = indexByName(
  EmployerPublishingQuotaGuard.schema,
  'publishing_quota_guard_owner_unique'
);
assert.ok(guardOwnerUnique, 'guard owner unique index must exist');
assert.deepStrictEqual(guardOwnerUnique[0], { ownerType: 1, ownerId: 1 });
assert.strictEqual(guardOwnerUnique[1].unique, true);

console.log(
  `jobPublicationSubmissionModel.test.js: ${assertionCount} assertions passed`
);
