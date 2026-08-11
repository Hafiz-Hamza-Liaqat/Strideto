import { getRedisClient } from '../config/redis.js';

/**
 * Shared Redis hit-counter for express-rate-limit v7.
 * Falls back to process-local memory when Redis is unavailable (dev/test).
 * Production secure-auth already requires Redis, so replica bypass is closed there.
 */
export function createRedisRateLimitStore(prefix) {
  const memory = new Map();
  const store = {
    localKeys: false,
    windowMs: 60_000,
    prefix: `rl:${prefix}:`,
    init(options) {
      if (options?.windowMs) store.windowMs = options.windowMs;
    },
    async increment(key) {
      const redis = await getRedisClient().catch(() => null);
      if (!redis) return memoryIncrement(memory, key, store.windowMs);
      const full = store.prefix + key;
      const hits = await redis.incr(full);
      if (hits === 1) await redis.pexpire(full, store.windowMs);
      let ttl = await redis.pttl(full);
      if (ttl < 0) {
        await redis.pexpire(full, store.windowMs);
        ttl = store.windowMs;
      }
      return { totalHits: Number(hits), resetTime: new Date(Date.now() + ttl) };
    },
    async decrement(key) {
      const redis = await getRedisClient().catch(() => null);
      if (!redis) return memoryDecrement(memory, key);
      const full = store.prefix + key;
      const next = await redis.decr(full);
      if (next < 0) await redis.set(full, 0, 'PX', store.windowMs, 'XX');
    },
    async resetKey(key) {
      const redis = await getRedisClient().catch(() => null);
      if (!redis) {
        memory.delete(key);
        return;
      }
      await redis.del(store.prefix + key);
    },
  };
  return store;
}

function memoryIncrement(memory, key, windowMs) {
  const now = Date.now();
  const current = memory.get(key);
  if (!current || current.resetTime <= now) {
    const resetTime = now + windowMs;
    memory.set(key, { totalHits: 1, resetTime });
    return { totalHits: 1, resetTime: new Date(resetTime) };
  }
  current.totalHits += 1;
  return { totalHits: current.totalHits, resetTime: new Date(current.resetTime) };
}

function memoryDecrement(memory, key) {
  const current = memory.get(key);
  if (current && current.totalHits > 0) current.totalHits -= 1;
}
