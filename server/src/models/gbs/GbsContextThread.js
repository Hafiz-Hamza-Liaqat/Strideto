import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import { GBS_MESSAGE_CONTEXT_TYPES } from '../../../../shared/gbs/contextMessaging.js';

const schema = new mongoose.Schema({
  contextType: { type: String, required: true, enum: Object.values(GBS_MESSAGE_CONTEXT_TYPES) },
  contextId: { type: mongoose.Schema.Types.ObjectId, required: true },
  contextPublicRef: { type: String, required: true },
  requesterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerSubjectType: { type: String, required: true, enum: Object.values(PROVIDER_SUBJECT_TYPES) },
  providerSubjectId: { type: String, required: true },
  titleSnapshot: { type: String, default: '' },
  lastMessageAt: { type: Date, required: true },
}, { timestamps: true, autoIndex: false });

schema.index({ contextType: 1, contextId: 1 }, { unique: true, name: 'gbs_message_thread_context_unique' });
schema.index({ requesterUserId: 1, lastMessageAt: -1 }, { name: 'gbs_message_thread_customer_inbox' });
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, lastMessageAt: -1 },
  { name: 'gbs_message_thread_provider_inbox' }
);

export const GbsContextThread = mongoose.model('GbsContextThread', schema);
