/**
 * VerificationEvidence — individual evidence records for an organization.
 *
 * Immutable once submitted by the organization. Admin may update `status`,
 * `reviewedBy`, `reviewedAt`, `rejectionReason`. Document contents are NEVER
 * stored in this record's metadata — only references (evidenceRef).
 *
 * Privacy rules:
 *   - Only the owning organization and Admin/Moderator staff may access.
 *   - No cross-organization access via id lookup.
 *   - Document payloads are never included in audit metadata.
 */
import mongoose from 'mongoose';
import {
  EVIDENCE_TYPES,
  EVIDENCE_STATUSES,
} from '../../../shared/international/verification.js';

const evidenceSchema = new mongoose.Schema(
  {
    // Ownership — both fields required for tenant-isolation queries
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    // Evidence classification
    evidenceType: {
      type: String,
      enum: Object.values(EVIDENCE_TYPES),
      required: true,
      index: true,
    },

    // Lifecycle
    status: {
      type: String,
      enum: Object.values(EVIDENCE_STATUSES),
      default: EVIDENCE_STATUSES.PENDING,
      index: true,
    },

    // Source reference: a URL and/or an opaque storage reference (never raw content)
    sourceUrl: { type: String, trim: true, default: '' },
    evidenceRef: { type: String, trim: true, default: '' },

    // Safe, non-sensitive metadata (e.g. document type label, page count)
    safeMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Submission timestamps
    submittedAt: { type: Date, default: Date.now },

    // Review
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true, default: '' },

    // Expiry (for licenses, accreditations)
    expiresAt: { type: Date },

    // Audit correlation (request/trace id — no sensitive payload)
    correlationId: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

evidenceSchema.index({ organizationId: 1, evidenceType: 1 });
evidenceSchema.index({ organizationId: 1, status: 1 });
evidenceSchema.index({ expiresAt: 1 });

export const VerificationEvidence = mongoose.model(
  'VerificationEvidence',
  evidenceSchema
);
