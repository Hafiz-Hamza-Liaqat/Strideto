/**
 * GBS Case document requirements (Phase 17D-8B1).
 *
 * Vault owns bytes. GbsCase owns requirements/grants/authority.
 * Production scanner remains NOT_CONFIGURED. Provider share is fail-closed.
 */
import mongoose from 'mongoose';
import path from 'node:path';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsCaseDocumentRequirement } from '../../models/gbs/GbsCaseDocumentRequirement.js';
import { GbsCaseDocumentGrant } from '../../models/gbs/GbsCaseDocumentGrant.js';
import { VaultDocument } from '../../models/vault/VaultDocument.js';
import { VaultDocumentVersion } from '../../models/vault/VaultDocumentVersion.js';
import { AgentMembership } from '../../models/agent/AgentMembership.js';
import { UserCapabilityGrant } from '../../models/capability/UserCapabilityGrant.js';
import { vaultUploadFile, vaultRetrieveFile } from '../vault/vaultStorageService.js';
import { rejectDangerousFilename, sniffMime } from '../../utils/fileValidation.js';
import { generatePublicRequirementRef } from '../../utils/gbsCaseDocumentRef.js';
import {
  GBS_COMMAND_IDS,
  PROVIDER_SUBJECT_TYPES,
} from '../../../../shared/gbs/constants.js';
import {
  CASE_TASK_STATUSES,
  isCaseTerminal,
  isOpaqueCaseRef,
} from '../../../../shared/gbs/caseContract.js';
import { parseExpectedVersion } from '../../../../shared/gbs/case.js';
import {
  EMPTY_DOCUMENT_PACK_ID,
  EMPTY_DOCUMENT_PACK_VERSION,
  GBS_CASE_DOCUMENT_BOUNDS,
  GBS_CASE_DOCUMENT_DOCX_MIME,
  GBS_CASE_DOCUMENT_MIMES,
  GBS_CASE_DOCUMENT_SCHEMA_VERSION,
  GBS_DOCUMENT_GRANT_GRANTEE_TYPES,
  GBS_DOCUMENT_GRANT_STATUSES,
  GBS_DOCUMENT_REQUIREMENT_STATUSES,
  GBS_DOCUMENT_REVIEW_STATES,
  GBS_DOCUMENT_SECURITY_CODES,
  GBS_DOCUMENT_WHO_PROVIDES,
  TEST_ONLY_DOCUMENT_PACK_ID,
  assertRequirementNotHsi,
  isAllowedGbsDocumentMime,
  isHsiDocumentType,
  isHsiSensitivity,
  isOpaqueDocumentRef,
  productionDocumentPackForTemplate,
  testOnlyLowRiskPack,
} from '../../../../shared/gbs/caseDocumentContract.js';
import {
  allowlistedDocumentRejectInput,
  allowlistedDocumentReviewInput,
  allowlistedDocumentUploadInput,
  allowlistedDocumentWaiveInput,
  customerRequirementProjection,
  documentSecurityProjection,
  providerRequirementProjection,
} from '../../../../shared/gbs/caseDocument.js';
import { evaluateCaseFilingReadiness } from '../../../../shared/gbs/caseDocumentReadiness.js';
import { PROVIDER_DOMAIN_IDS } from '../../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../../shared/provider/providerDomainPermissions.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { logAudit } from '../auditService.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../../shared/platform/optimisticConcurrency.js';
import {
  executeHighValueIdempotentCommand,
  fingerprintRequest,
  getMongoIdempotencyStore,
} from '../platform/idempotencyService.js';
import { assertProviderDomainAccess } from './providerDomainService.js';
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import {
  gbsCaseDocumentSecurityState,
  isGbsProviderScanClean,
  scanGbsCaseDocumentVersion,
} from './gbsDocumentScanService.js';
import {
  HSI_AAD_SCHEMA_VERSION,
  HSI_RETENTION_CLASSES,
  HSI_SECURITY_POLICY_VERSION,
} from '../../../../shared/gbs/hsiSecurity.js';
import { isHsiDocumentCapabilityReady } from '../hsi/hsiCapabilityService.js';
import { encryptAndStoreHsiQuarantine, decryptHsiVersionBytes, isHsiEncryptedVersion } from '../hsi/hsiObjectPipeline.js';
import { enqueueGbsDocumentScanJob } from '../hsi/gbsDocumentScanJobService.js';
import { loadHsiSecurityConfig } from '../../config/hsiSecurityConfig.js';
import { logRequiredHsiAudit } from '../hsi/hsiAudit.js';

function deny(code, status = 400, extra = {}) {
  return Object.assign(new Error(code), { status, code, ...extra });
}

function notFound() {
  return deny('not_found', 404);
}

function securityUnavailable() {
  return deny(GBS_DOCUMENT_SECURITY_CODES.NOT_CONFIGURED, 403);
}

async function assertDocumentUploadSecurity(requirement) {
  if (isHsiSensitivity(requirement.sensitivityClass)) {
    const cap = await isHsiDocumentCapabilityReady();
    if (!cap.enabled) throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_DISABLED, 403);
    if (!cap.overallReady) throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_READY, 503);
    return cap;
  }
  if (!gbsCaseDocumentSecurityState().configured) throw securityUnavailable();
  return null;
}

function toId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

function commandKey(body, headerCommandId, fallback) {
  const raw = body?.commandId || body?.creationCommandId || headerCommandId || fallback;
  return String(raw || fallback).trim().slice(0, GBS_CASE_DOCUMENT_BOUNDS.COMMAND_ID_MAX);
}

function sanitizeStoredFilename(name) {
  if (!name || typeof name !== 'string') return 'upload';
  return path.basename(name).replace(/[^\w.-]/g, '_').slice(0, 80);
}

function downloadFilename(mimeType, versionNumber) {
  const ext = mimeType === 'application/pdf'
    ? 'pdf'
    : mimeType === 'image/png'
      ? 'png'
      : mimeType === GBS_CASE_DOCUMENT_DOCX_MIME
        ? 'docx'
        : 'jpg';
  return `case-document-v${versionNumber || 1}.${ext}`;
}

export function caseDocumentPackSnapshot(record) {
  return {
    packId: record?.documentPackId || EMPTY_DOCUMENT_PACK_ID,
    packVersion: record?.documentPackVersion || EMPTY_DOCUMENT_PACK_VERSION,
    consentRequired: record?.documentConsentRequired === true,
  };
}

export function requiredCustomerTasksComplete(record) {
  return (record?.customerTasks || [])
    .filter((task) => task.type === 'customer_action' && task.required)
    .every((task) => task.status === CASE_TASK_STATUSES.COMPLETED);
}

async function hasActiveBusinessClient(userId) {
  const grant = await UserCapabilityGrant.findOne({
    userId,
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    status: GRANT_STATUSES.ACTIVE,
  }).lean();
  return Boolean(grant);
}

async function loadOwnedCustomerCase(userId, caseRef) {
  if (!isOpaqueCaseRef(caseRef)) throw notFound();
  const record = await GbsCase.findOne({ publicCaseRef: caseRef, requesterUserId: userId });
  if (!record) throw notFound();
  return record;
}

async function loadExactProviderCase(subject, caseRef) {
  if (!isOpaqueCaseRef(caseRef)) throw notFound();
  const record = await GbsCase.findOne({
    publicCaseRef: caseRef,
    providerSubjectType: subject.subjectType,
    providerSubjectId: String(subject.subjectId),
  });
  if (!record) throw notFound();
  return record;
}

async function loadOwnedRequirement(userId, caseRef, requirementRef) {
  if (!isOpaqueDocumentRef(requirementRef)) throw notFound();
  const record = await loadOwnedCustomerCase(userId, caseRef);
  const requirement = await GbsCaseDocumentRequirement.findOne({
    publicRequirementRef: requirementRef,
    caseId: record._id,
    requesterUserId: userId,
  });
  if (!requirement) throw notFound();
  return { record, requirement };
}

async function loadProviderRequirement(subject, caseRef, requirementRef) {
  if (!isOpaqueDocumentRef(requirementRef)) throw notFound();
  const record = await loadExactProviderCase(subject, caseRef);
  const requirement = await GbsCaseDocumentRequirement.findOne({
    publicRequirementRef: requirementRef,
    caseId: record._id,
    providerSubjectType: subject.subjectType,
    providerSubjectId: String(subject.subjectId),
  });
  if (!requirement) throw notFound();
  return { record, requirement };
}

async function assertCaseProfessionalAuthority(record, env, now) {
  const { evaluateCaseProfessionalAuthority } = await import('./gbsCaseService.js');
  const listing = await GbsServiceListing.findById(record.listingId).lean();
  const request = await GbsServiceRequest.findById(record.serviceRequestId).lean();
  const gate = await evaluateCaseProfessionalAuthority({
    listing,
    storedRequest: request || {
      providerSubjectType: record.providerSubjectType,
      providerSubjectId: record.providerSubjectId,
      capabilityId: record.capabilityId,
    },
    env,
    now,
  });
  if (!gate.allowed) throw deny(gate.reason || 'authority_denied', 409);
  return gate;
}

async function mutateRequirement({ requirement, expectedVersion, extraFilter = {}, set }) {
  if (expectedVersion == null || !Number.isInteger(Number(expectedVersion))) {
    throw deny('expected_version_required', 400);
  }
  const expected = Number(expectedVersion);
  const $set = { ...set };
  delete $set.recordVersion;
  const updated = await GbsCaseDocumentRequirement.findOneAndUpdate(
    { _id: requirement._id, recordVersion: expected, ...extraFilter },
    { $set, $inc: { recordVersion: 1 } },
    { new: true }
  );
  if (updated) return updated;
  const current = await GbsCaseDocumentRequirement.findById(requirement._id).select('recordVersion').lean();
  if (!current) throw notFound();
  throw deny(OPTIMISTIC_CONCURRENCY_CODE, 409, {
    currentVersion: current.recordVersion,
    expectedVersion: expected,
  });
}

async function revokeGrantsForRequirement(requirementId, extra = {}) {
  await GbsCaseDocumentGrant.updateMany(
    { requirementId, status: GBS_DOCUMENT_GRANT_STATUSES.ACTIVE, ...extra },
    { $set: { status: GBS_DOCUMENT_GRANT_STATUSES.REVOKED, revokedAt: new Date() } }
  );
}

async function ensureProviderGrant({ record, requirement, version }) {
  if (!isGbsProviderScanClean(version.scanStatus)) return null;
  const granteeType = record.providerSubjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION
    ? GBS_DOCUMENT_GRANT_GRANTEE_TYPES.AGENCY_SUBJECT
    : GBS_DOCUMENT_GRANT_GRANTEE_TYPES.INDEPENDENT_PROVIDER;
  return GbsCaseDocumentGrant.findOneAndUpdate(
    {
      requirementId: requirement._id,
      vaultVersionId: version._id,
      granteeSubjectId: String(record.providerSubjectId),
    },
    {
      $setOnInsert: {
        caseId: record._id,
        requirementId: requirement._id,
        vaultDocumentId: version.documentId,
        vaultVersionId: version._id,
        granteeType,
        granteeSubjectType: record.providerSubjectType,
        granteeSubjectId: String(record.providerSubjectId),
        status: GBS_DOCUMENT_GRANT_STATUSES.ACTIVE,
        scanStatusAtGrant: version.scanStatus,
      },
    },
    { upsert: true, new: true }
  );
}

function validateUploadBuffer(file, requirement) {
  if (!file?.buffer?.length) throw deny('file_required', 400);
  if (file.buffer.length > (requirement.maxFileSize || GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE)) {
    throw deny('file_too_large', 400);
  }
  if (file.buffer.length > GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE) {
    throw deny('file_too_large', 400);
  }
  rejectDangerousFilename(file.originalname || 'upload');
  const detected = sniffMime(file.buffer);
  const declared = file.mimeType || file.mimetype;
  const effective = detected || declared;
  const extra = (requirement.acceptedMimeTypes || []).includes(GBS_CASE_DOCUMENT_DOCX_MIME)
    ? [GBS_CASE_DOCUMENT_DOCX_MIME]
    : [];
  const allowed = new Set([...(requirement.acceptedMimeTypes || GBS_CASE_DOCUMENT_MIMES), ...extra]);
  if (!detected || !allowed.has(effective) || !isAllowedGbsDocumentMime(effective, extra)) {
    throw deny('file_type_not_allowed', 400);
  }
  if (declared && detected && declared !== detected) {
    throw deny('file_content_mismatch', 400);
  }
  if (isHsiDocumentType(file.originalname)) {
    throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED, 403);
  }
  return { mimeType: effective, originalname: sanitizeStoredFilename(file.originalname) };
}

async function assertCaseQuota(caseId, incomingBytes, { excludeRequirementId } = {}) {
  const filter = { caseId, activeVaultVersionId: { $ne: null } };
  if (excludeRequirementId) filter._id = { $ne: excludeRequirementId };
  const rows = await GbsCaseDocumentRequirement.find(filter).select('activeVaultVersionId').lean();
  if (rows.length >= GBS_CASE_DOCUMENT_BOUNDS.MAX_ACTIVE_FILES_PER_CASE) {
    throw deny('case_document_quota_exceeded', 409);
  }
  const versionIds = rows.map((row) => row.activeVaultVersionId).filter(Boolean);
  const versions = versionIds.length
    ? await VaultDocumentVersion.find({ _id: { $in: versionIds } }).select('fileSize').lean()
    : [];
  const used = versions.reduce((sum, row) => sum + (row.fileSize || 0), 0);
  if (used + incomingBytes > GBS_CASE_DOCUMENT_BOUNDS.MAX_BYTES_PER_CASE) {
    throw deny('case_document_quota_exceeded', 409);
  }
}

async function snapshotRequirements(record, pack, { actor } = {}) {
  assertRequirementNotHsi({
    sensitivityClass: 'low',
    documentType: 'business_operational',
    requirementKey: 'pack',
  });
  if (pack.testOnly && process.env.NODE_ENV === 'production') {
    throw deny('test_pack_forbidden', 403);
  }
  const created = [];
  for (const spec of pack.requirements || []) {
    assertRequirementNotHsi(spec);
    let publicRequirementRef = generatePublicRequirementRef();
    for (let i = 0; i < 5; i += 1) {
      const clash = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef }).select('_id').lean();
      if (!clash) break;
      publicRequirementRef = generatePublicRequirementRef();
    }
    const doc = await GbsCaseDocumentRequirement.create({
      publicRequirementRef,
      caseId: record._id,
      publicCaseRefSnapshot: record.publicCaseRef,
      requesterUserId: record.requesterUserId,
      providerSubjectType: record.providerSubjectType,
      providerSubjectId: String(record.providerSubjectId),
      requirementKey: spec.requirementKey,
      label: spec.label,
      description: spec.description || '',
      category: spec.category || 'operational',
      required: spec.required !== false,
      conditional: spec.conditional === true,
      documentType: spec.documentType,
      acceptedMimeTypes: [...(spec.acceptedMimeTypes || GBS_CASE_DOCUMENT_MIMES)],
      maxFiles: spec.maxFiles || 1,
      maxFileSize: spec.maxFileSize || GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE,
      sensitivityClass: spec.sensitivityClass,
      whoProvides: spec.whoProvides || GBS_DOCUMENT_WHO_PROVIDES.CUSTOMER,
      reviewRequired: spec.reviewRequired !== false,
      filingRequired: spec.filingRequired === true,
      consentRequired: spec.consentRequired === true,
      waivable: spec.waivable === true,
      templateId: spec.templateId || pack.packId,
      templateVersion: spec.templateVersion || pack.packVersion,
      requirementVersion: spec.requirementVersion || 1,
      status: GBS_DOCUMENT_REQUIREMENT_STATUSES.AWAITING_UPLOAD,
      reviewState: GBS_DOCUMENT_REVIEW_STATES.NONE,
      scanStatus: 'not_configured',
      recordVersion: 0,
      testOnly: pack.testOnly === true,
    });
    created.push(doc);
    await logAudit({
      actor: actor || {},
      action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_REQUIREMENT_CREATED,
      targetType: 'GbsCaseDocumentRequirement',
      targetId: String(doc._id),
      metadata: redactAuditMetadata({
        publicCaseRef: record.publicCaseRef,
        requirementKey: spec.requirementKey,
        templateId: pack.packId,
      }),
    });
  }
  return created;
}

export async function snapshotEmptyDocumentPack(record, { actor: _actor } = {}) {
  const pack = productionDocumentPackForTemplate();
  if (!record.documentPackId) {
    await GbsCase.updateOne(
      { _id: record._id },
      {
        $set: {
          documentPackId: pack.packId,
          documentPackVersion: pack.packVersion,
          documentConsentRequired: false,
        },
      }
    );
  }
  return pack;
}

export async function applyTestOnlyRequirementPack(record, { consentRequired = false, actor } = {}) {
  if (process.env.NODE_ENV === 'production') throw deny('test_pack_forbidden', 403);
  const pack = testOnlyLowRiskPack({ consentRequired });
  await GbsCase.updateOne(
    { _id: record._id },
    {
      $set: {
        documentPackId: pack.packId,
        documentPackVersion: pack.packVersion,
        documentConsentRequired: pack.consentRequired,
      },
    }
  );
  record.documentPackId = pack.packId;
  record.documentPackVersion = pack.packVersion;
  record.documentConsentRequired = pack.consentRequired;
  await GbsCaseDocumentRequirement.deleteMany({ caseId: record._id, testOnly: true });
  return snapshotRequirements(record, pack, { actor });
}

export async function createSyntheticHsiRequirementForTest(record, { actor } = {}) {
  if (process.env.NODE_ENV === 'production') throw deny('test_pack_forbidden', 403);
  const cap = await isHsiDocumentCapabilityReady();
  if (!cap.overallReady) throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_READY, 503);
  let publicRequirementRef = generatePublicRequirementRef();
  const doc = await GbsCaseDocumentRequirement.create({
    publicRequirementRef,
    caseId: record._id,
    publicCaseRefSnapshot: record.publicCaseRef,
    requesterUserId: record.requesterUserId,
    providerSubjectType: record.providerSubjectType,
    providerSubjectId: String(record.providerSubjectId),
    requirementKey: 'synthetic_hsi_fixture',
    label: 'TEST ONLY — synthetic HSI fixture',
    description: 'Synthetic infrastructure fixture. Not a real identity document.',
    category: 'operational',
    required: true,
    conditional: false,
    documentType: 'other_low_risk',
    acceptedMimeTypes: [...GBS_CASE_DOCUMENT_MIMES],
    maxFiles: 1,
    maxFileSize: GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE,
    sensitivityClass: 'highly_sensitive_identity',
    whoProvides: GBS_DOCUMENT_WHO_PROVIDES.CUSTOMER,
    reviewRequired: true,
    filingRequired: false,
    consentRequired: false,
    waivable: false,
    templateId: 'gbs.case_documents.synthetic_hsi_test',
    templateVersion: 1,
    requirementVersion: 1,
    status: GBS_DOCUMENT_REQUIREMENT_STATUSES.AWAITING_UPLOAD,
    reviewState: GBS_DOCUMENT_REVIEW_STATES.NONE,
    scanStatus: 'pending',
    recordVersion: 0,
    testOnly: true,
  });
  await logAudit({
    actor: actor || {},
    action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_REQUIREMENT_CREATED,
    targetType: 'GbsCaseDocumentRequirement',
    targetId: String(doc._id),
    metadata: redactAuditMetadata({
      publicCaseRef: record.publicCaseRef,
      requirementKey: 'synthetic_hsi_fixture',
      templateId: 'gbs.case_documents.synthetic_hsi_test',
    }),
  });
  return doc;
}

export async function evaluateCaseFilingReadinessForRecord(record, { env, now } = {}) {
  let professionalAuthorityAllowed = true;
  try {
    await assertCaseProfessionalAuthority(record, env, now);
  } catch {
    professionalAuthorityAllowed = false;
  }
  const requirements = await GbsCaseDocumentRequirement.find({ caseId: record._id }).lean();
  const pack = caseDocumentPackSnapshot(record);
  const documentReadiness = evaluateCaseFilingReadiness({
    status: record.status,
    requiredCustomerTasksComplete: requiredCustomerTasksComplete(record),
    professionalAuthorityAllowed,
    consentRequired: pack.consentRequired,
    consentSatisfied: false,
    requirements,
  });
  if (!record.requirementPackSnapshot) return documentReadiness;
  const { evaluateAttachedPackReadiness } = await import('./gbsRequirementPackService.js');
  const packReadiness = evaluateAttachedPackReadiness(record, { professionalAuthorityAllowed });
  const reasons = [...new Set([...(documentReadiness.reasons || []), ...(packReadiness.reasons || [])])];
  return {
    ready: reasons.length === 0,
    reasons,
    b2bRequirementsReady: packReadiness.b2bRequirementsReady === true,
    authorizedForExternalFiling: false,
  };
}

export async function listCustomerCaseDocumentRequirements({ userId, caseRef } = {}) {
  const record = await loadOwnedCustomerCase(userId, caseRef);
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  const rows = await GbsCaseDocumentRequirement.find({ caseId: record._id }).sort({ createdAt: 1 }).lean();
  const readiness = await evaluateCaseFilingReadinessForRecord(record);
  return {
    security,
    pack: caseDocumentPackSnapshot(record),
    items: rows.map((row) => customerRequirementProjection(row, { security })),
    readiness,
  };
}

export async function listProviderCaseDocumentRequirements({
  subject,
  caseRef,
  canManageDocuments = false,
} = {}) {
  const record = await loadExactProviderCase(subject, caseRef);
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  const rows = await GbsCaseDocumentRequirement.find({ caseId: record._id }).sort({ createdAt: 1 }).lean();
  const readiness = await evaluateCaseFilingReadinessForRecord(record);
  return {
    security,
    pack: caseDocumentPackSnapshot(record),
    items: rows.map((row) => providerRequirementProjection(row, {
      security,
      canManageDocuments,
    })),
    readiness,
    canManageDocuments: canManageDocuments === true,
  };
}

async function runDocumentCommand({
  principalId,
  tenantId,
  commandType,
  idempotencyKey,
  fingerprint,
  perform,
  actor,
  auditAction,
  auditTarget,
}) {
  const store = getMongoIdempotencyStore();
  let performed = false;
  const result = await executeHighValueIdempotentCommand(store, {
    principalId,
    tenantId,
    commandType,
    idempotencyKey,
    fingerprint,
    perform: async () => {
      const out = await perform();
      performed = true;
      return out;
    },
  });
  if (performed && !result.replay && auditAction) {
    await logAudit({
      actor,
      action: auditAction,
      targetType: auditTarget?.type || 'GbsCaseDocumentRequirement',
      targetId: auditTarget?.id,
      metadata: redactAuditMetadata(auditTarget?.metadata || {}),
    });
  }
  return result;
}

export async function initializeCustomerDocumentUpload({
  userId,
  caseRef,
  requirementRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
} = {}) {
  const parsed = allowlistedDocumentUploadInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  if (!(await hasActiveBusinessClient(userId))) throw deny('business_client_required', 403);
  const { record, requirement } = await loadOwnedRequirement(userId, caseRef, requirementRef);
  await assertDocumentUploadSecurity(requirement);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  if (requirement.whoProvides === GBS_DOCUMENT_WHO_PROVIDES.PROVIDER) {
    throw deny('provider_supplied_only', 403);
  }
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion ?? requirement.recordVersion);
  if (expected == null) throw deny('expected_version_required', 400);
  await runDocumentCommand({
    principalId: String(userId),
    tenantId: `user:${userId}`,
    commandType: GBS_COMMAND_IDS.CASE_DOCUMENT_INITIALIZE_UPLOAD,
    idempotencyKey: commandKey(body, headerCommandId, `${requirementRef}:init:${expected}`),
    fingerprint: fingerprintRequest({
      command: GBS_COMMAND_IDS.CASE_DOCUMENT_INITIALIZE_UPLOAD,
      caseRef,
      requirementRef,
      expectedVersion: expected,
    }),
    perform: async () => ({ requirementId: String(requirement._id), expectedVersion: expected }),
    actor,
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_UPLOAD_INITIALIZED,
    auditTarget: {
      id: String(requirement._id),
      metadata: { publicCaseRef: record.publicCaseRef, requirementKey: requirement.requirementKey },
    },
  });
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  return { security, item: customerRequirementProjection(requirement, { security }) };
}

async function persistHsiCustomerUpload({
  userId,
  record,
  requirement,
  file,
  expectedVersion,
  actor,
  supersede,
}) {
  const validated = validateUploadBuffer(file, requirement);
  await assertCaseQuota(record._id, file.buffer.length, {
    excludeRequirementId: supersede ? requirement._id : null,
  });
  const expected = parseExpectedVersion(expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);

  let vaultDoc = requirement.activeVaultDocumentId
    ? await VaultDocument.findOne({
      _id: requirement.activeVaultDocumentId,
      ownerUserId: userId,
    })
    : null;
  if (!vaultDoc) {
    vaultDoc = await VaultDocument.create({
      ownerUserId: toId(userId),
      documentType: 'other',
      displayName: 'GBS case document',
      description: '',
      status: 'active',
      privacyClassification: 'restricted',
      metadata: { gbsCaseId: String(record._id), requirementKey: requirement.requirementKey },
    });
  }

  const last = await VaultDocumentVersion.findOne({ documentId: vaultDoc._id }).sort({ versionNumber: -1 }).lean();
  const versionNumber = (last?.versionNumber || 0) + 1;
  const versionId = new mongoose.Types.ObjectId();
  const config = loadHsiSecurityConfig();
  const stored = await encryptAndStoreHsiQuarantine({
    plaintext: file.buffer,
    aadFields: {
      aadVersion: HSI_AAD_SCHEMA_VERSION,
      environment: config.environmentName,
      caseId: String(record._id),
      documentId: String(vaultDoc._id),
      vaultDocumentVersionId: String(versionId),
      classification: requirement.sensitivityClass,
      schemaVersion: GBS_CASE_DOCUMENT_SCHEMA_VERSION,
      securityPolicyVersion: HSI_SECURITY_POLICY_VERSION,
    },
  });
  if (String(stored.storageKey || '').includes(String(userId))) {
    throw deny('storage_key_not_opaque', 500);
  }

  if (last?._id) {
    await VaultDocumentVersion.updateOne(
      { _id: last._id, lifecycleStatus: 'active' },
      { $set: { lifecycleStatus: 'superseded', retentionClass: HSI_RETENTION_CLASSES.SUPERSEDED_VERSION } }
    );
  }

  const version = await VaultDocumentVersion.create({
    _id: versionId,
    documentId: vaultDoc._id,
    ownerUserId: toId(userId),
    versionNumber,
    storageKey: stored.storageKey,
    storageProvider: stored.storageProvider,
    originalFilename: '',
    mimeType: validated.mimeType,
    fileSize: file.buffer.length,
    checksum: stored.checksum,
    uploadedBy: toId(userId),
    scanStatus: 'pending',
    scanCompletedAt: null,
    lifecycleStatus: 'active',
    storageClass: stored.storageClass,
    quarantineBucket: stored.quarantineBucket,
    cleanBucket: stored.cleanBucket,
    encryption: stored.encryption,
    classification: requirement.sensitivityClass,
    retentionClass: HSI_RETENTION_CLASSES.UNUSED_UPLOAD,
  });
  await VaultDocument.updateOne({ _id: vaultDoc._id }, { $set: { currentVersionId: version._id } });

  const job = await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: version._id,
    opaqueStorageRef: stored.storageKey,
    checksumSha256: stored.checksum,
    mimeType: validated.mimeType,
    sizeBytes: file.buffer.length,
    classification: requirement.sensitivityClass,
  });
  await VaultDocumentVersion.updateOne({ _id: version._id }, { $set: { scanJobId: job._id } });

  const updated = await mutateRequirement({
    requirement,
    expectedVersion: expected,
    extraFilter: supersede
      ? {}
      : { status: { $in: [
        GBS_DOCUMENT_REQUIREMENT_STATUSES.AWAITING_UPLOAD,
        GBS_DOCUMENT_REQUIREMENT_STATUSES.REJECTED,
        GBS_DOCUMENT_REQUIREMENT_STATUSES.UPLOADED_PENDING_SCAN,
        GBS_DOCUMENT_REQUIREMENT_STATUSES.AVAILABLE_FOR_REVIEW,
      ] } },
    set: {
      activeVaultDocumentId: vaultDoc._id,
      activeVaultVersionId: version._id,
      activeVaultVersionNumber: versionNumber,
      scanStatus: 'pending',
      status: GBS_DOCUMENT_REQUIREMENT_STATUSES.UPLOADED_PENDING_SCAN,
      reviewState: GBS_DOCUMENT_REVIEW_STATES.NONE,
      acceptedAt: null,
    },
  });

  await revokeGrantsForRequirement(requirement._id);
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_UPLOADED,
    targetType: 'GbsCaseDocumentRequirement',
    targetId: String(requirement._id),
    metadata: redactAuditMetadata({
      publicCaseRef: record.publicCaseRef,
      requirementKey: requirement.requirementKey,
      versionNumber,
      scanStatus: 'pending',
    }),
  });
  return updated;
}

async function persistCustomerUpload({
  userId,
  record,
  requirement,
  file,
  expectedVersion,
  actor,
  supersede,
}) {
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  if (!(await hasActiveBusinessClient(userId))) throw deny('business_client_required', 403);
  await assertDocumentUploadSecurity(requirement);
  if (isHsiSensitivity(requirement.sensitivityClass)) {
    return persistHsiCustomerUpload({
      userId,
      record,
      requirement,
      file,
      expectedVersion,
      actor,
      supersede,
    });
  }
  assertRequirementNotHsi(requirement);
  const security = gbsCaseDocumentSecurityState();
  if (!security.configured) throw securityUnavailable();
  const validated = validateUploadBuffer(file, requirement);
  await assertCaseQuota(record._id, file.buffer.length, {
    excludeRequirementId: supersede ? requirement._id : null,
  });

  const expected = parseExpectedVersion(expectedVersion);
  if (expected == null) throw deny('expected_version_required', 400);

  const stored = await vaultUploadFile({
    buffer: file.buffer,
    mimeType: validated.mimeType,
    userId,
    keyNamespace: 'gbs_case',
  });
  if (String(stored.storageKey || '').includes(String(userId))) {
    throw deny('storage_key_not_opaque', 500);
  }

  let vaultDoc = requirement.activeVaultDocumentId
    ? await VaultDocument.findOne({
      _id: requirement.activeVaultDocumentId,
      ownerUserId: userId,
    })
    : null;
  if (!vaultDoc) {
    vaultDoc = await VaultDocument.create({
      ownerUserId: toId(userId),
      documentType: 'other',
      displayName: 'GBS case document',
      description: '',
      status: 'active',
      privacyClassification: 'confidential',
      metadata: { gbsCaseId: String(record._id), requirementKey: requirement.requirementKey },
    });
  }

  const last = await VaultDocumentVersion.findOne({ documentId: vaultDoc._id }).sort({ versionNumber: -1 }).lean();
  const versionNumber = (last?.versionNumber || 0) + 1;
  if (last?._id) {
    await VaultDocumentVersion.updateOne(
      { _id: last._id, lifecycleStatus: 'active' },
      { $set: { lifecycleStatus: 'superseded' } }
    );
  }

  const scan = await scanGbsCaseDocumentVersion({
    storageKey: stored.storageKey,
    storageProvider: stored.storageProvider,
    versionId: 'pending',
  });

  const version = await VaultDocumentVersion.create({
    documentId: vaultDoc._id,
    ownerUserId: toId(userId),
    versionNumber,
    storageKey: stored.storageKey,
    storageProvider: stored.storageProvider,
    originalFilename: validated.originalname,
    mimeType: validated.mimeType,
    fileSize: file.buffer.length,
    checksum: stored.checksum,
    uploadedBy: toId(userId),
    scanStatus: scan.scanStatus,
    scanCompletedAt: scan.completedAt,
    lifecycleStatus: 'active',
  });
  await VaultDocument.updateOne({ _id: vaultDoc._id }, { $set: { currentVersionId: version._id } });

  const nextStatus = scan.scanStatus === 'clean'
    ? GBS_DOCUMENT_REQUIREMENT_STATUSES.AVAILABLE_FOR_REVIEW
    : scan.scanStatus === 'rejected'
      ? GBS_DOCUMENT_REQUIREMENT_STATUSES.REJECTED
      : GBS_DOCUMENT_REQUIREMENT_STATUSES.UPLOADED_PENDING_SCAN;

  const updated = await mutateRequirement({
    requirement,
    expectedVersion: expected,
    extraFilter: supersede
      ? {}
      : { status: { $in: [
        GBS_DOCUMENT_REQUIREMENT_STATUSES.AWAITING_UPLOAD,
        GBS_DOCUMENT_REQUIREMENT_STATUSES.REJECTED,
        GBS_DOCUMENT_REQUIREMENT_STATUSES.UPLOADED_PENDING_SCAN,
        GBS_DOCUMENT_REQUIREMENT_STATUSES.AVAILABLE_FOR_REVIEW,
      ] } },
    set: {
      activeVaultDocumentId: vaultDoc._id,
      activeVaultVersionId: version._id,
      activeVaultVersionNumber: versionNumber,
      scanStatus: scan.scanStatus,
      status: nextStatus,
      reviewState: GBS_DOCUMENT_REVIEW_STATES.NONE,
      acceptedAt: null,
    },
  });

  await revokeGrantsForRequirement(requirement._id);
  if (scan.scanStatus === 'clean') {
    await ensureProviderGrant({ record, requirement: updated, version });
  }

  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_UPLOADED,
    targetType: 'GbsCaseDocumentRequirement',
    targetId: String(requirement._id),
    metadata: redactAuditMetadata({
      publicCaseRef: record.publicCaseRef,
      requirementKey: requirement.requirementKey,
      versionNumber,
      scanStatus: scan.scanStatus,
    }),
  });
  await logAudit({
    actor,
    action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_SCAN_COMPLETED,
    targetType: 'GbsCaseDocumentRequirement',
    targetId: String(requirement._id),
    metadata: redactAuditMetadata({
      publicCaseRef: record.publicCaseRef,
      requirementKey: requirement.requirementKey,
      scanStatus: scan.scanStatus,
    }),
  });
  if (supersede) {
    await logAudit({
      actor,
      action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_SUPERSEDED,
      targetType: 'GbsCaseDocumentRequirement',
      targetId: String(requirement._id),
      metadata: redactAuditMetadata({
        publicCaseRef: record.publicCaseRef,
        requirementKey: requirement.requirementKey,
        versionNumber,
      }),
    });
  }
  return updated;
}

export async function completeCustomerDocumentUpload({
  userId,
  caseRef,
  requirementRef,
  expectedVersion,
  file,
  body = {},
  headerCommandId,
  actor = {},
} = {}) {
  const parsed = allowlistedDocumentUploadInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const { record, requirement } = await loadOwnedRequirement(userId, caseRef, requirementRef);
  await assertDocumentUploadSecurity(requirement);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion ?? requirement.recordVersion);
  await runDocumentCommand({
    principalId: String(userId),
    tenantId: `user:${userId}`,
    commandType: GBS_COMMAND_IDS.CASE_DOCUMENT_COMPLETE_UPLOAD,
    idempotencyKey: commandKey(body, headerCommandId, `${requirementRef}:complete:${expected}`),
    fingerprint: fingerprintRequest({
      command: GBS_COMMAND_IDS.CASE_DOCUMENT_COMPLETE_UPLOAD,
      caseRef,
      requirementRef,
      expectedVersion: expected,
      bytes: file?.buffer?.length || 0,
    }),
    perform: async () => {
      const updated = await persistCustomerUpload({
        userId,
        record,
        requirement,
        file,
        expectedVersion: expected,
        actor,
        supersede: false,
      });
      return { requirementId: String(updated._id), recordVersion: updated.recordVersion };
    },
    actor,
  });
  const latest = await GbsCaseDocumentRequirement.findById(requirement._id).lean();
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  return { security, item: customerRequirementProjection(latest, { security }) };
}

export async function supersedeCustomerDocumentUpload({
  userId,
  caseRef,
  requirementRef,
  expectedVersion,
  file,
  body = {},
  headerCommandId,
  actor = {},
} = {}) {
  const parsed = allowlistedDocumentUploadInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const { record, requirement } = await loadOwnedRequirement(userId, caseRef, requirementRef);
  await assertDocumentUploadSecurity(requirement);
  if (requirement.status === GBS_DOCUMENT_REQUIREMENT_STATUSES.ACCEPTED) {
    throw deny('accepted_document_locked', 409);
  }
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion ?? requirement.recordVersion);
  await runDocumentCommand({
    principalId: String(userId),
    tenantId: `user:${userId}`,
    commandType: GBS_COMMAND_IDS.CASE_DOCUMENT_SUPERSEDE,
    idempotencyKey: commandKey(body, headerCommandId, `${requirementRef}:supersede:${expected}`),
    fingerprint: fingerprintRequest({
      command: GBS_COMMAND_IDS.CASE_DOCUMENT_SUPERSEDE,
      caseRef,
      requirementRef,
      expectedVersion: expected,
      bytes: file?.buffer?.length || 0,
    }),
    perform: async () => {
      const updated = await persistCustomerUpload({
        userId,
        record,
        requirement,
        file,
        expectedVersion: expected,
        actor,
        supersede: true,
      });
      return { requirementId: String(updated._id), recordVersion: updated.recordVersion };
    },
    actor,
  });
  const latest = await GbsCaseDocumentRequirement.findById(requirement._id).lean();
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  return { security, item: customerRequirementProjection(latest, { security }) };
}

async function loadCleanVersion(requirement) {
  if (!requirement.activeVaultVersionId) throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_NOT_CLEAN, 403);
  const version = await VaultDocumentVersion.findById(requirement.activeVaultVersionId);
  if (!version) throw notFound();
  if (!isGbsProviderScanClean(version.scanStatus) || version.scanStatus !== requirement.scanStatus) {
    throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_NOT_CLEAN, 403);
  }
  return version;
}

export async function reviewProviderDocument({
  subject,
  caseRef,
  requirementRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const parsed = allowlistedDocumentReviewInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const { record, requirement } = await loadProviderRequirement(subject, caseRef, requirementRef);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  await assertCaseProfessionalAuthority(record, env, now);
  if (isHsiSensitivity(requirement.sensitivityClass)) {
    const cap = await isHsiDocumentCapabilityReady({ env, now });
    if (!cap.overallReady) throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_READY, 503);
  }
  const version = await loadCleanVersion(requirement);
  if (Number(requirement.recordVersion) !== Number(parsed.value.expectedDocumentVersion)
    && Number(expectedVersion ?? body.expectedVersion) !== Number(requirement.recordVersion)) {
    // CAS uses requirement.recordVersion; expectedDocumentVersion must match.
  }
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion ?? parsed.value.expectedDocumentVersion);
  if (expected !== Number(requirement.recordVersion)) {
    throw deny(OPTIMISTIC_CONCURRENCY_CODE, 409, {
      currentVersion: requirement.recordVersion,
      expectedVersion: expected,
    });
  }
  await runDocumentCommand({
    principalId: String(actor.agentAccountId || subject.subjectId),
    tenantId: `${subject.subjectType}:${subject.subjectId}`,
    commandType: GBS_COMMAND_IDS.CASE_DOCUMENT_REVIEW,
    idempotencyKey: commandKey(body, headerCommandId, `${requirementRef}:review:${expected}:${version._id}`),
    fingerprint: fingerprintRequest({
      command: GBS_COMMAND_IDS.CASE_DOCUMENT_REVIEW,
      caseRef,
      requirementRef,
      expectedVersion: expected,
      vaultVersionId: String(version._id),
    }),
    perform: async () => {
      const fresh = await VaultDocumentVersion.findOne({
        _id: version._id,
        scanStatus: 'clean',
      });
      if (!fresh) throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_NOT_CLEAN, 403);
      if (String(requirement.activeVaultVersionId) !== String(fresh._id)) {
        throw deny('stale_document_version', 409);
      }
      const updated = await mutateRequirement({
        requirement,
        expectedVersion: expected,
        extraFilter: {
          activeVaultVersionId: fresh._id,
          scanStatus: 'clean',
          status: GBS_DOCUMENT_REQUIREMENT_STATUSES.AVAILABLE_FOR_REVIEW,
        },
        set: {
          status: GBS_DOCUMENT_REQUIREMENT_STATUSES.ACCEPTED,
          reviewState: GBS_DOCUMENT_REVIEW_STATES.ACCEPTED,
          acceptedAt: now,
        },
      });
      return { requirementId: String(updated._id), vaultVersionId: String(fresh._id) };
    },
    actor,
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_REVIEWED,
    auditTarget: {
      id: String(requirement._id),
      metadata: {
        publicCaseRef: record.publicCaseRef,
        requirementKey: requirement.requirementKey,
        vaultVersionId: String(version._id),
      },
    },
  });
  const latest = await GbsCaseDocumentRequirement.findById(requirement._id).lean();
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  return { security, item: providerRequirementProjection(latest, { security, canManageDocuments: true }) };
}

export async function rejectProviderDocument({
  subject,
  caseRef,
  requirementRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const parsed = allowlistedDocumentRejectInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const { record, requirement } = await loadProviderRequirement(subject, caseRef, requirementRef);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  await assertCaseProfessionalAuthority(record, env, now);
  const version = await loadCleanVersion(requirement);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion ?? parsed.value.expectedDocumentVersion);
  await runDocumentCommand({
    principalId: String(actor.agentAccountId || subject.subjectId),
    tenantId: `${subject.subjectType}:${subject.subjectId}`,
    commandType: GBS_COMMAND_IDS.CASE_DOCUMENT_REJECT,
    idempotencyKey: commandKey(body, headerCommandId, `${requirementRef}:reject:${expected}:${version._id}`),
    fingerprint: fingerprintRequest({
      command: GBS_COMMAND_IDS.CASE_DOCUMENT_REJECT,
      caseRef,
      requirementRef,
      expectedVersion: expected,
      vaultVersionId: String(version._id),
      reasonCode: parsed.value.reasonCode,
    }),
    perform: async () => {
      const updated = await mutateRequirement({
        requirement,
        expectedVersion: expected,
        extraFilter: { activeVaultVersionId: version._id, scanStatus: 'clean' },
        set: {
          status: GBS_DOCUMENT_REQUIREMENT_STATUSES.REJECTED,
          reviewState: GBS_DOCUMENT_REVIEW_STATES.REJECTED,
          rejectedAt: now,
          acceptedAt: null,
        },
      });
      await revokeGrantsForRequirement(requirement._id, { vaultVersionId: version._id });
      return { requirementId: String(updated._id) };
    },
    actor,
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_REJECTED,
    auditTarget: {
      id: String(requirement._id),
      metadata: { publicCaseRef: record.publicCaseRef, requirementKey: requirement.requirementKey },
    },
  });
  const latest = await GbsCaseDocumentRequirement.findById(requirement._id).lean();
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  return { security, item: providerRequirementProjection(latest, { security, canManageDocuments: true }) };
}

export async function waiveProviderDocument({
  subject,
  caseRef,
  requirementRef,
  expectedVersion,
  body = {},
  headerCommandId,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const parsed = allowlistedDocumentWaiveInput(body);
  if (!parsed.ok) throw deny(parsed.error, 400);
  const { record, requirement } = await loadProviderRequirement(subject, caseRef, requirementRef);
  if (isCaseTerminal(record.status)) throw deny('invalid_status_transition', 409);
  if (requirement.waivable !== true) throw deny('requirement_not_waivable', 409);
  await assertCaseProfessionalAuthority(record, env, now);
  const expected = parseExpectedVersion(expectedVersion ?? body.expectedVersion ?? requirement.recordVersion);
  await runDocumentCommand({
    principalId: String(actor.agentAccountId || subject.subjectId),
    tenantId: `${subject.subjectType}:${subject.subjectId}`,
    commandType: GBS_COMMAND_IDS.CASE_DOCUMENT_WAIVE,
    idempotencyKey: commandKey(body, headerCommandId, `${requirementRef}:waive:${expected}`),
    fingerprint: fingerprintRequest({
      command: GBS_COMMAND_IDS.CASE_DOCUMENT_WAIVE,
      caseRef,
      requirementRef,
      expectedVersion: expected,
      waiverReason: parsed.value.waiverReason,
    }),
    perform: async () => {
      const updated = await mutateRequirement({
        requirement,
        expectedVersion: expected,
        set: {
          status: GBS_DOCUMENT_REQUIREMENT_STATUSES.WAIVED,
          waiverReason: parsed.value.waiverReason,
          waivedAt: now,
        },
      });
      return { requirementId: String(updated._id) };
    },
    actor,
    auditAction: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_WAIVED,
    auditTarget: {
      id: String(requirement._id),
      metadata: {
        publicCaseRef: record.publicCaseRef,
        requirementKey: requirement.requirementKey,
        waiverReason: parsed.value.waiverReason,
      },
    },
  });
  const latest = await GbsCaseDocumentRequirement.findById(requirement._id).lean();
  const security = documentSecurityProjection(gbsCaseDocumentSecurityState());
  return { security, item: providerRequirementProjection(latest, { security, canManageDocuments: true }) };
}

async function proxyBytes(version, res, actorMeta) {
  if (isHsiEncryptedVersion(version)) {
    const cap = await isHsiDocumentCapabilityReady();
    if (!cap.overallReady) throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_READY, 503);
    if (version.destroyedAt) throw deny('document_unavailable', 404);
    if (version.scanStatus === 'pending') throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_PENDING, 403);
    if (version.scanStatus === 'rejected') throw deny(GBS_DOCUMENT_SECURITY_CODES.MALWARE_REJECTED, 403);
    if (version.scanStatus !== 'clean' || version.storageClass === 'quarantine') {
      throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_FAILED, 403);
    }
    const buffer = await decryptHsiVersionBytes(version);
    await logRequiredHsiAudit({
      actor: actorMeta.actor || {},
      action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_ACCESSED,
      targetType: 'GbsCaseDocumentRequirement',
      targetId: actorMeta.requirementId,
      metadata: {
        publicCaseRef: actorMeta.publicCaseRef,
        requirementKey: actorMeta.requirementKey,
        vaultVersionId: String(version._id),
        actorType: actorMeta.actorType,
        providerSubjectPresent: Boolean(actorMeta.providerSubjectId),
      },
    });
    const filename = downloadFilename(version.mimeType, version.versionNumber);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Content-Type', version.mimeType || 'application/octet-stream');
    const outbound = Buffer.from(buffer);
    buffer.fill(0);
    res.set('Content-Length', outbound.length);
    return res.send(outbound);
  }
  const retrieved = await vaultRetrieveFile({
    storageKey: version.storageKey,
    storageProvider: version.storageProvider,
    mimeType: version.mimeType,
  });
  const filename = downloadFilename(version.mimeType, version.versionNumber);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.set('Content-Type', version.mimeType || 'application/octet-stream');
  let buffer = retrieved.buffer || null;
  if (!buffer && retrieved.signedUrl) {
    const upstream = await fetch(retrieved.signedUrl);
    if (!upstream.ok) throw deny('document_unavailable', 404);
    buffer = Buffer.from(await upstream.arrayBuffer());
  }
  if (!buffer) throw deny('document_unavailable', 404);
  await logAudit({
    actor: actorMeta.actor || {},
    action: GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_ACCESSED,
    targetType: 'GbsCaseDocumentRequirement',
    targetId: actorMeta.requirementId,
    metadata: redactAuditMetadata({
      publicCaseRef: actorMeta.publicCaseRef,
      requirementKey: actorMeta.requirementKey,
      vaultVersionId: String(version._id),
      actorType: actorMeta.actorType,
      providerSubjectType: actorMeta.providerSubjectType,
      providerSubjectPresent: Boolean(actorMeta.providerSubjectId),
    }),
  });
  res.set('Content-Length', buffer.length);
  return res.send(buffer);
}

export async function downloadCustomerCaseDocument({ userId, caseRef, requirementRef, res, actor = {} } = {}) {
  const { record, requirement } = await loadOwnedRequirement(userId, caseRef, requirementRef);
  if (!requirement.activeVaultVersionId) throw notFound();
  const version = await VaultDocumentVersion.findOne({
    _id: requirement.activeVaultVersionId,
    ownerUserId: userId,
  });
  if (!version) throw notFound();
  if (isHsiEncryptedVersion(version) && version.scanStatus !== 'clean') {
    if (version.scanStatus === 'pending') throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_PENDING, 403);
    if (version.scanStatus === 'rejected') throw deny(GBS_DOCUMENT_SECURITY_CODES.MALWARE_REJECTED, 403);
    throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_FAILED, 403);
  }
  return proxyBytes(version, res, {
    actor,
    actorType: 'customer',
    requirementId: String(requirement._id),
    publicCaseRef: record.publicCaseRef,
    requirementKey: requirement.requirementKey,
  });
}

export async function downloadProviderCaseDocument({
  subject,
  caseRef,
  requirementRef,
  res,
  actor = {},
  env = process.env,
  now = new Date(),
} = {}) {
  const { record, requirement } = await loadProviderRequirement(subject, caseRef, requirementRef);
  await assertCaseProfessionalAuthority(record, env, now);
  if (isHsiSensitivity(requirement.sensitivityClass)) {
    const cap = await isHsiDocumentCapabilityReady({ env, now });
    if (!cap.overallReady) throw deny(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_READY, 503);
  } else if (!gbsCaseDocumentSecurityState().configured) {
    throw securityUnavailable();
  }
  const version = await loadCleanVersion(requirement);
  const grant = await GbsCaseDocumentGrant.findOne({
    requirementId: requirement._id,
    vaultVersionId: version._id,
    granteeSubjectType: record.providerSubjectType,
    granteeSubjectId: String(record.providerSubjectId),
    status: GBS_DOCUMENT_GRANT_STATUSES.ACTIVE,
  }).lean();
  if (!grant) throw deny(GBS_DOCUMENT_SECURITY_CODES.SCAN_NOT_CLEAN, 403);
  return proxyBytes(version, res, {
    actor,
    actorType: 'provider',
    requirementId: String(requirement._id),
    publicCaseRef: record.publicCaseRef,
    requirementKey: requirement.requirementKey,
    providerSubjectType: record.providerSubjectType,
    providerSubjectId: record.providerSubjectId,
  });
}

export async function assertProviderCaseDocumentDuty({ agentAccountId, subject, actor } = {}) {
  return assertProviderDomainAccess({
    agentAccountId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE,
    actor,
  });
}

export async function membershipHasCaseDocumentDuty(agentAccountId, organizationId) {
  const membership = await AgentMembership.findOne({
    agentAccountId,
    organizationId,
    active: true,
  }).lean();
  if (!membership) return false;
  const { membershipSatisfiesDomainPermission } = await import('../../../../shared/provider/providerDomainPermissions.js');
  return membershipSatisfiesDomainPermission(
    membership,
    PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE
  );
}

export async function tryCreateHsiRequirement() {
  assertRequirementNotHsi({
    sensitivityClass: 'highly_sensitive_identity',
    documentType: 'passport',
    requirementKey: 'passport',
  });
}

export { TEST_ONLY_DOCUMENT_PACK_ID };
