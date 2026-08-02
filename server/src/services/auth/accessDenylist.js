import { getRedisClient } from '../../config/redis.js';

/**
 * SEC-3E — jti-keyed access-token denylist, built to the exact hardening
 * contract frozen in
 * docs/STRIDETO_SEC_3D_REVOCATION_ACCOUNT_STATE_READINESS_AUDIT.md §12.1.
 * Key material is the token's own `jti` claim, never the raw token or a
 * hash of it.
 *
 * In production, a missing/unreachable shared store fails
 * every check and every write closed (`STORAGE_FAILURE`) — it never
 * silently falls back to a process-local `Map`, per §12.1's explicit
 * "no process-local fallback path may exist in the production code path
 * at all." In local development or automated tests that
 * construct this service directly), an in-memory fallback keeps the
 * module usable without a real Redis instance.
 */

const REVOKED_JTI_PREFIX = 'strideto:revoked-jti:';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * @param {object} [config]
 * @param {boolean} [config.requireSharedStore] — when true, a missing or
 *   unreachable Redis client fails closed instead of falling back to an
 *   in-memory `Map`. Should be `true` whenever
 *   `secureAuthConfig.requireSharedDenylistStore` is true (production).
 * @param {() => Promise<object|null>} [config.getClient] — defaults to
 *   `getRedisClient` from `config/redis.js`; injectable for tests.
 */
export function createAccessDenylistService({
  requireSharedStore = false,
  getClient = getRedisClient,
} = {}) {
  if (typeof getClient !== 'function') {
    throw new TypeError('A getClient() function is required');
  }

  // Fallback tier — used only when requireSharedStore is false and no
  // Redis client is available. Never consulted in the required-shared-
  // store branch, by construction (that branch returns before this map is
  // ever touched).
  const fallbackStore = new Map();

  function fallbackKey(jti) {
    return `${REVOKED_JTI_PREFIX}${jti}`;
  }

  function fallbackSweepExpired() {
    const now = Date.now();
    for (const [key, expiresAt] of fallbackStore) {
      if (expiresAt <= now) fallbackStore.delete(key);
    }
  }

  /**
   * Prove required shared security state is available before credentials
   * are created or rotated. A cached socket flag is not sufficient: only
   * a real Redis PING succeeds. The existing client dependency is reused;
   * this method never constructs another client or reads its configuration.
   */
  async function assertAvailable() {
    let client;
    try {
      client = await getClient();
    } catch {
      client = null;
    }

    if (!client) {
      return Object.freeze({
        code: requireSharedStore ? 'STORAGE_FAILURE' : 'AVAILABLE',
      });
    }

    try {
      if (typeof client.ping !== 'function') {
        return Object.freeze({ code: 'STORAGE_FAILURE' });
      }
      await client.ping();
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    return Object.freeze({ code: 'AVAILABLE' });
  }

  /**
   * Denylist one access token's `jti` for exactly its own remaining
   * lifetime. `ttlSeconds` must be the caller's own computed
   * `exp - nowSeconds` — this module never derives it independently. A
   * non-positive or non-finite TTL means the token is already expired (or
   * its expiry could not be trusted); no entry is written, matching
   * §12.1's "an already-expired token requires no denylist entry at all."
   */
  async function denylistJti(jti, ttlSeconds) {
    if (!isNonEmptyString(jti)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      return Object.freeze({ code: 'DENYLIST_SKIPPED_EXPIRED' });
    }
    const wholeSeconds = Math.ceil(ttlSeconds);

    let client;
    try {
      client = await getClient();
    } catch {
      client = null;
    }

    if (!client) {
      if (requireSharedStore) {
        return Object.freeze({ code: 'STORAGE_FAILURE' });
      }
      fallbackSweepExpired();
      fallbackStore.set(fallbackKey(jti), Date.now() + wholeSeconds * 1000);
      return Object.freeze({ code: 'DENYLISTED' });
    }

    try {
      await client.set(fallbackKey(jti), '1', 'EX', wholeSeconds);
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    return Object.freeze({ code: 'DENYLISTED' });
  }

  /** Idempotent by construction — a repeated write with an equal-or-shorter TTL is safe (plain key overwrite, no read-modify-write). */
  async function isJtiDenylisted(jti) {
    if (!isNonEmptyString(jti)) {
      return Object.freeze({ code: 'INVALID_INPUT' });
    }

    let client;
    try {
      client = await getClient();
    } catch {
      client = null;
    }

    if (!client) {
      if (requireSharedStore) {
        return Object.freeze({ code: 'STORAGE_FAILURE' });
      }
      fallbackSweepExpired();
      const denylisted = fallbackStore.has(fallbackKey(jti));
      return Object.freeze({ code: 'CHECKED', denylisted });
    }

    let value;
    try {
      value = await client.get(fallbackKey(jti));
    } catch {
      return Object.freeze({ code: 'STORAGE_FAILURE' });
    }
    return Object.freeze({ code: 'CHECKED', denylisted: Boolean(value) });
  }

  return Object.freeze({
    assertAvailable,
    denylistJti,
    isJtiDenylisted,
  });
}
