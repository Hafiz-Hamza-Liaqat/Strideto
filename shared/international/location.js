/**
 * Location normalization helpers for legacy free-text province/region fields.
 */
import { coerceCountryCode, countryDisplayName, normalizeCountryCode } from './country.js';

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

/**
 * Escape a string for safe inclusion in a RegExp source.
 * @param {string} value
 */
export function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Values that may match a free-text `country` field for a given query
 * (raw input, ISO code, and display name). Used for public/admin filters.
 * Does not invent a country when the query is empty.
 */
export function freeTextCountryMatchValues(raw) {
  const trimmed = str(raw);
  if (!trimmed) return [];
  const code = coerceCountryCode(trimmed);
  const name = code ? countryDisplayName(code) : '';
  return [...new Set([trimmed, code, name].filter(Boolean))];
}

/**
 * Case-insensitive regex matching any free-text country variant for `raw`.
 * Returns `null` when `raw` is empty.
 */
export function freeTextCountryRegex(raw) {
  const parts = freeTextCountryMatchValues(raw).map(escapeRegExp);
  if (!parts.length) return null;
  return new RegExp(parts.join('|'), 'i');
}

/**
 * Safe human location line: skips empty city / region / country parts.
 * Never fabricates a country when none is present.
 *
 * @param {object} input
 * @param {string|string[]} [locale='en']
 * @returns {string}
 */
export function formatLocationDisplay(input = {}, locale = 'en') {
  const { countryCode, region, city } = normalizeLocation(input);
  const countryLabel =
    (countryCode ? countryDisplayName(countryCode, locale) : '') ||
    str(input.country) ||
    str(input.countryName) ||
    '';
  return [city, region, countryLabel].filter(Boolean).join(', ');
}

export default normalizeLocation;
