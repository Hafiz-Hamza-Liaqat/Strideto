import { Blog } from '../models/Blog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { rankRelatedBlogPosts } from '../../../shared/blog/relatedPosts.js';
import { blogClusterResourceLinks } from '../../../shared/seo/contentClusters.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';
import {
  projectPublicBlog,
  projectPublicBlogListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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
  const data = rows.map(projectPublicBlogListItem);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

async function loadCuratedRelatedArticles(blog) {
  const ids = (blog.relatedArticleIds || []).filter(Boolean);
  if (!ids.length) return [];
  return Blog.find({ _id: { $in: ids }, status: 'published' })
    .select('title slug excerpt publishedAt updatedAt category tags status canonicalUrl')
    .lean();
}

async function loadRelatedBlogCandidates(blog, locale) {
  const filter = withListLocaleFilter({ status: 'published', _id: { $ne: blog._id } }, locale);
  return Blog.find(filter)
    .select('title slug excerpt publishedAt updatedAt category tags status canonicalUrl')
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(30)
    .lean();
}

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
  const [curated, candidates] = await Promise.all([
    loadCuratedRelatedArticles(blog),
    loadRelatedBlogCandidates(blog, blog.locale || locale),
  ]);
  const relatedResult = rankRelatedBlogPosts(blog, candidates, {
    limit: 3,
    curated,
    excludeSlug: blog.slug,
    excludeId: blog._id,
  });
  const currentPath = `/blog/${blog.slug}`;
  const relatedResources = blogClusterResourceLinks(blog.category, {
    maxItems: 4,
    currentPath,
  });
  await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
  res.json({
    ...projectPublicBlog(blog),
    relatedPosts: relatedResult.items.map(projectPublicBlogListItem).filter(Boolean),
    relatedPostsMeta: {
      relation: relatedResult.relation,
      usedFallback: relatedResult.usedFallback,
    },
    relatedResources,
  });
});
