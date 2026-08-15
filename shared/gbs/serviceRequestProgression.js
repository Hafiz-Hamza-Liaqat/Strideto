/**
 * Existing-request professional progression (Phase 17D-6).
 *
 * Marketplace public flag is NOT required for ready_for_quote on an
 * already-created request. Current listing moderation, capability, and
 * domain authority ARE required.
 */
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
} from './constants.js';
import { evaluateListingPublicationGate, LISTING_PUBLICATION_DENY_REASONS } from './listingPublicationGate.js';
import { isBusinessServicesDomainEnrollmentActive } from './marketplaceEligibility.js';
import { sameProviderSubject } from './providerCapability.js';

export const SERVICE_REQUEST_PROGRESSION_DENY_REASONS = Object.freeze({
  LISTING_NOT_FOUND: 'listing_not_found',
  LISTING_SUBJECT_MISMATCH: 'listing_subject_mismatch',
  LISTING_CAPABILITY_MISMATCH: 'listing_capability_mismatch',
  LISTING_MODERATION_BLOCKS: 'listing_moderation_blocks_progression',
  DOMAIN_NOT_ACTIVE: 'business_services_domain_not_active',
  CAPABILITY_NOT_ACTIVE: LISTING_PUBLICATION_DENY_REASONS.NOT_ACTIVE,
  CAPABILITY_NOT_VERIFIED: LISTING_PUBLICATION_DENY_REASONS.NOT_VERIFIED,
});

export function listingModerationAllowsProviderProgression(listing = {}) {
  if (!listing) return false;
  if (listing.moderationStatus !== GBS_LISTING_MODERATION_STATUSES.APPROVED) return false;
  if (listing.adminReviewStatus !== GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED) return false;
  if (
    listing.moderationStatus === GBS_LISTING_MODERATION_STATUSES.SUSPENDED ||
    listing.moderationStatus === GBS_LISTING_MODERATION_STATUSES.REJECTED ||
    listing.moderationStatus === GBS_LISTING_MODERATION_STATUSES.ARCHIVED
  ) {
    return false;
  }
  return true;
}

/**
 * Re-check current listing/capability/domain for ready_for_quote.
 * Does not require BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED.
 */
export function evaluateReadyForQuoteAuthority({
  env,
  listing = null,
  capability = null,
  domainEnrollment = null,
  storedRequest = {},
  now = new Date(),
} = {}) {
  if (!listing) {
    return { allowed: false, reason: SERVICE_REQUEST_PROGRESSION_DENY_REASONS.LISTING_NOT_FOUND };
  }
  const expectedSubject = {
    subjectType: storedRequest.providerSubjectType,
    subjectId: storedRequest.providerSubjectId,
  };
  if (!sameProviderSubject(listing, expectedSubject)) {
    return { allowed: false, reason: SERVICE_REQUEST_PROGRESSION_DENY_REASONS.LISTING_SUBJECT_MISMATCH };
  }
  if (String(listing.capabilityId || '') !== String(storedRequest.capabilityId || '')) {
    return { allowed: false, reason: SERVICE_REQUEST_PROGRESSION_DENY_REASONS.LISTING_CAPABILITY_MISMATCH };
  }
  if (!listingModerationAllowsProviderProgression(listing)) {
    return { allowed: false, reason: SERVICE_REQUEST_PROGRESSION_DENY_REASONS.LISTING_MODERATION_BLOCKS };
  }
  if (!isBusinessServicesDomainEnrollmentActive(domainEnrollment, listing)) {
    return { allowed: false, reason: SERVICE_REQUEST_PROGRESSION_DENY_REASONS.DOMAIN_NOT_ACTIVE };
  }
  return evaluateListingPublicationGate({
    env,
    listing,
    capability,
    protectedTitleEvidence: capability?.evidenceRefs || null,
    now,
    requireMarketplaceEnabled: false,
  });
}
