import mongoose from 'mongoose';
import {
  GOAL_TYPES,
  QUALIFICATION_LEVELS,
  STUDY_MODES,
  FUNDING_PREFERENCES,
} from '../../../../shared/career/studentProfile.js';

export const studyGoalSchema = new mongoose.Schema(
  {
    goalType: { type: String, enum: GOAL_TYPES, default: 'study' },
    degreeLevel: { type: String, enum: [...QUALIFICATION_LEVELS, ''], default: '' },
    fieldOfStudy: { type: String, trim: true, default: '' },
    // ISO 3166-1 alpha-2 codes
    destinationCountries: { type: [String], default: [] },
    targetIntake: { type: String, trim: true, default: '' },
    targetYear: { type: Number, default: null },
    studyMode: { type: String, enum: [...STUDY_MODES, ''], default: '' },
    scholarshipPreference: { type: String, enum: [...FUNDING_PREFERENCES, ''], default: '' },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

export const StudyGoal = studyGoalSchema;
