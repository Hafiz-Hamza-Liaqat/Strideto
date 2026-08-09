import mongoose from 'mongoose';
import { WORK_MODES, EMPLOYMENT_STATUSES } from '../../../../shared/career/constants.js';

const salaryExpectationSchema = new mongoose.Schema(
  {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, trim: true, default: '' },
    period: { type: String, trim: true, default: 'monthly' },
  },
  { _id: false }
);

export const careerPreferenceSchema = new mongoose.Schema(
  {
    workMode: { type: String, enum: WORK_MODES, default: 'onsite' },
    preferredMarkets: { type: [String], default: [] },
    preferredIndustries: { type: [String], default: [] },
    preferredCountries: { type: [String], default: [] },
    willingToRelocate: { type: Boolean, default: false },
    salaryExpectation: { type: salaryExpectationSchema, default: () => ({}) },
    employmentStatus: { type: String, enum: EMPLOYMENT_STATUSES, default: 'open_to_work' },
    timeZone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

export const CareerPreference = careerPreferenceSchema;
