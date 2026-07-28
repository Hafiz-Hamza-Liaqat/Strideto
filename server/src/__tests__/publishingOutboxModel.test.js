import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  PUBLISHING_OUTBOX_AGGREGATE_TYPE,
  PUBLISHING_OUTBOX_AUDIENCES,
  PUBLISHING_OUTBOX_BOUNDS,
  PUBLISHING_OUTBOX_FAILURE_CLASSIFICATIONS,
  PUBLISHING_OUTBOX_INTENT_TYPES,
  PUBLISHING_OUTBOX_LIFECYCLE_STATES,
  PUBLISHING_OUTBOX_SCHEMA_VERSION,
} from '../services/publishing/outbox/PublishingOutboxContracts.js';

let assertions = 0;
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
async function rejectsValidation(data, expectedPath) {
  const document = new PublishingOutboxIntent(data);
  await assert.rejects(document.validate(), (error) => {
    if (expectedPath) {
      return Boolean(error?.errors?.[expectedPath]);
    }
    return error?.name === 'ValidationError';
  });
  assertions += 1;
}
function rejectsConstruction(data) {
  assert.throws(
    () => new PublishingOutboxIntent(data),
    (error) => error?.name === 'StrictModeError'
  );
  assertions += 1;
}

const readyStateBeforeImport = mongoose.connection.readyState;
const { PublishingOutboxIntent } =
  await import('../models/PublishingOutboxIntent.js');

const SUBMISSION_ID = '507f1f77bcf86cd799439011';
const JOB_ID = '507f1f77bcf86cd799439012';
const EMPLOYER_ID = '507f1f77bcf86cd799439013';
const NOW = new Date('2026-07-29T10:00:00.000Z');

function employerIntent(overrides = {}) {
  return {
    type: 'employer_submission_received',
    schemaVersion: 1,
    deduplicationKey: `${SUBMISSION_ID}:employer_submission_received`,
    aggregateType: 'job_publication_submission',
    aggregateId: SUBMISSION_ID,
    submissionId: SUBMISSION_ID,
    jobId: JOB_ID,
    employerId: EMPLOYER_ID,
    audience: 'employer',
    status: 'pending',
    availableAt: NOW,
    attempts: 0,
    ...overrides,
  };
}

function adminIntent(overrides = {}) {
  return {
    type: 'admin_job_review_requested',
    schemaVersion: 1,
    deduplicationKey: `${SUBMISSION_ID}:admin_job_review_requested`,
    aggregateType: 'job_publication_submission',
    aggregateId: SUBMISSION_ID,
    submissionId: SUBMISSION_ID,
    jobId: JOB_ID,
    audience: 'publishing_review_staff',
    status: 'pending',
    availableAt: NOW,
    attempts: 0,
    ...overrides,
  };
}

function failure(overrides = {}) {
  return {
    classification: 'RETRYABLE',
    code: 'SMTP_TIMEOUT',
    occurredAt: NOW,
    ...overrides,
  };
}

equal(readyStateBeforeImport, 0);
equal(mongoose.connection.readyState, 0);
equal(PublishingOutboxIntent.schema.options.strict, 'throw');
equal(PublishingOutboxIntent.schema.options.autoIndex, false);
equal(PublishingOutboxIntent.schema.options.autoCreate, false);
equal(PublishingOutboxIntent.schema.options.timestamps, true);

const mixedPaths = [];
PublishingOutboxIntent.schema.eachPath((path, schemaType) => {
  if (schemaType instanceof mongoose.Schema.Types.Mixed) mixedPaths.push(path);
});
deepEqual(mixedPaths, []);
equal(PublishingOutboxIntent.schema.path('metadata'), undefined);
equal(PublishingOutboxIntent.schema.path('payload'), undefined);
equal(PublishingOutboxIntent.schema.path('email'), undefined);
equal(PublishingOutboxIntent.schema.path('applicantId'), undefined);
equal(PublishingOutboxIntent.schema.path('password'), undefined);
equal(PublishingOutboxIntent.schema.path('token'), undefined);

deepEqual(
  PublishingOutboxIntent.schema.path('type').options.enum,
  PUBLISHING_OUTBOX_INTENT_TYPES
);
deepEqual(PUBLISHING_OUTBOX_INTENT_TYPES, [
  'employer_submission_received',
  'admin_job_review_requested',
]);
deepEqual(PublishingOutboxIntent.schema.path('schemaVersion').options.enum, [
  PUBLISHING_OUTBOX_SCHEMA_VERSION,
]);
equal(PUBLISHING_OUTBOX_SCHEMA_VERSION, 1);
deepEqual(PublishingOutboxIntent.schema.path('aggregateType').options.enum, [
  PUBLISHING_OUTBOX_AGGREGATE_TYPE,
]);
equal(PUBLISHING_OUTBOX_AGGREGATE_TYPE, 'job_publication_submission');
deepEqual(
  PublishingOutboxIntent.schema.path('audience').options.enum,
  PUBLISHING_OUTBOX_AUDIENCES
);
deepEqual(PUBLISHING_OUTBOX_AUDIENCES, ['employer', 'publishing_review_staff']);
deepEqual(
  PublishingOutboxIntent.schema.path('status').options.enum,
  PUBLISHING_OUTBOX_LIFECYCLE_STATES
);
deepEqual(PUBLISHING_OUTBOX_LIFECYCLE_STATES, [
  'pending',
  'processing',
  'processed',
  'retryable_failed',
  'terminal_failed',
]);
deepEqual(
  PublishingOutboxIntent.schema
    .path('lastFailure')
    .schema.path('classification').options.enum,
  PUBLISHING_OUTBOX_FAILURE_CLASSIFICATIONS
);
deepEqual(PUBLISHING_OUTBOX_FAILURE_CLASSIFICATIONS, [
  'RETRYABLE',
  'TERMINAL',
  'UNKNOWN',
]);

await new PublishingOutboxIntent(employerIntent()).validate();
assertions += 1;
await rejectsValidation(
  employerIntent({ employerId: undefined }),
  'employerId'
);
await rejectsValidation(
  employerIntent({ audience: 'publishing_review_staff' }),
  'audience'
);
await new PublishingOutboxIntent(adminIntent()).validate();
assertions += 1;
await rejectsValidation(adminIntent({ employerId: EMPLOYER_ID }), 'employerId');
await rejectsValidation(adminIntent({ audience: 'employer' }), 'audience');
await rejectsValidation(
  employerIntent({ submissionId: '507f1f77bcf86cd799439099' }),
  'submissionId'
);
await new PublishingOutboxIntent(
  employerIntent({
    deduplicationKey: `${SUBMISSION_ID}:employer_submission_received`,
  })
).validate();
assertions += 1;
await rejectsValidation(
  employerIntent({ deduplicationKey: `${SUBMISSION_ID}:wrong` }),
  'deduplicationKey'
);
await rejectsValidation(
  employerIntent({
    deduplicationKey: `${SUBMISSION_ID}:employer_submission_received\n`,
  }),
  'deduplicationKey'
);
await rejectsValidation(
  employerIntent({ deduplicationKey: 'x'.repeat(161) }),
  'deduplicationKey'
);

rejectsConstruction({ ...employerIntent(), applicantId: EMPLOYER_ID });
rejectsConstruction({ ...employerIntent(), recipientEmail: 'private@test' });
rejectsConstruction({ ...employerIntent(), rawError: 'private failure' });
rejectsConstruction({ ...employerIntent(), payload: { arbitrary: true } });
rejectsConstruction({ ...employerIntent(), metadata: { arbitrary: true } });
rejectsConstruction({ ...employerIntent(), request: { headers: {} } });
rejectsConstruction({ ...employerIntent(), authorization: 'secret' });
rejectsConstruction({ ...employerIntent(), paymentId: 'payment' });

await new PublishingOutboxIntent(employerIntent()).validate();
assertions += 1;
await rejectsValidation(employerIntent({ attempts: 1 }), 'attempts');
await rejectsValidation(
  employerIntent({
    leaseOwner: 'worker-1',
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  }),
  'leaseOwner'
);
await rejectsValidation(
  employerIntent({ lastFailure: failure() }),
  'lastFailure'
);
await rejectsValidation(employerIntent({ processedAt: NOW }), 'processedAt');
await rejectsValidation(
  employerIntent({ terminalFailedAt: NOW }),
  'terminalFailedAt'
);

await new PublishingOutboxIntent(
  employerIntent({
    status: 'processing',
    attempts: 1,
    leaseOwner: 'worker-1',
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  })
).validate();
assertions += 1;
await rejectsValidation(
  employerIntent({
    status: 'processing',
    attempts: 1,
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  }),
  'leaseOwner'
);
await rejectsValidation(
  employerIntent({
    status: 'processing',
    attempts: 1,
    leaseOwner: 'worker-1',
  }),
  'leaseExpiresAt'
);
await rejectsValidation(
  employerIntent({
    status: 'processing',
    attempts: 0,
    leaseOwner: 'worker-1',
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  }),
  'attempts'
);

await new PublishingOutboxIntent(
  employerIntent({
    status: 'retryable_failed',
    attempts: 1,
    lastFailure: failure(),
    availableAt: new Date(NOW.getTime() + 60_000),
  })
).validate();
assertions += 1;
await rejectsValidation(
  employerIntent({ status: 'retryable_failed', attempts: 1 }),
  'lastFailure'
);
await rejectsValidation(
  employerIntent({
    status: 'retryable_failed',
    attempts: 1,
    lastFailure: failure(),
    leaseOwner: 'worker-1',
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  }),
  'leaseOwner'
);

await new PublishingOutboxIntent(
  employerIntent({ status: 'processed', attempts: 1, processedAt: NOW })
).validate();
assertions += 1;
await rejectsValidation(
  employerIntent({ status: 'processed', attempts: 1 }),
  'processedAt'
);
await rejectsValidation(
  employerIntent({
    status: 'processed',
    attempts: 1,
    processedAt: NOW,
    leaseOwner: 'worker-1',
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  }),
  'leaseOwner'
);

await new PublishingOutboxIntent(
  employerIntent({
    status: 'terminal_failed',
    attempts: 1,
    lastFailure: failure({ classification: 'TERMINAL' }),
    terminalFailedAt: NOW,
  })
).validate();
assertions += 1;
await rejectsValidation(
  employerIntent({
    status: 'terminal_failed',
    attempts: 1,
    lastFailure: failure({ classification: 'TERMINAL' }),
  }),
  'terminalFailedAt'
);
await rejectsValidation(
  employerIntent({
    status: 'terminal_failed',
    attempts: 1,
    terminalFailedAt: NOW,
  }),
  'lastFailure'
);
await rejectsValidation(
  employerIntent({
    status: 'processed',
    attempts: 1,
    processedAt: NOW,
    terminalFailedAt: NOW,
  }),
  'terminalFailedAt'
);
await rejectsValidation(
  employerIntent({ leaseOwner: 'worker-1' }),
  'leaseExpiresAt'
);
await rejectsValidation(
  employerIntent({ leaseExpiresAt: new Date(NOW.getTime() + 60_000) }),
  'leaseOwner'
);
await rejectsValidation(
  employerIntent({ availableAt: 'not-a-date' }),
  'availableAt'
);
await rejectsValidation(
  employerIntent({
    status: 'processing',
    attempts: 1,
    leaseOwner: 'worker-1',
    leaseExpiresAt: 'not-a-date',
  }),
  'leaseExpiresAt'
);
await rejectsValidation(employerIntent({ attempts: 0.5 }), 'attempts');
await rejectsValidation(employerIntent({ attempts: -1 }), 'attempts');
await rejectsValidation(
  employerIntent({ status: 'processing', attempts: 9 }),
  'attempts'
);
await rejectsValidation(
  employerIntent({
    status: 'retryable_failed',
    attempts: 1,
    lastFailure: failure({ code: 'X'.repeat(81) }),
  }),
  'lastFailure.code'
);
await rejectsValidation(
  {
    ...employerIntent({
      status: 'retryable_failed',
      attempts: 1,
    }),
    lastFailure: { ...failure(), providerResponse: 'private' },
  },
  'lastFailure'
);
await rejectsValidation(
  {
    ...employerIntent({
      status: 'retryable_failed',
      attempts: 1,
    }),
    lastFailure: { ...failure(), stack: 'private' },
  },
  'lastFailure'
);

const indexes = PublishingOutboxIntent.schema.indexes();
equal(indexes.length, 7);
const deduplicationIndex = indexes.find(
  ([fields]) => fields.deduplicationKey === 1
);
check(deduplicationIndex);
equal(deduplicationIndex[1].unique, true);
equal(deduplicationIndex[1].sparse, false);
equal(deduplicationIndex[1].name, 'publishing_outbox_deduplication_unique');
deepEqual(indexes[1][0], {
  status: 1,
  availableAt: 1,
  createdAt: 1,
  _id: 1,
});
deepEqual(indexes[1][1].partialFilterExpression, {
  status: { $in: ['pending', 'retryable_failed'] },
});
deepEqual(indexes[2][0], {
  status: 1,
  leaseExpiresAt: 1,
  _id: 1,
});
deepEqual(indexes[2][1].partialFilterExpression, {
  status: 'processing',
});
deepEqual(indexes[3][0], { submissionId: 1, createdAt: 1 });
deepEqual(indexes[4][0], {
  aggregateType: 1,
  aggregateId: 1,
  createdAt: -1,
});
deepEqual(indexes[5][0], { status: 1, processedAt: -1 });
deepEqual(indexes[5][1].partialFilterExpression, { status: 'processed' });
deepEqual(indexes[6][0], { status: 1, terminalFailedAt: -1 });
deepEqual(indexes[6][1].partialFilterExpression, {
  status: 'terminal_failed',
});
equal(
  indexes.some(([, options]) => options?.expireAfterSeconds !== undefined),
  false
);
equal(PublishingOutboxIntent.schema.path('purgeAt'), undefined);
equal(PublishingOutboxIntent.schema.statics.claim, undefined);
equal(PublishingOutboxIntent.schema.statics.process, undefined);
equal(PublishingOutboxIntent.schema.statics.deliver, undefined);
equal(PublishingOutboxIntent.schema.methods.deliver, undefined);
equal(PUBLISHING_OUTBOX_BOUNDS.maximumAttempts, 8);
equal(PUBLISHING_OUTBOX_BOUNDS.deduplicationKeyMaxLength, 160);
equal(PUBLISHING_OUTBOX_BOUNDS.leaseOwnerMaxLength, 128);
equal(PUBLISHING_OUTBOX_BOUNDS.failureCodeMaxLength, 80);
equal(mongoose.connection.readyState, 0);

console.log(`publishingOutboxModel tests passed (${assertions} assertions).`);
