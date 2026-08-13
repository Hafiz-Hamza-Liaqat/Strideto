import { isStepUpPurpose } from '../../../../shared/auth/stepUpPurposes.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const grants = new Map();

function keyOf({ realm, subjectId, purpose }) {
  return `${realm}:${subjectId}:${purpose}`;
}

/**
 * Generic step-up grant store. Initial factor is current-password proof
 * performed by the caller. Stronger factors can issue the same grant later.
 */
export function createStepUpGrant({ realm, subjectId, purpose, ttlMs = DEFAULT_TTL_MS }) {
  if (!isStepUpPurpose(purpose) || !realm || !subjectId) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  const expiresAt = Date.now() + ttlMs;
  grants.set(keyOf({ realm, subjectId, purpose }), { expiresAt, used: false });
  return { ok: true, expiresAt };
}

export function consumeStepUpGrant({ realm, subjectId, purpose }) {
  const key = keyOf({ realm, subjectId, purpose });
  const grant = grants.get(key);
  if (!grant || grant.used || grant.expiresAt < Date.now()) {
    grants.delete(key);
    return { ok: false, code: 'STEP_UP_REQUIRED' };
  }
  grant.used = true;
  grants.delete(key);
  return { ok: true };
}

export function resetStepUpGrantsForTests() {
  grants.clear();
}
