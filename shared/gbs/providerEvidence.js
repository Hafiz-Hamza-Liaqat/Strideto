/**
 * Provider capability evidence metadata (Phase 17D-2).
 *
 * Sensitive scans stay Vault-bound when later enabled. No HSI sharing here.
 * Public-safe projection never includes document contents or registration secrets.
 */
export const EVIDENCE_TYPES = Object.freeze({
  REGULATORY_REGISTRATION: 'regulatory_registration',
  AUTHORITY_CONFIRMATION: 'authority_confirmation',
  ORGANIZATION_ATTESTATION: 'organization_attestation',
  STAFF_REVIEW_NOTE: 'staff_review_note',
  OTHER: 'other',
});

export const EVIDENCE_DECISIONS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  NEEDS_INFORMATION: 'needs_information',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

export function publicSafeEvidenceProjection(evidence = {}) {
  return {
    evidenceType: evidence.evidenceType || null,
    jurisdictionId: evidence.jurisdictionId || null,
    capabilityId: evidence.capabilityId || null,
    decision: evidence.decision || null,
    effectiveFrom: evidence.effectiveFrom || null,
    effectiveTo: evidence.effectiveTo || evidence.expiresAt || null,
    hasVaultRef: Boolean(evidence.vaultRef),
  };
}

export function evidenceIsCurrent(evidence = {}, { now = new Date() } = {}) {
  if (!evidence || evidence.decision !== EVIDENCE_DECISIONS.ACCEPTED) return false;
  const clock = now instanceof Date ? now : new Date(now);
  if (evidence.effectiveFrom && new Date(evidence.effectiveFrom) > clock) return false;
  const end = evidence.effectiveTo || evidence.expiresAt;
  if (end && new Date(end) <= clock) return false;
  return true;
}
