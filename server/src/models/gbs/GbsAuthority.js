import mongoose from 'mongoose';
import {
  AUTHORITY_TYPES,
  CATALOG_STATUSES,
  GBS_CATALOG_SCHEMA_VERSION,
} from '../../../../shared/gbs/catalogConstants.js';

const schema = new mongoose.Schema(
  {
    authorityId: { type: String, required: true, unique: true },
    jurisdictionId: { type: String, required: true, index: true },
    authorityType: { type: String, required: true, enum: Object.values(AUTHORITY_TYPES) },
    name: { type: String, required: true },
    officialDomain: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' },
    status: { type: String, default: CATALOG_STATUSES.ACTIVE, enum: Object.values(CATALOG_STATUSES) },
    schemaVersion: { type: String, default: GBS_CATALOG_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ jurisdictionId: 1, authorityType: 1 });

export const GbsAuthority = mongoose.model('GbsAuthority', schema);
