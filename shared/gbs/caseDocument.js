/**
 * GBS Case document DTO / allowlists (Phase 17D-8B1).
 */
import {
  GBS_CASE_DOCUMENT_BOUNDS,
  GBS_DOCUMENT_REQUIREMENT_STATUSES,
  GBS_DOCUMENT_REVIEW_STATES,
  GBS_DOCUMENT_WAIVER_REASONS,
  isAllowedWaiverReason,
  isOpaqueDocumentRef,
} from './caseDocumentContract.js';
import { parseExpectedVersion } from './case.js';

function rejectUnknown(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: 'unknown_field' };
  }
  return { ok: true };
}

const MUTATION_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
]);
const REVIEW_ALLOWED = new Set([...MUTATION_ALLOWED, 'expectedDocumentVersion']);
const REJECT_ALLOWED = new Set([...REVIEW_ALLOWED, 'reasonCode']);
const WAIVE_ALLOWED = new Set([...MUTATION_ALLOWED, 'waiverReason']);
const UPLOAD_ALLOWED = new Set([...MUTATION_ALLOWED]);

export function allowlistedDocumentMutationInput(body) {
  const unknown = rejectUnknown(body, MUTATION_ALLOWED);
  if (!unknown.ok) return unknown;
  return { ok: true, value: {} };
}

export function allowlistedDocumentUploadInput(body) {
  const unknown = rejectUnknown(body, UPLOAD_ALLOWED);
  if (!unknown.ok) return unknown;
  return { ok: true, value: {} };
}

export function allowlistedDocumentReviewInput(body) {
  const unknown = rejectUnknown(body, REVIEW_ALLOWED);
  if (!unknown.ok) return unknown;
  const expectedDocumentVersion = parseExpectedVersion(body?.expectedDocumentVersion ?? body?.expectedVersion);
  if (expectedDocumentVersion == null) return { ok: false, error: 'expected_version_required' };
  return { ok: true, value: { expectedDocumentVersion } };
}

export function allowlistedDocumentRejectInput(body) {
  const unknown = rejectUnknown(body, REJECT_ALLOWED);
  if (!unknown.ok) return unknown;
  const expectedDocumentVersion = parseExpectedVersion(body?.expectedDocumentVersion ?? body?.expectedVersion);
  if (expectedDocumentVersion == null) return { ok: false, error: 'expected_version_required' };
  return { ok: true, value: { expectedDocumentVersion, reasonCode: String(body?.reasonCode || 'needs_replacement').slice(0, 80) } };
}

export function allowlistedDocumentWaiveInput(body) {
  const unknown = rejectUnknown(body, WAIVE_ALLOWED);
  if (!unknown.ok) return unknown;
  const waiverReason = body?.waiverReason;
  if (!isAllowedWaiverReason(waiverReason)) return { ok: false, error: 'invalid_waiver_reason' };
  return { ok: true, value: { waiverReason } };
}

function safeStatusLabel(status) {
  if (status === GBS_DOCUMENT_REQUIREMENT_STATUSES.ACCEPTED) return 'Accepted for this Case requirement';
  if (status === GBS_DOCUMENT_REQUIREMENT_STATUSES.REJECTED) return 'Replacement needed';
  if (status === GBS_DOCUMENT_REQUIREMENT_STATUSES.WAIVED) return 'Waived for this Case';
  if (status === GBS_DOCUMENT_REQUIREMENT_STATUSES.AVAILABLE_FOR_REVIEW) return 'Available for review';
  if (status === GBS_DOCUMENT_REQUIREMENT_STATUSES.UPLOADED_PENDING_SCAN) return 'Security scan pending';
  return 'Awaiting upload';
}

export function customerRequirementProjection(row, { security } = {}) {
  return {
    publicRequirementRef: row.publicRequirementRef,
    requirementKey: row.requirementKey,
    label: row.label,
    description: row.description,
    required: row.required === true,
    acceptedMimeTypes: row.acceptedMimeTypes || [],
    maxFiles: row.maxFiles || 1,
    maxFileSize: row.maxFileSize || GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE,
    whoProvides: row.whoProvides,
    status: row.status,
    statusLabel: safeStatusLabel(row.status),
    hasActiveDocument: Boolean(row.activeVaultDocumentId),
    scanState: security?.configured ? (row.scanStatus || 'not_configured') : 'not_configured',
    reviewState: row.reviewState || GBS_DOCUMENT_REVIEW_STATES.NONE,
    recordVersion: row.recordVersion,
    waivable: row.waivable === true,
    security,
  };
}

export function providerRequirementProjection(row, { security, canManageDocuments } = {}) {
  return {
    ...customerRequirementProjection(row, { security }),
    sensitivityClass: row.sensitivityClass,
    reviewRequired: row.reviewRequired !== false,
    filingRequired: row.filingRequired === true,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    requirementVersion: row.requirementVersion,
    activeVaultVersionNumber: row.activeVaultVersionNumber || null,
    canReview: Boolean(canManageDocuments && security?.configured && row.scanStatus === 'clean'),
    canDownload: Boolean(canManageDocuments && security?.configured && row.scanStatus === 'clean'),
  };
}

export function documentSecurityProjection(security) {
  return {
    configured: security?.configured === true,
    mode: security?.mode || 'not_configured',
    uploadEnabled: security?.configured === true,
    providerByteAccessEnabled: security?.configured === true,
    providerReviewEnabled: security?.configured === true,
    message: security?.configured
      ? 'Document security scanning is available for this test environment only.'
      : 'Secure document upload is not available in this environment.',
    providerMessage: security?.configured
      ? 'Document review is available only for scan-clean files.'
      : 'Document security scanning is not configured.',
  };
}

export { isOpaqueDocumentRef, GBS_DOCUMENT_WAIVER_REASONS };
