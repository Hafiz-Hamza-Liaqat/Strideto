import mongoose from 'mongoose';
import {
  APPLICATION_MESSAGE_MAX_LENGTH,
  APPLICATION_MESSAGE_SENDER_ROLES,
  APPLICATION_MESSAGE_TYPES,
} from '../../../shared/employer/applicationCommunication.js';

const applicationMessageSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: APPLICATION_MESSAGE_SENDER_ROLES,
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    messageType: {
      type: String,
      enum: APPLICATION_MESSAGE_TYPES,
      default: 'message',
    },
    body: {
      type: String,
      required: true,
      maxlength: APPLICATION_MESSAGE_MAX_LENGTH,
      trim: true,
    },
    interviewInvitationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApplicationInterviewInvitation',
      default: null,
    },
    applicationOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApplicationOffer',
      default: null,
    },
    clientMessageId: {
      type: String,
      trim: true,
      maxlength: 128,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    autoIndex: false,
  }
);

applicationMessageSchema.index(
  { applicationId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientMessageId: { $type: 'string', $gt: '' },
    },
  }
);

applicationMessageSchema.index({ applicationId: 1, createdAt: 1, _id: 1 });

export const ApplicationMessage = mongoose.model('ApplicationMessage', applicationMessageSchema);
