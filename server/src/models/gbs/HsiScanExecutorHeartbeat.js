import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    leaseOwner: { type: String, required: true },
    lastBeatAt: { type: Date, required: true },
  },
  {
    timestamps: false,
    collection: 'hsi_scan_executor_heartbeats',
    autoIndex: false,
  }
);

export const HsiScanExecutorHeartbeat = mongoose.model('HsiScanExecutorHeartbeat', schema);
