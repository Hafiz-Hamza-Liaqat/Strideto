/**
 * UserAction — Mission 9 task/action model.
 *
 * User-owned. Server derives userId from auth; callers cannot supply arbitrary userId.
 * System-generated actions (source: 'system') vs user-created (source: 'user').
 */
import mongoose from 'mongoose';
import { ACTION_TYPES, ACTION_STATUSES, PRIORITY_LEVELS } from '../../../../shared/action/actionEngine.js';

const userActionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    actionType: { type: String, enum: Object.values(ACTION_TYPES), required: true },
    status: { type: String, enum: Object.values(ACTION_STATUSES), default: ACTION_STATUSES.TODO, index: true },
    priority: { type: String, enum: Object.values(PRIORITY_LEVELS), default: PRIORITY_LEVELS.MEDIUM },
    dueAt: { type: Date, default: null },
    // IANA timezone identifier when dueAt has timezone context
    timezone: { type: String, trim: true, default: '' },
    relatedEntityType: { type: String, trim: true, default: '' },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // 'system' = auto-generated; 'user' = user-created
    source: { type: String, enum: ['system', 'user'], default: 'user' },
    completedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userActionSchema.index({ userId: 1, status: 1, dueAt: 1 });
userActionSchema.index({ userId: 1, actionType: 1, status: 1 });

export const UserAction = mongoose.model('UserAction', userActionSchema);
