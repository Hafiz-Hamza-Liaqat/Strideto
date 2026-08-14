/**
 * Server-authoritative legacy User classification (Phase 17D-1 / 17D-1R2).
 *
 * Temporary compatibility bridge for genuine PRE-CAPABILITY historical User
 * records. NEVER consults activeWorkspace, localStorage, navigation, last
 * visited page, frontend role copy, or UI state.
 *
 * Legacy student fallback requires ALL of:
 * - historical legacy eligibility (missing/legacy initialization state)
 * - role === 'User'
 * - capability schema not initialized
 * - not security-denied elsewhere
 *
 * New capability-era pending/failed registrations MUST NOT receive Student
 * authority from this bridge. Their authority comes only from an explicit
 * active student grant after successful initialization.
 */
import { isCapabilitySchemaInitialized } from './grantStatus.js';
import {
  CAPABILITY_INITIALIZATION_STATES,
  isCapabilityEraIncomplete,
  resolveCapabilityInitializationState,
} from './capabilityInitialization.js';

export const LEGACY_CUSTOMER_ROLE = 'User';

export const LEGACY_STAFF_ROLES = Object.freeze([
  'Editor',
  'Moderator',
  'Admin',
  'SuperAdmin',
]);

const STAFF_SET = new Set(LEGACY_STAFF_ROLES);

export const LEGACY_CLASSIFICATIONS = Object.freeze({
  INITIALIZED: 'initialized',
  LEGACY_STUDENT_CUSTOMER: 'legacy_student_customer',
  LEGACY_STAFF_ONLY: 'legacy_staff_only',
  CAPABILITY_ERA_INCOMPLETE: 'capability_era_incomplete',
  AMBIGUOUS: 'ambiguous',
});

export function isLegacyStaffRole(role) {
  return typeof role === 'string' && STAFF_SET.has(role);
}

export function isLegacyCustomerRole(role) {
  return role === LEGACY_CUSTOMER_ROLE;
}

/**
 * Recovery may complete a capability-era Student registration only when
 * server-authoritative state proves it is that workflow — never because
 * role === 'User' alone.
 */
export function shouldRetryCapabilityEraRegistration(user = {}) {
  return isLegacyCustomerRole(user.role) && isCapabilityEraIncomplete(user);
}

/**
 * @param {{ role?: string, capabilitySchemaVersion?: number, capabilityInitializationState?: string }} user
 */
export function classifyLegacyUserAccount(user = {}) {
  const initState = resolveCapabilityInitializationState(user);

  if (initState === 'ambiguous') {
    return Object.freeze({
      kind: LEGACY_CLASSIFICATIONS.AMBIGUOUS,
      usePersistedGrants: true,
      effectiveStudent: false,
      failClosed: true,
      grantStudentOnBackfill: false,
    });
  }

  if (
    initState === CAPABILITY_INITIALIZATION_STATES.READY ||
    isCapabilitySchemaInitialized(user.capabilitySchemaVersion)
  ) {
    return Object.freeze({
      kind: LEGACY_CLASSIFICATIONS.INITIALIZED,
      usePersistedGrants: true,
      effectiveStudent: false,
      failClosed: false,
      grantStudentOnBackfill: false,
    });
  }

  if (isCapabilityEraIncomplete(user)) {
    return Object.freeze({
      kind: LEGACY_CLASSIFICATIONS.CAPABILITY_ERA_INCOMPLETE,
      usePersistedGrants: true,
      effectiveStudent: false,
      failClosed: false,
      grantStudentOnBackfill: false,
    });
  }

  if (isLegacyCustomerRole(user.role)) {
    return Object.freeze({
      kind: LEGACY_CLASSIFICATIONS.LEGACY_STUDENT_CUSTOMER,
      usePersistedGrants: false,
      effectiveStudent: true,
      failClosed: false,
      grantStudentOnBackfill: true,
    });
  }

  if (isLegacyStaffRole(user.role)) {
    return Object.freeze({
      kind: LEGACY_CLASSIFICATIONS.LEGACY_STAFF_ONLY,
      usePersistedGrants: false,
      effectiveStudent: false,
      failClosed: false,
      grantStudentOnBackfill: false,
    });
  }

  return Object.freeze({
    kind: LEGACY_CLASSIFICATIONS.AMBIGUOUS,
    usePersistedGrants: false,
    effectiveStudent: false,
    failClosed: true,
    grantStudentOnBackfill: false,
  });
}
