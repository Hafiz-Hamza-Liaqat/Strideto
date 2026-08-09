/**
 * TestPrepGuide — Strideto original preparation guidance (Mission 4).
 *
 * Content is authored by Strideto. DO NOT store:
 * - copied proprietary exam questions;
 * - pirated books/PDFs;
 * - reproduced official question banks beyond permitted use.
 *
 * Only one published guide per test (enforced by sparse unique index on
 * testId + status=published at the service layer).
 */
import mongoose from 'mongoose';
import { PUB_STATUSES } from '../../../../shared/education/taxonomy.js';

const evidenceSubSchema = new mongoose.Schema(
  {
    sourceType: { type: String, trim: true, default: '' },
    sourceUrl: { type: String, trim: true, default: '' },
    publisher: { type: String, trim: true, default: '' },
    retrievedAt: { type: Date },
    verifiedAt: { type: Date },
    evidenceRef: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const prepStepSubSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const sectionPrepSubSchema = new mongoose.Schema(
  {
    sectionName: { type: String, trim: true, required: true },
    tips: { type: [String], default: [] },
  },
  { _id: false }
);

const testPrepGuideSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    overview: { type: String, trim: true, default: '' },
    prepSequence: { type: [prepStepSubSchema], default: [] },
    recommendedDurationMinWeeks: { type: Number },
    recommendedDurationMaxWeeks: { type: Number },
    sectionPrep: { type: [sectionPrepSubSchema], default: [] },
    testDayGuidance: { type: String, trim: true, default: '' },
    registrationGuidance: { type: String, trim: true, default: '' },
    // Explicit acknowledgement that content meets copyright policy.
    copyrightPolicyAcknowledged: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
    version: { type: Number, default: 1 },
    sources: { type: [evidenceSubSchema], default: [] },
  },
  { timestamps: true }
);

testPrepGuideSchema.index({ testId: 1, status: 1 });

export const TestPrepGuide = mongoose.model('TestPrepGuide', testPrepGuideSchema);
