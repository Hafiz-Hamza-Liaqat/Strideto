/**
 * UserChecklist — Mission 9.
 *
 * Reusable user-owned checklists for journeys and opportunities.
 * Checklist items have stable _id ObjectIds.
 * System-generated items remain editable only by user's own completion state —
 * marking an item complete does not modify the underlying official requirement.
 */
import mongoose from 'mongoose';
import {
  CHECKLIST_TARGET_TYPES,
  CHECKLIST_ITEM_STATUSES,
  DOCUMENT_REQUIREMENT_TYPES,
} from '../../../../shared/action/actionEngine.js';

const checklistItemSchema = new mongoose.Schema(
  {
    // _id: true (default) — stable ObjectId per item for safe client CRUD
    label: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: Object.values(CHECKLIST_ITEM_STATUSES), default: CHECKLIST_ITEM_STATUSES.PENDING },
    dueAt: { type: Date, default: null },
    // Identifier pointing to an official requirement (Mission 7 ProgramRequirement etc.)
    requirementRef: { type: String, trim: true, default: '' },
    // Document type placeholder — actual storage is Mission 10
    documentRequirementType: { type: String, enum: [...Object.values(DOCUMENT_REQUIREMENT_TYPES), ''], default: '' },
    // 'system' = auto-generated from requirement data; 'user' = user-created
    source: { type: String, enum: ['system', 'user'], default: 'user' },
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  }
);

const userChecklistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    targetType: { type: String, enum: Object.values(CHECKLIST_TARGET_TYPES), default: CHECKLIST_TARGET_TYPES.GENERAL },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    items: { type: [checklistItemSchema], default: [] },
  },
  { timestamps: true }
);

userChecklistSchema.index({ userId: 1, targetType: 1, targetId: 1 });

export const UserChecklist = mongoose.model('UserChecklist', userChecklistSchema);
