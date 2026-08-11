import mongoose from 'mongoose';
import { jobSlug } from '../utils/slugify.js';
import { translationFieldDefinition, applySlugLocaleIndex, ensureTranslationGroupHook } from './mixins/translationFields.js';
import { normalizeCurrency } from '../../../shared/international/currency.js';

const { ObjectId } = mongoose.Schema.Types;

const CANONICAL_PUBLICATION_STATES = Object.freeze([
  'draft',
  'pending_review',
  'active',
  'rejected',
  'closed',
  'expired',
]);

const PUBLICATION_MIGRATION_STATUSES = Object.freeze([
  'canonical_native',
  'legacy_backfilled',
  'legacy_compatible',
  'manual_review',
]);

const rejectionSummarySchema = new mongoose.Schema(
  {
    reasonCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      match: /^[A-Z0-9_]+$/,
    },
    ownerMessage: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    eventId: {
      type: ObjectId,
      ref: 'JobModerationEvent',
      required: true,
    },
    decidedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' }
);

function hasCanonicalState(states) {
  return function canonicalStateMatches() {
    return states.includes(this.publicationState);
  };
}

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    company: { type: String, required: true },
    organization: { type: String }, // alias / display name
    location: { type: String },
    province: { type: String },
    city: { type: String },
    category: { type: String },
    type: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship'], default: 'full-time' },
    jobType: { type: String, enum: ['Government', 'Private', 'Internship'], default: 'Private' },
    educationRequirement: { type: String },
    experience: { type: String },
    applyType: { type: String, enum: ['external', 'internal'], default: 'external' },
    applicationLink: { type: String }, // external apply URL (e.g. PPSC, university portal)
    description: { type: String },
    requirements: [{ type: String }],
    applicationInstructions: { type: String },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer' },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPlan' },
    planType: { type: String, enum: ['free', 'starter', 'standard', 'premium'], default: null },
    expiresAt: { type: Date },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'active' },
    deadline: { type: Date },
    logoUrl: { type: String },
    views: { type: Number, default: 0 },
    applicationsCount: { type: Number, default: 0 },
    /** L.2.8 — optional headcount; null = unlimited */
    totalSeats: { type: Number, default: null, min: 1 },
    /**
     * Phase 4 canonical openings for direct Employer jobs.
     * null = legacy unspecified (do not auto-fill). Integer 1–10000 when set.
     */
    openingsCount: {
      type: Number,
      default: null,
      min: 1,
      max: 10000,
      validate: {
        validator(value) {
          return value == null || Number.isInteger(value);
        },
        message: 'openingsCount must be an integer',
      },
    },
    submittedAt: { type: Date, default: null },
    chargedSubmissionAt: { type: [Date], default: undefined },
    postedByEmployerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', default: null },
    autoCloseWhenFilled: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isSponsored: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    urgent: { type: Boolean, default: false },
    boostLevel: { type: Number, default: 0 },
    paidUntil: { type: Date },
    source: { type: String, enum: ['manual', 'scraper', 'employer'], default: 'manual' },
    salaryRange: { type: String },
    skillsRequired: [{ type: String }],
    applyEmail: { type: String },
    scrapedAt: { type: Date },
    sourceUrl: { type: String },
    sourceWebsite: { type: String }, // e.g. PPSC, FPSC, LinkedIn, Rozee.pk
    externalId: { type: String, unique: true, sparse: true }, // unique per source for dedup
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    publicationState: {
      type: String,
      enum: CANONICAL_PUBLICATION_STATES,
    },
    publicationVersion: {
      type: Number,
      min: 0,
      required: hasCanonicalState(CANONICAL_PUBLICATION_STATES),
      validate: {
        validator(value) {
          return value == null || Number.isInteger(value);
        },
        message: 'publicationVersion must be an integer',
      },
    },
    currentSubmissionId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      required: hasCanonicalState(['pending_review', 'active', 'rejected']),
    },
    lastApprovedSubmissionId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      required: hasCanonicalState(['active']),
    },
    publishedAt: {
      type: Date,
      required: hasCanonicalState(['active']),
    },
    visibleUntil: {
      type: Date,
      required: hasCanonicalState(['active']),
      validate: {
        validator(value) {
          return !value || !this.publishedAt || value >= this.publishedAt;
        },
        message: 'visibleUntil cannot be earlier than publishedAt',
      },
    },
    applicationsCloseAt: {
      type: Date,
      required: hasCanonicalState(['active']),
      validate: {
        validator(value) {
          return !value || !this.visibleUntil || value <= this.visibleUntil;
        },
        message: 'applicationsCloseAt cannot be later than visibleUntil',
      },
    },
    closedAt: {
      type: Date,
      required: hasCanonicalState(['closed']),
    },
    expiredAt: {
      type: Date,
      required: hasCanonicalState(['expired']),
    },
    rejectionSummary: {
      type: rejectionSummarySchema,
      required: hasCanonicalState(['rejected']),
    },
    slugFrozenAt: {
      type: Date,
      required: hasCanonicalState(['active']),
    },
    policyVersion: {
      type: String,
      trim: true,
      maxlength: 100,
      required: hasCanonicalState(['pending_review', 'active', 'rejected']),
    },
    publicationUpdatedAt: { type: Date },
    publicationMigrationStatus: {
      type: String,
      enum: PUBLICATION_MIGRATION_STATUSES,
    },
    remote: { type: Boolean, default: false },
    hybrid: { type: Boolean, default: false },
    responsibilities: [{ type: String }],
    benefits: [{ type: String }],
    gender: { type: String },
    salaryCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      validate: { validator: value => value === '' || normalizeCurrency(value) === value, message: 'salaryCurrency must be a valid ISO 4217 code' },
    },
    gallery: [{ type: String }],
    seoTitle: { type: String },
    metaDescription: { type: String },
    ...translationFieldDefinition,
  },
  { timestamps: true }
);

jobSchema.index({ sourceWebsite: 1, status: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ status: 1, deadline: 1 });
jobSchema.index({ province: 1, status: 1 });
jobSchema.index({ category: 1, status: 1 });
jobSchema.index({ title: 'text', company: 'text', location: 'text', province: 'text' });
jobSchema.index({ employerId: 1, status: 1 });
jobSchema.index({ status: 1, approvalStatus: 1 });
jobSchema.index({ expiresAt: 1 });
applySlugLocaleIndex(jobSchema);
ensureTranslationGroupHook(jobSchema);

jobSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = jobSlug(this.title, this.province || this.location || '');
  }
  next();
});

export const Job = mongoose.model('Job', jobSchema);
