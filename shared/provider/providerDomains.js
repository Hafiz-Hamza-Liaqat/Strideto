/**
 * Canonical Provider Domain registry (Phase 17D-3R).
 *
 * Provider Domain is professional-area configuration, not:
 * professional verification, ProviderCapability, Organization Verification,
 * auth realm, or workspace preference.
 *
 * Unknown domain IDs: DENY.
 */
export const PROVIDER_DOMAIN_SCHEMA_VERSION = '17d-3r.0';

export const PROVIDER_DOMAIN_IDS = Object.freeze({
  EDUCATION_MOBILITY: 'education_mobility',
  BUSINESS_SERVICES: 'business_services',
});

export const PROVIDER_DOMAIN_STATUSES = Object.freeze({
  ACTIVE: 'active',
  COMING_SOON: 'coming_soon',
});

export const PROVIDER_DOMAIN_ENROLLMENT_STATUSES = Object.freeze({
  SETUP: 'setup',
  ACTIVE: 'active',
});

export const PROVIDER_DOMAIN_ONBOARDING_STATUSES = Object.freeze({
  PENDING: 'pending',
  COMPLETE: 'complete',
});

export const PROVIDER_DOMAIN_INITIALIZATION_STATES = Object.freeze({
  LEGACY: 'legacy',
  PENDING: 'pending',
  READY: 'ready',
});

export const PROVIDER_DOMAINS = Object.freeze({
  [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY]: Object.freeze({
    domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
    publicName: 'Education & Mobility',
    shortName: 'Education',
    description:
      'Help students and professionals with education, admissions, scholarships, study-abroad guidance, career/mobility support and related services.',
    onboardingDescription:
      'Help students and professionals with education, admissions, scholarships, study-abroad guidance, career/mobility support and related services.',
    workspaceLabel: 'Education & Mobility',
    iconKey: 'education',
    schemaVersion: PROVIDER_DOMAIN_SCHEMA_VERSION,
    status: PROVIDER_DOMAIN_STATUSES.ACTIVE,
  }),
  [PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES]: Object.freeze({
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    publicName: 'Business Formation & Corporate Services',
    shortName: 'Business Services',
    description:
      'Help founders and businesses with company formation, LLC registration, Registered Agent services, registered offices, EIN assistance and related corporate services.',
    onboardingDescription:
      'Help founders and businesses with company formation, LLC registration, Registered Agent services, registered offices, EIN assistance and related corporate services.',
    workspaceLabel: 'Business Formation & Corporate Services',
    iconKey: 'business',
    schemaVersion: PROVIDER_DOMAIN_SCHEMA_VERSION,
    status: PROVIDER_DOMAIN_STATUSES.ACTIVE,
  }),
});

const DOMAIN_SET = new Set(Object.keys(PROVIDER_DOMAINS));

export function isKnownProviderDomainId(value) {
  return typeof value === 'string' && DOMAIN_SET.has(value);
}

export function getProviderDomain(domainId) {
  if (!isKnownProviderDomainId(domainId)) return null;
  return PROVIDER_DOMAINS[domainId];
}

export function listProviderDomains() {
  return Object.values(PROVIDER_DOMAINS);
}

export function publicProviderDomainProjection(domainId) {
  const def = getProviderDomain(domainId);
  if (!def) return null;
  return {
    domainId: def.domainId,
    publicName: def.publicName,
    shortName: def.shortName,
    description: def.description,
    onboardingDescription: def.onboardingDescription,
    workspaceLabel: def.workspaceLabel,
    iconKey: def.iconKey,
    status: def.status,
  };
}
