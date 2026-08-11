/**
 * Independent, purpose-scoped consent records (Phase 8).
 * Revoking one purpose never cascades to another.
 */
import mongoose from 'mongoose';
import { CONSENT_PURPOSES } from '../../../../shared/platform/consentContract.js';

const consentGrantSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    counterpartyId: { type: String, required: true, trim: true, maxlength: 80 },
    counterpartyType: { type: String, required: true, trim: true, maxlength: 40 },
    purpose: { type: String, required: true, enum: Object.values(CONSENT_PURPOSES), index: true },
    resourceScope: { type: String, required: true, trim: true, maxlength: 200 },
    grantedAt: { type: Date, required: true },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null, index: true },
    provenance: { type: String, required: true, trim: true, maxlength: 80 },
    auditIdentity: { type: String, required: true, trim: true, maxlength: 120 },
  },
  {
    timestamps: true,
    collection: 'consent_grants',
  }
);

consentGrantSchema.index(
  { subjectId: 1, purpose: 1, resourceScope: 1, counterpartyId: 1, revokedAt: 1 }
);

export const ConsentGrant =
  mongoose.models.ConsentGrant || mongoose.model('ConsentGrant', consentGrantSchema);
