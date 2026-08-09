/**
 * CanonicalSource — full authority source record (Mission 5).
 *
 * One record per unique source URL (deduped via normalizedUrl).
 * Tracks provenance, authority, availability, and freshness metadata
 * for tests, institutions, programs, scholarships, country intelligence,
 * and any future high-stakes factual record.
 *
 * adminNotes is server-only and must never be projected to public endpoints.
 */
import mongoose from 'mongoose';
import {
  AUTHORITY_TYPES,
  SOURCE_STATUS,
  normalizeSourceUrl,
} from '../../../../shared/trust/sourceVerification.js';
import { SOURCE_TYPES } from '../../../../shared/international/evidence.js';

const canonicalSourceSchema = new mongoose.Schema(
  {
    // ── URL identity ──────────────────────────────────────────────────────────
    url: { type: String, required: true, trim: true },
    // Normalized for deduplication — indexed unique.
    normalizedUrl: { type: String, required: true, unique: true, trim: true },

    // ── Classification ────────────────────────────────────────────────────────
    sourceType: {
      type: String,
      enum: Object.values(SOURCE_TYPES),
      required: true,
    },
    authorityType: {
      type: String,
      enum: Object.values(AUTHORITY_TYPES),
    },

    // ── Publisher / authority identity ────────────────────────────────────────
    publisher: { type: String, trim: true, default: '' },
    // ISO 3166-1 alpha-2 — optional, for country-specific sources
    countryCode: { type: String, trim: true, uppercase: true, default: '' },
    // Human-readable display label for public projection
    label: { type: String, trim: true, default: '' },
    isOfficialDomain: { type: Boolean, default: false },

    // ── Availability ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(SOURCE_STATUS),
      default: SOURCE_STATUS.ACTIVE,
      index: true,
    },
    // Last HTTP check result — never used as sole invalidation criterion
    httpStatus: { type: Number },
    httpStatusRecordedAt: { type: Date },
    // If redirected, where does it point now (for admin review)?
    redirectedTo: { type: String, trim: true, default: '' },

    // ── Freshness timestamps ──────────────────────────────────────────────────
    firstSeenAt: { type: Date },
    lastCheckedAt: { type: Date },
    lastSuccessfulCheckAt: { type: Date },
    lastVerifiedAt: { type: Date, index: true },
    nextReviewAt: { type: Date, index: true },

    // ── Admin-only ────────────────────────────────────────────────────────────
    // Never expose this field on public endpoints.
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

canonicalSourceSchema.index({ authorityType: 1, status: 1 });
canonicalSourceSchema.index({ countryCode: 1, status: 1 });
canonicalSourceSchema.index({ nextReviewAt: 1, status: 1 });

// Auto-compute normalizedUrl on save when not set or url changes
canonicalSourceSchema.pre('save', function (next) {
  if (this.isModified('url') || !this.normalizedUrl) {
    const norm = normalizeSourceUrl(this.url);
    if (!norm) return next(new Error('url must be a valid http(s) URL'));
    this.normalizedUrl = norm;
  }
  if (!this.firstSeenAt) this.firstSeenAt = new Date();
  next();
});

export const CanonicalSource = mongoose.model('CanonicalSource', canonicalSourceSchema);
