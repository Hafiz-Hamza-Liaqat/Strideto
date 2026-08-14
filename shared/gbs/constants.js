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
});

export const GBS_FEATURE_FLAG = 'BUSINESS_SERVICES_ENABLED';

/** Foundation flag. Default OFF. No public GBS routes exist in 17D-1. */
export function isBusinessServicesEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return source?.BUSINESS_SERVICES_ENABLED === '1';
}
