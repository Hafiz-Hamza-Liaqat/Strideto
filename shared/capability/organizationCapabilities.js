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
  INSTITUTION_PORTAL: 'institution_portal',
  EDUCATION_AGENT: 'education_agent',
});

export const ORGANIZATION_CAPABILITY_REGISTRY = Object.freeze({
  [ORGANIZATION_CAPABILITY_IDS.EMPLOYER]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
    label: 'Employer (job posting)',
    description: 'Hiring / employer-organization capability (not GBS buyer authority)',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT,
    label: 'Business Client (GBS buyer)',
    description: 'Organization-scoped GBS buyer capability',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER,
    label: 'Business Services Provider',
    description: 'Organization-scoped Business Services provider (Agency) capability',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL,
    label: 'Institution Portal / Admissions',
    description: 'Institution portal and admission workflow authority',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT]: Object.freeze({
    id: ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT,
    label: 'Education Agent / Agency',
    description: 'Education Agent / Agency portal and service-listing authority',
    scopeRules: Object.freeze(['organization']),
    policyVersion: '17d-5.0',
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

/**
 * Returns all non-deprecated registry entries in canonical order,
 * suitable for QA override picker derivation.
 * @returns {{ id: string, label: string, description: string }[]}
 */
export function listQaEligibleCapabilities() {
  return listOrganizationCapabilityIds()
    .map((id) => ORGANIZATION_CAPABILITY_REGISTRY[id])
    .filter((entry) => !entry.deprecated);
}
