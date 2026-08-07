import mongoose from 'mongoose';
import { APPLICATION_CONTACT_ROLES } from '../../../../shared/career/constants.js';

export const applicationContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    role: { type: String, enum: APPLICATION_CONTACT_ROLES, default: 'recruiter' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    organization: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

export const interviewScheduleSchema = new mongoose.Schema(
  {
    scheduledAt: { type: Date, default: null },
    // PF-EMP-INT-B3B: the IANA zone the appointment was booked in, so candidate-facing
    // messages can be rendered as the wall clock the Employer intended instead of in
    // whatever zone the API container runs. Empty on every pre-B3B record; readers
    // fall back to a labelled UTC rather than inferring a region.
    timeZone: { type: String, trim: true, default: '' },
    mode: { type: String, trim: true, default: 'video' },
    location: { type: String, trim: true, default: '' },
    meetingUrl: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    outcome: { type: String, trim: true, default: '' },
  },
  { _id: false }
);
