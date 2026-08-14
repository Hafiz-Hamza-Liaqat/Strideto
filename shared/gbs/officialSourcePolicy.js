/**
 * Official-source class + bind validation (Phase 17D-2).
 *
 * Competitor/blog/provider-self-declared sources cannot become legal facts.
 */
import {
  isAcceptedOfficialAuthorityType,
  isLegalFactSourceType,
  isValidFactCategory,
  isValidGbsSourceType,
} from './catalogConstants.js';
import { validateOfficialSourceUrl } from './officialSourceUrl.js';

export function assertLegalFactSourceAllowed(input = {}) {
  const errors = [];
  if (!isValidGbsSourceType(input.sourceType)) errors.push('sourceType is invalid');
  if (!isLegalFactSourceType(input.sourceType)) {
    errors.push('sourceType is not an accepted official class for legal facts');
  }
  if (!isAcceptedOfficialAuthorityType(input.authorityType)) {
    errors.push('authorityType is not accepted for authoritative legal facts');
  }
  if (!isValidFactCategory(input.factCategory)) errors.push('factCategory is invalid');
  const url = validateOfficialSourceUrl(input.sourceUrl);
  if (!url.ok) errors.push(url.error);
  if (!input.authorityId) errors.push('authorityId is required');
  if (!input.jurisdictionId) errors.push('jurisdictionId is required');
  if (input.expectedJurisdictionId && input.jurisdictionId !== input.expectedJurisdictionId) {
    errors.push('source jurisdiction bind mismatch');
  }
  if (input.expectedAuthorityId && input.authorityId !== input.expectedAuthorityId) {
    errors.push('source authority bind mismatch');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: url.value };
}

export function canBecomeAuthoritativeLegalFact(sourceType) {
  return isLegalFactSourceType(sourceType);
}
