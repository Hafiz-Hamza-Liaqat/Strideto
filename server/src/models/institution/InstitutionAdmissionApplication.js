/**
 * InstitutionAdmissionApplication — internal Strideto admission submissions.
 *
 * Institution receives only the consented snapshot. Never grants Vault, Copilot,
 * Budget, unrelated applications, or Agent case access.
 */
import mongoose from 'mongoose';
import {
  ADMISSION_STATES,
  CONSENT_SCOPES,
} from '../../../../shared/institution/institutionPortal.js';

const historySchema = new mongoose.Schema(
  {
    fromState: { type: String, trim: true, default: '' },
    toState: { type: String, trim: true, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    changedByRealm: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const snapshotSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    nationality: { type: String, trim: true, default: '' },
    countryOfResidence: { type: String, trim: true, uppercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    highestQualification: { type: String, trim: true, default: '' },
    intendedProgramNote: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const institutionAdmissionApplicationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    canonicalInstitutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CanonicalInstitution',
      default: null,
      index: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    intakeCycleLabel: { type: String, trim: true, default: '' },
    studentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ADMISSION_STATES),
      default: ADMISSION_STATES.RECEIVED,
      index: true,
    },
    consentScope: {
      type: String,
      enum: Object.values(CONSENT_SCOPES),
      default: CONSENT_SCOPES.ADMISSION_APPLICATION,
    },
    consentedAt: { type: Date, required: true },
    snapshot: { type: snapshotSchema, default: () => ({}) },
    missingInformation: { type: [String], default: [] },
    informationRequestNote: { type: String, trim: true, default: '' },
    studentResponse: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: Date.now, index: true },
    history: { type: [historySchema], default: [] },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

institutionAdmissionApplicationSchema.index({ organizationId: 1, status: 1, submittedAt: -1 });
institutionAdmissionApplicationSchema.index({ studentUserId: 1, submittedAt: -1 });
institutionAdmissionApplicationSchema.index(
  { organizationId: 1, programId: 1, studentUserId: 1, intakeCycleLabel: 1 },
  { unique: true }
);

export const InstitutionAdmissionApplication =
  mongoose.models.InstitutionAdmissionApplication ||
  mongoose.model('InstitutionAdmissionApplication', institutionAdmissionApplicationSchema);
