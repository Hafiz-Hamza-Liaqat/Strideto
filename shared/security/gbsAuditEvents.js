/**
 * Security / GBS foundation audit event catalog (Phase 17D-1).
 *
 * Reuses AuditLog / auditService. Do not log passwords, JWTs, refresh tokens,
 * verification tokens, cookies, DEK/KEK, passport, national ID, or document contents.
 */
export const GBS_AUDIT_EVENTS = Object.freeze({
  USER_CAPABILITY_GRANTED: 'user_capability_granted',
  USER_CAPABILITY_SUSPENDED: 'user_capability_suspended',
  USER_CAPABILITY_REVOKED: 'user_capability_revoked',
  ORGANIZATION_CAPABILITY_GRANTED: 'organization_capability_granted',
  ORGANIZATION_CAPABILITY_SUSPENDED: 'organization_capability_suspended',
  ORGANIZATION_CAPABILITY_REVOKED: 'organization_capability_revoked',
  CAPABILITY_DENIED: 'capability_denied',
  SECURITY_DENIED: 'security_denied',
  TENANT_DENIED: 'tenant_denied',
  PROVIDER_CAPABILITY_CLAIMED: 'provider_capability_claimed',
  PROVIDER_CAPABILITY_REVIEWED: 'provider_capability_reviewed',
  PROVIDER_CAPABILITY_SUSPENDED: 'provider_capability_suspended',
  PROVIDER_CAPABILITY_REVOKED: 'provider_capability_revoked',
  LISTING_SCOPE_DENIED: 'listing_scope_denied',
  OPTIMISTIC_CONCURRENCY_CONFLICT: 'optimistic_concurrency_conflict',
  IDEMPOTENCY_REPLAY: 'idempotency_replay',
  IDEMPOTENCY_CONFLICT: 'idempotency_conflict',
  IDEMPOTENCY_IN_FLIGHT: 'idempotency_in_flight',
  ROLE_TRANSITION_SCHEMA_INITIALIZED: 'role_transition_schema_initialized',
  ROLE_TRANSITION_CAPABILITIES_PRESERVED: 'role_transition_capabilities_preserved',
  ROLE_TRANSITION_STAFF_ONLY: 'role_transition_staff_only',
  JURISDICTION_CREATED: 'jurisdiction_created',
  JURISDICTION_REVIEWED: 'jurisdiction_reviewed',
  AUTHORITY_CREATED: 'authority_created',
  SOURCE_DRAFT_CREATED: 'source_draft_created',
  SOURCE_SUBMITTED: 'source_submitted',
  SOURCE_REVIEWED: 'source_reviewed',
  SOURCE_MARKED_STALE: 'source_marked_stale',
  SOURCE_SUPERSEDED: 'source_superseded',
  SOURCE_REJECTED: 'source_rejected',
  FEE_CREATED: 'fee_created',
  FEE_REVIEWED: 'fee_reviewed',
  FEE_SUPERSEDED: 'fee_superseded',
  PROVIDER_CAPABILITY_EVIDENCE_SUBMITTED: 'provider_capability_evidence_submitted',
  PROVIDER_CAPABILITY_EVIDENCE_BACKED: 'provider_capability_evidence_backed',
  PROVIDER_CAPABILITY_VERIFIED: 'provider_capability_verified',
  PROVIDER_CAPABILITY_NEEDS_INFORMATION: 'provider_capability_needs_information',
  PROVIDER_CAPABILITY_REJECTED: 'provider_capability_rejected',
  PROTECTED_TITLE_VERIFIED: 'protected_title_verified',
  PROTECTED_TITLE_DENIED: 'protected_title_denied',
});

const EVENT_SET = new Set(Object.values(GBS_AUDIT_EVENTS));

export function isKnownGbsAuditEvent(action) {
  return typeof action === 'string' && EVENT_SET.has(action);
}

export const AUDIT_SECRET_KEYS = Object.freeze([
  'password',
  'token',
  'jwt',
  'refreshToken',
  'accessToken',
  'verificationToken',
  'cookie',
  'cookies',
  'dek',
  'kek',
  'passport',
  'nationalId',
  'documentContents',
  'documentContent',
]);

export function redactAuditMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (AUDIT_SECRET_KEYS.some((s) => lower.includes(s.toLowerCase()))) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactAuditMetadata(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
