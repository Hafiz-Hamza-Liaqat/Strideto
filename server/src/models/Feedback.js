import mongoose from 'mongoose';

const FEEDBACK_TYPES = ['bug', 'feature', 'general'];

const feedbackSchema = new mongoose.Schema(
  {
    type: { type: String, enum: FEEDBACK_TYPES, required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    rating: { type: Number, min: 1, max: 5 },
    name: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    pageUrl: { type: String, trim: true, maxlength: 500 },
    userAgent: { type: String, maxlength: 500 },
    ipHash: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer' },
    /** Optional data-URL screenshot (png/jpeg/webp), size-capped at ingest */
    screenshotDataUrl: { type: String, maxlength: 450000 },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'closed'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1, createdAt: -1 });

export const Feedback = mongoose.model('Feedback', feedbackSchema);
export { FEEDBACK_TYPES };
