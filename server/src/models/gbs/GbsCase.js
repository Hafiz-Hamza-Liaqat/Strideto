import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  CASE_MILESTONES,
  CASE_STATUSES_EMITTED,
  CASE_TASK_INPUT_TYPES,
  CASE_TASK_STATUSES,
  CASE_TASK_TYPES,
  CASE_TIMELINE_ACTORS,
  CASE_TIMELINE_EVENT_TYPES,
  CASE_WORKFLOW_TEMPLATES,
  GBS_CASE_SCHEMA_VERSION,
} from '../../../../shared/gbs/caseContract.js';

const taskSchema = new mongoose.Schema(
  {
    publicTaskRef: { type: String, required: true },
    taskKey: { type: String, required: true },
    type: { type: String, required: true, enum: Object.values(CASE_TASK_TYPES) },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      required: true,
      enum: Object.values(CASE_TASK_STATUSES),
      default: CASE_TASK_STATUSES.OPEN,
    },
    required: { type: Boolean, default: false },
    customerInputType: {
      type: String,
      required: true,
      enum: Object.values(CASE_TASK_INPUT_TYPES),
      default: CASE_TASK_INPUT_TYPES.NONE,
    },
    choices: { type: [String], default: undefined },
    customerValue: { type: String, default: '' },
    createdByActorType: { type: String, required: true, enum: Object.values(CASE_TIMELINE_ACTORS) },
    completedByActorType: { type: String, default: null, enum: [...Object.values(CASE_TIMELINE_ACTORS), null] },
    createdAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, enum: Object.values(CASE_TIMELINE_EVENT_TYPES) },
    actorType: { type: String, required: true, enum: Object.values(CASE_TIMELINE_ACTORS) },
    at: { type: Date, required: true },
    taskKey: { type: String, default: null },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },
    milestoneKey: { type: String, default: null },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    publicCaseRef: { type: String, required: true },
    creationCommandId: { type: String, required: true },
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsQuote',
      required: true,
    },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsServiceRequest',
      required: true,
    },
    publicQuoteRefSnapshot: { type: String, required: true },
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
    workflowTemplateKey: {
      type: String,
      required: true,
      enum: Object.values(CASE_WORKFLOW_TEMPLATES),
    },
    status: {
      type: String,
      required: true,
      enum: CASE_STATUSES_EMITTED,
      default: 'open',
    },
    currentMilestoneKey: {
      type: String,
      required: true,
      enum: Object.values(CASE_MILESTONES),
      default: CASE_MILESTONES.CASE_OPENED,
    },
    titleSnapshot: { type: String, default: '' },
    capabilityPublicNameSnapshot: { type: String, default: '' },
    jurisdictionNameSnapshot: { type: String, default: '' },
    providerDisplayNameSnapshot: { type: String, default: '' },
    providerKindSnapshot: { type: String, default: 'independent' },
    actingForSnapshot: { type: String, default: null },
    existingBusinessNameSnapshot: { type: String, default: null },
    preferredLanguageSnapshot: { type: String, default: null },
    customerSummarySnapshot: { type: String, default: '' },
    proposedBusinessName: { type: String, default: null },
    customerTasks: { type: [taskSchema], default: [] },
    timelineEvents: { type: [timelineSchema], default: [] },
    cancelReasonCode: { type: String, default: null },
    unableReasonCode: { type: String, default: null },
    recordVersion: { type: Number, required: true, default: 0, min: 0 },
    schemaVersion: { type: String, default: GBS_CASE_SCHEMA_VERSION },
    openedAt: { type: Date, required: true },
    preparationStartedAt: { type: Date, default: null },
    readyForSubmissionAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    unableToProceedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ publicCaseRef: 1 }, { unique: true, name: 'gbs_case_public_ref_unique' });
schema.index(
  { creationCommandId: 1 },
  { unique: true, sparse: true, name: 'gbs_case_creation_command_unique' }
);
schema.index({ quoteId: 1 }, { unique: true, name: 'gbs_case_quote_unique' });
schema.index({ requesterUserId: 1, createdAt: -1 }, { name: 'gbs_case_requester_created' });
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, status: 1, updatedAt: -1 },
  { name: 'gbs_case_provider_inbox' }
);
schema.index({ status: 1, updatedAt: -1 }, { name: 'gbs_case_status_updated' });

export const GbsCase = mongoose.model('GbsCase', schema);
