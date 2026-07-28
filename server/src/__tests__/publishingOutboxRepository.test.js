import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import {
  mapPublishingOutboxIntent,
  PUBLISHING_OUTBOX_BOUNDS,
  PUBLISHING_OUTBOX_INTENT_TYPES,
  PUBLISHING_OUTBOX_SCHEMA_VERSION,
  PublishingOutboxContractError,
} from '../services/publishing/outbox/PublishingOutboxContracts.js';
import { createMongoosePublishingOutboxRepository } from '../services/publishing/outbox/MongoosePublishingOutboxRepository.js';

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
async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    return (
      error instanceof PublishingOutboxContractError && error.code === code
    );
  });
  assertions += 1;
}

const SUBMISSION_ID = '507f1f77bcf86cd799439011';
const JOB_ID = '507f1f77bcf86cd799439012';
const EMPLOYER_ID = '507f1f77bcf86cd799439013';
const NOW = new Date('2026-07-29T10:00:00.000Z');

function employerInput(overrides = {}) {
  return {
    type: 'employer_submission_received',
    deduplicationKey: `${SUBMISSION_ID}:employer_submission_received`,
    aggregateId: SUBMISSION_ID,
    employerId: EMPLOYER_ID,
    jobId: JOB_ID,
    ...overrides,
  };
}

function adminInput(overrides = {}) {
  return {
    type: 'admin_job_review_requested',
    deduplicationKey: `${SUBMISSION_ID}:admin_job_review_requested`,
    aggregateId: SUBMISSION_ID,
    jobId: JOB_ID,
    ...overrides,
  };
}

function transactionSession(overrides = {}) {
  return {
    hasEnded: false,
    inTransaction() {
      return true;
    },
    ...overrides,
  };
}

function harness({ createImplementation } = {}) {
  const calls = [];
  const model = {
    async create(documents, options) {
      calls.push({ operation: 'create', documents, options });
      if (createImplementation) {
        return createImplementation(documents, options);
      }
      return documents;
    },
  };
  const repository = createMongoosePublishingOutboxRepository({
    model,
    clock: () => new Date(NOW.getTime()),
  });
  return { calls, model, repository };
}

const readyStateBefore = mongoose.connection.readyState;
const firstHarness = harness();
equal(typeof firstHarness.repository.enqueueMany, 'function');
equal(readyStateBefore, 0);
equal(mongoose.connection.readyState, 0);

const validSession = transactionSession();
const acceptedInputs = [employerInput(), adminInput()];
const acceptedSnapshot = JSON.stringify(acceptedInputs);
const result = await firstHarness.repository.enqueueMany(acceptedInputs, {
  session: validSession,
});

equal(firstHarness.calls.length, 1);
equal(firstHarness.calls[0].operation, 'create');
equal(firstHarness.calls[0].options.session, validSession);
equal(firstHarness.calls[0].options.ordered, true);
equal(firstHarness.calls[0].documents.length, 2);
equal(result.insertedCount, 2);
deepEqual(Object.keys(result), ['insertedCount']);
equal(Object.isFrozen(result), true);
equal(JSON.stringify(acceptedInputs), acceptedSnapshot);
equal(firstHarness.calls[0].documents[0] === acceptedInputs[0], false);
equal(firstHarness.calls[0].documents[1] === acceptedInputs[1], false);

const employerDocument = firstHarness.calls[0].documents[0];
const adminDocument = firstHarness.calls[0].documents[1];
equal(employerDocument.type, 'employer_submission_received');
equal(employerDocument.schemaVersion, 1);
equal(employerDocument.aggregateType, 'job_publication_submission');
equal(employerDocument.aggregateId.toString(), SUBMISSION_ID);
equal(employerDocument.submissionId.toString(), SUBMISSION_ID);
equal(employerDocument.jobId.toString(), JOB_ID);
equal(employerDocument.employerId.toString(), EMPLOYER_ID);
equal(employerDocument.audience, 'employer');
equal(employerDocument.status, 'pending');
equal(employerDocument.attempts, 0);
equal(employerDocument.availableAt.toISOString(), NOW.toISOString());
equal(Object.hasOwn(employerDocument, 'lastFailure'), false);
equal(Object.hasOwn(employerDocument, 'leaseOwner'), false);
equal(Object.hasOwn(employerDocument, 'leaseExpiresAt'), false);
equal(Object.hasOwn(employerDocument, 'processedAt'), false);
equal(Object.hasOwn(employerDocument, 'terminalFailedAt'), false);
equal(Object.hasOwn(employerDocument, 'purgeAt'), false);
equal(adminDocument.type, 'admin_job_review_requested');
equal(adminDocument.schemaVersion, 1);
equal(adminDocument.aggregateType, 'job_publication_submission');
equal(adminDocument.submissionId.toString(), SUBMISSION_ID);
equal(adminDocument.jobId.toString(), JOB_ID);
equal(adminDocument.audience, 'publishing_review_staff');
equal(Object.hasOwn(adminDocument, 'employerId'), false);
equal(adminDocument.status, 'pending');
equal(adminDocument.attempts, 0);
equal(adminDocument.availableAt.toISOString(), NOW.toISOString());

const noWriteHarness = harness();
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany(undefined, {
      session: validSession,
    }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () => noWriteHarness.repository.enqueueMany([], { session: validSession }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () => noWriteHarness.repository.enqueueMany({}, { session: validSession }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () => noWriteHarness.repository.enqueueMany([employerInput()]),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([employerInput()], {
      session: null,
    }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([employerInput()], {
      session: { hasEnded: true, inTransaction: () => true },
    }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([employerInput()], {
      session: {},
    }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([employerInput()], {
      session: transactionSession({ inTransaction: () => false }),
    }),
  'OUTBOX_CONTRACT_INVALID'
);
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([employerInput()], {
      session: transactionSession({
        inTransaction() {
          throw new Error('session unavailable');
        },
      }),
    }),
  'OUTBOX_CONTRACT_INVALID'
);
equal(noWriteHarness.calls.length, 0);

const invalidCases = [
  employerInput({ metadata: {} }),
  employerInput({ recipientEmail: 'private@test' }),
  employerInput({ applicantId: EMPLOYER_ID }),
  employerInput({ paymentId: 'payment' }),
  employerInput({ request: { headers: {} } }),
  employerInput({ token: 'private' }),
  employerInput({ aggregateId: 'invalid-id' }),
  employerInput({ jobId: 'invalid-id' }),
  employerInput({ employerId: 'invalid-id' }),
  employerInput({ type: 'unsupported' }),
  employerInput({ deduplicationKey: `${SUBMISSION_ID}:wrong` }),
  adminInput({ employerId: EMPLOYER_ID }),
];
for (const intent of invalidCases) {
  await rejectsCode(
    () =>
      noWriteHarness.repository.enqueueMany([intent], {
        session: validSession,
      }),
    intent.type === 'unsupported'
      ? 'OUTBOX_TYPE_UNSUPPORTED'
      : 'OUTBOX_CONTRACT_INVALID'
  );
}
equal(noWriteHarness.calls.length, 0);

const accessorIntent = employerInput();
Object.defineProperty(accessorIntent, 'metadata', {
  enumerable: true,
  get() {
    return {};
  },
});
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([accessorIntent], {
      session: validSession,
    }),
  'OUTBOX_CONTRACT_INVALID'
);
const unsafePrototypeIntent = Object.create({ inherited: true });
Object.assign(unsafePrototypeIntent, employerInput());
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([unsafePrototypeIntent], {
      session: validSession,
    }),
  'OUTBOX_CONTRACT_INVALID'
);
const dottedKeyIntent = employerInput();
dottedKeyIntent['metadata.private'] = true;
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([dottedKeyIntent], {
      session: validSession,
    }),
  'OUTBOX_CONTRACT_INVALID'
);
const dollarKeyIntent = employerInput();
dollarKeyIntent.$metadata = true;
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([dollarKeyIntent], {
      session: validSession,
    }),
  'OUTBOX_CONTRACT_INVALID'
);
equal(noWriteHarness.calls.length, 0);

await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany([employerInput(), employerInput()], {
      session: validSession,
    }),
  'OUTBOX_DEDUPLICATION_CONFLICT'
);
equal(noWriteHarness.calls.length, 0);
await rejectsCode(
  () =>
    noWriteHarness.repository.enqueueMany(
      [employerInput(), adminInput({ jobId: 'invalid-id' })],
      { session: validSession }
    ),
  'OUTBOX_CONTRACT_INVALID'
);
equal(noWriteHarness.calls.length, 0);

const duplicateHarness = harness({
  createImplementation() {
    const error = new Error(
      'duplicate collection private_collection private-index key private-key'
    );
    error.code = 11000;
    throw error;
  },
});
await assert.rejects(
  duplicateHarness.repository.enqueueMany([employerInput()], {
    session: validSession,
  }),
  (error) => {
    equal(error.code, 'OUTBOX_DEDUPLICATION_CONFLICT');
    equal(error.message.includes('private-key'), false);
    equal(error.message.includes('private_collection'), false);
    equal(error.message.includes('private-index'), false);
    deepEqual(Object.keys(error.toJSON()).sort(), ['code', 'message']);
    return true;
  }
);
assertions += 1;
equal(duplicateHarness.calls.length, 1);

for (const name of ['ValidationError', 'CastError', 'StrictModeError']) {
  const validationHarness = harness({
    createImplementation() {
      const error = new Error('private persistence value');
      error.name = name;
      throw error;
    },
  });
  await rejectsCode(
    () =>
      validationHarness.repository.enqueueMany([employerInput()], {
        session: validSession,
      }),
    'OUTBOX_CONTRACT_INVALID'
  );
  equal(validationHarness.calls.length, 1);
}

const transientError = new Error('private transient driver detail');
transientError.errorLabels = ['TransientTransactionError'];
transientError.hasErrorLabel = (label) =>
  transientError.errorLabels.includes(label);
const transientHarness = harness({
  createImplementation() {
    throw transientError;
  },
});
await assert.rejects(
  transientHarness.repository.enqueueMany([employerInput()], {
    session: validSession,
  }),
  (error) => error === transientError
);
assertions += 1;
equal(transientError.hasErrorLabel('TransientTransactionError'), true);
equal(transientHarness.calls.length, 1);

const unknownError = new Error('private unknown persistence detail');
const unknownHarness = harness({
  createImplementation() {
    throw unknownError;
  },
});
await assert.rejects(
  unknownHarness.repository.enqueueMany([employerInput()], {
    session: validSession,
  }),
  (error) => error === unknownError
);
assertions += 1;
equal(unknownHarness.calls.length, 1);

const staged = [];
const rollbackHarness = harness({
  createImplementation(documents, options) {
    options.session.staged.push(...documents);
    return documents;
  },
});
const rollbackSession = transactionSession({ staged });
try {
  await rollbackHarness.repository.enqueueMany([employerInput()], {
    session: rollbackSession,
  });
  throw new Error('later transaction write failed');
} catch {
  rollbackSession.staged.length = 0;
}
equal(staged.length, 0);
equal(rollbackHarness.calls.length, 1);

const mapped = mapPublishingOutboxIntent(employerInput(), { now: NOW });
equal(mapped.schemaVersion, PUBLISHING_OUTBOX_SCHEMA_VERSION);
equal(mapped.type, PUBLISHING_OUTBOX_INTENT_TYPES[0]);
equal(mapped.deduplicationKey.length <= 160, true);
equal(PUBLISHING_OUTBOX_BOUNDS.deduplicationKeyMaxLength, 160);
equal(Object.hasOwn(mapped, 'planCode'), false);
equal(Object.hasOwn(mapped, 'freeBeta'), false);

assert.throws(
  () => createMongoosePublishingOutboxRepository({ model: {} }),
  TypeError
);
assertions += 1;
assert.throws(
  () =>
    createMongoosePublishingOutboxRepository({
      model: { create() {} },
      clock: null,
    }),
  TypeError
);
assertions += 1;

const repositorySource = readFileSync(
  new URL(
    '../services/publishing/outbox/MongoosePublishingOutboxRepository.js',
    import.meta.url
  ),
  'utf8'
);
for (const forbiddenImport of [
  'BackgroundJob',
  'jobQueueService',
  'queueLock',
  'emailService',
  'notificationService',
  'Notification.js',
  'UserNotification',
  '/controllers/',
  '/routes/',
  'worker.js',
  '/scheduler/',
  'payment',
  'webhook',
  'client/',
]) {
  equal(repositorySource.includes(forbiddenImport), false);
}
equal(repositorySource.includes('findOne'), false);
equal(repositorySource.includes('updateOne'), false);
equal(repositorySource.includes('findOneAndUpdate'), false);
equal(repositorySource.includes('upsert'), false);
equal(repositorySource.includes('deleteOne'), false);
equal(repositorySource.includes('.save('), false);
equal(repositorySource.includes('startSession'), false);
equal(repositorySource.includes('withTransaction'), false);
equal(repositorySource.includes('setTimeout'), false);
equal(repositorySource.includes('setInterval'), false);
equal(repositorySource.includes('.emit('), false);
equal(repositorySource.includes('console.'), false);
equal(repositorySource.includes('postCommit'), false);

const transactionServiceSource = readFileSync(
  new URL(
    '../services/publishing/TransactionalFreeBetaSubmissionService.js',
    import.meta.url
  ),
  'utf8'
);
check(
  transactionServiceSource.includes('await notificationOutbox.enqueueMany(')
);
check(transactionServiceSource.includes('{ session }'));
equal(
  transactionServiceSource.includes('MongoosePublishingOutboxRepository'),
  false
);
equal(mongoose.connection.readyState, 0);

console.log(
  `publishingOutboxRepository tests passed (${assertions} assertions).`
);
