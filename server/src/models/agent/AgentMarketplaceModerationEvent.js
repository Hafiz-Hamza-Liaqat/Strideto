import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMarketplacePost', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  fromStatus: { type: String, required: true }, toStatus: { type: String, required: true },
  action: { type: String, required: true }, reason: { type: String, trim: true, maxlength: 2000, default: '' },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true }, actorRealm: { type: String, enum: ['agent', 'admin'], required: true },
}, { timestamps: true });
schema.index({ postId: 1, createdAt: 1 });
export const AgentMarketplaceModerationEvent = mongoose.models.AgentMarketplaceModerationEvent || mongoose.model('AgentMarketplaceModerationEvent', schema);
