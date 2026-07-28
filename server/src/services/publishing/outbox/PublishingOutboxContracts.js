import mongoose from 'mongoose';

export const PUBLISHING_OUTBOX_INTENT_TYPES = Object.freeze([
  'employer_submission_received',
  'admin_job_review_requested',
]);

export const PUBLISHING_OUTBOX_SCHEMA_VERSION = 1;
export const PUBLISHING_OUTBOX_AGGREGATE_TYPE = 'job_publication_submission';

export const PUBLISHING_OUTBOX_AUDIENCES = Object.freeze([
  'employer',
  'publishing_review_staff',
]);

export const PUBLISHING_OUTBOX_LIFECYCLE_STATES = Object.freeze([
  'pending',
  'processing',
  'processed',
  'retryable_failed',
  'terminal_failed',
]);

export const PUBLISHING_OUTBOX_FAILURE_CLASSIFICATIONS = Object.freeze([
  'RETRYABLE',
  'TERMINAL',
  'UNKNOWN',
]);

export const PUBLISHING_OUTBOX_BOUNDS = Object.freeze({
  deduplicationKeyMaxLength: 160,
  leaseOwnerMaxLength: 128,
  failureCodeMaxLength: 80,
  maximumAttempts: 8,
});

export const PUBLISHING_OUTBOX_TYPE_CONTRACTS = Object.freeze({
  employer_submission_received: Object.freeze({
    audience: 'employer',
    requiredInputKeys: Object.freeze([
      'type',
      'deduplicationKey',
      'aggregateId',
      'jobId',
      'employerId',
    ]),
  }),
  admin_job_review_requested: Object.freeze({
    audience: 'publishing_review_staff',
    requiredInputKeys: Object.freeze([
      'type',
      'deduplicationKey',
      'aggregateId',
      'jobId',
    ]),
  }),
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'type',
  'deduplicationKey',
  'aggregateId',
  'jobId',
  'employerId',
]);
const FORBIDDEN_KEY_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

const SAFE_MESSAGES = Object.freeze({
  OUTBOX_CONTRACT_INVALID: 'The publishing outbox intent is invalid.',
  OUTBOX_TYPE_UNSUPPORTED: 'The publishing outbox intent type is unsupported.',
  OUTBOX_VERSION_UNSUPPORTED:
    'The publishing outbox schema version is unsupported.',
  OUTBOX_DEDUPLICATION_CONFLICT:
    'The publishing outbox intent conflicts with an existing intent.',
});

export class PublishingOutboxContractError extends Error {
  constructor(code, message = SAFE_MESSAGES[code]) {
    super(message || SAFE_MESSAGES.OUTBOX_CONTRACT_INVALID);
    this.name = 'PublishingOutboxContractError';
    this.code = Object.hasOwn(SAFE_MESSAGES, code)
      ? code
      : 'OUTBOX_CONTRACT_INVALID';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
    };
  }
}

function contractError(code = 'OUTBOX_CONTRACT_INVALID') {
  return new PublishingOutboxContractError(code);
}

function assertStrictPlainObject(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw contractError();
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw contractError();
    }
    if (
      FORBIDDEN_KEY_NAMES.has(key) ||
      key.includes('.') ||
      key.startsWith('$')
    ) {
      throw contractError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw contractError();
    }
  }
}

function normalizeObjectId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) {
    throw contractError();
  }
  return new mongoose.Types.ObjectId(String(value).toLowerCase());
}

function validateNow(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw contractError();
  }
  return new Date(now.getTime());
}

function validateDeduplicationKey(value, submissionId, intentType) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > PUBLISHING_OUTBOX_BOUNDS.deduplicationKeyMaxLength ||
    !PRINTABLE_ASCII.test(value) ||
    value !== value.trim()
  ) {
    throw contractError();
  }

  const expected = `${submissionId.toString()}:${intentType}`;
  if (value !== expected) {
    throw contractError();
  }
  return value;
}

export function mapPublishingOutboxIntent(input, { now } = {}) {
  assertStrictPlainObject(input);

  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_KEYS.includes(key)) {
      throw contractError();
    }
  }

  if (
    typeof input.type !== 'string' ||
    !PUBLISHING_OUTBOX_INTENT_TYPES.includes(input.type)
  ) {
    throw contractError('OUTBOX_TYPE_UNSUPPORTED');
  }

  const typeContract = PUBLISHING_OUTBOX_TYPE_CONTRACTS[input.type];
  const actualKeys = Object.keys(input).sort();
  const expectedKeys = [...typeContract.requiredInputKeys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw contractError();
  }

  const aggregateId = normalizeObjectId(input.aggregateId);
  const jobId = normalizeObjectId(input.jobId);
  const availableAt = validateNow(now);
  const document = {
    type: input.type,
    schemaVersion: PUBLISHING_OUTBOX_SCHEMA_VERSION,
    deduplicationKey: validateDeduplicationKey(
      input.deduplicationKey,
      aggregateId,
      input.type
    ),
    aggregateType: PUBLISHING_OUTBOX_AGGREGATE_TYPE,
    aggregateId,
    submissionId: new mongoose.Types.ObjectId(aggregateId.toString()),
    jobId,
    audience: typeContract.audience,
    status: 'pending',
    availableAt,
    attempts: 0,
  };

  if (input.type === 'employer_submission_received') {
    document.employerId = normalizeObjectId(input.employerId);
  }

  return document;
}

export function mapPublishingOutboxIntentBatch(intents, { now } = {}) {
  if (!Array.isArray(intents) || intents.length === 0) {
    throw contractError();
  }

  const mapped = intents.map((intent) =>
    mapPublishingOutboxIntent(intent, { now })
  );
  const keys = new Set();
  for (const document of mapped) {
    if (keys.has(document.deduplicationKey)) {
      throw contractError('OUTBOX_DEDUPLICATION_CONFLICT');
    }
    keys.add(document.deduplicationKey);
  }
  return mapped;
}
