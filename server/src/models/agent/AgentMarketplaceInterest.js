import mongoose from 'mongoose';
import { MARKETPLACE_INTEREST_STATUSES } from '../../../../shared/agent/marketplace.js';
const schema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMarketplacePost', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: Object.values(MARKETPLACE_INTEREST_STATUSES), default: MARKETPLACE_INTEREST_STATUSES.ACTIVE },
  consentedAt: { type: Date, required: true }, withdrawnAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ postId: 1, userId: 1 }, { unique: true });
export const AgentMarketplaceInterest = mongoose.models.AgentMarketplaceInterest || mongoose.model('AgentMarketplaceInterest', schema);
