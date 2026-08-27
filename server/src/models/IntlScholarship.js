import mongoose from 'mongoose';

const intlScholarshipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String },
    country: { type: String, required: true },
    university: { type: String },
    universityId: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
    deadline: { type: Date },
    applicationDeadline: { type: Date },
    visaRequirements: { type: String },
    description: { type: String },
    eligibility: [{ type: String }],
    link: { type: String },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'active' },
    isFeatured: { type: Boolean, default: false },
    provider: { type: String },
    fundingType: { type: String },
    degreeLevel: { type: String },
    amount: { type: String },
    seoTitle: { type: String },
    metaDescription: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

intlScholarshipSchema.index({ slug: 1, status: 1 });
intlScholarshipSchema.index({ country: 1, status: 1 });
intlScholarshipSchema.index({ universityId: 1 });
intlScholarshipSchema.index({ deadline: 1 });

export const IntlScholarship = mongoose.model('IntlScholarship', intlScholarshipSchema);
