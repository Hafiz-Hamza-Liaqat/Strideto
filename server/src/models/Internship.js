import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const internshipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    organization: { type: String, required: true },
    location: { type: String },
    province: { type: String },
    duration: { type: String },
    skillset: [{ type: String }],
    description: { type: String },
    applicationLink: { type: String },
    applyInPlatform: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'active' },
    deadline: { type: Date },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPaid: { type: Boolean, default: false },
    paidUntil: { type: Date },
    city: { type: String },
    countryCode: { type: String, trim: true, uppercase: true, maxlength: 2 },
    region: { type: String },
    workMode: { type: String, enum: ['remote', 'hybrid', 'on_site', 'unspecified'], default: 'unspecified' },
    field: { type: String },
    specialization: { type: String },
    applyMethod: { type: String, enum: ['internal', 'external'], default: 'external' },
    compensationUnknown: { type: Boolean, default: false },
    isFixture: { type: Boolean, default: false, index: true },
    dataClass: { type: String, trim: true, lowercase: true },
    environment: { type: String, trim: true, lowercase: true },
    launchEligible: { type: Boolean },
    demoOnly: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    eligibility: [{ type: String }],
    seoTitle: { type: String },
    metaDescription: { type: String },
    internshipType: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

internshipSchema.index({ status: 1, createdAt: -1 });
internshipSchema.index({ province: 1, status: 1 });
internshipSchema.index({ organization: 1 });

internshipSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    const base = slugify(this.title);
    this.slug = base ? `${base}-${(this._id || Date.now()).toString().slice(-6)}` : (this._id || Date.now()).toString();
  }
  next();
});

export const Internship = mongoose.model('Internship', internshipSchema);
