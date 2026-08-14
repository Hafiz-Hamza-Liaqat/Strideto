/**
 * AgentProfile — professional identity for an Agent/Agency (Mission 11).
 *
 * Linked to both an AgentAccount (auth) and an Organization (legal identity).
 * Organization must have organizationType of 'agent' or 'agency'.
 *
 * Self-declared profile fields are clearly separate from verified trust claims.
 * Verified badges are derived from OrganizationVerification evidence by the
 * verification service — never auto-promoted from self-declared data here.
 */
import mongoose from 'mongoose';
import {
  AGENT_TYPES,
  AGENT_PROFILE_STATUSES,
  AGENT_ONBOARDING_STEPS,
} from '../../../../shared/agent/constants.js';

const locationSubSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
  },
  { _id: false }
);

const agentProfileSchema = new mongoose.Schema(
  {
    agentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentAccount',
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    // Agent/Agency type — must match Organization.organizationType
    agentType: {
      type: String,
      enum: Object.values(AGENT_TYPES),
      required: true,
      index: true,
    },

    // Public professional name (may differ from org legalName)
    professionalName: { type: String, trim: true, default: '' },

    // Public slug — unique, stable, drives /agents/:slug route
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },

    // Profile status — controls public visibility
    profileStatus: {
      type: String,
      enum: Object.values(AGENT_PROFILE_STATUSES),
      default: AGENT_PROFILE_STATUSES.DRAFT,
      index: true,
    },

    // Geography
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    serviceCountries: { type: [String], default: [] },
    destinationCountries: { type: [String], default: [] },

    // Languages (ISO 639-1 codes)
    languages: { type: [String], default: [] },

    // Self-declared professional summary
    professionalSummary: { type: String, trim: true, maxlength: 2000, default: '' },

    // Specialties
    specialties: { type: [String], default: [] },

    // Self-declared years of experience — NEVER auto-converts to verified badge
    yearsOfExperience: { type: Number, min: 0, max: 99, default: null },

    // Web / contact
    website: { type: String, trim: true, default: '' },
    officialEmail: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },

    // Office location
    officeLocation: { type: locationSubSchema, default: undefined },

    // Professional credentials references (self-declared; verified copy in OrganizationVerification)
    credentialReferences: { type: [String], default: [] },

    // Profile image / logo — references MediaAsset._id when set
    profileImageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null,
    },

    // Onboarding progress
    onboardingStep: {
      type: String,
      enum: Object.values(AGENT_ONBOARDING_STEPS),
      default: AGENT_ONBOARDING_STEPS.ACCOUNT,
    },
    onboardingSkippedSteps: { type: [String], default: [] },
    onboardingCompletedAt: { type: Date, default: null },

    // Phase 17D-3R: missing/null = legacy education_mobility compatibility only.
    providerDomainInitializationState: {
      type: String,
      enum: ['legacy', 'pending', 'ready'],
      default: undefined,
    },

    // Profile completeness score (0-100) — recomputed on save
    completenessScore: { type: Number, default: 0, min: 0, max: 100 },

    isFixture: { type: Boolean, default: false, index: true },
    dataClass: { type: String, trim: true, lowercase: true },
    environment: { type: String, trim: true, lowercase: true },
    launchEligible: { type: Boolean, index: true },
    demoOnly: { type: Boolean, default: false },
  },
  { timestamps: true }
);

agentProfileSchema.index({ agentType: 1, profileStatus: 1 });
agentProfileSchema.index({ countryCode: 1, profileStatus: 1 });
agentProfileSchema.index({ destinationCountries: 1 });

export const AgentProfile =
  mongoose.models.AgentProfile ||
  mongoose.model('AgentProfile', agentProfileSchema);
