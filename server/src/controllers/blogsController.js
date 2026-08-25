import { Blog } from '../models/Blog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function projectPublicBlogAuthor(blog) {
  if (blog.authorName) return blog.authorName;
  if (blog.author && typeof blog.author === 'object' && blog.author.name) return blog.author.name;
  return undefined;
}

function buildQuery(q) {
  const filter = { status: 'published' };
  if (q.category) filter.category = new RegExp(String(q.category).trim(), 'i');
  if (q.tags) {
    const tags = Array.isArray(q.tags) ? q.tags : [q.tags].filter(Boolean).map(String);
    if (tags.length) filter.tags = { $in: tags };
  }
  if (q.search && String(q.search).trim()) {
    const re = new RegExp(String(q.search).trim(), 'i');
    filter.$or = [{ title: re }, { content: re }, { excerpt: re }];
  }
  return filter;
}

export const getBlogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'views' ? { views: -1, publishedAt: -1 } : { publishedAt: -1, createdAt: -1 };
  const query = withListLocaleFilter(buildQuery(req.query), getRequestLocale(req));
  const [rows, total] = await Promise.all([
    Blog.find(query).sort(sort).skip(skip).limit(limit).populate('author', 'name').lean(),
    Blog.countDocuments(query),
  ]);
  const data = rows.map((row) => ({
    ...row,
    authorDisplay: projectPublicBlogAuthor(row),
  }));
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getBlogByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const locale = getRequestLocale(req);
  const baseFilter = { status: 'published' };
  let blog = isObjectIdParam(idOrSlug)
    ? await findLocalizedById(Blog, idOrSlug, baseFilter, locale)
    : await findLocalizedBySlug(Blog, idOrSlug, baseFilter, locale);
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  if (blog.author) {
    blog = await Blog.findById(blog._id).populate('author', 'name').lean();
  }
  await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
  res.json({
    ...blog,
    views: (blog.views || 0) + 1,
    authorDisplay: projectPublicBlogAuthor(blog),
  });
});
