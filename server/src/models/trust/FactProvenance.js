/**
 * FactProvenance — claim/fact → source provenance record (Mission 5).
 *
 * Links an important factual field on any entity to one or more CanonicalSources,
 * carrying the verification lifecycle, freshness metadata, and publication policy.
 *
 * One FactProvenance document per (entityType, entityId, claimKey) claim at any
 * point in time. When a fact is superseded, the old record is marked SUPERSEDED
 * and a new one created.
 *
 * adminNotes is internal and must never be projected to public endpoints.
 */
import mongoose from 'mongoose';
import {
  VERIFICATION_STATUSES,
  FRESHNESS_STATES,
  PUBLICATION_POLICY_TYPES,
  SOURCE_STATUS,
} from '../../../../shared/trust/sourceVerification.js';

const factProvenanceSchema = new mongoose.Schema(
  {
    // ── Target entity ─────────────────────────────────────────────────────────
    // e.g. 'Test', 'TestProvider', 'CanonicalInstitution', 'Program',
    //      'CountryEducation', 'TestPrepGuide', 'ExternalTestResource', 'TestAlert'
    targetEntityType: { type: String, required: true, trim: true, index: true },
    targetEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // ── Claim key ─────────────────────────────────────────────────────────────
    // The field/fact being sourced, e.g. 'scoreRange', 'testFee', 'registrationDeadline'
    claimKey: { type: String, required: true, trim: true },

    // ── Sources ───────────────────────────────────────────────────────────────
    // References to CanonicalSource records. A claim may have multiple sources.
    sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalSource' }],

    // Opaque fingerprint/digest of the claimed value at time of verification.
    // Not the raw value — prevents storing sensitive fact data in the provenance record.
    claimedValueFingerprint: { type: String, trim: true, default: '' },

    // ── Verification lifecycle ────────────────────────────────────────────────
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      default: VERIFICATION_STATUSES.UNVERIFIED,
      index: true,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes: { type: String, trim: true, default: '' },

    // ── Supersession ─────────────────────────────────────────────────────────
    supersededById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FactProvenance',
    },

    // ── Publication policy ────────────────────────────────────────────────────
    policyType: {
      type: String,
      enum: Object.values(PUBLICATION_POLICY_TYPES),
      default: PUBLICATION_POLICY_TYPES.HIGH_VALUE_FACTUAL,
    },

    // ── Freshness ─────────────────────────────────────────────────────────────
    // Cached freshness state; should be recomputed when timestamps change.
    freshnessState: {
      type: String,
      enum: Object.values(FRESHNESS_STATES),
      default: FRESHNESS_STATES.UNKNOWN,
      index: true,
    },
    // Data type key for configurable review intervals (e.g. 'test_policy', 'institution_identity')
    dataType: { type: String, trim: true, default: 'source_default' },
    lastVerifiedAt: { type: Date, index: true },
    nextReviewAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Compound indexes for admin freshness queue and uniqueness of active claims
factProvenanceSchema.index({ targetEntityType: 1, targetEntityId: 1, claimKey: 1 });
factProvenanceSchema.index({ verificationStatus: 1, freshnessState: 1 });
factProvenanceSchema.index({ nextReviewAt: 1, verificationStatus: 1 });

export const FactProvenance = mongoose.model('FactProvenance', factProvenanceSchema);
