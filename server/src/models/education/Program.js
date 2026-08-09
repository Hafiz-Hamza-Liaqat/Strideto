/**
 * Program — foundational program entity (Mission 4).
 *
 * Shell only. Missions 6–8 will build test acceptance, scholarship linkage,
 * and matching on top. Architecture is global (no hardcoded country/currency).
 */
import mongoose from 'mongoose';
import {
  DEGREE_LEVELS,
  ACADEMIC_FIELDS,
  STUDY_MODES,
  PUB_STATUSES,
  educationSlug,
} from '../../../../shared/education/taxonomy.js';

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

programSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = educationSlug(this.name);
  }
  next();
});

export const Program = mongoose.model('Program', programSchema);
