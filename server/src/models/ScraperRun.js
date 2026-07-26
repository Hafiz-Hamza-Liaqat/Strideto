import mongoose from 'mongoose';

const scraperRunSchema = new mongoose.Schema(
  {
    runAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['running', 'success', 'partial', 'failed'], default: 'running' },
    jobsAdded: { type: Number, default: 0 },
    admissionsAdded: { type: Number, default: 0 },
    jobsSkipped: { type: Number, default: 0 },
    admissionsSkipped: { type: Number, default: 0 },
    sources: [{ type: String }],
    /** Renamed from reserved path `errors` (Mongoose reserved key). */
    errorDetails: [{ type: String }],
    durationMs: { type: Number },
  },
  { timestamps: true }
);

scraperRunSchema.index({ runAt: -1 });

/** Prefer errorDetails; fall back to legacy persisted `errors` for older documents. */
export function resolveScraperErrorDetails(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.errorDetails) && doc.errorDetails.length) return doc.errorDetails;
  if (Array.isArray(doc.errors)) return doc.errors;
  return Array.isArray(doc.errorDetails) ? doc.errorDetails : [];
}

export const ScraperRun = mongoose.model('ScraperRun', scraperRunSchema);
