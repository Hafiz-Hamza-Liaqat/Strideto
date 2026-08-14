import mongoose from 'mongoose';
import {
  AUTHORITY_TYPES,
  CATALOG_REVIEW_STATUSES,
  FACT_CATEGORIES,
  FRESHNESS_CLASSES,
  GBS_CATALOG_SCHEMA_VERSION,
  SOURCE_TYPES,
} from '../../../../shared/gbs/catalogConstants.js';

const schema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    authorityId: { type: String, required: true, index: true },
    jurisdictionId: { type: String, required: true, index: true },
    sourceUrl: { type: String, required: true },
    sourceType: { type: String, required: true, enum: Object.values(SOURCE_TYPES) },
    authorityType: { type: String, enum: Object.values(AUTHORITY_TYPES) },
    factCategory: { type: String, required: true, enum: Object.values(FACT_CATEGORIES) },
    title: { type: String, default: '' },
    retrievedAt: { type: Date },
    lastReviewedAt: { type: Date },
    reviewDueAt: { type: Date, index: true },
    freshnessClass: { type: String, enum: Object.values(FRESHNESS_CLASSES) },
    reviewStatus: {
      type: String,
      default: CATALOG_REVIEW_STATUSES.DRAFT,
      enum: Object.values(CATALOG_REVIEW_STATUSES),
      index: true,
    },
    reviewedBy: { type: String, default: '' },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    superseded: { type: Boolean, default: false },
    supersededBy: { type: String, default: null },
    sourceVersion: { type: Number, default: 1, min: 1 },
    fingerprintCanonical: { type: String, default: '' },
    notes: { type: String, default: '' },
    schemaVersion: { type: String, default: GBS_CATALOG_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ sourceId: 1, sourceVersion: 1 }, { unique: true });
schema.index({ jurisdictionId: 1, reviewStatus: 1, reviewDueAt: 1 });

export const GbsOfficialSource = mongoose.model('GbsOfficialSource', schema);
