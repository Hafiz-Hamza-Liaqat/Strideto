/**
 * EmployerMembership — organization team for the Employer realm (Phase 4).
 * Server-derived role. Never trust a client-supplied role.
 */
import mongoose from 'mongoose';
import { EMPLOYER_ROLES } from '../../../../shared/employer/team.js';

const employerMembershipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(EMPLOYER_ROLES),
      required: true,
    },
    active: { type: Boolean, default: true, index: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      default: null,
    },
    joinedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      default: null,
    },
  },
  { timestamps: true }
);

employerMembershipSchema.index({ organizationId: 1, employerId: 1 }, { unique: true });
employerMembershipSchema.index({ employerId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });
employerMembershipSchema.index({ organizationId: 1, active: 1, role: 1 });

export const EmployerMembership =
  mongoose.models.EmployerMembership ||
  mongoose.model('EmployerMembership', employerMembershipSchema);
