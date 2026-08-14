import mongoose from 'mongoose';
import { GRANT_STATUSES } from '../../../../shared/capability/grantStatus.js';
import {
  GBS_SCHEMA_VERSION,
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../../shared/gbs/constants.js';

const flagsSchema = new mongoose.Schema(
  {
    registered_agent: { type: Boolean, default: false },
    registered_office: { type: Boolean, default: false },
  },
  { _id: false }
);

const scopeSchema = new mongoose.Schema(
  {
    serviceCategoryIds: { type: [String], default: [] },
    countryCodes: { type: [String], default: [] },
    jurisdictionIds: { type: [String], default: [] },
    entityTypeIds: { type: [String], default: [] },
    protectedTitleIds: { type: [String], default: [] },
    flags: { type: flagsSchema, default: () => ({}) },
  },
  { _id: false }
);

const providerCapabilitySchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
    },
    subjectId: { type: String, required: true },
    capabilityId: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: Object.values(GRANT_STATUSES),
      default: GRANT_STATUSES.ACTIVE,
    },
    trustStatus: {
      type: String,
      enum: Object.values(PROVIDER_TRUST_STATUSES),
      default: PROVIDER_TRUST_STATUSES.CLAIMED,
    },
    scope: { type: scopeSchema, default: () => ({}) },
    evidenceRefs: { type: [mongoose.Schema.Types.Mixed], default: [] },
    review: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: String, default: GBS_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

providerCapabilitySchema.index({ subjectType: 1, subjectId: 1, capabilityId: 1, status: 1 });
providerCapabilitySchema.index(
  { subjectType: 1, subjectId: 1, capabilityId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      capabilityId: { $type: 'string', $gt: '' },
      status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.SUSPENDED] },
    },
  }
);
providerCapabilitySchema.index({ subjectType: 1, subjectId: 1, 'scope.jurisdictionIds': 1 });
providerCapabilitySchema.index({ capabilityId: 1, trustStatus: 1 });
providerCapabilitySchema.index({ trustStatus: 1, updatedAt: -1 });
providerCapabilitySchema.index({ subjectType: 1, trustStatus: 1, updatedAt: -1 });

export const ProviderCapability = mongoose.model(
  'ProviderCapability',
  providerCapabilitySchema
);
