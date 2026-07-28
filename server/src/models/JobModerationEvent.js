import mongoose from 'mongoose';
import {
  JOB_PUBLICATION_STATES,
  PUBLICATION_SUBMISSION_KINDS,
  QUOTA_EXEMPTION_REASONS,
} from '../config/freeBetaPublishingPolicy.js';

const { ObjectId } = mongoose.Schema.Types;

export const MODERATION_ACTOR_TYPES = Object.freeze([
  'employer',
  'staff',
  'system',
]);

export const MODERATION_EVENT_ACTIONS = Object.freeze([
  'submitted',
  'approved',
  'rejected',
  'changes_requested',
  'closed',
  'reopened',
  'expired',
  'withdrawn',
  'superseded',
]);

export const MODERATION_REQUESTABLE_FIELD_PATHS = Object.freeze([
  'title',
  'companyName',
  'description',
  'requirements',
  'responsibilities',
  'skillsRequired',
  'salaryRange',
  'salaryCurrency',
  'location',
  'province',
  'city',
  'category',
  'employmentType',
  'jobType',
  'educationRequirement',
  'experience',
  'applicationMode',
  'applicationDomain',
  'workMode',
  'deadline',
  'totalSeats',
]);

function appendOnlyError() {
  const error = new Error('Job moderation events are append-only');
  error.code = 'JOB_MODERATION_EVENT_APPEND_ONLY';
  return error;
}

function rejectUnknownMetadata(value) {
  const allowed = new Set([
    'quotaCharged',
    'quotaExemptionReason',
    'moderationCycleId',
    'submissionKind',
    'currentActiveFreeJobs',
    'projectedActiveFreeJobs',
    'slotsReleased',
    'policyVersion',
  ]);

  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) {
      throw new TypeError(
        `metadata.${key} is not an allowed moderation-event field`
      );
    }
  }
  return value;
}

const moderationEventMetadataSchema = new mongoose.Schema(
  {
    quotaCharged: { type: Boolean },
    quotaExemptionReason: {
      type: String,
      enum: QUOTA_EXEMPTION_REASONS,
      default: null,
    },
    moderationCycleId: { type: ObjectId },
    submissionKind: {
      type: String,
      enum: PUBLICATION_SUBMISSION_KINDS,
    },
    currentActiveFreeJobs: { type: Number, min: 0 },
    projectedActiveFreeJobs: { type: Number, min: 0 },
    slotsReleased: { type: Number, enum: [0, 1] },
    policyVersion: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false, strict: 'throw' }
);

const jobModerationEventSchema = new mongoose.Schema(
  {
    jobId: {
      type: ObjectId,
      ref: 'Job',
      required: true,
      immutable: true,
    },
    submissionId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      required: true,
      immutable: true,
    },
    employerId: {
      type: ObjectId,
      ref: 'Employer',
      required: true,
      immutable: true,
    },
    actorType: {
      type: String,
      enum: MODERATION_ACTOR_TYPES,
      required: true,
      immutable: true,
    },
    actorId: {
      type: ObjectId,
      default: null,
      immutable: true,
    },
    action: {
      type: String,
      enum: MODERATION_EVENT_ACTIONS,
      required: true,
      immutable: true,
    },
    fromState: {
      type: String,
      enum: JOB_PUBLICATION_STATES,
      default: null,
      immutable: true,
    },
    toState: {
      type: String,
      enum: JOB_PUBLICATION_STATES,
      required: true,
      immutable: true,
    },
    reasonCode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
      match: /^[A-Z0-9_]+$/,
      immutable: true,
    },
    reasonTextInternal: {
      type: String,
      default: null,
      trim: true,
      maxlength: 4000,
      immutable: true,
    },
    reasonTextEmployer: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
      immutable: true,
    },
    requestedFieldPaths: {
      type: [
        {
          type: String,
          enum: MODERATION_REQUESTABLE_FIELD_PATHS,
        },
      ],
      default: undefined,
      immutable: true,
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    metadata: {
      type: moderationEventMetadataSchema,
      default: undefined,
      immutable: true,
      set: rejectUnknownMetadata,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    collection: 'jobModerationEvents',
    strict: 'throw',
    versionKey: false,
  }
);

jobModerationEventSchema.index({ jobId: 1, createdAt: 1 });
jobModerationEventSchema.index({ submissionId: 1, createdAt: 1 });
jobModerationEventSchema.index({ employerId: 1, createdAt: -1 });
jobModerationEventSchema.index({ action: 1, createdAt: -1 });

jobModerationEventSchema.pre('validate', function validateEventContract(next) {
  if (['employer', 'staff'].includes(this.actorType) && !this.actorId) {
    this.invalidate(
      'actorId',
      'actorId is required for employer and staff moderation actors'
    );
  }

  if (
    ['rejected', 'changes_requested'].includes(this.action) &&
    !this.reasonCode
  ) {
    this.invalidate(
      'reasonCode',
      'reasonCode is required for rejection and requested changes'
    );
  }

  if (
    ['rejected', 'changes_requested'].includes(this.action) &&
    !this.reasonTextEmployer
  ) {
    this.invalidate(
      'reasonTextEmployer',
      'reasonTextEmployer is required for rejection and requested changes'
    );
  }

  if (
    ['rejected', 'changes_requested'].includes(this.action) &&
    !this.metadata?.moderationCycleId
  ) {
    this.invalidate(
      'metadata.moderationCycleId',
      'metadata.moderationCycleId is required for rejection and requested changes'
    );
  }

  if (
    this.action === 'changes_requested' &&
    (!this.requestedFieldPaths || this.requestedFieldPaths.length === 0)
  ) {
    this.invalidate(
      'requestedFieldPaths',
      'requestedFieldPaths is required when changes are requested'
    );
  }

  next();
});

jobModerationEventSchema.pre('save', function preventUpdate() {
  if (!this.isNew) {
    throw appendOnlyError();
  }
});

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  jobModerationEventSchema.pre(operation, function denyWrite() {
    throw appendOnlyError();
  });
}

export function toEmployerSafeModerationEvent(event) {
  const source =
    event && typeof event.toObject === 'function' ? event.toObject() : event;

  if (!source || typeof source !== 'object') {
    return null;
  }

  return Object.freeze({
    id: source._id,
    jobId: source.jobId,
    submissionId: source.submissionId,
    action: source.action,
    fromState: source.fromState ?? null,
    toState: source.toState,
    reasonCode: source.reasonCode ?? null,
    reasonTextEmployer: source.reasonTextEmployer ?? null,
    requestedFieldPaths: Object.freeze([...(source.requestedFieldPaths || [])]),
    createdAt: source.createdAt,
  });
}

export const JobModerationEvent = mongoose.model(
  'JobModerationEvent',
  jobModerationEventSchema
);
