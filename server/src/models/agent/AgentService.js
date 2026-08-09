/**
 * AgentService — professional services offered by an Agent/Agency (Mission 11).
 *
 * Services are in draft until approved verification. Active services are
 * publicly visible only when the parent organization has approved status.
 *
 * Mission 11 establishes pricing mode foundation only — no payment execution.
 * Mission 16/17 owns real pricing/payment.
 *
 * IMPORTANT: guarantee-language is rejected at the service layer.
 * No service may claim guaranteed visa, admission, scholarship, or job.
 */
import mongoose from 'mongoose';
import {
  AGENT_SERVICE_CATEGORIES,
  AGENT_SERVICE_PRICING_MODES,
  AGENT_SERVICE_STATUSES,
  AGENT_SERVICE_DELIVERY_MODES,
  AGENT_JOURNEY_TYPES,
} from '../../../../shared/agent/constants.js';

const agentServiceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    agentProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentProfile',
      required: true,
      index: true,
    },

    title: { type: String, trim: true, required: true, maxlength: 200 },
    slug: { type: String, trim: true, lowercase: true, index: true },

    category: {
      type: String,
      enum: Object.values(AGENT_SERVICE_CATEGORIES),
      required: true,
    },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    eligibilityNotes: { type: String, trim: true, maxlength: 2000, default: '' },

    // Geography
    countriesServed: { type: [String], default: [] },
    destinationCountries: { type: [String], default: [] },

    // Journey and delivery
    journeyType: {
      type: String,
      enum: Object.values(AGENT_JOURNEY_TYPES),
      default: AGENT_JOURNEY_TYPES.OTHER,
    },
    deliveryMode: {
      type: String,
      enum: Object.values(AGENT_SERVICE_DELIVERY_MODES),
      default: AGENT_SERVICE_DELIVERY_MODES.ONLINE,
    },

    // Pricing mode — no payment execution in Mission 11
    pricingMode: {
      type: String,
      enum: Object.values(AGENT_SERVICE_PRICING_MODES),
      default: AGENT_SERVICE_PRICING_MODES.CONTACT_FOR_DETAILS,
    },

    // Optional duration
    durationEstimate: { type: String, trim: true, maxlength: 200, default: '' },

    status: {
      type: String,
      enum: Object.values(AGENT_SERVICE_STATUSES),
      default: AGENT_SERVICE_STATUSES.DRAFT,
      index: true,
    },
  },
  { timestamps: true }
);

agentServiceSchema.index({ organizationId: 1, status: 1 });
agentServiceSchema.index({ category: 1, status: 1 });

export const AgentService =
  mongoose.models.AgentService ||
  mongoose.model('AgentService', agentServiceSchema);
