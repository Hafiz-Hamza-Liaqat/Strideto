/**
 * Consent / data-sharing contract (Phase 1 — shared platform foundation).
 *
 * Each flow carries an independent consent scope. No broad "Agent can see
 * Student" or "Institution can see Student" consents.
 */

export const CONSENT_PURPOSES = Object.freeze({
  EMPLOYER_APPLICATION: 'employer_application',
  AGENT_CONSULTATION: 'agent_consultation',
  AGENT_CASE: 'agent_case',
  INSTITUTION_ADMISSION: 'institution_admission',
  VAULT_GRANT: 'vault_grant',
});

export const CONSENT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

const PURPOSE_SET = new Set(Object.values(CONSENT_PURPOSES));
const STATUS_SET = new Set(Object.values(CONSENT_STATUSES));

export function isValidConsentPurpose(value) {
  return typeof value === 'string' && PURPOSE_SET.has(value);
}

export function isValidConsentStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

/**
 * Validate a consent record shape.
 *
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateConsentRecord(input = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['consent must be an object'] };
  }
  const {
    subjectId,
    counterpartyId,
    counterpartyType,
    purpose,
    resourceScope,
    grantedAt,
    expiresAt,
    revokedAt,
    provenance,
    auditIdentity,
  } = input;

  if (!subjectId) errors.push('subjectId is required');
  if (!counterpartyId) errors.push('counterpartyId is required');
  if (!counterpartyType) errors.push('counterpartyType is required');
  if (!isValidConsentPurpose(purpose)) errors.push(`invalid purpose: ${purpose}`);
  if (!resourceScope || typeof resourceScope !== 'string') {
    errors.push('resourceScope must identify the shared resource/fields');
  }
  if (!grantedAt) errors.push('grantedAt is required');
  if (revokedAt && expiresAt && new Date(revokedAt) > new Date(expiresAt)) {
    errors.push('revokedAt cannot be after expiresAt');
  }
  if (!provenance) errors.push('provenance is required');
  if (!auditIdentity) errors.push('auditIdentity is required');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      subjectId,
      counterpartyId,
      counterpartyType,
      purpose,
      resourceScope,
      grantedAt,
      expiresAt: expiresAt || null,
      revokedAt: revokedAt || null,
      provenance,
      auditIdentity,
    },
  };
}

/** True when consent is currently effective (not revoked/expired). */
export function isConsentActive(record, now = new Date()) {
  if (!record || record.revokedAt) return false;
  if (record.expiresAt && new Date(record.expiresAt) <= now) return false;
  return true;
}
