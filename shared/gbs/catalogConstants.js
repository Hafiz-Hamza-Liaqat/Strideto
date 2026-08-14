/**
 * GBS jurisdiction / official-source catalog constants (Phase 17D-2).
 *
 * Data/registry contracts only. No UI, no public routes, no legal-advice engine.
 * Do not reuse education CanonicalSource / Mission-5 AUTHORITY_TYPES here —
 * GBS legal facts require registrar/tax/licensing official classes.
 */
export const GBS_CATALOG_SCHEMA_VERSION = '17d-2.0';

export const JURISDICTION_LEVELS = Object.freeze({
  COUNTRY: 'country',
  STATE: 'state',
  PROVINCE: 'province',
  TERRITORY: 'territory',
  EMIRATE: 'emirate',
  FREE_ZONE: 'free_zone',
  REGION: 'region',
  DISTRICT: 'district',
  OTHER: 'other',
});

export const CATALOG_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  RETIRED: 'retired',
});

export const CATALOG_REVIEW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  REVIEWED: 'reviewed',
  STALE: 'stale',
  SUPERSEDED: 'superseded',
  REJECTED: 'rejected',
});

export const PUBLICATION_ELIGIBILITY_STATES = Object.freeze({
  CURRENT: 'current',
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  STALE: 'stale',
  SUPERSEDED: 'superseded',
  NOT_YET_EFFECTIVE: 'not_yet_effective',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
  INACTIVE: 'inactive',
});

export const AUTHORITY_TYPES = Object.freeze({
  NATIONAL_REGISTRAR: 'national_registrar',
  STATE_REGISTRAR: 'state_registrar',
  PROVINCIAL_REGISTRAR: 'provincial_registrar',
  TAX_AUTHORITY: 'tax_authority',
  LICENSING_AUTHORITY: 'licensing_authority',
  GOVERNMENT_BUSINESS_PORTAL: 'government_business_portal',
  OFFICIAL_LEGISLATION: 'official_legislation',
  OFFICIAL_REGISTRY: 'official_registry',
  LOCAL_AUTHORITY: 'local_authority',
  OTHER_OFFICIAL: 'other_official',
});

/** Official classes allowed to become authoritative legal/jurisdiction facts. */
export const ACCEPTED_OFFICIAL_SOURCE_CLASSES = Object.freeze([
  AUTHORITY_TYPES.NATIONAL_REGISTRAR,
  AUTHORITY_TYPES.STATE_REGISTRAR,
  AUTHORITY_TYPES.PROVINCIAL_REGISTRAR,
  AUTHORITY_TYPES.TAX_AUTHORITY,
  AUTHORITY_TYPES.LICENSING_AUTHORITY,
  AUTHORITY_TYPES.GOVERNMENT_BUSINESS_PORTAL,
  AUTHORITY_TYPES.OFFICIAL_LEGISLATION,
  AUTHORITY_TYPES.OFFICIAL_REGISTRY,
]);

export const SOURCE_TYPES = Object.freeze({
  OFFICIAL_REGISTRAR: 'official_registrar',
  OFFICIAL_TAX_AUTHORITY: 'official_tax_authority',
  OFFICIAL_LICENSING: 'official_licensing',
  GOVERNMENT_PORTAL: 'government_portal',
  OFFICIAL_LEGISLATION: 'official_legislation',
  OFFICIAL_REGISTRY: 'official_registry',
  COMPETITOR_MARKETING: 'competitor_marketing',
  PROVIDER_BLOG: 'provider_blog',
  SEO_ARTICLE: 'seo_article',
  NEWS_ARTICLE: 'news_article',
  SOCIAL_FORUM: 'social_forum',
  AI_GENERATED: 'ai_generated',
  SEARCH_SNIPPET: 'search_snippet',
  PROVIDER_SELF_DECLARED: 'provider_self_declared',
});

export const LEGAL_FACT_SOURCE_TYPES = Object.freeze([
  SOURCE_TYPES.OFFICIAL_REGISTRAR,
  SOURCE_TYPES.OFFICIAL_TAX_AUTHORITY,
  SOURCE_TYPES.OFFICIAL_LICENSING,
  SOURCE_TYPES.GOVERNMENT_PORTAL,
  SOURCE_TYPES.OFFICIAL_LEGISLATION,
  SOURCE_TYPES.OFFICIAL_REGISTRY,
]);

export const FACT_CATEGORIES = Object.freeze({
  FORMATION_ELIGIBILITY: 'formation_eligibility',
  REGISTERED_AGENT_REQUIREMENT: 'registered_agent_requirement',
  REGISTERED_OFFICE_REQUIREMENT: 'registered_office_requirement',
  LOCAL_PRESENCE_REQUIREMENT: 'local_presence_requirement',
  DIRECTOR_MEMBER_SHAREHOLDER_RULE: 'director_member_shareholder_rule',
  REQUIRED_FILING_DOCUMENT: 'required_filing_document',
  FORMATION_STEP: 'formation_step',
  NAME_REQUIREMENT: 'name_requirement',
  PERIODIC_FILING: 'periodic_filing',
  IDENTIFIER_TAX_REGISTRATION: 'identifier_tax_registration',
  OFFICIAL_PROCESSING_NOTICE: 'official_processing_notice',
  GOVERNMENT_FEE: 'government_fee',
  ENTITY_TYPE: 'entity_type',
  OFFICIAL_SEARCH: 'official_search',
  PROTECTED_TITLE_REFERENCE: 'protected_title_reference',
  OTHER: 'other',
});

export const FEE_CATEGORIES = Object.freeze({
  FORMATION_FILING: 'formation_filing',
  REGISTERED_AGENT_DESIGNATION: 'registered_agent_designation',
  PERIODIC_REPORT: 'periodic_report',
  NAME_RESERVATION: 'name_reservation',
  CERTIFIED_COPY: 'certified_copy',
  EIN_ISSUANCE: 'ein_issuance',
  OTHER_GOVERNMENT: 'other_government',
});

export const FEE_AMOUNT_MODELS = Object.freeze({
  FIXED: 'fixed',
  RANGE: 'range',
  VARIABLE: 'variable',
  NOT_CATALOGUED: 'not_catalogued',
});

export const FEE_CADENCE = Object.freeze({
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
});

export const FRESHNESS_CLASSES = Object.freeze({
  GOVERNMENT_FEE: 'government_fee',
  FORMATION_RULE: 'formation_rule',
  AUTHORITY_IDENTITY: 'authority_identity',
  PERIODIC_OBLIGATION: 'periodic_obligation',
  SOURCE_DEFAULT: 'source_default',
});

export const LAUNCH_COUNTRY_CODES = Object.freeze(['PK', 'US', 'GB']);
export const STRUCTURAL_FUTURE_COUNTRY_CODES = Object.freeze(['SG', 'AE', 'CA', 'AU']);
export const US_LAUNCH_CANDIDATE_CODES = Object.freeze(['DE', 'WY', 'FL', 'TX']);

export const PROVIDER_FEE_OWNERSHIP = Object.freeze({
  GOVERNMENT: 'government',
  PROVIDER: 'provider',
  THIRD_PARTY: 'third_party',
  PLATFORM: 'platform',
});

const LEVEL_SET = new Set(Object.values(JURISDICTION_LEVELS));
const REVIEW_SET = new Set(Object.values(CATALOG_REVIEW_STATUSES));
const AUTH_SET = new Set(Object.values(AUTHORITY_TYPES));
const SOURCE_TYPE_SET = new Set(Object.values(SOURCE_TYPES));
const LEGAL_SOURCE_SET = new Set(LEGAL_FACT_SOURCE_TYPES);
const FACT_SET = new Set(Object.values(FACT_CATEGORIES));
const FEE_MODEL_SET = new Set(Object.values(FEE_AMOUNT_MODELS));
const ACCEPTED_AUTH_SET = new Set(ACCEPTED_OFFICIAL_SOURCE_CLASSES);

export function isValidJurisdictionLevel(value) {
  return typeof value === 'string' && LEVEL_SET.has(value);
}

export function isValidCatalogReviewStatus(value) {
  return typeof value === 'string' && REVIEW_SET.has(value);
}

export function isValidAuthorityType(value) {
  return typeof value === 'string' && AUTH_SET.has(value);
}

export function isAcceptedOfficialAuthorityType(value) {
  return typeof value === 'string' && ACCEPTED_AUTH_SET.has(value);
}

export function isValidGbsSourceType(value) {
  return typeof value === 'string' && SOURCE_TYPE_SET.has(value);
}

export function isLegalFactSourceType(value) {
  return typeof value === 'string' && LEGAL_SOURCE_SET.has(value);
}

export function isValidFactCategory(value) {
  return typeof value === 'string' && FACT_SET.has(value);
}

export function isValidFeeAmountModel(value) {
  return typeof value === 'string' && FEE_MODEL_SET.has(value);
}

export function isUsLaunchCandidate(code) {
  return US_LAUNCH_CANDIDATE_CODES.includes(String(code || '').toUpperCase());
}
