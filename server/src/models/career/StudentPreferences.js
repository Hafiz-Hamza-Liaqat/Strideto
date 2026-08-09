import mongoose from 'mongoose';
import { STUDY_MODES, FUNDING_PREFERENCES, QUALIFICATION_LEVELS } from '../../../../shared/career/studentProfile.js';

export const studentPreferencesSchema = new mongoose.Schema(
  {
    // ISO 3166-1 alpha-2 country codes
    destinationCountries: { type: [String], default: [] },
    preferredCities: { type: [String], default: [] },
    fieldsOfStudy: { type: [String], default: [] },
    // From QUALIFICATION_LEVELS
    degreeLevels: { type: [String], default: [] },
    targetIntake: { type: String, trim: true, default: '' },
    targetYear: { type: Number, default: null },
    studyMode: { type: String, enum: [...STUDY_MODES, ''], default: '' },
    scholarshipRequired: { type: Boolean, default: false },
    fundingPreference: { type: String, enum: [...FUNDING_PREFERENCES, ''], default: '' },
    // ISO 4217 preferred currency for costs/display
    preferredCurrency: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

export const StudentPreferences = studentPreferencesSchema;
