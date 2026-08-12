/**
 * Location normalization helpers for legacy free-text province/region fields.
 */
import { coerceCountryCode, normalizeCountryCode } from './country.js';

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Normalize a loose location object to `{ countryCode, region, city }`.
 * Accepts legacy `country`, `province`, and `state` keys.
 */
export function normalizeLocation(input = {}) {
  const countryCode =
    normalizeCountryCode(input.countryCode) ||
    coerceCountryCode(input.country) ||
    coerceCountryCode(input.countryName) ||
    '';

  const region =
    str(input.region) ||
    str(input.province) ||
    str(input.state) ||
    str(input.stateProvince) ||
    '';

  const city = str(input.city) || str(input.locality) || '';

  return { countryCode, region, city };
}

/** True when at least a country code is present after normalization. */
export function hasNormalizedCountry(input) {
  return normalizeLocation(input).countryCode !== '';
}

export default normalizeLocation;
