import mongoose from 'mongoose';
import {
  REFRESH_SESSION_SUBJECT_TYPES,
  REFRESH_SESSION_REVOKE_REASONS,
} from '../services/auth/RefreshSessionContracts.js';

const { ObjectId } = mongoose.Schema.Types;

/**
 * Canonical refresh-session model. One document represents one complete refresh
 * session family (not one document per rotation generation). `_id` is the
 * stable family identifier and doubles as the JWT `sid` claim. Authority:
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md §21.
 */
const refreshSessionSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: REFRESH_SESSION_SUBJECT_TYPES,
      required: true,
      immutable: true,
    },
    subjectId: {
      type: ObjectId,
      required: true,
      immutable: true,
    },
    currentTokenHash: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
    },
    previousTokenHash: {
      type: String,
      default: null,
      minlength: 64,
      maxlength: 64,
    },
    previousTokenRotatedAt: {
      type: Date,
      default: null,
    },
    tokenVersionAtIssue: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'tokenVersionAtIssue must be an integer',
      },
    },
    /**
     * SEC-3B.1 — defaults to the time of document construction so any
     * future caller that omits it explicitly still gets a well-defined
     * value rather than a validation failure; the rotation service (§22)
     * always supplies it explicitly on both creation and every rotation
     * regardless, so this default is a safety net, not the primary path.
     */
    lastUsedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokeReason: {
      type: String,
      enum: [...REFRESH_SESSION_REVOKE_REASONS, null],
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: 'throw',
    autoIndex: false,
    autoCreate: false,
  }
);

// TTL cleanup — expires the document itself at expiresAt, independent of
// application-level revocation logic.
refreshSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'refresh_session_ttl' }
);

// Active-session lookup by subject, e.g. logout-all / bulk best-effort
// revocation (§21, §29) — a plain multi-document read/update, not a
// transaction.
refreshSessionSchema.index(
  { subjectType: 1, subjectId: 1, revokedAt: 1 },
  { name: 'refresh_session_active_by_subject' }
);

// Defense-in-depth: no two sessions should ever share the same current
// token hash. Not load-bearing for CAS correctness (the rotation filter is
// always scoped by `_id` first, §22 step 8) — this guards against an
// unrelated bug producing a colliding/predictable hash.
refreshSessionSchema.index(
  { currentTokenHash: 1 },
  { unique: true, name: 'refresh_session_current_token_hash_unique' }
);

// previousTokenHash participates in the §22 CAS-loss classification
// (benign-conflict vs. replay) and is looked up by value; index it, but do
// not enforce uniqueness on it (a null value is shared by every
// not-yet-rotated session, and a stale previous hash must remain queryable
// even after a second rotation moves currentTokenHash forward again).
refreshSessionSchema.index(
  { previousTokenHash: 1 },
  { name: 'refresh_session_previous_token_hash', sparse: true }
);

refreshSessionSchema.pre('validate', function validateRefreshSession(next) {
  const hasPreviousHash =
    this.previousTokenHash !== null && this.previousTokenHash !== undefined;
  const hasPreviousRotatedAt =
    this.previousTokenRotatedAt !== null &&
    this.previousTokenRotatedAt !== undefined;
  if (hasPreviousHash !== hasPreviousRotatedAt) {
    this.invalidate(
      'previousTokenHash',
      'previousTokenHash and previousTokenRotatedAt must be present together'
    );
  }

  const hasRevokedAt = this.revokedAt !== null && this.revokedAt !== undefined;
  const hasRevokeReason =
    this.revokeReason !== null && this.revokeReason !== undefined;
  if (hasRevokedAt !== hasRevokeReason) {
    this.invalidate(
      'revokedAt',
      'revokedAt and revokeReason must be present together'
    );
  }

  next();
});

export const RefreshSession =
  mongoose.models.RefreshSession ||
  mongoose.model('RefreshSession', refreshSessionSchema);
