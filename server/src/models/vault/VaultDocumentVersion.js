import mongoose from 'mongoose';
import {
  VAULT_VERSION_SCAN_STATUSES,
  VAULT_VERSION_LIFECYCLE_STATUSES,
} from '../../../../shared/vault/constants.js';

const vaultDocumentVersionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocument',
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    versionNumber: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true, trim: true },
    storageProvider: { type: String, trim: true, default: 'local' },
    originalFilename: { type: String, trim: true, maxlength: 255, default: '' },
    mimeType: { type: String, trim: true, required: true },
    fileSize: { type: Number, default: 0 },
    checksum: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: () => new Date() },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scanStatus: {
      type: String,
      enum: VAULT_VERSION_SCAN_STATUSES,
      default: 'not_configured',
    },
    scanCompletedAt: { type: Date, default: null },
    lifecycleStatus: {
      type: String,
      enum: VAULT_VERSION_LIFECYCLE_STATUSES,
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'vault_document_versions',
  }
);

vaultDocumentVersionSchema.index({ documentId: 1, versionNumber: -1 });
vaultDocumentVersionSchema.index({ documentId: 1, lifecycleStatus: 1 });

export const VaultDocumentVersion =
  mongoose.models.VaultDocumentVersion ||
  mongoose.model('VaultDocumentVersion', vaultDocumentVersionSchema);
