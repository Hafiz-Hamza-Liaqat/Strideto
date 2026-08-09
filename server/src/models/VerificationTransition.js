/**
 * VerificationTransition — immutable state-transition history.
 *
 * Every verification status change creates one record. Records are NEVER
 * updated or deleted — they form the auditable history of an organization's
 * verification journey.
 *
 * No sensitive payload (document contents, raw identity data) in `metadata`.
 */
import mongoose from 'mongoose';
import { VERIFICATION_STATUSES } from '../../../shared/international/verification.js';

const transitionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    fromStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      required: true,
    },

    toStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      required: true,
    },

    // Actor who triggered the transition
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, trim: true, default: '' },
    actorRealm: { type: String, trim: true, default: 'admin' },

    // Human-readable reason (required for certain admin actions)
    reason: { type: String, trim: true, default: '' },

    // Safe, non-sensitive contextual metadata
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Audit correlation
    correlationId: { type: String, trim: true, default: '' },

    // The timestamp of this event (explicit — not relying solely on createdAt)
    occurredAt: { type: Date, default: Date.now, immutable: true },
  },
  {
    timestamps: false,
    // Explicitly no update operations: records are write-once
  }
);

// Disable all update operations at schema level
transitionSchema.pre('findOneAndUpdate', function () {
  throw new Error('VerificationTransition records are immutable');
});
transitionSchema.pre('updateOne', function () {
  throw new Error('VerificationTransition records are immutable');
});
transitionSchema.pre('updateMany', function () {
  throw new Error('VerificationTransition records are immutable');
});

transitionSchema.index({ organizationId: 1, occurredAt: -1 });
transitionSchema.index({ actorId: 1, occurredAt: -1 });
transitionSchema.index({ toStatus: 1, occurredAt: -1 });

export const VerificationTransition = mongoose.model(
  'VerificationTransition',
  transitionSchema
);
