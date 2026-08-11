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
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { projectPublicCanonicalInstitution } from '../../../../shared/publicDiscovery/projectPublicDiscovery.js';

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

  const [data, total] = await Promise.all([
    Test.find(filter)
      .populate('providerId', 'name slug officialWebsite')
      .sort({ displayOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Test.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getTest = asyncHandler(async (req, res) => {
  const test = await Test.findOne({
    slug: req.params.slug,
    status: 'published',
  })
    .populate('providerId', 'name slug officialWebsite registrationUrl')
    .lean();

  if (!test) return res.status(404).json({ error: 'Test not found' });

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
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' }).lean();
  if (!test) return res.status(404).json({ error: 'Test not found' });

  const guide = await TestPrepGuide.findOne({ testId: test._id, status: 'published' }).lean();
  if (!guide) return res.status(404).json({ error: 'Preparation guide not found' });

  res.json(guide);
});

export const getTestResources = asyncHandler(async (req, res) => {
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' }).lean();
  if (!test) return res.status(404).json({ error: 'Test not found' });

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
  const test = await Test.findOne({ slug: req.params.slug, status: 'published' }).lean();
  if (!test) return res.status(404).json({ error: 'Test not found' });

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
  const filter = { status: 'published' };

  if (q.country) filter.countryCode = sanitizeString(q.country).toUpperCase();
  if (q.institutionType) filter.institutionType = sanitizeString(q.institutionType);

  const page = parsePage(q);
  const limit = parseLimit(q);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    CanonicalInstitution.find(filter).sort({ officialName: 1 }).skip(skip).limit(limit).lean(),
    CanonicalInstitution.countDocuments(filter),
  ]);

  res.json({
    data: data.map(projectPublicCanonicalInstitution),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export const getInstitution = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const doc = await CanonicalInstitution.findOne({ slug, status: 'published' }).lean();
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  res.json(projectPublicCanonicalInstitution(doc));
});
