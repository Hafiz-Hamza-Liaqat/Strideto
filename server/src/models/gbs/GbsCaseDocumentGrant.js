import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  GBS_DOCUMENT_GRANT_GRANTEE_TYPES,
  GBS_DOCUMENT_GRANT_STATUSES,
} from '../../../../shared/gbs/caseDocumentContract.js';

const schema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsCase',
      required: true,
    },
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsCaseDocumentRequirement',
      required: true,
    },
    vaultDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocument',
      required: true,
    },
    vaultVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VaultDocumentVersion',
      required: true,
    },
    granteeType: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_GRANT_GRANTEE_TYPES),
    },
    granteeSubjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
    },
    granteeSubjectId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(GBS_DOCUMENT_GRANT_STATUSES),
      default: GBS_DOCUMENT_GRANT_STATUSES.ACTIVE,
    },
    scanStatusAtGrant: { type: String, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'gbs_case_document_grants' }
);

schema.index(
  { requirementId: 1, vaultVersionId: 1, granteeSubjectId: 1 },
  { unique: true, name: 'gbs_case_doc_grant_version_subject_unique' }
);
schema.index({ caseId: 1, status: 1 }, { name: 'gbs_case_doc_grant_case_status' });

export const GbsCaseDocumentGrant = mongoose.model('GbsCaseDocumentGrant', schema);
