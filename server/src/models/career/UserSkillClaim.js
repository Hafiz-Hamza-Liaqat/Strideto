/**
 * UserSkillClaim — an applicant's assertion that they have a skill.
 *
 * A claim is NOT a verification. It starts life as `claimed` (self-reported,
 * unchecked) and only ever reaches `verified` through
 * SkillVerificationService, which requires an authorized reviewer, a method,
 * an evidence reference and a reason.
 *
 * The trust-bearing fields below (`status`, `proficiencyScore`, `verifiedBy`,
 * `verifiedAt`, `verificationMethod`, `expiresAt`, `revokedAt`) are written
 * ONLY by that service. No controller binds request-body values to them — see
 * `extractApplicantInput` in shared/career/skillVerification.js, which rejects
 * any payload that so much as mentions them.
 */
import mongoose from 'mongoose';
import {
  SKILL_CLAIM_STATUSES,
  VERIFICATION_METHODS,
  SKILL_CLAIM_LIMITS,
} from '../../../../shared/career/skillVerification.js';
import { SKILL_LEVELS, SKILL_CATEGORIES } from '../../../../shared/career/constants.js';

const userSkillClaimSchema = new mongoose.Schema(
  {
    // Ownership — server-derived from the authenticated session, never from a body
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // --- Applicant-supplied (safe) ---
    skillName: {
      type: String,
      required: true,
      trim: true,
      maxlength: SKILL_CLAIM_LIMITS.MAX_SKILL_NAME_LENGTH,
    },
    /** Case/whitespace-folded name used for dedupe and lookup. */
    normalizedSkillName: { type: String, required: true, trim: true, index: true },
    skillCategory: { type: String, enum: SKILL_CATEGORIES, default: 'technical' },
    claimedLevel: { type: String, enum: SKILL_LEVELS, default: 'intermediate' },
    yearsOfExperience: { type: Number, min: 0, max: 70, default: null },

    // --- Trust-bearing: service-written only ---
    status: {
      type: String,
      enum: Object.values(SKILL_CLAIM_STATUSES),
      default: SKILL_CLAIM_STATUSES.CLAIMED,
      index: true,
    },
    statusChangedAt: { type: Date, default: Date.now },

    /**
     * Result of an actual scoring assessment, or null.
     *
     * Null is the normal case and means "nobody measured this" — not zero.
     * There is deliberately no score derived from evidence counts or method
     * weighting: a number computed from how many portfolio links someone
     * attached looks like a proficiency measure while measuring nothing.
     */
    proficiencyScore: { type: Number, min: 0, max: 100, default: null },
    verificationMethod: { type: String, enum: [...Object.values(VERIFICATION_METHODS), null], default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedByRole: { type: String, trim: true, default: '' },
    verifiedAt: { type: Date, default: null },

    /** Verification lifetime. Past `expiresAt` the claim is no longer current. */
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /** Pointer to the SkillVerification that produced the current state. */
    currentVerificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillVerification',
      default: null,
    },

    /** Denormalized counter kept in step with SkillEvidence writes. */
    evidenceCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

// One claim per skill per user — the dedupe guard for repeat submissions
userSkillClaimSchema.index({ userId: 1, normalizedSkillName: 1 }, { unique: true });
// Employer/candidate filtering by server-derived trust state
userSkillClaimSchema.index({ normalizedSkillName: 1, status: 1 });
userSkillClaimSchema.index({ userId: 1, status: 1 });
userSkillClaimSchema.index({ expiresAt: 1 });

export const UserSkillClaim = mongoose.model('UserSkillClaim', userSkillClaimSchema);
