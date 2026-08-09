/**
 * StudentCostPlan — Mission 20 Budget / Cost Planner.
 *
 * Ownership is always server-derived from authenticated userId.
 * No arbitrary userId accepted from client.
 *
 * Privacy:
 *   - Plans are private to the owning Student.
 *   - No Agent / Institution / Employer access.
 *   - No public projection.
 */
import mongoose from 'mongoose';
import {
  PLAN_STATUSES,
  JOURNEY_TYPES,
  FUNDING_SCENARIOS,
  PLAN_EVENT_TYPES,
} from '../../../../shared/budget/costPlanner.js';

// ── Budget snapshot (snapshot of Student stated budget at plan creation/update) ─

const budgetSnapshotSchema = new mongoose.Schema(
  {
    // Integer minor units — null if not set
    totalAmountMinor: { type: Number, default: null },
    currency: { type: String, trim: true, uppercase: true, default: '' },
    // Optional sub-allocations
    tuitionAmountMinor: { type: Number, default: null },
    livingAmountMinor: { type: Number, default: null },
    period: { type: String, trim: true, default: '' },
    snapshotAt: { type: Date, default: null },
  },
  { _id: false }
);

// ── Scholarship scenario reference ────────────────────────────────────────────

const scholarshipScenarioSchema = new mongoose.Schema(
  {
    scholarshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalScholarship', default: null },
    scholarshipTitle: { type: String, trim: true, default: '' },
    scenario: {
      type: String,
      enum: Object.values(FUNDING_SCENARIOS),
      default: FUNDING_SCENARIOS.WITHOUT_SCHOLARSHIP,
    },
    // Snapshot of funding type at plan creation
    fundingType: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ── Plan change history (lightweight audit) ───────────────────────────────────

const planEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, enum: Object.values(PLAN_EVENT_TYPES), required: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// ── Main plan schema ──────────────────────────────────────────────────────────

const studentCostPlanSchema = new mongoose.Schema(
  {
    // Server-derived from JWT. Never accepted from client.
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: { type: String, trim: true, required: true, maxlength: 200 },

    journeyType: {
      type: String,
      enum: Object.values(JOURNEY_TYPES),
      default: JOURNEY_TYPES.STUDY,
    },

    // ISO 3166-1 alpha-2 destination country — optional
    destinationCountry: { type: String, trim: true, uppercase: true, default: '' },

    // Optional program reference — validated server-side
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
    programTitle: { type: String, trim: true, default: '' },
    programInstitutionName: { type: String, trim: true, default: '' },

    // Optional scholarship scenarios — validated server-side
    scholarshipScenarios: { type: [scholarshipScenarioSchema], default: [] },

    // Target intake label (e.g. "Fall 2025", "January 2026")
    targetIntake: { type: String, trim: true, maxlength: 100, default: '' },

    // Planning horizon in months — required for recurring cost expansion
    planningHorizonMonths: { type: Number, default: null },

    // Display currency preference (ISO 4217) — does NOT imply conversion
    displayCurrency: { type: String, trim: true, uppercase: true, default: '' },

    // Student budget snapshot at plan creation/last update
    budgetSnapshot: { type: budgetSnapshotSchema, default: () => ({}) },

    // Status
    status: {
      type: String,
      enum: Object.values(PLAN_STATUSES),
      default: PLAN_STATUSES.DRAFT,
      index: true,
    },

    // Human-readable assumptions
    assumptions: { type: [String], default: [] },

    // Lightweight plan history
    history: { type: [planEventSchema], default: [] },

    // Set when this plan is a clone — safe reference only
    clonedFromPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCostPlan', default: null },

    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'student_cost_plans' }
);

studentCostPlanSchema.index({ ownerUserId: 1, status: 1 });
studentCostPlanSchema.index({ ownerUserId: 1, createdAt: -1 });

export const StudentCostPlan =
  mongoose.models.StudentCostPlan ||
  mongoose.model('StudentCostPlan', studentCostPlanSchema);
