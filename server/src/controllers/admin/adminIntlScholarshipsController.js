import { IntlScholarship } from '../../models/IntlScholarship.js';
import { University } from '../../models/University.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { parseStringArray } from '../../utils/adminContentHelpers.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { runBulkAction, duplicateDoc } from '../../utils/adminBulkHelper.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';
import { scheduleSeoChangeNotification } from '../../services/seo/seoChangeNotificationService.js';
import { syncWorkflowAfterSave } from '../../services/workflow/workflowIntegration.js';
import { validIds } from '../../utils/adminBulkHelper.js';
import { freeTextCountryRegex } from '../../../../shared/international/location.js';
import { coerceCountryCode, countryDisplayName } from '../../../../shared/international/country.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeFreeTextCountry(raw) {
  const sanitized = sanitizeString(raw);
  const code = coerceCountryCode(sanitized);
  return code ? (countryDisplayName(code) || sanitized) : sanitized;
}

function buildScholarshipQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.funding) filter.fundingType = new RegExp(sanitizeString(q.funding), 'i');
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ title: re }, { country: re }, { university: re }, { provider: re }];
  }
  return filter;
}

function buildUniversityQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ name: re }, { country: re }, { city: re }];
  }
  return filter;
}

function applyScholarshipBody(doc, body) {
  if (body.title !== undefined) doc.title = sanitizeString(body.title);
  if (body.country !== undefined || body.countryCode !== undefined) {
    doc.country = normalizeFreeTextCountry(body.country !== undefined ? body.country : body.countryCode);
  }
  if (body.university !== undefined) doc.university = body.university ? sanitizeString(body.university) : undefined;
  if (body.universityId !== undefined) doc.universityId = body.universityId && mongoose.Types.ObjectId.isValid(body.universityId) ? body.universityId : undefined;
  if (body.deadline !== undefined) doc.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.applicationDeadline !== undefined) doc.applicationDeadline = body.applicationDeadline ? new Date(body.applicationDeadline) : undefined;
  if (body.visaRequirements !== undefined) doc.visaRequirements = body.visaRequirements ? sanitizeString(body.visaRequirements) : undefined;
  if (body.description !== undefined) doc.description = body.description ? sanitizeString(body.description) : undefined;
  const eligibility = parseStringArray(body.eligibility);
  if (eligibility !== undefined) doc.eligibility = eligibility;
  if (body.link !== undefined) doc.link = body.link ? sanitizeString(body.link) : undefined;
  if (body.status !== undefined) doc.status = body.status;
  if (body.provider !== undefined) doc.provider = sanitizeString(body.provider);
  if (body.fundingType !== undefined) doc.fundingType = sanitizeString(body.fundingType);
  if (body.degreeLevel !== undefined) doc.degreeLevel = sanitizeString(body.degreeLevel);
  if (body.amount !== undefined) doc.amount = sanitizeString(body.amount);
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
}

function applyUniversityBody(doc, body) {
  if (body.name !== undefined) doc.name = sanitizeString(body.name);
  if (body.country !== undefined || body.countryCode !== undefined) {
    doc.country = normalizeFreeTextCountry(body.country !== undefined ? body.country : body.countryCode);
  }
  if (body.city !== undefined) doc.city = sanitizeString(body.city);
  if (body.province !== undefined || body.region !== undefined) {
    doc.province = sanitizeString(body.province ?? body.region);
  }
  if (body.website !== undefined) doc.website = body.website ? sanitizeString(body.website) : undefined;
  if (body.description !== undefined) doc.description = body.description ? sanitizeString(body.description) : undefined;
  if (body.logoUrl !== undefined) doc.logoUrl = sanitizeString(body.logoUrl);
  if (body.bannerUrl !== undefined) doc.bannerUrl = sanitizeString(body.bannerUrl);
  if (body.ranking !== undefined) doc.ranking = body.ranking ? Number(body.ranking) : undefined;
  if (body.establishedYear !== undefined) doc.establishedYear = body.establishedYear ? Number(body.establishedYear) : undefined;
  if (body.contact !== undefined) doc.contact = sanitizeString(body.contact);
  if (body.status !== undefined) doc.status = body.status;
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
  if (body.type !== undefined) doc.type = body.type;
  if (body.programs !== undefined) doc.programs = body.programs;
  if (body.socialLinks !== undefined) doc.socialLinks = { ...doc.socialLinks?.toObject?.() || doc.socialLinks || {}, ...body.socialLinks };
}

export const listScholarships = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildScholarshipQuery(req.query);
  const [data, total] = await Promise.all([
    IntlScholarship.find(query).populate('universityId', 'name country').sort({ deadline: 1 }).skip(skip).limit(limit).lean(),
    IntlScholarship.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getScholarship = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await IntlScholarship.findById(req.params.id).populate('universityId', 'name country').lean();
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  res.json(doc);
});

export const createScholarship = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.title?.trim()) return res.status(400).json({ error: 'Validation failed', details: { title: 'Title is required' } });
  if (!body.country?.trim()) return res.status(400).json({ error: 'Validation failed', details: { country: 'Country is required' } });
  const doc = await IntlScholarship.create({
    title: sanitizeString(body.title),
    country: sanitizeString(body.country),
    status: body.status || 'active',
  });
  applyScholarshipBody(doc, body);
  const slugErr = await applyResolvedSlug('intl-scholarship', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  scheduleSeoChangeNotification({
    entityType: 'intl-scholarship',
    next: doc,
    action: 'save',
  });
  await logAudit({ ...auditFromRequest(req), action: 'intl_scholarship.create', targetType: 'intl_scholarship', targetId: doc._id, targetLabel: doc.title });
  res.status(201).json(doc);
});

export const updateScholarship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await IntlScholarship.findById(id);
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  const before = doc.toObject();
  applyScholarshipBody(doc, req.body || {});
  const slugErr = await applyResolvedSlug('intl-scholarship', doc, req.body || {}, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  scheduleSeoChangeNotification({
    entityType: 'intl-scholarship',
    previous: before,
    next: doc,
    action: 'save',
  });
  await logAudit({ ...auditFromRequest(req), action: 'intl_scholarship.update', targetType: 'intl_scholarship', targetId: id, targetLabel: doc.title });
  res.json(doc);
});

export const duplicateScholarship = asyncHandler(async (req, res) => {
  const source = await IntlScholarship.findById(req.params.id).lean();
  if (!source) return res.status(404).json({ error: 'Scholarship not found' });
  delete source._id;
  delete source.createdAt;
  delete source.updatedAt;
  source.title = `${source.title} (Copy)`;
  source.status = 'draft';
  delete source.slug;

  const doc = new IntlScholarship(source);
  const slugErr = await applyResolvedSlug('intl-scholarship', doc, { title: doc.title, country: doc.country }, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  await logAudit({ ...auditFromRequest(req), action: 'intl_scholarship.duplicate', targetType: 'intl_scholarship', targetId: doc._id, targetLabel: doc.title, metadata: { sourceId: req.params.id } });
  res.status(201).json(doc);
});

export const bulkScholarships = asyncHandler(async (req, res) => {
  const { action, ids } = req.body || {};
  const idsValid = validIds(ids);
  const beforeDocs = idsValid.length
    ? await IntlScholarship.find({ _id: { $in: idsValid } }).lean()
    : [];
  const result = await runBulkAction({ req, Model: IntlScholarship, ids, action, auditType: 'intl_scholarship' });
  if (result.status === 200 && beforeDocs.length) {
    if (action === 'delete') {
      for (const previous of beforeDocs) {
        scheduleSeoChangeNotification({
          entityType: 'intl-scholarship',
          previous,
          action: 'delete',
        });
      }
    } else {
      const afterDocs = await IntlScholarship.find({ _id: { $in: idsValid } }).lean();
      const afterById = new Map(afterDocs.map((row) => [String(row._id), row]));
      for (const previous of beforeDocs) {
        const next = afterById.get(String(previous._id));
        if (next) {
          scheduleSeoChangeNotification({
            entityType: 'intl-scholarship',
            previous,
            next,
            action: 'save',
          });
        }
      }
    }
  }
  res.status(result.status).json(result.body);
});

export const removeScholarship = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await IntlScholarship.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  scheduleSeoChangeNotification({
    entityType: 'intl-scholarship',
    previous: doc.toObject ? doc.toObject() : doc,
    action: 'delete',
  });
  await logAudit({ ...auditFromRequest(req), action: 'intl_scholarship.delete', targetType: 'intl_scholarship', targetId: id, targetLabel: doc.title });
  res.status(204).send();
});

export const listUniversities = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildUniversityQuery(req.query);
  const [data, total] = await Promise.all([
    University.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    University.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getUniversity = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await University.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'University not found' });
  res.json(doc);
});

export const createUniversity = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim()) return res.status(400).json({ error: 'Validation failed', details: { name: 'Name is required' } });
  if (!body.country?.trim()) return res.status(400).json({ error: 'Validation failed', details: { country: 'Country is required' } });
  const doc = await University.create({
    name: sanitizeString(body.name),
    country: sanitizeString(body.country),
    status: body.status || 'active',
  });
  applyUniversityBody(doc, body);
  const slugErr = await applyResolvedSlug('university', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('universities', doc);
  await syncWorkflowAfterSave('universities', doc).catch(() => {});
  await logAudit({ ...auditFromRequest(req), action: 'university.create', targetType: 'university', targetId: doc._id, targetLabel: doc.name });
  res.status(201).json(doc);
});

export const updateUniversity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await University.findById(id);
  if (!doc) return res.status(404).json({ error: 'University not found' });
  applyUniversityBody(doc, req.body || {});
  const slugErr = await applyResolvedSlug('university', doc, req.body || {}, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('universities', doc);
  await syncWorkflowAfterSave('universities', doc).catch(() => {});
  await logAudit({ ...auditFromRequest(req), action: 'university.update', targetType: 'university', targetId: id, targetLabel: doc.name });
  res.json(doc);
});

export const duplicateUniversity = asyncHandler(async (req, res) => {
  const doc = await duplicateDoc(University, req.params.id, (s) => {
    s.name = `${s.name} (Copy)`;
    delete s.slug;
    s.status = 'draft';
  });
  if (!doc) return res.status(404).json({ error: 'University not found' });
  onContentSaved('universities', doc);
  res.status(201).json(doc);
});

export const bulkUniversities = asyncHandler(async (req, res) => {
  const { action, ids } = req.body || {};
  const idsValid = validIds(ids);
  const result = await runBulkAction({ req, Model: University, ids, action, auditType: 'university' });
  if (action === 'delete') onContentBulkDeleted('universities', idsValid);
  if (action === 'publish') onContentBulkUpdated('universities', idsValid);
  res.status(result.status).json(result.body);
});

export const removeUniversity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await University.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'University not found' });
  onContentDeleted('universities', id);
  await logAudit({ ...auditFromRequest(req), action: 'university.delete', targetType: 'university', targetId: id, targetLabel: doc.name });
  res.status(204).send();
});
