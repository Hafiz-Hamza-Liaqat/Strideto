/**
 * Public Scholarship Intelligence controller (Mission 7).
 *
 * Returns only published, source-backed scholarship data.
 * adminNotes is never projected.
 * No personalized eligibility decisions are made here (Mission 8).
 * Factual comparison is bounded to 3 items; no ranking.
 */
import { CanonicalScholarship } from '../../models/education/CanonicalScholarship.js';
import { ScholarshipCycle } from '../../models/education/ScholarshipCycle.js';
import { ScholarshipApplicability } from '../../models/education/ScholarshipApplicability.js';
import { Program } from '../../models/education/Program.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import {
  projectPublicScholarship,
  scholarshipComparisonFacts,
} from '../../../../shared/education/scholarshipIntelligence.js';
import { FRESHNESS_STATES } from '../../../../shared/trust/sourceVerification.js';
import { buildApplicabilityScopeSummary } from '../../../../shared/publicDiscovery/unifiedScholarshipDiscovery.js';

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

function buildFilter(q) {
  const filter = { status: 'published' };
  if (q.country) {
    const c = sanitizeString(q.country).toUpperCase();
    filter.destinationCountries = c;
  }
  if (q.degree) filter.degreeLevels = sanitizeString(q.degree);
  if (q.field) filter.fields = sanitizeString(q.field);
  if (q.scholarshipType) filter.scholarshipType = sanitizeString(q.scholarshipType);
  if (q.fundingType) filter['funding.type'] = sanitizeString(q.fundingType);
  if (q.applicationMethod) filter.applicationMethod = sanitizeString(q.applicationMethod);
  if (q.providerType) filter['provider.providerType'] = sanitizeString(q.providerType);
  return filter;
}

// Stale/broken-source truthfulness warning
function freshnessWarning(freshnessState) {
  if (freshnessState === FRESHNESS_STATES.STALE) {
    return 'This record has not been recently verified. Information may have changed.';
  }
  if (freshnessState === FRESHNESS_STATES.BROKEN) {
    return 'The source for this record is currently unavailable. Historical data preserved.';
  }
  return null;
}

// ── List scholarships ─────────────────────────────────────────────────────────

export const listScholarships = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = buildFilter(q);
  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    CanonicalScholarship.find(filter)
      .select('-adminNotes -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CanonicalScholarship.countDocuments(filter),
  ]);

  res.json({
    data: raw.map(projectPublicScholarship),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── Get single scholarship by slug ────────────────────────────────────────────

export const getScholarship = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const doc = await CanonicalScholarship.findOne({ slug, status: 'published' })
    .populate('institutionId', 'officialName slug countryCode region city status isFixture demoOnly')
    .select('-adminNotes -__v')
    .lean();
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });

  // Current/upcoming cycles
  const cycles = await ScholarshipCycle.find({
    scholarshipId: doc._id,
    status: 'published',
    isHistorical: false,
  })
    .select('-adminNotes -__v')
    .sort({ deadlineAt: 1 })
    .lean();

  // Applicability
  const applicability = await ScholarshipApplicability.find({
    scholarshipId: doc._id,
    status: 'published',
  })
    .populate('institutionId', 'officialName slug countryCode')
    .populate('programId', 'name slug degreeLevel field')
    .select('-__v')
    .lean();

  const applicablePrograms = Array.isArray(doc.applicableProgramIds) && doc.applicableProgramIds.length
    ? await Program.find({ _id: { $in: doc.applicableProgramIds }, status: 'published' })
      .select('name slug degreeLevel field')
      .lean()
    : [];

  const warning = freshnessWarning(doc.freshnessState);

  const institution = doc.institutionId && typeof doc.institutionId === 'object'
    ? {
        _id: doc.institutionId._id,
        officialName: doc.institutionId.officialName,
        slug: doc.institutionId.slug,
        countryCode: doc.institutionId.countryCode || '',
        region: doc.institutionId.region || '',
        city: doc.institutionId.city || '',
      }
    : null;

  // Institutional scholarships require a publicly discoverable institution.
  if (doc.scholarshipType === 'institutional') {
    const instDoc = doc.institutionId && typeof doc.institutionId === 'object' ? doc.institutionId : null;
    if (
      !instDoc
      || instDoc.status !== 'published'
      || instDoc.isFixture === true
      || instDoc.demoOnly === true
    ) {
      return res.status(404).json({ error: 'Scholarship not found' });
    }
  }

  const applicabilityScope = buildApplicabilityScopeSummary({
    applicability,
    applicablePrograms,
    cycleLabel: doc.cycleLabel || '',
    cycles,
  });

  res.json({
    data: {
      ...projectPublicScholarship(doc),
      institutionId: institution || doc.institutionId || null,
      applicablePrograms,
      applicabilityScope,
    },
    cycles,
    applicability,
    ...(warning ? { freshnessWarning: warning } : {}),
  });
});

// ── Factual comparison (max 3 scholarships) ───────────────────────────────────

export const compareScholarships = asyncHandler(async (req, res) => {
  const raw = req.query.ids || req.query.slugs;
  if (!raw) return res.status(400).json({ error: 'ids or slugs query parameter required' });

  const items = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((s) => sanitizeString(s))
    .filter(Boolean)
    .slice(0, 3); // cap at 3

  if (items.length < 2) {
    return res.status(400).json({ error: 'At least 2 items required for comparison' });
  }

  const isObjectId = /^[a-f0-9]{24}$/.test(items[0]);
  const filter = isObjectId
    ? { _id: { $in: items }, status: 'published' }
    : { slug: { $in: items }, status: 'published' };

  const docs = await CanonicalScholarship.find(filter)
    .select('-adminNotes -__v')
    .lean();

  res.json({
    data: docs.map(scholarshipComparisonFacts),
  });
});
