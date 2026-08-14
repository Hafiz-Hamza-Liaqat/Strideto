/**
 * Capability grant lifecycle — source-controlled vocabulary (Phase 17D-1).
 *
 * Status=active is required to authorize. Suspended and revoked never authorize.
 * History is retained on the grant record; historical rows are not authority.
 */
export const GRANT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

const STATUS_SET = new Set(Object.values(GRANT_STATUSES));

export function isValidGrantStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function grantStatusAuthorizes(status) {
  return status === GRANT_STATUSES.ACTIVE;
}

/** Current User / Organization capability schema version written on initialize. */
export const CAPABILITY_SCHEMA_VERSION = 1;

/**
 * 0 / missing = legacy record not yet initialized.
 * >= CAPABILITY_SCHEMA_VERSION = grants are authoritative (including zero grants).
 */
export function isCapabilitySchemaInitialized(version) {
  const n = Number(version);
  return Number.isInteger(n) && n >= CAPABILITY_SCHEMA_VERSION;
}
