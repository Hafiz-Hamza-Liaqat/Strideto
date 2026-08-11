/**
 * InstitutionClaim — canonical institution claim/ownership workflow (Mission 18).
 *
 * CRITICAL: Institution cannot self-approve. Admin/trust review controls final linkage.
 * A claim does not create a second CanonicalInstitution — it links an Organization
 * to an existing one, or proposes a new canonical record through controlled review.
 *
 * History entries record every state transition for audit.
 */
import mongoose from 'mongoose';
import { CLAIM_STATES } from '../../../../shared/institution/institutionPortal.js';

const claimHistoryEntrySchema = new mongoose.Schema(
  {
    fromState: { type: String, trim: true, default: '' },
    toState: { type: String, trim: true, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    changedByRealm: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const proposedCanonicalSchema = new mongoose.Schema(
  {
    officialName: { type: String, trim: true, default: '' },
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    officialWebsite: { type: String, trim: true, default: '' },
    officialDomain: { type: String, trim: true, lowercase: true, default: '' },
    institutionType: { type: String, trim: true, default: '' },
    isPublic: { type: Boolean, default: null },
  },
  { _id: false }
);

const institutionClaimSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Null when institution proposes a NEW canonical record (not yet created)
    canonicalInstitutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalInstitution',
      default: null,
      index: true,
    },
    // Proposal for a new canonical record when canonicalInstitutionId is null
    proposedCanonical: { type: proposedCanonicalSchema, default: undefined },

    state: {
      type: String,
      enum: Object.values(CLAIM_STATES),
      default: CLAIM_STATES.DRAFT,
      index: true,
    },

    // The InstitutionAccount that represents the institution
    representativeAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      required: true,
    },

    // References to VerificationEvidence records that support authority
    authorityEvidenceRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VerificationEvidence' }],
    // Representative authority evidence URLs collected from the Institution claim form
    authorityEvidenceUrls: [{ type: String, trim: true }],

    // Duplicate detection signals (normalized for search)
    normalizedName: { type: String, trim: true, lowercase: true, default: '' },
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    officialDomain: { type: String, trim: true, lowercase: true, default: '' },

    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedReason: { type: String, trim: true, default: '' },
    informationRequestReason: { type: String, trim: true, default: '' },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Immutable transition history
    history: { type: [claimHistoryEntrySchema], default: [] },

    // Internal notes — never exposed to institution
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// At most one active claim per organization (draft+submitted+under_review+needs_information)
institutionClaimSchema.index({ organizationId: 1, state: 1 });
institutionClaimSchema.index({ canonicalInstitutionId: 1, state: 1 });
institutionClaimSchema.index({ state: 1, submittedAt: 1 });

export const InstitutionClaim =
  mongoose.models.InstitutionClaim ||
  mongoose.model('InstitutionClaim', institutionClaimSchema);
