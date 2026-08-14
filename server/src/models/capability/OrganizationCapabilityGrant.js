import mongoose from 'mongoose';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import { listOrganizationCapabilityIds } from '../../../../shared/capability/organizationCapabilities.js';

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(GRANT_STATUSES), required: true },
    at: { type: Date, required: true },
    by: { type: String, default: '' },
    reason: { type: String, default: '' },
    policyVersion: { type: String, default: '' },
  },
  { _id: false }
);

const organizationCapabilityGrantSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    capability: {
      type: String,
      required: true,
      enum: listOrganizationCapabilityIds(),
    },
    status: {
      type: String,
      enum: Object.values(GRANT_STATUSES),
      required: true,
      default: GRANT_STATUSES.ACTIVE,
    },
    scope: { type: mongoose.Schema.Types.Mixed, default: {} },
    grantedAt: { type: Date, required: true },
    grantedBy: { type: String, default: '' },
    grantReason: { type: String, default: '' },
    policyVersion: { type: String, default: '17d-1.0' },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: String, default: '' },
    suspensionReason: { type: String, default: '' },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: '' },
    revocationReason: { type: String, default: '' },
    history: { type: [historySchema], default: [] },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

organizationCapabilityGrantSchema.index({ organizationId: 1, capability: 1 }, { unique: true });
organizationCapabilityGrantSchema.index({ organizationId: 1, status: 1, capability: 1 });

export const OrganizationCapabilityGrant = mongoose.model(
  'OrganizationCapabilityGrant',
  organizationCapabilityGrantSchema
);
