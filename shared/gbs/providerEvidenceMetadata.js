/**
 * Non-HSI evidence metadata for provider review (Phase 17D-3).
 * No file uploads. URLs stored only. Website claims are not official proof.
 */
import { EVIDENCE_TYPES } from './providerEvidence.js';
import { GBS_PROVIDER_BOUNDS } from './constants.js';
import { validateStoredReferenceUrl } from './storedReferenceUrl.js';

const ALLOWED_TYPES = new Set([
  EVIDENCE_TYPES.REGULATORY_REGISTRATION,
  EVIDENCE_TYPES.AUTHORITY_CONFIRMATION,
  EVIDENCE_TYPES.OFFICIAL_REGISTRY_STATUS,
  EVIDENCE_TYPES.PHYSICAL_REGISTERED_OFFICE_CONFIRMATION,
  EVIDENCE_TYPES.STAFF_REVIEW_NOTE,
]);

export function validateEvidenceMetadataRow(input = {}) {
  const errors = [];
  const evidenceType = String(input.evidenceType || input.evidenceClass || '').trim();
  if (!ALLOWED_TYPES.has(evidenceType)) {
    errors.push('evidenceType is not an allowed metadata class');
  }
  if (evidenceType === EVIDENCE_TYPES.ORGANIZATION_ATTESTATION) {
    errors.push('organization attestation is not sufficient evidence');
  }
  if (evidenceType === 'website_claim') {
    errors.push('provider website is not official proof');
  }

  const referenceNumber =
    typeof input.referenceNumber === 'string' ? input.referenceNumber.trim() : '';
  if (referenceNumber.length > GBS_PROVIDER_BOUNDS.REFERENCE_MAX) {
    errors.push('referenceNumber too long');
  }

  const urlCheck = validateStoredReferenceUrl(input.officialRegistryUrl || input.sourceUrl || '');
  if (!urlCheck.ok) errors.push(urlCheck.error);

  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > GBS_PROVIDER_BOUNDS.NOTES_MAX) errors.push('notes too long');

  const issuingAuthorityId =
    typeof input.issuingAuthorityId === 'string' ? input.issuingAuthorityId.trim() : '';

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      evidenceType,
      evidenceClass: evidenceType,
      referenceNumber: referenceNumber || null,
      officialRegistryUrl: urlCheck.value || '',
      issuingAuthorityId: issuingAuthorityId || null,
      jurisdictionId: input.jurisdictionId ? String(input.jurisdictionId) : null,
      titleId: input.titleId ? String(input.titleId) : null,
      effectiveFrom: input.effectiveFrom || null,
      effectiveTo: input.effectiveTo || input.expiresAt || null,
      notes: notes || '',
      decision: 'pending',
    },
  };
}
