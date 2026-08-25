import { Blog } from '../../models/Blog.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { sanitizeHtml } from '../../utils/htmlSanitize.js';
import { parseStringArray } from '../../utils/adminContentHelpers.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { runBulkAction, duplicateDoc } from '../../utils/adminBulkHelper.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';
import { canonicalBlogCategoryLabel } from '../../../../shared/blog/taxonomy.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseOptionalDate(value) {
  if (value === '' || value == null) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function optionalUrl(value) {
  const s = sanitizeString(value);
  return s || undefined;
}

function blogValidationErrorResponse(err) {
  if (err.name === 'ValidationError') {
    const details = {};
    for (const [key, item] of Object.entries(err.errors || {})) {
      details[key] = item.message;
    }
    return { status: 400, body: { error: 'Validation failed', details } };
  }
  if (err.name === 'CastError') {
    return {
      status: 400,
      body: {
        error: 'Validation failed',
        details: { [err.path || 'field']: `Invalid ${err.path || 'value'}` },
      },
    };
  }
  return null;
}

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = new RegExp(sanitizeString(q.category), 'i');
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ title: re }, { content: re }, { excerpt: re }];
  }
  return filter;
}

function applyAuthorFields(doc, body) {
  if (body.authorName !== undefined) {
    doc.authorName = sanitizeString(body.authorName) || undefined;
  } else if (body.author !== undefined) {
    if (typeof body.author === 'string' && !mongoose.Types.ObjectId.isValid(body.author)) {
      doc.authorName = sanitizeString(body.author) || undefined;
    } else if (mongoose.Types.ObjectId.isValid(body.author)) {
      doc.author = body.author;
    }
  }
}

function applyBody(doc, body, isCreate = false) {
  if (body.title !== undefined || isCreate) doc.title = sanitizeString(body.title);
  if (body.excerpt !== undefined) doc.excerpt = sanitizeString(body.excerpt);
  if (body.content !== undefined) doc.content = sanitizeHtml(body.content);
  const tags = parseStringArray(body.tags);
  if (tags !== undefined) doc.tags = tags;
  const gallery = parseStringArray(body.gallery);
  if (gallery !== undefined) doc.gallery = gallery.filter(Boolean);
  if (body.category !== undefined) {
    doc.category = canonicalBlogCategoryLabel(body.category) || undefined;
  }
  applyAuthorFields(doc, body);
  if (body.views !== undefined) doc.views = Number(body.views) || 0;
  if (body.readingTime !== undefined) doc.readingTime = Number(body.readingTime) || undefined;
  if (body.status !== undefined) {
    doc.status = body.status;
    if (body.status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
  }
  if (body.publishedAt !== undefined) doc.publishedAt = parseOptionalDate(body.publishedAt);
  if (body.scheduledAt !== undefined) doc.scheduledAt = parseOptionalDate(body.scheduledAt);
  if (body.imageUrl !== undefined) doc.imageUrl = optionalUrl(body.imageUrl);
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle) || undefined;
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription) || undefined;
  if (body.canonicalUrl !== undefined) doc.canonicalUrl = optionalUrl(body.canonicalUrl);
  if (body.ogImageUrl !== undefined) doc.ogImageUrl = optionalUrl(body.ogImageUrl);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
}

async function saveBlog(doc) {
  try {
    await doc.save();
    return null;
  } catch (err) {
    return blogValidationErrorResponse(err);
  }
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const sortField = req.query.sort || 'createdAt';
  const sortDir = req.query.order === 'asc' ? 1 : -1;
  const [data, total] = await Promise.all([
    Blog.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Blog.findById(req.params.id).populate('author', 'name email').lean();
  if (!doc) return res.status(404).json({ error: 'Blog not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.title?.trim()) {
    return res.status(400).json({ error: 'Validation failed', details: { title: 'Title is required' } });
  }
  const doc = new Blog({ author: req.user?.userId });
  applyBody(doc, body, true);
  const slugErr = await applyResolvedSlug('blog', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  const validationErr = await saveBlog(doc);
  if (validationErr) return res.status(validationErr.status).json(validationErr.body);
  onContentSaved('blogs', doc);
  await logAudit({ ...auditFromRequest(req), action: 'blog.create', targetType: 'blog', targetId: doc._id, targetLabel: doc.title });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Blog.findById(id);
  if (!doc) return res.status(404).json({ error: 'Blog not found' });
  const before = { title: doc.title, status: doc.status };
  applyBody(doc, req.body || {});
  const slugErr = await applyResolvedSlug('blog', doc, req.body || {}, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  const validationErr = await saveBlog(doc);
  if (validationErr) return res.status(validationErr.status).json(validationErr.body);
  onContentSaved('blogs', doc);
  await logAudit({ ...auditFromRequest(req), action: 'blog.update', targetType: 'blog', targetId: id, targetLabel: doc.title, before, after: { title: doc.title, status: doc.status } });
  res.json(doc);
});

export const duplicate = asyncHandler(async (req, res) => {
  const doc = await duplicateDoc(Blog, req.params.id, (s) => {
    s.title = `${s.title} (Copy)`;
    delete s.slug;
    s.status = 'draft';
    s.views = 0;
    delete s.publishedAt;
  });
  if (!doc) return res.status(404).json({ error: 'Blog not found' });
  const slugErr = await applyResolvedSlug('blog', doc, { title: doc.title }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await logAudit({ ...auditFromRequest(req), action: 'blog.duplicate', targetType: 'blog', targetId: doc._id, targetLabel: doc.title });
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids } = req.body || {};
  const result = await runBulkAction({ req, Model: Blog, ids, action, auditType: 'blog' });
  const validIds = (ids || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (result.status === 200) {
    if (action === 'delete') onContentBulkDeleted('blogs', validIds);
    if (action === 'publish') onContentBulkUpdated('blogs', validIds);
  }
  res.status(result.status).json(result.body);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Blog.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Blog not found' });
  onContentDeleted('blogs', id);
  await logAudit({ ...auditFromRequest(req), action: 'blog.delete', targetType: 'blog', targetId: id, targetLabel: doc.title });
  res.status(204).send();
});
