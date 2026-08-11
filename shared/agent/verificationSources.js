/**
 * Jurisdiction / profession verification source catalog (Phase 5).
 *
 * Sources are human-reviewer references only. Phase 5 never live-fetches
 * registries, Maps, or Business profiles. Maps/Business is supporting
 * evidence and can never alone produce VERIFIED.
 */

import { CREDENTIAL_POLICY, EVIDENCE_TYPES } from '../international/verification.js';

export const MAPS_IS_SUPPORTING_ONLY = true;

export const SOURCE_KINDS = Object.freeze({
  CORPORATE_REGISTRY: 'corporate_registry',
  TAX_AUTHORITY: 'tax_authority',
  PROFESSIONAL_REGULATOR: 'professional_regulator',
  ACCREDITATION: 'accreditation',
  SUPPORTING_LOCATION: 'supporting_location',
});

/**
 * Configurable catalog. Pakistan entries are illustrative official URLs for
 * authorized Admin to open manually — never treated as an automated checker.
 */
const CATALOG = Object.freeze([
  {
    countryCode: 'PK',
    organizationType: 'agency',
    kind: SOURCE_KINDS.CORPORATE_REGISTRY,
    authorityName: 'Securities and Exchange Commission of Pakistan (SECP)',
    officialVerificationUrl: 'https://www.secp.gov.pk/',
    credentialPolicy: CREDENTIAL_POLICY.REQUIRED,
    automated: false,
    note: 'Manual verification required. Do not treat a registration number as proof.',
  },
  {
    countryCode: 'PK',
    organizationType: 'agency',
    kind: SOURCE_KINDS.TAX_AUTHORITY,
    authorityName: 'Federal Board of Revenue (FBR)',
    officialVerificationUrl: 'https://www.fbr.gov.pk/',
    credentialPolicy: CREDENTIAL_POLICY.OPTIONAL,
    automated: false,
    note: 'Manual verification required. Tax status is not Strideto verification.',
  },
  {
    countryCode: 'PK',
    organizationType: 'agent',
    kind: SOURCE_KINDS.PROFESSIONAL_REGULATOR,
    authorityName: 'Profession-specific council / regulator (jurisdiction dependent)',
    officialVerificationUrl: '',
    credentialPolicy: CREDENTIAL_POLICY.REQUIRED,
    automated: false,
    note: 'Manual verification required. No universal license checker is configured.',
  },
  {
    countryCode: '*',
    organizationType: '*',
    kind: SOURCE_KINDS.SUPPORTING_LOCATION,
    authorityName: 'Google Maps / Google Business (supporting only)',
    officialVerificationUrl: '',
    credentialPolicy: CREDENTIAL_POLICY.NOT_APPLICABLE,
    automated: false,
    mapsSupportingOnly: true,
    note: 'Maps or Business profile URLs are supporting location evidence only and can never alone result in VERIFIED.',
  },
]);

export function mapsCannotAloneVerify(evidenceRecords = []) {
  const accepted = (Array.isArray(evidenceRecords) ? evidenceRecords : [])
    .filter((e) => e?.status === 'accepted')
    .map((e) => e.evidenceType);
  const hasMaps = accepted.includes(EVIDENCE_TYPES.GOOGLE_MAPS);
  const hasPrimaryIdentity = accepted.some((t) =>
    t === EVIDENCE_TYPES.IDENTITY
    || t === EVIDENCE_TYPES.BUSINESS_REGISTRATION
    || t === EVIDENCE_TYPES.PROFESSIONAL_LICENSE
    || t === EVIDENCE_TYPES.PHYSICAL_LOCATION
    || t === EVIDENCE_TYPES.OFFICIAL_DOMAIN
  );
  if (hasMaps && !hasPrimaryIdentity) return true;
  return MAPS_IS_SUPPORTING_ONLY;
}

export function resolveVerificationSources({ countryCode = '', organizationType = '' } = {}) {
  const cc = String(countryCode || '').trim().toUpperCase();
  const type = String(organizationType || '').trim().toLowerCase();
  const matched = CATALOG.filter((row) => {
    const countryOk = row.countryCode === '*' || (cc && row.countryCode === cc);
    const typeOk = row.organizationType === '*' || (type && row.organizationType === type);
    return countryOk && typeOk;
  });
  const configured = matched.filter((row) => row.kind !== SOURCE_KINDS.SUPPORTING_LOCATION && row.officialVerificationUrl);
  return {
    countryCode: cc || null,
    organizationType: type || null,
    mapsSupportingOnly: true,
    mapsCannotAloneResultInVerified: true,
    automatedFetch: false,
    sources: matched,
    configuredCount: configured.length,
    manualVerificationRequired: configured.length === 0,
    manualVerificationNote: configured.length === 0
      ? 'Manual verification required'
      : 'Authorized Admin may open configured source links. No automatic registry fetch is performed.',
  };
}
