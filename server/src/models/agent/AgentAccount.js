/**
 * AgentAccount — authentication credentials for the Agent realm (Mission 11).
 *
 * This is the auth subject only: email, password, tokenVersion, accountStatus.
 * Professional identity lives in AgentProfile; organization linkage is there too.
 *
 * Mirrors the Employer model's credential shape so the shared
 * AccountSecurityMutationService can operate on it with the 'agent' realm.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const agentAccountSchema = new mongoose.Schema(
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
    /**
     * Incremented on every security-mutation (password change, suspend, etc.).
     * Mirrors the pattern used by User and Employer models.
     */
    tokenVersion: { type: Number, default: 0, min: 0 },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
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

agentAccountSchema.pre('save', async function hashPwd() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

agentAccountSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export const AgentAccount =
  mongoose.models.AgentAccount ||
  mongoose.model('AgentAccount', agentAccountSchema);
