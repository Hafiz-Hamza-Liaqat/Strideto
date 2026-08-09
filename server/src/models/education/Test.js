/**
 * Test — canonical, extensible test catalog (Mission 4).
 *
 * Separate from the legacy Exam model (which handles the existing PPSC/NTS quiz
 * flow). This model covers international proficiency and admissions tests.
 * Architecture is global: no Pakistan-only defaults.
 */
import mongoose from 'mongoose';
import {
  TEST_CATEGORIES,
  DELIVERY_MODES,
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

const sectionSubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: '' },
    durationMinutes: { type: Number },
    weight: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const testSchema = new mongoose.Schema(
  {
    // Application-level stable id (e.g. "ielts", "toefl-ibt"). Immutable once set.
    stableId: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: '' },
    category: {
      type: String,
      required: true,
      enum: Object.values(TEST_CATEGORIES),
      index: true,
    },
    // Reference to canonical TestProvider. Kept as string id to avoid hard coupling.
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestProvider', index: true },
    description: { type: String, trim: true, default: '' },
    overview: { type: String, trim: true, default: '' },
    // Why this test is taken (free-form, e.g. ["university admission", "visa application"]).
    purposes: { type: [String], default: [] },
    // ISO 3166-1 alpha-2 codes of countries where this test is offered.
    countryCodes: { type: [String], default: [] },
    deliveryModes: {
      type: [{ type: String, enum: Object.values(DELIVERY_MODES) }],
      default: [],
    },
    sections: { type: [sectionSubSchema], default: [] },
    totalDurationMinutes: { type: Number },
    // Human-readable score scale (e.g. "0–9 band score in 0.5 increments").
    scoreScale: { type: String, trim: true, default: '' },
    // How long scores are valid (in months). null = no expiry.
    validityMonths: { type: Number, default: null },
    registrationUrl: { type: String, trim: true, default: '' },
    officialWebsite: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
    displayOrder: { type: Number, default: 0 },
    sources: { type: [evidenceSubSchema], default: [] },
  },
  { timestamps: true }
);

testSchema.index({ category: 1, status: 1 });
testSchema.index({ providerId: 1, status: 1 });
testSchema.index({ name: 'text', shortName: 'text', description: 'text' });

testSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = educationSlug(this.name);
  }
  next();
});

export const Test = mongoose.model('Test', testSchema);
