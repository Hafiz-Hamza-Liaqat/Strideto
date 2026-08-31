/**
 * Public test catalog controller (Mission 4).
 *
 * Only published records are exposed. Draft/archived records are never returned.
 */
import { Test } from '../../models/education/Test.js';
import { TestProvider } from '../../models/education/TestProvider.js';
import { TestPrepGuide } from '../../models/education/TestPrepGuide.js';
import { ExternalTestResource } from '../../models/education/ExternalTestResource.js';
import { TestAlert } from '../../models/education/TestAlert.js';
import { CountryEducation } from '../../models/education/CountryEducation.js';
import { CanonicalInstitution } from '../../models/education/CanonicalInstitution.js';
import { Program } from '../../models/education/Program.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import {
  projectPublicCanonicalInstitution,
  projectPublicProgram,
} from '../../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { withFixtureExclusion } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { isTestPubliclyPromotable } from '../../../../shared/education/testPublicationPolicy.js';
import { currentAcceptanceMongoFilter } from '../../../../shared/publicDiscovery/publicTruth.js';

const PAGE_SIZE = 20;

function parsePage(query) {
  const p = parseInt(query.page, 10);
  return p > 0 ? p : 1;
}

function parseLimit(query, max = PAGE_SIZE) {
  const l = parseInt(query.limit, 10);
  return l > 0 && l <= max ? l : max;
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const listTests = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = { status: 'published' };

  if (q.category) filter.category = sanitizeString(q.category);
  if (q.providerId) filter.providerId = sanitizeString(q.providerId);
  if (q.deliveryMode) filter.deliveryModes = sanitizeString(q.deliveryMode);
  if (q.country) filter.countryCodes = sanitizeString(q.country).toUpperCase();
  if (q.search) {
    filter.$text = { $search: sanitizeString(q.search) };
  }

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [rawData] = await Promise.all([
    Test.find(filter)
      .populate('providerId', 'name slug officialWebsite status')
      .sort({ displayOrder: 1, name: 1 })
      .lean(),
  ]);

  const eligibleData = rawData.filter((test) => isTestPubliclyPromotable(test));
  const data = eligibleData.slice(skip, skip + limit);
  const total = eligibleData.length;
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

/**
 * Public factual comparison of the canonical Test catalog.
 * One bounded request supplies the comparison rows and coverage labels;
 * it never treats Strideto's records as a global acceptance census.
 */
export const compareTests = asyncHandler(async (req, res) => {
  const rawSlugs = req.query?.slugs;
  const slugs = rawSlugs
    ? (Array.isArray(rawSlugs) ? rawSlugs : String(rawSlugs).split(','))
      .map((value) => sanitizeString(value))
      .filter(Boolean)
      .slice(0, 12)
    : null;
  const filter = { status: 'published', ...(slugs?.length ? { slug: { $in: slugs } } : {}) };
  const tests = await Test.find(filter)
    .populate('providerId', 'name slug officialWebsite status')
    .sort({ displayOrder: 1, name: 1 })
    .lean();
  const eligible = tests.filter((test) => isTestPubliclyPromotable(test));
  const ids = eligible.map((test) => test._id);

  const [guides, resources, acceptanceCounts] = await Promise.all([
    TestPrepGuide.find({ testId: { $in: ids }, status: 'published' }).select('testId').lean(),
    ExternalTestResource.find({ testId: { $in: ids }, status: 'published' }).select('testId trustLevel').lean(),
    TestAcceptance.aggregate([
      { $match: { testId: { $in: ids }, ...currentAcceptanceMongoFilter() } },
      { $group: { _id: '$testId', count: { $sum: 1 } } },
    ]),
  ]);
  const guideIds = new Set(guides.map((guide) => String(guide.testId)));
  const resourceCounts = new Map();
  for (const resource of resources) {
    const key = String(resource.testId);
    resourceCounts.set(key, (resourceCounts.get(key) || 0) + 1);
  }
  const acceptanceByTest = new Map(acceptanceCounts.map((item) => [String(item._id), item.count]));

  res.json({
    data: eligible.map((test) => ({
      ...test,
      prepGuideAvailable: guideIds.has(String(test._id)),
      resourceCount: resourceCounts.get(String(test._id)) || 0,
      verifiedAcceptanceCount: acceptanceByTest.get(String(test._id)) || 0,
      acceptanceCoverageLabel: 'Verified requirements currently available on Strideto',
    })),
    total: eligible.length,
  });
});

export const getTest = asyncHandler(async (req, res) => {
  const test = await Test.findOne({
    slug: req.params.slug,
    status: 'published',
  })
    .populate('providerId', 'name slug officialWebsite registrationUrl status')
    .lean();

  if (!test || !isTestPubliclyPromotable(test)) return res.status(404).json({ error: 'Test not found' });

  const [prepGuide, resources, alerts] = await Promise.all([
    TestPrepGuide.findOne({ testId: test._id, status: 'published' }).lean(),
    ExternalTestResource.find({ testId: test._id, status: 'published' })
      .sort({ trustLevel: 1, resourceType: 1 })
      .lean(),
    TestAlert.find({
      testId: test._id,
      publicationStatus: 'published',
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    })
      .sort({ importance: -1, effectiveDate: -1 })
      .limit(10)
      .lean(),
  ]);

  res.json({ test, prepGuide: prepGuide || null, resources, alerts });
});

export const getTestPrepGuide = asyncHandler(async (req, res) => {
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' })
    .populate('providerId', 'name officialWebsite status')
    .lean();
  if (!test || !isTestPubliclyPromotable(test)) return res.status(404).json({ error: 'Test not found' });

  const guide = await TestPrepGuide.findOne({ testId: test._id, status: 'published' }).lean();
  if (!guide) return res.status(404).json({ error: 'Preparation guide not found' });

  res.json(guide);
});

export const getTestResources = asyncHandler(async (req, res) => {
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' })
    .populate('providerId', 'name officialWebsite status')
    .lean();
  if (!test || !isTestPubliclyPromotable(test)) return res.status(404).json({ error: 'Test not found' });

  const q = req.query || {};
  const filter = { testId: test._id, status: 'published' };
  if (q.resourceType) filter.resourceType = sanitizeString(q.resourceType);
  if (q.trustLevel) filter.trustLevel = sanitizeString(q.trustLevel);

  const data = await ExternalTestResource.find(filter)
    .sort({ trustLevel: 1, resourceType: 1, title: 1 })
    .lean();

  res.json({ data });
});

export const getTestAlerts = asyncHandler(async (req, res) => {
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' })
    .populate('providerId', 'name officialWebsite status')
    .lean();
  if (!test || !isTestPubliclyPromotable(test)) return res.status(404).json({ error: 'Test not found' });

  const data = await TestAlert.find({
    testId: test._id,
    publicationStatus: 'published',
    $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
  })
    .sort({ importance: -1, effectiveDate: -1 })
    .lean();

  res.json({ data });
});

// ── Providers ────────────────────────────────────────────────────────────────

export const listProviders = asyncHandler(async (req, res) => {
  const data = await TestProvider.find({ status: 'active' }).sort({ name: 1 }).lean();
  res.json({ data });
});

// ── Country education ────────────────────────────────────────────────────────

export const listCountryEducation = asyncHandler(async (req, res) => {
  const data = await CountryEducation.find({ status: 'published' }).sort({ countryCode: 1 }).lean();
  res.json({ data });
});

export const getCountryEducation = asyncHandler(async (req, res) => {
  const code = sanitizeString(req.params.code).toUpperCase();
  const doc = await CountryEducation.findOne({
    $or: [{ countryCode: code }, { slug: code.toLowerCase() }],
    status: 'published',
  }).lean();
  if (!doc) return res.status(404).json({ error: 'Country education record not found' });
  res.json(doc);
});

// ── Institutions ─────────────────────────────────────────────────────────────

export const listInstitutions = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = withFixtureExclusion({ status: 'published' });

  if (q.country) filter.countryCode = sanitizeString(q.country).toUpperCase();
  if (q.institutionType) filter.institutionType = sanitizeString(q.institutionType);

  const region = sanitizeString(q.region || q.state || q.province);
  const city = sanitizeString(q.city);
  if (region) {
    filter.region = new RegExp(region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (city) {
    filter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (q.search) {
    const term = sanitizeString(q.search).slice(0, 80);
    if (term) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { officialName: re },
        { slug: re },
        { officialDomain: re },
        { city: re },
        { region: re },
      ];
    }
  }

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [raw, total] = await Promise.all([
    CanonicalInstitution.find(filter).sort({ officialName: 1 }).skip(skip).limit(limit).lean(),
    CanonicalInstitution.countDocuments(filter),
  ]);

  const ids = raw.map((d) => d._id);
  const programCounts = ids.length
    ? await Program.aggregate([
      { $match: withFixtureExclusion({ status: 'published', institutionId: { $in: ids } }) },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } },
    ])
    : [];
  const countById = new Map(programCounts.map((r) => [String(r._id), r.count]));

  res.json({
    data: raw.map((doc) => ({
      ...projectPublicCanonicalInstitution(doc),
      programCount: countById.get(String(doc._id)) || 0,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export const getInstitution = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const doc = await CanonicalInstitution.findOne(
    withFixtureExclusion({ slug, status: 'published' })
  ).lean();
  if (!doc) return res.status(404).json({ error: 'Institution not found' });

  const programs = await Program.find(
    withFixtureExclusion({ institutionId: doc._id, status: 'published' })
  )
    .select('-__v')
    .sort({ name: 1 })
    .lean();

  res.json({
    data: projectPublicCanonicalInstitution(doc),
    programs: programs.map(projectPublicProgram),
    programCount: programs.length,
  });
});
