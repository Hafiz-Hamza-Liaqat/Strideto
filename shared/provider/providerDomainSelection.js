/**
 * Provider Domain selection validation (Phase 17D-3R).
 * At least one known domain is required for new self-registration.
 * Unknown IDs: DENY. Duplicates: collapsed. No silent Education default.
 */
import {
  isKnownProviderDomainId,
  PROVIDER_DOMAIN_IDS,
} from './providerDomains.js';

export const PROVIDER_DOMAIN_SELECTION_ERRORS = Object.freeze({
  REQUIRED: 'provider_domain_selection_required',
  UNKNOWN: 'unknown_provider_domain',
  NOT_AVAILABLE: 'provider_domain_not_available',
  EMPTY: 'provider_domain_selection_required',
});

export function normalizeProviderDomainIds(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const seen = new Set();
  const unknown = [];
  const domainIds = [];
  for (const value of list) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id) continue;
    if (!isKnownProviderDomainId(id)) {
      unknown.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    domainIds.push(id);
  }
  return { domainIds, unknown };
}

export function validateRequiredProviderDomainSelection(raw, { allowBusinessServices = true } = {}) {
  const { domainIds, unknown } = normalizeProviderDomainIds(raw);
  if (unknown.length) {
    return {
      ok: false,
      error: PROVIDER_DOMAIN_SELECTION_ERRORS.UNKNOWN,
      unknown,
      domainIds: [],
    };
  }
  if (!allowBusinessServices && domainIds.includes(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES)) {
    return {
      ok: false,
      error: PROVIDER_DOMAIN_SELECTION_ERRORS.NOT_AVAILABLE,
      domainIds,
    };
  }
  if (domainIds.length === 0) {
    return {
      ok: false,
      error: PROVIDER_DOMAIN_SELECTION_ERRORS.REQUIRED,
      domainIds: [],
    };
  }
  return { ok: true, domainIds };
}

/**
 * Missing/null initialization → legacy compatibility (education_mobility only).
 * New accounts must set pending/ready explicitly; never treat missing as Education
 * for rows that are marked pending.
 */
export function resolveProviderDomainInitializationState(value) {
  if (value === 'pending' || value === 'ready' || value === 'legacy') return value;
  return 'legacy';
}

export function isLegacyProviderDomainInitialization(value) {
  return resolveProviderDomainInitializationState(value) === 'legacy';
}

export function needsRequiredProviderDomainOnboarding(value) {
  return resolveProviderDomainInitializationState(value) === 'pending';
}
