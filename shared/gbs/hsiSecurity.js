/**
 * GBS HSI security runtime contracts (Phase 17D-8B2A).
 *
 * Engineering infrastructure only. Production HSI activation remains OFF.
 * No legal retention durations. No Wyoming pack. No filing consent.
 */
export const GBS_HSI_FEATURE_FLAG = 'GBS_HSI_DOCUMENTS_ENABLED';

export const HSI_AAD_SCHEMA_VERSION = 'hsi-aad.v1';
export const HSI_SECURITY_POLICY_VERSION = 'hsi-policy.v1';
export const HSI_ENVELOPE_ALGORITHM = 'aes-256-gcm';
export const HSI_KEY_PROVIDER = 'vault-transit';
export const HSI_STORAGE_PROVIDER = 'minio';
export const HSI_SCAN_ENGINE = 'clamav-clamd';

export const HSI_STORAGE_CLASSES = Object.freeze({
  QUARANTINE: 'quarantine',
  CLEAN: 'clean',
  DESTROYED: 'destroyed',
});

export const HSI_SCAN_JOB_STATUSES = Object.freeze({
  QUEUED: 'queued',
  LEASED: 'leased',
  CLEAN: 'clean',
  REJECTED: 'rejected',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  DEAD: 'dead',
});

export const HSI_SCAN_JOB_TERMINAL = Object.freeze([
  HSI_SCAN_JOB_STATUSES.CLEAN,
  HSI_SCAN_JOB_STATUSES.REJECTED,
  HSI_SCAN_JOB_STATUSES.FAILED,
  HSI_SCAN_JOB_STATUSES.TIMEOUT,
  HSI_SCAN_JOB_STATUSES.DEAD,
]);

export const HSI_CLAMAV_VERDICTS = Object.freeze({
  CLEAN: 'clean',
  REJECTED: 'rejected',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
});

export const HSI_RETENTION_CLASSES = Object.freeze({
  UNUSED_UPLOAD: 'unused_upload',
  SCANNER_REJECTED_MALWARE: 'scanner_rejected_malware',
  SUPERSEDED_VERSION: 'superseded_version',
  ACCEPTED_CASE_EVIDENCE: 'accepted_case_evidence',
  CANCELLED_CASE: 'cancelled_case',
  HSI_IDENTITY: 'hsi_identity',
  FILING_CONSENT: 'filing_consent',
  AUDIT_LOG: 'audit_log',
  SUBMITTED_FILING_EVIDENCE: 'submitted_filing_evidence',
  EVIDENCE_HOLD: 'evidence_hold',
});

export const HSI_REQUIRED_RETENTION_CLASSES = Object.freeze(Object.values(HSI_RETENTION_CLASSES));

export const HSI_SCAN_MAX_ATTEMPTS = 3;
export const HSI_SCAN_ATTEMPT_TIMEOUT_MS = 30_000;
export const HSI_SCAN_LEASE_MS = 45_000;
export const HSI_SCAN_EXECUTOR_HEARTBEAT_STALE_MS = 90_000;

export const HSI_SECURITY_CODES = Object.freeze({
  DISABLED: 'hsi_documents_disabled',
  NOT_READY: 'hsi_security_not_ready',
  SCAN_PENDING: 'document_scan_pending',
  SCAN_FAILED: 'document_scan_failed',
  MALWARE_REJECTED: 'document_malware_rejected',
  ENCRYPTION_FAILED: 'document_encryption_failed',
  KMS_UNAVAILABLE: 'document_kms_unavailable',
  STORAGE_UNAVAILABLE: 'document_storage_unavailable',
  AUDIT_UNAVAILABLE: 'document_audit_unavailable',
  SCANNER_UNAVAILABLE: 'document_scanner_unavailable',
});

export function isGbsHsiDocumentsEnabled(env) {
  const source = env || (typeof process !== 'undefined' ? process.env : {});
  return source?.GBS_HSI_DOCUMENTS_ENABLED === '1';
}

export function isHsiScanJobTerminal(status) {
  return HSI_SCAN_JOB_TERMINAL.includes(status);
}

export function hsiScanBackoffMs(attempt) {
  const n = Math.max(1, Number(attempt) || 1);
  return Math.min(60_000, 1000 * (2 ** Math.min(n, 5)));
}
