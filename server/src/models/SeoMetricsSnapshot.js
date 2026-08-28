import mongoose from 'mongoose';

const seoMetricsSnapshotSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    dataset: { type: String, required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    capturedAt: { type: Date, default: Date.now, index: true },
    sourceType: {
      type: String,
      enum: ['api', 'manual_import', 'cache'],
      default: 'cache',
    },
    schemaVersion: { type: Number, default: 1 },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    dimensions: { type: mongoose.Schema.Types.Mixed, default: {} },
    metricStates: { type: mongoose.Schema.Types.Mixed, default: {} },
    state: { type: String, default: 'valid_data' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

seoMetricsSnapshotSchema.index({ provider: 1, dataset: 1, capturedAt: -1 });

export const SeoMetricsSnapshot = mongoose.model('SeoMetricsSnapshot', seoMetricsSnapshotSchema);
