/**
 * Public Test Acceptance Explorer controller (Mission 6).
 *
 * Only published acceptance claims are returned publicly.
 * Draft/archived claims are never exposed.
 * adminNotes is never projected.
 */
import { Test } from '../../models/education/Test.js';
import { CanonicalInstitution } from '../../models/education/CanonicalInstitution.js';
import { Program } from '../../models/education/Program.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import {
  projectPublicAcceptance,
  fallbackScopeLabel,
  ACCEPTANCE_SCOPES,
  mergeProgramAcceptanceWithInstitutionFallback,
} from '../../../../shared/education/acceptanceExplorer.js';
import { currentAcceptanceMongoFilter } from '../../../../shared/publicDiscovery/publicTruth.js';
import { withFixtureExclusion } from '../../../../shared/publicDiscovery/fixtureExclusion.js';

const PAGE_SIZE = 20;

function parsePage(q) {
  const p = parseInt(q.page, 10);
  return p > 0 ? p : 1;
}

function parseLimit(q, max = PAGE_SIZE) {
  const l = parseInt(q.limit, 10);
  return l > 0 && l <= max ? l : max;
}

// Public projection helper — strips adminNotes and internal fields
function project(doc) {
  return projectPublicAcceptance(doc);
}

// ── Forward: test → destinations ──────────────────────────────────────────────
//
// GET /api/tests/:slug/acceptance
// Discover where a test is accepted (countries, institutions, programs).
//
// Filters: country, institutionId, programId, degreeLevel, acceptanceStatus, scope
// Pagination: page, limit

export const getTestAcceptance = asyncHandler(async (req, res) => {
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' }).lean();
  if (!test) return res.status(404).json({ error: 'Test not found' });

  const q = req.query || {};
  const filter = { testId: test._id, ...currentAcceptanceMongoFilter() };

  if (q.country) filter.countryCode = sanitizeString(q.country).toUpperCase();
  if (q.institutionId) filter.institutionId = sanitizeString(q.institutionId);
  if (q.programId) filter.programId = sanitizeString(q.programId);
  if (q.acceptanceStatus) filter.acceptanceStatus = sanitizeString(q.acceptanceStatus);
  if (q.scope) filter.acceptanceScope = sanitizeString(q.scope);
  if (q.degreeLevel) filter.degreeLevels = sanitizeString(q.degreeLevel);

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    TestAcceptance.find(filter)
      .populate('institutionId', 'officialName slug countryCode institutionType')
      .populate('programId', 'name slug degreeLevel field')
      .sort({ acceptanceScope: -1, countryCode: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TestAcceptance.countDocuments(filter),
  ]);

  const data = raw.map(project);

  res.json({
    testId: test._id,
    testSlug: test.slug,
    testName: test.name,
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

// ── Reverse: institution → accepted tests ─────────────────────────────────────
//
// GET /api/education/institutions/:slug/acceptance
// Discover which tests are accepted at this institution.
//
// Filters: acceptanceStatus, degreeLevel

export const getInstitutionAcceptance = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const institution = await CanonicalInstitution.findOne(
    withFixtureExclusion({ slug, status: 'published' })
  ).lean();
  if (!institution) return res.status(404).json({ error: 'Institution not found' });

  const q = req.query || {};
  const filter = {
    institutionId: institution._id,
    ...currentAcceptanceMongoFilter(),
  };
  if (q.acceptanceStatus) filter.acceptanceStatus = sanitizeString(q.acceptanceStatus);
  if (q.degreeLevel) filter.degreeLevels = sanitizeString(q.degreeLevel);

  const raw = await TestAcceptance.find(filter)
    .populate({
      path: 'testId',
      select: 'name shortName slug category scoreScale providerId',
      populate: { path: 'providerId', select: 'name slug' },
    })
    .sort({ acceptanceStatus: 1, 'testId.name': 1 })
    .lean();

  const data = raw.map(project);

  // Group by testId for comparison view when ?compare=1
  if (q.compare === '1') {
    const byTest = {};
    for (const item of data) {
      const key = String(item.testId?._id || item.testId);
      if (!byTest[key]) {
        byTest[key] = { test: item.testId, claims: [] };
      }
      byTest[key].claims.push(item);
    }
    return res.json({
      institutionId: institution._id,
      institutionSlug: institution.slug,
      institutionName: institution.officialName,
      comparison: Object.values(byTest),
    });
  }

  res.json({
    institutionId: institution._id,
    institutionSlug: institution.slug,
    institutionName: institution.officialName,
    data,
    total: data.length,
  });
});

// ── Reverse: program → accepted tests ────────────────────────────────────────
//
// GET /api/education/programs/:slug/acceptance
// Discover which tests are accepted for a specific program.
// Falls back to institution-level claims if no program-specific claims exist,
// clearly labeled as broader guidance.

export const getProgramAcceptance = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const program = await Program.findOne({ slug, status: 'published' }).lean();
  if (!program) return res.status(404).json({ error: 'Program not found' });

  const q = req.query || {};
  const filter = {
    programId: program._id,
    ...currentAcceptanceMongoFilter(),
  };
  if (q.acceptanceStatus) filter.acceptanceStatus = sanitizeString(q.acceptanceStatus);

  const raw = await TestAcceptance.find(filter)
    .populate({
      path: 'testId',
      select: 'name shortName slug category scoreScale providerId',
      populate: { path: 'providerId', select: 'name slug' },
    })
    .sort({ acceptanceStatus: 1 })
    .lean();

  const programData = raw.map(project);

  let fallbackData = null;
  let fallbackLabel = null;

  // If no program-specific claims exist, surface institution-level claims as fallback
  if (program.institutionId) {
    const institutionClaims = await TestAcceptance.find({
      institutionId: program.institutionId,
      ...currentAcceptanceMongoFilter(),
      ...(q.acceptanceStatus ? { acceptanceStatus: sanitizeString(q.acceptanceStatus) } : {}),
    })
      .populate({
        path: 'testId',
        select: 'name shortName slug category scoreScale providerId',
        populate: { path: 'providerId', select: 'name slug' },
      })
      .lean();

    const merged = mergeProgramAcceptanceWithInstitutionFallback(raw.map(project), institutionClaims);
    if (merged.institutionFallback.length > 0) {
      fallbackData = merged.institutionFallback.map(project);
      fallbackLabel = fallbackScopeLabel(ACCEPTANCE_SCOPES.INSTITUTION);
    }
  }

  res.json({
    programId: program._id,
    programSlug: program.slug,
    programName: program.name,
    data: programData,
    total: programData.length,
    // Fallback is included only when no program-specific claims were found
    fallback: fallbackData
      ? {
          label: fallbackLabel,
          scope: ACCEPTANCE_SCOPES.INSTITUTION,
          data: fallbackData,
          total: fallbackData.length,
        }
      : null,
  });
});

// ── Public program list ───────────────────────────────────────────────────────
//
// GET /api/education/programs
// Supports institution filter, degree level, field filters and pagination.

export const listPrograms = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = { status: 'published' };

  if (q.institutionId) filter.institutionId = sanitizeString(q.institutionId);
  if (q.degreeLevel) filter.degreeLevel = sanitizeString(q.degreeLevel);
  if (q.field) filter.field = sanitizeString(q.field);

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Program.find(filter)
      .populate('institutionId', 'officialName slug')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Program.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

// ── Public program detail ─────────────────────────────────────────────────────
//
// GET /api/education/programs/:slug

export const getProgram = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const doc = await Program.findOne({ slug, status: 'published' })
    .populate('institutionId', 'officialName slug countryCode institutionType')
    .lean();
  if (!doc) return res.status(404).json({ error: 'Program not found' });
  res.json(doc);
});
