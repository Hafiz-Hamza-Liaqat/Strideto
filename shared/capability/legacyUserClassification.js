/**
 * Server-authoritative legacy User classification (Phase 17D-1).
 *
 * Temporary compatibility bridge for capability-uninitialized User records.
 * NEVER consults activeWorkspace, localStorage, navigation, last visited page,
 * frontend role copy, or UI state.
 *
 * Genuine Student/customer evidence: User.role === 'User' (RBAC STUDENT).
 * Staff/admin-only: Editor | Moderator | Admin | SuperAdmin.
 * Anything else: fail closed.
 */
import { isCapabilitySchemaInitialized } from './grantStatus.js';

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
  AMBIGUOUS: 'ambiguous',
});

export function isLegacyStaffRole(role) {
  return typeof role === 'string' && STAFF_SET.has(role);
}

export function isLegacyCustomerRole(role) {
  return role === LEGACY_CUSTOMER_ROLE;
}

/**
 * @param {{ role?: string, capabilitySchemaVersion?: number }} user
 */
export function classifyLegacyUserAccount(user = {}) {
  if (isCapabilitySchemaInitialized(user.capabilitySchemaVersion)) {
    return Object.freeze({
      kind: LEGACY_CLASSIFICATIONS.INITIALIZED,
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
