import { Admission } from '../../models/Admission.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { parseStringArray } from '../../utils/adminContentHelpers.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';
import { deriveCmsLaunchEligible, CMS_STATUS } from '../../../../shared/cms/launchEligible.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.university) filter.institution = new RegExp(sanitizeString(q.university), 'i');
  if (q.province) filter.province = new RegExp(sanitizeString(q.province), 'i');
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ program: re }, { institution: re }, { department: re }];
  }
  return filter;
}

function syncAdmissionLaunchEligible(doc, before = null) {
  const existing = before || (doc.toObject ? doc.toObject() : doc);
  doc.launchEligible = deriveCmsLaunchEligible(existing, doc.status);
}

function applyBody(doc, body, isCreate = false) {
  if (body.program !== undefined || isCreate) doc.program = sanitizeString(body.program);
  if (body.institution !== undefined || body.university !== undefined || isCreate) {
    doc.institution = sanitizeString(body.institution || body.university);
    doc.university = doc.institution;
  }
  if (body.department !== undefined) doc.department = sanitizeString(body.department);
  if (body.degree !== undefined) doc.degree = sanitizeString(body.degree);
  if (body.province !== undefined) doc.province = sanitizeString(body.province);
  if (body.city !== undefined) doc.city = sanitizeString(body.city);
  if (body.session !== undefined) doc.session = sanitizeString(body.session);
  if (body.fee !== undefined) doc.fee = sanitizeString(body.fee);
  if (body.duration !== undefined) doc.duration = sanitizeString(body.duration);
  if (body.deadline !== undefined) doc.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.description !== undefined) doc.description = sanitizeString(body.description);
  const eligibility = parseStringArray(body.eligibility);
  if (eligibility !== undefined) doc.eligibility = eligibility;
  if (body.applicationInstructions !== undefined) doc.applicationInstructions = sanitizeString(body.applicationInstructions);
  if (body.link !== undefined || body.applicationLink !== undefined || body.applyLink !== undefined) {
    const linkVal = body.link ?? body.applicationLink ?? body.applyLink;
    const sanitized = linkVal ? sanitizeString(linkVal) : '';
    doc.link = sanitized;
    doc.applyLink = sanitized;
  }
  if (body.status !== undefined) doc.status = body.status;
  if (body.logoUrl !== undefined) doc.logoUrl = sanitizeString(body.logoUrl);
  if (body.brochureUrl !== undefined) doc.brochureUrl = sanitizeString(body.brochureUrl);
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
  syncAdmissionLaunchEligible(doc);
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const sortField = req.query.sort || 'createdAt';
  const sortDir = req.query.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Admission.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
    Admission.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Admission.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Admission not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.program || !String(body.program).trim()) {
    return res.status(400).json({ error: 'Validation failed', details: { program: 'Program is required' } });
  }
  const institution = sanitizeString(body.institution || body.university);
  if (!institution) {
    return res.status(400).json({ error: 'Validation failed', details: { institution: 'Institution or university is required' } });
  }
  const doc = new Admission({ status: body.status || CMS_STATUS.DRAFT, launchEligible: false });
  applyBody(doc, body, true);
  const slugErr = await applyResolvedSlug('admission', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('admissions', doc);
  await logAudit({
    ...auditFromRequest(req),
    action: 'admission.create',
    targetType: 'admission',
    targetId: doc._id,
    targetLabel: doc.program,
    after: { program: doc.program, status: doc.status },
  });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const body = req.body || {};
  const doc = await Admission.findById(id);
  if (!doc) return res.status(404).json({ error: 'Admission not found' });
  const before = doc.toObject();
  applyBody(doc, body);
  syncAdmissionLaunchEligible(doc, before);
  const slugErr = await applyResolvedSlug('admission', doc, body, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('admissions', doc);
  await logAudit({
    ...auditFromRequest(req),
    action: 'admission.update',
    targetType: 'admission',
    targetId: id,
    targetLabel: doc.program,
    before: { program: before.program, status: before.status },
    after: { program: doc.program, status: doc.status },
    reason: body.reason || '',
  });
  res.json(doc);
});

export const duplicate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const source = await Admission.findById(id).lean();
  if (!source) return res.status(404).json({ error: 'Admission not found' });
  delete source._id;
  delete source.createdAt;
  delete source.updatedAt;
  source.program = `${source.program} (Copy)`;
  source.status = CMS_STATUS.DRAFT;
  source.launchEligible = false;
  source.views = 0;
  delete source.slug;
  const doc = new Admission(source);
  const slugErr = await applyResolvedSlug('admission', doc, { program: source.program, institution: source.institution }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('admissions', doc);
  await logAudit({
    ...auditFromRequest(req),
    action: 'admission.duplicate',
    targetType: 'admission',
    targetId: doc._id,
    targetLabel: doc.program,
    metadata: { sourceId: id },
  });
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids = [] } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (action === 'delete') {
    const result = await Admission.deleteMany({ _id: { $in: validIds } });
    onContentBulkDeleted('admissions', validIds);
    await logAudit({
      ...auditFromRequest(req),
      action: 'admission.bulk_delete',
      targetType: 'admission',
      metadata: { ids: validIds, deleted: result.deletedCount },
    });
    return res.json({ action, affected: result.deletedCount });
  }

  const updates = {};
  let auditAction = 'admission.bulk';
  if (action === 'archive') {
    updates.status = CMS_STATUS.CLOSED;
    updates.launchEligible = false;
    auditAction = 'admission.bulk_archive';
  } else if (action === 'publish') {
    const docs = await Admission.find({ _id: { $in: validIds } }).lean();
    let modified = 0;
    for (const row of docs) {
      const launchEligible = deriveCmsLaunchEligible(row, CMS_STATUS.ACTIVE);
      await Admission.updateOne({ _id: row._id }, { $set: { status: CMS_STATUS.ACTIVE, launchEligible } });
      modified += 1;
    }
    onContentBulkUpdated('admissions', validIds);
    await logAudit({
      ...auditFromRequest(req),
      action: 'admission.bulk_publish',
      targetType: 'admission',
      metadata: { ids: validIds, modified },
    });
    return res.json({ action, affected: modified });
  } else if (action === 'feature') {
    updates.isFeatured = true;
    auditAction = 'admission.bulk_feature';
  } else {
    return res.status(400).json({ error: 'Unknown bulk action' });
  }

  const result = await Admission.updateMany({ _id: { $in: validIds } }, { $set: updates });
  if (action === 'publish') onContentBulkUpdated('admissions', validIds);
  await logAudit({
    ...auditFromRequest(req),
    action: auditAction,
    targetType: 'admission',
    metadata: { ids: validIds, modified: result.modifiedCount },
  });
  res.json({ action, affected: result.modifiedCount });
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Admission.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Admission not found' });
  onContentDeleted('admissions', id);
  await logAudit({
    ...auditFromRequest(req),
    action: 'admission.delete',
    targetType: 'admission',
    targetId: id,
    targetLabel: doc.program,
  });
  res.status(204).send();
});
