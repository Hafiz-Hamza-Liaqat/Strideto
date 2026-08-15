/**
 * Create-only provisioning for critical uniqueness indexes.
 *
 * autoIndex remains off unless MONGO_AUTO_INDEX=1. This helper never
 * reconciles by dropping unknown indexes, never replaces an existing
 * index, and never rewrites documents. Concurrent api-a/api-b calls are
 * safe: identical createIndex specs are idempotent.
 */
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../../models/gbs/GbsQuote.js';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { IdempotencyRecord } from '../../models/platform/IdempotencyRecord.js';
import { logger } from '../../utils/logger.js';

export class CriticalIndexProvisionError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'CriticalIndexProvisionError';
    this.code = code;
    this.details = details;
  }
}

export const GBS_SERVICE_REQUEST_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_service_request_public_ref_unique',
    key: Object.freeze({ publicRequestRef: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_service_request_creation_command_unique',
    key: Object.freeze({ creationCommandId: 1 }),
    unique: true,
    sparse: true,
  }),
  Object.freeze({
    name: 'gbs_service_request_requester_created',
    key: Object.freeze({ requesterUserId: 1, createdAt: -1 }),
  }),
  Object.freeze({
    name: 'gbs_service_request_provider_inbox',
    key: Object.freeze({
      providerSubjectType: 1,
      providerSubjectId: 1,
      status: 1,
      createdAt: -1,
    }),
  }),
  Object.freeze({
    name: 'gbs_service_request_listing_created',
    key: Object.freeze({ listingId: 1, createdAt: -1 }),
  }),
]);

export const GBS_QUOTE_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_quote_public_ref_unique',
    key: Object.freeze({ publicQuoteRef: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_quote_creation_command_unique',
    key: Object.freeze({ creationCommandId: 1 }),
    unique: true,
    sparse: true,
  }),
  Object.freeze({
    name: 'gbs_quote_active_slot_unique',
    key: Object.freeze({ serviceRequestId: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({ status: { $in: ['draft', 'sent'] } }),
  }),
  Object.freeze({
    name: 'gbs_quote_requester_created',
    key: Object.freeze({ requesterUserId: 1, createdAt: -1 }),
  }),
  Object.freeze({
    name: 'gbs_quote_provider_inbox',
    key: Object.freeze({
      providerSubjectType: 1,
      providerSubjectId: 1,
      status: 1,
      createdAt: -1,
    }),
  }),
  Object.freeze({
    name: 'gbs_quote_status_expires',
    key: Object.freeze({ status: 1, expiresAt: 1 }),
  }),
]);

export const GBS_CASE_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_case_public_ref_unique',
    key: Object.freeze({ publicCaseRef: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_case_creation_command_unique',
    key: Object.freeze({ creationCommandId: 1 }),
    unique: true,
    sparse: true,
  }),
  Object.freeze({
    name: 'gbs_case_quote_unique',
    key: Object.freeze({ quoteId: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_case_requester_created',
    key: Object.freeze({ requesterUserId: 1, createdAt: -1 }),
  }),
  Object.freeze({
    name: 'gbs_case_provider_inbox',
    key: Object.freeze({
      providerSubjectType: 1,
      providerSubjectId: 1,
      status: 1,
      updatedAt: -1,
    }),
  }),
  Object.freeze({
    name: 'gbs_case_status_updated',
    key: Object.freeze({ status: 1, updatedAt: -1 }),
  }),
]);

export const IDEMPOTENCY_RECORD_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'idempotency_record_command_unique',
    key: Object.freeze({
      principalId: 1,
      tenantId: 1,
      commandType: 1,
      idempotencyKey: 1,
    }),
    unique: true,
  }),
  Object.freeze({
    name: 'idempotency_record_ttl',
    key: Object.freeze({ expiresAt: 1 }),
    expireAfterSeconds: 0,
  }),
]);

function sameKey(left = {}, right = {}) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function relevantOptions(index = {}) {
  const hasTtl = Object.prototype.hasOwnProperty.call(index, 'expireAfterSeconds')
    && index.expireAfterSeconds != null
    && index.expireAfterSeconds !== '';
  return {
    unique: index.unique === true,
    sparse: index.sparse === true,
    expireAfterSeconds: hasTtl ? Number(index.expireAfterSeconds) : null,
    partialFilterExpression: index.partialFilterExpression || null,
  };
}

function createIndexOptions(spec) {
  const options = { name: spec.name };
  if (spec.unique === true) options.unique = true;
  if (spec.sparse === true) options.sparse = true;
  if (Object.prototype.hasOwnProperty.call(spec, 'expireAfterSeconds')) {
    options.expireAfterSeconds = spec.expireAfterSeconds;
  }
  if (spec.partialFilterExpression) {
    options.partialFilterExpression = spec.partialFilterExpression;
  }
  return options;
}

export function compareCriticalIndexes(expected, actual = []) {
  const actualByName = new Map((actual || []).map((index) => [index.name, index]));
  const matched = [];
  const missing = [];
  const mismatched = [];

  for (const spec of expected) {
    const found = actualByName.get(spec.name);
    if (!found) {
      missing.push(spec);
      continue;
    }
    const differences = [];
    if (!sameKey(spec.key, found.key)) differences.push('key');
    const expectedOpts = relevantOptions(spec);
    const actualOpts = relevantOptions(found);
    if (expectedOpts.unique !== actualOpts.unique) differences.push('unique');
    if (expectedOpts.sparse !== actualOpts.sparse) differences.push('sparse');
    if (expectedOpts.expireAfterSeconds !== actualOpts.expireAfterSeconds) {
      differences.push('expireAfterSeconds');
    }
    if (!sameKey(expectedOpts.partialFilterExpression || {}, actualOpts.partialFilterExpression || {})) {
      differences.push('partialFilterExpression');
    }
    if (differences.length > 0) mismatched.push({ expected: spec, differences });
    else matched.push(spec);
  }

  return {
    ok: missing.length === 0 && mismatched.length === 0,
    matched,
    missing,
    mismatched,
    extra: (actual || []).filter(
      (index) => index.name !== '_id_' && !expected.some((spec) => spec.name === index.name)
    ),
  };
}

export function isNamespaceNotFoundError(error) {
  if (!error || typeof error !== 'object') return false;
  const candidates = [error, error.errorResponse, error.cause].filter(
    (candidate) => candidate && typeof candidate === 'object'
  );
  return candidates.some(
    (candidate) =>
      Number(candidate.code) === 26 ||
      candidate.code === 'NamespaceNotFound' ||
      candidate.codeName === 'NamespaceNotFound'
  );
}

function isBenignAlreadyExists(error) {
  if (!error || typeof error !== 'object') return false;
  const code = Number(error.code);
  const name = error.codeName || error.code;
  if (code === 85 || name === 'IndexOptionsConflict') return true;
  if (code === 86 || name === 'IndexKeySpecsConflict') return true;
  return typeof error.message === 'string' && /already exists/i.test(error.message);
}

function isDuplicateKeyOnBuild(error) {
  return Number(error?.code) === 11000 || error?.codeName === 'DuplicateKey';
}

export async function inspectIndexesSafely(readIndexes) {
  try {
    return { collectionExists: true, indexes: await readIndexes() };
  } catch (error) {
    if (!isNamespaceNotFoundError(error)) throw error;
    return { collectionExists: false, indexes: [] };
  }
}

export async function provisionMissingIndexes({
  collection,
  expected,
  createIndex = (key, options) => collection.createIndex(key, options),
  readIndexes = () => collection.indexes(),
} = {}) {
  if (!collection || !expected) {
    throw new CriticalIndexProvisionError('INDEX_PROVISION_ARGS_REQUIRED');
  }

  let inspection = await inspectIndexesSafely(readIndexes);
  let comparison = compareCriticalIndexes(expected, inspection.indexes);
  if (comparison.mismatched.length > 0) {
    throw new CriticalIndexProvisionError('MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW', {
      mismatched: comparison.mismatched,
    });
  }

  const created = [];
  for (const spec of comparison.missing) {
    try {
      await createIndex(spec.key, createIndexOptions(spec));
      created.push(spec.name);
    } catch (error) {
      if (isDuplicateKeyOnBuild(error)) {
        throw new CriticalIndexProvisionError('DUPLICATE_KEYS_BLOCK_UNIQUE_INDEX', {
          name: spec.name,
          message: error.message,
        });
      }
      if (!isBenignAlreadyExists(error)) throw error;
    }
  }

  inspection = await inspectIndexesSafely(readIndexes);
  comparison = compareCriticalIndexes(expected, inspection.indexes);
  if (!comparison.ok) {
    throw new CriticalIndexProvisionError(
      comparison.mismatched.length > 0
        ? 'MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW'
        : 'CRITICAL_INDEX_STILL_MISSING',
      { comparison }
    );
  }

  return { created, comparison, extra: comparison.extra };
}

export async function provisionCriticalIdempotencyIndexes({
  serviceRequestCollection = GbsServiceRequest.collection,
  quoteCollection = GbsQuote.collection,
  caseCollection = GbsCase.collection,
  idempotencyCollection = IdempotencyRecord.collection,
} = {}) {
  const serviceRequest = await provisionMissingIndexes({
    collection: serviceRequestCollection,
    expected: GBS_SERVICE_REQUEST_CRITICAL_INDEXES,
  });
  const quote = await provisionMissingIndexes({
    collection: quoteCollection,
    expected: GBS_QUOTE_CRITICAL_INDEXES,
  });
  const gbsCase = await provisionMissingIndexes({
    collection: caseCollection,
    expected: GBS_CASE_CRITICAL_INDEXES,
  });
  const idempotency = await provisionMissingIndexes({
    collection: idempotencyCollection,
    expected: IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  });
  logger.info('critical_index_provision_ready', {
    serviceRequestCreated: serviceRequest.created,
    quoteCreated: quote.created,
    caseCreated: gbsCase.created,
    idempotencyCreated: idempotency.created,
  });
  return { serviceRequest, quote, case: gbsCase, idempotency };
}
