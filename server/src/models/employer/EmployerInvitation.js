/**
 * EmployerInvitation — pending organization team invites (Phase 4).
 * Token is stored hashed. Plaintext is returned once at create time.
 */
import mongoose from 'mongoose';
import { EMPLOYER_INVITE_STATUSES, EMPLOYER_ROLES } from '../../../../shared/employer/team.js';

const employerInvitationSchema = new mongoose.Schema(
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
      enum: [EMPLOYER_ROLES.ADMIN, EMPLOYER_ROLES.RECRUITER, EMPLOYER_ROLES.VIEWER],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(EMPLOYER_INVITE_STATUSES),
      default: EMPLOYER_INVITE_STATUSES.PENDING,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      default: null,
    },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      default: null,
    },
  },
  { timestamps: true }
);

employerInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export const EmployerInvitation =
  mongoose.models.EmployerInvitation ||
  mongoose.model('EmployerInvitation', employerInvitationSchema);
