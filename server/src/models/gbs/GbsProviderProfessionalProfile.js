/**
 * Business Formation provider professional presentation (product-separated).
 *
 * Additive and subject-scoped. Never writes AgentProfile / Education fields.
 * Capabilities, jurisdictions, and listings remain authoritative elsewhere.
 */
import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';

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

const schema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
    },
    subjectId: { type: String, required: true },
    displayName: { type: String, trim: true, default: '' },
    publicEmail: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    officeLocation: { type: locationSubSchema, default: undefined },
    serviceCountries: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    professionalSummary: { type: String, trim: true, maxlength: 2000, default: '' },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, autoIndex: false }
);

schema.index({ subjectType: 1, subjectId: 1 }, { unique: true });

export const GbsProviderProfessionalProfile =
  mongoose.models.GbsProviderProfessionalProfile
  || mongoose.model('GbsProviderProfessionalProfile', schema);
