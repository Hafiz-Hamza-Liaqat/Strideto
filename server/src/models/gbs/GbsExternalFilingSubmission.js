/**
 * Provider-attested external filing provenance (Phase 17D-9A).
 * Manual external filing only. Not government acceptance.
 */
import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  EXTERNAL_FILING_AUTHORITY_IDS,
  EXTERNAL_FILING_METHODS,
  EXTERNAL_SUBMISSION_STATUSES,
  GBS_EXTERNAL_FILING_SCHEMA_VERSION,
} from '../../../../shared/gbs/externalFilingContract.js';

const schema = new mongoose.Schema(
  {
    publicSubmissionRef: { type: String, required: true },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsCase',
      required: true,
    },
    casePublicRef: { type: String, required: true },
    authorizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsCaseFilingAuthorization',
      required: true,
    },
    publicAuthorizationRef: { type: String, required: true },
    customerUserId: {
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
    providerActorUserId: { type: String, default: null },
    providerActorAgentAccountId: { type: String, default: null },
    capabilityId: { type: String, required: true },
    jurisdictionId: { type: String, required: true },
    entityTypeId: { type: String, default: null },
    packId: { type: String, required: true },
    packVersion: { type: Number, required: true },
    sourceSetId: { type: String, required: true },
    sourceSnapshotHash: { type: String, required: true },
    legalTextId: { type: String, required: true },
    legalTextVersion: { type: Number, required: true },
    legalTextHash: { type: String, required: true },
    filingMethod: {
      type: String,
      required: true,
      enum: Object.values(EXTERNAL_FILING_METHODS),
    },
    authorityId: {
      type: String,
      required: true,
      enum: Object.values(EXTERNAL_FILING_AUTHORITY_IDS),
    },
    submissionStatus: {
      type: String,
      required: true,
      enum: Object.values(EXTERNAL_SUBMISSION_STATUSES),
      default: EXTERNAL_SUBMISSION_STATUSES.SUBMITTED_EXTERNALLY,
    },
    providerAttestedAt: { type: Date, required: true },
    externalSubmittedAt: { type: Date, default: null },
    optionalProviderReference: { type: String, default: null },
    evidenceRef: { type: String, default: null },
    recordVersion: { type: Number, required: true, default: 0, min: 0 },
    schemaVersion: { type: String, required: true, default: GBS_EXTERNAL_FILING_SCHEMA_VERSION },
    retentionClass: { type: String, required: true, default: 'submitted_filing_evidence' },
  },
  {
    timestamps: true,
    collection: 'gbs_external_filing_submissions',
    autoIndex: false,
  }
);

schema.index({ publicSubmissionRef: 1 }, { unique: true, name: 'gbs_ext_filing_public_ref_unique' });
schema.index({ authorizationId: 1 }, { unique: true, name: 'gbs_ext_filing_authorization_unique' });
schema.index({ caseId: 1, authorizationId: 1 }, { name: 'gbs_ext_filing_case_auth' });
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, caseId: 1 },
  { name: 'gbs_ext_filing_provider_case' }
);

export const GbsExternalFilingSubmission = mongoose.model(
  'GbsExternalFilingSubmission',
  schema
);
