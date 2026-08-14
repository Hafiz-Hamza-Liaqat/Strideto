import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import {
  GBS_LISTING_MODERATION_STATUSES,
  PROVIDER_TRUST_STATUSES,
} from '../../../../shared/gbs/constants.js';

export async function getProviderWorkspaceSummary({ subjectType, subjectId } = {}) {
  const sid = String(subjectId);
  const caps = await ProviderCapability.find({ subjectType, subjectId: sid }).lean();
  const listings = await GbsServiceListing.find({ subjectType, subjectId: sid }).lean();

  const verified = caps.filter(
    (c) => c.status === GRANT_STATUSES.ACTIVE && c.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED
  );
  const jurisdictions = new Set();
  for (const cap of verified) {
    for (const j of cap.scope?.jurisdictionIds || []) jurisdictions.add(j);
  }

  return {
    subjectType,
    subjectId: sid,
    counters: {
      capabilityClaims: caps.length,
      verifiedCapabilities: verified.length,
      capabilitiesUnderReview: caps.filter((c) => c.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED || c.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED).length,
      capabilitiesNeedingInformation: caps.filter((c) => c.review?.decision === 'needs_information').length,
      suspendedCapabilities: caps.filter((c) => c.status === GRANT_STATUSES.SUSPENDED || c.trustStatus === PROVIDER_TRUST_STATUSES.SUSPENDED).length,
      jurisdictionsCoveredByVerified: jurisdictions.size,
      draftListings: listings.filter((l) => l.moderationStatus === GBS_LISTING_MODERATION_STATUSES.DRAFT).length,
      listingsUnderReview: listings.filter((l) => l.moderationStatus === GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW).length,
      approvedInternalListings: listings.filter((l) => l.moderationStatus === GBS_LISTING_MODERATION_STATUSES.APPROVED).length,
    },
  };
}
