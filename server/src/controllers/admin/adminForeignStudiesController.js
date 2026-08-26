import { ForeignStudy } from '../../models/ForeignStudy.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { runBulkAction, duplicateDoc } from '../../utils/adminBulkHelper.js';
import { freeTextCountryRegex } from '../../../../shared/international/location.js';
import { coerceCountryCode, countryDisplayName } from '../../../../shared/international/country.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.level) filter.level = q.level;
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ country: re }, { program: re }, { institution: re }];
  }
  return filter;
}

function applyBody(doc, body) {
  if (body.country !== undefined || body.countryCode !== undefined) {
    const raw = body.country !== undefined ? body.country : body.countryCode;
    const code = coerceCountryCode(raw);
    doc.country = code ? (countryDisplayName(code) || sanitizeString(raw)) : sanitizeString(raw);
  }
  if (body.program !== undefined) doc.program = body.program ? sanitizeString(body.program) : undefined;
  if (body.level !== undefined) doc.level = body.level;
  if (body.institution !== undefined) doc.institution = body.institution ? sanitizeString(body.institution) : undefined;
  if (body.requirements !== undefined) doc.requirements = Array.isArray(body.requirements) ? body.requirements.map(sanitizeString).filter(Boolean) : doc.requirements;
  if (body.deadline !== undefined) doc.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.description !== undefined) doc.description = body.description ? sanitizeString(body.description) : undefined;
  if (body.link !== undefined) doc.link = body.link ? sanitizeString(body.link) : undefined;
  if (body.status !== undefined) doc.status = body.status;
  if (body.imageUrl !== undefined) doc.imageUrl = sanitizeString(body.imageUrl);
  if (body.visaInfo !== undefined) doc.visaInfo = body.visaInfo ? sanitizeString(body.visaInfo) : undefined;
  if (body.costOfLiving !== undefined) doc.costOfLiving = body.costOfLiving ? sanitizeString(body.costOfLiving) : undefined;
  if (body.studentLife !== undefined) doc.studentLife = body.studentLife ? sanitizeString(body.studentLife) : undefined;
  if (body.languageTests !== undefined) doc.languageTests = Array.isArray(body.languageTests) ? body.languageTests.map(sanitizeString).filter(Boolean) : doc.languageTests;
  if (body.scholarshipsInfo !== undefined) doc.scholarshipsInfo = body.scholarshipsInfo ? sanitizeString(body.scholarshipsInfo) : undefined;
  if (body.intakes !== undefined) doc.intakes = Array.isArray(body.intakes) ? body.intakes.map(sanitizeString).filter(Boolean) : doc.intakes;
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
    ForeignStudy.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ForeignStudy.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await ForeignStudy.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Foreign study not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.country?.trim()) return res.status(400).json({ error: 'Validation failed', details: { country: 'Country is required' } });
  const doc = new ForeignStudy({
    country: sanitizeString(body.country),
    status: body.status || 'draft',
  });
  applyBody(doc, body);
  const slugErr = await applyResolvedSlug('foreign-study', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await logAudit({ ...auditFromRequest(req), action: 'foreign_study.create', targetType: 'foreign_study', targetId: doc._id, targetLabel: doc.country });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await ForeignStudy.findById(id);
  if (!doc) return res.status(404).json({ error: 'Foreign study not found' });
  const before = { country: doc.country, status: doc.status };
  applyBody(doc, req.body || {});
  const slugErr = await applyResolvedSlug('foreign-study', doc, req.body || {}, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await logAudit({ ...auditFromRequest(req), action: 'foreign_study.update', targetType: 'foreign_study', targetId: id, targetLabel: doc.country, before, after: { country: doc.country, status: doc.status } });
  res.json(doc);
});

export const duplicate = asyncHandler(async (req, res) => {
  const doc = await duplicateDoc(ForeignStudy, req.params.id, (s) => {
    s.country = `${s.country} (Copy)`;
    delete s.slug;
    s.status = 'draft';
  });
  if (!doc) return res.status(404).json({ error: 'Foreign study not found' });
  const slugErr = await applyResolvedSlug('foreign-study', doc, { country: doc.country, program: doc.program, status: 'draft' }, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await logAudit({ ...auditFromRequest(req), action: 'foreign_study.duplicate', targetType: 'foreign_study', targetId: doc._id, targetLabel: doc.country });
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids } = req.body || {};
  const result = await runBulkAction({ req, Model: ForeignStudy, ids, action, auditType: 'foreign_study' });
  res.status(result.status).json(result.body);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await ForeignStudy.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Foreign study not found' });
  await logAudit({ ...auditFromRequest(req), action: 'foreign_study.delete', targetType: 'foreign_study', targetId: id, targetLabel: doc.country });
  res.status(204).send();
});
