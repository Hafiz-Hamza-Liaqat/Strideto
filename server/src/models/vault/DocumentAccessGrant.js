import mongoose from 'mongoose';
import {
  VAULT_GRANT_GRANTEE_TYPES,
  VAULT_GRANT_PERMISSIONS,
  VAULT_GRANT_STATUSES,
} from '../../../../shared/vault/constants.js';

const documentAccessGrantSchema = new mongoose.Schema(
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
    granteeType: {
      type: String,
      enum: VAULT_GRANT_GRANTEE_TYPES,
      required: true,
    },
    granteeId: { type: String, required: true, trim: true },
    purpose: { type: String, trim: true, maxlength: 500, default: '' },
    caseRef: { type: String, trim: true, default: '' },
    consultationRef: { type: String, trim: true, default: '' },
    permissions: {
      type: [{ type: String, enum: VAULT_GRANT_PERMISSIONS }],
      default: ['view'],
    },
    status: {
      type: String,
      enum: VAULT_GRANT_STATUSES,
      default: 'active',
      index: true,
    },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'document_access_grants',
  }
);

documentAccessGrantSchema.index({ documentId: 1, status: 1 });
documentAccessGrantSchema.index({ ownerUserId: 1, status: 1 });
documentAccessGrantSchema.index({ documentId: 1, granteeType: 1, granteeId: 1 });

export const DocumentAccessGrant =
  mongoose.models.DocumentAccessGrant ||
  mongoose.model('DocumentAccessGrant', documentAccessGrantSchema);
