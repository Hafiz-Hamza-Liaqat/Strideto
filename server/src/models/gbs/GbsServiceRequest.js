import mongoose from 'mongoose';
import {
  GBS_SERVICE_REQUEST_ACTING_FOR,
  GBS_SERVICE_REQUEST_SCHEMA_VERSION,
  GBS_SERVICE_REQUEST_STATUSES,
  PROVIDER_SUBJECT_TYPES,
} from '../../../../shared/gbs/constants.js';

const schema = new mongoose.Schema(
  {
    publicRequestRef: {
      type: String,
      required: true,
    },
    creationCommandId: {
      type: String,
      required: true,
    },
    requesterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsServiceListing',
      required: true,
      index: true,
    },
    listingSlugSnapshot: { type: String, required: true },
    providerSubjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
    },
    providerSubjectId: { type: String, required: true },
    capabilityId: { type: String, required: true },
    countryCode: { type: String, required: true, uppercase: true },
    jurisdictionId: { type: String, required: true },
    entityTypeId: { type: String, default: null },
    titleSnapshot: { type: String, required: true },
    capabilityPublicNameSnapshot: { type: String, default: '' },
    jurisdictionNameSnapshot: { type: String, default: '' },
    providerDisplayNameSnapshot: { type: String, default: '' },
    providerKindSnapshot: { type: String, default: 'independent' },
    actingFor: {
      type: String,
      required: true,
      enum: Object.values(GBS_SERVICE_REQUEST_ACTING_FOR),
    },
    existingBusinessName: { type: String, default: null },
    customerSummary: { type: String, required: true },
    preferredLanguage: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: Object.values(GBS_SERVICE_REQUEST_STATUSES),
      default: GBS_SERVICE_REQUEST_STATUSES.SUBMITTED,
      index: true,
    },
    declineReasonCode: { type: String, default: null },
    declineNote: { type: String, default: null },
    providerTransitionNote: { type: String, default: null },
    recordVersion: { type: Number, required: true, default: 0 },
    schemaVersion: { type: String, default: GBS_SERVICE_REQUEST_SCHEMA_VERSION },
    providerReviewingAt: { type: Date, default: null },
    providerDecisionAt: { type: Date, default: null },
    requesterCancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index(
  { publicRequestRef: 1 },
  { unique: true, name: 'gbs_service_request_public_ref_unique' }
);
schema.index(
  { creationCommandId: 1 },
  { unique: true, sparse: true, name: 'gbs_service_request_creation_command_unique' }
);
schema.index(
  { requesterUserId: 1, createdAt: -1 },
  { name: 'gbs_service_request_requester_created' }
);
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, status: 1, createdAt: -1 },
  { name: 'gbs_service_request_provider_inbox' }
);
schema.index(
  { listingId: 1, createdAt: -1 },
  { name: 'gbs_service_request_listing_created' }
);

export const GbsServiceRequest = mongoose.model('GbsServiceRequest', schema);
