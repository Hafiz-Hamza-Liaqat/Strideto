import mongoose from 'mongoose';
import { THREAD_STATUSES } from '../../../../shared/services/consultations.js';
const schema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorizedMembershipIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership' }],
  contextType: { type: String, enum: ['consultation'], default: 'consultation', immutable: true },
  status: { type: String, enum: Object.values(THREAD_STATUSES), default: THREAD_STATUSES.OPEN },
  closesAt: { type: Date, default: null },
}, { timestamps: true });
export const ConsultationThread = mongoose.models.ConsultationThread || mongoose.model('ConsultationThread', schema);
