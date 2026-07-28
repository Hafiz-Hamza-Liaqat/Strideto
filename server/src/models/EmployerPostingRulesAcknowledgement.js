import mongoose from 'mongoose';
import { FREE_BETA_POLICY_VERSION } from '../config/freeBetaPublishingPolicy.js';

const { ObjectId } = mongoose.Schema.Types;

function appendOnlyError() {
  const error = new Error('Posting-rules acknowledgements are append-only');
  error.code = 'POSTING_RULES_ACKNOWLEDGEMENT_APPEND_ONLY';
  return error;
}

const employerPostingRulesAcknowledgementSchema = new mongoose.Schema(
  {
    employerId: {
      type: ObjectId,
      ref: 'Employer',
      required: true,
      immutable: true,
    },
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
    policyVersion: {
      type: String,
      enum: [FREE_BETA_POLICY_VERSION],
      required: true,
      immutable: true,
    },
    rulesVersion: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
      immutable: true,
    },
    rulesDigest: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    accepted: {
      type: Boolean,
      required: true,
      immutable: true,
      validate: {
        validator: (value) => value === true,
        message: 'accepted must be true',
      },
    },
    acceptedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    sourceIpHash: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    userAgentHash: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    collection: 'employerPostingRulesAcknowledgements',
    strict: 'throw',
    versionKey: false,
  }
);

employerPostingRulesAcknowledgementSchema.index(
  { submissionId: 1 },
  {
    unique: true,
    name: 'posting_rules_acknowledgement_submission_unique',
  }
);
employerPostingRulesAcknowledgementSchema.index({
  employerId: 1,
  acceptedAt: -1,
});
employerPostingRulesAcknowledgementSchema.index({
  rulesVersion: 1,
  acceptedAt: -1,
});

employerPostingRulesAcknowledgementSchema.pre('save', function preventUpdate() {
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
  employerPostingRulesAcknowledgementSchema.pre(
    operation,
    function denyWrite() {
      throw appendOnlyError();
    }
  );
}

export const EmployerPostingRulesAcknowledgement = mongoose.model(
  'EmployerPostingRulesAcknowledgement',
  employerPostingRulesAcknowledgementSchema
);
