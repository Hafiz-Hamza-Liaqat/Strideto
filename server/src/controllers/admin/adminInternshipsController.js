import { Internship } from '../../models/Internship.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { parseStringArray } from '../../utils/adminContentHelpers.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { duplicateDoc } from '../../utils/adminBulkHelper.js';
import { deriveCmsLaunchEligible, CMS_STATUS } from '../../../../shared/cms/launchEligible.js';
import { normalizeCountryCode } from '../../../../shared/international/country.js';
import { scheduleSeoChangeNotification } from '../../services/seo/seoChangeNotificationService.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const WORK_MODES = new Set(['remote', 'hybrid', 'on_site', 'unspecified']);

function buildQuery(q) {
  const filter = {};
  const extraAnd = [];
  if (q.status) filter.status = q.status;
  const countryCode = normalizeCountryCode(q.countryCode || q.country);
  if (countryCode) filter.countryCode = countryCode;
  if (q.province || q.region) {
    const re = new RegExp(sanitizeString(q.province || q.region), 'i');
    extraAnd.push({ $or: [{ province: re }, { region: re }] });
  }
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.organization) filter.organization = new RegExp(sanitizeString(q.organization), 'i');
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    extraAnd.push({ $or: [{ title: re }, { organization: re }, { city: re }] });
  }
  if (extraAnd.length) filter.$and = extraAnd;
  return filter;
}

function syncInternshipLaunchEligible(doc, before = null) {
  const existing = before || (doc.toObject ? doc.toObject() : doc);
  doc.launchEligible = deriveCmsLaunchEligible(existing, doc.status);
}

function applyBody(doc, body) {
  if (body.title !== undefined) doc.title = sanitizeString(body.title);
  if (body.organization !== undefined) doc.organization = sanitizeString(body.organization);
  if (body.location !== undefined) doc.location = body.location ? sanitizeString(body.location) : undefined;
  if (body.countryCode !== undefined || body.country !== undefined) {
    const raw = body.countryCode !== undefined ? body.countryCode : body.country;
    doc.countryCode = normalizeCountryCode(raw) || '';
  }
  if (body.region !== undefined || body.province !== undefined) {
    const region = body.region !== undefined
      ? (body.region ? sanitizeString(body.region) : '')
      : (body.province ? sanitizeString(body.province) : '');
    doc.region = region || undefined;
    doc.province = region || undefined;
  }
  if (body.city !== undefined) doc.city = body.city ? sanitizeString(body.city) : undefined;
  if (body.workMode !== undefined && WORK_MODES.has(body.workMode)) {
    doc.workMode = body.workMode;
  }
  if (body.duration !== undefined) doc.duration = body.duration ? sanitizeString(body.duration) : undefined;
  if (body.internshipType !== undefined) doc.internshipType = sanitizeString(body.internshipType);
  const skillset = parseStringArray(body.skillset ?? body.skills);
  if (skillset !== undefined) doc.skillset = skillset;
  const eligibility = parseStringArray(body.eligibility);
  if (eligibility !== undefined) doc.eligibility = eligibility;
  if (body.description !== undefined) doc.description = body.description ? sanitizeString(body.description) : undefined;
  if (body.applicationLink !== undefined) doc.applicationLink = body.applicationLink ? sanitizeString(body.applicationLink) : undefined;
  if (body.applyInPlatform !== undefined) doc.applyInPlatform = !!body.applyInPlatform;
  if (body.status !== undefined) doc.status = body.status;
  if (body.deadline !== undefined) doc.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.isPaid !== undefined) doc.isPaid = !!body.isPaid;
  if (body.paidUntil !== undefined) doc.paidUntil = body.paidUntil ? new Date(body.paidUntil) : undefined;
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
  syncInternshipLaunchEligible(doc);
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    Internship.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Internship.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Internship.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Internship not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.title?.trim()) return res.status(400).json({ error: 'Validation failed', details: { title: 'Title is required' } });
  if (!body.organization?.trim()) return res.status(400).json({ error: 'Validation failed', details: { organization: 'Organization is required' } });
  const workMode = WORK_MODES.has(body.workMode) ? body.workMode : 'unspecified';
  const countryCode = normalizeCountryCode(body.countryCode || body.country);
  if (workMode !== 'remote' && !countryCode) {
    return res.status(400).json({ error: 'Validation failed', details: { countryCode: 'Country is required unless work mode is remote' } });
  }
  const doc = new Internship({
    title: sanitizeString(body.title),
    organization: sanitizeString(body.organization),
    status: body.status || CMS_STATUS.DRAFT,
    launchEligible: false,
    postedBy: req.user?.userId,
  });
  applyBody(doc, body);
  const slugErr = await applyResolvedSlug('internship', doc, { ...body, _id: doc._id }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  scheduleSeoChangeNotification({
    entityType: 'internship',
    next: doc,
    action: 'save',
  });
  await logAudit({ ...auditFromRequest(req), action: 'internship.create', targetType: 'internship', targetId: doc._id, targetLabel: doc.title });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Internship.findById(id);
  if (!doc) return res.status(404).json({ error: 'Internship not found' });
  const before = doc.toObject();
  applyBody(doc, req.body || {});
  syncInternshipLaunchEligible(doc, before);
  const slugErr = await applyResolvedSlug('internship', doc, { ...req.body, _id: doc._id }, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  scheduleSeoChangeNotification({
    entityType: 'internship',
    previous: before,
    next: doc,
    action: 'save',
  });
  await logAudit({ ...auditFromRequest(req), action: 'internship.update', targetType: 'internship', targetId: id, targetLabel: doc.title, before, after: { title: doc.title, status: doc.status, launchEligible: doc.launchEligible } });
  res.json(doc);
});

export const duplicate = asyncHandler(async (req, res) => {
  const doc = await duplicateDoc(Internship, req.params.id, (s) => {
    s.title = `${s.title} (Copy)`;
    delete s.slug;
    s.status = CMS_STATUS.DRAFT;
    s.launchEligible = false;
  });
  if (!doc) return res.status(404).json({ error: 'Internship not found' });
  const slugErr = await applyResolvedSlug('internship', doc, { title: doc.title, _id: doc._id }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await logAudit({ ...auditFromRequest(req), action: 'internship.duplicate', targetType: 'internship', targetId: doc._id, targetLabel: doc.title });
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids = [] } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return res.status(400).json({ error: 'No valid ids' });

  if (action === 'delete') {
    const result = await Internship.deleteMany({ _id: { $in: validIds } });
    await logAudit({ ...auditFromRequest(req), action: 'internship.bulk_delete', targetType: 'internship', metadata: { ids: validIds, deleted: result.deletedCount } });
    return res.json({ action, affected: result.deletedCount });
  }

  if (action === 'publish') {
    const docs = await Internship.find({ _id: { $in: validIds } }).lean();
    let modified = 0;
    for (const row of docs) {
      const launchEligible = deriveCmsLaunchEligible(row, CMS_STATUS.ACTIVE);
      await Internship.updateOne({ _id: row._id }, { $set: { status: CMS_STATUS.ACTIVE, launchEligible } });
      modified += 1;
    }
    await logAudit({ ...auditFromRequest(req), action: 'internship.bulk_publish', targetType: 'internship', metadata: { ids: validIds, modified } });
    return res.json({ action, affected: modified });
  }

  const updates = {};
  if (action === 'archive') {
    updates.status = CMS_STATUS.CLOSED;
    updates.launchEligible = false;
  } else if (action === 'feature') {
    updates.isFeatured = true;
  } else if (action === 'draft') {
    updates.status = CMS_STATUS.DRAFT;
    updates.launchEligible = false;
  } else {
    return res.status(400).json({ error: 'Unknown bulk action' });
  }

  const result = await Internship.updateMany({ _id: { $in: validIds } }, { $set: updates });
  await logAudit({
    ...auditFromRequest(req),
    action: `internship.bulk_${action}`,
    targetType: 'internship',
    metadata: { ids: validIds, modified: result.modifiedCount },
  });
  res.json({ action, affected: result.modifiedCount });
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Internship.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Internship not found' });
  scheduleSeoChangeNotification({
    entityType: 'internship',
    previous: doc.toObject ? doc.toObject() : doc,
    action: 'delete',
  });
  await logAudit({ ...auditFromRequest(req), action: 'internship.delete', targetType: 'internship', targetId: id, targetLabel: doc.title });
  res.status(204).send();
});
