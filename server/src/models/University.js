import mongoose from 'mongoose';
import { universitySlug } from '../utils/slugify.js';
import { translationFieldDefinition, applySlugLocaleIndex, ensureTranslationGroupHook } from './mixins/translationFields.js';

const universitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, sparse: true },
    country: { type: String, required: true },
    city: { type: String, default: '' },
    province: { type: String, default: '' },
    website: { type: String },
    description: { type: String },
    logoUrl: { type: String, default: '' },
    ranking: { type: Number },
    type: { type: String, enum: ['public', 'private', 'semi-government', 'other'], default: 'public' },
    programs: [{ name: String, degree: String, duration: String }],
    gallery: [{ type: String }],
    reviewSummary: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'active'], default: 'active' },
    isFeatured: { type: Boolean, default: false },
    bannerUrl: { type: String, default: '' },
    establishedYear: { type: Number },
    contact: { type: String, default: '' },
    socialLinks: {
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
    },
    seoTitle: { type: String },
    metaDescription: { type: String },
    ...translationFieldDefinition,
  },
  { timestamps: true }
);

universitySchema.index({ country: 1 });
universitySchema.index({ name: 1 });
universitySchema.index({ name: 'text', description: 'text' });
applySlugLocaleIndex(universitySchema);
ensureTranslationGroupHook(universitySchema);

universitySchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = universitySlug(this.name);
  }
  next();
});

export const University = mongoose.model('University', universitySchema);
