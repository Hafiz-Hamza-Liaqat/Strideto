/**
 * Vault REST controllers (Mission 10).
 *
 * All endpoints enforce authenticated ownership.
 * Raw storage keys and paths are NEVER returned to clients.
 * Download goes through server-mediated streaming.
 */
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auditFromRequest } from '../../services/auditService.js';
import * as VaultService from '../../services/vault/VaultDocumentService.js';
import { vaultRetrieveFile } from '../../services/vault/vaultStorageService.js';
import { canDownloadVersion } from '../../services/vault/vaultAccessPolicy.js';
import { logAudit } from '../../services/auditService.js';

function actor(req) {
  return { type: 'user', id: String(req.user.userId), role: req.user.role, email: req.user.email };
}

function auditMeta(req) {
  return {
    actor: actor(req),
    ip: auditFromRequest(req).ip,
  };
}

// ── Documents ─────────────────────────────────────────────────────────────────

export const listDocuments = asyncHandler(async (req, res) => {
  const result = await VaultService.listDocuments(req.user.userId, req.query);
  res.json(result);
});

export const getDocument = asyncHandler(async (req, res) => {
  const doc = await VaultService.getDocument(req.user.userId, req.params.id, auditMeta(req));
  res.json(doc);
});

export const createDocument = asyncHandler(async (req, res) => {
  const doc = await VaultService.createDocument(
    req.user.userId,
    req.body,
    req.vaultFile || null,
    auditMeta(req)
  );
  res.status(201).json(doc);
});

export const updateDocument = asyncHandler(async (req, res) => {
  const doc = await VaultService.updateDocument(
    req.user.userId,
    req.params.id,
    req.body,
    auditMeta(req)
  );
  res.json(doc);
});

export const archiveDocument = asyncHandler(async (req, res) => {
  const doc = await VaultService.archiveDocument(req.user.userId, req.params.id, auditMeta(req));
  res.json(doc);
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const result = await VaultService.deleteDocument(req.user.userId, req.params.id, auditMeta(req));
  res.json(result);
});

// ── Versions ──────────────────────────────────────────────────────────────────

export const listVersions = asyncHandler(async (req, res) => {
  const versions = await VaultService.listVersions(req.user.userId, req.params.id);
  res.json({ data: versions });
});

export const uploadVersion = asyncHandler(async (req, res) => {
  const version = await VaultService.uploadVersion(
    req.user.userId,
    req.params.id,
    req.vaultFile,
    req.body,
    auditMeta(req)
  );
  res.status(201).json(version);
});

// ── Access / Download ─────────────────────────────────────────────────────────

export const accessDocument = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { id: documentId } = req.params;
  const versionId = req.query.versionId || null;

  const { doc, version } = await VaultService.resolveVersionForAccess(userId, documentId, versionId);

  if (!canDownloadVersion(version)) {
    return res.status(403).json({ error: 'File access blocked by security policy' });
  }

  const meta = auditMeta(req);
  await logAudit({
    actor: meta.actor,
    ip: meta.ip,
    action: 'vault.document.accessed',
    targetType: 'VaultDocument',
    targetId: String(doc._id),
    targetLabel: doc.displayName,
    metadata: {
      versionId: String(version._id),
      versionNumber: version.versionNumber,
    },
  });

  const retrieved = await vaultRetrieveFile({
    storageKey: version.storageKey,
    storageProvider: version.storageProvider,
    mimeType: version.mimeType,
  });

  // Sanitize filename for content-disposition
  const safeFilename = encodeURIComponent(version.originalFilename || `document-v${version.versionNumber}`);
  const disposition = req.query.download === 'true'
    ? `attachment; filename="${safeFilename}"`
    : `inline; filename="${safeFilename}"`;

  res.set('Content-Disposition', disposition);
  res.set('Content-Type', version.mimeType || 'application/octet-stream');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');

  if (retrieved.signedUrl) {
    // Cloudinary: redirect through signed URL (short-lived, not logged)
    return res.redirect(302, retrieved.signedUrl);
  }

  if (retrieved.buffer) {
    res.set('Content-Length', retrieved.buffer.length);
    return res.send(retrieved.buffer);
  }

  res.status(404).json({ error: 'File not available' });
});

// ── Grants ────────────────────────────────────────────────────────────────────

export const listGrants = asyncHandler(async (req, res) => {
  const grants = await VaultService.listGrants(req.user.userId, req.params.id);
  res.json({ data: grants });
});

export const createGrant = asyncHandler(async (req, res) => {
  const grant = await VaultService.createGrant(
    req.user.userId,
    req.params.id,
    req.body,
    auditMeta(req)
  );
  res.status(201).json(grant);
});

export const revokeGrant = asyncHandler(async (req, res) => {
  const grant = await VaultService.revokeDocumentGrant(
    req.user.userId,
    req.params.id,
    req.params.grantId,
    auditMeta(req)
  );
  res.json(grant);
});
