/**
 * Staff-only GbsServiceListing review (Phase 17D-4).
 * Admin approval does not waive capability authority and never publishes.
 */
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
} from '../../../../shared/gbs/constants.js';
import { POLICY_ACTIONS } from '../../../../shared/capability/permissionPolicy.js';
import { authorizeGbsProviderAction, GBS_AUTHORITY_DENY_REASONS } from '../../../../shared/gbs/gbsProviderAuthority.js';
import { isKnownBusinessServicesCapability } from '../../../../shared/gbs/businessServicesCapabilities.js';
import { validateServiceListingRecord } from '../../../../shared/gbs/serviceListing.js';
import { evaluateListingPublicationGate } from '../../../../shared/gbs/listingPublicationGate.js';
import { AGENT_SERVICE_CATEGORIES } from '../../../../shared/agent/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { mutateGbsServiceListingRecord } from '../platform/optimisticConcurrency.js';
import { sameProviderSubject } from '../../../../shared/gbs/providerCapability.js';
import { assertExpectedVersion } from '../../../../shared/platform/optimisticConcurrency.js';

const APPROVE_FROM = new Set([
  GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
  GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
]);
const NEEDS_INFO_FROM = new Set([GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW]);
const REJECT_FROM = new Set([
  GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
  GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
]);
const SUSPEND_FROM = new Set([
  GBS_LISTING_MODERATION_STATUSES.APPROVED,
  GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
]);

function deny(code, status = 403) {
  return Object.assign(new Error(code), { status, code });
}

function staffActor(actor) {
  if (!actor?.isStaff) throw deny('staff_review_required');
}

function listingToRequested(value) {
  return {
    subjectType: value.subjectType,
    subjectId: value.subjectId,
    capabilityId: value.capabilityId,
    scope: value.scope,
  };
}

async function loadExact({ id, subjectType, subjectId }) {
  const record = await GbsServiceListing.findOne({
    _id: id,
    subjectType,
    subjectId: String(subjectId),
  }).lean();
  if (!record) throw deny('listing_not_found', 404);
  return record;
}

async function assertSameSubjectCapability(listing) {
  if (Object.values(AGENT_SERVICE_CATEGORIES).includes(listing.capabilityId)) {
    throw deny('gbs_listing_rejects_education_category', 400);
  }
  if (!isKnownBusinessServicesCapability(listing.capabilityId)) {
    throw deny('unknown_capability_id', 400);
  }
  const parsed = validateServiceListingRecord({
    ...listing,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
  });
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.errors[0] || 'invalid_listing'), {
      status: 400,
      code: 'invalid_listing',
      errors: parsed.errors,
    });
  }
  const capability = await ProviderCapability.findOne({
    subjectType: listing.subjectType,
    subjectId: String(listing.subjectId),
    capabilityId: listing.capabilityId,
  }).lean();
  if (!capability || !sameProviderSubject(listing, capability)) {
    throw deny('gbs_subject_mismatch', 403);
  }
  const decision = authorizeGbsProviderAction({
    requested: listingToRequested(parsed.value),
    capability,
  });
  if (!decision.allowed) {
    throw deny(decision.reason || GBS_AUTHORITY_DENY_REASONS.SCOPE_NOT_SUBSET, 403);
  }
  return capability;
}

async function applyReview({
  current,
  expectedVersion,
  actor,
  adminReviewStatus,
  moderationStatus,
  reason,
  auditAction,
}) {
  const updated = await mutateGbsServiceListingRecord({
    id: current._id,
    expectedVersion,
    subjectType: current.subjectType,
    subjectId: current.subjectId,
    actor,
    set: {
      adminReviewStatus,
      moderationStatus,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
      reviewedBy: String(actor.userId || actor.id || ''),
      reviewedAt: new Date(),
      reviewReason: reason || '',
    },
  });
  const metadata = redactAuditMetadata({
    subjectType: current.subjectType,
    subjectId: current.subjectId,
    capabilityId: current.capabilityId,
    fromModeration: current.moderationStatus,
    toModeration: moderationStatus,
    fromAdminReview: current.adminReviewStatus,
    toAdminReview: adminReviewStatus,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    recordVersion: updated.recordVersion,
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_LISTING_REVIEWED,
    targetType: 'GbsServiceListing',
    targetId: String(current._id),
    metadata,
  });
  await logAudit({
    actor,
    action: auditAction,
    targetType: 'GbsServiceListing',
    targetId: String(current._id),
    metadata,
    reason,
  });
  return updated;
}

function alreadyApplied(current, adminReviewStatus, moderationStatus, expectedVersion) {
  if (
    current.adminReviewStatus === adminReviewStatus &&
    current.moderationStatus === moderationStatus &&
    current.publicationStatus !== GBS_LISTING_PUBLICATION_STATUSES.PUBLIC
  ) {
    assertExpectedVersion(current.recordVersion, expectedVersion);
    return true;
  }
  return false;
}

export const listingReviewPolicyAction = POLICY_ACTIONS.ADMIN_GBS_LISTING_REVIEW;

export async function approveServiceListing({ id, subjectType, subjectId, expectedVersion, actor, reason } = {}) {
  staffActor(actor);
  const current = await loadExact({ id, subjectType, subjectId });
  if (
    alreadyApplied(
      current,
      GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
      GBS_LISTING_MODERATION_STATUSES.APPROVED,
      expectedVersion
    )
  ) {
    return { listing: current, replay: true };
  }
  if (!APPROVE_FROM.has(current.moderationStatus)) {
    throw deny('invalid_listing_review_transition', 409);
  }
  const capability = await assertSameSubjectCapability(current);
  const updated = await applyReview({
    current,
    expectedVersion,
    actor,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    reason,
    auditAction: GBS_AUDIT_EVENTS.GBS_LISTING_APPROVED,
  });
  const publication = evaluateListingPublicationGate({
    env: process.env,
    listing: updated.toObject ? updated.toObject() : updated,
    capability,
  });
  return { listing: updated, replay: false, publication };
}

export async function needsInformationServiceListing({
  id,
  subjectType,
  subjectId,
  expectedVersion,
  actor,
  reason,
} = {}) {
  staffActor(actor);
  const current = await loadExact({ id, subjectType, subjectId });
  if (
    alreadyApplied(
      current,
      GBS_LISTING_ADMIN_REVIEW_STATUSES.NEEDS_INFORMATION,
      GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
      expectedVersion
    )
  ) {
    return { listing: current, replay: true };
  }
  if (!NEEDS_INFO_FROM.has(current.moderationStatus)) {
    throw deny('invalid_listing_review_transition', 409);
  }
  const updated = await applyReview({
    current,
    expectedVersion,
    actor,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.NEEDS_INFORMATION,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
    reason,
    auditAction: GBS_AUDIT_EVENTS.GBS_LISTING_NEEDS_INFORMATION,
  });
  return { listing: updated, replay: false };
}

export async function rejectServiceListing({ id, subjectType, subjectId, expectedVersion, actor, reason } = {}) {
  staffActor(actor);
  const current = await loadExact({ id, subjectType, subjectId });
  if (
    alreadyApplied(
      current,
      GBS_LISTING_ADMIN_REVIEW_STATUSES.REJECTED,
      GBS_LISTING_MODERATION_STATUSES.REJECTED,
      expectedVersion
    )
  ) {
    return { listing: current, replay: true };
  }
  if (!REJECT_FROM.has(current.moderationStatus)) {
    throw deny('invalid_listing_review_transition', 409);
  }
  const updated = await applyReview({
    current,
    expectedVersion,
    actor,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.REJECTED,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    reason,
    auditAction: GBS_AUDIT_EVENTS.GBS_LISTING_REJECTED,
  });
  return { listing: updated, replay: false };
}

export async function suspendServiceListing({ id, subjectType, subjectId, expectedVersion, actor, reason } = {}) {
  staffActor(actor);
  const current = await loadExact({ id, subjectType, subjectId });
  if (
    alreadyApplied(
      current,
      GBS_LISTING_ADMIN_REVIEW_STATUSES.SUSPENDED,
      GBS_LISTING_MODERATION_STATUSES.SUSPENDED,
      expectedVersion
    )
  ) {
    return { listing: current, replay: true };
  }
  if (!SUSPEND_FROM.has(current.moderationStatus)) {
    throw deny('invalid_listing_review_transition', 409);
  }
  const updated = await applyReview({
    current,
    expectedVersion,
    actor,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.SUSPENDED,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.SUSPENDED,
    reason,
    auditAction: GBS_AUDIT_EVENTS.GBS_LISTING_SUSPENDED,
  });
  return { listing: updated, replay: false };
}
