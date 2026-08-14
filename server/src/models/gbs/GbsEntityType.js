import mongoose from 'mongoose';
import {
  CATALOG_REVIEW_STATUSES,
  CATALOG_STATUSES,
  GBS_CATALOG_SCHEMA_VERSION,
} from '../../../../shared/gbs/catalogConstants.js';

const schema = new mongoose.Schema(
  {
    entityTypeId: { type: String, required: true, unique: true },
    jurisdictionId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    displayName: { type: String, required: true },
    officialName: { type: String, default: '' },
    status: { type: String, default: CATALOG_STATUSES.ACTIVE, enum: Object.values(CATALOG_STATUSES) },
    sourceId: { type: String, default: '' },
    sourceVersion: { type: Number, default: 1 },
    reviewStatus: {
      type: String,
      default: CATALOG_REVIEW_STATUSES.DRAFT,
      enum: Object.values(CATALOG_REVIEW_STATUSES),
    },
    schemaVersion: { type: String, default: GBS_CATALOG_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ jurisdictionId: 1, code: 1 }, { unique: true });

export const GbsEntityType = mongoose.model('GbsEntityType', schema);
