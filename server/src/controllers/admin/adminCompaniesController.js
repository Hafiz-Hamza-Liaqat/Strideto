import { Company } from '../../models/Company.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { parseStringArray } from '../../utils/adminContentHelpers.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { runBulkAction, duplicateDoc } from '../../utils/adminBulkHelper.js';
import { coerceCountryCode, countryDisplayName } from '../../../../shared/international/country.js';
import { freeTextCountryRegex } from '../../../../shared/international/location.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.industry) filter.industry = new RegExp(sanitizeString(q.industry), 'i');
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.province || q.region) filter.province = new RegExp(sanitizeString(q.province || q.region), 'i');
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.verified === 'true') filter.verified = true;
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ name: re }, { industry: re }, { country: re }, { city: re }];
  }
  return filter;
}

function applyBody(doc, body) {
  if (body.name !== undefined) doc.name = sanitizeString(body.name);
  if (body.description !== undefined) doc.description = sanitizeString(body.description);
  if (body.website !== undefined) doc.website = sanitizeString(body.website);
  if (body.industry !== undefined) doc.industry = sanitizeString(body.industry);
  if (body.companySize !== undefined) doc.companySize = sanitizeString(body.companySize);
  if (body.location !== undefined) doc.location = sanitizeString(body.location);
  if (body.city !== undefined) doc.city = sanitizeString(body.city);
  if (body.province !== undefined || body.region !== undefined) {
    doc.province = sanitizeString(body.province ?? body.region);
  }
  if (body.country !== undefined || body.countryCode !== undefined) {
    const raw = body.country !== undefined ? body.country : body.countryCode;
    const code = coerceCountryCode(raw);
    doc.country = raw
      ? (code ? (countryDisplayName(code) || sanitizeString(raw)) : sanitizeString(raw))
      : '';
  }
  if (body.logoUrl !== undefined) doc.logoUrl = sanitizeString(body.logoUrl);
  if (body.bannerUrl !== undefined) doc.bannerUrl = sanitizeString(body.bannerUrl);
  if (body.status !== undefined) doc.status = body.status;
  if (body.verified !== undefined) doc.verified = !!body.verified;
  if (body.verificationLevel !== undefined) doc.verificationLevel = body.verificationLevel;
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
  const benefits = parseStringArray(body.benefits);
  if (benefits !== undefined) doc.benefits = benefits;
  const gallery = parseStringArray(body.gallery);
  if (gallery !== undefined) doc.gallery = gallery;
  if (body.socialLinks !== undefined) doc.socialLinks = { ...doc.socialLinks?.toObject?.() || doc.socialLinks || {}, ...body.socialLinks };
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    Company.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Company.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Company.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Company not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim()) return res.status(400).json({ error: 'Company name is required' });
  const doc = new Company({
    name: sanitizeString(body.name),
    status: body.status || 'draft',
  });
  applyBody(doc, body);
  const slugErr = await applyResolvedSlug('company', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('companies', doc);
  await logAudit({ ...auditFromRequest(req), action: 'company.create', targetType: 'company', targetId: doc._id, targetLabel: doc.name });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const doc = await Company.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Company not found' });
  applyBody(doc, req.body || {});
  const slugErr = await applyResolvedSlug('company', doc, req.body || {}, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('companies', doc);
  await logAudit({ ...auditFromRequest(req), action: 'company.update', targetType: 'company', targetId: doc._id, targetLabel: doc.name });
  res.json(doc);
});

export const duplicate = asyncHandler(async (req, res) => {
  const doc = await duplicateDoc(Company, req.params.id, (s) => {
    s.name = `${s.name} (Copy)`;
    delete s.slug;
    s.status = 'draft';
    s.verified = false;
  });
  if (!doc) return res.status(404).json({ error: 'Company not found' });
  const slugErr = await applyResolvedSlug('company', doc, { name: doc.name }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids } = req.body || {};
  const result = await runBulkAction({ req, Model: Company, ids, action, auditType: 'company' });
  if (result.status === 200 && Array.isArray(ids)) {
    const valid = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (action === 'delete') onContentBulkDeleted('companies', valid);
    else if (action === 'publish' || action === 'activate' || action === 'update') onContentBulkUpdated('companies', valid);
  }
  res.status(result.status).json(result.body);
});

export const remove = asyncHandler(async (req, res) => {
  const doc = await Company.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Company not found' });
  onContentDeleted('companies', req.params.id);
  await logAudit({ ...auditFromRequest(req), action: 'company.delete', targetType: 'company', targetId: req.params.id, targetLabel: doc.name });
  res.status(204).send();
});
