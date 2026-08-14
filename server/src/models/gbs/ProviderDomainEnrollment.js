/**
 * ProviderDomainEnrollment — exact-subject professional-area configuration.
 *
 * Agent self enrollment ≠ Agency enrollment.
 * Selecting a domain never grants professional verification.
 */
import mongoose from 'mongoose';
import { PROVIDER_SUBJECT_TYPES } from '../../../../shared/gbs/constants.js';
import {
  PROVIDER_DOMAIN_ENROLLMENT_STATUSES,
  PROVIDER_DOMAIN_ONBOARDING_STATUSES,
  PROVIDER_DOMAIN_SCHEMA_VERSION,
  isKnownProviderDomainId,
} from '../../../../shared/provider/providerDomains.js';

const schema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_SUBJECT_TYPES),
    },
    subjectId: { type: String, required: true },
    domainId: {
      type: String,
      required: true,
      validate: {
        validator: isKnownProviderDomainId,
        message: 'unknown_provider_domain',
      },
    },
    status: {
      type: String,
      enum: Object.values(PROVIDER_DOMAIN_ENROLLMENT_STATUSES),
      default: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP,
    },
    onboardingStatus: {
      type: String,
      enum: Object.values(PROVIDER_DOMAIN_ONBOARDING_STATUSES),
      default: PROVIDER_DOMAIN_ONBOARDING_STATUSES.PENDING,
    },
    selectedAt: { type: Date, default: Date.now },
    selectedBy: { type: String, default: '' },
    schemaVersion: { type: String, default: PROVIDER_DOMAIN_SCHEMA_VERSION },
    recordVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

schema.index({ subjectType: 1, subjectId: 1, domainId: 1 }, { unique: true });
schema.index({ subjectType: 1, subjectId: 1, status: 1 });

export const ProviderDomainEnrollment =
  mongoose.models.ProviderDomainEnrollment ||
  mongoose.model('ProviderDomainEnrollment', schema);
