/**
 * SkillVerificationHistory — immutable, append-only transition log.
 *
 * Every status change of a UserSkillClaim writes exactly one record here,
 * whoever caused it: the applicant attaching evidence, a reviewer approving,
 * a SuperAdmin revoking, or policy expiring a grant. Records are never updated
 * and never deleted, so "who made this verified, on what basis, and when" is
 * always answerable — including for claims that have since been revoked.
 *
 * The update guards below mirror VerificationTransition: any attempt to mutate
 * history throws rather than silently rewriting the audit trail.
 */
import mongoose from 'mongoose';
import {
  SKILL_CLAIM_STATUSES,
  VERIFICATION_METHODS,
  TRANSITION_ACTORS,
  SKILL_CLAIM_LIMITS,
} from '../../../../shared/career/skillVerification.js';

const skillVerificationHistorySchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserSkillClaim',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    fromStatus: { type: String, enum: Object.values(SKILL_CLAIM_STATUSES), required: true },
    toStatus: { type: String, enum: Object.values(SKILL_CLAIM_STATUSES), required: true },

    // --- Actor: server-derived, never from a request body ---
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, trim: true, default: '' },
    actorRealm: { type: String, trim: true, default: '' },
    actorClass: {
      type: String,
      enum: Object.values(TRANSITION_ACTORS),
      required: true,
    },

    method: { type: String, enum: [...Object.values(VERIFICATION_METHODS), null], default: null },
    reason: { type: String, trim: true, default: '', maxlength: SKILL_CLAIM_LIMITS.MAX_REASON_LENGTH },
    /** Applicant-safe instructions; deliberately independent from internal reason. */
    applicantVisibleRequest: {
      type: String,
      trim: true,
      default: '',
      required() {
        return this.toStatus === SKILL_CLAIM_STATUSES.NEEDS_INFORMATION;
      },
      maxlength: SKILL_CLAIM_LIMITS.MAX_APPLICANT_VISIBLE_REQUEST_LENGTH,
    },
    evidenceRefs: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SkillEvidence' }],
      default: [],
    },
    verificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillVerification',
      default: null,
    },

    correlationId: { type: String, trim: true, default: '' },
    occurredAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: false }
);

// Append-only: mutation of recorded history is a bug, not a feature.
const refuseUpdate = function () {
  throw new Error('SkillVerificationHistory records are immutable');
};
skillVerificationHistorySchema.pre('findOneAndUpdate', refuseUpdate);
skillVerificationHistorySchema.pre('updateOne', refuseUpdate);
skillVerificationHistorySchema.pre('updateMany', refuseUpdate);
skillVerificationHistorySchema.pre('findOneAndReplace', refuseUpdate);
skillVerificationHistorySchema.pre('replaceOne', refuseUpdate);

const refuseDelete = function () {
  throw new Error('SkillVerificationHistory records cannot be deleted');
};
skillVerificationHistorySchema.pre('deleteOne', refuseDelete);
skillVerificationHistorySchema.pre('deleteMany', refuseDelete);
skillVerificationHistorySchema.pre('findOneAndDelete', refuseDelete);

skillVerificationHistorySchema.index({ claimId: 1, occurredAt: -1 });
skillVerificationHistorySchema.index({ userId: 1, occurredAt: -1 });
skillVerificationHistorySchema.index({ actorId: 1, occurredAt: -1 });

export const SkillVerificationHistory = mongoose.model(
  'SkillVerificationHistory',
  skillVerificationHistorySchema
);
