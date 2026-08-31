import crypto from 'crypto';
import { GOOGLE_JWKS_URI } from './googleOidcConfig.js';

/**
 * Bounded in-memory JWKS cache for Google's signing keys.
 *
 * Deliberately small and fail-closed. Google's key set is a handful of RSA
 * keys rotated on a slow schedule, so the whole problem is: keep them for a
 * finite TTL, refetch at most once when an unknown `kid` shows up, never grow
 * without bound, never retry forever, and refuse to verify anything when the
 * key set cannot be obtained.
 *
 * `fetchImpl` and `now` are injected so the entire cache is testable with no
 * network access.
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_TIMEOUT_MS = 5000;
/** Google publishes 2–3 keys; this is a sanity bound, not a tuning knob. */
const DEFAULT_MAX_KEYS = 16;
/** Floor between two network fetches, so an unknown `kid` cannot become a DoS. */
const DEFAULT_MIN_REFETCH_INTERVAL_MS = 60 * 1000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Accepts only the RSA signing keys this flow can actually use. Anything else
 * in the document — EC keys, encryption keys, malformed entries — is dropped
 * rather than stored, so an unusable key can never occupy a cache slot.
 */
function isUsableRsaSigningKey(jwk) {
  return (
    isPlainObject(jwk)
    && jwk.kty === 'RSA'
    && typeof jwk.kid === 'string'
    && jwk.kid.length > 0
    && typeof jwk.n === 'string'
    && typeof jwk.e === 'string'
    && (jwk.use === undefined || jwk.use === 'sig')
    && (jwk.alg === undefined || jwk.alg === 'RS256')
  );
}

/**
 * JWK to PEM without a new dependency: Node's `crypto.createPublicKey` accepts
 * JWK input directly, and `jsonwebtoken` accepts the exported SPKI PEM.
 */
export function jwkToPublicKeyPem(jwk) {
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

export function createGoogleJwksCache({
  jwksUri = GOOGLE_JWKS_URI,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  ttlMs = DEFAULT_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxKeys = DEFAULT_MAX_KEYS,
  minRefetchIntervalMs = DEFAULT_MIN_REFETCH_INTERVAL_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required');
  }
  if (!/^https:/i.test(jwksUri)) {
    throw new TypeError('The JWKS URI must be HTTPS');
  }

  /** @type {Map<string, string>} kid -> PEM */
  let keys = new Map();
  let fetchedAt = 0;
  let lastAttemptAt = 0;
  let inFlight = null;

  function isFresh() {
    return keys.size > 0 && now() - fetchedAt < ttlMs;
  }

  async function fetchOnce() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(jwksUri, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response || response.ok !== true) {
        return { code: 'JWKS_UNAVAILABLE' };
      }
      const payload = await response.json();
      if (!isPlainObject(payload) || !Array.isArray(payload.keys)) {
        return { code: 'JWKS_MALFORMED' };
      }
      const next = new Map();
      for (const jwk of payload.keys) {
        if (next.size >= maxKeys) break; // hard bound on accumulation
        if (!isUsableRsaSigningKey(jwk)) continue;
        try {
          next.set(jwk.kid, jwkToPublicKeyPem(jwk));
        } catch {
          // A key we cannot convert is simply not a key we can verify with.
        }
      }
      if (next.size === 0) return { code: 'JWKS_MALFORMED' };
      // Replace wholesale rather than merge: rotated-out keys must not linger.
      keys = next;
      fetchedAt = now();
      return { code: 'JWKS_LOADED' };
    } catch {
      return { code: 'JWKS_UNAVAILABLE' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Single-flight: concurrent verifications share one network fetch. */
  async function refresh() {
    if (inFlight) return inFlight;
    lastAttemptAt = now();
    inFlight = fetchOnce().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  /**
   * @returns {Promise<{code: string, pem?: string}>}
   *   `KEY_FOUND` | `UNKNOWN_KID` | `JWKS_UNAVAILABLE` | `JWKS_MALFORMED`
   */
  async function getSigningKey(kid) {
    if (typeof kid !== 'string' || kid.length === 0) {
      return Object.freeze({ code: 'UNKNOWN_KID' });
    }

    if (isFresh() && keys.has(kid)) {
      return Object.freeze({ code: 'KEY_FOUND', pem: keys.get(kid) });
    }

    if (!isFresh()) {
      const loaded = await refresh();
      if (loaded.code !== 'JWKS_LOADED') return Object.freeze(loaded);
      if (keys.has(kid)) {
        return Object.freeze({ code: 'KEY_FOUND', pem: keys.get(kid) });
      }
      // Already fetched this instant; a second attempt would learn nothing.
      return Object.freeze({ code: 'UNKNOWN_KID' });
    }

    // Fresh cache, unknown kid: Google may have rotated early. Refetch exactly
    // once, rate-limited, then give up. No loop, no retry schedule.
    if (now() - lastAttemptAt < minRefetchIntervalMs) {
      return Object.freeze({ code: 'UNKNOWN_KID' });
    }
    const reloaded = await refresh();
    if (reloaded.code !== 'JWKS_LOADED') return Object.freeze(reloaded);
    if (keys.has(kid)) {
      return Object.freeze({ code: 'KEY_FOUND', pem: keys.get(kid) });
    }
    return Object.freeze({ code: 'UNKNOWN_KID' });
  }

  function inspect() {
    return Object.freeze({
      size: keys.size,
      fetchedAt,
      fresh: isFresh(),
      maxKeys,
    });
  }

  function reset() {
    keys = new Map();
    fetchedAt = 0;
    lastAttemptAt = 0;
  }

  return Object.freeze({ getSigningKey, inspect, reset });
}

/** Process-wide cache used by the runtime verifier. */
export const googleJwksCache = createGoogleJwksCache();
