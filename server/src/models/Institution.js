import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['school', 'college', 'technical_institute', 'training_center'],
      required: true,
    },
    description: { type: String },
    /** Free-text country (legacy schools may omit). */
    country: { type: String },
    city: { type: String },
    province: { type: String },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    website: { type: String },
    imageUrl: { type: String },
    logoUrl: { type: String },
    programs: [{ type: String }],
    facilities: [{ type: String }],
    accreditation: { type: String },
    establishedYear: { type: Number },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'active' },
    seoTitle: { type: String },
    metaDescription: { type: String },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

institutionSchema.index({ type: 1, status: 1 });
institutionSchema.index({ province: 1, city: 1, status: 1 });
institutionSchema.index({ name: 'text', description: 'text', city: 'text' });

institutionSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
  next();
});

export const Institution = mongoose.model('Institution', institutionSchema);
