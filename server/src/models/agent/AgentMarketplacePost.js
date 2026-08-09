import mongoose from 'mongoose';
import {
  MARKETPLACE_POST_TYPES, MARKETPLACE_PUBLICATION_STATUSES,
  MARKETPLACE_MODERATION_STATUSES, MARKETPLACE_CONTENT_KINDS,
  MARKETPLACE_REFERENCE_TYPES,
} from '../../../../shared/agent/marketplace.js';
import { FRESHNESS_STATES } from '../../../../shared/trust/sourceVerification.js';

const factualClaimSchema = new mongoose.Schema({
  claimKey: { type: String, trim: true, required: true, maxlength: 100 },
  statement: { type: String, trim: true, required: true, maxlength: 1000 },
  sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalSource' }],
}, { _id: false });

const canonicalReferenceSchema = new mongoose.Schema({
  referenceType: { type: String, enum: Object.values(MARKETPLACE_REFERENCE_TYPES), required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { _id: false });

const postSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  authorAgentAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentAccount', required: true, index: true },
  postType: { type: String, enum: Object.values(MARKETPLACE_POST_TYPES), required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 200 },
  slug: { type: String, trim: true, lowercase: true, required: true, unique: true, index: true },
  summary: { type: String, trim: true, required: true, maxlength: 600 },
  contentKind: { type: String, enum: Object.values(MARKETPLACE_CONTENT_KINDS), default: MARKETPLACE_CONTENT_KINDS.AGENT_STATEMENT },
  agentStatement: { type: String, trim: true, required: true, maxlength: 5000 },
  factualClaims: { type: [factualClaimSchema], default: [] },
  canonicalReferences: { type: [canonicalReferenceSchema], default: [] },
  relatedAgentServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentService', default: null },
  targetCountries: { type: [String], default: [] },
  destinationCountries: { type: [String], default: [], index: true },
  degreeCategories: { type: [String], default: [] },
  careerCategories: { type: [String], default: [] },
  journeyCategories: { type: [String], default: [], index: true },
  languages: { type: [String], default: [] },
  sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalSource' }],
  sourceFreshnessState: { type: String, enum: Object.values(FRESHNESS_STATES), default: FRESHNESS_STATES.UNKNOWN, index: true },
  publicationStatus: { type: String, enum: Object.values(MARKETPLACE_PUBLICATION_STATUSES), default: MARKETPLACE_PUBLICATION_STATUSES.DRAFT, index: true },
  moderationStatus: { type: String, enum: Object.values(MARKETPLACE_MODERATION_STATUSES), default: MARKETPLACE_MODERATION_STATUSES.NOT_SUBMITTED, index: true },
  moderationFeedback: { type: String, trim: true, maxlength: 2000, default: '' },
  policySignals: { type: [String], default: [] },
  effectiveAt: { type: Date, default: null },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null, index: true },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

postSchema.index({ organizationId: 1, publicationStatus: 1, moderationStatus: 1 });
postSchema.index({ postType: 1, destinationCountries: 1, publicationStatus: 1 });
export const AgentMarketplacePost = mongoose.models.AgentMarketplacePost || mongoose.model('AgentMarketplacePost', postSchema);
