import mongoose from 'mongoose';

const newsletterLogSchema = new mongoose.Schema(
  {
    sentAt: { type: Date, default: Date.now },
    subscriberCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    subject: { type: String },
    summary: { type: String },
    status: { type: String, enum: ['sent', 'failed', 'partial'], default: 'sent' },
    /** Renamed from reserved path `errors` (Mongoose reserved key). */
    errorDetails: [{ type: String }],
  },
  { timestamps: true }
);

newsletterLogSchema.index({ sentAt: -1 });

/** Prefer errorDetails; fall back to legacy persisted `errors` for older documents. */
export function resolveNewsletterErrorDetails(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.errorDetails) && doc.errorDetails.length) return doc.errorDetails;
  if (Array.isArray(doc.errors)) return doc.errors;
  return Array.isArray(doc.errorDetails) ? doc.errorDetails : [];
}

export const NewsletterLog = mongoose.model('NewsletterLog', newsletterLogSchema);
