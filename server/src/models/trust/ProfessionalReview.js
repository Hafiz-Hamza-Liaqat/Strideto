import mongoose from 'mongoose';
import { RATING_DIMENSIONS, REVIEW_INTERACTIONS, REVIEW_STATUSES } from '../../../../shared/services/professionalTrust.js';

const responseSchema = new mongoose.Schema({ body: { type: String, maxlength: 1500 }, membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership' }, createdAt: Date, updatedAt: Date }, { _id: false });
const schema = new mongoose.Schema({
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership', default: null }, interactionType: { type: String, enum: REVIEW_INTERACTIONS, required: true }, interactionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  rating: { type: Number, min: 1, max: 5, required: true }, dimensions: { type: Map, of: { type: Number, min: 1, max: 5 }, default: {} }, title: { type: String, maxlength: 120, default: '' }, body: { type: String, minlength: 10, maxlength: 4000, required: true },
  status: { type: String, enum: REVIEW_STATUSES, default: 'published', index: true }, verifiedInteraction: { type: Boolean, required: true, immutable: true, default: true }, publishedAt: { type: Date, default: Date.now }, response: { type: responseSchema, default: null },
  integrityFlags: { type: [String], default: [], select: false }, moderation: { reason: { type: String, maxlength: 500, default: '', select: false }, reviewedBy: { type: mongoose.Schema.Types.ObjectId, select: false }, reviewedAt: { type: Date, default: null, select: false } },
}, { timestamps: true, collection: 'professional_reviews' });
schema.index({ studentUserId: 1, interactionType: 1, interactionId: 1 }, { unique: true });
schema.path('dimensions').validate((value) => [...value.keys()].every((key) => RATING_DIMENSIONS.includes(key)), 'Unsupported rating dimension');
export const ProfessionalReview = mongoose.models.ProfessionalReview || mongoose.model('ProfessionalReview', schema);
