import mongoose from 'mongoose';
import {
  INTERVIEW_EMPLOYER_NOTE_MAX_LENGTH,
  INTERVIEW_INVITATION_METHODS,
  INTERVIEW_INVITATION_STATUSES,
} from '../../../shared/employer/applicationCommunication.js';

const applicationInterviewInvitationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    timeZone: {
      type: String,
      trim: true,
      required: true,
    },
    durationMinutes: {
      type: Number,
      min: 0,
      default: null,
    },
    method: {
      type: String,
      enum: INTERVIEW_INVITATION_METHODS,
      default: 'video',
    },
    location: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    meetingUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    employerNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: INTERVIEW_EMPLOYER_NOTE_MAX_LENGTH,
    },
    status: {
      type: String,
      enum: INTERVIEW_INVITATION_STATUSES,
      default: 'pending',
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
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
      ref: 'ApplicationInterviewInvitation',
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

applicationInterviewInvitationSchema.index({ applicationId: 1, status: 1, createdAt: -1 });

export const ApplicationInterviewInvitation = mongoose.model(
  'ApplicationInterviewInvitation',
  applicationInterviewInvitationSchema
);
