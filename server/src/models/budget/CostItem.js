/**
 * CostItem — individual cost item within a StudentCostPlan (Mission 20).
 *
 * CORE PRINCIPLE:
 *   - amountState === 'unknown' means the amount is genuinely unknown.
 *   - Unknown ≠ zero. Never store or return 0 for unknown costs.
 *   - truthCategory distinguishes verified / official / student-entered / estimate / derived / unknown.
 *   - Student-entered amount cannot masquerade as verified.
 */
import mongoose from 'mongoose';
import {
  COST_CATEGORIES,
  COST_CADENCES,
  TRUTH_CATEGORIES,
  AMOUNT_STATES,
  COST_FRESHNESS,
  TUITION_BASES,
} from '../../../../shared/budget/costPlanner.js';

// ── Money subdoc (Mission 1 contract) ─────────────────────────────────────────

const moneySchema = new mongoose.Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      validate: { validator: Number.isSafeInteger, message: 'amountMinor must be a safe integer' },
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      minlength: 3,
      maxlength: 3,
    },
  },
  { _id: false }
);

// ── Source provenance subdoc ──────────────────────────────────────────────────

const provenanceSchema = new mongoose.Schema(
  {
    // e.g. 'canonical', 'institution_official', 'government_or_provider', etc.
    sourceType: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    publisher: { type: String, trim: true, default: '' },
    lastVerifiedAt: { type: Date, default: null },
    evidenceRef: { type: String, trim: true, default: '' },
    // Version/snapshot token from authoritative source (for refresh tracking)
    sourceVersion: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ── Derive trace (for DERIVED truthCategory items) ────────────────────────────

const deriveTraceSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    // References to source item IDs used in derivation
    sourceItemIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { _id: false }
);

// ── Scholarship reduction record ──────────────────────────────────────────────

const scholarshipReductionSchema = new mongoose.Schema(
  {
    scholarshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalScholarship', default: null },
    reductionAmountMinor: { type: Number, default: null },
    reductionCurrency: { type: String, trim: true, uppercase: true, default: '' },
    fundingScenario: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false }
);

// ── Main CostItem schema ──────────────────────────────────────────────────────

const costItemSchema = new mongoose.Schema(
  {
    // Foreign key — validated by service layer
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentCostPlan',
      required: true,
      index: true,
    },

    // Denormalized for ownership guard — always set from plan's ownerUserId
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: Object.values(COST_CATEGORIES),
      required: true,
    },

    label: { type: String, trim: true, required: true, maxlength: 300 },

    // AMOUNT STATE — drives display logic.
    // 'unknown': no amount. 'estimated': amount present but not authoritative. 'known': authoritative.
    amountState: {
      type: String,
      enum: Object.values(AMOUNT_STATES),
      required: true,
    },

    // Money — present only when amountState is known or estimated.
    // null when amountState === 'unknown'.
    money: { type: moneySchema, default: null },

    // Tuition-specific metadata
    tuitionBasis: {
      type: String,
      enum: Object.values(TUITION_BASES),
      default: null,
    },

    cadence: {
      type: String,
      enum: Object.values(COST_CADENCES),
      default: COST_CADENCES.ONE_TIME,
    },

    // Multiplier (e.g. number of semesters, nights, etc.) — null if not applicable
    quantity: { type: Number, default: null },

    // ── Truth / source ────────────────────────────────────────────────────────

    truthCategory: {
      type: String,
      enum: Object.values(TRUTH_CATEGORIES),
      required: true,
    },

    // Source provenance (for canonical/official items)
    provenance: { type: provenanceSchema, default: null },

    freshness: {
      type: String,
      enum: Object.values(COST_FRESHNESS),
      default: COST_FRESHNESS.UNKNOWN,
    },

    // For DERIVED items: trace of derivation
    deriveTrace: { type: deriveTraceSchema, default: null },

    // Scholarship reductions applied in a scenario
    scholarshipReduction: { type: scholarshipReductionSchema, default: null },

    // ── Student flags ─────────────────────────────────────────────────────────

    studentEditable: { type: Boolean, default: false },
    required: { type: Boolean, default: true },

    // Effective date (e.g. when this cost applies)
    effectiveDate: { type: Date, default: null },

    notes: { type: String, trim: true, maxlength: 2000, default: '' },

    // Soft-delete for item removal traceability
    removedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'cost_items' }
);

costItemSchema.index({ planId: 1, category: 1 });
costItemSchema.index({ planId: 1, amountState: 1 });

// Guard: money must be null when amountState is unknown
costItemSchema.pre('validate', function () {
  if (this.amountState === AMOUNT_STATES.UNKNOWN && this.money != null) {
    throw new Error('CostItem: money must be null when amountState is unknown');
  }
  if (this.amountState !== AMOUNT_STATES.UNKNOWN && !this.money) {
    throw new Error('CostItem: money is required when amountState is known or estimated');
  }
});

export const CostItem =
  mongoose.models.CostItem ||
  mongoose.model('CostItem', costItemSchema);
