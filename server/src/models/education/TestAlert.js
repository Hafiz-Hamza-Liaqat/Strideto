/**
 * TestAlert — factual test announcements (Mission 4).
 *
 * Records official test-related updates: registration windows, fee changes,
 * format changes, result announcements. Must reference an official source.
 *
 * Mission 9 will add personalized following/notifications on top.
 */
import mongoose from 'mongoose';
import {
  ALERT_TYPES,
  ALERT_IMPORTANCE,
  PUB_STATUSES,
} from '../../../../shared/education/taxonomy.js';

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

const testAlertSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    alertType: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true,
      index: true,
    },
    effectiveDate: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    // ISO 3166-1 alpha-2 codes. Empty array = global.
    countryCodes: { type: [String], default: [] },
    officialSourceUrl: { type: String, trim: true, default: '' },
    sources: { type: [evidenceSubSchema], default: [] },
    publicationStatus: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
    importance: {
      type: String,
      enum: Object.values(ALERT_IMPORTANCE),
      default: ALERT_IMPORTANCE.MEDIUM,
    },
  },
  { timestamps: true }
);

testAlertSchema.index({ testId: 1, publicationStatus: 1, effectiveDate: -1 });
testAlertSchema.index({ alertType: 1, publicationStatus: 1 });

export const TestAlert = mongoose.model('TestAlert', testAlertSchema);
