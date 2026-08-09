import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  actorType: { type: String, enum: ['student', 'agent', 'system'], required: true },
  actorId: { type: String, required: true }, fromStatus: { type: String, default: '' }, toStatus: { type: String, required: true },
  reason: { type: String, maxlength: 500, default: '' }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
export const ConsultationEvent = mongoose.models.ConsultationEvent || mongoose.model('ConsultationEvent', schema);
