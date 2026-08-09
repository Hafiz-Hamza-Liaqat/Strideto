/**
 * UserDeadline — Mission 9.
 *
 * Normalized user-facing deadline boundary.
 * deadlineAt is always UTC when exact time is known.
 * isDateOnly=true means the source provided a date without a time —
 * we do NOT invent timezone precision or assume midnight.
 * Unknown deadlines remain unknown (deadlineAt: null).
 *
 * User-owned; server derives userId from auth.
 */
import mongoose from 'mongoose';
import { DEADLINE_SOURCE_TYPES } from '../../../../shared/action/actionEngine.js';

const userDeadlineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    // UTC instant — null means unknown. Never invent a time when source is date-only.
    deadlineAt: { type: Date, default: null },
    // True when the source only provided a calendar date (no time component)
    isDateOnly: { type: Boolean, default: false },
    // IANA timezone identifier, stored when source specifies it
    timezone: { type: String, trim: true, default: '' },
    sourceType: { type: String, enum: Object.values(DEADLINE_SOURCE_TYPES), default: DEADLINE_SOURCE_TYPES.OTHER },
    // Reference to the source entity (ScholarshipCycle, Program, etc.)
    sourceEntityType: { type: String, trim: true, default: '' },
    sourceEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Freshness metadata from source record
    freshnessWarning: { type: String, trim: true, default: '' },
    lastSourceVerifiedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    // Only for user-created deadlines; system-derived deadlines reference source entity
    isUserCreated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userDeadlineSchema.index({ userId: 1, deadlineAt: 1 });
userDeadlineSchema.index({ userId: 1, sourceType: 1, sourceEntityId: 1 });

export const UserDeadline = mongoose.model('UserDeadline', userDeadlineSchema);
