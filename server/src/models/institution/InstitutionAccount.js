/**
 * InstitutionAccount — authentication credentials for the Institution realm (Mission 18).
 *
 * Auth subject only: email, password, tokenVersion, accountStatus.
 * Organization linkage lives in InstitutionMembership.
 * Mirrors AgentAccount credential shape so shared auth services operate on it.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const institutionAccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0, min: 0 },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    termsVersion: { type: String, trim: true, default: '' },
    privacyAcknowledgedAt: { type: Date, default: null },
    privacyVersion: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

institutionAccountSchema.pre('save', async function hashPwd() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

institutionAccountSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export const InstitutionAccount =
  mongoose.models.InstitutionAccount ||
  mongoose.model('InstitutionAccount', institutionAccountSchema);
