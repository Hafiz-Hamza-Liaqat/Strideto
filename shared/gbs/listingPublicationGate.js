/**
 * Future listing publication gate (Phase 17D-2).
 *
 * No listing CRUD. Tests the frozen conjunction only.
 */
import { GRANT_STATUSES } from '../capability/grantStatus.js';
import { isBusinessServicesEnabled, providerTrustIsVerified } from './constants.js';
import { authorizeListingScope } from './listingScope.js';
import { getBusinessServicesCapability } from './businessServicesCapabilities.js';
import { evidenceIsCurrent } from './providerEvidence.js';
import { isCurrentPublicEligible } from './publicationEligibility.js';
import { sameProviderSubject } from './providerCapability.js';

export const LISTING_PUBLICATION_DENY_REASONS = Object.freeze({
  FEATURE_DISABLED: 'business_services_feature_disabled',
  SUBJECT_MISMATCH: 'listing_subject_mismatch',
  CAPABILITY_UNKNOWN: 'listing_capability_unknown',
  NOT_ACTIVE: 'listing_capability_not_active',
  NOT_VERIFIED: 'listing_capability_not_verified',
  SCOPE_NOT_SUBSET: 'listing_scope_not_subset',
  PROTECTED_TITLE_REQUIRED: 'listing_protected_title_required',
  JURISDICTION_FACTS_NOT_CURRENT: 'listing_jurisdiction_facts_not_current',
  ADMIN_REVIEW_REQUIRED: 'listing_admin_review_required',
});

export function evaluateListingPublicationGate({
  env,
  listing = {},
  capability = null,
  protectedTitleEvidence = null,
  claimedOfficialFacts = [],
} = {}) {
  if (!isBusinessServicesEnabled(env)) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.FEATURE_DISABLED };
  }
  if (!capability || !sameProviderSubject(listing, capability)) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.SUBJECT_MISMATCH };
  }
  const def = getBusinessServicesCapability(listing.capabilityId || capability.capabilityId);
  if (!def) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_UNKNOWN };
  }
  if (capability.status !== GRANT_STATUSES.ACTIVE) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.NOT_ACTIVE };
  }
  if (!providerTrustIsVerified(capability.trustStatus)) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.NOT_VERIFIED };
  }
  const scopeDecision = authorizeListingScope({ requested: listing, capability });
  if (!scopeDecision.allowed) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.SCOPE_NOT_SUBSET };
  }
  if (def.protectedTitleRequired) {
    const titleOk =
      evidenceIsCurrent(protectedTitleEvidence) &&
      protectedTitleEvidence?.titleId === def.requiredProtectedTitleId &&
      sameProviderSubject(protectedTitleEvidence, capability);
    if (!titleOk) {
      return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.PROTECTED_TITLE_REQUIRED };
    }
  }
  for (const fact of claimedOfficialFacts) {
    if (!isCurrentPublicEligible(fact)) {
      return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.JURISDICTION_FACTS_NOT_CURRENT };
    }
  }
  if (listing.adminReviewStatus !== 'approved') {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.ADMIN_REVIEW_REQUIRED };
  }
  return { allowed: true, reason: null };
}
