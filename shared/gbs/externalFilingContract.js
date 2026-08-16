/**
 * Provider-attested external filing provenance contract (Phase 17D-9A / 17D-8C).
 *
 * Manual external filing only. STRIDETO does not transmit to Wyoming.
 * `submitted_externally` means the exact authorized Provider attested that it
 * performed the external filing action. It is not government acceptance.
 *
 * Client-safe. No credentials. No government outcome states.
 */
export const GBS_EXTERNAL_FILING_SCHEMA_VERSION = '17d-9a.0';

export const EXTERNAL_FILING_METHODS = Object.freeze({
  WYOBIZ_ONLINE: 'wyobiz_online',
  PAPER_MAIL: 'paper_mail',
});

export const EXTERNAL_FILING_AUTHORITY_IDS = Object.freeze({
  US_WY_SOS: 'auth:US-WY-SOS',
});

export const EXTERNAL_SUBMISSION_STATUSES = Object.freeze({
  PREPARED: 'prepared',
  AUTHORIZATION_CLAIMED: 'authorization_claimed',
  SUBMITTED_EXTERNALLY: 'submitted_externally',
});

export const EXTERNAL_SUBMISSION_STATE = Object.freeze({
  NONE: 'none',
  AUTHORIZATION_CLAIMED: 'authorization_claimed',
  SUBMITTED_EXTERNALLY: 'submitted_externally',
});

export const FORBIDDEN_GOVERNMENT_OUTCOME_STATUSES = Object.freeze([
  'government_processing',
  'government_approved',
  'government_rejected',
  'registered',
  'company_formed',
  'certificate_issued',
  'sos_accepted',
  'formation_successful',
  'company_active',
]);

export function isAllowedExternalFilingMethod(value) {
  return Object.values(EXTERNAL_FILING_METHODS).includes(value);
}

export function isAllowedExternalFilingAuthority(value) {
  return Object.values(EXTERNAL_FILING_AUTHORITY_IDS).includes(value);
}
