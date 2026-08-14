/**
 * New GBS provider-action authority (Phase 17D-2R1).
 *
 * Explicit known capabilityId is mandatory. Legacy ProviderCapability rows
 * without capabilityId remain schema-readable but are not GBS-authoritative.
 * Do not infer business_formation / registered_agent / ACSP from broad flags.
 */
import { GRANT_STATUSES } from '../capability/grantStatus.js';
import {
  LISTING_SCOPE_DIMENSIONS,
  PROVIDER_CAPABILITY_FLAGS,
  providerTrustIsVerified,
} from './constants.js';
import { isKnownBusinessServicesCapability } from './businessServicesCapabilities.js';
import { normalizeProviderScope, sameProviderSubject } from './providerCapability.js';

export const GBS_AUTHORITY_DENY_REASONS = Object.freeze({
  UNKNOWN: 'gbs_capability_unknown',
  CAPABILITY_ID_MISSING: 'gbs_capability_id_missing',
  CAPABILITY_ID_UNKNOWN: 'gbs_capability_id_unknown',
  CAPABILITY_ID_MISMATCH: 'gbs_capability_id_mismatch',
  SUBJECT_MISMATCH: 'gbs_subject_mismatch',
  NOT_ACTIVE: 'gbs_capability_not_active',
  NOT_VERIFIED: 'gbs_capability_not_verified',
  SCOPE_NOT_SUBSET: 'gbs_scope_not_subset',
  LEGACY_NOT_AUTHORITATIVE: 'gbs_legacy_not_authoritative',
});

function listIsSubset(requested, allowed) {
  const allow = new Set(allowed);
  for (const id of requested) {
    if (!allow.has(id)) return false;
  }
  return true;
}

export function explicitCapabilityId(record) {
  if (!record || record.capabilityId == null) return '';
  return String(record.capabilityId).trim();
}

export function isLegacyProviderCapability(record) {
  return !explicitCapabilityId(record);
}

export function isGbsAuthoritativeCapability(record) {
  const id = explicitCapabilityId(record);
  return Boolean(id) && isKnownBusinessServicesCapability(id);
}

function deny(reason) {
  return { allowed: false, reason };
}

/**
 * Authorizes a NEW Business Services provider action / GBS listing publication.
 * Missing or unknown capabilityId is never inferred.
 */
export function authorizeGbsProviderAction({ requested = {}, capability = null } = {}) {
  if (!capability || typeof capability !== 'object') {
    return deny(GBS_AUTHORITY_DENY_REASONS.UNKNOWN);
  }
  if (!sameProviderSubject(requested, capability)) {
    return deny(GBS_AUTHORITY_DENY_REASONS.SUBJECT_MISMATCH);
  }

  const requestedId = explicitCapabilityId(requested);
  const haveId = explicitCapabilityId(capability);

  if (!requestedId || !haveId) {
    return deny(
      !haveId
        ? GBS_AUTHORITY_DENY_REASONS.LEGACY_NOT_AUTHORITATIVE
        : GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_MISSING
    );
  }
  if (!isKnownBusinessServicesCapability(requestedId) || !isKnownBusinessServicesCapability(haveId)) {
    return deny(GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_UNKNOWN);
  }
  if (requestedId !== haveId) {
    return deny(GBS_AUTHORITY_DENY_REASONS.CAPABILITY_ID_MISMATCH);
  }
  if (capability.status !== GRANT_STATUSES.ACTIVE) {
    return deny(GBS_AUTHORITY_DENY_REASONS.NOT_ACTIVE);
  }
  if (!providerTrustIsVerified(capability.trustStatus)) {
    return deny(GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED);
  }

  const want = normalizeProviderScope(requested.scope || requested);
  const have = normalizeProviderScope(capability.scope || capability);
  for (const dim of LISTING_SCOPE_DIMENSIONS) {
    if (!listIsSubset(want[dim], have[dim])) {
      return deny(GBS_AUTHORITY_DENY_REASONS.SCOPE_NOT_SUBSET);
    }
  }
  for (const flag of Object.values(PROVIDER_CAPABILITY_FLAGS)) {
    if (want.flags[flag] === true && have.flags[flag] !== true) {
      return deny(GBS_AUTHORITY_DENY_REASONS.SCOPE_NOT_SUBSET);
    }
  }

  return { allowed: true, reason: null };
}
