import mongoose from 'mongoose';
import { companySlug } from '../utils/slugify.js';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    industry: { type: String, trim: true, default: '' },
    companySize: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    province: { type: String, trim: true, default: '' },
    // Legacy display field. New records must supply country explicitly; no implicit market.
    country: { type: String, trim: true, default: '' },
    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    socialLinks: {
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
    },
    verified: { type: Boolean, default: false },
    verificationLevel: { type: String, enum: ['basic', 'verified', 'trusted'], default: 'basic' },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer' },
    benefits: [{ type: String }],
    gallery: [{ type: String }],
    officeLocations: [{ city: String, province: String, address: String }],
    status: { type: String, enum: ['draft', 'active'], default: 'active' },
    totalJobsPosted: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    seoTitle: { type: String },
    metaDescription: { type: String },
  },
  { timestamps: true }
);

companySchema.index({ name: 1 });
companySchema.index({ status: 1 });
companySchema.index({ industry: 1, status: 1 });
companySchema.index({ name: 'text', description: 'text' });

companySchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = companySlug(this.name);
  }
  next();
});

export const Company = mongoose.model('Company', companySchema);
