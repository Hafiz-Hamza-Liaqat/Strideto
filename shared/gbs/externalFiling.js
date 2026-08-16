/**
 * External-filing attestation DTO allowlists (Phase 17D-9A).
 * Client-safe. Server derives Case, Provider subject, pack, and authorization.
 */
import {
  EXTERNAL_FILING_AUTHORITY_IDS,
  isAllowedExternalFilingAuthority,
  isAllowedExternalFilingMethod,
} from './externalFilingContract.js';

const ATTEST_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
  'filingMethod',
  'externalSubmittedAt',
  'authorityId',
  'providerConfirmation',
  'optionalProviderReference',
]);

const FORBIDDEN_CLIENT_AUTHORITY = Object.freeze([
  'customerUserId',
  'providerSubjectId',
  'packId',
  'packVersion',
  'sourceSetId',
  'sourceSnapshotHash',
  'legalTextId',
  'legalTextHash',
  'status',
  'submissionStatus',
  'authorizationStatus',
  'password',
  'otp',
  'mfa',
  'governmentSession',
]);

export function allowlistedExternalFilingAttestationInput(body = {}) {
  const hit = FORBIDDEN_CLIENT_AUTHORITY.find((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
  if (hit) return { ok: false, error: 'client_authority_rejected' };
  const extra = Object.keys(body || {}).filter((key) => !ATTEST_ALLOWED.has(key));
  if (extra.length) return { ok: false, error: 'unexpected_fields' };
  if (body.providerConfirmation !== true) {
    return { ok: false, error: 'provider_confirmation_required' };
  }
  const filingMethod = typeof body.filingMethod === 'string' ? body.filingMethod.trim() : '';
  if (!isAllowedExternalFilingMethod(filingMethod)) return { ok: false, error: 'filing_method_required' };
  const authorityId = typeof body.authorityId === 'string' && body.authorityId.trim()
    ? body.authorityId.trim()
    : EXTERNAL_FILING_AUTHORITY_IDS.US_WY_SOS;
  if (!isAllowedExternalFilingAuthority(authorityId)) return { ok: false, error: 'authority_id_invalid' };
  let externalSubmittedAt = null;
  if (body.externalSubmittedAt) {
    const parsed = new Date(body.externalSubmittedAt);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'external_submitted_at_invalid' };
    externalSubmittedAt = parsed.toISOString();
  }
  let optionalProviderReference = '';
  if (body.optionalProviderReference != null && body.optionalProviderReference !== '') {
    if (typeof body.optionalProviderReference !== 'string') {
      return { ok: false, error: 'optional_provider_reference_invalid' };
    }
    optionalProviderReference = body.optionalProviderReference.trim().slice(0, 80);
  }
  return {
    ok: true,
    value: {
      filingMethod,
      authorityId,
      providerConfirmation: true,
      externalSubmittedAt,
      optionalProviderReference: optionalProviderReference || null,
    },
  };
}
