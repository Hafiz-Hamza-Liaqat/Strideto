/**
 * TestProvider — canonical test organization (Mission 4).
 *
 * Represents the body that owns and administers a test (e.g. ETS for TOEFL,
 * British Council / IDP for IELTS). Additive; does not touch existing Exam.
 */
import mongoose from 'mongoose';
import { educationSlug } from '../../../../shared/education/taxonomy.js';

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

const testProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    organizationType: { type: String, trim: true, default: '' },
    officialWebsite: { type: String, trim: true, default: '' },
    // ISO 3166-1 alpha-2 country where the organization is headquartered.
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    region: { type: String, trim: true, default: '' },
    registrationUrl: { type: String, trim: true, default: '' },
    helpUrl: { type: String, trim: true, default: '' },
    sources: { type: [evidenceSubSchema], default: [] },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

testProviderSchema.index({ status: 1 });
testProviderSchema.index({ countryCode: 1 });

testProviderSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = educationSlug(this.name);
  }
  next();
});

export const TestProvider = mongoose.model('TestProvider', testProviderSchema);
