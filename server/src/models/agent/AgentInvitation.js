/**
 * AgentInvitation — pending agency team invites (Phase 5).
 * Token is stored hashed. Plaintext is returned once at create time.
 */
import mongoose from 'mongoose';
import { AGENT_INVITE_STATUSES, AGENT_INVITABLE_ROLES } from '../../../../shared/agent/team.js';

const agentInvitationSchema = new mongoose.Schema(
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
      enum: AGENT_INVITABLE_ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AGENT_INVITE_STATUSES),
      default: AGENT_INVITE_STATUSES.PENDING,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentAccount',
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentAccount',
      default: null,
    },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentAccount',
      default: null,
    },
  },
  { timestamps: true }
);

agentInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export const AgentInvitation =
  mongoose.models.AgentInvitation ||
  mongoose.model('AgentInvitation', agentInvitationSchema);
