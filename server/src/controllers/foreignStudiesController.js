import { ForeignStudy } from '../models/ForeignStudy.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { freeTextCountryRegex } from '../../../shared/international/location.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildQuery(q) {
  const filter = { status: 'active' };
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.level) filter.level = q.level;
  if (q.deadline) {
    const d = new Date(q.deadline);
    if (!isNaN(d.getTime())) filter.deadline = { $gte: d };
  }
  if (q.search && String(q.search).trim()) {
    const re = new RegExp(String(q.search).trim(), 'i');
    filter.$or = [{ country: re }, { program: re }, { institution: re }];
  }
  return filter;
}

function buildSort(sort) {
  if (sort === 'deadline') return { deadline: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export const getForeignStudies = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'deadline' ? 'deadline' : 'newest';
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    ForeignStudy.find(query).sort(buildSort(sort)).skip(skip).limit(limit).lean(),
    ForeignStudy.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getForeignStudyByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const isId = mongoose.Types.ObjectId.isValid(idOrSlug) && String(new mongoose.Types.ObjectId(idOrSlug)) === idOrSlug;
  const doc = isId
    ? await ForeignStudy.findOne({ _id: idOrSlug, status: 'active' }).lean()
    : await ForeignStudy.findOne({ slug: idOrSlug, status: 'active' }).lean();
  if (!doc) return res.status(404).json({ error: 'Foreign study not found' });
  const related = await ForeignStudy.find({ status: 'active', _id: { $ne: doc._id }, country: doc.country }).sort({ deadline: 1 }).limit(4).lean();
  res.json({ ...doc, related });
});
