/**
 * Document availability helper for Mission 9 Journey Planner integration.
 *
 * Provides a clean read-only boundary between the vault and checklist/requirement systems.
 * Does NOT mutate requirement records or duplicate file data.
 *
 * Usage: Journey Planner maps requirement identifiers (e.g. "passport") →
 * availability result (satisfied/unavailable/expiring/expired).
 */
import { VaultDocument } from '../../models/vault/VaultDocument.js';
import { computeExpiryState } from './vaultExpiryService.js';
import { VAULT_DOCUMENT_TYPES } from '../../../../shared/vault/constants.js';

/**
 * Check availability of a specific document type for a user.
 *
 * @param {string} userId
 * @param {string} documentType — must be a VAULT_DOCUMENT_TYPES member
 * @returns {Promise<{
 *   available: boolean,
 *   expiryState: 'valid'|'expiring_soon'|'expired'|'unknown',
 *   documentId: string|null,
 *   displayName: string|null
 * }>}
 */
export async function checkDocumentAvailability(userId, documentType) {
  if (!VAULT_DOCUMENT_TYPES.includes(documentType)) {
    return { available: false, expiryState: 'unknown', documentId: null, displayName: null };
  }

  const doc = await VaultDocument.findOne({
    ownerUserId: userId,
    documentType,
    status: 'active',
    currentVersionId: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!doc) {
    return { available: false, expiryState: 'unknown', documentId: null, displayName: null };
  }

  const expiryState = computeExpiryState(doc.expiresAt);

  return {
    available: expiryState !== 'expired',
    expiryState,
    documentId: String(doc._id),
    displayName: doc.displayName,
  };
}

/**
 * Check availability of multiple document types in a single call.
 * Used by Journey Planner to evaluate a checklist of requirements.
 *
 * @param {string} userId
 * @param {string[]} documentTypes
 * @returns {Promise<Record<string, {available: boolean, expiryState: string, documentId: string|null}>>}
 */
export async function checkMultipleDocumentAvailability(userId, documentTypes) {
  const validTypes = documentTypes.filter((t) => VAULT_DOCUMENT_TYPES.includes(t));

  const docs = await VaultDocument.find({
    ownerUserId: userId,
    documentType: { $in: validTypes },
    status: 'active',
    currentVersionId: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .lean();

  // Latest doc per type
  const byType = {};
  for (const doc of docs) {
    if (!byType[doc.documentType]) byType[doc.documentType] = doc;
  }

  const result = {};
  for (const type of documentTypes) {
    if (!VAULT_DOCUMENT_TYPES.includes(type)) {
      result[type] = { available: false, expiryState: 'unknown', documentId: null };
      continue;
    }
    const doc = byType[type];
    if (!doc) {
      result[type] = { available: false, expiryState: 'unknown', documentId: null };
      continue;
    }
    const expiryState = computeExpiryState(doc.expiresAt);
    result[type] = {
      available: expiryState !== 'expired',
      expiryState,
      documentId: String(doc._id),
      displayName: doc.displayName,
    };
  }

  return result;
}
