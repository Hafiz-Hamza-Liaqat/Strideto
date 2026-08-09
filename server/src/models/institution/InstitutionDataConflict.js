/**
 * InstitutionDataConflict — conflict detection record (Mission 18).
 *
 * Created when an institution submission conflicts with existing high-authority
 * or source-backed canonical data. Never silently overwritten.
 * Admin/data review required for resolution.
 * No AI conflict resolution in Mission 18.
 */
import mongoose from 'mongoose';
import { CONFLICT_STATES } from '../../../../shared/institution/institutionPortal.js';

const institutionDataConflictSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    canonicalInstitutionId: {
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

    // What kind of record the conflict is on
    recordType: { type: String, trim: true, required: true },
    // Which field/scope within the record
    fieldScope: { type: String, trim: true, required: true },

    // Existing high-authority value and its source
    existingValue: { type: mongoose.Schema.Types.Mixed, default: null },
    existingSourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalSource',
      default: null,
    },
    existingSourceType: { type: String, trim: true, default: '' },

    // Institution-proposed value and its stated source
    proposedValue: { type: mongoose.Schema.Types.Mixed, default: null },
    proposedSourceType: { type: String, trim: true, default: '' },
    proposedSourceUrl: { type: String, trim: true, default: '' },

    state: {
      type: String,
      enum: Object.values(CONFLICT_STATES),
      default: CONFLICT_STATES.OPEN,
      index: true,
    },

    resolution: { type: String, trim: true, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

institutionDataConflictSchema.index({ organizationId: 1, state: 1 });
institutionDataConflictSchema.index({ state: 1, createdAt: -1 });

export const InstitutionDataConflict =
  mongoose.models.InstitutionDataConflict ||
  mongoose.model('InstitutionDataConflict', institutionDataConflictSchema);
