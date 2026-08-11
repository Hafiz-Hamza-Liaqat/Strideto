/**
 * CanonicalScholarship — authoritative scholarship record (Mission 7).
 *
 * Stores structured, source-backed scholarship intelligence.
 * The old Scholarship / IntlScholarship models remain for CMS content and are
 * not replaced here.
 *
 * adminNotes is server-only and MUST NEVER be projected to public endpoints.
 * Never publish wording that implies guaranteed scholarship, admission, visa, or employment.
 */
import mongoose from 'mongoose';
import {
  SCHOLARSHIP_TYPES,
  PROVIDER_TYPES,
  FUNDING_TYPES,
  FUNDING_COMPONENTS,
  APPLICATION_METHODS,
  CRITERIA_TYPES,
} from '../../../../shared/education/scholarshipIntelligence.js';
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

// ── Shared evidence subdoc (Mission 1 contract) ───────────────────────────────

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

// ── Funding component subdoc ──────────────────────────────────────────────────
// amountMinor + currency follow the Mission 1 Money contract (integer minor units).

const fundingComponentSchema = new mongoose.Schema(
  {
    component: {
      type: String,
      enum: Object.values(FUNDING_COMPONENTS),
      required: true,
    },
    // Money: integer minor units. null = amount not specified.
    amountMinor: { type: Number, default: null },
    currency: { type: String, trim: true, uppercase: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ── Funding subdoc ────────────────────────────────────────────────────────────

const fundingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(FUNDING_TYPES),
      default: FUNDING_TYPES.UNKNOWN,
    },
    // For fixed_amount / partial: top-level amount in Money contract.
    amountMinor: { type: Number, default: null },
    currency: { type: String, trim: true, uppercase: true, default: '' },
    components: { type: [fundingComponentSchema], default: [] },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ── Eligibility criteria subdoc ───────────────────────────────────────────────

const criteriaSchema = new mongoose.Schema(
  {
    criteriaType: {
      type: String,
      enum: Object.values(CRITERIA_TYPES),
      required: true,
    },
    // Original grading context preserved alongside value.
    value: { type: String, trim: true, default: '' },
    gradingContext: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const canonicalScholarshipSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },

    // ── Provider ───────────────────────────────────────────────────────────────
    provider: {
      name: { type: String, trim: true, default: '' },
      providerType: {
        type: String,
        enum: Object.values(PROVIDER_TYPES),
      },
    },

    // ── Taxonomy / scope ───────────────────────────────────────────────────────
    scholarshipType: {
      type: String,
      enum: Object.values(SCHOLARSHIP_TYPES),
      index: true,
    },
    // ISO 3166-1 alpha-2. Global scope = ['*'].
    destinationCountries: {
      type: [{ type: String, trim: true, uppercase: true }],
      default: [],
      index: true,
    },
    degreeLevels: {
      type: [{ type: String, enum: Object.values(DEGREE_LEVELS) }],
      default: [],
      index: true,
    },
    fields: {
      type: [{ type: String, enum: Object.values(ACADEMIC_FIELDS) }],
      default: [],
      index: true,
    },
    studyModes: {
      type: [{ type: String, enum: Object.values(STUDY_MODES) }],
      default: [],
    },

    // ── Funding ────────────────────────────────────────────────────────────────
    funding: { type: fundingSchema, default: () => ({ type: FUNDING_TYPES.UNKNOWN }) },

    // ── Criteria (factual only) ────────────────────────────────────────────────
    // Mission 7 stores; Mission 8 evaluates user against them.
    criteria: { type: [criteriaSchema], default: [] },

    // ── Application ────────────────────────────────────────────────────────────
    applicationMethod: {
      type: String,
      enum: Object.values(APPLICATION_METHODS),
    },
    applicationUrl: { type: String, trim: true, default: '' },

    // ── Summary ────────────────────────────────────────────────────────────────
    summary: { type: String, trim: true, default: '' },

    // ── Provenance (Mission 5) ─────────────────────────────────────────────────
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
      index: true,
    },
    lastVerifiedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null, index: true },

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalInstitution',
      default: null,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    applicableProgramIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
    nationalityScope: { type: [String], default: [] },
    cycleLabel: { type: String, trim: true, default: '' },
    deadlineDate: { type: String, trim: true, default: '' },

    // Internal — MUST NOT be projected to public endpoints
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

canonicalScholarshipSchema.index({ status: 1, scholarshipType: 1 });
canonicalScholarshipSchema.index({ status: 1, destinationCountries: 1 });
canonicalScholarshipSchema.index({ status: 1, degreeLevels: 1 });
canonicalScholarshipSchema.index({ status: 1, fields: 1 });
canonicalScholarshipSchema.index({ 'funding.type': 1, status: 1 });
canonicalScholarshipSchema.index({ verificationStatus: 1, freshnessState: 1 });

// ── Auto-slug ─────────────────────────────────────────────────────────────────

canonicalScholarshipSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = educationSlug(this.title);
  }
  next();
});

export const CanonicalScholarship = mongoose.model('CanonicalScholarship', canonicalScholarshipSchema);
