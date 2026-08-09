import mongoose from 'mongoose';
import { MESSAGE_TYPES } from '../../../../shared/services/consultations.js';
const schema = new mongoose.Schema({
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationThread', required: true, index: true },
  senderActorType: { type: String, enum: ['student', 'agent', 'system'], required: true },
  senderId: { type: String, required: true },
  messageType: { type: String, enum: Object.values(MESSAGE_TYPES), required: true },
  text: { type: String, maxlength: 4000, default: '' },
  documentReference: { documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VaultDocument', default: null }, grantId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentAccessGrant', default: null }, displayName: { type: String, maxlength: 200, default: '' } },
  readBy: [{ actorKey: { type: String, required: true }, readAt: { type: Date, required: true } }],
  moderationStatus: { type: String, enum: ['active', 'hidden'], default: 'active' }, editedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ threadId: 1, createdAt: -1 });
export const ConsultationMessage = mongoose.models.ConsultationMessage || mongoose.model('ConsultationMessage', schema);
