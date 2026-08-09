/**
 * CountryEducation — country education intelligence shell (Mission 4).
 *
 * Informational only. No legal advice, no visa eligibility decisions.
 * High-stakes facts must be source-backed.
 * Architecture is global (ISO 3166-1 country codes).
 */
import mongoose from 'mongoose';
import { PUB_STATUSES, educationSlug } from '../../../../shared/education/taxonomy.js';

const evidenceSubSchema = new mongoose.Schema(
  {
    sourceType: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    publisher: { type: String, trim: true, default: '' },
    retrievedAt: { type: Date },
    verifiedAt: { type: Date },
    evidenceRef: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const countryEducationSchema = new mongoose.Schema(
  {
    // ISO 3166-1 alpha-2. Canonical; validated at the service layer.
    countryCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    educationOverview: { type: String, trim: true, default: '' },
    // Common academic intake seasons (e.g. ["September", "February"]).
    commonIntakes: { type: [String], default: [] },
    educationAuthorityName: { type: String, trim: true, default: '' },
    educationAuthorityUrl: { type: String, trim: true, default: '' },
    generalApplicationResourceUrl: { type: String, trim: true, default: '' },
    immigrationAuthorityName: { type: String, trim: true, default: '' },
    immigrationAuthorityUrl: { type: String, trim: true, default: '' },
    informationalNotes: { type: String, trim: true, default: '' },
    sources: { type: [evidenceSubSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
  },
  { timestamps: true }
);

countryEducationSchema.index({ status: 1 });

countryEducationSchema.pre('save', function (next) {
  if (!this.slug && this.countryCode) {
    this.slug = educationSlug(this.countryCode);
  }
  next();
});

export const CountryEducation = mongoose.model('CountryEducation', countryEducationSchema);
