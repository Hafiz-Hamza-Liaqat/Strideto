/**
 * Listing publication eligibility gate (Phase 17D-4).
 *
 * Eligible ≠ publicly discoverable. 17D-4 does not create public routes.
 * Public eligibility requires BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED.
 * Provider workspace enablement is a separate flag and never publishes listings.
 */
import { GRANT_STATUSES } from '../capability/grantStatus.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  isBusinessServicesPublicMarketplaceEnabled,
  providerTrustIsVerified,
} from './constants.js';
import { authorizeGbsProviderAction, GBS_AUTHORITY_DENY_REASONS } from './gbsProviderAuthority.js';
import { getBusinessServicesCapability, isKnownBusinessServicesCapability } from './businessServicesCapabilities.js';
import { isCurrentPublicEligible } from './publicationEligibility.js';
import { sameProviderSubject } from './providerCapability.js';
import {
  evaluateProtectedTitleVerification,
  PROTECTED_TITLE_POLICY_DENY_REASONS,
} from './protectedTitleEvidencePolicy.js';

export const LISTING_PUBLICATION_DENY_REASONS = Object.freeze({
  FEATURE_DISABLED: 'business_services_feature_disabled',
  MARKETPLACE_DISABLED: 'business_services_public_marketplace_disabled',
  LISTING_NOT_ELIGIBLE: 'listing_not_publication_eligible',
  SUBJECT_MISMATCH: 'listing_subject_mismatch',
  CAPABILITY_ID_REQUIRED: 'listing_capability_id_required',
  CAPABILITY_UNKNOWN: 'listing_capability_unknown',
  CAPABILITY_ID_MISMATCH: 'listing_capability_id_mismatch',
  NOT_ACTIVE: 'listing_capability_not_active',
  NOT_VERIFIED: 'listing_capability_not_verified',
  SCOPE_NOT_SUBSET: 'listing_scope_not_subset',
  PROTECTED_TITLE_REQUIRED: 'listing_protected_title_required',
  PROTECTED_TITLE_POLICY_NOT_CONFIGURED: 'protected_title_policy_not_configured',
  JURISDICTION_FACTS_NOT_CURRENT: 'listing_jurisdiction_facts_not_current',
  JURISDICTION_NOT_CURRENT_REVIEWED: 'listing_jurisdiction_not_current_reviewed',
  ADMIN_REVIEW_REQUIRED: 'listing_admin_review_required',
});

function mapAuthorityReason(reason) {
  if (reason === GBS_AUTHORITY_DENY_REASONS.SUBJECT_MISMATCH) {
    return LISTING_PUBLICATION_DENY_REASONS.SUBJECT_MISMATCH;
  }
  if (
    reason === GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_MISSING ||
    reason === GBS_AUTHORITY_DENY_REASONS.LEGACY_NOT_AUTHORITATIVE
  ) {
    return LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_ID_REQUIRED;
  }
  if (reason === GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_UNKNOWN) {
    return LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_UNKNOWN;
  }
  if (reason === GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_MISMATCH) {
    return LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_ID_MISMATCH;
  }
  if (reason === GBS_AUTHORITY_DENY_REASONS.NOT_ACTIVE) {
    return LISTING_PUBLICATION_DENY_REASONS.NOT_ACTIVE;
  }
  if (reason === GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED) {
    return LISTING_PUBLICATION_DENY_REASONS.NOT_VERIFIED;
  }
  return LISTING_PUBLICATION_DENY_REASONS.SCOPE_NOT_SUBSET;
}

export function evaluateListingPublicationGate({
  env,
  listing = {},
  capability = null,
  protectedTitleEvidence = null,
  claimedOfficialFacts = [],
  now = new Date(),
  requireMarketplaceEnabled = true,
  jurisdictionReadiness = null,
} = {}) {
  if (requireMarketplaceEnabled !== false && !isBusinessServicesPublicMarketplaceEnabled(env)) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.MARKETPLACE_DISABLED };
  }
  const moderationStatus = listing.moderationStatus;
  if (
    moderationStatus === GBS_LISTING_MODERATION_STATUSES.ARCHIVED ||
    moderationStatus === GBS_LISTING_MODERATION_STATUSES.SUSPENDED ||
    moderationStatus === GBS_LISTING_MODERATION_STATUSES.REJECTED
  ) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.LISTING_NOT_ELIGIBLE };
  }
  if (!capability || !sameProviderSubject(listing, capability)) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.SUBJECT_MISMATCH };
  }

  const listingCapabilityId = listing.capabilityId ? String(listing.capabilityId).trim() : '';
  const haveCapabilityId = capability.capabilityId ? String(capability.capabilityId).trim() : '';
  if (!listingCapabilityId || !haveCapabilityId) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_ID_REQUIRED };
  }
  if (
    !isKnownBusinessServicesCapability(listingCapabilityId) ||
    !isKnownBusinessServicesCapability(haveCapabilityId)
  ) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_UNKNOWN };
  }
  if (listingCapabilityId !== haveCapabilityId) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_ID_MISMATCH };
  }

  const def = getBusinessServicesCapability(listingCapabilityId);
  if (!def) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.CAPABILITY_UNKNOWN };
  }
  if (capability.status !== GRANT_STATUSES.ACTIVE) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.NOT_ACTIVE };
  }
  if (!providerTrustIsVerified(capability.trustStatus)) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.NOT_VERIFIED };
  }

  const scopeDecision = authorizeGbsProviderAction({ requested: listing, capability });
  if (!scopeDecision.allowed) {
    return { allowed: false, reason: mapAuthorityReason(scopeDecision.reason) };
  }

  if (jurisdictionReadiness && jurisdictionReadiness.productionReady !== true) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.JURISDICTION_NOT_CURRENT_REVIEWED };
  }

  if (def.protectedTitleRequired) {
    const titleId = def.requiredProtectedTitleId;
    const jurisdictionIds = capability.scope?.jurisdictionIds || listing.scope?.jurisdictionIds || [];
    if (!jurisdictionIds.length) {
      return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.PROTECTED_TITLE_REQUIRED };
    }
    const evidence = Array.isArray(protectedTitleEvidence)
      ? protectedTitleEvidence
      : protectedTitleEvidence
        ? [protectedTitleEvidence]
        : capability.evidenceRefs;
    for (const jurisdictionId of jurisdictionIds) {
      const titleDecision = evaluateProtectedTitleVerification({
        titleId,
        jurisdictionId,
        subject: capability,
        evidence,
        now,
      });
      if (!titleDecision.ok) {
        if (titleDecision.code === PROTECTED_TITLE_POLICY_DENY_REASONS.POLICY_NOT_CONFIGURED) {
          return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.PROTECTED_TITLE_POLICY_NOT_CONFIGURED };
        }
        return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.PROTECTED_TITLE_REQUIRED };
      }
    }
  }

  for (const fact of claimedOfficialFacts) {
    if (!isCurrentPublicEligible(fact, { now })) {
      return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.JURISDICTION_FACTS_NOT_CURRENT };
    }
  }
  if (listing.adminReviewStatus !== GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED) {
    return { allowed: false, reason: LISTING_PUBLICATION_DENY_REASONS.ADMIN_REVIEW_REQUIRED };
  }
  return { allowed: true, reason: null };
}
