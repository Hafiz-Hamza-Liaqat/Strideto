/**
 * ScholarshipApplicability — relation model linking a CanonicalScholarship to
 * countries, institutions, programs, degree levels, or fields (Mission 7).
 *
 * Separate relation model avoids embedding large arrays in the scholarship doc.
 * Reuses Mission 6 TestAcceptance scope vocabulary for consistency.
 */
import mongoose from 'mongoose';
import {
  APPLICABILITY_SCOPES,
} from '../../../../shared/education/scholarshipIntelligence.js';
import {
  DEGREE_LEVELS,
  ACADEMIC_FIELDS,
  PUB_STATUSES,
} from '../../../../shared/education/taxonomy.js';

const scholarshipApplicabilitySchema = new mongoose.Schema(
  {
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalScholarship',
      required: true,
      index: true,
    },

    scope: {
      type: String,
      enum: Object.values(APPLICABILITY_SCOPES),
      required: true,
      index: true,
    },

    // ISO 3166-1 alpha-2 — for country scope
    countryCode: { type: String, trim: true, uppercase: true, default: '' },

    // For institution scope
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalInstitution',
      default: null,
      index: true,
    },

    // For program scope
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      default: null,
      index: true,
    },

    // For degree_level scope
    degreeLevel: {
      type: String,
      enum: Object.values(DEGREE_LEVELS),
    },

    // For field scope
    field: {
      type: String,
      enum: Object.values(ACADEMIC_FIELDS),
    },

    notes: { type: String, trim: true, default: '' },

    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
  },
  { timestamps: true }
);

scholarshipApplicabilitySchema.index({ scholarshipId: 1, scope: 1, status: 1 });
scholarshipApplicabilitySchema.index({ institutionId: 1, status: 1 });
scholarshipApplicabilitySchema.index({ programId: 1, status: 1 });

export const ScholarshipApplicability = mongoose.model(
  'ScholarshipApplicability',
  scholarshipApplicabilitySchema
);
