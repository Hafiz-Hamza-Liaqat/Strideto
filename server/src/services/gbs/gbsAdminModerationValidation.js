/**
 * Allowlisted Admin GBS moderation request parsing (Phase 17D-4).
 * No mass assignment. Unknown fields are rejected.
 */
import {
  GBS_PROVIDER_BOUNDS,
  isValidListingAdminReviewStatus,
  isValidProviderSubjectType,
  isValidProviderTrustStatus,
} from '../../../../shared/gbs/constants.js';
import { isValidListingModerationStatus } from '../../../../shared/gbs/serviceListing.js';
import { isKnownBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';

const REVIEW_BODY_KEYS = Object.freeze([
  'expectedVersion',
  'subjectType',
  'subjectId',
  'reason',
  'reasonCode',
]);

const CAPABILITY_QUEUE_KEYS = Object.freeze([
  'page',
  'limit',
  'sort',
  'order',
  'trustStatus',
  'capabilityId',
  'subjectType',
  'jurisdictionId',
]);

const LISTING_QUEUE_KEYS = Object.freeze([
  'page',
  'limit',
  'sort',
  'order',
  'adminReviewStatus',
  'moderationStatus',
  'capabilityId',
  'subjectType',
]);

const REASON_REQUIRED_ACTIONS = new Set([
  'needs-information',
  'reject',
  'suspend',
  'revoke',
]);

function deny(code, status = 400) {
  return Object.assign(new Error(code), { status, code });
}

function unknownKeys(source, allowed) {
  return Object.keys(source || {}).filter((key) => !allowed.includes(key));
}

export function parseBoundedPage(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    GBS_PROVIDER_BOUNDS.LIST_PAGE_MAX,
    Math.max(1, parseInt(query.limit, 10) || 20)
  );
  const sortKey = query.sort === 'createdAt' ? 'createdAt' : 'updatedAt';
  const order = query.order === 'asc' ? 1 : -1;
  return { page, limit, sort: { [sortKey]: order } };
}

export function parseCapabilityQueueQuery(query = {}) {
  const extra = unknownKeys(query, CAPABILITY_QUEUE_KEYS);
  if (extra.length) throw deny('unknown_query_field');
  const parsed = parseBoundedPage(query);
  const filter = {};
  if (query.trustStatus) {
    if (query.trustStatus !== 'all' && !isValidProviderTrustStatus(query.trustStatus)) {
      throw deny('invalid_trust_status');
    }
    if (query.trustStatus !== 'all') filter.trustStatus = query.trustStatus;
  } else {
    filter.trustStatus = { $in: ['claimed', 'evidence_submitted', 'evidence_backed'] };
  }
  if (query.capabilityId) {
    if (!isKnownBusinessServicesCapability(query.capabilityId)) throw deny('unknown_capability_id');
    filter.capabilityId = query.capabilityId;
  }
  if (query.subjectType) {
    if (!isValidProviderSubjectType(query.subjectType)) throw deny('invalid_subject_type');
    filter.subjectType = query.subjectType;
  }
  if (query.jurisdictionId) {
    const jurisdictionId = String(query.jurisdictionId).trim().slice(0, 80);
    if (!jurisdictionId) throw deny('invalid_jurisdiction_id');
    filter['scope.jurisdictionIds'] = jurisdictionId;
  }
  return { ...parsed, filter };
}

export function parseListingQueueQuery(query = {}) {
  const extra = unknownKeys(query, LISTING_QUEUE_KEYS);
  if (extra.length) throw deny('unknown_query_field');
  const parsed = parseBoundedPage(query);
  const filter = {};
  if (query.adminReviewStatus) {
    if (query.adminReviewStatus !== 'all' && !isValidListingAdminReviewStatus(query.adminReviewStatus)) {
      throw deny('invalid_admin_review_status');
    }
    if (query.adminReviewStatus !== 'all') filter.adminReviewStatus = query.adminReviewStatus;
  }
  if (query.moderationStatus) {
    if (query.moderationStatus !== 'all' && !isValidListingModerationStatus(query.moderationStatus)) {
      throw deny('invalid_moderation_status');
    }
    if (query.moderationStatus !== 'all') filter.moderationStatus = query.moderationStatus;
  }
  if (!query.adminReviewStatus && !query.moderationStatus) {
    filter.moderationStatus = { $in: ['under_review', 'needs_information'] };
  }
  if (query.capabilityId) {
    if (!isKnownBusinessServicesCapability(query.capabilityId)) throw deny('unknown_capability_id');
    filter.capabilityId = query.capabilityId;
  }
  if (query.subjectType) {
    if (!isValidProviderSubjectType(query.subjectType)) throw deny('invalid_subject_type');
    filter.subjectType = query.subjectType;
  }
  return { ...parsed, filter };
}

export function parseAdminGbsReviewBody(body = {}, { action } = {}) {
  const extra = unknownKeys(body, REVIEW_BODY_KEYS);
  if (extra.length) throw deny('unknown_fields');
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw deny('expected_version_required');
  }
  if (!isValidProviderSubjectType(body.subjectType)) throw deny('invalid_subject_type');
  const subjectId = body.subjectId != null ? String(body.subjectId).trim() : '';
  if (!subjectId) throw deny('subject_id_required');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const reasonCode = typeof body.reasonCode === 'string' ? body.reasonCode.trim() : '';
  if (reason.length > GBS_PROVIDER_BOUNDS.NOTES_MAX) throw deny('reason_too_long');
  if (reasonCode.length > 80) throw deny('reason_code_too_long');
  if (REASON_REQUIRED_ACTIONS.has(action) && !reason && !reasonCode) {
    throw deny('review_reason_required');
  }
  return {
    expectedVersion,
    subjectType: body.subjectType,
    subjectId,
    reason,
    reasonCode: reasonCode || (reason ? 'staff_review' : ''),
  };
}
