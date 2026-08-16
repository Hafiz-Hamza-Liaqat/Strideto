import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  GBS_CASE_DOCUMENT_SCHEMA_VERSION,
  GBS_DOCUMENT_REQUIREMENT_STATUSES,
  GBS_DOCUMENT_REVIEW_STATES,
  GBS_DOCUMENT_SENSITIVITY,
  GBS_DOCUMENT_TYPES,
  GBS_DOCUMENT_WHO_PROVIDES,
} from '../../../../shared/gbs/caseDocumentContract.js';

const schema = new mongoose.Schema(
  {
    publicRequirementRef: { type: String, required: true },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsCase',
      required: true,
    },
    publicCaseRefSnapshot: { type: String, required: true },
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
    requirementKey: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'operational' },
    required: { type: Boolean, default: true },
    conditional: { type: Boolean, default: false },
    documentType: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_TYPES),
    },
    acceptedMimeTypes: { type: [String], default: undefined },
    maxFiles: { type: Number, default: 1, min: 1 },
    maxFileSize: { type: Number, required: true },
    sensitivityClass: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_SENSITIVITY),
    },
    whoProvides: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_WHO_PROVIDES),
    },
    reviewRequired: { type: Boolean, default: true },
    filingRequired: { type: Boolean, default: false },
    consentRequired: { type: Boolean, default: false },
    waivable: { type: Boolean, default: false },
    templateId: { type: String, required: true },
    templateVersion: { type: Number, required: true, min: 1 },
    requirementVersion: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_REQUIREMENT_STATUSES),
      default: GBS_DOCUMENT_REQUIREMENT_STATUSES.AWAITING_UPLOAD,
    },
    reviewState: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_REVIEW_STATES),
      default: GBS_DOCUMENT_REVIEW_STATES.NONE,
    },
    scanStatus: { type: String, default: 'not_configured' },
    activeVaultDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocument',
      default: null,
    },
    activeVaultVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocumentVersion',
      default: null,
    },
    activeVaultVersionNumber: { type: Number, default: null },
    waivedAt: { type: Date, default: null },
    waiverReason: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    recordVersion: { type: Number, required: true, default: 0, min: 0 },
    schemaVersion: { type: String, default: GBS_CASE_DOCUMENT_SCHEMA_VERSION },
    testOnly: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'gbs_case_document_requirements' }
);

schema.index({ publicRequirementRef: 1 }, { unique: true, name: 'gbs_case_doc_req_public_ref_unique' });
schema.index(
  { caseId: 1, requirementKey: 1 },
  { unique: true, name: 'gbs_case_doc_req_case_key_unique' }
);
schema.index({ caseId: 1, status: 1 }, { name: 'gbs_case_doc_req_case_status' });
schema.index({ requesterUserId: 1, createdAt: -1 }, { name: 'gbs_case_doc_req_requester' });

export const GbsCaseDocumentRequirement = mongoose.model('GbsCaseDocumentRequirement', schema);
