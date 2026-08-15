import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../../shared/platform/optimisticConcurrency.js';

function invalidExpectedVersion(expectedVersion) {
  const expected = Number(expectedVersion);
  return !Number.isInteger(expected) || expected < 0;
}

function conflictError(currentVersion, expectedVersion) {
  return Object.assign(new Error('Conflict'), {
    status: 409,
    code: OPTIMISTIC_CONCURRENCY_CODE,
    currentVersion,
    expectedVersion,
  });
}

function notFoundError() {
  return Object.assign(new Error('ProviderCapability not found'), {
    status: 404,
    code: 'provider_capability_not_found',
  });
}

/**
 * Database-atomic ProviderCapability mutation.
 *
 * Compare-and-swap on `_id + recordVersion + subject predicates` in a single
 * findOneAndUpdate. Two replicas cannot both persist against the same version.
 *
 * Miss handling is scoped to the authorized subject. A second query never
 * looks up a document by id alone, so a wrong-tenant caller cannot distinguish
 * existence from authorization failure.
 */
export async function mutateProviderCapabilityRecord({
  id,
  expectedVersion,
  subjectType,
  subjectId,
  set = {},
  actor = {},
}) {
  if (!id || !subjectType || subjectId == null || subjectId === '') {
    throw Object.assign(new Error('ProviderCapability subject is required'), {
      status: 400,
      code: 'provider_capability_subject_required',
    });
  }
  if (invalidExpectedVersion(expectedVersion)) {
    throw Object.assign(new Error('expectedVersion is required'), {
      status: 400,
      code: 'expected_version_required',
    });
  }

  const expected = Number(expectedVersion);
  const $set = { ...set };
  delete $set.recordVersion;
  delete $set._id;
  delete $set.subjectType;
  delete $set.subjectId;

  const subjectFilter = {
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  };

  const updated = await ProviderCapability.findOneAndUpdate(
    { ...subjectFilter, recordVersion: expected },
    { $set, $inc: { recordVersion: 1 } },
    { new: true }
  );

  if (updated) return updated;

  const authorized = await ProviderCapability.findOne(subjectFilter).select('recordVersion').lean();
  if (authorized) {
    await logAudit({
      action: GBS_AUDIT_EVENTS.OPTIMISTIC_CONCURRENCY_CONFLICT,
      status: 'failure',
      targetType: 'ProviderCapability',
      targetId: String(id),
      metadata: redactAuditMetadata({
        expectedVersion: expected,
        currentVersion: authorized.recordVersion,
      }),
      actor,
    });
    throw conflictError(authorized.recordVersion, expected);
  }

  throw notFoundError();
}

export async function mutateGbsServiceListingRecord({
  id,
  expectedVersion,
  subjectType,
  subjectId,
  set = {},
  actor = {},
}) {
  if (!id || !subjectType || subjectId == null || subjectId === '') {
    throw Object.assign(new Error('listing subject is required'), {
      status: 400,
      code: 'listing_subject_required',
    });
  }
  if (invalidExpectedVersion(expectedVersion)) {
    throw Object.assign(new Error('expectedVersion is required'), {
      status: 400,
      code: 'expected_version_required',
    });
  }

  const expected = Number(expectedVersion);
  const $set = { ...set };
  delete $set.recordVersion;
  delete $set._id;
  delete $set.subjectType;
  delete $set.subjectId;
  delete $set.creationCommandId;
  delete $set.publicationStatus;
  delete $set.publicSlug;
  if (!actor?.isStaff) {
    if ($set.reviewedBy) delete $set.reviewedBy;
    if ($set.reviewedAt) delete $set.reviewedAt;
    if ($set.reviewReason) delete $set.reviewReason;
    if ($set.adminReviewStatus && $set.adminReviewStatus !== 'pending') {
      delete $set.adminReviewStatus;
    }
  }

  const subjectFilter = {
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  };

  const updated = await GbsServiceListing.findOneAndUpdate(
    { ...subjectFilter, recordVersion: expected },
    { $set, $inc: { recordVersion: 1 } },
    { new: true }
  );
  if (updated) return updated;

  const authorized = await GbsServiceListing.findOne(subjectFilter).select('recordVersion').lean();
  if (authorized) {
    await logAudit({
      action: GBS_AUDIT_EVENTS.OPTIMISTIC_CONCURRENCY_CONFLICT,
      status: 'failure',
      targetType: 'GbsServiceListing',
      targetId: String(id),
      metadata: redactAuditMetadata({
        expectedVersion: expected,
        currentVersion: authorized.recordVersion,
      }),
      actor,
    });
    throw conflictError(authorized.recordVersion, expected);
  }

  throw Object.assign(new Error('listing_not_found'), {
    status: 404,
    code: 'listing_not_found',
  });
}

export async function mutateGbsServiceRequestRecord({
  id,
  expectedVersion,
  ownershipFilter = {},
  set = {},
  actor = {},
}) {
  if (!id) {
    throw Object.assign(new Error('request id is required'), {
      status: 400,
      code: 'request_id_required',
    });
  }
  if (invalidExpectedVersion(expectedVersion)) {
    throw Object.assign(new Error('expectedVersion is required'), {
      status: 400,
      code: 'expected_version_required',
    });
  }

  const expected = Number(expectedVersion);
  const $set = { ...set };
  delete $set.recordVersion;
  delete $set._id;
  delete $set.requesterUserId;
  delete $set.listingId;
  delete $set.providerSubjectType;
  delete $set.providerSubjectId;
  delete $set.capabilityId;
  delete $set.creationCommandId;
  delete $set.publicRequestRef;

  const ownership = { _id: id, ...ownershipFilter };
  const updated = await GbsServiceRequest.findOneAndUpdate(
    { ...ownership, recordVersion: expected },
    { $set, $inc: { recordVersion: 1 } },
    { new: true }
  );
  if (updated) return updated;

  const authorized = await GbsServiceRequest.findOne(ownership).select('recordVersion').lean();
  if (authorized) {
    await logAudit({
      action: GBS_AUDIT_EVENTS.OPTIMISTIC_CONCURRENCY_CONFLICT,
      status: 'failure',
      targetType: 'GbsServiceRequest',
      targetId: String(id),
      metadata: redactAuditMetadata({
        expectedVersion: expected,
        currentVersion: authorized.recordVersion,
      }),
      actor,
    });
    throw conflictError(authorized.recordVersion, expected);
  }

  throw Object.assign(new Error('not_found'), {
    status: 404,
    code: 'not_found',
  });
}
