import mongoose from 'mongoose';
import {
  GBS_DELIVERY_MODES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PRICING_MODES,
  GBS_SCHEMA_VERSION,
  PROVIDER_SUBJECT_TYPES,
} from '../../../../shared/gbs/constants.js';

const feeLineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true },
    ownership: { type: String, default: 'provider', enum: ['provider'] },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
      index: true,
    },
    subjectId: { type: String, required: true, index: true },
    capabilityId: { type: String, required: true, index: true },
    countryCode: { type: String, required: true, uppercase: true },
    jurisdictionId: { type: String, required: true, index: true },
    entityTypeIds: { type: [String], default: [] },
    title: { type: String, required: true },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    includedItems: { type: [String], default: [] },
    excludedItems: { type: [String], default: [] },
    deliveryMode: {
      type: String,
      enum: Object.values(GBS_DELIVERY_MODES),
      default: GBS_DELIVERY_MODES.REMOTE,
    },
    languages: { type: [String], default: [] },
    pricingMode: {
      type: String,
      enum: Object.values(GBS_PRICING_MODES),
      default: GBS_PRICING_MODES.QUOTE_REQUIRED,
    },
    providerFeeLines: { type: [feeLineSchema], default: [] },
    providerTurnaroundEstimate: { type: Number, default: null },
    turnaroundUnit: { type: String, default: null },
    turnaroundIsProviderEstimate: { type: Boolean, default: true },
    consultationAvailable: { type: Boolean, default: false },
    recurringService: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: Object.values(GBS_LISTING_MODERATION_STATUSES),
      default: GBS_LISTING_MODERATION_STATUSES.DRAFT,
      index: true,
    },
    publicationStatus: {
      type: String,
      enum: Object.values(GBS_LISTING_PUBLICATION_STATUSES),
      default: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
      index: true,
    },
    scope: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskFlags: { type: [String], default: [] },
    contentRevision: { type: Number, default: 1, min: 1 },
    schemaVersion: { type: String, default: GBS_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
    creationCommandId: { type: String, default: null },
  },
  { timestamps: true }
);

schema.index({ subjectType: 1, subjectId: 1, moderationStatus: 1, updatedAt: -1 });
schema.index({ creationCommandId: 1 }, { unique: true, sparse: true });

export const GbsServiceListing = mongoose.model('GbsServiceListing', schema);
