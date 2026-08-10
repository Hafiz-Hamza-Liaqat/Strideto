/**
 * SkillVerification — the provenance record for one verification decision.
 *
 * Every decision that grants, withholds or withdraws trust creates one of
 * these. Existence of this record is what makes a claim's `verified` status
 * legitimate: the claim merely caches the outcome, this row carries the
 * evidence.
 *
 * Required on every record, without exception:
 *   - `method`      how the reviewer established the outcome
 *   - `reason`      why (free text, bounded, no markup)
 *   - `actorId`     server-derived from the authenticated session
 *   - `actorRole`   the role that authorized it
 *   - `decidedAt`   when
 * and for a trust-granting outcome, at least one `evidenceRefs` entry.
 *
 * Records are append-only: a later decision supersedes an earlier one, it does
 * not edit it.
 */
import mongoose from 'mongoose';
import {
  VERIFICATION_METHODS,
  SKILL_CLAIM_STATUSES,
  SKILL_CLAIM_LIMITS,
} from '../../../../shared/career/skillVerification.js';

const skillVerificationSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserSkillClaim',
      required: true,
      index: true,
    },
    /** Subject of the verification — the applicant, never the actor. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /** The claim status this decision produced. */
    outcome: {
      type: String,
      enum: Object.values(SKILL_CLAIM_STATUSES),
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: Object.values(VERIFICATION_METHODS),
      required: true,
    },

    /** Evidence this decision actually rested on. */
    evidenceRefs: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SkillEvidence' }],
      default: [],
      validate: {
        validator: (v) => v.length <= SKILL_CLAIM_LIMITS.MAX_EVIDENCE_REFS_PER_VERIFICATION,
        message: 'Too many evidence references',
      },
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: SKILL_CLAIM_LIMITS.MAX_REASON_LENGTH,
    },

    /**
     * Plain-text instructions intentionally shared with the applicant when the
     * outcome is `needs_information`. This is never inferred from `reason`.
     */
    applicantVisibleRequest: {
      type: String,
      trim: true,
      default: '',
      required() {
        return this.outcome === SKILL_CLAIM_STATUSES.NEEDS_INFORMATION;
      },
      maxlength: SKILL_CLAIM_LIMITS.MAX_APPLICANT_VISIBLE_REQUEST_LENGTH,
    },

    // --- Actor: always derived from the authenticated session ---
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, trim: true, required: true },
    actorRealm: { type: String, trim: true, default: 'admin' },

    /**
     * Proficiency measured by this decision, or null when nothing measured it.
     * Only methods whose policy sets `supportsProficiency` may record one.
     */
    proficiencyScore: { type: Number, min: 0, max: 100, default: null },

    /**
     * The rubric a structured assessment was scored against. Required by
     * policy for assessment methods — an assessment with no rubric on record
     * is an opinion, and must not read as a measurement.
     */
    rubricId: { type: String, trim: true, default: '' },
    rubricVersion: { type: String, trim: true, default: '' },

    /**
     * The issuer or referee actually contacted. Required by policy for the
     * methods whose whole claim to authority is that someone outside the
     * applicant confirmed it.
     */
    corroborationRef: { type: String, trim: true, default: '', maxlength: 200 },

    decidedAt: { type: Date, default: Date.now, immutable: true },
    /** Null means "no expiry"; a date makes the grant time-boxed. */
    expiresAt: { type: Date, default: null },

    /** Set when a later action withdraws this specific grant. */
    supersededAt: { type: Date, default: null },

    correlationId: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

skillVerificationSchema.index({ claimId: 1, decidedAt: -1 });
skillVerificationSchema.index({ userId: 1, outcome: 1 });
skillVerificationSchema.index({ actorId: 1, decidedAt: -1 });

export const SkillVerification = mongoose.model('SkillVerification', skillVerificationSchema);
