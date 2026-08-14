/**
 * Canonical Organization Capability registry (Phase 17D-1).
 *
 * organizationType remains descriptive and MUST NOT authorize.
 * Unknown capability IDs deny.
 */
export const ORGANIZATION_CAPABILITY_IDS = Object.freeze({
  EMPLOYER: 'employer',
  BUSINESS_CLIENT: 'business_client',
  BUSINESS_SERVICES_PROVIDER: 'business_services_provider',
});

export const ORGANIZATION_CAPABILITY_REGISTRY = Object.freeze({
  [ORGANIZATION_CAPABILITY_IDS.EMPLOYER]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
    description: 'Hiring / employer-organization capability (not GBS buyer authority)',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT,
    description: 'Organization-scoped GBS buyer capability',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER,
    description: 'Organization-scoped Business Services provider (Agency) capability',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
});

const ID_SET = new Set(Object.keys(ORGANIZATION_CAPABILITY_REGISTRY));

export function isKnownOrganizationCapability(id) {
  return typeof id === 'string' && ID_SET.has(id);
}

export function getOrganizationCapabilityDefinition(id) {
  if (!isKnownOrganizationCapability(id)) return null;
  return ORGANIZATION_CAPABILITY_REGISTRY[id];
}

export function listOrganizationCapabilityIds() {
  return Object.keys(ORGANIZATION_CAPABILITY_REGISTRY);
}
