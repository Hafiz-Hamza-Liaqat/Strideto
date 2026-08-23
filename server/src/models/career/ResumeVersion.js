import mongoose from 'mongoose';
import { RESUME_VERSION_STATUSES, RESUME_TEMPLATES } from '../../../../shared/career/constants.js';

const resumeSnapshotSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true, default: '' },
    headline: { type: String, trim: true, default: '' },
    summary: { type: String, trim: true, default: '' },
    education: { type: mongoose.Schema.Types.Mixed, default: [] },
    experience: { type: mongoose.Schema.Types.Mixed, default: [] },
    skills: { type: mongoose.Schema.Types.Mixed, default: [] },
    languages: { type: mongoose.Schema.Types.Mixed, default: [] },
    certifications: { type: mongoose.Schema.Types.Mixed, default: [] },
    projects: { type: mongoose.Schema.Types.Mixed, default: [] },
    socialProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Additional Resume Builder sections not owned by TalentProfile canonical schema
    references: { type: mongoose.Schema.Types.Mixed, default: [] },
    awards: { type: mongoose.Schema.Types.Mixed, default: [] },
    volunteerExperience: { type: mongoose.Schema.Types.Mixed, default: [] },
    publications: { type: mongoose.Schema.Types.Mixed, default: [] },
    interests: { type: mongoose.Schema.Types.Mixed, default: [] },
    professionalMemberships: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { _id: false }
);

const resumeVersionSchema = new mongoose.Schema(
  {
    talentProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'TalentProfile', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, default: 'My Resume' },
    template: { type: String, enum: RESUME_TEMPLATES, default: 'modern-professional' },
    status: { type: String, enum: RESUME_VERSION_STATUSES, default: 'draft' },
    isPrimary: { type: Boolean, default: false },
    sourceVersion: { type: Number, default: 1 },
    marketTag: { type: String, trim: true, default: '' },
    locale: { type: String, trim: true, default: 'en' },
    snapshot: { type: resumeSnapshotSchema, default: () => ({}) },
    legacyResumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
  },
  { timestamps: true }
);

resumeVersionSchema.index({ talentProfileId: 1, createdAt: -1 });
resumeVersionSchema.index({ userId: 1, isPrimary: 1 });
resumeVersionSchema.index({ talentProfileId: 1, isPrimary: 1 });

export const ResumeVersion = mongoose.model('ResumeVersion', resumeVersionSchema);
