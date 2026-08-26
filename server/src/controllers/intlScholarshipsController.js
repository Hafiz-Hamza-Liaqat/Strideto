import { IntlScholarship } from '../models/IntlScholarship.js';
import { University } from '../models/University.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { sanitizeString } from '../utils/sanitize.js';
import { freeTextCountryRegex } from '../../../shared/international/location.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildQuery(q) {
  const filter = { status: 'active' };
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

export const getIntlScholarshipById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await IntlScholarship.findById(id).populate('universityId', 'name country website description').lean();
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  res.json(doc);
});

export const listUniversities = asyncHandler(async (req, res) => {
  const data = await University.find({ status: 'active' }).sort({ name: 1 }).lean();
  res.json({ data });
});
