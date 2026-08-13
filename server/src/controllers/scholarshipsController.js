import { Scholarship } from '../models/Scholarship.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';
import { projectPublicCmsScholarship } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildScholarshipQuery(q) {
  const filter = withFixtureExclusion({ status: 'active' });
  if (q.level) filter.level = q.level;
  if (q.country) filter.country = new RegExp(q.country.trim(), 'i');
  if (q.deadline) {
    const d = new Date(q.deadline);
    if (!isNaN(d.getTime())) filter.deadline = { $gte: d };
  }
  if (q.search && q.search.trim()) {
    const re = new RegExp(q.search.trim(), 'i');
    filter.$or = [{ title: re }, { provider: re }, { country: re }];
  }
  return filter;
}

function buildScholarshipSort(sort) {
  if (sort === 'deadline') return { deadline: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export const getScholarships = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'deadline' ? 'deadline' : 'newest';
  const query = withListLocaleFilter(buildScholarshipQuery(req.query), getRequestLocale(req));
  const [data, total] = await Promise.all([
    Scholarship.find(query).sort(buildScholarshipSort(sort)).skip(skip).limit(limit).lean(),
    Scholarship.countDocuments(query),
  ]);
  res.json(listResponse(data.map((d) => projectPublicCmsScholarship(d)), paginate(page, limit, total), req.query));
});

export const getScholarshipByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const locale = getRequestLocale(req);
  const baseFilter = withFixtureExclusion({ status: 'active' });
  const scholarship = isObjectIdParam(idOrSlug)
    ? await findLocalizedById(Scholarship, idOrSlug, baseFilter, locale)
    : await findLocalizedBySlug(Scholarship, idOrSlug, baseFilter, locale);
  if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });
  await Scholarship.findByIdAndUpdate(scholarship._id, { $inc: { views: 1 } });
  const docLocale = scholarship.locale || locale;
  const relatedFilter = withListLocaleFilter({ status: 'active', _id: { $ne: scholarship._id } }, docLocale);
  if (scholarship.level) relatedFilter.level = scholarship.level;
  else if (scholarship.country) relatedFilter.country = scholarship.country;
  const related = await Scholarship.find(relatedFilter).sort({ deadline: 1 }).limit(4).lean();
  res.json(projectPublicCmsScholarship(scholarship, { related }));
});
