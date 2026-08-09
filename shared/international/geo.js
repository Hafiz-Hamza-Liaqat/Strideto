/**
 * Coordinate + map-link primitives (Mission 1 — International Foundation).
 *
 * Shared by the address contract and any future location feature. A Google Maps
 * URL is treated as SUPPORTING location evidence, never as identity proof: it is
 * validated only for being a genuine Google Maps host over HTTPS, and its
 * presence never upgrades trust on its own.
 *
 * Client- and server-safe: pure JS.
 */

/** True for a latitude in [-90, 90]. */
export function isValidLatitude(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

/** True for a longitude in [-180, 180]. */
export function isValidLongitude(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Validate a lat/lng pair. Both must be present and in range, or both absent.
 * Returns a normalized `{ latitude, longitude }` or `null` when absent, and
 * throws when exactly one is supplied or a value is out of range.
 */
export function normalizeCoordinates({ latitude, longitude } = {}) {
  const hasLat = latitude !== undefined && latitude !== null;
  const hasLng = longitude !== undefined && longitude !== null;
  if (!hasLat && !hasLng) return null;
  if (hasLat !== hasLng) {
    throw new Error('Coordinates require both latitude and longitude, or neither');
  }
  if (!isValidLatitude(latitude)) throw new Error('latitude out of range (-90..90)');
  if (!isValidLongitude(longitude)) throw new Error('longitude out of range (-180..180)');
  return { latitude, longitude };
}

const GOOGLE_MAPS_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
]);

/**
 * True only for an HTTPS Google Maps URL. Rejects other hosts, non-HTTPS, and
 * `google.com` paths that are not `/maps` (so a plain search link is not
 * mistaken for a map link). Short-link hosts (`goo.gl`, `maps.app.goo.gl`) are
 * accepted on host alone since their path is opaque.
 */
export function isGoogleMapsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (!GOOGLE_MAPS_HOSTS.has(host)) return false;
  if (host === 'goo.gl' || host === 'maps.app.goo.gl') return true;
  if (host === 'maps.google.com') return true;
  // google.com / www.google.com must be a /maps path to count as a map link.
  return url.pathname.toLowerCase().startsWith('/maps');
}

/** Normalized Google Maps URL string, or `null` when not an accepted map link. */
export function normalizeGoogleMapsUrl(value) {
  return isGoogleMapsUrl(value) ? value.trim() : null;
}
