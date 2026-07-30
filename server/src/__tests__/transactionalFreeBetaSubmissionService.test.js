/**
 * Run: node src/__tests__/transactionalFreeBetaSubmissionService.test.js
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import {
  PublishingSubmissionDomainError,
  TRANSACTION_SERVICE_BOUNDARY_OUTCOMES,
  createDormantTransactionalFreeBetaSubmissionBoundary,
  createTransactionalFreeBetaSubmissionService,
} from '../services/publishing/TransactionalFreeBetaSubmissionService.js';

const EMPLOYER_ID = '507f1f77bcf86cd799439011';
const OTHER_EMPLOYER_ID = '507f1f77bcf86cd799439012';
const JOB_ID = '507f1f77bcf86cd799439021';
const PREVIOUS_SUBMISSION_ID = '507f1f77bcf86cd799439031';
const MODERATION_CYCLE_ID = '507f1f77bcf86cd799439041';
const NOW = new Date('2026-07-28T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function validEmployer(overrides = {}) {
  return {
    _id: EMPLOYER_ID,
    companyName: 'Example Company',
    email: 'jobs@example.com',
    companyDescription: 'Builds useful products.',
    industry: 'Technology',
    location: 'Karachi',
    website: 'https://example.com',
    verified: true,
    verificationLevel: 'verified',
    accountStatus: 'active',
    ...overrides,
  };
}

function contentSnapshot(overrides = {}) {
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
    ...overrides,
  };
}

function quotaUsage(overrides = {}) {
  return {
    daily: {
      used: 0,
      limit: 1,
      remaining: 1,
      nextEligibleAt: null,
    },
    rolling30Days: {
      used: 0,
      limit: 10,
      remaining: 10,
      nextSlotAt: null,
    },
    activeFreeJobs: {
      planCode: 'free_beta',
      used: 5,
      limit: 5,
      remaining: 0,
      hasCapacity: false,
    },
    ...overrides,
  };
}

function command(overrides = {}) {
  return {
    authenticatedEmployerId: EMPLOYER_ID,
    jobId: JOB_ID,
    submissionKind: 'initial',
    expectedPublicationVersion: 0,
    idempotencyKey: 'free-beta-request-0001',
    postingRules: {
      accepted: true,
      version: 'employer-rules-2026-01',
    },
    correctionOfSubmissionId: null,
    ...overrides,
  };
}

function createHarness({
  employer = validEmployer(),
  jobState = 'draft',
  usage = quotaUsage(),
} = {}) {
  const state = {
    employer,
    job: {
      _id: JOB_ID,
      employerId: EMPLOYER_ID,
      publicationState: jobState,
      publicationVersion: 0,
    },
    jobLoadResult: null,
    usage,
    currentSnapshot: contentSnapshot(),
    fingerprint: 'f'.repeat(64),
    rules: {
      version: 'employer-rules-2026-01',
      digest: 'd'.repeat(64),
    },
    correctionContext: {
      previousSubmission: null,
      existingCycleSubmissions: [],
    },
    latestModerationEvent: null,
    failureAt: null,
    casCode: null,
    acknowledgements: [],
    submissions: [],
    moderationEvents: [],
    outboxIntents: [],
    guardWrites: [],
    casCalls: [],
  };
  const calls = [];
  let idCounter = 1000;

  const transactionalArrays = [
    'acknowledgements',
    'submissions',
    'moderationEvents',
    'outboxIntents',
    'guardWrites',
    'casCalls',
  ];

  const dependencies = {
    transactionRunner: {
      async run(work) {
        calls.push('transaction:start');
        const lengths = Object.fromEntries(
          transactionalArrays.map((key) => [key, state[key].length])
        );
        const jobBefore = { ...state.job };
        try {
          const result = await work({
            session: { id: 'in-memory-transaction' },
          });
          calls.push('transaction:commit');
          return result;
        } catch (error) {
          for (const key of transactionalArrays) {
            state[key].splice(lengths[key]);
          }
          state.job = jobBefore;
          calls.push('transaction:rollback');
          throw error;
        }
      },
    },
    employerRepository: {
      async getById() {
        calls.push('employer:load');
        return state.employer;
      },
    },
    jobRepository: {
      async getOwnedJobForSubmission() {
        calls.push('job:load');
        return (
          state.jobLoadResult || {
            found: true,
            owned: true,
            job: state.job,
          }
        );
      },
      async compareAndSetPendingReview(args) {
        calls.push('job:cas');
        state.casCalls.push(args);
        if (state.failureAt === 'cas' || state.casCode) {
          return {
            matched: false,
            code: state.casCode || 'JOB_VERSION_CONFLICT',
          };
        }
        state.job = {
          ...state.job,
          publicationState: 'pending_review',
          publicationVersion: state.job.publicationVersion + 1,
          currentSubmissionId: args.submissionId,
        };
        return { matched: true };
      },
    },
    submissionRepository: {
      async findByOwnerAndIdempotencyKey({
        quotaOwnerType,
        quotaOwnerId,
        idempotencyKey,
      }) {
        calls.push('submission:idempotency-lookup');
        return state.submissions.find(
          (submission) =>
            submission.quotaOwnerType === quotaOwnerType &&
            String(submission.quotaOwnerId) === String(quotaOwnerId) &&
            submission.idempotencyKey === idempotencyKey
        );
      },
      async getCorrectionContext() {
        calls.push('submission:correction-context');
        return state.correctionContext;
      },
      async create(record) {
        calls.push('submission:create');
        if (state.failureAt === 'submission') {
          throw new Error('synthetic submission failure');
        }
        state.submissions.push(record);
        return record;
      },
    },
    acknowledgementRepository: {
      async create(record) {
        calls.push('acknowledgement:create');
        if (state.failureAt === 'acknowledgement') {
          throw new Error('synthetic acknowledgement failure');
        }
        state.acknowledgements.push(record);
        return record;
      },
    },
    moderationEventRepository: {
      async getLatestForSubmission() {
        calls.push('moderation:latest');
        return state.latestModerationEvent;
      },
      async append(record) {
        calls.push('moderation:append');
        if (state.failureAt === 'moderation') {
          throw new Error('synthetic moderation failure');
        }
        state.moderationEvents.push(record);
        return record;
      },
    },
    quotaUsageService: {
      async getUsage() {
        calls.push('quota:usage');
        return state.usage;
      },
    },
    serializedQuotaGuard: {
      async acquire(owner) {
        calls.push('quota:guard');
        state.guardWrites.push({ owner });
        return { owner, guard: { revision: 1 } };
      },
    },
    notificationOutbox: {
      async enqueueMany(intents) {
        calls.push('outbox:enqueue');
        if (state.failureAt === 'outbox') {
          throw new Error('synthetic outbox failure');
        }
        state.outboxIntents.push(...intents);
      },
    },
    postingRulesRegistry: {
      async getCurrent() {
        calls.push('rules:current');
        return state.rules;
      },
    },
    contentSnapshotBuilder: {
      async build() {
        calls.push('content:snapshot');
        return state.currentSnapshot;
      },
    },
    requestFingerprintBuilder: {
      async build() {
        calls.push('request:fingerprint');
        return state.fingerprint;
      },
    },
    idFactory: {
      next(kind) {
        calls.push(`id:${kind}`);
        idCounter += 1;
        return idCounter.toString(16).padStart(24, '0');
      },
    },
    clock: {
      now() {
        return new Date(NOW);
      },
    },
  };

  const service = createTransactionalFreeBetaSubmissionService(dependencies);
  return { state, calls, dependencies, service };
}

function configureRequestedCorrection(
  state,
  {
    submissionCycleId = MODERATION_CYCLE_ID,
    eventCycleId = MODERATION_CYCLE_ID,
    includeEventCycle = true,
    usage = quotaUsage(),
  } = {}
) {
  const previousSnapshot = contentSnapshot();
  state.currentSnapshot = contentSnapshot({
    contentHash: 'c'.repeat(64),
    educationRequirement: 'Bachelor degree or equivalent experience',
  });
  state.correctionContext = {
    previousSubmission: {
      _id: PREVIOUS_SUBMISSION_ID,
      jobId: JOB_ID,
      state: 'rejected',
      reviewedAt: new Date(NOW.getTime() - DAY),
      moderationCycleId: submissionCycleId,
      contentSnapshot: previousSnapshot,
    },
    existingCycleSubmissions: [],
  };
  state.latestModerationEvent = {
    submissionId: PREVIOUS_SUBMISSION_ID,
    action: 'changes_requested',
    requestedFieldPaths: ['educationRequirement'],
    ...(includeEventCycle
      ? { metadata: { moderationCycleId: eventCycleId } }
      : {}),
    createdAt: new Date(NOW.getTime() - DAY),
  };
  state.usage = usage;
}

function writeCount(state) {
  return (
    state.acknowledgements.length +
    state.submissions.length +
    state.moderationEvents.length +
    state.outboxIntents.length +
    state.guardWrites.length +
    state.casCalls.length
  );
}

async function expectCode(promise, code) {
  await assert.rejects(
    promise,
    (error) =>
      error instanceof PublishingSubmissionDomainError && error.code === code
  );
}

assert.throws(
  () => createTransactionalFreeBetaSubmissionService({}),
  (error) =>
    error instanceof PublishingSubmissionDomainError &&
    error.code === 'CANONICAL_JOB_REPOSITORY_REQUIRED'
);
assert.deepStrictEqual(TRANSACTION_SERVICE_BOUNDARY_OUTCOMES, [
  'COMMIT_ACKNOWLEDGED',
  'DEFINITELY_ABORTED',
  'APPLICATION_ERROR_BEFORE_COMMIT',
  'COMMIT_RESULT_UNKNOWN',
]);
assert.throws(
  () => createDormantTransactionalFreeBetaSubmissionBoundary({}),
  (error) => error.code === 'TRANSACTION_BOUNDARY_EXECUTOR_REQUIRED'
);

{
  const { state, calls, service } = createHarness();
  assert.deepStrictEqual(Object.keys(service), ['submitFreeBetaJob']);
  assert.strictEqual(Object.hasOwn(service, 'createDraft'), false);
  const result = await service.submitFreeBetaJob(command());

  assert.strictEqual(result.idempotentReplay, false);
  assert.strictEqual(result.publicationState, 'pending_review');
  assert.strictEqual(result.submission.planCode, 'free_beta');
  assert.strictEqual(result.submission.policyVersion, 'free-beta-2026-01');
  assert.strictEqual(result.submission.quotaCharged, true);
  assert.strictEqual(state.acknowledgements.length, 1);
  assert.strictEqual(state.submissions.length, 1);
  assert.strictEqual(state.moderationEvents.length, 1);
  assert.strictEqual(state.outboxIntents.length, 2);
  assert.strictEqual(state.job.publicationState, 'pending_review');
  assert.notStrictEqual(state.job.publicationState, 'active');
  assert.strictEqual(Object.hasOwn(state.submissions[0], 'payment'), false);
  assert.strictEqual(Object.hasOwn(state.submissions[0], 'rawRequest'), false);
  assert.strictEqual(state.acknowledgements[0].accepted, true);
  assert.strictEqual(
    state.acknowledgements[0].submissionId,
    state.submissions[0]._id
  );
  assert.strictEqual(state.moderationEvents[0].action, 'submitted');
  assert.strictEqual(state.moderationEvents[0].toState, 'pending_review');
  assert.strictEqual(Object.hasOwn(state.casCalls[0], 'publishedAt'), false);
  assert.strictEqual(Object.hasOwn(state.casCalls[0], 'visibleUntil'), false);
  assert.strictEqual(
    state.submissions[0].quotaSnapshot.before.activeFreeJobs.used,
    5
  );
  assert.strictEqual(
    state.submissions[0].quotaSnapshot.after.activeFreeJobs.used,
    5,
    'five active Free Beta jobs must not block or reserve a slot'
  );
  assert.deepStrictEqual(
    state.outboxIntents.map(({ type }) => type),
    ['employer_submission_received', 'admin_job_review_requested']
  );
  assert.strictEqual(
    new Set(state.outboxIntents.map(({ deduplicationKey }) => deduplicationKey))
      .size,
    2
  );
  assert.ok(calls.indexOf('quota:guard') < calls.indexOf('quota:usage'));
  assert.ok(calls.indexOf('submission:create') < calls.indexOf('job:cas'));
  assert.ok(calls.indexOf('job:cas') < calls.indexOf('outbox:enqueue'));
}

{
  const { state, service } = createHarness({ employer: null });
  await expectCode(service.submitFreeBetaJob(command()), 'EMPLOYER_NOT_FOUND');
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness({
    employer: validEmployer({
      verified: false,
      verificationLevel: 'basic',
    }),
  });
  await expectCode(
    service.submitFreeBetaJob(command()),
    'EMPLOYER_NOT_VERIFIED'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  state.jobLoadResult = { found: false, owned: false, job: null };
  await expectCode(service.submitFreeBetaJob(command()), 'JOB_NOT_FOUND');
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  state.jobLoadResult = { found: true, owned: false, job: null };
  await expectCode(service.submitFreeBetaJob(command()), 'JOB_NOT_OWNED');
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  await expectCode(
    service.submitFreeBetaJob(command({ expectedPublicationVersion: 1 })),
    'JOB_VERSION_CONFLICT'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  await expectCode(
    service.submitFreeBetaJob(
      command({
        postingRules: {
          accepted: true,
          version: 'outdated-rules',
        },
      })
    ),
    'POSTING_RULES_VERSION_CHANGED'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness({
    usage: quotaUsage({
      daily: {
        used: 1,
        limit: 1,
        remaining: 0,
        nextEligibleAt: new Date(NOW.getTime() + DAY),
      },
    }),
  });
  await assert.rejects(
    service.submitFreeBetaJob(command()),
    (error) =>
      error.code === 'ROLLING_24H_LIMIT' &&
      error.status === 429 &&
      error.details.displayTimezone === 'Asia/Karachi' &&
      error.details.nextEligibleAt.toISOString() ===
        new Date(NOW.getTime() + DAY).toISOString()
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  for (const [jobState, submissionKind] of [
    ['expired', 'renewal'],
    ['expired', 'repost'],
    ['closed', 'renewal'],
    ['closed', 'repost'],
  ]) {
    const { state, service } = createHarness({ jobState });
    const result = await service.submitFreeBetaJob(command({ submissionKind }));
    assert.strictEqual(result.submission.submissionKind, submissionKind);
    assert.strictEqual(state.job.publicationState, 'pending_review');
    assert.strictEqual(state.casCalls[0].releaseActiveFreeSlot, false);
  }
}

{
  const { state, service } = createHarness({
    usage: quotaUsage({
      rolling30Days: {
        used: 10,
        limit: 10,
        remaining: 0,
        nextSlotAt: new Date(NOW.getTime() + 2 * DAY),
      },
    }),
  });
  await expectCode(service.submitFreeBetaJob(command()), 'ROLLING_30D_LIMIT');
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  const first = await service.submitFreeBetaJob(command());
  const counts = {
    acknowledgements: state.acknowledgements.length,
    submissions: state.submissions.length,
    moderationEvents: state.moderationEvents.length,
    outboxIntents: state.outboxIntents.length,
  };
  const replay = await service.submitFreeBetaJob(command());
  assert.strictEqual(first.idempotentReplay, false);
  assert.strictEqual(replay.idempotentReplay, true);
  assert.strictEqual(replay.submission.id, first.submission.id);
  assert.strictEqual(state.acknowledgements.length, counts.acknowledgements);
  assert.strictEqual(state.submissions.length, counts.submissions);
  assert.strictEqual(state.moderationEvents.length, counts.moderationEvents);
  assert.strictEqual(state.outboxIntents.length, counts.outboxIntents);
}

{
  const { state, service } = createHarness({ jobState: 'rejected' });
  state.correctionContext = {
    previousSubmission: null,
    existingCycleSubmissions: [],
  };
  state.latestModerationEvent = null;
  await expectCode(
    service.submitFreeBetaJob(
      command({
        submissionKind: 'correction',
        correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
      })
    ),
    'CORRECTION_NOT_EXEMPT'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, calls, service } = createHarness({ jobState: 'rejected' });
  configureRequestedCorrection(state);
  state.correctionContext.previousSubmission.jobId = '507f1f77bcf86cd799439099';

  await expectCode(
    service.submitFreeBetaJob(
      command({
        submissionKind: 'correction',
        correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
      })
    ),
    'CORRECTION_NOT_EXEMPT'
  );
  assert.strictEqual(writeCount(state), 0);
  assert.strictEqual(state.job.publicationState, 'rejected');
  assert.strictEqual(calls.includes('quota:usage'), false);
}

{
  const { state, service } = createHarness();
  await service.submitFreeBetaJob(command());
  state.fingerprint = 'e'.repeat(64);
  await expectCode(
    service.submitFreeBetaJob(command()),
    'IDEMPOTENCY_KEY_REUSED'
  );
  assert.strictEqual(state.submissions.length, 1);
  assert.strictEqual(state.outboxIntents.length, 2);
}

{
  const { state, service } = createHarness();
  state.failureAt = 'outbox';
  await expectCode(service.submitFreeBetaJob(command()), 'TRANSACTION_FAILED');
  assert.strictEqual(writeCount(state), 0);
  assert.strictEqual(state.job.publicationState, 'draft');
  assert.strictEqual(state.job.publicationVersion, 0);
}

{
  const { state, service } = createHarness();
  state.failureAt = 'cas';
  await expectCode(
    service.submitFreeBetaJob(command()),
    'JOB_VERSION_CONFLICT'
  );
  assert.strictEqual(writeCount(state), 0);
  assert.strictEqual(state.job.publicationState, 'draft');
}

{
  const { state, service } = createHarness({ jobState: 'rejected' });
  const previousSnapshot = contentSnapshot();
  state.currentSnapshot = contentSnapshot({
    contentHash: 'b'.repeat(64),
    educationRequirement: 'Bachelor degree or equivalent experience',
  });
  state.correctionContext = {
    previousSubmission: {
      _id: PREVIOUS_SUBMISSION_ID,
      jobId: JOB_ID,
      state: 'rejected',
      reviewedAt: new Date(NOW.getTime() - DAY),
      moderationCycleId: MODERATION_CYCLE_ID,
      contentSnapshot: previousSnapshot,
    },
    existingCycleSubmissions: [],
  };
  state.latestModerationEvent = {
    submissionId: PREVIOUS_SUBMISSION_ID,
    action: 'changes_requested',
    requestedFieldPaths: ['educationRequirement'],
    metadata: { moderationCycleId: MODERATION_CYCLE_ID },
    createdAt: new Date(NOW.getTime() - DAY),
  };
  state.usage = quotaUsage({
    daily: {
      used: 1,
      limit: 1,
      remaining: 0,
      nextEligibleAt: new Date(NOW.getTime() + DAY),
    },
  });

  const result = await service.submitFreeBetaJob(
    command({
      submissionKind: 'correction',
      correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
    })
  );
  assert.strictEqual(result.submission.quotaCharged, false);
  assert.strictEqual(
    result.submission.quotaExemptionReason,
    'reviewer_requested_correction'
  );
  assert.strictEqual(result.submission.moderationCycleId, MODERATION_CYCLE_ID);
  assert.strictEqual(state.submissions[0].quotaSnapshot.after.daily.used, 1);
  assert.strictEqual(state.submissions.length, 1);
}

{
  const { state, calls, service } = createHarness({ jobState: 'rejected' });
  configureRequestedCorrection(state, { includeEventCycle: false });

  const result = await service.submitFreeBetaJob(
    command({
      submissionKind: 'correction',
      correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
    })
  );
  assert.strictEqual(result.submission.quotaCharged, true);
  assert.strictEqual(result.submission.quotaExemptionReason, null);
  assert.strictEqual(state.submissions[0].quotaCharged, true);
  assert.strictEqual(state.submissions[0].quotaExemptionReason, null);
  assert.strictEqual(state.submissions[0].submissionKind, 'correction');
  assert.strictEqual(calls.includes('quota:usage'), true);
  assert.strictEqual(state.job.publicationState, 'pending_review');
  assert.notStrictEqual(state.job.publicationState, 'active');
}

{
  const { state, calls, service } = createHarness({ jobState: 'rejected' });
  configureRequestedCorrection(state, {
    includeEventCycle: false,
    usage: quotaUsage({
      daily: {
        used: 1,
        limit: 1,
        remaining: 0,
        nextEligibleAt: new Date(NOW.getTime() + DAY),
      },
    }),
  });

  await expectCode(
    service.submitFreeBetaJob(
      command({
        submissionKind: 'correction',
        correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
      })
    ),
    'ROLLING_24H_LIMIT'
  );
  assert.strictEqual(writeCount(state), 0);
  assert.strictEqual(state.job.publicationState, 'rejected');
  assert.strictEqual(calls.includes('quota:usage'), true);
}

{
  const { state, calls, service } = createHarness({ jobState: 'rejected' });
  configureRequestedCorrection(state, {
    includeEventCycle: false,
    usage: quotaUsage({
      rolling30Days: {
        used: 10,
        limit: 10,
        remaining: 0,
        nextSlotAt: new Date(NOW.getTime() + 2 * DAY),
      },
    }),
  });

  await expectCode(
    service.submitFreeBetaJob(
      command({
        submissionKind: 'correction',
        correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
      })
    ),
    'ROLLING_30D_LIMIT'
  );
  assert.strictEqual(writeCount(state), 0);
  assert.strictEqual(state.job.publicationState, 'rejected');
  assert.strictEqual(calls.includes('quota:usage'), true);
}

{
  const { state, calls, service } = createHarness({ jobState: 'rejected' });
  configureRequestedCorrection(state, {
    eventCycleId: '507f1f77bcf86cd799439099',
  });

  const result = await service.submitFreeBetaJob(
    command({
      submissionKind: 'correction',
      correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
    })
  );
  assert.strictEqual(result.submission.quotaCharged, true);
  assert.strictEqual(result.submission.quotaExemptionReason, null);
  assert.strictEqual(state.submissions[0].submissionKind, 'correction');
  assert.strictEqual(calls.includes('quota:usage'), true);
  assert.strictEqual(state.job.publicationState, 'pending_review');
}

{
  const { state, service } = createHarness({ jobState: 'rejected' });
  const previousSnapshot = contentSnapshot();
  state.currentSnapshot = contentSnapshot({
    contentHash: 'd'.repeat(64),
    title: 'Different Vacancy',
  });
  state.correctionContext = {
    previousSubmission: {
      _id: PREVIOUS_SUBMISSION_ID,
      jobId: JOB_ID,
      state: 'rejected',
      reviewedAt: new Date(NOW.getTime() - DAY),
      moderationCycleId: MODERATION_CYCLE_ID,
      contentSnapshot: previousSnapshot,
    },
    existingCycleSubmissions: [],
  };
  state.latestModerationEvent = {
    submissionId: PREVIOUS_SUBMISSION_ID,
    action: 'changes_requested',
    requestedFieldPaths: ['title'],
    metadata: { moderationCycleId: MODERATION_CYCLE_ID },
    createdAt: new Date(NOW.getTime() - DAY),
  };
  state.usage = quotaUsage({
    daily: {
      used: 1,
      limit: 1,
      remaining: 0,
      nextEligibleAt: new Date(NOW.getTime() + DAY),
    },
  });

  await expectCode(
    service.submitFreeBetaJob(
      command({
        submissionKind: 'correction',
        correctionOfSubmissionId: PREVIOUS_SUBMISSION_ID,
      })
    ),
    'ROLLING_24H_LIMIT'
  );
  assert.strictEqual(writeCount(state), 0);
  assert.strictEqual(state.job.publicationState, 'rejected');
}

{
  const { state, service } = createHarness({ jobState: 'active' });
  const result = await service.submitFreeBetaJob(
    command({ submissionKind: 'major_edit' })
  );
  assert.strictEqual(state.casCalls[0].releaseActiveFreeSlot, true);
  assert.strictEqual(result.usage.activeFreeJobs.used, 4);
  assert.strictEqual(
    state.moderationEvents[0].metadata.projectedActiveFreeJobs,
    4
  );
  assert.strictEqual(state.moderationEvents[0].metadata.slotsReleased, 1);
  assert.strictEqual(state.job.publicationState, 'pending_review');
}

{
  const { state, service } = createHarness({ jobState: 'active' });
  state.failureAt = 'outbox';
  await expectCode(
    service.submitFreeBetaJob(command({ submissionKind: 'major_edit' })),
    'TRANSACTION_FAILED'
  );
  assert.strictEqual(state.job.publicationState, 'active');
  assert.strictEqual(state.job.publicationVersion, 0);
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness({ jobState: 'pending_review' });
  await expectCode(
    service.submitFreeBetaJob(command()),
    'SUBMISSION_ALREADY_PENDING'
  );
  assert.strictEqual(writeCount(state), 0);
}

for (const forbidden of [
  { planCode: 'premium' },
  { publicationState: 'active' },
  { quotaOwnerId: OTHER_EMPLOYER_ID },
  { employerId: OTHER_EMPLOYER_ID },
  { paymentId: 'synthetic-payment' },
  { request: { body: 'not-allowed' } },
]) {
  const { state, service } = createHarness();
  await expectCode(
    service.submitFreeBetaJob(command(forbidden)),
    'INVALID_SUBMISSION_COMMAND'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  await expectCode(
    service.submitFreeBetaJob(
      command({
        postingRules: {
          accepted: true,
          version: 'employer-rules-2026-01',
          sourceIpHash: 'not-client-controlled',
        },
      })
    ),
    'INVALID_SUBMISSION_COMMAND'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  await expectCode(
    service.submitFreeBetaJob(
      command({
        postingRules: {
          accepted: false,
          version: 'employer-rules-2026-01',
        },
      })
    ),
    'POSTING_RULES_NOT_ACCEPTED'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  await expectCode(
    service.submitFreeBetaJob(command({ idempotencyKey: 'short' })),
    'INVALID_IDEMPOTENCY_KEY'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness();
  state.casCode = 'SUBMISSION_ALREADY_PENDING';
  await expectCode(
    service.submitFreeBetaJob(command()),
    'SUBMISSION_ALREADY_PENDING'
  );
  assert.strictEqual(writeCount(state), 0);
}

{
  const { state, service } = createHarness({ jobState: 'closed' });
  await expectCode(
    service.submitFreeBetaJob(command({ submissionKind: 'initial' })),
    'JOB_STATE_NOT_SUBMITTABLE'
  );
  assert.strictEqual(writeCount(state), 0);
}

const serviceSource = readFileSync(
  new URL(
    '../services/publishing/TransactionalFreeBetaSubmissionService.js',
    import.meta.url
  ),
  'utf8'
);
assert.strictEqual(serviceSource.includes("from '../../models/Job.js'"), false);
assert.strictEqual(serviceSource.includes('/controllers/'), false);
assert.strictEqual(serviceSource.includes('express'), false);
assert.strictEqual(serviceSource.includes('paymentService'), false);
assert.strictEqual(serviceSource.includes('paymentsController'), false);

console.log('transactionalFreeBetaSubmissionService tests passed.');
