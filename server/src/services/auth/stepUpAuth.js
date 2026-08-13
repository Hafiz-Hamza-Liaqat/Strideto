import { isStepUpPurpose } from '../../../../shared/auth/stepUpPurposes.js';
import { cacheDel, cacheGet, cacheSet } from '../../config/redis.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const KEY_PREFIX = 'stepup:';

function keyOf({ realm, subjectId, purpose }) {
  return `${KEY_PREFIX}${realm}:${subjectId}:${purpose}`;
}

/**
 * Multi-instance step-up grant store. Redis TTL is preferred; the shared
 * cache helper falls back to process memory when Redis is unavailable.
 * Never stores passwords, raw tokens, or secrets.
 */
export async function createStepUpGrant({ realm, subjectId, purpose, ttlMs = DEFAULT_TTL_MS }) {
  if (!isStepUpPurpose(purpose) || !realm || !subjectId) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  const expiresAt = Date.now() + ttlMs;
  await cacheSet(keyOf({ realm, subjectId, purpose }), { expiresAt }, Math.ceil(ttlMs / 1000));
  return { ok: true, expiresAt };
}

export async function consumeStepUpGrant({ realm, subjectId, purpose }) {
  const key = keyOf({ realm, subjectId, purpose });
  const grant = await cacheGet(key);
  if (!grant || grant.expiresAt < Date.now()) {
    await cacheDel(key);
    return { ok: false, code: 'STEP_UP_REQUIRED' };
  }
  await cacheDel(key);
  return { ok: true };
}

export async function resetStepUpGrantsForTests() {
  await cacheDelPatternSafe();
}

async function cacheDelPatternSafe() {
  const { cacheDelPattern } = await import('../../config/redis.js');
  await cacheDelPattern(KEY_PREFIX);
}
