/**
 * Vault authorization policy (Mission 10 §F, §G, §H, §I, §S).
 *
 * canAccessDocument — reusable by future Agent/Case missions.
 * No Agent role granted here; caller must supply an explicit grant.
 */
import { DocumentAccessGrant } from '../../models/vault/DocumentAccessGrant.js';
import { VaultDocument } from '../../models/vault/VaultDocument.js';
import { isScanStatusPermittingAccess } from './securityScanService.js';

/**
 * Verify actor can access a document (owner or valid active grant).
 *
 * @param {object} params
 * @param {{ type: 'user'|'agent'|'system', id: string }} params.actor
 * @param {object} params.document — plain VaultDocument object
 * @param {string} [params.requiredPermission] — 'view' (default) | 'download'
 * @param {string} [params.grantId] — explicit grant ID (for non-owner actors)
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function canAccessDocument({
  actor,
  document,
  requiredPermission = 'view',
  grantId,
}) {
  if (!actor || !document) return { allowed: false, reason: 'missing_params' };

  if (document.status === 'deleted_pending_retention') {
    return { allowed: false, reason: 'document_deleted' };
  }

  // Owner always has full access
  if (actor.type === 'user' && String(actor.id) === String(document.ownerUserId)) {
    return { allowed: true, reason: 'owner' };
  }

  // Non-owner: must have an explicit active grant
  if (!grantId) return { allowed: false, reason: 'no_grant' };

  const grant = await DocumentAccessGrant.findById(grantId).lean();
  if (!grant) return { allowed: false, reason: 'grant_not_found' };
  if (String(grant.documentId) !== String(document._id)) {
    return { allowed: false, reason: 'grant_document_mismatch' };
  }
  if (grant.status !== 'active') return { allowed: false, reason: 'grant_inactive' };
  if (grant.revokedAt) return { allowed: false, reason: 'grant_revoked' };
  if (grant.expiresAt && new Date(grant.expiresAt) <= new Date()) {
    return { allowed: false, reason: 'grant_expired' };
  }
  if (!grant.permissions.includes(requiredPermission)) {
    return { allowed: false, reason: 'insufficient_permission' };
  }
  if (String(grant.granteeId) !== String(actor.id)) {
    return { allowed: false, reason: 'grantee_mismatch' };
  }

  return { allowed: true, reason: 'grant', grantId: String(grant._id) };
}

/**
 * Verify ownership strictly — used for write operations.
 * Throws 403 if actor is not the document owner.
 */
export function assertOwnership(document, userId) {
  if (!document || String(document.ownerUserId) !== String(userId)) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }
}

/**
 * Check whether a download is allowed considering scan status.
 */
export function canDownloadVersion(version) {
  return isScanStatusPermittingAccess(version?.scanStatus);
}

/**
 * Verify a grant belongs to this owner/document pair before revocation.
 */
export async function resolveGrantForRevocation(ownerUserId, grantId) {
  const grant = await DocumentAccessGrant.findOne({
    _id: grantId,
    ownerUserId,
    status: 'active',
  }).lean();
  return grant || null;
}

/**
 * Revoke a single grant.
 * Only the ownerUserId can revoke.
 * Unrelated grants are untouched.
 */
export async function revokeGrant(grantId, ownerUserId) {
  const result = await DocumentAccessGrant.findOneAndUpdate(
    { _id: grantId, ownerUserId, status: 'active' },
    {
      $set: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: ownerUserId,
      },
    },
    { new: true }
  ).lean();

  if (!result) {
    const err = new Error('Grant not found or already inactive');
    err.status = 404;
    throw err;
  }
  return result;
}

/**
 * Fetch document by ID, enforcing ownership for the given userId.
 * Throws 404 if not found or not owned by this user.
 */
export async function getOwnedDocument(documentId, userId) {
  const doc = await VaultDocument.findOne({
    _id: documentId,
    ownerUserId: userId,
    status: { $ne: 'deleted_pending_retention' },
  }).lean();
  if (!doc) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }
  return doc;
}
