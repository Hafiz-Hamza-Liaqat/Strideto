import mongoose from 'mongoose';
import { PROVIDER_DOMAIN_IDS } from '../../../../shared/provider/providerDomains.js';

/**
 * One-time Education Marketplace free promotional entitlement.
 * Scoped to exact Provider subject + education_mobility domain.
 * Team members share Agency subject entitlement — never per-member.
 */
const ENTITLEMENT_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  CONSUMED: 'consumed',
});

const schema = new mongoose.Schema({
  providerSubjectType: {
    type: String,
    enum: ['agent', 'organization'],
    required: true,
  },
  providerSubjectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  domainId: {
    type: String,
    enum: [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY],
    default: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
    required: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(ENTITLEMENT_STATUSES),
    default: ENTITLEMENT_STATUSES.AVAILABLE,
    index: true,
  },
  consumedAt: { type: Date, default: null },
  consumedByPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentMarketplacePost',
    default: null,
  },
  publishedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

// Unique invariant: one free Education promotion entitlement per exact Provider subject/domain.
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, domainId: 1 },
  { unique: true, name: 'edu_marketplace_free_entitlement_subject_unique' }
);

export const EDUCATION_FREE_PROMO_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const EDUCATION_FREE_ENTITLEMENT_STATUSES = ENTITLEMENT_STATUSES;

export const AgentEducationMarketplaceFreeEntitlement = mongoose.models.AgentEducationMarketplaceFreeEntitlement
  || mongoose.model('AgentEducationMarketplaceFreeEntitlement', schema);
