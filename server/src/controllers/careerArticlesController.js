import { CareerArticle } from '../models/CareerArticle.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';
import {
  projectPublicCareerArticle,
  projectPublicCareerArticleListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function buildQuery(q) {
  const filter = { status: 'published' };
  if (q.category) filter.category = new RegExp(String(q.category).trim(), 'i');
  if (q.search && String(q.search).trim()) {
    const re = new RegExp(String(q.search).trim(), 'i');
    filter.$or = [{ title: re }, { content: re }, { excerpt: re }];
  }
  return filter;
}

export const getCareerArticles = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = { publishedAt: -1, createdAt: -1 };
  const query = withListLocaleFilter(buildQuery(req.query), getRequestLocale(req));
  const [data, total] = await Promise.all([
    CareerArticle.find(query).sort(sort).skip(skip).limit(limit).lean(),
    CareerArticle.countDocuments(query),
  ]);
  res.json(listResponse(data.map(projectPublicCareerArticleListItem), paginate(page, limit, total), req.query));
});

export const getCareerArticleBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const locale = getRequestLocale(req);
  const baseFilter = { status: 'published' };
  const article = isObjectIdParam(slug)
    ? await findLocalizedById(CareerArticle, slug, baseFilter, locale)
    : await findLocalizedBySlug(CareerArticle, slug, baseFilter, locale);
  if (!article) return res.status(404).json({ error: 'Career article not found' });
  await CareerArticle.findByIdAndUpdate(article._id, { $inc: { views: 1 } });
  res.json(projectPublicCareerArticle(article));
});
