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
  PROVIDER_CAPABILITY_EVIDENCE_REVIEWED: 'provider_capability_evidence_reviewed',
  PROVIDER_CAPABILITY_EVIDENCE_ACCEPTED: 'provider_capability_evidence_accepted',
  PROVIDER_CAPABILITY_EVIDENCE_REJECTED: 'provider_capability_evidence_rejected',
  PROVIDER_CAPABILITY_EVIDENCE_BACKED: 'provider_capability_evidence_backed',
  PROVIDER_CAPABILITY_VERIFIED: 'provider_capability_verified',
  PROVIDER_CAPABILITY_NEEDS_INFORMATION: 'provider_capability_needs_information',
  PROVIDER_CAPABILITY_REJECTED: 'provider_capability_rejected',
  PROTECTED_TITLE_VERIFIED: 'protected_title_verified',
  PROTECTED_TITLE_DENIED: 'protected_title_denied',
  PROVIDER_SUBJECT_CONTEXT_DENIED: 'provider_subject_context_denied',
  PROVIDER_CAPABILITY_CLAIM_CREATED: 'provider_capability_claim_created',
  PROVIDER_CAPABILITY_SCOPE_UPDATED: 'provider_capability_scope_updated',
  GBS_LISTING_DRAFT_CREATED: 'gbs_listing_draft_created',
  GBS_LISTING_UPDATED: 'gbs_listing_updated',
  GBS_LISTING_MATERIAL_CHANGE: 'gbs_listing_material_change',
  GBS_LISTING_SUBMITTED_REVIEW: 'gbs_listing_submitted_review',
  GBS_LISTING_ARCHIVED: 'gbs_listing_archived',
  GBS_LISTING_SCOPE_DENIED: 'gbs_listing_scope_denied',
  GBS_LISTING_RISK_FLAGGED: 'gbs_listing_risk_flagged',
  GBS_LISTING_IDEMPOTENCY_REPLAY: 'gbs_listing_idempotency_replay',
  GBS_LISTING_IDEMPOTENCY_CONFLICT: 'gbs_listing_idempotency_conflict',
  GBS_LISTING_REVIEWED: 'gbs_listing_reviewed',
  GBS_LISTING_APPROVED: 'gbs_listing_approved',
  GBS_LISTING_NEEDS_INFORMATION: 'gbs_listing_needs_information',
  GBS_LISTING_REJECTED: 'gbs_listing_rejected',
  GBS_LISTING_SUSPENDED: 'gbs_listing_suspended',
  PROVIDER_DOMAIN_SELECTED: 'provider_domain_selected',
  PROVIDER_DOMAIN_ADDED: 'provider_domain_added',
  PROVIDER_DOMAIN_ONBOARDING_COMPLETED: 'provider_domain_onboarding_completed',
  PROVIDER_DOMAIN_ACCESS_DENIED: 'provider_domain_access_denied',
  AGENCY_PROVIDER_DOMAIN_ACTIVATED: 'agency_provider_domain_activated',
  TEAM_DOMAIN_ACCESS_GRANTED: 'team_domain_access_granted',
  TEAM_DOMAIN_ACCESS_UPDATED: 'team_domain_access_updated',
  TEAM_DOMAIN_ACCESS_REMOVED: 'team_domain_access_removed',
  PROVIDER_WORKSPACE_CONTEXT_DENIED: 'provider_workspace_context_denied',
  GBS_BUSINESS_CLIENT_ACTIVATED: 'gbs_business_client_activated',
  GBS_SERVICE_REQUEST_CREATED: 'gbs_service_request_created',
  GBS_SERVICE_REQUEST_STATUS_UPDATED: 'gbs_service_request_status_updated',
  GBS_SERVICE_REQUEST_DECLINED: 'gbs_service_request_declined',
  GBS_SERVICE_REQUEST_CANCELLED: 'gbs_service_request_cancelled',
  GBS_SERVICE_REQUEST_READY_FOR_QUOTE: 'gbs_service_request_ready_for_quote',
  GBS_QUOTE_CREATED: 'gbs_quote_created',
  GBS_QUOTE_UPDATED: 'gbs_quote_updated',
  GBS_QUOTE_SENT: 'gbs_quote_sent',
  GBS_QUOTE_ACCEPTED: 'gbs_quote_accepted',
  GBS_QUOTE_DECLINED: 'gbs_quote_declined',
  GBS_QUOTE_WITHDRAWN: 'gbs_quote_withdrawn',
  GBS_QUOTE_EXPIRED: 'gbs_quote_expired',
  GBS_CASE_CREATED: 'gbs_case_created',
  GBS_CASE_STAGE_CHANGED: 'gbs_case_stage_changed',
  GBS_CASE_CUSTOMER_ACTION_REQUESTED: 'gbs_case_customer_action_requested',
  GBS_CASE_CUSTOMER_ACTION_COMPLETED: 'gbs_case_customer_action_completed',
  GBS_CASE_CANCELLED: 'gbs_case_cancelled',
  GBS_CASE_UNABLE_TO_PROCEED: 'gbs_case_unable_to_proceed',
  GBS_CASE_READY_FOR_SUBMISSION: 'gbs_case_ready_for_submission',
  GBS_CASE_GENERIC_SERVICE_COMPLETED: 'gbs_case_generic_service_completed',
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
  'customerSummary',
  'existingBusinessName',
  'email',
  'phone',
  'whatsapp',
  'providerTerms',
  'declineNote',
  'customerValue',
  'closureNote',
  'cancellationNote',
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
