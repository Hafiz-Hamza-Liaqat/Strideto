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
  OFFICIAL_REGISTRY_STATUS: 'official_registry_status',
  PHYSICAL_REGISTERED_OFFICE_CONFIRMATION: 'physical_registered_office_confirmation',
  OTHER: 'other',
});

export const EVIDENCE_DECISIONS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  NEEDS_INFORMATION: 'needs_information',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

/** Staff review actions only. expired is not a staff review decision. */
export const STAFF_EVIDENCE_REVIEW_DECISIONS = Object.freeze([
  EVIDENCE_DECISIONS.ACCEPTED,
  EVIDENCE_DECISIONS.NEEDS_INFORMATION,
  EVIDENCE_DECISIONS.REJECTED,
]);

export const STAFF_EVIDENCE_REVIEW_ACTIONS = Object.freeze({
  accept: EVIDENCE_DECISIONS.ACCEPTED,
  'needs-information': EVIDENCE_DECISIONS.NEEDS_INFORMATION,
  reject: EVIDENCE_DECISIONS.REJECTED,
});

export function isStaffEvidenceReviewDecision(value) {
  return STAFF_EVIDENCE_REVIEW_DECISIONS.includes(value);
}

export function canTransitionEvidenceDecision(from, to) {
  if (!isStaffEvidenceReviewDecision(to)) return false;
  const current = from || EVIDENCE_DECISIONS.PENDING;
  if (current === to) return true;
  if (current === EVIDENCE_DECISIONS.PENDING) {
    return STAFF_EVIDENCE_REVIEW_DECISIONS.includes(to);
  }
  if (current === EVIDENCE_DECISIONS.NEEDS_INFORMATION) {
    return to === EVIDENCE_DECISIONS.ACCEPTED || to === EVIDENCE_DECISIONS.REJECTED;
  }
  return false;
}

export function publicSafeEvidenceProjection(evidence = {}) {
  return {
    evidenceType: evidence.evidenceType || null,
    jurisdictionId: evidence.jurisdictionId || null,
    capabilityId: evidence.capabilityId || null,
    decision: evidence.decision || null,
    effectiveFrom: evidence.effectiveFrom || null,
    effectiveTo: evidence.effectiveTo || evidence.expiresAt || null,
    submittedAt: evidence.submittedAt || evidence.createdAt || null,
    hasVaultRef: Boolean(evidence.vaultRef),
  };
}

export function adminSafeEvidenceProjection(evidence = {}, evidenceIndex = 0) {
  return {
    ...publicSafeEvidenceProjection(evidence),
    evidenceIndex,
    evidenceClass: evidence.evidenceClass || evidence.evidenceType || null,
    referenceNumber: evidence.referenceNumber || null,
    officialRegistryUrl: evidence.officialRegistryUrl || '',
    issuingAuthorityId: evidence.issuingAuthorityId || null,
    titleId: evidence.titleId || null,
    notes: evidence.notes || '',
    authorityClass: evidence.authorityClass || null,
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
