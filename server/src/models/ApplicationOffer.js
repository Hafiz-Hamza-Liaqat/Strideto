import mongoose from 'mongoose';
import {
  OFFER_COMPENSATION_MAX_LENGTH,
  OFFER_EMPLOYMENT_TYPES,
  OFFER_NOTE_MAX_LENGTH,
  OFFER_STATUSES,
  OFFER_WORK_MODES,
} from '../../../shared/employer/applicationOffer.js';

const applicationOfferSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    status: {
      type: String,
      enum: OFFER_STATUSES,
      default: 'sent',
    },
    startDate: {
      type: Date,
      default: null,
    },
    employmentType: {
      type: String,
      enum: OFFER_EMPLOYMENT_TYPES,
    },
    workMode: {
      type: String,
      enum: OFFER_WORK_MODES,
    },
    compensationText: {
      type: String,
      trim: true,
      default: '',
      maxlength: OFFER_COMPENSATION_MAX_LENGTH,
    },
    offerNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: OFFER_NOTE_MAX_LENGTH,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    createdByEmployerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApplicationOffer',
      default: null,
    },
    clientCommandId: {
      type: String,
      trim: true,
      maxlength: 128,
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

applicationOfferSchema.index({ applicationId: 1, status: 1, createdAt: -1 });
applicationOfferSchema.index(
  { applicationId: 1, clientCommandId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientCommandId: { $type: 'string', $gt: '' },
    },
  }
);

applicationOfferSchema.index(
  { applicationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'sent',
    },
  }
);

export const ApplicationOffer = mongoose.model('ApplicationOffer', applicationOfferSchema);
