import mongoose from 'mongoose';
import {
  MAX_PROVIDER_SUBJECT_LENGTH,
  SOCIAL_IDENTITY_PROVIDERS,
} from '../../../shared/auth/socialIdentityProviders.js';

/**
 * External social identity linked to exactly one STRIDETO `User`.
 *
 * Invariants this model enforces at the storage layer:
 *
 *  - `(provider, subject)` is the canonical external identity and is unique
 *    globally. One provider account can never map to two STRIDETO users.
 *  - `(userId, provider)` is unique, so one STRIDETO user holds at most one
 *    identity per provider while still supporting many providers per account.
 *  - `emailAtLink` / `emailVerifiedAtLink` are **metadata only**: a snapshot of
 *    what the provider asserted at link time, retained for audit. They are
 *    never used to identify a provider account, and a later email change at
 *    the provider never invalidates or re-keys the identity.
 *  - No OAuth material is stored here. No access tokens, no refresh tokens, no
 *    id_tokens, no authorization codes, no scopes.
 *
 * Provider-neutral by construction — nothing in this file is Google-specific.
 */
const userIdentitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: SOCIAL_IDENTITY_PROVIDERS,
      immutable: true,
    },
    /** The provider's `sub`. Stored byte-exact; never lowercased or trimmed. */
    subject: {
      type: String,
      required: true,
      immutable: true,
      maxlength: MAX_PROVIDER_SUBJECT_LENGTH,
    },
    emailAtLink: { type: String, trim: true, lowercase: true, default: '' },
    emailVerifiedAtLink: { type: Boolean, default: false },
    linkedAt: { type: Date, required: true, default: () => new Date() },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userIdentitySchema.index({ provider: 1, subject: 1 }, { unique: true });
userIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });

export const UserIdentity = mongoose.model('UserIdentity', userIdentitySchema);
