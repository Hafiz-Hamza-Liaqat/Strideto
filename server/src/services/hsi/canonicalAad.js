/**
 * Canonical HSI additional authenticated data.
 *
 * Explicit ordered serialization — never JSON.stringify of an object.
 * Production crypto/AAD security review remains REQUIRED before HSI ON.
 */
import { HSI_AAD_SCHEMA_VERSION, HSI_SECURITY_POLICY_VERSION } from '../../../../shared/gbs/hsiSecurity.js';

export const CANONICAL_AAD_FIELD_ORDER = Object.freeze([
  'aadVersion',
  'environment',
  'caseId',
  'documentId',
  'vaultDocumentVersionId',
  'classification',
  'schemaVersion',
  'securityPolicyVersion',
]);

function rejectIllegal(value, field) {
  const text = String(value ?? '');
  if (!text) {
    const err = new Error('hsi_aad_incomplete');
    err.code = 'hsi_aad_incomplete';
    err.field = field;
    throw err;
  }
  if (/[\n\r\0=]/.test(text)) {
    const err = new Error('hsi_aad_illegal_char');
    err.code = 'hsi_aad_illegal_char';
    err.field = field;
    throw err;
  }
  return text;
}

export function encodeCanonicalAad(fields = {}) {
  const values = {
    aadVersion: fields.aadVersion || HSI_AAD_SCHEMA_VERSION,
    environment: fields.environment,
    caseId: fields.caseId,
    documentId: fields.documentId,
    vaultDocumentVersionId: fields.vaultDocumentVersionId,
    classification: fields.classification,
    schemaVersion: fields.schemaVersion,
    securityPolicyVersion: fields.securityPolicyVersion || HSI_SECURITY_POLICY_VERSION,
  };
  return CANONICAL_AAD_FIELD_ORDER
    .map((key) => `${key}=${rejectIllegal(values[key], key)}`)
    .join('\n');
}

export function canonicalAadBuffer(fields) {
  return Buffer.from(encodeCanonicalAad(fields), 'utf8');
}

export function transitWrapContext(environment) {
  return Buffer.from(`environment=${rejectIllegal(environment, 'environment')}`, 'utf8');
}
