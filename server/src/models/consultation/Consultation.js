import mongoose from 'mongoose';
import { CONSULTATION_PAYMENT_STATES, CONSULTATION_STATUSES, CONSULTATION_TYPES, MEETING_MODES } from '../../../../shared/services/consultations.js';

const schema = new mongoose.Schema({
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  assignedMembershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership', required: true, index: true },
  agentServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentService', required: true, index: true },
  marketplacePostId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMarketplacePost', default: null, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentLead', default: null },
  consultationType: { type: String, enum: Object.values(CONSULTATION_TYPES), default: CONSULTATION_TYPES.INITIAL },
  status: { type: String, enum: Object.values(CONSULTATION_STATUSES), default: CONSULTATION_STATUSES.REQUESTED, index: true },
  requestedWindow: { start: { type: Date, required: true }, end: { type: Date, required: true } },
  confirmedStart: { type: Date, default: null }, durationMinutes: { type: Number, min: 15, max: 480, required: true },
  timezone: { type: String, required: true },
  meetingMode: { type: String, enum: Object.values(MEETING_MODES), required: true },
  meetingMetadata: { link: { type: String, maxlength: 1000, default: '' }, location: { type: String, maxlength: 500, default: '' }, dialIn: { type: String, maxlength: 300, default: '' } },
  purpose: { type: String, trim: true, maxlength: 300, required: true },
  studentNote: { type: String, trim: true, maxlength: 2000, default: '' },
  agentNote: { type: String, trim: true, maxlength: 2000, default: '' },
  paymentState: { type: String, enum: Object.values(CONSULTATION_PAYMENT_STATES), required: true },
  cancellation: { actorType: { type: String, default: '' }, reason: { type: String, maxlength: 500, default: '' }, cancelledAt: { type: Date, default: null } },
  completion: { completedAt: { type: Date, default: null }, outcomeNote: { type: String, maxlength: 1000, default: '' } },
  verificationState: { type: String, default: 'approved' },
}, { timestamps: true });
schema.index({ assignedMembershipId: 1, confirmedStart: 1, status: 1 });
schema.index({ studentUserId: 1, createdAt: -1 });
export const Consultation = mongoose.models.Consultation || mongoose.model('Consultation', schema);
