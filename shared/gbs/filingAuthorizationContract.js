/**
 * Case filing authorization contract (Phase 17D-9A / 17D-8B2C).
 *
 * High-assurance customer authorization for an exact Provider subject to use
 * exact Case information for one initial external formation filing.
 *
 * Not ConsentGrant. Not quote acceptance. Not RA consent. Not a statutory
 * signature. Not government filing or government acceptance.
 *
 * Production legal text remains unapproved. Production Wyoming pack remains
 * draft. Production grant availability remains false.
 *
 * Client-safe: no Node crypto, no production legal wording.
 */
export const GBS_FILING_AUTHORIZATION_SCHEMA_VERSION = '17d-9a.0';

export const FILING_AUTHORIZATION_PURPOSE = Object.freeze({
  INITIAL_FORMATION: 'gbs.case_filing_authorization.initial_formation',
});

export const FILING_AUTHORIZATION_SCOPE_KIND = 'initial_formation_external_filing';

export const FILING_AUTHORIZATION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  INVALIDATED: 'invalidated',
  CLAIMED_FOR_SUBMISSION: 'claimed_for_submission',
  USED: 'used',
  SUPERSEDED: 'superseded',
});

export const FILING_AUTHORIZATION_EFFECTIVE_STATUSES = Object.freeze([
  FILING_AUTHORIZATION_STATUSES.ACTIVE,
  FILING_AUTHORIZATION_STATUSES.CLAIMED_FOR_SUBMISSION,
  FILING_AUTHORIZATION_STATUSES.USED,
]);

export const FILING_AUTHORIZATION_REVOCABLE_STATUSES = Object.freeze([
  FILING_AUTHORIZATION_STATUSES.ACTIVE,
]);

export const FILING_AUTHORIZATION_CLAIMABLE_STATUSES = Object.freeze([
  FILING_AUTHORIZATION_STATUSES.ACTIVE,
]);

export const FILING_AUTHORIZATION_INVALIDATION_REASONS = Object.freeze({
  PROVIDER_CHANGED: 'provider_changed',
  PACK_VERSION_CHANGED: 'pack_version_changed',
  SOURCE_SNAPSHOT_CHANGED: 'source_snapshot_changed',
  CASE_CANCELLED: 'case_cancelled',
  CASE_UNABLE_TO_PROCEED: 'case_unable_to_proceed',
  CASE_COMPLETED: 'case_completed',
});

export const LEGAL_TEXT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  SUPERSEDED: 'superseded',
  WITHDRAWN: 'withdrawn',
});

export const LEGAL_TEXT_IDS = Object.freeze({
  PRODUCTION_INITIAL_FORMATION: 'gbs.legal_text.case_filing_authorization.initial_formation',
  TEST_ONLY_INITIAL_FORMATION: 'gbs.legal_text.test_only.case_filing_authorization.initial_formation',
});

export const FILING_AUTHORIZATION_UNAVAILABLE_REASONS = Object.freeze({
  FEATURE_DISABLED: 'filing_authorization_feature_disabled',
  CASE_TERMINAL: 'case_terminal',
  BUSINESS_CLIENT_REQUIRED: 'business_client_required',
  REQUIREMENT_PACK_NOT_ATTACHED: 'requirement_pack_not_attached',
  REQUIREMENT_PACK_NOT_ACTIVE: 'requirement_pack_not_active',
  REQUIREMENT_PACK_NOT_REVIEWED: 'requirement_pack_not_reviewed',
  LEGAL_TEXT_NOT_APPROVED: 'legal_text_not_approved',
  PROVIDER_NOT_ATTACHED: 'provider_not_attached',
  PROVIDER_AUTHORITY_LOST: 'provider_authority_lost',
  CONFLICTING_AUTHORIZATION: 'conflicting_authorization',
  PURPOSE_NOT_APPLICABLE: 'purpose_not_applicable',
  EXPIRED: 'filing_authorization_expired',
});

export const FILING_AUTHORIZATION_ERROR_CODES = Object.freeze({
  TEXT_CHANGED: 'filing_authorization_text_changed',
  NOT_AVAILABLE: 'filing_authorization_not_available',
  NOT_REVOCABLE: 'filing_authorization_not_revocable',
  NOT_CLAIMABLE: 'filing_authorization_not_claimable',
  AFFIRMATION_REQUIRED: 'filing_authorization_affirmation_required',
});

export const GBS_FILING_AUTHORIZATION_FEATURE_FLAG = 'GBS_FILING_AUTHORIZATION_ENABLED';
export const GBS_EXTERNAL_FILING_ATTESTATION_FEATURE_FLAG = 'GBS_EXTERNAL_FILING_ATTESTATION_ENABLED';

export function isGbsFilingAuthorizationEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return source?.GBS_FILING_AUTHORIZATION_ENABLED === '1';
}

export function isGbsExternalFilingAttestationEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return source?.GBS_EXTERNAL_FILING_ATTESTATION_ENABLED === '1';
}

export function isFilingAuthorizationEffectiveStatus(status) {
  return FILING_AUTHORIZATION_EFFECTIVE_STATUSES.includes(status);
}

export function isFilingAuthorizationRevocableStatus(status) {
  return FILING_AUTHORIZATION_REVOCABLE_STATUSES.includes(status);
}

export function isLegalTextApproved(status) {
  return status === LEGAL_TEXT_STATUSES.APPROVED;
}

export const FORBIDDEN_AUTHORIZATION_GOVERNMENT_STATUSES = Object.freeze([
  'government_processing',
  'government_approved',
  'government_rejected',
  'registered',
  'company_formed',
  'certificate_issued',
  'sos_accepted',
  'formation_successful',
]);

export const FORBIDDEN_AUTHORIZATION_CREDENTIAL_KEYS = Object.freeze([
  'password',
  'otp',
  'mfa',
  'governmentSession',
  'wyobizUsername',
  'wyobizPassword',
  'wyobizOtp',
  'sessionCookie',
  'recoveryCode',
  'governmentApiKey',
]);

export const FORBIDDEN_SIGNATURE_KEYS = Object.freeze([
  'signature',
  'signatureImage',
  'signaturePad',
  'typedStatutorySignature',
  'organizerSignature',
  'organizerSignatureAcceptance',
]);
