/**
 * Public marketplace eligibility (Phase 17D-5).
 *
 * Live query-time authority. Stored publicationStatus is never sufficient.
 * Admin approved ≠ public. Domain setup ≠ active. Exact subject only.
 */
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  isBusinessServicesPublicMarketplaceEnabled,
} from './constants.js';
import { evaluateListingPublicationGate, LISTING_PUBLICATION_DENY_REASONS } from './listingPublicationGate.js';
import { sameProviderSubject } from './providerCapability.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS } from '../provider/providerDomains.js';

export const MARKETPLACE_DENY_REASONS = Object.freeze({
  MARKETPLACE_DISABLED: LISTING_PUBLICATION_DENY_REASONS.MARKETPLACE_DISABLED,
  LISTING_NOT_APPROVED: 'listing_not_publicly_approved',
  DOMAIN_NOT_ACTIVE: 'business_services_domain_not_active',
  LISTING_NOT_ELIGIBLE: LISTING_PUBLICATION_DENY_REASONS.LISTING_NOT_ELIGIBLE,
});

export function isBusinessServicesDomainEnrollmentActive(enrollment, listing) {
  if (!enrollment || !listing) return false;
  if (enrollment.domainId !== PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) return false;
  if (enrollment.status !== PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE) return false;
  return sameProviderSubject(listing, enrollment);
}

export function listingModerationIsPubliclyEligible(listing = {}) {
  return (
    listing.moderationStatus === GBS_LISTING_MODERATION_STATUSES.APPROVED &&
    listing.adminReviewStatus === GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED
  );
}

/**
 * Full public discovery check. Callers must load exact-subject capability
 * and exact-subject business_services enrollment; do not infer either.
 */
export function evaluatePublicMarketplaceEligibility({
  env,
  listing = {},
  capability = null,
  domainEnrollment = null,
  protectedTitleEvidence = null,
  claimedOfficialFacts = [],
  now = new Date(),
} = {}) {
  if (!isBusinessServicesPublicMarketplaceEnabled(env)) {
    return { allowed: false, reason: MARKETPLACE_DENY_REASONS.MARKETPLACE_DISABLED };
  }
  if (!listingModerationIsPubliclyEligible(listing)) {
    return { allowed: false, reason: MARKETPLACE_DENY_REASONS.LISTING_NOT_APPROVED };
  }
  if (!isBusinessServicesDomainEnrollmentActive(domainEnrollment, listing)) {
    return { allowed: false, reason: MARKETPLACE_DENY_REASONS.DOMAIN_NOT_ACTIVE };
  }
  return evaluateListingPublicationGate({
    env,
    listing,
    capability,
    protectedTitleEvidence,
    claimedOfficialFacts,
    now,
  });
}
