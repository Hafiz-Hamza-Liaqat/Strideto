import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../../models/gbs/GbsQuote.js';
import { GbsContextThread } from '../../models/gbs/GbsContextThread.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import {
  GBS_LISTING_MODERATION_STATUSES,
  PROVIDER_TRUST_STATUSES,
} from '../../../../shared/gbs/constants.js';

export async function getProviderWorkspaceSummary({ subjectType, subjectId } = {}) {
  const sid = String(subjectId);
  const subject = { subjectType, subjectId: sid };
  const provider = { providerSubjectType: subjectType, providerSubjectId: sid };
  const [capGroups, listingGroups, openCases, jurisdictionCount, requests, quotes, cases, threads] = await Promise.all([
    ProviderCapability.aggregate([{ $match: subject }, { $group: { _id: { status: '$status', trustStatus: '$trustStatus', decision: '$review.decision' }, count: { $sum: 1 } } }]),
    GbsServiceListing.aggregate([{ $match: subject }, { $group: { _id: '$moderationStatus', count: { $sum: 1 } } }]),
    GbsCase.countDocuments({
    providerSubjectType: subjectType,
    providerSubjectId: sid,
    status: { $in: ['open', 'in_progress', 'awaiting_client', 'ready_for_submission'] },
    }),
    ProviderCapability.aggregate([
      { $match: { ...subject, status: GRANT_STATUSES.ACTIVE, trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED } },
      { $unwind: '$scope.jurisdictionIds' },
      { $group: { _id: '$scope.jurisdictionIds' } },
      { $count: 'count' },
    ]),
    GbsServiceRequest.find({ ...provider, status: { $in: ['submitted', 'provider_reviewing', 'ready_for_quote'] } }).sort({ createdAt: 1, _id: 1 }).limit(5).select('publicRequestRef titleSnapshot status createdAt').lean(),
    GbsQuote.find({ ...provider, status: 'sent' }).sort({ sentAt: 1, _id: 1 }).limit(5).select('publicQuoteRef titleSnapshot status sentAt expiresAt').lean(),
    GbsCase.find({ ...provider, status: { $in: ['open', 'in_progress', 'ready_for_submission'] } }).sort({ updatedAt: -1, _id: -1 }).limit(5).select('publicCaseRef titleSnapshot status currentMilestoneKey updatedAt').lean(),
    GbsContextThread.find(provider).sort({ lastMessageAt: -1, _id: -1 }).limit(5).select('contextType contextPublicRef titleSnapshot lastMessageAt').lean(),
  ]);
  const capCount = (predicate) => capGroups.filter(predicate).reduce((sum, row) => sum + row.count, 0);
  const listingCount = (status) => listingGroups.find((row) => row._id === status)?.count || 0;
  return {
    subjectType,
    subjectId: sid,
    counters: {
      capabilityClaims: capCount(() => true),
      verifiedCapabilities: capCount((row) => row._id.status === GRANT_STATUSES.ACTIVE && row._id.trustStatus === PROVIDER_TRUST_STATUSES.VERIFIED),
      capabilitiesUnderReview: capCount((row) => row._id.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED || row._id.trustStatus === PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED),
      capabilitiesNeedingInformation: capCount((row) => row._id.decision === 'needs_information'),
      suspendedCapabilities: capCount((row) => row._id.status === GRANT_STATUSES.SUSPENDED || row._id.trustStatus === PROVIDER_TRUST_STATUSES.SUSPENDED),
      jurisdictionsCoveredByVerified: jurisdictionCount[0]?.count || 0,
      draftListings: listingCount(GBS_LISTING_MODERATION_STATUSES.DRAFT),
      listingsUnderReview: listingCount(GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW),
      approvedInternalListings: listingCount(GBS_LISTING_MODERATION_STATUSES.APPROVED),
      openCases,
    },
    attention: {
      limit: 5,
      requests: requests.map((row) => ({ ref: row.publicRequestRef, title: row.titleSnapshot, status: row.status, at: row.createdAt })),
      quotes: quotes.map((row) => ({ ref: row.publicQuoteRef, title: row.titleSnapshot, status: row.status, at: row.sentAt, expiresAt: row.expiresAt })),
      cases: cases.map((row) => ({ ref: row.publicCaseRef, title: row.titleSnapshot, status: row.status, milestone: row.currentMilestoneKey, at: row.updatedAt })),
      messages: threads.map((row) => ({ contextType: row.contextType, ref: row.contextPublicRef, title: row.titleSnapshot, at: row.lastMessageAt })),
    },
  };
}
