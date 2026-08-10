/**
 * SkillEvidence — one applicant-supplied reference backing a skill claim.
 *
 * Stores a *reference* and safe metadata only. The URL is validated
 * structurally (https, public host, no credentials, no markup) and then left
 * alone: it is never fetched, resolved, previewed, or scraped. Nothing here
 * asserts the link is genuine — that judgement belongs to a reviewer, and is
 * recorded on SkillVerification, not here.
 *
 * `status` and the review fields are service-written only; an applicant can
 * set evidenceType, url and description and nothing else.
 */
import mongoose from 'mongoose';
import {
  SKILL_EVIDENCE_TYPES,
  EVIDENCE_PROVIDERS,
  SKILL_CLAIM_LIMITS,
} from '../../../../shared/career/skillVerification.js';

/** Review outcome for an individual evidence item. */
export const SKILL_EVIDENCE_STATUSES = Object.freeze({
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  SUPERSEDED: 'superseded',
});

const skillEvidenceSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserSkillClaim',
      required: true,
      index: true,
    },
    /**
     * Denormalized owner. Every read path filters on BOTH claimId and userId so
     * a guessed claim id from another account cannot return rows.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // --- Applicant-supplied (validated) ---
    evidenceType: {
      type: String,
      enum: Object.values(SKILL_EVIDENCE_TYPES),
      required: true,
    },
    url: { type: String, required: true, trim: true, maxlength: SKILL_CLAIM_LIMITS.MAX_URL_LENGTH },
    description: { type: String, trim: true, default: '', maxlength: SKILL_CLAIM_LIMITS.MAX_DESCRIPTION_LENGTH },

    // --- Server-derived at write time ---
    /** Normalized host, stored so reviewers/UI need not re-parse the URL. */
    hostname: { type: String, trim: true, default: '', index: true },
    /** Descriptive platform label. Confers no trust whatsoever. */
    provider: {
      type: String,
      enum: Object.values(EVIDENCE_PROVIDERS),
      default: EVIDENCE_PROVIDERS.GENERIC,
    },

    // --- Review: service-written only ---
    status: {
      type: String,
      enum: Object.values(SKILL_EVIDENCE_STATUSES),
      default: SKILL_EVIDENCE_STATUSES.SUBMITTED,
      index: true,
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

skillEvidenceSchema.index({ claimId: 1, status: 1 });
skillEvidenceSchema.index({ userId: 1, claimId: 1 });

export const SkillEvidence = mongoose.model('SkillEvidence', skillEvidenceSchema);
