import mongoose from 'mongoose';
import { Institution } from '../../models/Institution.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { canonicalizeStoredPhone } from '../../../../shared/international/phone.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { runBulkAction, duplicateDoc } from '../../utils/adminBulkHelper.js';
import { syncWorkflowAfterSave } from '../../services/workflow/workflowIntegration.js';
import { freeTextCountryRegex } from '../../../../shared/international/location.js';
import { coerceCountryCode, countryDisplayName } from '../../../../shared/international/country.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const TYPES = ['school', 'college', 'technical_institute', 'training_center'];

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.type && TYPES.includes(q.type)) filter.type = q.type;
  if (q.country || q.countryCode) {
    const re = freeTextCountryRegex(q.country || q.countryCode);
    if (re) filter.country = re;
  }
  if (q.province || q.region) filter.province = new RegExp(sanitizeString(q.province || q.region), 'i');
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ name: re }, { city: re }, { description: re }, { country: re }];
  }
  return filter;
}

function applyBody(doc, body) {
  if (body.name !== undefined) doc.name = sanitizeString(body.name);
  if (body.type !== undefined && TYPES.includes(body.type)) doc.type = body.type;
  if (body.description !== undefined) doc.description = body.description ? sanitizeString(body.description) : undefined;
  if (body.city !== undefined) doc.city = body.city ? sanitizeString(body.city) : undefined;
  if (body.province !== undefined || body.region !== undefined) {
    doc.province = (body.province ?? body.region) ? sanitizeString(body.province ?? body.region) : undefined;
  }
  if (body.country !== undefined || body.countryCode !== undefined) {
    const raw = body.country !== undefined ? body.country : body.countryCode;
    const code = coerceCountryCode(raw);
    doc.country = raw
      ? (code ? (countryDisplayName(code) || sanitizeString(raw)) : sanitizeString(raw))
      : undefined;
  }
  if (body.address !== undefined) doc.address = body.address ? sanitizeString(body.address) : undefined;
  if (body.phone !== undefined) {
    const result = canonicalizeStoredPhone(body.phone);
    if (!result.ok) throw Object.assign(new Error(result.error), { status: 400 });
    doc.phone = result.value || undefined;
  }
  if (body.email !== undefined) doc.email = body.email ? sanitizeString(body.email) : undefined;
  if (body.website !== undefined) doc.website = body.website ? sanitizeString(body.website) : undefined;
  if (body.imageUrl !== undefined) doc.imageUrl = sanitizeString(body.imageUrl);
  if (body.logoUrl !== undefined) doc.logoUrl = sanitizeString(body.logoUrl);
  if (body.programs !== undefined) doc.programs = Array.isArray(body.programs) ? body.programs.map(sanitizeString).filter(Boolean) : doc.programs;
  if (body.facilities !== undefined) doc.facilities = Array.isArray(body.facilities) ? body.facilities.map(sanitizeString).filter(Boolean) : doc.facilities;
  if (body.accreditation !== undefined) doc.accreditation = body.accreditation ? sanitizeString(body.accreditation) : undefined;
  if (body.establishedYear !== undefined) doc.establishedYear = body.establishedYear ? Number(body.establishedYear) : undefined;
  if (body.status !== undefined) doc.status = body.status;
  if (body.seoTitle !== undefined) doc.seoTitle = body.seoTitle ? sanitizeString(body.seoTitle) : undefined;
  if (body.metaDescription !== undefined) doc.metaDescription = body.metaDescription ? sanitizeString(body.metaDescription) : undefined;
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    Institution.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Institution.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Institution.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim()) return res.status(400).json({ error: 'Validation failed', details: { name: 'Name is required' } });
  if (!body.type || !TYPES.includes(body.type)) return res.status(400).json({ error: 'Validation failed', details: { type: 'Valid type is required' } });
  const doc = new Institution({
    name: sanitizeString(body.name),
    type: body.type,
    status: body.status || 'active',
  });
  applyBody(doc, body);
  const slugErr = await applyResolvedSlug('institution', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('legacy-institutions', doc);
  await syncWorkflowAfterSave('universities', doc).catch(() => {});
  await logAudit({ ...auditFromRequest(req), action: 'institution.create', targetType: 'institution', targetId: doc._id, targetLabel: doc.name });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Institution.findById(id);
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  applyBody(doc, req.body || {});
  const slugErr = await applyResolvedSlug('institution', doc, req.body || {}, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('legacy-institutions', doc);
  await syncWorkflowAfterSave('universities', doc).catch(() => {});
  await logAudit({ ...auditFromRequest(req), action: 'institution.update', targetType: 'institution', targetId: doc._id });
  res.json(doc);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Institution.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  onContentDeleted('legacy-institutions', id);
  await logAudit({ ...auditFromRequest(req), action: 'institution.delete', targetType: 'institution', targetId: id });
  res.status(204).send();
});

export const duplicate = asyncHandler(async (req, res) => {
  const doc = await duplicateDoc(Institution, req.params.id, ['name', 'slug']);
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  doc.name = `${doc.name} (copy)`;
  delete doc.slug;
  doc.status = 'draft';
  const slugErr = await applyResolvedSlug('institution', doc, { name: doc.name, status: 'draft' }, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await syncWorkflowAfterSave('universities', doc).catch(() => {});
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const result = await runBulkAction(Institution, req.body, req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [];
  if (result.status === 200 && ids.length) {
    if (req.body?.action === 'delete') onContentBulkDeleted('legacy-institutions', ids);
    else onContentBulkUpdated('legacy-institutions', ids);
  }
  res.json(result);
});
