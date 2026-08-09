/**
 * DataCorrection — user correction/report workflow (Mission 5).
 *
 * Authenticated users may submit factual correction reports. These never
 * directly mutate authoritative data; Admin must review and resolve.
 *
 * Organization-proposed corrections reuse this model (proposedByOrgId set).
 * Org proposals are NOT automatically authoritative; same Admin review applies.
 *
 * Duplicate guard: a user cannot submit more than one open (submitted /
 * under_review) correction for the same entity+correctionType combination.
 * Enforced at the service/controller layer via the compound index.
 */
import mongoose from 'mongoose';
import {
  CORRECTION_TYPES,
  CORRECTION_STATUSES,
} from '../../../../shared/trust/sourceVerification.js';

const dataCorrectionSchema = new mongoose.Schema(
  {
    // ── Submitter ─────────────────────────────────────────────────────────────
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Target entity ─────────────────────────────────────────────────────────
    targetEntityType: { type: String, required: true, trim: true },
    targetEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // ── Correction details ────────────────────────────────────────────────────
    correctionType: {
      type: String,
      enum: Object.values(CORRECTION_TYPES),
      required: true,
    },
    // Bounded user-supplied description (max enforced at controller layer: 2000 chars)
    description: { type: String, trim: true, required: true },

    // Optional: related source that the user believes is broken/changed
    relatedSourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalSource',
    },

    // ── Workflow status ───────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(CORRECTION_STATUSES),
      default: CORRECTION_STATUSES.SUBMITTED,
      index: true,
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    // Internal resolution note — never exposed to submitter or public
    resolutionNote: { type: String, trim: true, default: '' },

    // Optional: if this correction is a duplicate of another
    duplicateOfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DataCorrection',
    },

    // ── Org proposal context ─────────────────────────────────────────────────
    // Set when submitted by a verified organization account (future Mission 18).
    // Presence does NOT grant automatic authority.
    proposedByOrgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
  },
  { timestamps: true }
);

// Compound index: duplicate-guard query — find open corrections by same user
// for same entity+type combination
dataCorrectionSchema.index({
  submittedBy: 1,
  targetEntityId: 1,
  correctionType: 1,
  status: 1,
});

dataCorrectionSchema.index({ targetEntityType: 1, targetEntityId: 1, status: 1 });

export const DataCorrection = mongoose.model('DataCorrection', dataCorrectionSchema);
