import mongoose from 'mongoose';
import { NOTIFICATION_EVENT_STATUSES } from '../../../../shared/services/consultations.js';
const schema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
  recipientActorType: { type: String, enum: ['student', 'agent'], required: true }, recipientId: { type: String, required: true },
  eventType: { type: String, required: true, maxlength: 80 }, category: { type: String, enum: ['appointments', 'consultant_messages'], required: true },
  scheduledAt: { type: Date, default: null }, timezone: { type: String, required: true },
  status: { type: String, enum: Object.values(NOTIFICATION_EVENT_STATUSES), default: NOTIFICATION_EVENT_STATUSES.PENDING },
  deliveryAttempted: { type: Boolean, default: false, immutable: true },
}, { timestamps: true });
schema.index({ status: 1, scheduledAt: 1 });
export const ConsultationNotificationEvent = mongoose.models.ConsultationNotificationEvent || mongoose.model('ConsultationNotificationEvent', schema);
