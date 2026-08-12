import mongoose from 'mongoose';

export const ANNOUNCEMENT_AUDIENCES = ['student', 'employer', 'agent', 'institution', 'staff', 'all'];
export const ANNOUNCEMENT_TYPES = ['info', 'policy', 'maintenance', 'action_required', 'survey'];
export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'expired'];

const surveyOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: { type: String, enum: ANNOUNCEMENT_TYPES, default: 'info' },
    audiences: {
      type: [{ type: String, enum: ANNOUNCEMENT_AUDIENCES }],
      default: ['all'],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one audience is required',
      },
    },
    status: { type: String, enum: ANNOUNCEMENT_STATUSES, default: 'draft' },
    priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
    link: { type: String, trim: true },
    scheduledAt: { type: Date },
    publishedAt: { type: Date },
    expiresAt: { type: Date },
    surveyOptions: { type: [surveyOptionSchema], default: undefined },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishedAt: -1 });
announcementSchema.index({ audiences: 1, status: 1, expiresAt: 1 });

export const Announcement = mongoose.model('Announcement', announcementSchema);
