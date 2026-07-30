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

const C4_SUBMITTED_EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion',
  'operationId',
  'operationKind',
  'submissionId',
  'candidateHash',
  'candidateKind',
  'candidateRevision',
  'destinationMode',
  'destinationTargetDigest',
  'expectedPublicationVersion',
  'moderationCycleId',
  'actorClassification',
  'eventType',
  'eventTimestamp',
]);
const C4_UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const C4_OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;
const C4_HASH_PATTERN = /^[a-f0-9]{64}$/;
const C4_CANONICAL_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const C4_UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function rejectUnsafeSubmittedEvidence(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError('submittedEvidence contains invalid evidence');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      C4_UNSAFE_KEYS.has(key) ||
      key.includes('.') ||
      key.startsWith('$') ||
      !C4_SUBMITTED_EVIDENCE_FIELDS.includes(key) ||
      !descriptor?.enumerable ||
      !Object.hasOwn(descriptor, 'value') ||
      !['string', 'number'].includes(typeof descriptor.value)
    ) {
      throw new TypeError('submittedEvidence contains unsupported evidence');
    }
  }
  return value;
}

function canonicalIso(value) {
  return (
    typeof value === 'string' &&
    C4_CANONICAL_ISO_PATTERN.test(value) &&
    new Date(value).toISOString() === value
  );
}

function requireSubmittedPrimitiveTypes(schema) {
  const numericFields = new Set([
    'schemaVersion',
    'candidateRevision',
    'expectedPublicationVersion',
  ]);
  for (const field of C4_SUBMITTED_EVIDENCE_FIELDS) {
    const expectedType = numericFields.has(field) ? 'number' : 'string';
    schema.path(field).set(function rejectImplicitEvidenceCast(value) {
      if (value === undefined) return value;
      if (typeof value !== expectedType) {
        throw new TypeError('submitted evidence value has invalid type');
      }
      return value;
    });
  }
}

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

const submittedEvidenceSchema = new mongoose.Schema(
  {
    schemaVersion: {
      type: Number,
      enum: [1],
      required: true,
      immutable: true,
    },
    operationId: {
      type: String,
      match: [C4_UUID_V4_PATTERN, 'operation identity is invalid'],
      required: true,
      immutable: true,
    },
    operationKind: {
      type: String,
      enum: ['major_edit_submission', 'correction_submission'],
      required: true,
      immutable: true,
    },
    submissionId: {
      type: String,
      match: [C4_OBJECT_ID_PATTERN, 'submission identity is invalid'],
      required: true,
      immutable: true,
    },
    candidateHash: {
      type: String,
      match: [C4_HASH_PATTERN, 'candidate hash evidence is invalid'],
      required: true,
      immutable: true,
    },
    candidateKind: {
      type: String,
      enum: ['major_edit', 'correction'],
      required: true,
      immutable: true,
    },
    candidateRevision: {
      type: Number,
      min: 1,
      required: true,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'submitted candidate revision evidence is invalid',
      },
    },
    destinationMode: {
      type: String,
      enum: ['internal_platform', 'external_url', 'external_email'],
      required: true,
      immutable: true,
    },
    destinationTargetDigest: {
      type: String,
      match: [C4_HASH_PATTERN, 'destination digest evidence is invalid'],
      required: true,
      immutable: true,
    },
    expectedPublicationVersion: {
      type: Number,
      min: 0,
      required: true,
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'submitted publication version evidence is invalid',
      },
    },
    moderationCycleId: {
      type: String,
      match: [C4_OBJECT_ID_PATTERN, 'moderation cycle identity is invalid'],
      required: true,
      immutable: true,
    },
    actorClassification: {
      type: String,
      enum: MODERATION_ACTOR_TYPES,
      required: true,
      immutable: true,
    },
    eventType: {
      type: String,
      enum: MODERATION_EVENT_ACTIONS,
      required: true,
      immutable: true,
    },
    eventTimestamp: {
      type: String,
      required: true,
      immutable: true,
      validate: {
        validator: canonicalIso,
        message: 'submitted event timestamp evidence is invalid',
      },
    },
  },
  { _id: false, strict: 'throw' }
);
requireSubmittedPrimitiveTypes(submittedEvidenceSchema);

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
    submittedEvidence: {
      type: submittedEvidenceSchema,
      default: undefined,
      immutable: true,
      set(value) {
        if (value === undefined) return value;
        return rejectUnsafeSubmittedEvidence(value);
      },
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
  if (this.submittedEvidence !== undefined) {
    const evidence = this.submittedEvidence;
    const expectedCandidateKind =
      evidence.operationKind === 'major_edit_submission'
        ? 'major_edit'
        : evidence.operationKind === 'correction_submission'
          ? 'correction'
          : null;
    const expectedFromState =
      evidence.operationKind === 'major_edit_submission'
        ? 'active'
        : evidence.operationKind === 'correction_submission'
          ? 'rejected'
          : null;
    if (
      this.action !== 'submitted' ||
      this.actorType !== 'employer' ||
      this.fromState !== expectedFromState ||
      this.toState !== 'pending_review' ||
      evidence.submissionId !== this.submissionId?.toString() ||
      evidence.candidateHash !== this.contentHash ||
      evidence.candidateKind !== expectedCandidateKind ||
      evidence.actorClassification !== this.actorType ||
      evidence.eventType !== this.action ||
      evidence.eventTimestamp !== this.createdAt?.toISOString() ||
      evidence.moderationCycleId !==
        this.metadata?.moderationCycleId?.toString()
    ) {
      this.invalidate(
        'submittedEvidence',
        'submitted moderation evidence relationships are invalid'
      );
    }
  }

  if (!this.isNew && this.isModified('submittedEvidence')) {
    this.invalidate(
      'submittedEvidence',
      'submitted moderation evidence cannot be modified'
    );
  }

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
