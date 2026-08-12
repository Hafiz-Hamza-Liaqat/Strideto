/**
 * Program Intelligence public controller (Mission 7).
 *
 * Extends the program detail exposed by Mission 6's testAcceptanceController
 * with requirements, intakes, tuition, related scholarships, and freshness.
 * Resolves TestAcceptance via Mission 6 — does NOT duplicate acceptance records.
 *
 * No personalized eligibility decisions (Mission 8).
 * adminNotes never projected.
 */
import { Program } from '../../models/education/Program.js';
import { CanonicalInstitution as _CanonicalInstitution } from '../../models/education/CanonicalInstitution.js';
import { ProgramRequirement } from '../../models/education/ProgramRequirement.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { CanonicalScholarship } from '../../models/education/CanonicalScholarship.js';
import { ScholarshipApplicability } from '../../models/education/ScholarshipApplicability.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import {
  projectPublicProgramRequirement,
  programComparisonFacts,
} from '../../../../shared/education/scholarshipIntelligence.js';
import { projectPublicAcceptance } from '../../../../shared/education/acceptanceExplorer.js';
import { FRESHNESS_STATES } from '../../../../shared/trust/sourceVerification.js';
import { projectPublicProgram } from '../../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { currentAcceptanceMongoFilter } from '../../../../shared/publicDiscovery/publicTruth.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePage(q) {
  const p = parseInt(q.page, 10);
  return p > 0 ? p : 1;
}

function parseLimit(q) {
  const l = parseInt(q.limit, 10);
  return l > 0 && l <= MAX_PAGE_SIZE ? l : PAGE_SIZE;
}

function freshnessWarning(freshnessState) {
  if (freshnessState === FRESHNESS_STATES.STALE) {
    return 'This record has not been recently verified. Information may have changed.';
  }
  if (freshnessState === FRESHNESS_STATES.BROKEN) {
    return 'The source for this record is currently unavailable. Historical data preserved.';
  }
  return null;
}

function projectProgram(doc) {
  return projectPublicProgram(doc);
}

// ── List programs ─────────────────────────────────────────────────────────────

export const getProgramFacets = asyncHandler(async (_req, res) => {
  const rows = await Program.aggregate([
    { $match: { status: 'published' } },
    { $match: { country: { $exists: true, $nin: [null, ''] } } },
    { $group: { _id: { $toUpper: '$country' } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ countries: rows.map((r) => r._id).filter(Boolean) });
});

export const listPrograms = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = { status: 'published' };

  if (q.country) filter.country = sanitizeString(q.country).toUpperCase();
  if (q.institutionId) filter.institutionId = sanitizeString(q.institutionId);
  if (q.degree) filter.degreeLevel = sanitizeString(q.degree);
  if (q.field) filter.field = sanitizeString(q.field);
  if (q.studyMode) filter.studyMode = sanitizeString(q.studyMode);
  if (q.search) {
    const term = sanitizeString(q.search).slice(0, 80);
    if (term) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { slug: re }];
    }
  }

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    Program.find(filter)
      .populate('institutionId', 'officialName slug countryCode institutionType')
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Program.countDocuments(filter),
  ]);

  res.json({
    data: raw.map(projectProgram),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── Get single program detail ─────────────────────────────────────────────────

export const getProgramDetail = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const doc = await Program.findOne({ slug, status: 'published' })
    .populate('institutionId', 'officialName slug countryCode institutionType')
    .select('-__v')
    .lean();

  if (!doc) return res.status(404).json({ error: 'Program not found' });

  // Published requirements
  const requirements = await ProgramRequirement.find({
    programId: doc._id,
    status: 'published',
  })
    .populate('testId', 'name slug abbreviation')
    .select('-adminNotes -__v')
    .lean();

  // Mission 6: accepted tests for this program (resolved via TestAcceptance)
  const acceptedTests = await TestAcceptance.find({
    programId: doc._id,
    ...currentAcceptanceMongoFilter(),
  })
    .populate('testId', 'name slug abbreviation')
    .select('-adminNotes -__v')
    .lean();

  // Related scholarships via applicability
  const applicabilityLinks = await ScholarshipApplicability.find({
    programId: doc._id,
    status: 'published',
  }).lean();

  const scholarshipIds = applicabilityLinks.map((a) => a.scholarshipId);
  const relatedScholarships = scholarshipIds.length
    ? await CanonicalScholarship.find({
        _id: { $in: scholarshipIds },
        status: 'published',
      })
        .select('_id slug title scholarshipType funding.type destinationCountries degreeLevels')
        .lean()
    : [];

  const warning = freshnessWarning(doc.freshnessState);

  res.json({
    data: projectProgram(doc),
    requirements: requirements.map(projectPublicProgramRequirement),
    acceptedTests: acceptedTests.map(projectPublicAcceptance),
    relatedScholarships,
    ...(warning ? { freshnessWarning: warning } : {}),
  });
});

// ── Factual comparison (max 3 programs) ──────────────────────────────────────

export const comparePrograms = asyncHandler(async (req, res) => {
  const raw = req.query.ids || req.query.slugs;
  if (!raw) return res.status(400).json({ error: 'ids or slugs query parameter required' });

  const items = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((s) => sanitizeString(s))
    .filter(Boolean)
    .slice(0, 3);

  if (items.length < 2) {
    return res.status(400).json({ error: 'At least 2 items required for comparison' });
  }

  const isObjectId = /^[a-f0-9]{24}$/.test(items[0]);
  const filter = isObjectId
    ? { _id: { $in: items }, status: 'published' }
    : { slug: { $in: items }, status: 'published' };

  const docs = await Program.find(filter)
    .populate('institutionId', 'officialName slug countryCode')
    .select('-__v')
    .lean();

  const requirementsByProgram = await Promise.all(
    docs.map((d) =>
      ProgramRequirement.find({ programId: d._id, status: 'published' })
        .select('requirementType semantics description conditionNote')
        .lean()
    )
  );

  res.json({
    data: docs.map((d, i) => programComparisonFacts(d, requirementsByProgram[i])),
  });
});
