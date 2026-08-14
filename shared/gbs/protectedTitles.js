/**
 * Protected / regulatory title registry (Phase 17D-2).
 *
 * Registry means Strideto treats the claim as evidence-gated.
 * It does NOT assert the label is legally protected in every jurisdiction.
 */
export const PROTECTED_TITLE_SCHEMA_VERSION = '17d-2.0';

export const PROTECTED_TITLE_IDS = Object.freeze({
  REGISTERED_AGENT: 'registered_agent',
  REGISTERED_OFFICE_PROVIDER: 'registered_office_provider',
  ACSP: 'acsp',
  CSP: 'csp',
  ATTORNEY: 'attorney',
  TAX_PROFESSIONAL: 'tax_professional',
  ACCOUNTANT: 'accountant',
  COMPANY_SECRETARY: 'company_secretary',
  OTHER_REGULATED: 'other_regulated',
});

export const PROTECTED_TITLES = Object.freeze({
  [PROTECTED_TITLE_IDS.REGISTERED_AGENT]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_AGENT,
    publicName: 'Registered Agent',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.REGISTERED_OFFICE_PROVIDER]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.REGISTERED_OFFICE_PROVIDER,
    publicName: 'Registered Office Provider',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.ACSP]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.ACSP,
    publicName: 'Authorised Corporate Service Provider',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    notes: 'UK Companies House authorised agent. Ordinary Agent verification must never grant ACSP.',
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.CSP]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.CSP,
    publicName: 'Corporate Service Provider',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.ATTORNEY]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.ATTORNEY,
    publicName: 'Attorney',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.TAX_PROFESSIONAL]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.TAX_PROFESSIONAL,
    publicName: 'Tax Professional',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.ACCOUNTANT]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.ACCOUNTANT,
    publicName: 'Accountant',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.COMPANY_SECRETARY]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.COMPANY_SECRETARY,
    publicName: 'Company Secretary',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
  [PROTECTED_TITLE_IDS.OTHER_REGULATED]: Object.freeze({
    titleId: PROTECTED_TITLE_IDS.OTHER_REGULATED,
    publicName: 'Other regulated role',
    evidenceGated: true,
    organizationVerificationInsufficient: true,
    schemaVersion: PROTECTED_TITLE_SCHEMA_VERSION,
  }),
});

export function isKnownProtectedTitle(id) {
  return Object.prototype.hasOwnProperty.call(PROTECTED_TITLES, id);
}

export function getProtectedTitle(id) {
  return PROTECTED_TITLES[id] || null;
}
