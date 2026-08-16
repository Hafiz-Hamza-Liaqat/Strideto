/**
 * Filing-authorization DTO allowlists (Phase 17D-9A).
 * Client-safe. Server derives customer, Provider, pack, and legal-text authority.
 */
import { GBS_CASE_BOUNDS } from './caseContract.js';
import { FILING_AUTHORIZATION_PURPOSE } from './filingAuthorizationContract.js';

const GRANT_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'legalTextId',
  'legalTextVersion',
  'legalTextHash',
  'affirmed',
]);

const REVOKE_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'publicAuthorizationRef',
]);

const FORBIDDEN_CLIENT_AUTHORITY = Object.freeze([
  'customerUserId',
  'providerSubjectId',
  'providerSubjectType',
  'packId',
  'packVersion',
  'sourceSetId',
  'sourceSnapshotHash',
  'status',
  'grantedAt',
  'purpose',
  'scope',
  'caseId',
]);

function extraKeys(body, allowed) {
  return Object.keys(body || {}).filter((key) => !allowed.has(key));
}

function rejectAuthorityKeys(body) {
  const hit = FORBIDDEN_CLIENT_AUTHORITY.find((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
  if (hit) return { ok: false, error: 'client_authority_rejected' };
  return null;
}

export function allowlistedFilingAuthorizationGrantInput(body = {}) {
  const blocked = rejectAuthorityKeys(body);
  if (blocked) return blocked;
  const extra = extraKeys(body, GRANT_ALLOWED);
  if (extra.length) return { ok: false, error: 'unexpected_fields' };
  if (body.affirmed !== true) return { ok: false, error: 'filing_authorization_affirmation_required' };
  const legalTextId = typeof body.legalTextId === 'string' ? body.legalTextId.trim() : '';
  const legalTextHash = typeof body.legalTextHash === 'string' ? body.legalTextHash.trim().toLowerCase() : '';
  const legalTextVersion = Number(body.legalTextVersion);
  if (!legalTextId || !legalTextHash || !Number.isInteger(legalTextVersion) || legalTextVersion < 1) {
    return { ok: false, error: 'legal_text_echo_required' };
  }
  if (!/^[a-f0-9]{64}$/.test(legalTextHash)) return { ok: false, error: 'legal_text_echo_required' };
  return {
    ok: true,
    value: {
      legalTextId,
      legalTextVersion,
      legalTextHash,
      affirmed: true,
      purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
    },
  };
}

export function allowlistedFilingAuthorizationRevokeInput(body = {}) {
  const blocked = rejectAuthorityKeys(body);
  if (blocked) return blocked;
  const extra = extraKeys(body, REVOKE_ALLOWED);
  if (extra.length) return { ok: false, error: 'unexpected_fields' };
  const publicAuthorizationRef = typeof body.publicAuthorizationRef === 'string'
    ? body.publicAuthorizationRef.trim()
    : '';
  if (!publicAuthorizationRef || publicAuthorizationRef.length > GBS_CASE_BOUNDS.REF_MAX) {
    return { ok: false, error: 'authorization_ref_required' };
  }
  return { ok: true, value: { publicAuthorizationRef } };
}

export function emptyFilingAuthorizationProjection() {
  return {
    available: false,
    reason: 'requirement_pack_not_active',
    canGrant: false,
    canRevoke: false,
    authorizedForExternalFiling: false,
    externalSubmissionEligible: false,
    externalSubmissionState: 'none',
    current: null,
    eligibleLegalText: null,
    history: [],
    providerDisplayName: '',
    purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
    purposeLabel: 'Authorize the named Provider to use this Case information for the described initial external formation filing.',
  };
}

export function customerUnavailableCopy(reason) {
  if (reason === 'legal_text_not_approved' || reason === 'requirement_pack_not_active'
    || reason === 'requirement_pack_not_reviewed' || reason === 'requirement_pack_not_attached'
    || reason === 'filing_authorization_feature_disabled' || reason === 'purpose_not_applicable') {
    return 'Filing authorization is not yet available for this Case.';
  }
  if (reason === 'case_terminal') {
    return 'Filing authorization is not available because this Case is no longer open.';
  }
  if (reason === 'business_client_required') {
    return 'A new filing authorization cannot be granted without active Business Services access.';
  }
  if (reason === 'provider_authority_lost' || reason === 'provider_not_attached') {
    return 'Filing authorization is not available because the Provider is not currently authorized for this service.';
  }
  return 'Filing authorization is not yet available for this Case.';
}
