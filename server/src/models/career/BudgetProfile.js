import mongoose from 'mongoose';
import { BUDGET_PERIODS, FUNDING_SOURCE_TYPES } from '../../../../shared/career/studentProfile.js';

const moneyAmountSchema = new mongoose.Schema(
  {
    // Integer minor units (e.g. 150000 for USD 1500.00). Null = not set.
    amountMinor: { type: Number, default: null },
    // ISO 4217
    currency: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

export const budgetProfileSchema = new mongoose.Schema(
  {
    tuition: { type: moneyAmountSchema, default: () => ({}) },
    living: { type: moneyAmountSchema, default: () => ({}) },
    general: { type: moneyAmountSchema, default: () => ({}) },
    period: { type: String, enum: [...BUDGET_PERIODS, ''], default: '' },
    fundingSource: { type: String, enum: [...FUNDING_SOURCE_TYPES, ''], default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

export const BudgetProfile = budgetProfileSchema;
