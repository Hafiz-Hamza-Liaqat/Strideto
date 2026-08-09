/**
 * InstitutionChangeEvent — version history for high-impact factual changes (Mission 18).
 *
 * Immutable log. Never deleted. Public current projection shows latest authoritative
 * version; historical audit remains available internally.
 *
 * Examples: tuition, deadline, test requirement, program status, scholarship criteria,
 * institution identity, accreditation, intake, requirement.
 */
import mongoose from 'mongoose';
import { CHANGE_CATEGORIES } from '../../../../shared/institution/institutionPortal.js';

const institutionChangeEventSchema = new mongoose.Schema(
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

    changeCategory: {
      type: String,
      enum: Object.values(CHANGE_CATEGORIES),
      required: true,
      index: true,
    },

    // Which field changed
    field: { type: String, trim: true, required: true },

    // Previous and new values (serializable)
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },

    // Actor who made the change
    changedByAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      default: null,
    },
    changedByRole: { type: String, trim: true, default: '' },
    changedByRealm: { type: String, trim: true, default: 'institution' },

    // Source evidence for this change
    sourceType: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    reconfirmationNote: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    // Immutable — no updates should ever be applied to this collection
  }
);

institutionChangeEventSchema.index({ organizationId: 1, changeCategory: 1, createdAt: -1 });
institutionChangeEventSchema.index({ programId: 1, changeCategory: 1, createdAt: -1 });
institutionChangeEventSchema.index({ createdAt: -1 });

export const InstitutionChangeEvent =
  mongoose.models.InstitutionChangeEvent ||
  mongoose.model('InstitutionChangeEvent', institutionChangeEventSchema);
