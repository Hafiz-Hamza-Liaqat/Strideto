/**
 * Run: node src/__tests__/reviewerCorrectionEligibility.test.js
 */
import assert from 'assert';
import {
  REVIEWER_CORRECTION_WINDOW_MS,
  evaluateReviewerCorrectionExemption,
} from '../services/publishing/ReviewerCorrectionEligibility.js';

const now = new Date('2026-07-28T12:00:00.000Z');
const previousId = '507f1f77bcf86cd799439012';
const jobId = '507f1f77bcf86cd799439013';
const cycleId = '507f1f77bcf86cd799439014';

function snapshot(overrides = {}) {
  return {
    contentHash: 'a'.repeat(64),
    title: 'Platform Engineer',
    companyName: 'Example Company',
    description: 'Build the platform.',
    requirements: ['Node.js'],
    category: 'Engineering',
    applicationMode: 'external',
    applicationDomain: 'jobs.example.com',
    location: 'Karachi',
    workMode: 'hybrid',
    educationRequirement: 'Bachelor degree',
    salaryRange: '100000-150000',
    ...overrides,
  };
}

function input(overrides = {}) {
  const previousContentSnapshot = snapshot();
  return {
    previousSubmission: {
      _id: previousId,
      jobId,
      state: 'rejected',
      reviewedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      moderationCycleId: cycleId,
      contentSnapshot: previousContentSnapshot,
    },
    latestModerationEvent: {
      submissionId: previousId,
      action: 'changes_requested',
      requestedFieldPaths: ['educationRequirement'],
      metadata: { moderationCycleId: cycleId },
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
    correctionOfSubmissionId: previousId,
    currentJobId: jobId,
    currentContentSnapshot: snapshot({
      contentHash: 'b'.repeat(64),
      educationRequirement: 'Bachelor degree or equivalent experience',
    }),
    previousContentSnapshot,
    existingCycleSubmissions: [],
    now,
    ...overrides,
  };
}

const valid = evaluateReviewerCorrectionExemption(input());
assert.strictEqual(valid.eligibleForExemption, true);
assert.strictEqual(valid.quotaCharged, false);
assert.strictEqual(valid.quotaExemptionReason, 'reviewer_requested_correction');
assert.strictEqual(valid.moderationCycleId, cycleId);
assert.deepStrictEqual(valid.blockerCodes, []);
assert.deepStrictEqual(valid.changedFields, ['educationRequirement']);

const exactlySevenDays = evaluateReviewerCorrectionExemption(
  input({
    latestModerationEvent: {
      ...input().latestModerationEvent,
      createdAt: new Date(now.getTime() - REVIEWER_CORRECTION_WINDOW_MS),
    },
  })
);
assert.strictEqual(exactlySevenDays.eligibleForExemption, true);

const late = evaluateReviewerCorrectionExemption(
  input({
    latestModerationEvent: {
      ...input().latestModerationEvent,
      createdAt: new Date(now.getTime() - REVIEWER_CORRECTION_WINDOW_MS - 1),
    },
  })
);
assert.strictEqual(late.quotaCharged, true);
assert.ok(late.blockerCodes.includes('CORRECTION_WINDOW_EXPIRED'));

const differentJob = evaluateReviewerCorrectionExemption(
  input({ currentJobId: '507f1f77bcf86cd799439099' })
);
assert.ok(differentJob.blockerCodes.includes('DIFFERENT_JOB'));

const nonImmediate = evaluateReviewerCorrectionExemption(
  input({ correctionOfSubmissionId: '507f1f77bcf86cd799439099' })
);
assert.ok(nonImmediate.blockerCodes.includes('NOT_IMMEDIATE_PREDECESSOR'));

const wrongCycle = evaluateReviewerCorrectionExemption(
  input({
    latestModerationEvent: {
      ...input().latestModerationEvent,
      metadata: {
        moderationCycleId: '507f1f77bcf86cd799439099',
      },
    },
  })
);
assert.ok(wrongCycle.blockerCodes.includes('MODERATION_CYCLE_MISMATCH'));
assert.strictEqual(wrongCycle.quotaCharged, true);
assert.strictEqual(wrongCycle.quotaExemptionReason, null);

const missingEventCycle = evaluateReviewerCorrectionExemption(
  input({
    latestModerationEvent: {
      ...input().latestModerationEvent,
      metadata: undefined,
    },
  })
);
assert.strictEqual(missingEventCycle.eligibleForExemption, false);
assert.strictEqual(missingEventCycle.quotaCharged, true);
assert.strictEqual(missingEventCycle.quotaExemptionReason, null);
assert.deepStrictEqual(missingEventCycle.blockerCodes, [
  'MODERATION_CYCLE_MISSING',
]);

const missingSubmissionCycle = evaluateReviewerCorrectionExemption(
  input({
    previousSubmission: {
      ...input().previousSubmission,
      moderationCycleId: undefined,
    },
  })
);
assert.strictEqual(missingSubmissionCycle.eligibleForExemption, false);
assert.strictEqual(missingSubmissionCycle.quotaCharged, true);
assert.strictEqual(missingSubmissionCycle.quotaExemptionReason, null);
assert.deepStrictEqual(missingSubmissionCycle.blockerCodes, [
  'MODERATION_CYCLE_MISSING',
]);

for (const missingCycle of [
  null,
  undefined,
  '',
  '   ',
  'not-a-moderation-cycle',
  { toHexString: () => null },
]) {
  const malformedCycle = evaluateReviewerCorrectionExemption(
    input({
      latestModerationEvent: {
        ...input().latestModerationEvent,
        metadata: { moderationCycleId: missingCycle },
      },
    })
  );
  assert.strictEqual(malformedCycle.quotaCharged, true);
  assert.strictEqual(malformedCycle.quotaExemptionReason, null);
  assert.deepStrictEqual(malformedCycle.blockerCodes, [
    'MODERATION_CYCLE_MISSING',
  ]);
}

const alreadyUsed = evaluateReviewerCorrectionExemption(
  input({
    existingCycleSubmissions: [
      {
        moderationCycleId: cycleId,
        submissionKind: 'correction',
        quotaCharged: false,
      },
    ],
  })
);
assert.ok(alreadyUsed.blockerCodes.includes('EXEMPT_CORRECTION_ALREADY_USED'));

const unrequestedChange = evaluateReviewerCorrectionExemption(
  input({
    currentContentSnapshot: snapshot({
      contentHash: 'c'.repeat(64),
      educationRequirement: 'Bachelor degree or equivalent experience',
      salaryRange: '150000-200000',
    }),
  })
);
assert.ok(unrequestedChange.blockerCodes.includes('UNREQUESTED_FIELD_CHANGED'));
assert.deepStrictEqual(unrequestedChange.changedFields, [
  'salaryRange',
  'educationRequirement',
]);

for (const [field, value] of [
  ['title', 'Different Role'],
  ['companyName', 'Different Company'],
  ['category', 'Finance'],
  ['applicationDomain', 'another.example'],
  ['location', 'Lahore'],
  ['workMode', 'remote'],
]) {
  const coreChange = evaluateReviewerCorrectionExemption(
    input({
      latestModerationEvent: {
        ...input().latestModerationEvent,
        requestedFieldPaths: [field],
      },
      currentContentSnapshot: snapshot({
        contentHash: 'd'.repeat(64),
        [field]: value,
      }),
    })
  );
  assert.ok(
    coreChange.blockerCodes.includes('CORE_VACANCY_CHANGED'),
    `${field} must change core vacancy identity`
  );
  assert.strictEqual(coreChange.quotaCharged, true);
}

const invalidSnapshot = evaluateReviewerCorrectionExemption(
  input({
    currentContentSnapshot: {
      ...snapshot(),
      rawRequest: { body: 'not-allowed' },
    },
  })
);
assert.ok(invalidSnapshot.blockerCodes.includes('INVALID_CONTENT_SNAPSHOT'));
assert.deepStrictEqual(invalidSnapshot.changedFields, []);

const noPreviousRejection = evaluateReviewerCorrectionExemption(
  input({
    previousSubmission: {
      ...input().previousSubmission,
      state: 'approved',
    },
  })
);
assert.ok(noPreviousRejection.blockerCodes.includes('NO_PREVIOUS_REJECTION'));

const noRequestedFields = evaluateReviewerCorrectionExemption(
  input({
    latestModerationEvent: {
      ...input().latestModerationEvent,
      requestedFieldPaths: [],
    },
  })
);
assert.ok(
  noRequestedFields.blockerCodes.includes('NO_REQUESTED_CORRECTION_FIELDS')
);

console.log('reviewerCorrectionEligibility tests passed.');
