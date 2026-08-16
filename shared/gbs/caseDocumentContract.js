/**
 * GBS Case document requirement contract (Phase 17D-8B1).
 *
 * Fail-closed infrastructure only. No HSI, no jurisdiction legal packs,
 * no filing consent, no government submission.
 */
import { VAULT_MAX_FILE_SIZE } from '../vault/constants.js';

export const GBS_CASE_DOCUMENT_SCHEMA_VERSION = '17d-8b1.0';

export const EMPTY_DOCUMENT_PACK_ID = 'gbs.case_documents.empty';
export const EMPTY_DOCUMENT_PACK_VERSION = 1;

export const TEST_ONLY_DOCUMENT_PACK_ID = 'gbs.case_documents.test_low_risk_v1';
export const TEST_ONLY_DOCUMENT_PACK_VERSION = 1;

export const GBS_DOCUMENT_SENSITIVITY = Object.freeze({
  LOW: 'low',
  MODERATE: 'business_confidential',
  HSI: 'highly_sensitive_identity',
});

export const GBS_DOCUMENT_SENSITIVITY_ALLOWED_B1 = Object.freeze([
  GBS_DOCUMENT_SENSITIVITY.LOW,
  GBS_DOCUMENT_SENSITIVITY.MODERATE,
]);

export const GBS_DOCUMENT_TYPES = Object.freeze({
  BUSINESS_OPERATIONAL: 'business_operational',
  CORRESPONDENCE: 'correspondence',
  WORKING_DRAFT: 'working_draft',
  OTHER_LOW_RISK: 'other_low_risk',
});

export const GBS_HSI_DOCUMENT_TYPES = Object.freeze([
  'passport',
  'national_identity',
  'national_id',
  'cnic',
  'kyc_proof_of_address',
  'proof_of_address',
  'signature',
  'signature_image',
  'tax_id',
  'tax_identifier',
  'ubo_identity',
  'beneficial_owner_identity',
]);

export const GBS_DOCUMENT_WHO_PROVIDES = Object.freeze({
  CUSTOMER: 'customer',
  PROVIDER: 'provider',
  EITHER: 'either',
});

export const GBS_DOCUMENT_REQUIREMENT_STATUSES = Object.freeze({
  AWAITING_UPLOAD: 'awaiting_upload',
  UPLOADED_PENDING_SCAN: 'uploaded_pending_scan',
  AVAILABLE_FOR_REVIEW: 'available_for_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WAIVED: 'waived',
});

export const GBS_DOCUMENT_REVIEW_STATES = Object.freeze({
  NONE: 'none',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

export const GBS_DOCUMENT_GRANT_GRANTEE_TYPES = Object.freeze({
  INDEPENDENT_PROVIDER: 'independent_provider',
  AGENCY_SUBJECT: 'agency_subject',
});

export const GBS_DOCUMENT_GRANT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
});

export const GBS_DOCUMENT_WAIVER_REASONS = Object.freeze({
  NOT_APPLICABLE_TO_THIS_SERVICE: 'not_applicable_to_this_service',
  DUPLICATE_OF_SATISFIED_REQUIREMENT: 'duplicate_of_satisfied_requirement',
});

export const GBS_CASE_DOCUMENT_MIMES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const GBS_CASE_DOCUMENT_DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const GBS_CASE_DOCUMENT_BOUNDS = Object.freeze({
  MAX_FILE_SIZE: VAULT_MAX_FILE_SIZE,
  MAX_FILES_PER_REQUIREMENT: 1,
  MAX_ACTIVE_FILES_PER_CASE: 8,
  MAX_BYTES_PER_CASE: 40 * 1024 * 1024,
  LABEL_MAX: 160,
  DESCRIPTION_MAX: 500,
  REF_MIN: 16,
  REF_MAX: 64,
  COMMAND_ID_MAX: 120,
});

export const GBS_DOCUMENT_SECURITY_CODES = Object.freeze({
  NOT_CONFIGURED: 'case_document_security_not_configured',
  HSI_NOT_CONFIGURED: 'hsi_documents_not_configured',
  HSI_DISABLED: 'hsi_documents_disabled',
  HSI_NOT_READY: 'hsi_security_not_ready',
  SCAN_NOT_CLEAN: 'document_scan_not_clean',
  SCAN_PENDING: 'document_scan_pending',
  SCAN_FAILED: 'document_scan_failed',
  MALWARE_REJECTED: 'document_malware_rejected',
  ENCRYPTION_FAILED: 'document_encryption_failed',
  KMS_UNAVAILABLE: 'document_kms_unavailable',
  STORAGE_UNAVAILABLE: 'document_storage_unavailable',
  DUTY_REQUIRED: 'case_documents_manage_required',
});

const STATUS_SET = new Set(Object.values(GBS_DOCUMENT_REQUIREMENT_STATUSES));
const SENSITIVITY_SET = new Set(Object.values(GBS_DOCUMENT_SENSITIVITY));
const TYPE_SET = new Set(Object.values(GBS_DOCUMENT_TYPES));
const HSI_TYPE_SET = new Set(GBS_HSI_DOCUMENT_TYPES);
const WHO_SET = new Set(Object.values(GBS_DOCUMENT_WHO_PROVIDES));
const WAIVER_SET = new Set(Object.values(GBS_DOCUMENT_WAIVER_REASONS));
const MIME_SET = new Set(GBS_CASE_DOCUMENT_MIMES);

export function isGbsDocumentRequirementStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function isAllowedB1Sensitivity(value) {
  return GBS_DOCUMENT_SENSITIVITY_ALLOWED_B1.includes(value);
}

export function isHsiSensitivity(value) {
  return value === GBS_DOCUMENT_SENSITIVITY.HSI
    || value === 'high'
    || value === 'very_high'
    || value === 'HIGHLY_SENSITIVE_IDENTITY';
}

export function isHsiDocumentType(value) {
  if (typeof value !== 'string') return false;
  const key = value.trim().toLowerCase();
  if (HSI_TYPE_SET.has(key)) return true;
  return /passport|cnic|national[_-]?id|kyc|proof[_-]?of[_-]?address|signature|tax[_-]?id|ubo|beneficial[_-]?owner/.test(key);
}

export function isAllowedGbsDocumentType(value) {
  return typeof value === 'string' && TYPE_SET.has(value);
}

export function isAllowedWhoProvides(value) {
  return typeof value === 'string' && WHO_SET.has(value);
}

export function isAllowedWaiverReason(value) {
  return typeof value === 'string' && WAIVER_SET.has(value);
}

export function isAllowedGbsDocumentMime(value, extra = []) {
  if (MIME_SET.has(value)) return true;
  return Array.isArray(extra) && extra.includes(value) && value === GBS_CASE_DOCUMENT_DOCX_MIME;
}

export function isOpaqueDocumentRef(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < GBS_CASE_DOCUMENT_BOUNDS.REF_MIN || trimmed.length > GBS_CASE_DOCUMENT_BOUNDS.REF_MAX) {
    return false;
  }
  if (/^DOC-\d+$/i.test(trimmed)) return false;
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function productionDocumentPackForTemplate() {
  return Object.freeze({
    packId: EMPTY_DOCUMENT_PACK_ID,
    packVersion: EMPTY_DOCUMENT_PACK_VERSION,
    consentRequired: false,
    testOnly: false,
    requirements: Object.freeze([]),
  });
}

export function testOnlyLowRiskRequirementTemplate() {
  return Object.freeze({
    requirementKey: 'test_low_risk_operational_note',
    label: 'TEST ONLY — low-risk operational note',
    description: 'Synthetic infrastructure fixture. Not a legal filing requirement.',
    category: 'operational',
    required: true,
    conditional: false,
    documentType: GBS_DOCUMENT_TYPES.BUSINESS_OPERATIONAL,
    acceptedMimeTypes: GBS_CASE_DOCUMENT_MIMES,
    maxFiles: 1,
    maxFileSize: GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE,
    sensitivityClass: GBS_DOCUMENT_SENSITIVITY.MODERATE,
    whoProvides: GBS_DOCUMENT_WHO_PROVIDES.CUSTOMER,
    reviewRequired: true,
    filingRequired: false,
    consentRequired: false,
    waivable: true,
    templateId: TEST_ONLY_DOCUMENT_PACK_ID,
    templateVersion: TEST_ONLY_DOCUMENT_PACK_VERSION,
    requirementVersion: 1,
  });
}

export function testOnlyLowRiskPack({ consentRequired = false } = {}) {
  return Object.freeze({
    packId: TEST_ONLY_DOCUMENT_PACK_ID,
    packVersion: TEST_ONLY_DOCUMENT_PACK_VERSION,
    consentRequired: consentRequired === true,
    testOnly: true,
    requirements: Object.freeze([testOnlyLowRiskRequirementTemplate()]),
  });
}

export function assertRequirementNotHsi(requirement = {}) {
  if (isHsiSensitivity(requirement.sensitivityClass) || isHsiDocumentType(requirement.documentType) || isHsiDocumentType(requirement.requirementKey)) {
    const err = Object.assign(new Error(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED), {
      status: 403,
      code: GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED,
    });
    throw err;
  }
  if (!isAllowedB1Sensitivity(requirement.sensitivityClass)) {
    const err = Object.assign(new Error(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED), {
      status: 403,
      code: GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED,
    });
    throw err;
  }
  if (!isAllowedGbsDocumentType(requirement.documentType)) {
    const err = Object.assign(new Error(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED), {
      status: 403,
      code: GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED,
    });
    throw err;
  }
}

export { SENSITIVITY_SET };
