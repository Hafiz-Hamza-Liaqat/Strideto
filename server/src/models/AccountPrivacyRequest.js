import mongoose from 'mongoose';
import {
  ACCOUNT_REQUEST_TYPES,
  ACCOUNT_REQUEST_STATUSES,
} from '../../../shared/platform/accountSecurityContract.js';

const accountPrivacyRequestSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ACCOUNT_REQUEST_TYPES),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ACCOUNT_REQUEST_STATUSES),
      default: ACCOUNT_REQUEST_STATUSES.REQUESTED,
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    artifactAvailable: { type: Boolean, default: false },
    auditIdentity: { type: String, trim: true, default: '' },
  },
  { timestamps: true, collection: 'account_privacy_requests' }
);

accountPrivacyRequestSchema.index({ subjectId: 1, type: 1, status: 1 });

export const AccountPrivacyRequest =
  mongoose.models.AccountPrivacyRequest ||
  mongoose.model('AccountPrivacyRequest', accountPrivacyRequestSchema);
