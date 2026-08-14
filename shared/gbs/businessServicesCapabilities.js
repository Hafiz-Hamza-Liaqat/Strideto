/**
 * Narrow Business Services provider capability taxonomy (Phase 17D-2).
 *
 * Additive to 17D-1 ProviderCapability. No fifth auth realm.
 * Public role: Business Services Provider. Formation specialization:
 * Business Formation Provider. These are capability labels, not User.role.
 */
import { PROVIDER_SUBJECT_TYPES } from './constants.js';

export const GBS_CAPABILITY_SCHEMA_VERSION = '17d-2.0';

export const BUSINESS_SERVICES_CAPABILITY_IDS = Object.freeze({
  BUSINESS_FORMATION: 'business_formation',
  FORMATION_CONSULTATION: 'formation_consultation',
  DOCUMENT_PREPARATION: 'document_preparation',
  REGISTERED_AGENT: 'registered_agent',
  REGISTERED_OFFICE: 'registered_office',
  EIN_ASSISTANCE: 'ein_assistance',
});

export const BUSINESS_SERVICES_PROVIDER_ROLE_LABEL = 'Business Services Provider';
export const BUSINESS_FORMATION_PROVIDER_LABEL = 'Business Formation Provider';

const BOTH = Object.freeze([PROVIDER_SUBJECT_TYPES.AGENT, PROVIDER_SUBJECT_TYPES.ORGANIZATION]);

export const BUSINESS_SERVICES_CAPABILITIES = Object.freeze({
  [BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION]: Object.freeze({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
    publicName: 'Business formation',
    regulated: false,
    protectedTitleRequired: false,
    jurisdictionScoped: true,
    entityTypeScoped: true,
    evidenceRequired: true,
    organizationVerificationRequired: false,
    reviewRequired: true,
    allowedSubjectTypes: BOTH,
    schemaVersion: GBS_CAPABILITY_SCHEMA_VERSION,
  }),
  [BUSINESS_SERVICES_CAPABILITY_IDS.FORMATION_CONSULTATION]: Object.freeze({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.FORMATION_CONSULTATION,
    publicName: 'Formation consultation',
    regulated: false,
    protectedTitleRequired: false,
    jurisdictionScoped: true,
    entityTypeScoped: false,
    evidenceRequired: true,
    organizationVerificationRequired: false,
    reviewRequired: true,
    allowedSubjectTypes: BOTH,
    schemaVersion: GBS_CAPABILITY_SCHEMA_VERSION,
  }),
  [BUSINESS_SERVICES_CAPABILITY_IDS.DOCUMENT_PREPARATION]: Object.freeze({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.DOCUMENT_PREPARATION,
    publicName: 'Document preparation',
    regulated: false,
    protectedTitleRequired: false,
    jurisdictionScoped: true,
    entityTypeScoped: true,
    evidenceRequired: true,
    organizationVerificationRequired: false,
    reviewRequired: true,
    allowedSubjectTypes: BOTH,
    schemaVersion: GBS_CAPABILITY_SCHEMA_VERSION,
  }),
  [BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT]: Object.freeze({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_AGENT,
    publicName: 'Registered agent',
    regulated: true,
    protectedTitleRequired: true,
    requiredProtectedTitleId: 'registered_agent',
    jurisdictionScoped: true,
    entityTypeScoped: false,
    evidenceRequired: true,
    organizationVerificationRequired: false,
    reviewRequired: true,
    allowedSubjectTypes: BOTH,
    schemaVersion: GBS_CAPABILITY_SCHEMA_VERSION,
  }),
  [BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_OFFICE]: Object.freeze({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.REGISTERED_OFFICE,
    publicName: 'Registered office',
    regulated: true,
    protectedTitleRequired: true,
    requiredProtectedTitleId: 'registered_office_provider',
    jurisdictionScoped: true,
    entityTypeScoped: false,
    evidenceRequired: true,
    organizationVerificationRequired: false,
    reviewRequired: true,
    allowedSubjectTypes: BOTH,
    schemaVersion: GBS_CAPABILITY_SCHEMA_VERSION,
  }),
  [BUSINESS_SERVICES_CAPABILITY_IDS.EIN_ASSISTANCE]: Object.freeze({
    capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.EIN_ASSISTANCE,
    publicName: 'EIN assistance',
    regulated: false,
    protectedTitleRequired: false,
    jurisdictionScoped: true,
    entityTypeScoped: false,
    evidenceRequired: true,
    organizationVerificationRequired: false,
    reviewRequired: true,
    allowedSubjectTypes: BOTH,
    schemaVersion: GBS_CAPABILITY_SCHEMA_VERSION,
  }),
});

export function isKnownBusinessServicesCapability(id) {
  return Object.prototype.hasOwnProperty.call(BUSINESS_SERVICES_CAPABILITIES, id);
}

export function getBusinessServicesCapability(id) {
  return BUSINESS_SERVICES_CAPABILITIES[id] || null;
}

export function capabilityAllowsSubject(capabilityId, subjectType) {
  const def = getBusinessServicesCapability(capabilityId);
  return !!def && def.allowedSubjectTypes.includes(subjectType);
}
