/**
 * ExternalTestResource — trusted/official external practice & prep resources (Mission 4).
 *
 * Strideto LINKS to trusted resources rather than cloning them.
 * Official test-provider resources are preferred.
 *
 * Content policy:
 *   ALLOWED: official test-provider links, trusted third-party links.
 *   NOT ALLOWED: pirated content, copied proprietary question banks.
 */
import mongoose from 'mongoose';
import {
  RESOURCE_TYPES,
  TRUST_LEVELS,
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

const externalTestResourceSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
      index: true,
    },
    provider: { type: String, trim: true, required: true },
    title: { type: String, trim: true, required: true },
    url: { type: String, trim: true, required: true },
    resourceType: {
      type: String,
      enum: Object.values(RESOURCE_TYPES),
      required: true,
      index: true,
    },
    trustLevel: {
      type: String,
      enum: Object.values(TRUST_LEVELS),
      required: true,
      default: TRUST_LEVELS.TRUSTED,
      index: true,
    },
    isFree: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: false },
    // e.g. "web", "app", "course_platform"
    platformType: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    sources: { type: [evidenceSubSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(PUB_STATUSES),
      default: PUB_STATUSES.DRAFT,
      index: true,
    },
  },
  { timestamps: true }
);

externalTestResourceSchema.index({ testId: 1, trustLevel: 1, status: 1 });
externalTestResourceSchema.index({ testId: 1, resourceType: 1 });

export const ExternalTestResource = mongoose.model('ExternalTestResource', externalTestResourceSchema);
