import mongoose from 'mongoose';
import {
  VAULT_DOCUMENT_TYPES,
  VAULT_DOCUMENT_STATUSES,
  VAULT_PRIVACY_CLASSIFICATIONS,
  VAULT_VERIFICATION_STATUSES,
} from '../../../../shared/vault/constants.js';

const vaultDocumentSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: VAULT_DOCUMENT_TYPES,
      required: true,
      default: 'other',
    },
    displayName: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    status: {
      type: String,
      enum: VAULT_DOCUMENT_STATUSES,
      default: 'active',
      index: true,
    },
    currentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocumentVersion',
      default: null,
    },
    issuedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    countryCode: { type: String, trim: true, uppercase: true, maxlength: 3, default: null },
    issuingOrganization: { type: String, trim: true, maxlength: 300, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    privacyClassification: {
      type: String,
      enum: VAULT_PRIVACY_CLASSIFICATIONS,
      default: 'confidential',
    },
    verificationStatus: {
      type: String,
      enum: VAULT_VERIFICATION_STATUSES,
      default: 'unverified',
    },
    verificationRef: { type: String, default: '' },
    archivedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'vault_documents',
  }
);

vaultDocumentSchema.index({ ownerUserId: 1, status: 1, updatedAt: -1 });
vaultDocumentSchema.index({ ownerUserId: 1, documentType: 1, status: 1 });
vaultDocumentSchema.index({ ownerUserId: 1, expiresAt: 1 });

export const VaultDocument =
  mongoose.models.VaultDocument ||
  mongoose.model('VaultDocument', vaultDocumentSchema);
