import mongoose from 'mongoose';
import { GBS_MESSAGE_ACTOR_TYPES } from '../../../../shared/gbs/contextMessaging.js';

const schema = new mongoose.Schema({
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'GbsContextThread', required: true },
  senderActorType: { type: String, required: true, enum: Object.values(GBS_MESSAGE_ACTOR_TYPES) },
  senderActorId: { type: String, required: true },
  text: { type: String, required: true, maxlength: 4000 },
}, { timestamps: true, autoIndex: false });

schema.index({ threadId: 1, createdAt: -1, _id: -1 }, { name: 'gbs_context_message_thread_created' });

export const GbsContextMessage = mongoose.model('GbsContextMessage', schema);
