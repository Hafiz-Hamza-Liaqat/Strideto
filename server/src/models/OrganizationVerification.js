/**
 * OrganizationVerification — per-organization verification lifecycle record.
 *
 * One record per Organization. Tracks:
 *   - The canonical verification status state machine (Mission 2).
 *   - The submitted verification profile (legal identity, registration, etc.).
 *   - SLA metadata (submittedAt, slaDeadlineAt, initialDecisionAt).
 *   - Risk foundation (riskLevel, riskSignals).
 *   - Re-verification fields (verifiedAt, verifiedBy, nextReviewAt, etc.).
 *
 * Evidence records live in VerificationEvidence (separate collection).
 * Transition history lives in VerificationTransition (immutable log).
 *
 * This model does NOT replace the Employer model and does NOT migrate any
 * employer (Employer Release Baseline preserved).
 */
import mongoose from 'mongoose';
import {
  VERIFICATION_STATUSES,
  RISK_LEVELS,
} from '../../../shared/international/verification.js';

const addressSubSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    latitude: { type: Number },
    longitude: { type: Number },
    googleMapsUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const verificationProfileSubSchema = new mongoose.Schema(
  {
    // Legal identity
    legalName: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },

    // International location
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    registeredAddress: { type: addressSubSchema, default: undefined },

    // Contact / web presence
    officialWebsite: { type: String, trim: true, default: '' },
    officialDomain: { type: String, trim: true, lowercase: true, default: '' },
    officialEmail: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },

    // Legal registration
    registrationNumber: { type: String, trim: true, default: '' },
    registrationAuthority: { type: String, trim: true, default: '' },
    registrationCountry: { type: String, trim: true, uppercase: true, default: '' },

    taxIdentifier: { type: String, trim: true, default: '' },
    organizationCategory: { type: String, trim: true, default: '' },
    profession: { type: String, trim: true, default: '' },
    credentialType: { type: String, trim: true, default: '' },

    officialRegistryUrl: { type: String, trim: true, default: '' },
    governmentRegistryUrl: { type: String, trim: true, default: '' },
    professionalRegulatorUrl: { type: String, trim: true, default: '' },
    accreditationPageUrl: { type: String, trim: true, default: '' },
    googleBusinessUrl: { type: String, trim: true, default: '' },

    // License / credential (where applicable)
    licenseNumber: { type: String, trim: true, default: '' },
    licenseIssuer: { type: String, trim: true, default: '' },
    licenseJurisdiction: { type: String, trim: true, default: '' },
    licenseIssuedAt: { type: Date },
    licenseExpiresAt: { type: Date },

    // Accreditation (universities, colleges, institutes)
    accreditationBody: { type: String, trim: true, default: '' },
    accreditationNumber: { type: String, trim: true, default: '' },
    accreditationExpiresAt: { type: Date },

    // Authorized representative
    authorizedRepresentative: { type: String, trim: true, default: '' },
    representativeRole: { type: String, trim: true, default: '' },
    representativeAuthorizationRef: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const riskSignalSubSchema = new mongoose.Schema(
  {
    signal: { type: String, trim: true },
    detail: { type: String, trim: true, default: '' },
    detectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orgVerificationSchema = new mongoose.Schema(
  {
    // Link to the Organization record (one-to-one, required)
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },

    // Organization type (denormalized for queue filtering without a join)
    organizationType: { type: String, trim: true, index: true },

    // Country (denormalized for queue filtering)
    countryCode: { type: String, trim: true, uppercase: true, index: true },

    // Canonical verification status
    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUSES),
      default: VERIFICATION_STATUSES.DRAFT,
      index: true,
    },

    // Submitted profile data
    profile: { type: verificationProfileSubSchema, default: undefined },

    // SLA timestamps
    submittedAt: { type: Date },
    slaDeadlineAt: { type: Date },
    initialDecisionAt: { type: Date },

    // Review tracking
    currentReviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastReviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true, default: '' },
    rejectionReason: { type: String, trim: true, default: '' },
    informationRequestReason: { type: String, trim: true, default: '' },

    // Risk
    riskLevel: {
      type: String,
      enum: Object.values(RISK_LEVELS),
      default: RISK_LEVELS.LOW,
      index: true,
    },
    riskSignals: { type: [riskSignalSubSchema], default: [] },

    // Re-verification / expiry
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nextReviewAt: { type: Date },
    credentialExpiresAt: { type: Date },
    verificationVersion: { type: Number, default: 1 },

    // Derived badge cache (recomputed from evidence, never client-authoritative)
    earnedBadges: { type: [String], default: [] },
  },
  { timestamps: true }
);

orgVerificationSchema.index({ status: 1, riskLevel: 1 });
orgVerificationSchema.index({ status: 1, organizationType: 1 });
orgVerificationSchema.index({ status: 1, submittedAt: 1 });
orgVerificationSchema.index({ slaDeadlineAt: 1 });

export const OrganizationVerification = mongoose.model(
  'OrganizationVerification',
  orgVerificationSchema
);
