import { Scholarship } from '../../models/Scholarship.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { parseStringArray } from '../../utils/adminContentHelpers.js';
import { cacheDelPattern } from '../../config/redis.js';
import { CACHE_KEYS } from '../../utils/cacheKeys.js';
import { invalidateDynamicContentForEntity } from '../../utils/dynamicContentCache.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';
import { deriveCmsLaunchEligible, CMS_STATUS } from '../../../../shared/cms/launchEligible.js';
import { freeTextCountryRegex } from '../../../../shared/international/location.js';
import { countryDisplayName, coerceCountryCode } from '../../../../shared/international/country.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.level) filter.level = q.level;
  const countryRe = freeTextCountryRegex(q.country);
  if (countryRe) filter.country = countryRe;
  if (q.province || q.region) filter.province = new RegExp(sanitizeString(q.province || q.region), 'i');
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ title: re }, { provider: re }];
  }
  return filter;
}

async function invalidateCaches() {
  await cacheDelPattern(CACHE_KEYS.PREFIX_TRENDING);
  await cacheDelPattern(CACHE_KEYS.PREFIX_FEATURED);
  invalidateDynamicContentForEntity('scholarship');
}

function applyBody(doc, body, isCreate = false) {
  if (body.title !== undefined || isCreate) doc.title = sanitizeString(body.title);
  if (body.provider !== undefined || body.organization !== undefined || isCreate) {
    doc.provider = sanitizeString(body.provider || body.organization);
  }
  if (body.level !== undefined) doc.level = body.level;
  if (body.degreeLevel !== undefined) doc.degreeLevel = sanitizeString(body.degreeLevel);
  if (body.university !== undefined) doc.university = sanitizeString(body.university);
  if (body.country !== undefined || body.countryCode !== undefined) {
    const raw = body.country !== undefined ? body.country : body.countryCode;
    const code = coerceCountryCode(raw);
    doc.country = code ? (countryDisplayName(code) || sanitizeString(raw)) : sanitizeString(raw);
  }
  if (body.province !== undefined || body.region !== undefined) {
    doc.province = sanitizeString(body.province ?? body.region);
  }
  if (body.city !== undefined) doc.city = sanitizeString(body.city);
  if (body.amount !== undefined || body.funding !== undefined) {
    doc.amount = sanitizeString(body.amount || body.funding);
  }
  if (body.fundingType !== undefined) doc.fundingType = body.fundingType;
  if (body.description !== undefined) doc.description = sanitizeString(body.description);
  const eligibility = parseStringArray(body.eligibility);
  if (eligibility !== undefined) doc.eligibility = eligibility;
  const tags = parseStringArray(body.tags);
  if (tags !== undefined) doc.tags = tags;
  if (body.applicationInstructions !== undefined) doc.applicationInstructions = sanitizeString(body.applicationInstructions);
  if (body.deadline !== undefined) doc.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.link !== undefined || body.applicationLink !== undefined || body.applyLink !== undefined) {
    const linkVal = body.link ?? body.applicationLink ?? body.applyLink;
    doc.link = linkVal ? sanitizeString(linkVal) : '';
  }
  if (body.status !== undefined) doc.status = body.status;
  if (body.logoUrl !== undefined) doc.logoUrl = sanitizeString(body.logoUrl);
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.isSponsored !== undefined) doc.isSponsored = !!body.isSponsored;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
  syncScholarshipLaunchEligible(doc);
}

function syncScholarshipLaunchEligible(doc, before = null) {
  const existing = before || (doc.toObject ? doc.toObject() : doc);
  doc.launchEligible = deriveCmsLaunchEligible(existing, doc.status);
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const sortField = req.query.sort || 'createdAt';
  const sortDir = req.query.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Scholarship.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
    Scholarship.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Scholarship.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const provider = (body.provider || body.organization || '').trim();
  if (!body.title || !String(body.title).trim()) {
    return res.status(400).json({ error: 'Validation failed', details: { title: 'Title is required' } });
  }
  if (!provider) {
    return res.status(400).json({ error: 'Validation failed', details: { provider: 'Provider or organization is required' } });
  }
  const doc = new Scholarship({ status: body.status || CMS_STATUS.DRAFT, launchEligible: false });
  applyBody(doc, body, true);
  const slugErr = await applyResolvedSlug('scholarship', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('scholarships', doc);
  await invalidateCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: 'scholarship.create',
    targetType: 'scholarship',
    targetId: doc._id,
    targetLabel: doc.title,
    after: { title: doc.title, status: doc.status },
  });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const body = req.body || {};
  const doc = await Scholarship.findById(id);
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  const before = doc.toObject();
  applyBody(doc, body);
  syncScholarshipLaunchEligible(doc, before);
  const slugErr = await applyResolvedSlug('scholarship', doc, body, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('scholarships', doc);
  await invalidateCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: 'scholarship.update',
    targetType: 'scholarship',
    targetId: id,
    targetLabel: doc.title,
    before: { title: before.title, status: before.status },
    after: { title: doc.title, status: doc.status },
    reason: body.reason || '',
  });
  res.json(doc);
});

export const duplicate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const source = await Scholarship.findById(id).lean();
  if (!source) return res.status(404).json({ error: 'Scholarship not found' });
  delete source._id;
  delete source.createdAt;
  delete source.updatedAt;
  source.title = `${source.title} (Copy)`;
  source.status = CMS_STATUS.DRAFT;
  source.launchEligible = false;
  source.views = 0;
  delete source.slug;
  const doc = new Scholarship(source);
  const slugErr = await applyResolvedSlug('scholarship', doc, { title: source.title, country: source.country }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('scholarships', doc);
  await invalidateCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: 'scholarship.duplicate',
    targetType: 'scholarship',
    targetId: doc._id,
    targetLabel: doc.title,
    metadata: { sourceId: id },
  });
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids = [] } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (action === 'delete') {
    const result = await Scholarship.deleteMany({ _id: { $in: validIds } });
    onContentBulkDeleted('scholarships', validIds);
    await invalidateCaches();
    await logAudit({
      ...auditFromRequest(req),
      action: 'scholarship.bulk_delete',
      targetType: 'scholarship',
      metadata: { ids: validIds, deleted: result.deletedCount },
    });
    return res.json({ action, affected: result.deletedCount });
  }

  const updates = {};
  let auditAction = 'scholarship.bulk';
  if (action === 'archive') {
    updates.status = CMS_STATUS.CLOSED;
    updates.launchEligible = false;
    auditAction = 'scholarship.bulk_archive';
  } else if (action === 'publish') {
    const docs = await Scholarship.find({ _id: { $in: validIds } }).lean();
    let modified = 0;
    for (const row of docs) {
      const launchEligible = deriveCmsLaunchEligible(row, CMS_STATUS.ACTIVE);
      await Scholarship.updateOne({ _id: row._id }, { $set: { status: CMS_STATUS.ACTIVE, launchEligible } });
      modified += 1;
    }
    onContentBulkUpdated('scholarships', validIds);
    await invalidateCaches();
    await logAudit({
      ...auditFromRequest(req),
      action: 'scholarship.bulk_publish',
      targetType: 'scholarship',
      metadata: { ids: validIds, modified },
    });
    return res.json({ action, affected: modified });
  } else if (action === 'feature') {
    updates.isFeatured = true;
    auditAction = 'scholarship.bulk_feature';
  } else {
    return res.status(400).json({ error: 'Unknown bulk action' });
  }

  const result = await Scholarship.updateMany({ _id: { $in: validIds } }, { $set: updates });
  if (action === 'publish') onContentBulkUpdated('scholarships', validIds);
  await invalidateCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: auditAction,
    targetType: 'scholarship',
    metadata: { ids: validIds, modified: result.modifiedCount },
  });
  res.json({ action, affected: result.modifiedCount });
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Scholarship.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  await logAudit({
    ...auditFromRequest(req),
    action: 'scholarship.delete',
    targetType: 'scholarship',
    targetId: id,
    targetLabel: doc.title,
  });
  await invalidateCaches();
  onContentDeleted('scholarships', id);
  res.status(204).send();
});
