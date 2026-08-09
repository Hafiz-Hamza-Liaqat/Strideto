/**
 * TestAcceptance — canonical test acceptance record (Mission 6).
 *
 * One record per acceptance claim at any point in time.
 * When a published claim changes, the old record is marked superseded and a
 * new record is created — history is preserved, never deleted.
 *
 * Scope hierarchy enforced at the application layer:
 *   program_intake > program > institution > country
 *
 * adminNotes is internal and must NEVER be projected to public endpoints.
 */
import mongoose from 'mongoose';
import {
  ACCEPTANCE_STATUSES,
  ACCEPTANCE_SCOPES,
} from '../../../../shared/education/acceptanceExplorer.js';
import {
  DEGREE_LEVELS,
  STUDY_MODES,
  PUB_STATUSES,
} from '../../../../shared/education/taxonomy.js';
import {
  VERIFICATION_STATUSES,
  FRESHNESS_STATES,
} from '../../../../shared/trust/sourceVerification.js';

// Embedded evidence subdocument (Mission 1 contract)
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

// Section/subscore minimum entry
const sectionMinimumSchema = new mongoose.Schema(
  {
    sectionName: { type: String, required: true, trim: true },
    minimum: { type: Number, required: true },
    scale: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const testAcceptanceSchema = new mongoose.Schema(
  {
    // ── Core references ───────────────────────────────────────────────────────
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
      index: true,
    },

    // Optional scope refinement — null = country-level or general
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalInstitution',
      default: null,
      index: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      default: null,
      index: true,
    },

    // ISO 3166-1 alpha-2. Required for country scope; optional but recommended
    // for institution/program scope (indicates which country the institution is in).
    countryCode: { type: String, trim: true, uppercase: true, default: '' },

    // ── Acceptance ────────────────────────────────────────────────────────────
    acceptanceStatus: {
      type: String,
      enum: Object.values(ACCEPTANCE_STATUSES),
      required: true,
      index: true,
    },

    // Scope of this claim — drives precedence resolution
    acceptanceScope: {
      type: String,
      enum: Object.values(ACCEPTANCE_SCOPES),
      required: true,
      index: true,
    },

    // ── Score requirements ────────────────────────────────────────────────────
    // overall null = no numeric minimum specified for this claim
    minimumOverallScore: { type: Number, default: null },
    sectionMinimums: { type: [sectionMinimumSchema], default: [] },
    scoreNotes: { type: String, trim: true, default: '' },

    // ── Applicability ─────────────────────────────────────────────────────────
    degreeLevels: {
      type: [{ type: String, enum: Object.values(DEGREE_LEVELS) }],
      default: [],
    },
    studyModes: {
      type: [{ type: String, enum: Object.values(STUDY_MODES) }],
      default: [],
    },

    // Intake / term string (e.g. "September 2025", "2025-26", "Fall 2026").
    // Drives program_intake scope disambiguation.
    intake: { type: String, trim: true, default: '' },

    // Effective date window for this requirement
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },

    // ── Conditions / exceptions ───────────────────────────────────────────────
    conditions: { type: String, trim: true, default: '' },
    waiverNotes: { type: String, trim: true, default: '' },

    // ── Provenance (Mission 5 integration) ────────────────────────────────────
    // CanonicalSource references for deep freshness tracking
    sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalSource' }],

    // Embedded evidence subdocs (Mission 1 contract) for convenience
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

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },

    // When this claim is superseded, points to the replacement record.
    // Terminal: a superseded record is kept for audit history, never re-published.
    supersededById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestAcceptance',
      default: null,
    },

    // Internal — NEVER project to public endpoints
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// ── Indexes for common access patterns ────────────────────────────────────────

// Forward lookup: test → destinations
testAcceptanceSchema.index({ testId: 1, status: 1, acceptanceStatus: 1 });
testAcceptanceSchema.index({ testId: 1, countryCode: 1, status: 1 });
testAcceptanceSchema.index({ testId: 1, institutionId: 1, status: 1 });
testAcceptanceSchema.index({ testId: 1, programId: 1, status: 1 });

// Reverse lookup: institution/program → accepted tests
testAcceptanceSchema.index({ institutionId: 1, status: 1 });
testAcceptanceSchema.index({ programId: 1, status: 1 });

// Conflict detection: all published claims for a given (test, scope, entities)
testAcceptanceSchema.index({
  testId: 1,
  acceptanceScope: 1,
  institutionId: 1,
  programId: 1,
  countryCode: 1,
  status: 1,
});

// Freshness queue
testAcceptanceSchema.index({ verificationStatus: 1, freshnessState: 1 });

export const TestAcceptance = mongoose.model('TestAcceptance', testAcceptanceSchema);
