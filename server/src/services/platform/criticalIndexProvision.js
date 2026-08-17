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
import { GbsCaseDocumentRequirement } from '../../models/gbs/GbsCaseDocumentRequirement.js';
import { GbsCaseDocumentGrant } from '../../models/gbs/GbsCaseDocumentGrant.js';
import { GbsDocumentScanJob } from '../../models/gbs/GbsDocumentScanJob.js';
import { GbsCaseFilingAuthorization } from '../../models/gbs/GbsCaseFilingAuthorization.js';
import { GbsExternalFilingSubmission } from '../../models/gbs/GbsExternalFilingSubmission.js';
import { IdempotencyRecord } from '../../models/platform/IdempotencyRecord.js';
import { AgentEducationMarketplaceFreeEntitlement } from '../../models/agent/AgentEducationMarketplaceFreeEntitlement.js';
import { ProfessionalCaseApplication } from '../../models/case/ProfessionalCaseApplication.js';
import { ProfessionalReview } from '../../models/trust/ProfessionalReview.js';
import { ProfessionalDispute } from '../../models/trust/ProfessionalDispute.js';
import { GbsContextThread } from '../../models/gbs/GbsContextThread.js';
import { GbsContextMessage } from '../../models/gbs/GbsContextMessage.js';
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

export const GBS_CASE_DOCUMENT_REQUIREMENT_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_case_doc_req_public_ref_unique',
    key: Object.freeze({ publicRequirementRef: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_case_doc_req_case_key_unique',
    key: Object.freeze({ caseId: 1, requirementKey: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_case_doc_req_case_status',
    key: Object.freeze({ caseId: 1, status: 1 }),
  }),
  Object.freeze({
    name: 'gbs_case_doc_req_requester',
    key: Object.freeze({ requesterUserId: 1, createdAt: -1 }),
  }),
]);

export const GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_scan_job_version_checksum_unique',
    key: Object.freeze({ vaultDocumentVersionId: 1, checksumSha256: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_scan_job_status_available',
    key: Object.freeze({ status: 1, availableAt: 1 }),
  }),
  Object.freeze({
    name: 'gbs_scan_job_lease_expiry',
    key: Object.freeze({ leaseExpiresAt: 1 }),
  }),
  Object.freeze({
    name: 'gbs_scan_job_created',
    key: Object.freeze({ createdAt: 1 }),
  }),
  Object.freeze({
    name: 'gbs_scan_job_public_ref_unique',
    key: Object.freeze({ publicJobRef: 1 }),
    unique: true,
  }),
]);

export const GBS_CASE_DOCUMENT_GRANT_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_case_doc_grant_version_subject_unique',
    key: Object.freeze({ requirementId: 1, vaultVersionId: 1, granteeSubjectId: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_case_doc_grant_case_status',
    key: Object.freeze({ caseId: 1, status: 1 }),
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

export const GBS_FILING_AUTHORIZATION_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_filing_auth_public_ref_unique',
    key: Object.freeze({ publicAuthorizationRef: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_filing_auth_case_history',
    key: Object.freeze({ caseId: 1, createdAt: -1 }),
  }),
  Object.freeze({
    name: 'gbs_filing_auth_provider_case',
    key: Object.freeze({ providerSubjectType: 1, providerSubjectId: 1, caseId: 1 }),
  }),
  Object.freeze({
    name: 'gbs_filing_auth_effective_unique',
    key: Object.freeze({
      caseId: 1,
      providerSubjectType: 1,
      providerSubjectId: 1,
      packId: 1,
      packVersion: 1,
      sourceSnapshotHash: 1,
      purpose: 1,
    }),
    unique: true,
    partialFilterExpression: Object.freeze({
      status: { $in: ['active', 'claimed_for_submission', 'used'] },
    }),
  }),
  Object.freeze({
    name: 'gbs_filing_auth_case_status',
    key: Object.freeze({ caseId: 1, status: 1 }),
  }),
  Object.freeze({
    name: 'gbs_filing_auth_claim_ref_unique',
    key: Object.freeze({ claimRef: 1 }),
    unique: true,
    sparse: true,
  }),
]);

export const GBS_EXTERNAL_FILING_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'gbs_ext_filing_public_ref_unique',
    key: Object.freeze({ publicSubmissionRef: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_ext_filing_authorization_unique',
    key: Object.freeze({ authorizationId: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'gbs_ext_filing_case_auth',
    key: Object.freeze({ caseId: 1, authorizationId: 1 }),
  }),
  Object.freeze({
    name: 'gbs_ext_filing_provider_case',
    key: Object.freeze({ providerSubjectType: 1, providerSubjectId: 1, caseId: 1 }),
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

export const EDU_MARKETPLACE_FREE_ENTITLEMENT_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'edu_marketplace_free_entitlement_subject_unique',
    key: Object.freeze({
      providerSubjectType: 1,
      providerSubjectId: 1,
      domainId: 1,
    }),
    unique: true,
  }),
  Object.freeze({
    name: 'edu_marketplace_free_entitlement_org_status',
    key: Object.freeze({ organizationId: 1, status: 1 }),
  }),
]);

export const GBS_CONTEXT_THREAD_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({ name: 'gbs_message_thread_context_unique', key: Object.freeze({ contextType: 1, contextId: 1 }), unique: true }),
  Object.freeze({ name: 'gbs_message_thread_customer_inbox', key: Object.freeze({ requesterUserId: 1, lastMessageAt: -1 }) }),
  Object.freeze({ name: 'gbs_message_thread_provider_inbox', key: Object.freeze({ providerSubjectType: 1, providerSubjectId: 1, lastMessageAt: -1 }) }),
]);

export const GBS_CONTEXT_MESSAGE_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({ name: 'gbs_context_message_thread_created', key: Object.freeze({ threadId: 1, createdAt: -1, _id: -1 }) }),
]);

export const EDUCATION_CASE_APPLICATION_CRITICAL_INDEXES = Object.freeze([
  Object.freeze({
    name: 'education_case_application_case_created',
    key: Object.freeze({ caseId: 1, createdAt: -1 }),
  }),
  Object.freeze({
    name: 'education_case_application_case_status_deadline',
    key: Object.freeze({ caseId: 1, status: 1, deadlineAt: 1 }),
  }),
  Object.freeze({
    name: 'education_case_application_command_unique',
    key: Object.freeze({ caseId: 1, creationCommandId: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({ creationCommandId: { $type: 'string' } }),
  }),
]);

export const PROFESSIONAL_TRUST_CRITICAL_INDEXES = Object.freeze({
  reviews: Object.freeze([
    Object.freeze({
      name: 'studentUserId_1_interactionType_1_interactionId_1',
      key: Object.freeze({ studentUserId: 1, interactionType: 1, interactionId: 1 }),
      unique: true,
    }),
  ]),
  disputes: Object.freeze([
    Object.freeze({
      name: 'studentUserId_1_contextType_1_contextId_1',
      key: Object.freeze({ studentUserId: 1, contextType: 1, contextId: 1 }),
      unique: true,
    }),
  ]),
});

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
  caseDocumentRequirementCollection = GbsCaseDocumentRequirement.collection,
  caseDocumentGrantCollection = GbsCaseDocumentGrant.collection,
  scanJobCollection = GbsDocumentScanJob.collection,
  filingAuthorizationCollection = GbsCaseFilingAuthorization.collection,
  externalFilingCollection = GbsExternalFilingSubmission.collection,
  idempotencyCollection = IdempotencyRecord.collection,
  educationFreeEntitlementCollection = AgentEducationMarketplaceFreeEntitlement.collection,
  educationCaseApplicationCollection = ProfessionalCaseApplication.collection,
  professionalReviewCollection = ProfessionalReview.collection,
  professionalDisputeCollection = ProfessionalDispute.collection,
  gbsContextThreadCollection = GbsContextThread.collection,
  gbsContextMessageCollection = GbsContextMessage.collection,
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
  const caseDocuments = await provisionMissingIndexes({
    collection: caseDocumentRequirementCollection,
    expected: GBS_CASE_DOCUMENT_REQUIREMENT_CRITICAL_INDEXES,
  });
  const caseDocumentGrants = await provisionMissingIndexes({
    collection: caseDocumentGrantCollection,
    expected: GBS_CASE_DOCUMENT_GRANT_CRITICAL_INDEXES,
  });
  const scanJobs = await provisionMissingIndexes({
    collection: scanJobCollection,
    expected: GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES,
  });
  const filingAuthorizations = await provisionMissingIndexes({
    collection: filingAuthorizationCollection,
    expected: GBS_FILING_AUTHORIZATION_CRITICAL_INDEXES,
  });
  const externalFilings = await provisionMissingIndexes({
    collection: externalFilingCollection,
    expected: GBS_EXTERNAL_FILING_CRITICAL_INDEXES,
  });
  const idempotency = await provisionMissingIndexes({
    collection: idempotencyCollection,
    expected: IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  });
  const educationFreeEntitlement = await provisionMissingIndexes({
    collection: educationFreeEntitlementCollection,
    expected: EDU_MARKETPLACE_FREE_ENTITLEMENT_CRITICAL_INDEXES,
  });
  const educationCaseApplications = await provisionMissingIndexes({
    collection: educationCaseApplicationCollection,
    expected: EDUCATION_CASE_APPLICATION_CRITICAL_INDEXES,
  });
  const professionalReviews = await provisionMissingIndexes({
    collection: professionalReviewCollection,
    expected: PROFESSIONAL_TRUST_CRITICAL_INDEXES.reviews,
  });
  const professionalDisputes = await provisionMissingIndexes({
    collection: professionalDisputeCollection,
    expected: PROFESSIONAL_TRUST_CRITICAL_INDEXES.disputes,
  });
  const gbsContextThreads = await provisionMissingIndexes({
    collection: gbsContextThreadCollection,
    expected: GBS_CONTEXT_THREAD_CRITICAL_INDEXES,
  });
  const gbsContextMessages = await provisionMissingIndexes({
    collection: gbsContextMessageCollection,
    expected: GBS_CONTEXT_MESSAGE_CRITICAL_INDEXES,
  });
  logger.info('critical_index_provision_ready', {
    serviceRequestCreated: serviceRequest.created,
    quoteCreated: quote.created,
    caseCreated: gbsCase.created,
    caseDocumentCreated: caseDocuments.created,
    caseDocumentGrantCreated: caseDocumentGrants.created,
    scanJobCreated: scanJobs.created,
    filingAuthorizationCreated: filingAuthorizations.created,
    externalFilingCreated: externalFilings.created,
    idempotencyCreated: idempotency.created,
    educationFreeEntitlementCreated: educationFreeEntitlement.created,
    educationCaseApplicationCreated: educationCaseApplications.created,
    professionalReviewCreated: professionalReviews.created,
    professionalDisputeCreated: professionalDisputes.created,
    gbsContextThreadCreated: gbsContextThreads.created,
    gbsContextMessageCreated: gbsContextMessages.created,
  });
  return {
    serviceRequest,
    quote,
    case: gbsCase,
    caseDocuments,
    caseDocumentGrants,
    scanJobs,
    filingAuthorizations,
    externalFilings,
    idempotency,
    educationFreeEntitlement,
    educationCaseApplications,
    professionalReviews,
    professionalDisputes,
    gbsContextThreads,
    gbsContextMessages,
  };
}
