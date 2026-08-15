import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  GBS_QUOTE_SCHEMA_VERSION,
  QUOTE_STATUSES,
  QUOTE_STATUSES_EMITTED,
} from '../../../../shared/gbs/quoteContract.js';

const professionalLineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true },
    ownership: { type: String, default: 'provider', enum: ['provider'] },
    category: { type: String, default: 'provider_service', enum: ['provider_service'] },
  },
  { _id: false }
);

const officialLineSchema = new mongoose.Schema(
  {
    feeId: { type: String, required: true },
    label: { type: String, required: true },
    currency: { type: String, default: null },
    amountMinor: { type: Number, default: null },
    amountModel: { type: String, required: true },
    cadence: { type: String, default: null },
    sourceId: { type: String, default: null },
    sourceVersion: { type: Number, default: null },
    ownership: { type: String, default: 'government', enum: ['government'] },
    category: { type: String, default: 'official_government', enum: ['official_government'] },
    listed: { type: Boolean, default: false },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  { _id: false }
);

const officialGroupSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true, uppercase: true },
    amountMinor: { type: Number, required: true },
  },
  { _id: false }
);

const listingFeeSnapshotSchema = new mongoose.Schema(
  {
    kind: { type: String, default: null },
    amountMinor: { type: Number, default: null },
    minAmountMinor: { type: Number, default: null },
    maxAmountMinor: { type: Number, default: null },
    currency: { type: String, default: null },
    label: { type: String, default: '' },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    publicQuoteRef: { type: String, required: true },
    creationCommandId: { type: String, required: true },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsServiceRequest',
      required: true,
    },
    requestPublicRefSnapshot: { type: String, required: true },
    requesterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerSubjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
    },
    providerSubjectId: { type: String, required: true },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsServiceListing',
      required: true,
    },
    capabilityId: { type: String, required: true },
    jurisdictionId: { type: String, required: true },
    countryCode: { type: String, required: true, uppercase: true },
    entityTypeId: { type: String, default: null },
    quoteRevision: { type: Number, required: true, min: 1, default: 1 },
    status: {
      type: String,
      required: true,
      enum: QUOTE_STATUSES_EMITTED,
      default: QUOTE_STATUSES.DRAFT,
    },
    currency: { type: String, default: null, uppercase: true },
    professionalFeeLines: { type: [professionalLineSchema], default: [] },
    officialFeeLines: { type: [officialLineSchema], default: [] },
    thirdPartyFeeLines: { type: [mongoose.Schema.Types.Mixed], default: [] },
    subtotalProfessionalMinor: { type: Number, default: null },
    officialFeeGroups: { type: [officialGroupSchema], default: [] },
    totalCustomerAmountMinor: { type: Number, default: null },
    includedItemsSnapshot: { type: [String], default: [] },
    excludedItemsSnapshot: { type: [String], default: [] },
    listingPricingModeSnapshot: { type: String, default: null },
    listingProfessionalFeeSnapshot: { type: listingFeeSnapshotSchema, default: null },
    titleSnapshot: { type: String, default: '' },
    capabilityPublicNameSnapshot: { type: String, default: '' },
    jurisdictionNameSnapshot: { type: String, default: '' },
    providerDisplayNameSnapshot: { type: String, default: '' },
    providerKindSnapshot: { type: String, default: 'independent' },
    actingForSnapshot: { type: String, default: null },
    existingBusinessNameSnapshot: { type: String, default: null },
    preferredLanguageSnapshot: { type: String, default: null },
    customerSummarySnapshot: { type: String, default: '' },
    providerTerms: { type: String, default: '' },
    providerTurnaroundEstimateSnapshot: { type: Number, default: null },
    turnaroundIsProviderEstimate: { type: Boolean, default: true },
    recurringServiceSnapshot: { type: Boolean, default: false },
    validForDays: { type: Number, default: 7, min: 1, max: 30 },
    expiresAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    declineReasonCode: { type: String, default: null },
    declineNote: { type: String, default: null },
    recordVersion: { type: Number, required: true, default: 0, min: 0 },
    schemaVersion: { type: String, default: GBS_QUOTE_SCHEMA_VERSION },
  },
  { timestamps: true }
);

schema.index({ publicQuoteRef: 1 }, { unique: true, name: 'gbs_quote_public_ref_unique' });
schema.index(
  { creationCommandId: 1 },
  { unique: true, sparse: true, name: 'gbs_quote_creation_command_unique' }
);
schema.index(
  { serviceRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['draft', 'sent'] } },
    name: 'gbs_quote_active_slot_unique',
  }
);
schema.index({ requesterUserId: 1, createdAt: -1 }, { name: 'gbs_quote_requester_created' });
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, status: 1, createdAt: -1 },
  { name: 'gbs_quote_provider_inbox' }
);
schema.index({ status: 1, expiresAt: 1 }, { name: 'gbs_quote_status_expires' });

export const GbsQuote = mongoose.model('GbsQuote', schema);
