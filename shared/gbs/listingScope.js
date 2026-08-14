/**
 * Listing scope subset authorizer (Phase 17D-1).
 *
 * Hard invariant: requested listing scope ⊆ active verified ProviderCapability
 * scope of the SAME subject.
 *
 * Frontend filtering is irrelevant. Unknown / unverified / suspended / revoked deny.
 */
import { GRANT_STATUSES } from '../capability/grantStatus.js';
import {
  LISTING_SCOPE_DIMENSIONS,
  PROVIDER_CAPABILITY_FLAGS,
  providerTrustIsVerified,
} from './constants.js';
import { isKnownBusinessServicesCapability } from './businessServicesCapabilities.js';
import {
  normalizeProviderScope,
  sameProviderSubject,
} from './providerCapability.js';

export const LISTING_SCOPE_DENY_REASONS = Object.freeze({
  SUBJECT_MISMATCH: 'listing_scope_subject_mismatch',
  NOT_ACTIVE: 'listing_scope_not_active',
  NOT_VERIFIED: 'listing_scope_not_verified',
  SCOPE_NOT_SUBSET: 'listing_scope_not_subset',
  UNKNOWN: 'listing_scope_unknown',
  CAPABILITY_ID_REQUIRED: 'listing_scope_capability_id_required',
  CAPABILITY_ID_UNKNOWN: 'listing_scope_capability_id_unknown',
});

function listIsSubset(requested, allowed) {
  const allow = new Set(allowed);
  for (const id of requested) {
    if (!allow.has(id)) return false;
  }
  return true;
}

/**
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function authorizeListingScope({ requested = {}, capability = null } = {}) {
  if (!capability || typeof capability !== 'object') {
    return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.UNKNOWN };
  }
  if (!sameProviderSubject(requested, capability)) {
    return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.SUBJECT_MISMATCH };
  }
  if (capability.status !== GRANT_STATUSES.ACTIVE) {
    return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.NOT_ACTIVE };
  }
  if (!providerTrustIsVerified(capability.trustStatus)) {
    return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.NOT_VERIFIED };
  }

  const requestedCapabilityId = requested.capabilityId ? String(requested.capabilityId).trim() : '';
  const haveCapabilityId = capability.capabilityId ? String(capability.capabilityId).trim() : '';
  if (requestedCapabilityId) {
    if (!haveCapabilityId) {
      return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.CAPABILITY_ID_REQUIRED };
    }
    if (
      !isKnownBusinessServicesCapability(requestedCapabilityId) ||
      !isKnownBusinessServicesCapability(haveCapabilityId)
    ) {
      return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.CAPABILITY_ID_UNKNOWN };
    }
    if (requestedCapabilityId !== haveCapabilityId) {
      return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.SCOPE_NOT_SUBSET };
    }
  }

  const want = normalizeProviderScope(requested.scope || requested);
  const have = normalizeProviderScope(capability.scope || capability);

  for (const dim of LISTING_SCOPE_DIMENSIONS) {
    if (!listIsSubset(want[dim], have[dim])) {
      return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.SCOPE_NOT_SUBSET };
    }
  }

  for (const flag of Object.values(PROVIDER_CAPABILITY_FLAGS)) {
    if (want.flags[flag] === true && have.flags[flag] !== true) {
      return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.SCOPE_NOT_SUBSET };
    }
  }

  return { allowed: true, reason: null };
}

/**
 * True when any one of the subject's capabilities covers the requested scope.
 */
export function authorizeListingScopeAgainstCapabilities(requested, capabilities = []) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    return { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.UNKNOWN };
  }
  let last = { allowed: false, reason: LISTING_SCOPE_DENY_REASONS.UNKNOWN };
  for (const cap of capabilities) {
    const decision = authorizeListingScope({ requested, capability: cap });
    if (decision.allowed) return decision;
    last = decision;
  }
  return last;
}
