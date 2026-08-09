/**
 * Admin freshness queue + data-quality metrics controller (Mission 5).
 *
 * All endpoints require Admin/Staff authentication (enforced by admin router
 * middleware). No public data is returned here.
 *
 * adminNotes and internal source fields are intentionally included in admin
 * responses — they must NOT be exposed on any public endpoint.
 */
import { FactProvenance } from '../../models/trust/FactProvenance.js';
import { CanonicalSource } from '../../models/trust/CanonicalSource.js';
import { DataCorrection } from '../../models/trust/DataCorrection.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import {
  VERIFICATION_STATUSES,
  FRESHNESS_STATES,
  CORRECTION_STATUSES,
  isValidVerificationStatus,
  isValidVerificationTransition,
  isValidFreshnessState,
  deriveFreshness,
} from '../../../../shared/trust/sourceVerification.js';

// ── Admin freshness queue ─────────────────────────────────────────────────────

export const adminListFreshnessQueue = asyncHandler(async (req, res) => {
  const q = req.query || {};

  const filter = {};

  // Freshness filter
  if (q.freshness && isValidFreshnessState(q.freshness)) {
    filter.freshnessState = q.freshness;
  }

  // Verification status filter
  if (q.verificationStatus && isValidVerificationStatus(q.verificationStatus)) {
    filter.verificationStatus = q.verificationStatus;
  }

  // Entity type filter
  if (q.entityType) filter.targetEntityType = sanitizeString(q.entityType);

  // Data type filter (test_policy, institution_identity, etc.)
  if (q.dataType) filter.dataType = sanitizeString(q.dataType);

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 25));

  const [data, total] = await Promise.all([
    FactProvenance.find(filter)
      .populate('sourceIds', 'url label publisher authorityType status lastVerifiedAt nextReviewAt')
      .populate('verifiedBy', 'name email')
      .sort({ nextReviewAt: 1, lastVerifiedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    FactProvenance.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// ── Admin: list canonical sources with freshness/status filters ───────────────

export const adminListSources = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};

  if (q.status) filter.status = sanitizeString(q.status);
  if (q.authorityType) filter.authorityType = sanitizeString(q.authorityType);
  if (q.countryCode) filter.countryCode = sanitizeString(q.countryCode).toUpperCase();

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 25));

  const [data, total] = await Promise.all([
    CanonicalSource.find(filter)
      .sort({ lastVerifiedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CanonicalSource.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// ── Admin: create canonical source ───────────────────────────────────────────

export const adminCreateSource = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const url = sanitizeString(body.url);
  if (!url) return res.status(400).json({ error: 'url is required' });

  const { normalizeSourceUrl, isValidAuthorityType, isValidSourceStatus } =
    await import('../../../../shared/trust/sourceVerification.js');
  const { SOURCE_TYPES, isValidSourceType } =
    await import('../../../../shared/international/evidence.js');

  const normalizedUrl = normalizeSourceUrl(url);
  if (!normalizedUrl) {
    return res.status(400).json({ error: 'url must be a valid http(s) URL' });
  }

  if (!isValidSourceType(body.sourceType)) {
    return res.status(400).json({ error: 'sourceType is invalid' });
  }

  if (body.authorityType && !isValidAuthorityType(body.authorityType)) {
    return res.status(400).json({ error: 'authorityType is invalid' });
  }

  const existing = await CanonicalSource.findOne({ normalizedUrl });
  if (existing) {
    return res.status(409).json({ error: 'A source with this URL already exists', existingId: existing._id });
  }

  const doc = await CanonicalSource.create({
    url,
    normalizedUrl,
    sourceType: body.sourceType,
    authorityType: body.authorityType || undefined,
    publisher: sanitizeString(body.publisher),
    countryCode: sanitizeString(body.countryCode).toUpperCase() || '',
    label: sanitizeString(body.label),
    isOfficialDomain: body.isOfficialDomain === true,
    status: isValidSourceStatus(body.status) ? body.status : 'active',
    adminNotes: sanitizeString(body.adminNotes),
    lastVerifiedAt: body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : undefined,
    nextReviewAt: body.nextReviewAt ? new Date(body.nextReviewAt) : undefined,
  });

  res.status(201).json(doc);
});

// ── Admin: update source metadata ─────────────────────────────────────────────

export const adminUpdateSource = asyncHandler(async (req, res) => {
  const { isValidAuthorityType, isValidSourceStatus } =
    await import('../../../../shared/trust/sourceVerification.js');
  const { isValidSourceType } =
    await import('../../../../shared/international/evidence.js');

  const body = req.body || {};
  const update = {};

  if (body.label !== undefined) update.label = sanitizeString(body.label);
  if (body.publisher !== undefined) update.publisher = sanitizeString(body.publisher);
  if (body.countryCode !== undefined) update.countryCode = sanitizeString(body.countryCode).toUpperCase();
  if (body.isOfficialDomain !== undefined) update.isOfficialDomain = body.isOfficialDomain === true;
  if (body.adminNotes !== undefined) update.adminNotes = sanitizeString(body.adminNotes);
  if (body.sourceType !== undefined && isValidSourceType(body.sourceType)) {
    update.sourceType = body.sourceType;
  }
  if (body.authorityType !== undefined && isValidAuthorityType(body.authorityType)) {
    update.authorityType = body.authorityType;
  }
  if (body.status !== undefined && isValidSourceStatus(body.status)) {
    update.status = body.status;
  }
  if (body.redirectedTo !== undefined) update.redirectedTo = sanitizeString(body.redirectedTo);
  if (body.lastVerifiedAt !== undefined) {
    update.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;
  }
  if (body.nextReviewAt !== undefined) {
    update.nextReviewAt = body.nextReviewAt ? new Date(body.nextReviewAt) : null;
  }

  const doc = await CanonicalSource.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Source not found' });
  res.json(doc);
});

// ── Admin: verify a fact provenance record ───────────────────────────────────

export const adminVerifyFact = asyncHandler(async (req, res) => {
  const doc = await FactProvenance.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Fact provenance record not found' });

  const from = doc.verificationStatus;
  const to = VERIFICATION_STATUSES.VERIFIED;

  if (!isValidVerificationTransition(from, to)) {
    return res.status(400).json({
      error: `Invalid transition: ${from} → ${to}`,
    });
  }

  const now = new Date();
  doc.verificationStatus = VERIFICATION_STATUSES.VERIFIED;
  doc.verifiedAt = now;
  doc.verifiedBy = req.user?._id;
  doc.lastVerifiedAt = now;

  // Recompute freshness
  doc.freshnessState = deriveFreshness({
    lastVerifiedAt: now,
    nextReviewAt: doc.nextReviewAt,
    dataType: doc.dataType,
  });

  const body = req.body || {};
  if (body.notes) doc.adminNotes = sanitizeString(body.notes);
  if (body.nextReviewAt) doc.nextReviewAt = new Date(body.nextReviewAt);

  await doc.save();
  res.json(doc);
});

// ── Admin: update verification status (generic transition) ───────────────────

export const adminUpdateVerificationStatus = asyncHandler(async (req, res) => {
  const doc = await FactProvenance.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Fact provenance record not found' });

  const body = req.body || {};
  const to = sanitizeString(body.status);

  if (!isValidVerificationStatus(to)) {
    return res.status(400).json({ error: 'status is invalid' });
  }

  if (!isValidVerificationTransition(doc.verificationStatus, to)) {
    return res.status(400).json({
      error: `Invalid transition: ${doc.verificationStatus} → ${to}`,
    });
  }

  doc.verificationStatus = to;
  if (body.notes) doc.adminNotes = sanitizeString(body.notes);
  if (body.nextReviewAt) doc.nextReviewAt = new Date(body.nextReviewAt);

  if (to === VERIFICATION_STATUSES.VERIFIED) {
    const now = new Date();
    doc.verifiedAt = now;
    doc.verifiedBy = req.user?._id;
    doc.lastVerifiedAt = now;
  }

  // Recompute freshness after status change
  doc.freshnessState = deriveFreshness({
    lastVerifiedAt: doc.lastVerifiedAt,
    nextReviewAt: doc.nextReviewAt,
    dataType: doc.dataType,
  });

  await doc.save();
  res.json(doc);
});

// ── Admin: schedule next review ───────────────────────────────────────────────

export const adminScheduleReview = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const doc = await FactProvenance.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Fact provenance record not found' });

  if (!body.nextReviewAt) return res.status(400).json({ error: 'nextReviewAt is required' });
  const nextReview = new Date(body.nextReviewAt);
  if (isNaN(nextReview.getTime())) return res.status(400).json({ error: 'nextReviewAt is invalid' });

  doc.nextReviewAt = nextReview;
  doc.freshnessState = deriveFreshness({
    lastVerifiedAt: doc.lastVerifiedAt,
    nextReviewAt: nextReview,
    dataType: doc.dataType,
  });

  await doc.save();
  res.json(doc);
});

// ── Admin: list corrections (freshness queue cross-reference) ─────────────────

export const adminListCorrections = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};

  if (q.status) filter.status = sanitizeString(q.status);
  if (q.entityType) filter.targetEntityType = sanitizeString(q.entityType);
  if (q.correctionType) filter.correctionType = sanitizeString(q.correctionType);

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 25));

  const [data, total] = await Promise.all([
    DataCorrection.find(filter)
      .populate('submittedBy', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DataCorrection.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// ── Admin: resolve a correction ───────────────────────────────────────────────

export const adminResolveCorrection = asyncHandler(async (req, res) => {
  const doc = await DataCorrection.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Correction not found' });

  const { isValidCorrectionStatus } =
    await import('../../../../shared/trust/sourceVerification.js');
  const body = req.body || {};
  const newStatus = sanitizeString(body.status);

  const resolvableStatuses = new Set([
    CORRECTION_STATUSES.ACCEPTED,
    CORRECTION_STATUSES.REJECTED,
    CORRECTION_STATUSES.DUPLICATE,
    CORRECTION_STATUSES.RESOLVED,
  ]);

  if (!isValidCorrectionStatus(newStatus) || !resolvableStatuses.has(newStatus)) {
    return res.status(400).json({
      error: 'status must be one of: accepted, rejected, duplicate, resolved',
    });
  }

  doc.status = newStatus;
  doc.resolvedBy = req.user?._id;
  doc.resolvedAt = new Date();
  if (body.resolutionNote) doc.resolutionNote = sanitizeString(body.resolutionNote);
  if (body.duplicateOfId) doc.duplicateOfId = body.duplicateOfId;

  await doc.save();
  res.json({ _id: doc._id, status: doc.status, resolvedAt: doc.resolvedAt });
});

// ── Data quality metrics ──────────────────────────────────────────────────────

export const adminDataQualityMetrics = asyncHandler(async (_req, res) => {
  const [
    totalFactRecords,
    verified,
    unverified,
    fresh,
    reviewDue,
    stale,
    broken,
    correctionsPending,
  ] = await Promise.all([
    FactProvenance.countDocuments({}),
    FactProvenance.countDocuments({ verificationStatus: VERIFICATION_STATUSES.VERIFIED }),
    FactProvenance.countDocuments({ verificationStatus: VERIFICATION_STATUSES.UNVERIFIED }),
    FactProvenance.countDocuments({ freshnessState: FRESHNESS_STATES.FRESH }),
    FactProvenance.countDocuments({ freshnessState: FRESHNESS_STATES.REVIEW_DUE }),
    FactProvenance.countDocuments({ freshnessState: FRESHNESS_STATES.STALE }),
    FactProvenance.countDocuments({ freshnessState: FRESHNESS_STATES.BROKEN }),
    DataCorrection.countDocuments({
      status: { $in: [CORRECTION_STATUSES.SUBMITTED, CORRECTION_STATUSES.UNDER_REVIEW] },
    }),
  ]);

  res.json({
    totalFactRecords,
    verified,
    unverified,
    fresh,
    reviewDue,
    stale,
    broken,
    correctionsPending,
  });
});
