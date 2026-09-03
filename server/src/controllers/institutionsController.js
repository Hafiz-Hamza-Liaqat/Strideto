import mongoose from 'mongoose';
import { Institution } from '../models/Institution.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { freeTextCountryRegex } from '../../../shared/international/location.js';
import {
  projectPublicLegacyInstitution,
  projectPublicLegacyInstitutionListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const TYPES = ['school', 'college', 'technical_institute', 'training_center'];

function buildQuery(q) {
  const filter = { status: 'active' };
  if (q.type && TYPES.includes(q.type)) filter.type = q.type;
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.province || q.region) filter.province = new RegExp(String(q.province || q.region).trim(), 'i');
  if (q.city) filter.city = new RegExp(String(q.city).trim(), 'i');
  if (q.search && String(q.search).trim()) {
    const re = new RegExp(String(q.search).trim(), 'i');
    filter.$or = [{ name: re }, { description: re }, { city: re }, { programs: re }, { country: re }];
  }
  return filter;
}

export const getInstitutions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    Institution.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Institution.countDocuments(query),
  ]);
  res.json(listResponse(data.map(projectPublicLegacyInstitutionListItem), paginate(page, limit, total), req.query));
});

export const getInstitutionBySlug = asyncHandler(async (req, res) => {
  const { slugOrId } = req.params;
  const isId = mongoose.Types.ObjectId.isValid(slugOrId) && String(new mongoose.Types.ObjectId(slugOrId)) === slugOrId;
  const doc = isId
    ? await Institution.findOne({ _id: slugOrId, status: 'active' }).lean()
    : await Institution.findOne({ slug: slugOrId, status: 'active' }).lean();
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  Institution.updateOne({ _id: doc._id }, { $inc: { views: 1 } }).catch(() => {});
  const related = await Institution.find({
    status: 'active',
    _id: { $ne: doc._id },
    $or: [{ type: doc.type }, { province: doc.province }],
  }).limit(4).lean();
  res.json(projectPublicLegacyInstitution(doc, { related }));
});

export const getInstitutionFilters = asyncHandler(async (_req, res) => {
  const [provinces, cities, countries] = await Promise.all([
    Institution.distinct('province', { status: 'active', province: { $nin: [null, ''] } }),
    Institution.distinct('city', { status: 'active', city: { $nin: [null, ''] } }),
    Institution.distinct('country', { status: 'active', country: { $nin: [null, ''] } }),
  ]);
  res.json({ types: TYPES, provinces: provinces.sort(), cities: cities.sort(), countries: countries.sort() });
});
