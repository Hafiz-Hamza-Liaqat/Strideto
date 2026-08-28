import { IntlScholarship } from '../models/IntlScholarship.js';
import { University } from '../models/University.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { sanitizeString } from '../utils/sanitize.js';
import { freeTextCountryRegex } from '../../../shared/international/location.js';
import { isObjectIdParam } from '../utils/localeQuery.js';
import { clusterResourceLinks } from '../../../shared/seo/contentClusters.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const PUBLIC_STATUS = 'active';

function buildQuery(q) {
  const filter = { status: PUBLIC_STATUS };
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.university) filter.$or = [{ university: new RegExp(sanitizeString(q.university), 'i') }, { universityId: q.university }];
  if (q.universityId && mongoose.Types.ObjectId.isValid(q.universityId)) filter.universityId = q.universityId;
  if (q.deadline === 'upcoming') filter.$and = [{ $or: [{ deadline: { $gte: new Date() } }, { applicationDeadline: { $gte: new Date() } }] }];
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    (filter.$and = filter.$and || []).push({ $or: [{ title: re }, { country: re }, { university: re }, { description: re }] });
  }
  return filter;
}

async function findPublicIntlScholarship(idOrSlug) {
  const baseFilter = { status: PUBLIC_STATUS };
  const populate = { path: 'universityId', select: 'name country website description' };
  if (isObjectIdParam(idOrSlug)) {
    return IntlScholarship.findOne({ ...baseFilter, _id: idOrSlug }).populate(populate).lean();
  }
  return IntlScholarship.findOne({ ...baseFilter, slug: idOrSlug }).populate(populate).lean();
}

export const listIntlScholarships = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    IntlScholarship.find(query).populate('universityId', 'name country website').sort({ deadline: 1 }).skip(skip).limit(limit).lean(),
    IntlScholarship.countDocuments(query),
  ]);
  const pagination = paginate(page, limit, total);
  res.json(listResponse(data, pagination, req.query));
});

export const getIntlScholarshipByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const key = String(idOrSlug || '').trim();
  if (!key) return res.status(404).json({ error: 'Scholarship not found' });

  const doc = await findPublicIntlScholarship(key);
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });

  const relatedCandidates = await IntlScholarship.find({
    status: PUBLIC_STATUS,
    _id: { $ne: doc._id },
  })
    .sort({ deadline: 1, applicationDeadline: 1 })
    .limit(24)
    .lean();
  const related = relatedCandidates
    .map((candidate) => {
      let score = 0;
      if (doc.country && candidate.country === doc.country) score += 30;
      if (doc.universityId && String(candidate.universityId) === String(doc.universityId)) score += 25;
      if (doc.level && candidate.level === doc.level) score += 20;
      return { candidate, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((row) => row.candidate);

  const slugPath = doc.slug || doc._id;
  const relatedResources = clusterResourceLinks('international-study', {
    maxItems: 4,
    currentPath: `/intl-scholarships/${slugPath}`,
  });

  const payload = { ...doc, related, relatedResources };
  if (isObjectIdParam(key) && doc.slug) {
    payload.canonicalSlug = doc.slug;
  }
  res.json(payload);
});

/** @deprecated alias — use getIntlScholarshipByIdOrSlug */
export const getIntlScholarshipById = getIntlScholarshipByIdOrSlug;

export const listUniversities = asyncHandler(async (req, res) => {
  const data = await University.find({ status: 'active' }).sort({ name: 1 }).lean();
  res.json({ data });
});
