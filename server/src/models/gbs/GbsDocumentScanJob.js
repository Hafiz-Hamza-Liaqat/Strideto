import mongoose from 'mongoose';
import { HSI_SCAN_JOB_STATUSES, HSI_SCAN_MAX_ATTEMPTS } from '../../../../shared/gbs/hsiSecurity.js';

const schema = new mongoose.Schema(
  {
    publicJobRef: { type: String, required: true },
    vaultDocumentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocumentVersion',
      required: true,
    },
    opaqueStorageRef: { type: String, required: true },
    checksumSha256: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    classification: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(HSI_SCAN_JOB_STATUSES),
      default: HSI_SCAN_JOB_STATUSES.QUEUED,
    },
    attempt: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, default: HSI_SCAN_MAX_ATTEMPTS, min: 1 },
    availableAt: { type: Date, required: true, default: () => new Date() },
    leasedAt: { type: Date, default: null },
    leaseOwner: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: null },
    verdictEngine: { type: String, default: null },
    verdictEngineVersion: { type: String, default: null },
    recordVersion: { type: Number, required: true, default: 0, min: 0 },
    schemaVersion: { type: String, required: true, default: '17d-8b2a.0' },
  },
  {
    timestamps: true,
    collection: 'gbs_document_scan_jobs',
    autoIndex: false,
  }
);

schema.index(
  { vaultDocumentVersionId: 1, checksumSha256: 1 },
  { unique: true, name: 'gbs_scan_job_version_checksum_unique' }
);
schema.index({ status: 1, availableAt: 1 }, { name: 'gbs_scan_job_status_available' });
schema.index({ leaseExpiresAt: 1 }, { name: 'gbs_scan_job_lease_expiry' });
schema.index({ createdAt: 1 }, { name: 'gbs_scan_job_created' });
schema.index({ publicJobRef: 1 }, { unique: true, name: 'gbs_scan_job_public_ref_unique' });

export const GbsDocumentScanJob = mongoose.model('GbsDocumentScanJob', schema);
