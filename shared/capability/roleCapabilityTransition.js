/**
 * Role-change ↔ capability transition contract (Phase 17D-1R1).
 *
 * ROLE != CAPABILITY. A role mutation must not infer Student / business_client
 * from the new role string, UI navigation, or workspace preference.
 *
 * The role-changing service selects a transition mode. Admin HTTP bodies
 * cannot choose it.
 */
export const ROLE_CAPABILITY_TRANSITION_MODES = Object.freeze({
  PRESERVE_EXISTING_CAPABILITIES: 'preserve_existing_capabilities',
  MAKE_STAFF_ONLY: 'make_staff_only',
});

/**
 * Administrative promotions cannot yet expose a capability-mode choice in UX.
 * Conservative default: keep grants the account already possessed; never
 * create student or business_client merely because role changed.
 */
export const DEFAULT_ADMIN_ROLE_TRANSITION_MODE =
  ROLE_CAPABILITY_TRANSITION_MODES.PRESERVE_EXISTING_CAPABILITIES;

const MODE_SET = new Set(Object.values(ROLE_CAPABILITY_TRANSITION_MODES));

export function isValidRoleCapabilityTransitionMode(value) {
  return typeof value === 'string' && MODE_SET.has(value);
}

export function resolveRoleCapabilityTransitionMode(value) {
  if (isValidRoleCapabilityTransitionMode(value)) return value;
  return DEFAULT_ADMIN_ROLE_TRANSITION_MODE;
}
