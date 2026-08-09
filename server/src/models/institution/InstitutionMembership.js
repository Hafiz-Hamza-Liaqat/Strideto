/**
 * InstitutionMembership — organization membership for the Institution realm (Mission 18).
 *
 * Links an InstitutionAccount to an Organization with a role.
 * Scoped by organizationId — no cross-institution access.
 * Server-side permission checks use this; never trust client-supplied role.
 */
import mongoose from 'mongoose';
import { INSTITUTION_ROLES } from '../../../../shared/institution/institutionPortal.js';

const institutionMembershipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    institutionAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(INSTITUTION_ROLES),
      required: true,
    },
    active: { type: Boolean, default: true, index: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      default: null,
    },
    joinedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      default: null,
    },
  },
  { timestamps: true }
);

// One active membership per account per organization
institutionMembershipSchema.index(
  { organizationId: 1, institutionAccountId: 1 },
  { unique: true }
);
institutionMembershipSchema.index({ organizationId: 1, active: 1, role: 1 });

export const InstitutionMembership =
  mongoose.models.InstitutionMembership ||
  mongoose.model('InstitutionMembership', institutionMembershipSchema);
