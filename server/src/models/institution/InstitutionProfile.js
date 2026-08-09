/**
 * InstitutionProfile — official institution profile (Mission 18).
 *
 * One record per Organization. Stores extended official profile fields
 * beyond the base Organization identity. Linked via organizationId.
 *
 * Provenanced as institution_official — institution login alone is not
 * sufficient proof of every submitted fact.
 *
 * Public projection must omit: adminNotes, internal contact/security data,
 * representative details, raw verification documents.
 */
import mongoose from 'mongoose';
import { INSTITUTION_SOURCE_TYPE } from '../../../../shared/institution/institutionPortal.js';
import {
  DEGREE_LEVELS,
  STUDY_MODES,
} from '../../../../shared/education/taxonomy.js';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: '' },
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const accreditationRefSchema = new mongoose.Schema(
  {
    body: { type: String, trim: true, default: '' },
    number: { type: String, trim: true, default: '' },
    jurisdiction: { type: String, trim: true, default: '' },
    issuedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    verificationUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const identifierSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, default: '' },
    issuingAuthority: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const institutionProfileSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },

    // Official identity — not arbitrary marketing copy
    officialDisplayName: { type: String, trim: true, default: '' },
    legalName: { type: String, trim: true, default: '' },
    aliases: { type: [String], default: [] },

    // Type reference (maps to CanonicalInstitution.institutionType)
    institutionType: { type: String, trim: true, default: '' },

    // Primary country (ISO 3166-1 alpha-2)
    countryCode: { type: String, trim: true, uppercase: true, default: '' },

    // Multi-campus addresses
    addresses: { type: [addressSchema], default: [] },

    // Web presence
    officialWebsite: { type: String, trim: true, default: '' },
    officialAdmissionsWebsite: { type: String, trim: true, default: '' },

    // Public contact channels (never private/security contact)
    officialContactEmail: { type: String, trim: true, lowercase: true, default: '' },
    officialPhone: { type: String, trim: true, default: '' },

    // Description — must be source-backed, not generated
    institutionDescription: { type: String, trim: true, default: '' },

    // Academic profile
    academicLevels: {
      type: [{ type: String, enum: Object.values(DEGREE_LEVELS) }],
      default: [],
    },
    studyModes: {
      type: [{ type: String, enum: Object.values(STUDY_MODES) }],
      default: [],
    },

    // Accreditation references
    accreditationRefs: { type: [accreditationRefSchema], default: [] },

    // Institution identifiers (e.g. UCAS code, IPEDS ID)
    institutionIdentifiers: { type: [identifierSchema], default: [] },

    // direct application capability marker (future integration readiness)
    directApplicationCapability: {
      type: String,
      enum: ['not_configured'],
      default: 'not_configured',
    },

    // Commerce capability marker (not provisioned in M18)
    commerceCapability: {
      type: String,
      enum: ['not_configured'],
      default: 'not_configured',
    },

    // Source attribution for this profile
    sourceType: { type: String, trim: true, default: INSTITUTION_SOURCE_TYPE },

    // Computed completeness snapshot (recomputed on save, not client-authoritative)
    completenessScore: { type: Number, default: 0, min: 0, max: 100 },

    // Internal — never expose
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

institutionProfileSchema.index({ countryCode: 1 });
institutionProfileSchema.index({ institutionType: 1 });

export const InstitutionProfile =
  mongoose.models.InstitutionProfile ||
  mongoose.model('InstitutionProfile', institutionProfileSchema);
