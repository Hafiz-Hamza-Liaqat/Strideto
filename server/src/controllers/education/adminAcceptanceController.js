/**
 * Admin Test Acceptance Explorer controller (Mission 6).
 *
 * All routes require Auth + Staff (enforced by the parent adminRouter middleware).
 * Normal users cannot read, create, or mutate acceptance claims.
 *
 * Published claims are high-value factual records:
 *   - Must have at least one source
 *   - Conflict detection runs before publishing
 *   - Important changes are audited
 *
 * Supersession: when a published claim changes, the old record is preserved
 * as archived with supersededById pointing at the replacement (Mission 6).
 */
import { Test } from '../../models/education/Test.js';
import { CanonicalInstitution } from '../../models/education/CanonicalInstitution.js';
import { Program } from '../../models/education/Program.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { validateSource } from '../../../../shared/international/evidence.js';
import { normalizeCountryCode } from '../../../../shared/international/country.js';
import {
  isValidAcceptanceStatus,
  isValidAcceptanceScope,
  detectConflict,
} from '../../../../shared/education/acceptanceExplorer.js';
import { isValidPubStatus, isValidDegreeLevel, isValidStudyMode, PUB_STATUSES } from '../../../../shared/education/taxonomy.js';
import { isValidVerificationStatus, VERIFICATION_STATUSES } from '../../../../shared/trust/sourceVerification.js';

// ── Source parsing ────────────────────────────────────────────────────────────

function parseSources(rawSources, { strict = false } = {}) {
  if (!Array.isArray(rawSources)) return { ok: true, sources: [] };
  const out = [];
  const errors = [];
  for (let i = 0; i < Math.min(rawSources.length, 20); i++) {
    const entry = rawSources[i];
    const safe = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
    const result = validateSource(safe);
    if (result.ok) {
      out.push(result.value);
    } else if (strict) {
      errors.push(`sources[${i}]: ${result.errors.join(', ')}`);
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, sources: out };
}

function extractSources(raw, res, { strict = false } = {}) {
  const result = parseSources(raw, { strict });
  if (!result.ok) {
    res.status(400).json({ error: result.errors.join('; ') });
    return null;
  }
  return result.sources;
}

// ── Section minimums parsing ──────────────────────────────────────────────────

function parseSectionMinimums(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === 'object' && s.sectionName && s.minimum != null)
    .map(({ sectionName, minimum, scale }) => ({
      sectionName: String(sectionName).trim(),
      minimum: Number(minimum),
      scale: String(scale || '').trim(),
    }))
    .filter((s) => !isNaN(s.minimum));
}

// ── Pagination helpers ────────────────────────────────────────────────────────

function parsePage(q) { const p = parseInt(q.page, 10); return p > 0 ? p : 1; }
function parseLimit(q, max = 50) { const l = parseInt(q.limit, 10); return l > 0 && l <= max ? l : 20; }

// ── List ──────────────────────────────────────────────────────────────────────

export const adminListAcceptance = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};

  if (q.status) filter.status = sanitizeString(q.status);
  if (q.testId) filter.testId = sanitizeString(q.testId);
  if (q.institutionId) filter.institutionId = sanitizeString(q.institutionId);
  if (q.programId) filter.programId = sanitizeString(q.programId);
  if (q.countryCode) filter.countryCode = sanitizeString(q.countryCode).toUpperCase();
  if (q.acceptanceStatus) filter.acceptanceStatus = sanitizeString(q.acceptanceStatus);
  if (q.scope) filter.acceptanceScope = sanitizeString(q.scope);
  if (q.verificationStatus) filter.verificationStatus = sanitizeString(q.verificationStatus);

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    TestAcceptance.find(filter)
      .populate('testId', 'name shortName slug')
      .populate('institutionId', 'officialName slug')
      .populate('programId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TestAcceptance.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

// ── Get single ────────────────────────────────────────────────────────────────

export const adminGetAcceptance = asyncHandler(async (req, res) => {
  const doc = await TestAcceptance.findById(req.params.id)
    .populate('testId', 'name shortName slug')
    .populate('institutionId', 'officialName slug')
    .populate('programId', 'name slug')
    .lean();
  if (!doc) return res.status(404).json({ error: 'Acceptance claim not found' });
  res.json(doc);
});

// ── Create draft ──────────────────────────────────────────────────────────────

export const adminCreateAcceptance = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Required fields
  if (!body.testId) return res.status(400).json({ error: 'testId is required' });
  if (!isValidAcceptanceStatus(body.acceptanceStatus)) {
    return res.status(400).json({ error: 'acceptanceStatus is invalid' });
  }
  if (!isValidAcceptanceScope(body.acceptanceScope)) {
    return res.status(400).json({ error: 'acceptanceScope is invalid' });
  }

  // Verify referenced entities exist
  const testExists = await Test.exists({ _id: body.testId });
  if (!testExists) return res.status(400).json({ error: 'testId references a test that does not exist' });

  if (body.institutionId) {
    const instExists = await CanonicalInstitution.exists({ _id: body.institutionId });
    if (!instExists) return res.status(400).json({ error: 'institutionId references an institution that does not exist' });
  }
  if (body.programId) {
    const progExists = await Program.exists({ _id: body.programId });
    if (!progExists) return res.status(400).json({ error: 'programId references a program that does not exist' });
  }

  const targetStatus = isValidPubStatus(body.status) ? body.status : 'draft';

  // Sources — strict for published claims
  const sources = extractSources(body.sources, res, { strict: targetStatus === 'published' });
  if (sources === null) return;

  // Published claims require at least one source
  if (targetStatus === 'published' && sources.length === 0) {
    return res.status(400).json({ error: 'Published acceptance claims require at least one source' });
  }

  // Conflict detection for published claims
  if (targetStatus === 'published') {
    const existing = await TestAcceptance.find({
      testId: body.testId,
      acceptanceScope: body.acceptanceScope,
      institutionId: body.institutionId || null,
      programId: body.programId || null,
      countryCode: (body.countryCode || '').toUpperCase(),
      status: 'published',
    }).lean();

    const { conflict, reason } = detectConflict(existing, {
      testId: String(body.testId),
      acceptanceScope: body.acceptanceScope,
      institutionId: body.institutionId ? String(body.institutionId) : '',
      programId: body.programId ? String(body.programId) : '',
      countryCode: (body.countryCode || '').toUpperCase(),
      intake: body.intake || '',
      acceptanceStatus: body.acceptanceStatus,
    });

    if (conflict) {
      return res.status(409).json({ error: `Conflict detected: ${reason}` });
    }
  }

  const degreeLevels = Array.isArray(body.degreeLevels)
    ? body.degreeLevels.filter(isValidDegreeLevel)
    : [];
  const studyModes = Array.isArray(body.studyModes)
    ? body.studyModes.filter(isValidStudyMode)
    : [];

  const doc = await TestAcceptance.create({
    testId: body.testId,
    institutionId: body.institutionId || null,
    programId: body.programId || null,
    countryCode: normalizeCountryCode(body.countryCode) || '',
    acceptanceStatus: body.acceptanceStatus,
    acceptanceScope: body.acceptanceScope,
    minimumOverallScore: body.minimumOverallScore != null ? Number(body.minimumOverallScore) : null,
    sectionMinimums: parseSectionMinimums(body.sectionMinimums),
    scoreNotes: sanitizeString(body.scoreNotes),
    degreeLevels,
    studyModes,
    intake: sanitizeString(body.intake),
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
    effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
    conditions: sanitizeString(body.conditions),
    waiverNotes: sanitizeString(body.waiverNotes),
    sources,
    verificationStatus: VERIFICATION_STATUSES.UNVERIFIED,
    adminNotes: sanitizeString(body.adminNotes),
    status: targetStatus,
  });

  res.status(201).json(doc);
});

// ── Update ────────────────────────────────────────────────────────────────────
//
// Updates a draft claim in-place.
// Updating a PUBLISHED claim to change acceptanceStatus/scope/scores/sources
// is intentionally routed through adminSupersedeAcceptance (preserves history).
// This endpoint handles: adminNotes, draft field edits, status→published transition.

export const adminUpdateAcceptance = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const doc = await TestAcceptance.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Acceptance claim not found' });

  // Superseded predecessors are terminal — cannot be mutated
  if (doc.supersededById) {
    return res.status(409).json({ error: 'Superseded claims cannot be modified' });
  }

  const update = {};

  // Allow all field updates on draft; restrict destructive changes on published
  if (body.acceptanceStatus !== undefined) {
    if (!isValidAcceptanceStatus(body.acceptanceStatus)) {
      return res.status(400).json({ error: 'acceptanceStatus is invalid' });
    }
    update.acceptanceStatus = body.acceptanceStatus;
  }
  if (body.acceptanceScope !== undefined) {
    if (!isValidAcceptanceScope(body.acceptanceScope)) {
      return res.status(400).json({ error: 'acceptanceScope is invalid' });
    }
    update.acceptanceScope = body.acceptanceScope;
  }
  if (body.countryCode !== undefined) {
    update.countryCode = normalizeCountryCode(body.countryCode) || '';
  }
  if (body.minimumOverallScore !== undefined) {
    update.minimumOverallScore = body.minimumOverallScore != null ? Number(body.minimumOverallScore) : null;
  }
  if (body.sectionMinimums !== undefined) {
    update.sectionMinimums = parseSectionMinimums(body.sectionMinimums);
  }
  if (body.scoreNotes !== undefined) update.scoreNotes = sanitizeString(body.scoreNotes);
  if (body.degreeLevels !== undefined) {
    update.degreeLevels = Array.isArray(body.degreeLevels) ? body.degreeLevels.filter(isValidDegreeLevel) : [];
  }
  if (body.studyModes !== undefined) {
    update.studyModes = Array.isArray(body.studyModes) ? body.studyModes.filter(isValidStudyMode) : [];
  }
  if (body.intake !== undefined) update.intake = sanitizeString(body.intake);
  if (body.effectiveFrom !== undefined) update.effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : null;
  if (body.effectiveUntil !== undefined) update.effectiveUntil = body.effectiveUntil ? new Date(body.effectiveUntil) : null;
  if (body.conditions !== undefined) update.conditions = sanitizeString(body.conditions);
  if (body.waiverNotes !== undefined) update.waiverNotes = sanitizeString(body.waiverNotes);
  if (body.adminNotes !== undefined) update.adminNotes = sanitizeString(body.adminNotes);

  // Verification status
  if (body.verificationStatus !== undefined) {
    if (!isValidVerificationStatus(body.verificationStatus)) {
      return res.status(400).json({ error: 'verificationStatus is invalid' });
    }
    update.verificationStatus = body.verificationStatus;
  }
  if (body.lastVerifiedAt !== undefined) update.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;
  if (body.nextReviewAt !== undefined) update.nextReviewAt = body.nextReviewAt ? new Date(body.nextReviewAt) : null;

  // Status transition
  if (body.status !== undefined) {
    if (!isValidPubStatus(body.status)) {
      return res.status(400).json({ error: 'status is invalid' });
    }

    const targetStatus = body.status;

    // Sources: handle before status check
    if (body.sources !== undefined) {
      const sourcesResult = parseSources(body.sources, { strict: targetStatus === 'published' });
      if (!sourcesResult.ok) {
        return res.status(400).json({ error: sourcesResult.errors.join('; ') });
      }
      update.sources = sourcesResult.sources;
    }

    if (targetStatus === 'published') {
      const resolvedSources = update.sources ?? doc.sources ?? [];
      if (resolvedSources.length === 0) {
        return res.status(400).json({ error: 'Published acceptance claims require at least one source' });
      }

      // Conflict detection
      const resolvedStatus = update.acceptanceStatus ?? doc.acceptanceStatus;
      const resolvedScope = update.acceptanceScope ?? doc.acceptanceScope;
      const existing = await TestAcceptance.find({
        testId: doc.testId,
        acceptanceScope: resolvedScope,
        institutionId: doc.institutionId || null,
        programId: doc.programId || null,
        countryCode: update.countryCode ?? doc.countryCode ?? '',
        status: 'published',
      }).lean();

      const { conflict, reason } = detectConflict(existing, {
        testId: String(doc.testId),
        acceptanceScope: resolvedScope,
        institutionId: doc.institutionId ? String(doc.institutionId) : '',
        programId: doc.programId ? String(doc.programId) : '',
        countryCode: (update.countryCode ?? doc.countryCode ?? '').toUpperCase(),
        intake: update.intake ?? doc.intake ?? '',
        acceptanceStatus: resolvedStatus,
      }, String(doc._id));

      if (conflict) {
        return res.status(409).json({ error: `Conflict detected: ${reason}` });
      }
    }

    update.status = targetStatus;
  } else if (body.sources !== undefined) {
    const sourcesResult = parseSources(body.sources, { strict: doc.status === 'published' });
    if (!sourcesResult.ok) {
      return res.status(400).json({ error: sourcesResult.errors.join('; ') });
    }
    update.sources = sourcesResult.sources;
  }

  const updated = await TestAcceptance.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
  res.json(updated);
});

// ── Supersede ─────────────────────────────────────────────────────────────────
//
// Creates a new replacement claim and marks the old one archived with supersededById.
// Used when changing a published acceptance claim (preserves history).
//
// Canonical representation (Mission 6 / institution portal parity):
//   old.status = archived
//   old.supersededById = replacementId
//   replacement starts as draft until published through the existing workflow
//
// POST /api/admin/education/acceptance/:id/supersede

export const adminSupersedeAcceptance = asyncHandler(async (req, res) => {
  const old = await TestAcceptance.findById(req.params.id);
  if (!old) return res.status(404).json({ error: 'Acceptance claim not found' });

  if (old.supersededById) {
    return res.status(409).json({ error: 'Claim is already superseded' });
  }
  if (old.status !== PUB_STATUSES.PUBLISHED) {
    return res.status(400).json({ error: 'Only published claims can be superseded; update draft claims directly' });
  }

  const body = req.body || {};

  // New claim — must provide key fields
  if (!isValidAcceptanceStatus(body.acceptanceStatus)) {
    return res.status(400).json({ error: 'acceptanceStatus is required and must be valid' });
  }
  if (!isValidAcceptanceScope(body.acceptanceScope ?? old.acceptanceScope)) {
    return res.status(400).json({ error: 'acceptanceScope is invalid' });
  }

  const sources = extractSources(body.sources, res, { strict: true });
  if (sources === null) return;
  if (sources.length === 0) {
    return res.status(400).json({ error: 'Superseding claim requires at least one source' });
  }

  const degreeLevels = Array.isArray(body.degreeLevels)
    ? body.degreeLevels.filter(isValidDegreeLevel)
    : old.degreeLevels;
  const studyModes = Array.isArray(body.studyModes)
    ? body.studyModes.filter(isValidStudyMode)
    : old.studyModes;

  const newClaim = await TestAcceptance.create({
    testId: old.testId,
    institutionId: old.institutionId,
    programId: old.programId,
    countryCode: old.countryCode,
    acceptanceStatus: body.acceptanceStatus,
    acceptanceScope: body.acceptanceScope ?? old.acceptanceScope,
    minimumOverallScore: body.minimumOverallScore != null ? Number(body.minimumOverallScore) : null,
    sectionMinimums: parseSectionMinimums(body.sectionMinimums ?? []),
    scoreNotes: sanitizeString(body.scoreNotes ?? ''),
    degreeLevels,
    studyModes,
    intake: sanitizeString(body.intake ?? old.intake ?? ''),
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
    effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
    conditions: sanitizeString(body.conditions ?? ''),
    waiverNotes: sanitizeString(body.waiverNotes ?? ''),
    sources,
    verificationStatus: VERIFICATION_STATUSES.UNVERIFIED,
    adminNotes: sanitizeString(body.adminNotes ?? ''),
    status: PUB_STATUSES.DRAFT,
  });

  // Mark the old claim superseded using canonical archived + pointer semantics
  old.status = PUB_STATUSES.ARCHIVED;
  old.supersededById = newClaim._id;
  await old.save();

  res.status(201).json({ superseded: old._id, replacement: newClaim });
});
