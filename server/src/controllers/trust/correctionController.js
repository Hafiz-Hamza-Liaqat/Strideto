/**
 * User correction submission controller (Mission 5).
 *
 * Authenticated users may report factual problems. They cannot directly
 * mutate authoritative data. Duplicate guard: one open correction per
 * user/entity/correctionType.
 *
 * Public/user endpoints only — no adminNotes exposed.
 */
import { DataCorrection } from '../../models/trust/DataCorrection.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import {
  CORRECTION_STATUSES,
  CORRECTION_TYPES,
  isValidCorrectionType,
} from '../../../../shared/trust/sourceVerification.js';

const MAX_DESCRIPTION_LENGTH = 2000;

// ── Submit a correction ───────────────────────────────────────────────────────

export const submitCorrection = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const targetEntityType = sanitizeString(body.targetEntityType);
  const targetEntityId = sanitizeString(body.targetEntityId);

  if (!targetEntityType) return res.status(400).json({ error: 'targetEntityType is required' });
  if (!targetEntityId) return res.status(400).json({ error: 'targetEntityId is required' });
  if (!isValidCorrectionType(body.correctionType)) {
    return res.status(400).json({ error: 'correctionType is invalid' });
  }

  const description = sanitizeString(body.description);
  if (!description) return res.status(400).json({ error: 'description is required' });
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({
      error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    });
  }

  // Duplicate guard: reject if user already has an open correction for this entity+type
  const existing = await DataCorrection.findOne({
    submittedBy: userId,
    targetEntityId,
    correctionType: body.correctionType,
    status: { $in: [CORRECTION_STATUSES.SUBMITTED, CORRECTION_STATUSES.UNDER_REVIEW] },
  });

  if (existing) {
    return res.status(409).json({
      error: 'You already have an open correction report for this item and issue type.',
      existingId: existing._id,
    });
  }

  const doc = await DataCorrection.create({
    submittedBy: userId,
    targetEntityType,
    targetEntityId,
    correctionType: body.correctionType,
    description,
    relatedSourceId: body.relatedSourceId || undefined,
    status: CORRECTION_STATUSES.SUBMITTED,
  });

  // Return minimal confirmation — no internal fields
  res.status(201).json({
    _id: doc._id,
    status: doc.status,
    correctionType: doc.correctionType,
    createdAt: doc.createdAt,
  });
});

// ── User: list own corrections ────────────────────────────────────────────────

export const listMyCorrections = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const q = req.query || {};
  const filter = { submittedBy: userId };
  if (q.status && Object.values(CORRECTION_STATUSES).includes(q.status)) {
    filter.status = q.status;
  }

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));

  const [data, total] = await Promise.all([
    DataCorrection.find(filter)
      .select('-resolutionNote -resolvedBy') // do not expose internal resolution notes
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DataCorrection.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});
