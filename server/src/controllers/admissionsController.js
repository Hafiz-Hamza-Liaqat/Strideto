import { Admission } from '../models/Admission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';
import { projectPublicCmsAdmission } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { sanitizeString } from '../utils/sanitize.js';
import { normalizeCountryCode, coerceCountryCode } from '../../../shared/international/country.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildAdmissionQuery(q) {
  const filter = withFixtureExclusion({ status: 'active' });
  if (q.university) filter.institution = new RegExp(q.university.trim(), 'i');
  if (q.program) filter.$or = [{ program: new RegExp(q.program.trim(), 'i') }, { department: new RegExp(q.program.trim(), 'i') }];
  const countryCode = normalizeCountryCode(q.countryCode) || coerceCountryCode(q.country);
  if (countryCode) filter.countryCode = countryCode;
  if (q.province || q.region) {
    filter.province = new RegExp(sanitizeString(q.province || q.region), 'i');
  }
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.deadline) {
    const d = new Date(q.deadline);
    if (!isNaN(d.getTime())) filter.deadline = { $gte: d };
  }
  if (q.search && q.search.trim()) {
    const re = new RegExp(q.search.trim(), 'i');
    filter.$or = [{ program: re }, { institution: re }, { department: re }];
  }
  return filter;
}

function buildAdmissionSort(sort) {
  if (sort === 'deadline') return { deadline: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export const getAdmissions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'deadline' ? 'deadline' : 'newest';
  const query = withListLocaleFilter(buildAdmissionQuery(req.query), getRequestLocale(req));
  const [data, total] = await Promise.all([
    Admission.find(query).sort(buildAdmissionSort(sort)).skip(skip).limit(limit).lean(),
    Admission.countDocuments(query),
  ]);
  res.json(listResponse(data.map((d) => projectPublicCmsAdmission(d)), paginate(page, limit, total), req.query));
});

export const getAdmissionByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const locale = getRequestLocale(req);
  const baseFilter = withFixtureExclusion({ status: 'active' });
  const admission = isObjectIdParam(idOrSlug)
    ? await findLocalizedById(Admission, idOrSlug, baseFilter, locale)
    : await findLocalizedBySlug(Admission, idOrSlug, baseFilter, locale);
  if (!admission) return res.status(404).json({ error: 'Admission not found' });
  await Admission.findByIdAndUpdate(admission._id, { $inc: { views: 1 } });
  const docLocale = admission.locale || locale;
  const relatedFilter = withListLocaleFilter({ status: 'active', _id: { $ne: admission._id } }, docLocale);
  if (admission.institution) relatedFilter.institution = admission.institution;
  const related = await Admission.find(relatedFilter).sort({ deadline: 1 }).limit(4).lean();
  res.json(projectPublicCmsAdmission(admission, { related }));
});
