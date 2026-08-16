/**
 * High-assurance Case filing authorization (Phase 17D-9A).
 * Dedicated collection. Do not reuse ConsentGrant.
 */
import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  FILING_AUTHORIZATION_INVALIDATION_REASONS,
  FILING_AUTHORIZATION_PURPOSE,
  FILING_AUTHORIZATION_STATUSES,
  GBS_FILING_AUTHORIZATION_SCHEMA_VERSION,
} from '../../../../shared/gbs/filingAuthorizationContract.js';

const schema = new mongoose.Schema(
  {
    publicAuthorizationRef: { type: String, required: true },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GbsCase',
      required: true,
    },
    casePublicRef: { type: String, required: true },
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
    providerDisplayNameSnapshot: { type: String, default: '' },
    capabilityId: { type: String, required: true },
    jurisdictionId: { type: String, required: true },
    entityTypeId: { type: String, default: null },
    packId: { type: String, required: true },
    packVersion: { type: Number, required: true },
    schemaVersion: { type: String, required: true, default: GBS_FILING_AUTHORIZATION_SCHEMA_VERSION },
    packSchemaVersion: { type: String, default: null },
    sourceSetId: { type: String, required: true },
    sourceSnapshotHash: { type: String, required: true },
    legalTextId: { type: String, required: true },
    legalTextVersion: { type: Number, required: true },
    legalTextHash: { type: String, required: true },
    purpose: {
      type: String,
      required: true,
      enum: Object.values(FILING_AUTHORIZATION_PURPOSE),
      default: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
    },
    scope: {
      kind: { type: String, required: true, default: 'initial_formation_external_filing' },
      oneTime: { type: Boolean, required: true, default: true },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(FILING_AUTHORIZATION_STATUSES),
      default: FILING_AUTHORIZATION_STATUSES.ACTIVE,
    },
    grantedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    invalidatedAt: { type: Date, default: null },
    invalidationReasonCode: {
      type: String,
      default: null,
      enum: [...Object.values(FILING_AUTHORIZATION_INVALIDATION_REASONS), null],
    },
    claimedAt: { type: Date, default: null },
    claimRef: { type: String, default: null },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    recordVersion: { type: Number, required: true, default: 0, min: 0 },
    retentionClass: { type: String, required: true, default: 'filing_consent' },
  },
  {
    timestamps: true,
    collection: 'gbs_case_filing_authorizations',
    autoIndex: false,
  }
);

schema.index({ publicAuthorizationRef: 1 }, { unique: true, name: 'gbs_filing_auth_public_ref_unique' });
schema.index({ caseId: 1, createdAt: -1 }, { name: 'gbs_filing_auth_case_history' });
schema.index(
  { providerSubjectType: 1, providerSubjectId: 1, caseId: 1 },
  { name: 'gbs_filing_auth_provider_case' }
);
schema.index(
  {
    caseId: 1,
    providerSubjectType: 1,
    providerSubjectId: 1,
    packId: 1,
    packVersion: 1,
    sourceSnapshotHash: 1,
    purpose: 1,
  },
  {
    unique: true,
    name: 'gbs_filing_auth_effective_unique',
    partialFilterExpression: {
      status: { $in: ['active', 'claimed_for_submission', 'used'] },
    },
  }
);
schema.index({ caseId: 1, status: 1 }, { name: 'gbs_filing_auth_case_status' });
schema.index({ claimRef: 1 }, { unique: true, sparse: true, name: 'gbs_filing_auth_claim_ref_unique' });

export const GbsCaseFilingAuthorization = mongoose.model(
  'GbsCaseFilingAuthorization',
  schema
);
