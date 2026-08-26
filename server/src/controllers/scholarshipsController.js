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
import { listUnifiedScholarships } from '../services/unifiedScholarshipDiscoveryService.js';

export const getScholarships = asyncHandler(async (req, res) => {
  const result = await listUnifiedScholarships(req);
  res.json(listResponse(
    result.data,
    paginate(result.page, result.limit, result.total),
    { ...req.query, sources: result.sources }
  ));
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
