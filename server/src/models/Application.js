import mongoose from 'mongoose';
import { SKILL_CLAIM_STATUSES } from '../../../shared/career/skillVerification.js';

/**
 * Frozen copy of one skill's trust state at the moment of application.
 *
 * Historical evidence, not a live view: if the applicant later edits their
 * profile — or a verification is revoked, or expires — what the employer
 * decided on stays intact and attributable to the time it was captured.
 *
 * Built server-side by `buildApplicationSkillSnapshot` from stored claim
 * records. No request body reaches these fields.
 */
const applicationSkillSnapshotEntrySchema = new mongoose.Schema(
  {
    skillName: { type: String, trim: true, default: '' },
    skillCategory: { type: String, trim: true, default: 'other' },
    claimedLevel: { type: String, trim: true, default: '' },
    trustState: {
      type: String,
      enum: Object.values(SKILL_CLAIM_STATUSES),
      default: SKILL_CLAIM_STATUSES.CLAIMED,
    },
    isCurrentlyVerified: { type: Boolean, default: false },
    verificationScore: { type: Number, min: 0, max: 100, default: 0 },
    evidenceCount: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    resumeURL: { type: String },
    talentProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'TalentProfile' },
    resumeVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeVersion' },
    resumeSource: {
      type: String,
      enum: ['upload', 'talent-profile', 'talent-profile-document', 'legacy', 'none'],
      default: 'none',
    },
    coverLetter: { type: String },
    status: {
      type: String,
      enum: ['submitted', 'applied', 'viewed', 'shortlisted', 'rejected', 'interview', 'hired'],
      default: 'submitted',
    },
    appliedDate: { type: Date, default: Date.now },
    note: { type: String },

    /** Server-built skill trust snapshot; see the schema comment above. */
    skillSnapshot: {
      capturedAt: { type: Date, default: null },
      skills: { type: [applicationSkillSnapshotEntrySchema], default: [] },
    },
  },
  { timestamps: true }
);

applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ jobId: 1, status: 1 });

export const Application = mongoose.model('Application', applicationSchema);
