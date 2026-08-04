import { Job } from '../../models/Job.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { parseStringArray, pickBool } from '../../utils/adminContentHelpers.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { applyResolvedSlug, slugErrorResponse } from '../../utils/adminSlugHelpers.js';
import { cacheDelPattern } from '../../config/redis.js';
import { CACHE_KEYS } from '../../utils/cacheKeys.js';
import { invalidateDynamicContentForEntity } from '../../utils/dynamicContentCache.js';
import { onContentSaved, onContentDeleted, onContentBulkDeleted, onContentBulkUpdated } from '../../utils/contentIntegration.js';
import {
  buildJobDuplicateProjection,
  JOB_DUPLICATE_PRESERVE_FIELDS,
  JOB_DUPLICATE_RESET_FIELDS,
} from '../../services/jobWriteBoundary.js';
import { validateApplicationLink } from '../../utils/jobApplicationDestination.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.approvalStatus) filter.approvalStatus = q.approvalStatus;
  if (q.province) filter.province = new RegExp(sanitizeString(q.province), 'i');
  if (q.category) filter.category = new RegExp(sanitizeString(q.category), 'i');
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.employer) {
    const re = new RegExp(sanitizeString(q.employer), 'i');
    filter.$or = [{ company: re }, { organization: re }];
  }
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    filter.$or = [{ title: re }, { company: re }, { organization: re }];
  }
  return filter;
}

async function invalidateJobCaches() {
  await cacheDelPattern(CACHE_KEYS.PREFIX_TRENDING);
  await cacheDelPattern(CACHE_KEYS.PREFIX_FEATURED);
  invalidateDynamicContentForEntity('job');
}

function applyJobBody(doc, body, isCreate = false) {
  if (body.title !== undefined || isCreate) doc.title = sanitizeString(body.title);
  if (body.company !== undefined || body.organization !== undefined || isCreate) {
    doc.company = sanitizeString(body.company || body.organization);
  }
  if (body.organization !== undefined) doc.organization = sanitizeString(body.organization);
  if (body.location !== undefined) doc.location = sanitizeString(body.location);
  if (body.province !== undefined) doc.province = sanitizeString(body.province);
  if (body.city !== undefined) doc.city = sanitizeString(body.city);
  if (body.category !== undefined) doc.category = sanitizeString(body.category);
  if (body.type !== undefined) doc.type = body.type;
  if (body.jobType !== undefined) doc.jobType = body.jobType;
  if (body.description !== undefined) doc.description = sanitizeString(body.description);
  if (body.experience !== undefined) doc.experience = sanitizeString(body.experience);
  if (body.educationRequirement !== undefined) doc.educationRequirement = sanitizeString(body.educationRequirement);
  if (body.gender !== undefined) doc.gender = sanitizeString(body.gender);
  if (body.salaryRange !== undefined || body.salary !== undefined) {
    doc.salaryRange = sanitizeString(body.salaryRange || body.salary);
  }
  if (body.salaryCurrency !== undefined || body.currency !== undefined) {
    doc.salaryCurrency = sanitizeString(body.salaryCurrency || body.currency);
  }
  const reqs = parseStringArray(body.requirements);
  if (reqs !== undefined) doc.requirements = reqs;
  const resp = parseStringArray(body.responsibilities);
  if (resp !== undefined) doc.responsibilities = resp;
  const benefits = parseStringArray(body.benefits);
  if (benefits !== undefined) doc.benefits = benefits;
  const skills = parseStringArray(body.skills || body.skillsRequired);
  if (skills !== undefined) doc.skillsRequired = skills;
  const gallery = parseStringArray(body.gallery);
  if (gallery !== undefined) doc.gallery = gallery;
  if (body.applicationInstructions !== undefined) doc.applicationInstructions = sanitizeString(body.applicationInstructions);
  if (body.applicationLink !== undefined || body.link !== undefined || body.applyLink !== undefined) {
    const applicationLink = body.applicationLink ?? body.link ?? body.applyLink;
    const result = validateApplicationLink(applicationLink);
    if (!result.ok) return { status: 400, error: result.message, field: result.field };
    doc.applicationLink = result.value || '';
    if (result.value) doc.applyType = 'external';
  }
  if (body.status !== undefined) doc.status = body.status;
  if (body.deadline !== undefined) doc.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.logoUrl !== undefined) doc.logoUrl = sanitizeString(body.logoUrl);
  if (body.isFeatured !== undefined) doc.isFeatured = !!body.isFeatured;
  if (body.isSponsored !== undefined) doc.isSponsored = !!body.isSponsored;
  if (body.urgent !== undefined) doc.urgent = !!body.urgent;
  if (body.approvalStatus !== undefined) doc.approvalStatus = body.approvalStatus;
  if (body.remote !== undefined) doc.remote = pickBool(body.remote);
  if (body.hybrid !== undefined) doc.hybrid = pickBool(body.hybrid);
  if (body.seoTitle !== undefined) doc.seoTitle = sanitizeString(body.seoTitle);
  if (body.metaDescription !== undefined) doc.metaDescription = sanitizeString(body.metaDescription);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
  if (body.employerId !== undefined) doc.employerId = body.employerId || undefined;
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const sortField = req.query.sort || 'createdAt';
  const sortDir = req.query.order === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Job.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
    Job.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Job.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Job not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.title || !String(body.title).trim()) {
    return res.status(400).json({ error: 'Validation failed', details: { title: 'Title is required' } });
  }
  if (!body.company && !body.organization) {
    return res.status(400).json({ error: 'Validation failed', details: { company: 'Company or organization is required' } });
  }
  const doc = new Job({
    postedBy: req.user?.userId,
    status: body.status || 'draft',
    approvalStatus: body.approvalStatus || 'pending',
    applyType: 'external',
  });
  const validationError = applyJobBody(doc, body, true);
  if (validationError) return res.status(validationError.status).json({ error: validationError.error, field: validationError.field });
  const slugErr = await applyResolvedSlug('job', doc, body, true);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('jobs', doc);
  await invalidateJobCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: 'job.create',
    targetType: 'job',
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
  const doc = await Job.findById(id);
  if (!doc) return res.status(404).json({ error: 'Job not found' });
  const before = doc.toObject();
  const validationError = applyJobBody(doc, body);
  if (validationError) return res.status(validationError.status).json({ error: validationError.error, field: validationError.field });
  const slugErr = await applyResolvedSlug('job', doc, body, false);
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('jobs', doc);
  await invalidateJobCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: 'job.update',
    targetType: 'job',
    targetId: id,
    targetLabel: doc.title,
    before: { title: before.title, status: before.status, approvalStatus: before.approvalStatus },
    after: { title: doc.title, status: doc.status, approvalStatus: doc.approvalStatus },
    reason: body.reason || '',
  });
  res.json(doc);
});

// Field-level duplication contract lives in jobWriteBoundary.js
// (JOB_DUPLICATE_PRESERVE_FIELDS / JOB_DUPLICATE_RESET_FIELDS / JOB_DUPLICATE_FORBIDDEN_FIELDS)
// and docs/STRIDETO_ADMIN_JOB_DUPLICATION_REGRESSION_CORRECTION_REPORT.md. Only content and
// ownership/attribution fields are preserved from the source; paid placement, promotion,
// analytics, scrape provenance, translation linkage, and publication/moderation evidence are
// intentionally reset — title/status/approvalStatus/slug are then explicitly recomputed below.
export const duplicate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const source = await Job.findById(id).lean();
  if (!source) return res.status(404).json({ error: 'Job not found' });
  const duplicateInput = buildJobDuplicateProjection(source);
  duplicateInput.title = `${source.title} (Copy)`;
  duplicateInput.status = 'draft';
  duplicateInput.approvalStatus = 'pending';
  const doc = new Job(duplicateInput);
  const slugErr = await applyResolvedSlug(
    'job',
    doc,
    {
      title: duplicateInput.title,
      province: duplicateInput.province,
      location: duplicateInput.location,
    },
    true
  );
  if (slugErr) return slugErrorResponse(res, slugErr);
  await doc.save();
  onContentSaved('jobs', doc);
  await invalidateJobCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: 'job.duplicate',
    targetType: 'job',
    targetId: doc._id,
    targetLabel: doc.title,
    metadata: {
      sourceId: id,
      preservedFieldCount: JOB_DUPLICATE_PRESERVE_FIELDS.length,
      resetFieldCount: JOB_DUPLICATE_RESET_FIELDS.length,
    },
  });
  res.status(201).json(doc);
});

export const bulkAction = asyncHandler(async (req, res) => {
  const { action, ids = [] } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return res.status(400).json({ error: 'No valid ids' });

  const updates = {};
  let auditAction = 'job.bulk';
  if (action === 'delete') {
    const result = await Job.deleteMany({ _id: { $in: validIds } });
    onContentBulkDeleted('jobs', validIds);
    await invalidateJobCaches();
    await logAudit({
      ...auditFromRequest(req),
      action: 'job.bulk_delete',
      targetType: 'job',
      metadata: { ids: validIds, deleted: result.deletedCount },
    });
    return res.json({ action, affected: result.deletedCount });
  }
  if (action === 'archive') {
    updates.status = 'closed';
    auditAction = 'job.bulk_archive';
  } else if (action === 'publish') {
    updates.status = 'active';
    updates.approvalStatus = 'approved';
    auditAction = 'job.bulk_publish';
  } else if (action === 'approve') {
    updates.approvalStatus = 'approved';
    updates.status = 'active';
    auditAction = 'job.bulk_approve';
  } else if (action === 'reject') {
    updates.approvalStatus = 'rejected';
    auditAction = 'job.bulk_reject';
  } else if (action === 'feature') {
    updates.isFeatured = true;
    auditAction = 'job.bulk_feature';
  } else {
    return res.status(400).json({ error: 'Unknown bulk action' });
  }

  const result = await Job.updateMany({ _id: { $in: validIds } }, { $set: updates });
  if (action === 'publish' || action === 'approve') onContentBulkUpdated('jobs', validIds);
  await invalidateJobCaches();
  await logAudit({
    ...auditFromRequest(req),
    action: auditAction,
    targetType: 'job',
    metadata: { ids: validIds, modified: result.modifiedCount },
  });
  res.json({ action, affected: result.modifiedCount });
});

export const approveJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Job.findByIdAndUpdate(id, { status: 'active', approvalStatus: 'approved' }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Job not found' });
  onContentSaved('jobs', doc);
  await logAudit({ ...auditFromRequest(req), action: 'job.approve', targetType: 'job', targetId: id, targetLabel: doc.title });
  await invalidateJobCaches();
  res.json(doc);
});

export const rejectJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Job.findByIdAndUpdate(id, { approvalStatus: 'rejected' }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Job not found' });
  await logAudit({
    ...auditFromRequest(req),
    action: 'job.reject',
    targetType: 'job',
    targetId: id,
    targetLabel: doc.title,
    reason: req.body?.reason || '',
  });
  onContentSaved('jobs', doc);
  await invalidateJobCaches();
  res.json(doc);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Job.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Job not found' });
  await logAudit({
    ...auditFromRequest(req),
    action: 'job.delete',
    targetType: 'job',
    targetId: id,
    targetLabel: doc.title,
    before: { title: doc.title },
  });
  onContentDeleted('jobs', id);
  await invalidateJobCaches();
  res.status(204).send();
});
