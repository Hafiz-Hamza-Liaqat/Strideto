/**
 * ProgramRequirement — structured admission requirement for a Program (Mission 7).
 *
 * Reuses Mission 6 TestAcceptance for accepted-test claims — does NOT duplicate them.
 * For language_test / standardized_test types, testId links to Test and acceptance
 * details are resolved via TestAcceptance.
 *
 * Do NOT turn general program descriptions into structured requirements.
 * adminNotes is server-only and MUST NOT be projected to public endpoints.
 */
import mongoose from 'mongoose';
import {
  PROGRAM_REQUIREMENT_TYPES,
  REQUIREMENT_SEMANTICS,
} from '../../../../shared/education/scholarshipIntelligence.js';
import { PUB_STATUSES } from '../../../../shared/education/taxonomy.js';
import {
  VERIFICATION_STATUSES,
  FRESHNESS_STATES,
} from '../../../../shared/trust/sourceVerification.js';

const evidenceSubSchema = new mongoose.Schema(
  {
    sourceType: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    publisher: { type: String, trim: true, default: '' },
    retrievedAt: { type: Date },
    verifiedAt: { type: Date },
    evidenceRef: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const sectionMinimumSchema = new mongoose.Schema(
  {
    sectionName: { type: String, required: true, trim: true },
    minimum: { type: Number, required: true },
    scale: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const programRequirementSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },

    requirementType: {
      type: String,
      enum: Object.values(PROGRAM_REQUIREMENT_TYPES),
      required: true,
      index: true,
    },

    semantics: {
      type: String,
      enum: Object.values(REQUIREMENT_SEMANTICS),
      required: true,
    },

    // When semantics = conditional, what is the condition?
    conditionNote: { type: String, trim: true, default: '' },

    // For language_test / standardized_test — links to Test catalog (Mission 4).
    // Full acceptance terms are in TestAcceptance (Mission 6).
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
      index: true,
    },

    // Minimum overall score. Null = no numeric minimum specified.
    minimumScore: { type: Number, default: null },
    sectionMinimums: { type: [sectionMinimumSchema], default: [] },

    // For prerequisite_subject
    subjectName: { type: String, trim: true, default: '' },

    // For document type
    documentName: { type: String, trim: true, default: '' },

    // Free-text description (must be source-backed, not generated)
    description: { type: String, trim: true, default: '' },

    // Intake / term context
    intake: { type: String, trim: true, default: '' },

    // Effective date window
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },

    // Provenance (Mission 5)
    sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalSource' }],
    sources: { type: [evidenceSubSchema], default: [] },

    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      default: VERIFICATION_STATUSES.UNVERIFIED,
      index: true,
    },
    freshnessState: {
      type: String,
      enum: Object.values(FRESHNESS_STATES),
      default: FRESHNESS_STATES.UNKNOWN,
    },
    lastVerifiedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },

    // Internal — MUST NOT be projected to public endpoints
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

programRequirementSchema.index({ programId: 1, status: 1, requirementType: 1 });
programRequirementSchema.index({ programId: 1, testId: 1 });

export const ProgramRequirement = mongoose.model('ProgramRequirement', programRequirementSchema);
