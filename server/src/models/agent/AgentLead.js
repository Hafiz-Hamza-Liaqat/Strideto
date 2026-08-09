/**
 * AgentLead — lightweight lead / client relationship foundation (Mission 11).
 *
 * A lead arises only through an explicit user action or approved workflow.
 * Agent endpoints CANNOT search/browse all Users.
 *
 * This relationship does NOT grant:
 *   - Student profile access
 *   - Vault document access (requires explicit DocumentAccessGrant)
 *   - Application or journey control
 *
 * Mission 12–14 will expand this foundation.
 */
import mongoose from 'mongoose';
import { AGENT_LEAD_STATUSES } from '../../../../shared/agent/constants.js';

const agentLeadSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // The User who initiated or consented to this lead
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: { type: String, trim: true, maxlength: 100, default: '' },
    context: { type: String, trim: true, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: Object.values(AGENT_LEAD_STATUSES),
      default: AGENT_LEAD_STATUSES.NEW,
      index: true,
    },
  },
  { timestamps: true }
);

// One lead record per (org, user) — prevents duplicate relationship records
agentLeadSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const AgentLead =
  mongoose.models.AgentLead ||
  mongoose.model('AgentLead', agentLeadSchema);
