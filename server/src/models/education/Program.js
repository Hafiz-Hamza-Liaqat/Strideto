/**
 * Program — canonical program entity (Mission 4, extended Mission 7).
 *
 * Mission 7 adds: intakes, tuition metadata, admission URL, country,
 * provenance/freshness fields, and sourceIds.
 * ProgramRequirement (separate model) holds structured admission requirements.
 * TestAcceptance (Mission 6) holds accepted test claims — not duplicated here.
 */
import mongoose from 'mongoose';
import {
  DEGREE_LEVELS,
  ACADEMIC_FIELDS,
  STUDY_MODES,
  PUB_STATUSES,
  educationSlug,
} from '../../../../shared/education/taxonomy.js';
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

const programSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalInstitution',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    degreeLevel: {
      type: String,
      enum: Object.values(DEGREE_LEVELS),
      index: true,
    },
    field: {
      type: String,
      enum: Object.values(ACADEMIC_FIELDS),
      index: true,
    },
    campus: { type: String, trim: true, default: '' },
    studyMode: {
      type: String,
      enum: Object.values(STUDY_MODES),
    },
    durationMonths: { type: Number },
    officialProgramUrl: { type: String, trim: true, default: '' },

    // ── Mission 7 additions ────────────────────────────────────────────────────

    // ISO 3166-1 alpha-2. Typically derived from institution, stored for query.
    country: { type: String, trim: true, uppercase: true, default: '', index: true },

    // Intakes: lightweight per-cycle window. Full deadline detail lives in
    // ScholarshipCycle / TestAcceptance intake fields.
    intakes: {
      type: [
        new mongoose.Schema(
          {
            cycleLabel: { type: String, trim: true, default: '' },
            applicationOpenAt: { type: Date, default: null },
            deadlineAt: { type: Date, default: null },
            notes: { type: String, trim: true, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // Tuition metadata — Money contract (Mission 1): integer minor units.
    tuition: {
      type: new mongoose.Schema(
        {
          amountMinor: { type: Number, default: null },
          currency: { type: String, trim: true, uppercase: true, default: '' },
          per: { type: String, trim: true, default: '' }, // e.g. "year", "semester", "program"
          notes: { type: String, trim: true, default: '' },
        },
        { _id: false }
      ),
      default: null,
    },

    // Official page listing admission requirements
    admissionRequirementsUrl: { type: String, trim: true, default: '' },

    // Provenance (Mission 5)
    sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalSource' }],

    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      default: VERIFICATION_STATUSES.UNVERIFIED,
    },
    freshnessState: {
      type: String,
      enum: Object.values(FRESHNESS_STATES),
      default: FRESHNESS_STATES.UNKNOWN,
    },
    lastVerifiedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },

    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
    sources: { type: [evidenceSubSchema], default: [] },
  },
  { timestamps: true }
);

programSchema.index({ institutionId: 1, status: 1 });
programSchema.index({ degreeLevel: 1, field: 1, status: 1 });
programSchema.index({ country: 1, status: 1 });
programSchema.index({ studyMode: 1, status: 1 });

programSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = educationSlug(this.name);
  }
  next();
});

export const Program = mongoose.model('Program', programSchema);
