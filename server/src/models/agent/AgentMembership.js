/**
 * AgentMembership — agency team membership (Mission 11).
 *
 * Links an AgentAccount to an Organization (agency) with a role.
 * An agency member must never access another agency's resources.
 * Organization-scoping is enforced server-side on every query.
 */
import mongoose from 'mongoose';
import { AGENT_MEMBER_ROLES } from '../../../../shared/agent/constants.js';

const agentMembershipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    agentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentAccount',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(AGENT_MEMBER_ROLES),
      required: true,
      default: AGENT_MEMBER_ROLES.MEMBER,
    },
    active: { type: Boolean, default: true, index: true },
    invitedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: null },
    domainAccess: {
      type: [
        {
          domainId: { type: String, required: true },
          permissions: { type: [String], default: [] },
        },
      ],
      default: undefined,
    },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Unique: one membership record per (org, account) pair
agentMembershipSchema.index({ organizationId: 1, agentAccountId: 1 }, { unique: true });
agentMembershipSchema.index({ organizationId: 1, role: 1, active: 1 });

export const AgentMembership =
  mongoose.models.AgentMembership ||
  mongoose.model('AgentMembership', agentMembershipSchema);
