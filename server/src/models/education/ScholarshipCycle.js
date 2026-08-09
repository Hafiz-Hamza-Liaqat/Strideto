/**
 * ScholarshipCycle — cycle/deadline record for a CanonicalScholarship (Mission 7).
 *
 * One record per cycle. Historical cycles are preserved (never deleted).
 * Unknown deadlines remain unknown — do not invent dates.
 * Timezone is stored when source-backed.
 */
import mongoose from 'mongoose';
import { CYCLE_STATUSES } from '../../../../shared/education/scholarshipIntelligence.js';
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

const scholarshipCycleSchema = new mongoose.Schema(
  {
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalScholarship',
      required: true,
      index: true,
    },

    // Human-readable cycle label, e.g. "2025-26", "Autumn 2025"
    cycleLabel: { type: String, trim: true, default: '' },
    academicYear: { type: String, trim: true, default: '' },
    intake: { type: String, trim: true, default: '' },

    // Null means unknown — do not fabricate
    applicationOpenAt: { type: Date, default: null },
    deadlineAt: { type: Date, default: null },

    // IANA timezone string, e.g. "America/New_York", when source specifies it
    timezone: { type: String, trim: true, default: '' },

    // Effective validity window for this cycle record
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },

    // Derived cycle status — can be overridden by admin when source is unclear
    cycleStatus: {
      type: String,
      enum: Object.values(CYCLE_STATUSES),
      default: CYCLE_STATUSES.UNKNOWN,
      index: true,
    },

    // True for past cycles preserved for audit/reference
    isHistorical: { type: Boolean, default: false, index: true },

    // Provenance
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

    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

scholarshipCycleSchema.index({ scholarshipId: 1, status: 1, isHistorical: 1 });
scholarshipCycleSchema.index({ scholarshipId: 1, deadlineAt: 1 });
scholarshipCycleSchema.index({ cycleStatus: 1, status: 1 });

export const ScholarshipCycle = mongoose.model('ScholarshipCycle', scholarshipCycleSchema);
