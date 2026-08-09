/**
 * SavedOpportunity — Mission 9.
 *
 * Standalone saved-item model for Programs and CanonicalScholarships.
 * Separate from existing User.savedJobs/savedScholarships arrays (which serve
 * legacy opportunity types). Deduplication enforced via compound index.
 * User-owned; server derives userId from auth.
 */
import mongoose from 'mongoose';
import { SAVED_OPPORTUNITY_TYPES } from '../../../../shared/action/actionEngine.js';

const savedOpportunitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityType: { type: String, enum: Object.values(SAVED_OPPORTUNITY_TYPES), required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Optional user-supplied metadata
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

// Deduplication: one save per user per entity
savedOpportunitySchema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });

export const SavedOpportunity = mongoose.model('SavedOpportunity', savedOpportunitySchema);
