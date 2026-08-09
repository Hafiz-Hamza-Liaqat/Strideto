/**
 * International address contract (Mission 1 — International Foundation).
 *
 * An additive, reusable structured address suitable for Users, Employers,
 * Agents/Agencies and Institutions. It makes NO Pakistan-only assumptions: the
 * only always-required field is a canonical ISO 3166 `countryCode`; region,
 * postal code and address lines are optional because their necessity varies by
 * jurisdiction. Coordinates and a Google Maps URL are optional supporting
 * location evidence, never identity proof.
 *
 * Existing Employer addresses (free-text `location`/`city`/`province`) are NOT
 * migrated destructively in Mission 1 — `fromLegacyEmployer` adapts them into
 * this shape for read/preview so migration can happen incrementally later.
 *
 * Client- and server-safe: pure JS.
 */
import { normalizeCountryCode, normalizeSubdivisionCode, coerceCountryCode } from './country.js';
import { normalizeCoordinates, normalizeGoogleMapsUrl } from './geo.js';

/**
 * The canonical shape of a structured address. Fields default to '' / absent so
 * a valid minimal address is just `{ countryCode }`.
 */
export const ADDRESS_FIELDS = Object.freeze([
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'postalCode',
  'countryCode',
  'latitude',
  'longitude',
  'googleMapsUrl',
]);

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Validate + normalize an untrusted address candidate.
 *
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateAddress(input = {}) {
  const errors = [];
  const out = {};

  const countryCode = normalizeCountryCode(input.countryCode);
  if (!countryCode) {
    errors.push('countryCode must be a valid ISO 3166-1 alpha-2 code');
  } else {
    out.countryCode = countryCode;
  }

  out.addressLine1 = str(input.addressLine1);
  out.addressLine2 = str(input.addressLine2);
  out.city = str(input.city);
  out.postalCode = str(input.postalCode);

  // Region accepts a canonical ISO 3166-2 subdivision when it looks like one,
  // otherwise a free-text label (many jurisdictions have no code we validate).
  if (input.region !== undefined && input.region !== null && str(input.region)) {
    out.region = normalizeSubdivisionCode(input.region) || str(input.region);
  } else {
    out.region = '';
  }

  try {
    const coords = normalizeCoordinates({
      latitude: input.latitude,
      longitude: input.longitude,
    });
    if (coords) {
      out.latitude = coords.latitude;
      out.longitude = coords.longitude;
    }
  } catch (err) {
    errors.push(err.message);
  }

  if (input.googleMapsUrl !== undefined && input.googleMapsUrl !== null && str(input.googleMapsUrl)) {
    const maps = normalizeGoogleMapsUrl(input.googleMapsUrl);
    if (!maps) {
      errors.push('googleMapsUrl must be an HTTPS Google Maps link');
    } else {
      out.googleMapsUrl = maps;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: out };
}

/** Convenience boolean wrapper around `validateAddress`. */
export function isValidAddress(input) {
  return validateAddress(input).ok;
}

/**
 * Compatibility adapter: shape a legacy Employer's free-text location fields
 * into the structured contract for read/preview. Country is best-effort coerced
 * (legacy records rarely stored a code); an unresolved country yields no
 * `countryCode` rather than a fabricated Pakistan default.
 */
export function fromLegacyEmployer(employer = {}) {
  const out = {
    addressLine1: str(employer.location),
    addressLine2: '',
    city: str(employer.city),
    region: str(employer.province),
    postalCode: '',
    googleMapsUrl: '',
  };
  const countryCode = coerceCountryCode(employer.country);
  if (countryCode) out.countryCode = countryCode;
  return out;
}
