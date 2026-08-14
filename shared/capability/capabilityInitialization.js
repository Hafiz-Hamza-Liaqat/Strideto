/**
 * Capability-era initialization state (Phase 17D-1R2).
 *
 * Distinguishes genuine pre-capability historical accounts from new
 * registration records whose grant/schema initialization has not completed.
 *
 * Missing / unset on a persisted User means historical legacy-eligible.
 * New User.create paths MUST write `pending` explicitly. Do not mongoose-default
 * this field — a default would rewrite historical documents on load.
 *
 * Never derived from workspace, localStorage, route, or UI.
 */
export const CAPABILITY_INITIALIZATION_STATES = Object.freeze({
  LEGACY: 'legacy',
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
});

const KNOWN = new Set(Object.values(CAPABILITY_INITIALIZATION_STATES));

export function isKnownCapabilityInitializationState(value) {
  return typeof value === 'string' && KNOWN.has(value);
}

/**
 * @returns {'legacy'|'pending'|'ready'|'failed'|'ambiguous'}
 */
export function resolveCapabilityInitializationState(user = {}) {
  const raw = user.capabilityInitializationState;
  if (raw == null || raw === '') return CAPABILITY_INITIALIZATION_STATES.LEGACY;
  if (raw === CAPABILITY_INITIALIZATION_STATES.LEGACY) return CAPABILITY_INITIALIZATION_STATES.LEGACY;
  if (raw === CAPABILITY_INITIALIZATION_STATES.PENDING) return CAPABILITY_INITIALIZATION_STATES.PENDING;
  if (raw === CAPABILITY_INITIALIZATION_STATES.READY) return CAPABILITY_INITIALIZATION_STATES.READY;
  if (raw === CAPABILITY_INITIALIZATION_STATES.FAILED) return CAPABILITY_INITIALIZATION_STATES.FAILED;
  return 'ambiguous';
}

export function isCapabilityEraIncomplete(user = {}) {
  const state = resolveCapabilityInitializationState(user);
  return (
    state === CAPABILITY_INITIALIZATION_STATES.PENDING ||
    state === CAPABILITY_INITIALIZATION_STATES.FAILED
  );
}

export function isHistoricalLegacyEligible(user = {}) {
  return resolveCapabilityInitializationState(user) === CAPABILITY_INITIALIZATION_STATES.LEGACY;
}
