import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const employerSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    companyDescription: { type: String, trim: true, default: '' },
    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    industry: { type: String, trim: true, default: '' },
    companySize: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    province: { type: String, trim: true, default: '' },
    socialLinks: {
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
    },
    password: { type: String, required: true, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    verified: { type: Boolean, default: false },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    verificationLevel: {
      type: String,
      enum: ['basic', 'verified', 'trusted'],
      default: 'basic',
    },
    totalJobsPosted: { type: Number, default: 0 },
    isPublicProfile: { type: Boolean, default: true },
    /**
     * SEC-3B — additive, dormant field. Not yet read, incremented, or
     * enforced by any live code path; reserved for the future access-token
     * invalidation contract defined in
     * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md.
     */
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'tokenVersion must be an integer',
      },
    },
  },
  { timestamps: true }
);

employerSchema.index({ companyName: 1 });

employerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

employerSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const Employer = mongoose.model('Employer', employerSchema);
