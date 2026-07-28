import mongoose from 'mongoose';
import {
  FREE_BETA_POLICY_VERSION,
  PUBLISHING_POLICY_CODES,
  PUBLICATION_SUBMISSION_KINDS,
  PUBLICATION_SUBMISSION_STATES,
  QUOTA_EXEMPTION_REASONS,
  QUOTA_OWNER_TYPES,
} from '../config/freeBetaPublishingPolicy.js';

const { ObjectId } = mongoose.Schema.Types;

function safeText(maxlength) {
  return { type: String, trim: true, maxlength };
}

function rejectUnknownSnapshotKeys(field, allowedShape) {
  function inspect(value, shape, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }

    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(shape, key)) {
        throw new TypeError(`${path}.${key} is not an allowed snapshot field`);
      }
      if (shape[key] && typeof shape[key] === 'object') {
        inspect(value[key], shape[key], `${path}.${key}`);
      }
    }
  }

  return function enforceSnapshotShape(value) {
    inspect(value, allowedShape, field);
    return value;
  };
}

const CONTENT_SNAPSHOT_SHAPE = Object.freeze({
  contentHash: true,
  title: true,
  companyName: true,
  description: true,
  requirements: true,
  responsibilities: true,
  skillsRequired: true,
  salaryRange: true,
  salaryCurrency: true,
  location: true,
  province: true,
  city: true,
  category: true,
  employmentType: true,
  jobType: true,
  educationRequirement: true,
  experience: true,
  applicationMode: true,
  applicationDomain: true,
  workMode: true,
  deadline: true,
  totalSeats: true,
});

const VERIFICATION_SNAPSHOT_SHAPE = Object.freeze({
  verified: true,
  verificationLevel: true,
  accountStatus: true,
  normalizedCompanyName: true,
  emailPresent: true,
  emailValid: true,
  emailDomain: true,
  websiteDomain: true,
  requiredProfileChecks: true,
  predicateCapabilityVersion: true,
  eligibilityResultCodes: true,
});

const ROLLING_USAGE_SHAPE = Object.freeze({
  used: true,
  limit: true,
  remaining: true,
  nextEligibleAt: true,
  nextSlotAt: true,
});

const ACTIVE_FREE_USAGE_SHAPE = Object.freeze({
  planCode: true,
  used: true,
  limit: true,
  remaining: true,
  hasCapacity: true,
});

const QUOTA_USAGE_SHAPE = Object.freeze({
  daily: ROLLING_USAGE_SHAPE,
  rolling30Days: ROLLING_USAGE_SHAPE,
  activeFreeJobs: ACTIVE_FREE_USAGE_SHAPE,
});

const QUOTA_SNAPSHOT_SHAPE = Object.freeze({
  policyCode: true,
  policyVersion: true,
  capturedAt: true,
  before: QUOTA_USAGE_SHAPE,
  after: QUOTA_USAGE_SHAPE,
});

const MODERATION_SUMMARY_SHAPE = Object.freeze({
  action: true,
  reasonCode: true,
  ownerMessage: true,
  eventId: true,
  decidedAt: true,
});

const contentSnapshotSchema = new mongoose.Schema(
  {
    contentHash: {
      type: String,
      required: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
    },
    title: safeText(300),
    companyName: safeText(300),
    description: safeText(20000),
    requirements: [safeText(2000)],
    responsibilities: [safeText(2000)],
    skillsRequired: [safeText(200)],
    salaryRange: safeText(200),
    salaryCurrency: safeText(10),
    location: safeText(300),
    province: safeText(120),
    city: safeText(120),
    category: safeText(120),
    employmentType: safeText(80),
    jobType: safeText(80),
    educationRequirement: safeText(1000),
    experience: safeText(500),
    applicationMode: {
      type: String,
      enum: ['internal', 'external'],
    },
    applicationDomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      match:
        /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    workMode: {
      type: String,
      enum: ['on_site', 'remote', 'hybrid'],
    },
    deadline: { type: Date, default: null },
    totalSeats: { type: Number, min: 1, default: null },
  },
  { _id: false, strict: 'throw' }
);

const verificationSnapshotSchema = new mongoose.Schema(
  {
    verified: { type: Boolean, required: true },
    verificationLevel: {
      type: String,
      enum: ['basic', 'verified', 'trusted'],
      required: true,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      required: true,
    },
    normalizedCompanyName: safeText(300),
    emailPresent: { type: Boolean, required: true },
    emailValid: { type: Boolean, required: true },
    emailDomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      match:
        /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    websiteDomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      match:
        /^(?!.*[@/:])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    requiredProfileChecks: {
      type: Map,
      of: Boolean,
      default: undefined,
    },
    predicateCapabilityVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    eligibilityResultCodes: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100,
          match: /^[A-Z0-9_]+$/,
        },
      ],
      required: true,
    },
  },
  { _id: false, strict: 'throw' }
);

const rollingUsageSnapshotSchema = new mongoose.Schema(
  {
    used: { type: Number, required: true, min: 0 },
    limit: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
    nextEligibleAt: { type: Date, default: null },
    nextSlotAt: { type: Date, default: null },
  },
  { _id: false, strict: 'throw' }
);

const activeFreeUsageSnapshotSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      enum: [PUBLISHING_POLICY_CODES.FREE_BETA],
      required: true,
    },
    used: { type: Number, required: true, min: 0 },
    limit: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
    hasCapacity: { type: Boolean, required: true },
  },
  { _id: false, strict: 'throw' }
);

const quotaUsageSnapshotSchema = new mongoose.Schema(
  {
    daily: { type: rollingUsageSnapshotSchema, required: true },
    rolling30Days: { type: rollingUsageSnapshotSchema, required: true },
    activeFreeJobs: {
      type: activeFreeUsageSnapshotSchema,
      required: true,
    },
  },
  { _id: false, strict: 'throw' }
);

const quotaSnapshotSchema = new mongoose.Schema(
  {
    policyCode: {
      type: String,
      enum: [PUBLISHING_POLICY_CODES.FREE_BETA],
      required: true,
    },
    policyVersion: {
      type: String,
      enum: [FREE_BETA_POLICY_VERSION],
      required: true,
    },
    capturedAt: { type: Date, required: true },
    before: { type: quotaUsageSnapshotSchema, required: true },
    after: { type: quotaUsageSnapshotSchema, required: true },
  },
  { _id: false, strict: 'throw' }
);

const moderationSummarySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'approved',
        'rejected',
        'changes_requested',
        'withdrawn',
        'expired',
        'superseded',
      ],
      required: true,
    },
    reasonCode: {
      type: String,
      trim: true,
      maxlength: 100,
      match: /^[A-Z0-9_]+$/,
    },
    ownerMessage: safeText(1000),
    eventId: { type: ObjectId, required: true },
    decidedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' }
);

const jobPublicationSubmissionSchema = new mongoose.Schema(
  {
    jobId: { type: ObjectId, ref: 'Job', required: true, immutable: true },
    employerId: {
      type: ObjectId,
      ref: 'Employer',
      required: true,
      immutable: true,
    },
    quotaOwnerType: {
      type: String,
      enum: QUOTA_OWNER_TYPES,
      required: true,
      immutable: true,
    },
    quotaOwnerId: { type: ObjectId, required: true, immutable: true },
    submissionKind: {
      type: String,
      enum: PUBLICATION_SUBMISSION_KINDS,
      required: true,
      immutable: true,
    },
    planCode: {
      type: String,
      enum: Object.values(PUBLISHING_POLICY_CODES),
      default: PUBLISHING_POLICY_CODES.FREE_BETA,
      required: true,
      immutable: true,
    },
    policyVersion: {
      type: String,
      default: FREE_BETA_POLICY_VERSION,
      required: true,
      immutable: true,
    },
    state: {
      type: String,
      enum: PUBLICATION_SUBMISSION_STATES,
      default: 'pending_review',
      required: true,
    },
    acceptedAt: { type: Date, required: true, immutable: true },
    reviewedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 16,
      maxlength: 128,
      immutable: true,
    },
    requestFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    correctionOfSubmissionId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      default: null,
      immutable: true,
    },
    moderationCycleId: { type: ObjectId, required: true, immutable: true },
    quotaCharged: { type: Boolean, required: true, immutable: true },
    quotaExemptionReason: {
      type: String,
      enum: QUOTA_EXEMPTION_REASONS,
      default: null,
      immutable: true,
    },
    jobRevision: { type: Number, required: true, min: 0, immutable: true },
    contentSnapshot: {
      type: contentSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectUnknownSnapshotKeys('contentSnapshot', CONTENT_SNAPSHOT_SHAPE),
    },
    rulesAcknowledgementId: {
      type: ObjectId,
      ref: 'EmployerPostingRulesAcknowledgement',
      required: true,
      immutable: true,
    },
    verificationSnapshot: {
      type: verificationSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectUnknownSnapshotKeys(
        'verificationSnapshot',
        VERIFICATION_SNAPSHOT_SHAPE
      ),
    },
    quotaSnapshot: {
      type: quotaSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectUnknownSnapshotKeys('quotaSnapshot', QUOTA_SNAPSHOT_SHAPE),
    },
    moderationSummary: {
      type: moderationSummarySchema,
      default: null,
      set: rejectUnknownSnapshotKeys(
        'moderationSummary',
        MODERATION_SUMMARY_SHAPE
      ),
    },
  },
  {
    timestamps: true,
    collection: 'jobPublicationSubmissions',
    strict: 'throw',
  }
);

jobPublicationSubmissionSchema.index(
  { quotaOwnerType: 1, quotaOwnerId: 1, idempotencyKey: 1 },
  { unique: true, name: 'publication_submission_owner_idempotency_unique' }
);
jobPublicationSubmissionSchema.index({
  quotaOwnerType: 1,
  quotaOwnerId: 1,
  acceptedAt: -1,
});
jobPublicationSubmissionSchema.index({
  quotaOwnerType: 1,
  quotaOwnerId: 1,
  planCode: 1,
  acceptedAt: -1,
});
jobPublicationSubmissionSchema.index({ jobId: 1, acceptedAt: -1 });
jobPublicationSubmissionSchema.index({ state: 1, acceptedAt: 1 });
jobPublicationSubmissionSchema.index({ employerId: 1, acceptedAt: -1 });
jobPublicationSubmissionSchema.index(
  { rulesAcknowledgementId: 1 },
  { unique: true, name: 'publication_submission_rules_ack_unique' }
);
jobPublicationSubmissionSchema.index(
  { correctionOfSubmissionId: 1 },
  { sparse: true }
);
jobPublicationSubmissionSchema.index({ moderationCycleId: 1, acceptedAt: 1 });
jobPublicationSubmissionSchema.index(
  { moderationCycleId: 1 },
  {
    unique: true,
    name: 'publication_submission_one_exempt_correction_per_cycle',
    partialFilterExpression: {
      submissionKind: 'correction',
      quotaCharged: false,
    },
  }
);
jobPublicationSubmissionSchema.index(
  { jobId: 1 },
  {
    unique: true,
    name: 'publication_submission_one_pending_per_job',
    partialFilterExpression: { state: 'pending_review' },
  }
);

jobPublicationSubmissionSchema.pre(
  'validate',
  function validateSubmissionContract(next) {
    if (!Number.isInteger(this.jobRevision) || this.jobRevision < 0) {
      this.invalidate(
        'jobRevision',
        'jobRevision must be a non-negative integer'
      );
    }

    if (
      this.submissionKind === 'correction' &&
      !this.correctionOfSubmissionId
    ) {
      this.invalidate(
        'correctionOfSubmissionId',
        'correctionOfSubmissionId is required for correction submissions'
      );
    }

    if (this.submissionKind !== 'correction' && this.correctionOfSubmissionId) {
      this.invalidate(
        'correctionOfSubmissionId',
        'correctionOfSubmissionId is only valid for correction submissions'
      );
    }

    if (this.quotaCharged && this.quotaExemptionReason) {
      this.invalidate(
        'quotaExemptionReason',
        'quotaExemptionReason must be empty when quotaCharged is true'
      );
    }

    if (!this.quotaCharged && !this.quotaExemptionReason) {
      this.invalidate(
        'quotaExemptionReason',
        'quotaExemptionReason is required when quotaCharged is false'
      );
    }

    if (
      this.quotaExemptionReason === 'reviewer_requested_correction' &&
      this.submissionKind !== 'correction'
    ) {
      this.invalidate(
        'quotaExemptionReason',
        'reviewer_requested_correction is valid only for correction submissions'
      );
    }

    if (this.approvedAt && this.rejectedAt) {
      this.invalidate(
        'approvedAt',
        'approvedAt and rejectedAt are mutually exclusive'
      );
      this.invalidate(
        'rejectedAt',
        'approvedAt and rejectedAt are mutually exclusive'
      );
    }

    if (this.state === 'approved' && !this.approvedAt) {
      this.invalidate(
        'approvedAt',
        'approvedAt is required for approved submissions'
      );
    }

    if (this.state === 'rejected' && !this.rejectedAt) {
      this.invalidate(
        'rejectedAt',
        'rejectedAt is required for rejected submissions'
      );
    }

    const isApproved = this.state === 'approved';
    const isRejected = this.state === 'rejected';
    const isReviewed = isApproved || isRejected;
    const decisionAt = isApproved ? this.approvedAt : this.rejectedAt;

    if (isReviewed && !this.reviewedAt) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt is required for approved and rejected submissions'
      );
    }

    if (!isReviewed && this.reviewedAt) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt is only valid for approved and rejected submissions'
      );
    }

    if (!isApproved && this.approvedAt) {
      this.invalidate(
        'approvedAt',
        'approvedAt is only valid for approved submissions'
      );
    }

    if (!isRejected && this.rejectedAt) {
      this.invalidate(
        'rejectedAt',
        'rejectedAt is only valid for rejected submissions'
      );
    }

    if (
      isReviewed &&
      this.reviewedAt &&
      decisionAt &&
      this.reviewedAt.getTime() !== decisionAt.getTime()
    ) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt must match the approval or rejection decision time'
      );
    }

    if (
      isReviewed &&
      this.acceptedAt &&
      this.reviewedAt &&
      this.reviewedAt < this.acceptedAt
    ) {
      this.invalidate(
        'reviewedAt',
        'reviewedAt cannot be earlier than acceptedAt'
      );
    }

    next();
  }
);

export const JobPublicationSubmission = mongoose.model(
  'JobPublicationSubmission',
  jobPublicationSubmissionSchema
);
