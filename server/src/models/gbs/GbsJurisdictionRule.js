import mongoose from 'mongoose';
import {
  CATALOG_REVIEW_STATUSES,
  FACT_CATEGORIES,
  GBS_CATALOG_SCHEMA_VERSION,
} from '../../../../shared/gbs/catalogConstants.js';

const schema = new mongoose.Schema(
  {
    ruleId: { type: String, required: true },
    jurisdictionId: { type: String, required: true, index: true },
    authorityId: { type: String, required: true },
    entityTypeId: { type: String, default: null },
    factCategory: { type: String, required: true, enum: Object.values(FACT_CATEGORIES) },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    sourceId: { type: String, required: true },
    sourceVersion: { type: Number, default: 1 },
    reviewStatus: {
      type: String,
      default: CATALOG_REVIEW_STATUSES.DRAFT,
      enum: Object.values(CATALOG_REVIEW_STATUSES),
      index: true,
    },
    reviewDueAt: { type: Date },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    superseded: { type: Boolean, default: false },
    supersededBy: { type: String, default: null },
    schemaVersion: { type: String, default: GBS_CATALOG_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ ruleId: 1, sourceVersion: 1 }, { unique: true });
schema.index({ jurisdictionId: 1, factCategory: 1, reviewStatus: 1 });

export const GbsJurisdictionRule = mongoose.model('GbsJurisdictionRule', schema);
