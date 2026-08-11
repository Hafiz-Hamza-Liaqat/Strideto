/**
 * InstitutionInvitation — pending Institution team invites (Phase 6).
 * Token is stored hashed. Plaintext is returned once at create time.
 * No real email delivery.
 */
import mongoose from 'mongoose';
import {
  INSTITUTION_INVITE_STATUSES,
  INSTITUTION_INVITABLE_ROLES,
} from '../../../../shared/institution/institutionPortal.js';

const institutionInvitationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    role: {
      type: String,
      enum: INSTITUTION_INVITABLE_ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(INSTITUTION_INVITE_STATUSES),
      default: INSTITUTION_INVITE_STATUSES.PENDING,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      default: null,
    },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      default: null,
    },
  },
  { timestamps: true }
);

institutionInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export const InstitutionInvitation =
  mongoose.models.InstitutionInvitation ||
  mongoose.model('InstitutionInvitation', institutionInvitationSchema);
