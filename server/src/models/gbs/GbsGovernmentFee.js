import mongoose from 'mongoose';
import {
  CATALOG_REVIEW_STATUSES,
  FEE_AMOUNT_MODELS,
  FEE_CADENCE,
  FEE_CATEGORIES,
  GBS_CATALOG_SCHEMA_VERSION,
  PROVIDER_FEE_OWNERSHIP,
} from '../../../../shared/gbs/catalogConstants.js';

const schema = new mongoose.Schema(
  {
    feeId: { type: String, required: true },
    jurisdictionId: { type: String, required: true, index: true },
    authorityId: { type: String, required: true },
    entityTypeId: { type: String, default: null, index: true },
    feeCategory: { type: String, required: true, enum: Object.values(FEE_CATEGORIES), index: true },
    label: { type: String, required: true },
    currency: { type: String, required: true, uppercase: true },
    amountModel: { type: String, required: true, enum: Object.values(FEE_AMOUNT_MODELS) },
    amount: { type: Number, default: null },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    required: { type: Boolean, default: true },
    cadence: { type: String, default: FEE_CADENCE.ONE_TIME, enum: Object.values(FEE_CADENCE) },
    ownership: {
      type: String,
      default: PROVIDER_FEE_OWNERSHIP.GOVERNMENT,
      enum: Object.values(PROVIDER_FEE_OWNERSHIP),
    },
    fxAuthoritative: { type: Boolean, default: false },
    effectiveFrom: { type: Date, index: true },
    effectiveTo: { type: Date, index: true },
    sourceId: { type: String, required: true },
    sourceVersion: { type: Number, default: 1 },
    reviewStatus: {
      type: String,
      default: CATALOG_REVIEW_STATUSES.DRAFT,
      enum: Object.values(CATALOG_REVIEW_STATUSES),
      index: true,
    },
    reviewDueAt: { type: Date },
    notes: { type: String, default: '' },
    superseded: { type: Boolean, default: false },
    supersededBy: { type: String, default: null },
    schemaVersion: { type: String, default: GBS_CATALOG_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ feeId: 1, sourceVersion: 1 }, { unique: true });
schema.index({ jurisdictionId: 1, entityTypeId: 1, feeCategory: 1, reviewStatus: 1 });

export const GbsGovernmentFee = mongoose.model('GbsGovernmentFee', schema);
