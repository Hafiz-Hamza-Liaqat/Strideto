/**
 * Evidence acceptance policy helpers (Track AA/AS).
 * Validates evidenceType vs source URL kind before admin accept.
 */
import { isGoogleMapsUrl } from './geo.js';
import {
  EVIDENCE_TYPES,
  BADGE_TYPES,
  MAPS_EVIDENCE_IS_SUPPORTING_ONLY,
  deriveBadges,
} from './verification.js';

export const EVIDENCE_SOURCE_KINDS = Object.freeze({
  GOOGLE_MAPS: 'google_maps',
  ORDINARY_WEBSITE: 'ordinary_website',
  UNKNOWN: 'unknown',
});

const BADGE_EVIDENCE_MAP = Object.freeze({
  [BADGE_TYPES.IDENTITY_VERIFIED]: [EVIDENCE_TYPES.IDENTITY],
  [BADGE_TYPES.BUSINESS_VERIFIED]: [EVIDENCE_TYPES.BUSINESS_REGISTRATION],
  [BADGE_TYPES.OFFICIAL_DOMAIN_VERIFIED]: [EVIDENCE_TYPES.OFFICIAL_DOMAIN],
  [BADGE_TYPES.PHYSICAL_LOCATION_VERIFIED]: [EVIDENCE_TYPES.PHYSICAL_LOCATION],
  [BADGE_TYPES.PROFESSIONAL_CREDENTIAL_VERIFIED]: [EVIDENCE_TYPES.PROFESSIONAL_LICENSE],
  [BADGE_TYPES.INSTITUTION_REPRESENTATIVE_VERIFIED]: [EVIDENCE_TYPES.REPRESENTATIVE_AUTHORITY],
  [BADGE_TYPES.ACCREDITATION_VERIFIED]: [EVIDENCE_TYPES.ACCREDITATION],
});

/** Classify a source URL for evidence policy checks. */
export function classifyEvidenceSourceUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
    return EVIDENCE_SOURCE_KINDS.UNKNOWN;
  }
  if (isGoogleMapsUrl(sourceUrl)) return EVIDENCE_SOURCE_KINDS.GOOGLE_MAPS;
  try {
    const u = new URL(sourceUrl.trim());
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return EVIDENCE_SOURCE_KINDS.ORDINARY_WEBSITE;
    }
  } catch {
    /* not a URL */
  }
  return EVIDENCE_SOURCE_KINDS.UNKNOWN;
}

/** Badges that accepting this evidence type could support (if URL kind matches). */
export function maxBadgesForEvidenceType(evidenceType) {
  const badges = [];
  for (const [badge, types] of Object.entries(BADGE_EVIDENCE_MAP)) {
    if (types.includes(evidenceType)) badges.push(badge);
  }
  return badges;
}

/** Human-readable policy summary for admin UI. */
export function describeEvidencePolicy(evidenceType) {
  if (evidenceType === EVIDENCE_TYPES.GOOGLE_MAPS) {
    return {
      applicablePolicy: 'Supporting evidence only',
      maxTrustOutcome: 'None — Maps never grants VERIFIED badges',
      sourceConstraint: 'Must be a valid Google Maps HTTPS URL',
      supportingOnly: true,
    };
  }
  if (evidenceType === EVIDENCE_TYPES.OFFICIAL_DOMAIN) {
    return {
      applicablePolicy: 'Official domain verification',
      maxTrustOutcome: 'official_domain_verified',
      sourceConstraint: 'Ordinary website URL on the claimed official domain',
      supportingOnly: false,
    };
  }
  if (evidenceType === EVIDENCE_TYPES.PROFESSIONAL_LICENSE) {
    return {
      applicablePolicy: 'Professional credential',
      maxTrustOutcome: 'professional_credential_verified',
      sourceConstraint: 'Registry or authority document — not a generic website homepage',
      supportingOnly: false,
    };
  }
  if (evidenceType === EVIDENCE_TYPES.ACCREDITATION) {
    return {
      applicablePolicy: 'Accreditation',
      maxTrustOutcome: 'accreditation_verified',
      sourceConstraint: 'Accrediting body record — not a generic website homepage',
      supportingOnly: false,
    };
  }
  if (evidenceType === EVIDENCE_TYPES.BUSINESS_REGISTRATION) {
    return {
      applicablePolicy: 'Business registration',
      maxTrustOutcome: 'business_verified',
      sourceConstraint: 'Government registry or official registration record — not Maps or a generic site alone',
      supportingOnly: false,
    };
  }
  if (evidenceType === EVIDENCE_TYPES.PHYSICAL_LOCATION) {
    return {
      applicablePolicy: 'Physical location',
      maxTrustOutcome: 'physical_location_verified',
      sourceConstraint: 'Independent location proof — Google Maps alone is not acceptable',
      supportingOnly: false,
    };
  }
  const badges = maxBadgesForEvidenceType(evidenceType);
  return {
    applicablePolicy: evidenceType.replace(/_/g, ' '),
    maxTrustOutcome: badges.length ? badges.join(', ') : 'Review context-dependent',
    sourceConstraint: 'Source must match the declared evidence type',
    supportingOnly: false,
  };
}

/**
 * Validate whether evidence may be accepted for badge purposes.
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateEvidenceAcceptance(evidenceType, sourceUrl = '') {
  const kind = classifyEvidenceSourceUrl(sourceUrl);
  const url = String(sourceUrl || '').trim();

  if (evidenceType === EVIDENCE_TYPES.GOOGLE_MAPS) {
    if (kind !== EVIDENCE_SOURCE_KINDS.GOOGLE_MAPS) {
      return {
        ok: false,
        code: 'MAPS_URL_REQUIRED',
        message: 'Google Maps evidence requires a valid Google Maps HTTPS URL',
      };
    }
    return { ok: true };
  }

  if (kind === EVIDENCE_SOURCE_KINDS.GOOGLE_MAPS) {
    return {
      ok: false,
      code: 'MAPS_SUPPORTING_ONLY',
      message: 'Google Maps URLs are supporting evidence only and cannot be accepted as this evidence type',
    };
  }

  if (
    kind === EVIDENCE_SOURCE_KINDS.ORDINARY_WEBSITE
    && (evidenceType === EVIDENCE_TYPES.PROFESSIONAL_LICENSE
      || evidenceType === EVIDENCE_TYPES.ACCREDITATION)
  ) {
    return {
      ok: false,
      code: 'WEBSITE_NOT_CREDENTIAL',
      message: 'An ordinary website URL cannot be accepted as professional license or accreditation evidence',
    };
  }

  if (
    evidenceType === EVIDENCE_TYPES.BUSINESS_REGISTRATION
    && kind === EVIDENCE_SOURCE_KINDS.ORDINARY_WEBSITE
    && url
  ) {
    return {
      ok: false,
      code: 'WEBSITE_NOT_REGISTRATION',
      message: 'A generic website URL cannot be accepted as business registration evidence',
    };
  }

  if (
    evidenceType === EVIDENCE_TYPES.PHYSICAL_LOCATION
    && kind === EVIDENCE_SOURCE_KINDS.ORDINARY_WEBSITE
    && url
  ) {
    return {
      ok: false,
      code: 'WEBSITE_NOT_LOCATION',
      message: 'A generic website URL cannot be accepted as physical location evidence',
    };
  }

  return { ok: true };
}

export { MAPS_EVIDENCE_IS_SUPPORTING_ONLY, deriveBadges };
