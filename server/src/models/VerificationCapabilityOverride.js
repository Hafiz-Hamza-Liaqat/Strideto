import mongoose from 'mongoose';
import { listOrganizationCapabilityIds } from '../../../shared/capability/organizationCapabilities.js';

const verificationCapabilityOverrideSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    overrideType: {
      type: String,
      enum: ['qa_test', 'manual_exception'],
      required: true,
    },
    active: { type: Boolean, default: true, index: true },
    capabilities: [{ type: String, enum: listOrganizationCapabilityIds() }],
    reason: { type: String, required: true },
    grantedByUserId: { type: String, required: true },
    grantedByRole: { type: String, default: '' },
    grantedAt: { type: Date, required: true },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedByUserId: { type: String, default: null },
    revokeReason: { type: String, default: '' },
  },
  { timestamps: true }
);

verificationCapabilityOverrideSchema.index({ organizationId: 1, active: 1 });
verificationCapabilityOverrideSchema.index({ grantedAt: -1 });

export const VerificationCapabilityOverride = mongoose.model(
  'VerificationCapabilityOverride',
  verificationCapabilityOverrideSchema
);
