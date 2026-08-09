/**
 * Vault Document Service (Mission 10).
 *
 * All write paths derive ownerUserId from authenticated session — never from caller body.
 * Storage keys are never returned in public projections.
 */
import mongoose from 'mongoose';
import { VaultDocument } from '../../models/vault/VaultDocument.js';
import { VaultDocumentVersion } from '../../models/vault/VaultDocumentVersion.js';
import { DocumentAccessGrant } from '../../models/vault/DocumentAccessGrant.js';
import { vaultUploadFile } from './vaultStorageService.js';
import { initialScanStatus } from './securityScanService.js';
import { withExpiryState } from './vaultExpiryService.js';
import { assertOwnership, getOwnedDocument, revokeGrant } from './vaultAccessPolicy.js';
import { logAudit } from '../auditService.js';
import {
  VAULT_DOCUMENT_TYPES,
  VAULT_GRANT_GRANTEE_TYPES,
  VAULT_GRANT_PERMISSIONS,
} from '../../../../shared/vault/constants.js';

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 50;

function toId(v) {
  return new mongoose.Types.ObjectId(String(v));
}

function clientProjection(doc) {
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  return withExpiryState(plain);
}

function versionClientProjection(v) {
  const plain = v.toObject ? v.toObject() : { ...v };
  // Never return raw storage key/path to client
  const { storageKey: _key, ...rest } = plain;
  return rest;
}

function auditCtx(actor, ip) {
  return { actor: actor || {}, ip: ip || '' };
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listDocuments(userId, query = {}) {
  const filter = {
    ownerUserId: toId(userId),
    status: { $ne: 'deleted_pending_retention' },
  };

  if (query.status && ['active', 'archived'].includes(query.status)) {
    filter.status = query.status;
  }
  if (query.documentType && VAULT_DOCUMENT_TYPES.includes(query.documentType)) {
    filter.documentType = query.documentType;
  }
  if (query.expiring === 'true') {
    const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    filter.expiresAt = { $lte: cutoff, $gt: new Date() };
  }

  const page = Math.max(1, Number(query.page) || PAGE_DEFAULT);
  const limit = Math.min(LIMIT_MAX, Math.max(1, Number(query.limit) || LIMIT_DEFAULT));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    VaultDocument.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    VaultDocument.countDocuments(filter),
  ]);

  return {
    items: items.map(withExpiryState),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

// ── Get ──────────────────────────────────────────────────────────────────────

export async function getDocument(userId, documentId, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.viewed',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
  });

  return withExpiryState(doc);
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createDocument(userId, body, file, { actor, ip } = {}) {
  const { displayName, documentType, description, issuedAt, expiresAt,
    countryCode, issuingOrganization, metadata, privacyClassification } = body;

  if (!displayName?.trim()) {
    const err = new Error('displayName is required');
    err.status = 400;
    throw err;
  }
  if (!documentType || !VAULT_DOCUMENT_TYPES.includes(documentType)) {
    const err = new Error(`documentType must be one of: ${VAULT_DOCUMENT_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  let currentVersionId = null;
  let versionData = null;

  if (file) {
    const { storageKey, storageProvider, checksum } = await vaultUploadFile({
      buffer: file.buffer,
      mimeType: file.mimeType,
      userId,
    });
    versionData = { storageKey, storageProvider, checksum, file };
  }

  const doc = await VaultDocument.create({
    ownerUserId: toId(userId),
    documentType,
    displayName: String(displayName).trim(),
    description: description ? String(description).trim() : '',
    status: 'active',
    currentVersionId: null,
    issuedAt: issuedAt ? new Date(issuedAt) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    countryCode: countryCode ? String(countryCode).trim().toUpperCase() : null,
    issuingOrganization: issuingOrganization ? String(issuingOrganization).trim() : '',
    metadata: safeMetadata(metadata),
    privacyClassification: privacyClassification || 'confidential',
  });

  if (versionData) {
    const version = await VaultDocumentVersion.create({
      documentId: doc._id,
      ownerUserId: toId(userId),
      versionNumber: 1,
      storageKey: versionData.storageKey,
      storageProvider: versionData.storageProvider,
      originalFilename: sanitizeFilename(versionData.file.originalname),
      mimeType: versionData.file.mimeType,
      fileSize: versionData.file.buffer.length,
      checksum: versionData.checksum,
      uploadedBy: toId(userId),
      scanStatus: initialScanStatus(),
      lifecycleStatus: 'active',
    });
    doc.currentVersionId = version._id;
    await doc.save();
    currentVersionId = version._id;
  }

  const plain = doc.toObject();
  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.created',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
    metadata: {
      documentType,
      hasFile: !!file,
      ...(currentVersionId ? { versionId: String(currentVersionId) } : {}),
    },
  });

  return withExpiryState(plain);
}

// ── Update metadata ───────────────────────────────────────────────────────────

export async function updateDocument(userId, documentId, body, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);

  const patch = {};
  const allowed = ['displayName', 'description', 'issuedAt', 'expiresAt',
    'countryCode', 'issuingOrganization', 'privacyClassification'];

  for (const field of allowed) {
    if (body[field] !== undefined) {
      if (field === 'issuedAt' || field === 'expiresAt') {
        patch[field] = body[field] ? new Date(body[field]) : null;
      } else if (field === 'displayName') {
        const v = String(body[field]).trim();
        if (!v) { const e = new Error('displayName cannot be empty'); e.status = 400; throw e; }
        patch[field] = v;
      } else if (field === 'countryCode') {
        patch[field] = body[field] ? String(body[field]).trim().toUpperCase() : null;
      } else {
        patch[field] = body[field];
      }
    }
  }
  if (body.metadata !== undefined) patch.metadata = safeMetadata(body.metadata);

  const updated = await VaultDocument.findByIdAndUpdate(doc._id, { $set: patch }, { new: true }).lean();

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.metadata_changed',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: updated.displayName,
    metadata: { changedFields: Object.keys(patch) },
  });

  return withExpiryState(updated);
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveDocument(userId, documentId, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);
  if (doc.status === 'archived') return withExpiryState(doc);

  const updated = await VaultDocument.findByIdAndUpdate(
    doc._id,
    { $set: { status: 'archived', archivedAt: new Date() } },
    { new: true }
  ).lean();

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.archived',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
  });

  return withExpiryState(updated);
}

// ── Soft-delete ───────────────────────────────────────────────────────────────

export async function deleteDocument(userId, documentId, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);

  await VaultDocument.findByIdAndUpdate(doc._id, {
    $set: { status: 'deleted_pending_retention' },
  });

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.deleted',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
  });

  return { deleted: true };
}

// ── Versions ──────────────────────────────────────────────────────────────────

export async function listVersions(userId, documentId) {
  const doc = await getOwnedDocument(documentId, userId);
  const versions = await VaultDocumentVersion.find({ documentId: doc._id })
    .sort({ versionNumber: -1 })
    .lean();
  return versions.map(versionClientProjection);
}

export async function uploadVersion(userId, documentId, file, body, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);

  if (!file) {
    const err = new Error('File is required for new version');
    err.status = 400;
    throw err;
  }

  const lastVersion = await VaultDocumentVersion.findOne(
    { documentId: doc._id },
    {},
    { sort: { versionNumber: -1 } }
  ).lean();

  const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

  const { storageKey, storageProvider, checksum } = await vaultUploadFile({
    buffer: file.buffer,
    mimeType: file.mimeType,
    userId,
  });

  const version = await VaultDocumentVersion.create({
    documentId: doc._id,
    ownerUserId: toId(userId),
    versionNumber: nextVersionNumber,
    storageKey,
    storageProvider,
    originalFilename: sanitizeFilename(file.originalname),
    mimeType: file.mimeType,
    fileSize: file.buffer.length,
    checksum,
    uploadedBy: toId(userId),
    scanStatus: initialScanStatus(),
    lifecycleStatus: 'active',
  });

  // Mark previous current version superseded
  if (doc.currentVersionId) {
    await VaultDocumentVersion.findByIdAndUpdate(doc.currentVersionId, {
      $set: { lifecycleStatus: 'superseded' },
    });
  }

  await VaultDocument.findByIdAndUpdate(doc._id, {
    $set: { currentVersionId: version._id },
  });

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.version_uploaded',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
    metadata: {
      versionId: String(version._id),
      versionNumber: nextVersionNumber,
      mimeType: file.mimeType,
      fileSize: file.buffer.length,
    },
  });

  return versionClientProjection(version.toObject());
}

// ── Grants ────────────────────────────────────────────────────────────────────

export async function createGrant(userId, documentId, body, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);

  const { granteeType, granteeId, purpose, permissions, expiresAt, caseRef, consultationRef } = body;

  if (!VAULT_GRANT_GRANTEE_TYPES.includes(granteeType)) {
    const err = new Error(`granteeType must be one of: ${VAULT_GRANT_GRANTEE_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (!granteeId?.trim()) {
    const err = new Error('granteeId is required');
    err.status = 400;
    throw err;
  }

  const perms = Array.isArray(permissions)
    ? permissions.filter((p) => VAULT_GRANT_PERMISSIONS.includes(p))
    : ['view'];
  if (!perms.length) perms.push('view');

  const grant = await DocumentAccessGrant.create({
    documentId: doc._id,
    ownerUserId: toId(userId),
    granteeType,
    granteeId: String(granteeId).trim(),
    purpose: purpose ? String(purpose).trim() : '',
    caseRef: caseRef ? String(caseRef).trim() : '',
    consultationRef: consultationRef ? String(consultationRef).trim() : '',
    permissions: perms,
    status: 'active',
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.document.shared',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
    metadata: {
      grantId: String(grant._id),
      granteeType,
      granteeId: String(granteeId).trim(),
      permissions: perms,
    },
  });

  return grant.toObject();
}

export async function listGrants(userId, documentId) {
  const doc = await getOwnedDocument(documentId, userId);
  return DocumentAccessGrant.find({ documentId: doc._id, ownerUserId: toId(userId) })
    .sort({ createdAt: -1 })
    .lean();
}

export async function revokeDocumentGrant(userId, documentId, grantId, { actor, ip } = {}) {
  const doc = await getOwnedDocument(documentId, userId);

  const revoked = await revokeGrant(grantId, toId(userId));

  await logAudit({
    ...auditCtx(actor, ip),
    action: 'vault.grant.revoked',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
    metadata: {
      grantId: String(revoked._id),
      granteeType: revoked.granteeType,
      granteeId: revoked.granteeId,
    },
  });

  return revoked;
}

// ── Access/Download ───────────────────────────────────────────────────────────

/**
 * Resolve version for authorized access.
 * Returns { version, doc } — storageKey available server-side only.
 */
export async function resolveVersionForAccess(userId, documentId, versionId) {
  const doc = await getOwnedDocument(documentId, userId);

  let version;
  if (versionId) {
    version = await VaultDocumentVersion.findOne({
      _id: versionId,
      documentId: doc._id,
    }).lean();
  } else {
    if (!doc.currentVersionId) {
      const err = new Error('No version uploaded yet');
      err.status = 404;
      throw err;
    }
    version = await VaultDocumentVersion.findById(doc.currentVersionId).lean();
  }

  if (!version) {
    const err = new Error('Version not found');
    err.status = 404;
    throw err;
  }

  // Verify version belongs to this document (IDOR guard)
  if (String(version.documentId) !== String(doc._id)) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }

  return { doc, version };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  // Bound metadata keys
  const entries = Object.entries(raw).slice(0, 20);
  const result = {};
  for (const [k, v] of entries) {
    if (typeof k === 'string' && k.length <= 100) {
      result[k] = typeof v === 'string' ? v.slice(0, 500) : v;
    }
  }
  return result;
}

function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'upload';
  return path.basename(name).replace(/[^\w.\-]/g, '_').slice(0, 200);
}

// path needed for sanitizeFilename
import path from 'path';
