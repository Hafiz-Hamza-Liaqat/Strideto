import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['User', 'Editor', 'Moderator', 'Admin', 'SuperAdmin'],
      default: 'User',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    emailVerified: { type: Boolean, default: false },
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    region: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    province: { type: String, trim: true, default: '' },
    phoneCountry: { type: String, trim: true, uppercase: true, default: '' },
    phoneE164: { type: String, trim: true, default: '' },
    phoneVerified: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date, default: null },
    termsVersion: { type: String, trim: true, default: '' },
    privacyAcknowledgedAt: { type: Date, default: null },
    privacyVersion: { type: String, trim: true, default: '' },
    interests: {
      type: [String],
      default: [],
      // Integration: job/scholarship/admission categories for AI recommendation engine & notification filters
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      telegram: { type: Boolean, default: false },
    },
    /** Mission 1 / Phase 1 category×channel preference map (validated on write). */
    notificationPreferences: { type: mongoose.Schema.Types.Mixed, default: null },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    mustChangePassword: { type: Boolean, default: false },
    tempPasswordExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    savedScholarships: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Scholarship' },
    ],
    savedAdmissions: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Admission' },
    ],
    savedInternships: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' },
    ],
    savedIntlScholarships: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'IntlScholarship' },
    ],
    totalPoints: { type: Number, default: 0 },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    rewardPoints: { type: Number, default: 0 },
    recentlyViewedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    recentlyViewedScholarships: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Scholarship' },
    ],
    recentlyViewedAdmissions: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Admission' },
    ],
    fcmToken: { type: String, select: false },
    preferredLanguage: {
      type: String,
      enum: ['en', 'ur', 'ar'],
      default: 'en',
    },
    /** First-time product tour (Phase B.2) — additive, optional */
    onboardingCompleted: { type: Boolean, default: false },
    onboardingGoal: { type: String, trim: true, default: '' },
    /**
     * Phase B.3 — optional career preference object for future recommendations.
     * Shape: { version, persona, lookingFor[], educationLevel, fieldsOfInterest[],
     * preferredLocations[], experience, careerGoal, notificationPrefs, profilingCompleted, updatedAt }
     */
    careerPreferences: { type: mongoose.Schema.Types.Mixed, default: null },
    // OAuth: googleId, avatar (future GOOGLE_CLIENT_ID integration)
    /**
     * Canonical access-authority version used for global access-token and
     * refresh-session invalidation, as defined in
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
    /**
     * Phase 17D-1 — capability grant schema marker.
     * 0 / missing = not schema-initialized.
     * >= 1 = grants are authoritative, including an intentional empty set.
     */
    capabilitySchemaVersion: {
      type: Number,
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      index: true,
    },
    /**
     * Phase 17D-1R2 — capability-era initialization state.
     * Unset on historical documents = legacy-eligible.
     * No schema default: a default would reclassify historical rows on load.
     * New registration/staff creates must set `pending` explicitly.
     */
    capabilityInitializationState: {
      type: String,
      enum: ['legacy', 'pending', 'ready', 'failed'],
      index: true,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
