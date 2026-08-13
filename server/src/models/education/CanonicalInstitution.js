/**
 * CanonicalInstitution — international institution foundation (Mission 4).
 *
 * Reuses the Organization pattern from Mission 1/2 (countryCode, status,
 * slug conventions). Supports university, college, institute, school,
 * training_center, other.
 *
 * Existing University and Institution models are unchanged (additive).
 * organizationId links to the Mission 1/2 Organization record when present.
 * Mission 18 will build Institution Portal/claiming on top.
 */
import mongoose from 'mongoose';
import {
  INSTITUTION_TYPES,
  PUB_STATUSES,
  educationSlug,
} from '../../../../shared/education/taxonomy.js';

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

const canonicalInstitutionSchema = new mongoose.Schema(
  {
    officialName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // ISO 3166-1 alpha-2; validated at service layer.
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    city: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    officialWebsite: { type: String, trim: true, default: '' },
    officialDomain: { type: String, trim: true, lowercase: true, default: '' },
    institutionType: {
      type: String,
      enum: Object.values(INSTITUTION_TYPES),
      required: true,
      index: true,
    },
    // null = not yet determined / not applicable.
    isPublic: { type: Boolean, default: null },
    // Link to Mission 1/2 Organization record when migrated (future use).
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      sparse: true,
      unique: true,
    },
    sources: { type: [evidenceSubSchema], default: [] },
    isFixture: { type: Boolean, default: false, index: true },
    dataClass: { type: String, trim: true, lowercase: true },
    environment: { type: String, trim: true, lowercase: true },
    launchEligible: { type: Boolean, index: true },
    demoOnly: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
  },
  { timestamps: true }
);

canonicalInstitutionSchema.index({ countryCode: 1, status: 1 });
canonicalInstitutionSchema.index({ institutionType: 1, status: 1 });
canonicalInstitutionSchema.index({ officialName: 'text' });

canonicalInstitutionSchema.pre('save', function (next) {
  if (!this.slug && this.officialName) {
    this.slug = educationSlug(this.officialName);
  }
  next();
});

export const CanonicalInstitution = mongoose.model('CanonicalInstitution', canonicalInstitutionSchema);
