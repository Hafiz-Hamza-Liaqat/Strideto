import mongoose from 'mongoose';
import { WORKFLOW_STATES } from '../../../shared/workflow/states.js';
import { WORKFLOW_RESOURCES } from '../../../shared/workflow/resources.js';
import { DEFAULT_LOCALE } from '../../../shared/localization/localeConfig.js';

const editorialWorkflowSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, enum: WORKFLOW_RESOURCES, index: true },
    entityId: { type: String, required: true, index: true },
    locale: { type: String, default: DEFAULT_LOCALE, index: true },
    status: { type: String, enum: WORKFLOW_STATES, default: 'draft', index: true },
    title: { type: String, default: '' },
    assignedReviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedReviewerEmail: { type: String, default: '' },
    reviewRound: { type: Number, default: 0 },
    scheduledPublishAt: { type: Date, index: true },
    scheduledArchiveAt: { type: Date, index: true },
    timezone: { type: String, default: 'UTC' },
    rejectionReason: { type: String, default: '' },
    lastActionAt: { type: Date },
    lastActionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastActionByEmail: { type: String, default: '' },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    publishedAt: { type: Date },
    archivedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

editorialWorkflowSchema.index({ entityType: 1, entityId: 1, locale: 1 }, { unique: true });
editorialWorkflowSchema.index({ status: 1, assignedReviewerId: 1 });
editorialWorkflowSchema.index({ status: 1, scheduledPublishAt: 1 });

export const EditorialWorkflow = mongoose.model('EditorialWorkflow', editorialWorkflowSchema);
