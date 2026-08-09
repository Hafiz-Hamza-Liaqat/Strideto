/**
 * EducationApplication — Mission 9.
 *
 * Self-managed education/scholarship application tracker.
 * Explicitly named to avoid any collision with the existing employer
 * Application model (server/src/models/Application.js — for job applications).
 *
 * Mission 9 implements SELF_MANAGED mode only.
 * Status changes append history; history is never overwritten.
 *
 * TRUTHFULNESS: Strideto tracks user-reported status. We never claim to have
 * submitted an application on behalf of the user unless a future authorized
 * direct integration actually does so.
 *
 * User-owned; server derives userId from auth.
 */
import mongoose from 'mongoose';
import {
  EDUCATION_APPLICATION_STATUSES,
  EDUCATION_APPLICATION_TARGET_TYPES,
  EDUCATION_APPLICATION_MODES,
} from '../../../../shared/action/actionEngine.js';

const applicationHistoryEntrySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    changedAt: { type: Date, default: () => new Date() },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false }
);

const educationApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    targetType: {
      type: String,
      enum: Object.values(EDUCATION_APPLICATION_TARGET_TYPES),
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetTitle: { type: String, trim: true, maxlength: 500, default: '' },
    targetInstitution: { type: String, trim: true, maxlength: 300, default: '' },
    targetCountry: { type: String, trim: true, uppercase: true, default: '' }, // ISO 3166-1 alpha-2

    status: {
      type: String,
      enum: Object.values(EDUCATION_APPLICATION_STATUSES),
      default: EDUCATION_APPLICATION_STATUSES.INTERESTED,
      index: true,
    },

    // Mission 9: self_managed only. Future modes reserved.
    mode: {
      type: String,
      enum: Object.values(EDUCATION_APPLICATION_MODES),
      default: EDUCATION_APPLICATION_MODES.SELF_MANAGED,
    },

    startedAt: { type: Date, default: () => new Date() },
    // Set by user when they report submitting. Strideto does not set this automatically.
    submittedAt: { type: Date, default: null },
    // Set by user when recording an outcome.
    outcomeAt: { type: Date, default: null },

    notes: { type: String, trim: true, maxlength: 5000, default: '' },

    // Deadline association (references UserDeadline records)
    deadlineIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserDeadline' }],

    // Checklist association (references UserChecklist record)
    checklistId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserChecklist', default: null },

    // Immutable history: status transitions are appended, never rewritten
    history: { type: [applicationHistoryEntrySchema], default: [] },
  },
  { timestamps: true }
);

educationApplicationSchema.index({ userId: 1, status: 1 });
educationApplicationSchema.index({ userId: 1, targetType: 1, targetId: 1 });

export const EducationApplication = mongoose.model('EducationApplication', educationApplicationSchema);
