/**
 * In-session employer activation milestone markers (per user id).
 * Completion analytics must fire on real product transitions only — not dashboard revisits.
 * Not authoritative product truth; not persisted when analytics consent is denied.
 */
import { allowsAnalytics } from '../../../consent/cookieConsentStorage.js';

const PREFIX = 'strideto-employer-activation-milestone';

/** In-memory fallback when localStorage is unavailable (SSR/tests). */
const memoryMilestones = new Set();

export const ACTIVATION_MILESTONE_KEYS = {
  PROFILE_COMPLETED: 'profile_completed',
  ACTIVATION_COMPLETED: 'activation_completed',
};

function scopedKey(userId, milestoneKey) {
  const id = userId ? String(userId) : 'anon';
  return `${PREFIX}:${id}:${milestoneKey}`;
}

export function hasEmployerActivationMilestone(userId, milestoneKey) {
  if (!userId || !milestoneKey) return false;
  const key = scopedKey(userId, milestoneKey);
  if (memoryMilestones.has(key)) return true;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return memoryMilestones.has(key);
  }
}

/** @returns {boolean} true if milestone was newly recorded */
export function markEmployerActivationMilestone(userId, milestoneKey) {
  if (!userId || !milestoneKey) return false;
  const key = scopedKey(userId, milestoneKey);
  if (hasEmployerActivationMilestone(userId, milestoneKey)) return false;
  try {
    localStorage.setItem(key, '1');
    return true;
  } catch {
    memoryMilestones.add(key);
    return true;
  }
}

/**
 * Run trackFn once per user+milestone (first transition only).
 * @returns {boolean} whether the event was emitted
 */
export function emitEmployerActivationMilestoneOnce(userId, milestoneKey, trackFn) {
  if (!userId || !milestoneKey || typeof trackFn !== 'function') return false;
  if (!allowsAnalytics()) return false;
  if (!markEmployerActivationMilestone(userId, milestoneKey)) return false;
  trackFn();
  return true;
}

/** Test isolation */
export function resetEmployerActivationMilestonesForTests() {
  memoryMilestones.clear();
  if (typeof localStorage === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}:`)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
