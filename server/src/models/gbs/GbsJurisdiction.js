import mongoose from 'mongoose';
import {
  CATALOG_REVIEW_STATUSES,
  CATALOG_STATUSES,
  GBS_CATALOG_SCHEMA_VERSION,
  JURISDICTION_LEVELS,
} from '../../../../shared/gbs/catalogConstants.js';

const schema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true, uppercase: true },
    countryCode: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    level: { type: String, required: true, enum: Object.values(JURISDICTION_LEVELS) },
    parentJurisdictionId: { type: String, default: null, index: true },
    status: { type: String, default: CATALOG_STATUSES.ACTIVE, enum: Object.values(CATALOG_STATUSES) },
    reviewStatus: {
      type: String,
      default: CATALOG_REVIEW_STATUSES.DRAFT,
      enum: Object.values(CATALOG_REVIEW_STATUSES),
      index: true,
    },
    launchCandidate: { type: Boolean, default: false },
    launchCoverage: { type: Boolean, default: false },
    schemaVersion: { type: String, default: GBS_CATALOG_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ countryCode: 1, code: 1 }, { unique: true });
schema.index({ parentJurisdictionId: 1, reviewStatus: 1 });

export const GbsJurisdiction = mongoose.model('GbsJurisdiction', schema);
