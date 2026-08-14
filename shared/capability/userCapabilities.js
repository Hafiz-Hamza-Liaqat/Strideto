/**
 * Canonical User Capability registry (Phase 17D-1).
 *
 * Authority lives in server-side grant objects, never in:
 * activeWorkspace, localStorage, frontend role copy, or last-visited route.
 *
 * Unknown capability IDs deny. They are never coerced to `student`.
 */
export const USER_CAPABILITY_IDS = Object.freeze({
  STUDENT: 'student',
  BUSINESS_CLIENT: 'business_client',
});

export const USER_CAPABILITY_REGISTRY = Object.freeze({
  [USER_CAPABILITY_IDS.STUDENT]: Object.freeze({
    id: USER_CAPABILITY_IDS.STUDENT,
    description: 'Student / career-customer product authority in the User realm',
    scopeRules: Object.freeze(['user_realm']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
  [USER_CAPABILITY_IDS.BUSINESS_CLIENT]: Object.freeze({
    id: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    description: 'Business Client / GBS buyer authority in the User realm',
    scopeRules: Object.freeze(['user_realm', 'organization_membership_when_org_scoped']),
    policyVersion: '17d-1.0',
    deprecated: false,
  }),
});

const ID_SET = new Set(Object.keys(USER_CAPABILITY_REGISTRY));

export function isKnownUserCapability(id) {
  return typeof id === 'string' && ID_SET.has(id);
}

export function getUserCapabilityDefinition(id) {
  if (!isKnownUserCapability(id)) return null;
  return USER_CAPABILITY_REGISTRY[id];
}

export function listUserCapabilityIds() {
  return Object.keys(USER_CAPABILITY_REGISTRY);
}
