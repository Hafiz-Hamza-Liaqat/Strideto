/**
 * Secure Document Vault — shared constants (Mission 10).
 */

export const VAULT_DOCUMENT_TYPES = [
  'passport',
  'national_identity',
  'transcript',
  'degree_certificate',
  'marksheet',
  'language_test_result',
  'standardized_test_result',
  'cv_resume',
  'statement_of_purpose',
  'recommendation_letter',
  'financial_document',
  'employment_document',
  'portfolio',
  'admission_letter',
  'scholarship_letter',
  'visa_document',
  'other',
];

export const VAULT_DOCUMENT_STATUSES = [
  'active',
  'archived',
  'deleted_pending_retention',
];

export const VAULT_VERSION_SCAN_STATUSES = [
  'pending',
  'clean',
  'rejected',
  'failed',
  'not_configured',
];

export const VAULT_VERSION_LIFECYCLE_STATUSES = [
  'active',
  'superseded',
  'deleted_pending_retention',
];

export const VAULT_VERIFICATION_STATUSES = [
  'unverified',
  'pending',
  'verified',
  'rejected',
];

export const VAULT_PRIVACY_CLASSIFICATIONS = [
  'confidential',
  'restricted',
  'internal',
];

export const VAULT_GRANT_GRANTEE_TYPES = [
  'agent',
  'case',
  'system',
];

export const VAULT_GRANT_PERMISSIONS = [
  'view',
  'download',
];

export const VAULT_GRANT_STATUSES = [
  'active',
  'expired',
  'revoked',
];

export const VAULT_EXPIRY_STATES = [
  'valid',
  'expiring_soon',
  'expired',
  'unknown',
];

/** Days before expiry to flag as expiring_soon */
export const VAULT_EXPIRY_WARNING_DAYS = 30;

/** Max vault document file size: 20 MB */
export const VAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Allowed MIME types for vault uploads */
export const VAULT_ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Map MIME type to safe display extension */
export const VAULT_MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
