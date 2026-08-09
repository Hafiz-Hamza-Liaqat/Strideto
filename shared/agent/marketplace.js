import { GUARANTEE_FORBIDDEN_PHRASES } from './constants.js';

export const MARKETPLACE_POST_TYPES = Object.freeze({
  SERVICE_ANNOUNCEMENT: 'service_announcement',
  CONSULTATION_AVAILABILITY: 'consultation_availability',
  APPLICATION_SUPPORT: 'application_support',
  SCHOLARSHIP_GUIDANCE: 'scholarship_guidance',
  UNIVERSITY_GUIDANCE: 'university_guidance',
  TEST_GUIDANCE: 'test_guidance',
  CAREER_GUIDANCE: 'career_guidance',
  INFORMATIONAL_UPDATE: 'informational_update',
  VERIFIED_OPPORTUNITY_REFERENCE: 'verified_opportunity_reference',
  EVENT_OR_SESSION: 'event_or_session',
  OTHER: 'other',
});

export const MARKETPLACE_PUBLICATION_STATUSES = Object.freeze({
  DRAFT: 'draft', SUBMITTED: 'submitted', PUBLISHED: 'published',
  ARCHIVED: 'archived', SUSPENDED: 'suspended',
});

export const MARKETPLACE_MODERATION_STATUSES = Object.freeze({
  NOT_SUBMITTED: 'not_submitted', PENDING: 'pending', UNDER_REVIEW: 'under_review',
  NEEDS_CHANGES: 'needs_changes', APPROVED: 'approved', REJECTED: 'rejected',
  SUSPENDED: 'suspended', ARCHIVED: 'archived',
});

export const MARKETPLACE_CONTENT_KINDS = Object.freeze({
  AGENT_STATEMENT: 'agent_statement',
  SOURCE_BACKED_FACT: 'source_backed_fact',
});

export const MARKETPLACE_REFERENCE_TYPES = Object.freeze({
  PROGRAM: 'program', SCHOLARSHIP: 'canonical_scholarship', TEST: 'test',
  INSTITUTION: 'canonical_institution',
});

export const MARKETPLACE_INTEREST_STATUSES = Object.freeze({ ACTIVE: 'active', WITHDRAWN: 'withdrawn' });

export const MARKETPLACE_FORBIDDEN_PHRASES = Object.freeze([
  ...GUARANTEE_FORBIDDEN_PHRASES,
  'guaranteed embassy approval', 'embassy approval guaranteed', '100% success',
  'official university representative', 'official representative of',
  'accredited partner', 'official partner',
]);

export function marketplaceClaimSignals(...values) {
  const text = values.flat(Infinity).filter((v) => typeof v === 'string').join(' ').toLowerCase();
  return MARKETPLACE_FORBIDDEN_PHRASES.filter((phrase) => text.includes(phrase));
}

export function requiresMarketplaceProvenance(post = {}) {
  return post.contentKind === MARKETPLACE_CONTENT_KINDS.SOURCE_BACKED_FACT ||
    (Array.isArray(post.factualClaims) && post.factualClaims.length > 0);
}

export function freshnessWarning(state) {
  if (state === 'stale') return 'Source information is stale. Check the official source before relying on it.';
  if (state === 'review_due') return 'Source review is due. Confirm details with the official source.';
  if (state === 'broken') return 'A supporting source is unavailable. Treat this information cautiously.';
  if (state === 'unknown') return 'Source freshness has not been established.';
  return null;
}

export function isMarketplaceCurrentlyActive(post, now = new Date()) {
  if (!post || post.publicationStatus !== 'published' || post.moderationStatus !== 'approved') return false;
  const instant = new Date(now);
  if (post.effectiveAt && new Date(post.effectiveAt) > instant) return false;
  if (post.endsAt && new Date(post.endsAt) <= instant) return false;
  return true;
}
