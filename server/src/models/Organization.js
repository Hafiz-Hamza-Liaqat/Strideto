/**
 * Organization — additive international organization identity (Mission 1).
 *
 * This is the smallest backward-compatible persistence of the shared
 * Organization contract (shared/international/organization.js). It is ADDITIVE:
 *
 *   - It does NOT replace the existing Employer model.
 *   - No employer is migrated into it during Mission 1 (no live backfill).
 *   - `legacyEmployerId` (and future legacy links) let an Organization point at
 *     the domain record it represents, so migration can be incremental later.
 *
 * Trust/verification state, evidence and risk are OWNED BY MISSION 2 and are
 * intentionally absent here — only a coarse lifecycle `status` exists.
 *
 * Fields mirror the shared contract's canonical vocabulary; validation of type/
 * status/slug/country is delegated to that shared module at the service layer.
 */
import mongoose from 'mongoose';
import {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
} from '../../../shared/international/organization.js';

const addressSubSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    // Canonical ISO 3166-1 alpha-2; validated by the shared contract on write.
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    latitude: { type: Number },
    longitude: { type: Number },
    googleMapsUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    organizationType: {
      type: String,
      required: true,
      enum: Object.values(ORGANIZATION_TYPES),
      index: true,
    },
    legalName: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, required: true },
    // Public, collision-safe slug. Unique+sparse so records may exist before a
    // slug is assigned (no auto-backfill in Mission 1).
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    // Canonical ISO 3166-1 alpha-2; empty until known (never defaulted to PK).
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    website: { type: String, trim: true, default: '' },
    officialDomain: { type: String, trim: true, lowercase: true, default: '' },
    // E.164-compatible canonical phone; empty until known (never assumes +92).
    phone: { type: String, trim: true, default: '' },
    address: { type: addressSubSchema, default: undefined },
    status: {
      type: String,
      enum: Object.values(ORGANIZATION_STATUSES),
      default: ORGANIZATION_STATUSES.DRAFT,
      index: true,
    },
    /**
     * Link to the legacy Employer this Organization represents, when any. Sparse
     * + unique so an employer maps to at most one Organization, while the vast
     * majority of employers (never migrated in Mission 1) have no row at all.
     */
    legacyEmployerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

organizationSchema.index({ organizationType: 1, status: 1 });
organizationSchema.index({ countryCode: 1 });

export const Organization = mongoose.model('Organization', organizationSchema);
