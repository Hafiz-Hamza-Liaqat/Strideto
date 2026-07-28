import mongoose from 'mongoose';
import {
  PUBLISHING_OUTBOX_AGGREGATE_TYPE,
  PUBLISHING_OUTBOX_AUDIENCES,
  PUBLISHING_OUTBOX_BOUNDS,
  PUBLISHING_OUTBOX_FAILURE_CLASSIFICATIONS,
  PUBLISHING_OUTBOX_INTENT_TYPES,
  PUBLISHING_OUTBOX_LIFECYCLE_STATES,
  PUBLISHING_OUTBOX_SCHEMA_VERSION,
  PUBLISHING_OUTBOX_TYPE_CONTRACTS,
} from '../services/publishing/outbox/PublishingOutboxContracts.js';

const { ObjectId } = mongoose.Schema.Types;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const SAFE_OPERATIONAL_CODE = /^[A-Z0-9][A-Z0-9_.:-]*$/;
const SAFE_LEASE_OWNER = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

const lastFailureSchema = new mongoose.Schema(
  {
    classification: {
      type: String,
      enum: PUBLISHING_OUTBOX_FAILURE_CLASSIFICATIONS,
      required: true,
    },
    code: {
      type: String,
      required: true,
      maxlength: PUBLISHING_OUTBOX_BOUNDS.failureCodeMaxLength,
      match: SAFE_OPERATIONAL_CODE,
    },
    occurredAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' }
);

const publishingOutboxIntentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: PUBLISHING_OUTBOX_INTENT_TYPES,
      required: true,
      immutable: true,
    },
    schemaVersion: {
      type: Number,
      enum: [PUBLISHING_OUTBOX_SCHEMA_VERSION],
      required: true,
      immutable: true,
      validate: {
        validator: Number.isInteger,
        message: 'schemaVersion must be an integer',
      },
    },
    deduplicationKey: {
      type: String,
      required: true,
      immutable: true,
      minlength: 1,
      maxlength: PUBLISHING_OUTBOX_BOUNDS.deduplicationKeyMaxLength,
      match: PRINTABLE_ASCII,
    },
    aggregateType: {
      type: String,
      enum: [PUBLISHING_OUTBOX_AGGREGATE_TYPE],
      required: true,
      immutable: true,
    },
    aggregateId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      required: true,
      immutable: true,
    },
    submissionId: {
      type: ObjectId,
      ref: 'JobPublicationSubmission',
      required: true,
      immutable: true,
    },
    jobId: {
      type: ObjectId,
      ref: 'Job',
      required: true,
      immutable: true,
    },
    employerId: {
      type: ObjectId,
      ref: 'Employer',
      immutable: true,
      default: undefined,
    },
    audience: {
      type: String,
      enum: PUBLISHING_OUTBOX_AUDIENCES,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: PUBLISHING_OUTBOX_LIFECYCLE_STATES,
      required: true,
    },
    availableAt: { type: Date, required: true },
    attempts: {
      type: Number,
      required: true,
      min: 0,
      max: PUBLISHING_OUTBOX_BOUNDS.maximumAttempts,
      validate: {
        validator: Number.isInteger,
        message: 'attempts must be an integer',
      },
    },
    lastFailure: {
      type: lastFailureSchema,
      default: undefined,
    },
    leaseOwner: {
      type: String,
      maxlength: PUBLISHING_OUTBOX_BOUNDS.leaseOwnerMaxLength,
      match: SAFE_LEASE_OWNER,
      default: undefined,
    },
    leaseExpiresAt: { type: Date, default: undefined },
    processedAt: { type: Date, default: undefined },
    terminalFailedAt: { type: Date, default: undefined },
  },
  {
    timestamps: true,
    strict: 'throw',
    autoIndex: false,
    autoCreate: false,
  }
);

publishingOutboxIntentSchema.index(
  { deduplicationKey: 1 },
  {
    unique: true,
    sparse: false,
    name: 'publishing_outbox_deduplication_unique',
  }
);
publishingOutboxIntentSchema.index(
  { status: 1, availableAt: 1, createdAt: 1, _id: 1 },
  {
    name: 'publishing_outbox_available_claim',
    partialFilterExpression: {
      status: { $in: ['pending', 'retryable_failed'] },
    },
  }
);
publishingOutboxIntentSchema.index(
  { status: 1, leaseExpiresAt: 1, _id: 1 },
  {
    name: 'publishing_outbox_stale_lease',
    partialFilterExpression: { status: 'processing' },
  }
);
publishingOutboxIntentSchema.index(
  { submissionId: 1, createdAt: 1 },
  { name: 'publishing_outbox_submission_history' }
);
publishingOutboxIntentSchema.index(
  { aggregateType: 1, aggregateId: 1, createdAt: -1 },
  { name: 'publishing_outbox_aggregate_history' }
);
publishingOutboxIntentSchema.index(
  { status: 1, processedAt: -1 },
  {
    name: 'publishing_outbox_processed_retention',
    partialFilterExpression: { status: 'processed' },
  }
);
publishingOutboxIntentSchema.index(
  { status: 1, terminalFailedAt: -1 },
  {
    name: 'publishing_outbox_terminal_review',
    partialFilterExpression: { status: 'terminal_failed' },
  }
);

function invalidate(document, path, message) {
  document.invalidate(path, message);
}

publishingOutboxIntentSchema.pre(
  'validate',
  function validatePublishingOutboxIntent(next) {
    const aggregateId = this.aggregateId?.toString();
    const submissionId = this.submissionId?.toString();
    if (aggregateId && submissionId && aggregateId !== submissionId) {
      invalidate(this, 'submissionId', 'submissionId must match aggregateId');
    }

    const typeContract = PUBLISHING_OUTBOX_TYPE_CONTRACTS[this.type];
    if (typeContract && this.audience !== typeContract.audience) {
      invalidate(this, 'audience', 'audience must match intent type');
    }

    if (this.type === 'employer_submission_received' && !this.employerId) {
      invalidate(
        this,
        'employerId',
        'employerId is required for employer receipt intents'
      );
    }
    if (this.type === 'admin_job_review_requested' && this.employerId) {
      invalidate(
        this,
        'employerId',
        'employerId is forbidden for admin review intents'
      );
    }

    if (
      submissionId &&
      this.type &&
      this.deduplicationKey !== `${submissionId}:${this.type}`
    ) {
      invalidate(
        this,
        'deduplicationKey',
        'deduplicationKey must match submission and intent type'
      );
    }

    const hasLeaseOwner = this.leaseOwner !== undefined;
    const hasLeaseExpiry = this.leaseExpiresAt !== undefined;
    if (hasLeaseOwner !== hasLeaseExpiry) {
      invalidate(
        this,
        'leaseOwner',
        'leaseOwner and leaseExpiresAt must be present together'
      );
      invalidate(
        this,
        'leaseExpiresAt',
        'leaseOwner and leaseExpiresAt must be present together'
      );
    }
    if ((hasLeaseOwner || hasLeaseExpiry) && this.status !== 'processing') {
      invalidate(
        this,
        'leaseOwner',
        'lease fields are valid only while processing'
      );
    }

    if (this.processedAt && this.status !== 'processed') {
      invalidate(
        this,
        'processedAt',
        'processedAt is valid only for processed intents'
      );
    }
    if (this.terminalFailedAt && this.status !== 'terminal_failed') {
      invalidate(
        this,
        'terminalFailedAt',
        'terminalFailedAt is valid only for terminal failures'
      );
    }

    if (this.status === 'pending') {
      if (this.attempts !== 0) {
        invalidate(this, 'attempts', 'pending intents must have zero attempts');
      }
      if (hasLeaseOwner || hasLeaseExpiry) {
        invalidate(this, 'leaseOwner', 'pending intents cannot have a lease');
      }
      if (this.lastFailure) {
        invalidate(
          this,
          'lastFailure',
          'pending intents cannot have failure data'
        );
      }
      if (this.processedAt || this.terminalFailedAt) {
        invalidate(
          this,
          'status',
          'pending intents cannot have terminal timestamps'
        );
      }
    }

    if (this.status === 'processing') {
      if (!Number.isInteger(this.attempts) || this.attempts < 1) {
        invalidate(
          this,
          'attempts',
          'processing intents require a positive attempt count'
        );
      }
      if (!hasLeaseOwner || !hasLeaseExpiry) {
        invalidate(
          this,
          'leaseOwner',
          'processing intents require an active lease'
        );
      }
      if (this.processedAt || this.terminalFailedAt) {
        invalidate(
          this,
          'status',
          'processing intents cannot have terminal timestamps'
        );
      }
    }

    if (this.status === 'retryable_failed') {
      if (!Number.isInteger(this.attempts) || this.attempts < 1) {
        invalidate(
          this,
          'attempts',
          'retryable failures require a positive attempt count'
        );
      }
      if (!this.lastFailure) {
        invalidate(
          this,
          'lastFailure',
          'retryable failures require safe failure data'
        );
      }
      if (hasLeaseOwner || hasLeaseExpiry) {
        invalidate(
          this,
          'leaseOwner',
          'retryable failures cannot have an active lease'
        );
      }
      if (this.processedAt || this.terminalFailedAt) {
        invalidate(
          this,
          'status',
          'retryable failures cannot have terminal timestamps'
        );
      }
    }

    if (this.status === 'processed') {
      if (!Number.isInteger(this.attempts) || this.attempts < 1) {
        invalidate(
          this,
          'attempts',
          'processed intents require a positive attempt count'
        );
      }
      if (!this.processedAt) {
        invalidate(
          this,
          'processedAt',
          'processed intents require processedAt'
        );
      }
      if (hasLeaseOwner || hasLeaseExpiry || this.terminalFailedAt) {
        invalidate(
          this,
          'status',
          'processed intents cannot have a lease or terminal failure timestamp'
        );
      }
    }

    if (this.status === 'terminal_failed') {
      if (!Number.isInteger(this.attempts) || this.attempts < 1) {
        invalidate(
          this,
          'attempts',
          'terminal failures require a positive attempt count'
        );
      }
      if (!this.lastFailure) {
        invalidate(
          this,
          'lastFailure',
          'terminal failures require safe failure data'
        );
      }
      if (!this.terminalFailedAt) {
        invalidate(
          this,
          'terminalFailedAt',
          'terminal failures require terminalFailedAt'
        );
      }
      if (hasLeaseOwner || hasLeaseExpiry || this.processedAt) {
        invalidate(
          this,
          'status',
          'terminal failures cannot have a lease or processed timestamp'
        );
      }
    }

    next();
  }
);

export const PublishingOutboxIntent =
  mongoose.models.PublishingOutboxIntent ||
  mongoose.model('PublishingOutboxIntent', publishingOutboxIntentSchema);
