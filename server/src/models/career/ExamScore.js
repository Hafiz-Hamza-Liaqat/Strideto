import mongoose from 'mongoose';
import { EXAM_TYPES, EXAM_STATUSES } from '../../../../shared/career/studentProfile.js';

export const examScoreSchema = new mongoose.Schema(
  {
    testType: {
      type: String,
      enum: EXAM_TYPES,
      required: true,
    },
    provider: { type: String, trim: true, default: '' },
    overallScore: { type: String, trim: true, default: '' },
    // Flexible per-test section breakdown: { reading, writing, speaking, listening, verbal, quant, ... }
    sectionScores: { type: mongoose.Schema.Types.Mixed, default: null },
    testDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    status: { type: String, enum: EXAM_STATUSES, default: 'completed' },
    referenceNumber: { type: String, trim: true, default: '' },
    // Reserved for future Trust Engine integration — not surfaced in MVP
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ExamScore = examScoreSchema;
