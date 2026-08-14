/**
 * Minimal GBS shared contracts / registries (Phase 17D-1).
 *
 * No full jurisdiction catalog, country content, or UI pages.
 * IDs are opaque scoped identifiers for later 17D-2 population.
 */
export const GBS_SCHEMA_VERSION = '17d-1.0';

export const GBS_VERTICAL_ID = 'business_services';

export const GBS_CASE_FAMILY_ID = 'business_services';

export const PROVIDER_SUBJECT_TYPES = Object.freeze({
  AGENT: 'agent',
  ORGANIZATION: 'organization',
});

const SUBJECT_SET = new Set(Object.values(PROVIDER_SUBJECT_TYPES));

export function isValidProviderSubjectType(value) {
  return typeof value === 'string' && SUBJECT_SET.has(value);
}

export const PROVIDER_TRUST_STATUSES = Object.freeze({
  CLAIMED: 'claimed',
  EVIDENCE_SUBMITTED: 'evidence_submitted',
  EVIDENCE_BACKED: 'evidence_backed',
  VERIFIED: 'verified',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

const TRUST_SET = new Set(Object.values(PROVIDER_TRUST_STATUSES));

export function isValidProviderTrustStatus(value) {
  return typeof value === 'string' && TRUST_SET.has(value);
}

export function providerTrustIsVerified(status) {
  return status === PROVIDER_TRUST_STATUSES.VERIFIED;
}

export const LISTING_SCOPE_DIMENSIONS = Object.freeze([
  'serviceCategoryIds',
  'countryCodes',
  'jurisdictionIds',
  'entityTypeIds',
  'protectedTitleIds',
]);

export const PROVIDER_CAPABILITY_FLAGS = Object.freeze({
  REGISTERED_AGENT: 'registered_agent',
  REGISTERED_OFFICE: 'registered_office',
});

export const GBS_COMMAND_IDS = Object.freeze({
  GRANT_USER_CAPABILITY: 'capability.user.grant',
  SUSPEND_USER_CAPABILITY: 'capability.user.suspend',
  REVOKE_USER_CAPABILITY: 'capability.user.revoke',
  GRANT_ORGANIZATION_CAPABILITY: 'capability.organization.grant',
  PROVIDER_CAPABILITY_CLAIM: 'gbs.provider_capability.claim',
  PROVIDER_CAPABILITY_REVIEW: 'gbs.provider_capability.review',
  QUOTE_ACCEPT: 'gbs.quote.accept',
  LISTING_CREATE: 'gbs.listing.create',
  LISTING_SUBMIT_REVIEW: 'gbs.listing.submit_review',
  LISTING_ADMIN_REVIEW: 'gbs.listing.admin_review',
});

export const GBS_LISTING_MODERATION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFORMATION: 'needs_information',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
});

export const GBS_LISTING_ADMIN_REVIEW_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  NEEDS_INFORMATION: 'needs_information',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});

const ADMIN_REVIEW_SET = new Set(Object.values(GBS_LISTING_ADMIN_REVIEW_STATUSES));

export function isValidListingAdminReviewStatus(value) {
  return typeof value === 'string' && ADMIN_REVIEW_SET.has(value);
}

export const GBS_LISTING_PUBLICATION_STATUSES = Object.freeze({
  PRIVATE: 'private',
  INTERNAL_APPROVED: 'internal_approved',
  PUBLIC: 'public',
});

export const GBS_PRICING_MODES = Object.freeze({
  FIXED: 'fixed',
  STARTING_AT: 'starting_at',
  RANGE: 'range',
  QUOTE_REQUIRED: 'quote_required',
});

export const GBS_DELIVERY_MODES = Object.freeze({
  REMOTE: 'remote',
  IN_PERSON: 'in_person',
  HYBRID: 'hybrid',
});

export const GBS_TURNAROUND_UNITS = Object.freeze({
  HOURS: 'hours',
  DAYS: 'days',
  WEEKS: 'weeks',
  BUSINESS_DAYS: 'business_days',
});

/** Resource bounds for provider writes (Phase 17D-3). */
export const GBS_PROVIDER_BOUNDS = Object.freeze({
  TITLE_MAX: 160,
  SHORT_DESCRIPTION_MAX: 280,
  DESCRIPTION_MAX: 8000,
  LANGUAGES_MAX: 16,
  ENTITY_TYPE_IDS_MAX: 16,
  INCLUDED_ITEMS_MAX: 30,
  EXCLUDED_ITEMS_MAX: 30,
  PROVIDER_FEE_LINES_MAX: 20,
  EVIDENCE_ROWS_MAX: 20,
  JURISDICTION_IDS_MAX: 32,
  COUNTRY_CODES_MAX: 8,
  NOTES_MAX: 500,
  URL_MAX: 500,
  LIST_PAGE_MAX: 50,
  REFERENCE_MAX: 120,
});

export const GBS_FEATURE_FLAG = 'BUSINESS_SERVICES_ENABLED';
export const GBS_PROVIDER_FEATURE_FLAG = 'BUSINESS_SERVICES_PROVIDER_ENABLED';
export const GBS_PUBLIC_MARKETPLACE_FEATURE_FLAG = 'BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED';

/** Foundation flag. Default OFF. No public GBS routes exist in 17D-1. */
export function isBusinessServicesEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return source?.BUSINESS_SERVICES_ENABLED === '1';
}

/**
 * Provider onboarding / private workspace. Compat: BUSINESS_SERVICES_ENABLED=1
 * also enables the provider workspace so existing local overrides keep working.
 * Public marketplace is a separate flag and stays OFF unless explicitly set.
 */
export function isBusinessServicesProviderEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return (
    source?.BUSINESS_SERVICES_PROVIDER_ENABLED === '1' ||
    source?.BUSINESS_SERVICES_ENABLED === '1'
  );
}

/** Public Business Services marketplace. Default OFF. No public routes in 17D-3R. */
export function isBusinessServicesPublicMarketplaceEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return source?.BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED === '1';
}
